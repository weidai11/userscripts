
import { Logger } from '../utils/logger';
import { escapeHtml, renderPostHeader } from '../utils/rendering';
import { fetchCommentsByIds } from './loader';
import { type ArchiveSortBy, type ArchiveViewMode, isThreadMode } from './state';
import { buildHighlightRegex } from './search/highlight';
import type { Post, Comment, ParentCommentRef } from '../../../shared/graphql/queries';
import type { ReaderState } from '../state';
import { renderPostGroup, renderPostBody } from '../render/post';
import { renderComment } from '../render/comment';
import { getUIHost } from '../render/uiHost';

let currentRenderLimit = (window as any).__PR_RENDER_LIMIT_OVERRIDE || 250;
const INDEX_SNIPPET_MAX_LEN = 120;

export type RenderArchiveOptions = {
  snippetTerms?: readonly string[];
  snippetPattern?: RegExp | null;
};

/**
 * Configure view state (called by index.ts)
 */
export const updateRenderLimit = (limit: number) => {
  currentRenderLimit = limit;
};

/**
 * Reset view limit to default (called by initArchive)
 */
export const resetRenderLimit = () => {
  currentRenderLimit = (window as any).__PR_RENDER_LIMIT_OVERRIDE || 5000;
};

/**
 * Increment view limit (Load More)
 */
export const incrementRenderLimit = (delta: number) => {
  currentRenderLimit += delta;
};

/**
 * [P2-FIX] Fetch missing parent context comments for thread view
 * Ensures parent comments are loaded so thread structure is complete
 */
const ensureContextForItems = async (
  items: (Post | Comment)[],
  state: ReaderState
): Promise<void> => {
  // Track missing IDs with their associated postId
  const missingIds = new Set<string>();
  const commentPostIdMap = new Map<string, string>(); // Maps comment ID to its postId

  for (const item of items) {
    if ('title' in item) continue; // It's a post, no parents needed

    const comment = item as Comment;
    const itemPostId = comment.postId;
    const immediateParentId = comment.parentCommentId || (comment as any).parentComment?._id || null;
    if (immediateParentId && !state.commentById.has(immediateParentId)) {
      missingIds.add(immediateParentId);
      if (!commentPostIdMap.has(immediateParentId)) {
        commentPostIdMap.set(immediateParentId, itemPostId);
      }
    }

    let current: any = comment.parentComment;
    let depth = 0;

    // Traverse up to 5 levels to get context
    while (current && depth < 5) {
      const currentId = typeof current._id === 'string' ? current._id : null;
      if (currentId && !state.commentById.has(currentId)) {
        missingIds.add(currentId);
        // Track which post this context belongs to
        if (!commentPostIdMap.has(currentId)) {
          commentPostIdMap.set(currentId, itemPostId);
        }
      }

      // Continue traversing if parent reference exists
      if (current.parentComment) {
        current = current.parentComment;
      } else {
        break;
      }
      depth++;
    }
  }

  if (missingIds.size > 0) {
    Logger.info(`Thread View: Fetching ${missingIds.size} missing context comments...`);
    const fetched = await fetchCommentsByIds(Array.from(missingIds), state.archiveUsername || undefined);

    // [WS2-FIX] Use UIHost to merge comments and set postIds (Deduplicated logic)
    getUIHost().mergeComments(fetched, true, commentPostIdMap);

    // [PR-UARCH-31] Fallback: if cache+network still cannot resolve some ancestors,
    // keep placeholder stubs so the thread chain remains navigable.
    ensurePlaceholderContext(items, state);
  }
};

/**
 * Create stub context comments from the parentComment chain data
 * already present in each comment's GraphQL response.
 * No network requests needed.
 */
const ensurePlaceholderContext = (
  items: (Post | Comment)[], state: ReaderState
): void => {
  const stubs: Comment[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    if ('title' in item) continue;
    const comment = item as Comment;
    let current = comment.parentComment as any;

    while (current?._id) {
      // Keep walking upward even when an ancestor is already seen/loaded;
      // that avoids skipping deeper missing ancestors on shared chains.
      if (!state.commentById.has(current._id) && !seen.has(current._id)) {
        seen.add(current._id);
        stubs.push(parentRefToStub(current, comment));
      }
      current = current.parentComment;
    }
  }

  if (stubs.length > 0) {
    getUIHost().mergeComments(stubs, true);
  }
};

/**
 * Main Render Function
 * [P2-FIX] Thread view now loads parent context before rendering
 * [WS3-FIX] Accepts sortBy parameter for group-level thread sorting
 */
const renderChunked = <T>(
  items: T[],
  renderFn: (item: T) => string,
  container: HTMLElement,
  chunkSize: number = 50
): Promise<void> => {
  return new Promise((resolve) => {
    container.innerHTML = '';
    if (items.length === 0) {
      resolve();
      return;
    }

    let currentIndex = 0;
    const renderNextChunk = () => {
      let html = '';
      const chunk = items.slice(currentIndex, currentIndex + chunkSize);

      for (const item of chunk) {
        html += renderFn(item);
      }

      container.insertAdjacentHTML('beforeend', html);
      currentIndex += chunkSize;

      if (currentIndex < items.length) {
        requestAnimationFrame(renderNextChunk);
      } else {
        resolve();
      }
    };

    requestAnimationFrame(renderNextChunk);
  });
};

export const renderArchiveFeed = async (
  container: HTMLElement,
  items: (Post | Comment)[],
  viewMode: ArchiveViewMode,
  state: ReaderState,
  sortBy?: ArchiveSortBy,
  options: RenderArchiveOptions = {}
): Promise<void> => {
  if (items.length === 0) {
    container.innerHTML = '<div class="pr-status">No items found for this user.</div>';
    return;
  }

  const visibleItems = items.slice(0, currentRenderLimit);
  const loadMoreBtn = document.getElementById('archive-load-more');

  if (loadMoreBtn) {
    loadMoreBtn.style.display = items.length > currentRenderLimit ? 'block' : 'none';
    if (items.length > currentRenderLimit && loadMoreBtn.querySelector('button')) {
      loadMoreBtn.querySelector('button')!.textContent = `Load More (${items.length - currentRenderLimit} remaining)`;
    }
  }

  if (viewMode === 'index') {
    const snippetTerms = options.snippetTerms ?? [];
    const snippetPattern = options.snippetPattern ?? buildHighlightRegex(snippetTerms);
    await renderChunked(
      visibleItems,
      (item) => renderIndexItem(item, { ...options, snippetTerms, snippetPattern }),
      container
    );
  } else if (isThreadMode(viewMode)) {
    // [P2-FIX] Load parent context first, then render thread view
    // [WS3-FIX] Pass sortBy for group-level sorting
    if (viewMode === 'thread-full') {
      await ensureContextForItems(visibleItems, state);
    } else {
      ensurePlaceholderContext(visibleItems, state);
    }
    await renderThreadView(container, visibleItems, state, sortBy);
  } else {
    await renderChunked(
      visibleItems,
      (item) => renderCardItem(item, state),
      container
    );
  }
};

/**
 * Render items grouped by Thread (Post)
 * [WS2-FIX] Renders visible comments plus ancestor context
 * [WS3-FIX] Implements true group-level sorting based on sort mode
 */
const renderThreadView = (
  container: HTMLElement,
  items: (Post | Comment)[],
  state: ReaderState,
  sortBy?: ArchiveSortBy
): Promise<void> => {
  // 1. Build inclusion set: visible comments + their ancestors
  const visibleCommentIds = new Set<string>();
  const inclusionCommentIds = new Set<string>();

  items.forEach(item => {
    if (!('title' in item)) {
      visibleCommentIds.add(item._id);
      inclusionCommentIds.add(item._id);

      // [WS2-FIX] Add ancestor IDs from state.commentById
      const comment = item as Comment;
      // Handle both parentCommentId string and parentComment object
      let currentId: string | null = comment.parentCommentId || (comment as any).parentComment?._id || null;
      let depth = 0;
      while (currentId && depth < 20) { // Limit depth to prevent infinite loops
        inclusionCommentIds.add(currentId);
        const parent = state.commentById.get(currentId);
        currentId = parent?.parentCommentId || (parent as any)?.parentComment?._id || null;
        depth++;
      }
    }
  });

  // 2. Group into Posts, filtering non-visible comments
  const postGroups = new Map<string, {
    postId: string;
    comments: Comment[];
    maxDate: Date;
    maxScore: number;
  }>();

  // [WS2-FIX] Use the broader inclusion set instead of just visible items
  inclusionCommentIds.forEach(commentId => {
    const comment = state.commentById.get(commentId);
    if (!comment) return;

    if (!postGroups.has(comment.postId)) {
      postGroups.set(comment.postId, {
        postId: comment.postId,
        comments: [],
        maxDate: new Date(0),
        maxScore: Number.NEGATIVE_INFINITY
      });
    }
    postGroups.get(comment.postId)!.comments.push(comment);
  });

  // Also include standalone posts
  items.forEach(item => {
    if ('title' in item) {
      if (!postGroups.has(item._id)) {
        postGroups.set(item._id, {
          postId: item._id,
          comments: [],
          maxDate: new Date(0),
          maxScore: Number.NEGATIVE_INFINITY
        });
      }
    }
  });

  // Calculate metrics per group
  postGroups.forEach((group, postId) => {
    let maxDate = new Date(0);
    let maxScore = Number.NEGATIVE_INFINITY;

    const comments = group.comments;

    // Evaluate all included comments for group sorting metrics
    comments.forEach(c => {
      const cDate = new Date(c.postedAt);
      if (cDate > maxDate) maxDate = cDate;
      if (typeof c.baseScore === 'number' && c.baseScore > maxScore) {
        maxScore = c.baseScore;
      }
    });

    // If no comments, use post date/score for metrics
    const post = state.postById.get(postId);
    if (post) {
      const postDate = new Date(post.postedAt);
      if (postDate > maxDate) maxDate = postDate;
      if (typeof post.baseScore === 'number' && post.baseScore > maxScore) {
        maxScore = post.baseScore;
      }
    }

    group.maxDate = maxDate;
    group.maxScore = maxScore === Number.NEGATIVE_INFINITY ? 0 : maxScore;
  });

  // 3. [WS3-FIX] Sort post groups by computed metrics
  const sortedGroups = Array.from(postGroups.values());
  switch (sortBy) {
    case 'date-asc':
    case 'replyTo': // Fallback to date for replyTo in thread view
    case 'relevance': // Fallback to date for relevance in thread view
      sortedGroups.sort((a, b) => a.maxDate.getTime() - b.maxDate.getTime());
      break;
    case 'score':
      sortedGroups.sort((a, b) => b.maxScore - a.maxScore);
      break;
    case 'score-asc':
      sortedGroups.sort((a, b) => a.maxScore - b.maxScore);
      break;
    case 'date':
    default:
      sortedGroups.sort((a, b) => b.maxDate.getTime() - a.maxDate.getTime());
      break;
  }

  // 4. Clear container
  container.innerHTML = '';

  // 5. Render each post group with all inclusion comments in chunks
  return new Promise<void>((resolve) => {
    if (sortedGroups.length === 0) {
      resolve();
      return;
    }

    const CHUNK_SIZE = 15; // smaller chunk size for groups (heavy)
    let currentIndex = 0;

    const renderNextChunk = () => {
      let html = '';
      const chunk = sortedGroups.slice(currentIndex, currentIndex + CHUNK_SIZE);

      chunk.forEach(group => {
        const post = state.postById.get(group.postId);

        // [WS2-FIX] Include all comments in the inclusion set (visible + ancestors)
        const postComments = group.comments;

        // If we have neither post nor comments, skip (shouldn't happen directly from items)
        if (!post && postComments.length === 0) return;

        const postGroup = {
          postId: group.postId,
          title: post?.title || postComments.find(c => c.post?.title)?.post?.title || 'Unknown Post',
          comments: postComments,
          fullPost: post
        };

        html += renderPostGroup(postGroup, state);
      });

      container.insertAdjacentHTML('beforeend', html);
      currentIndex += CHUNK_SIZE;

      if (currentIndex < sortedGroups.length) {
        requestAnimationFrame(renderNextChunk);
      } else {
        resolve();
      }
    };

    requestAnimationFrame(renderNextChunk);
  });
};


/**
 * Convert a ParentCommentRef (from the GraphQL parentComment chain)
 * into a minimal Comment suitable for renderContextPlaceholder.
 */
const parentRefToStub = (ref: ParentCommentRef, sourceComment: Comment): Comment => ({
  _id: ref._id,
  postedAt: ref.postedAt || '',
  parentCommentId: ref.parentCommentId || '',
  user: ref.user ? { ...ref.user, slug: '', karma: 0, htmlBio: '' } : null,
  postId: sourceComment.postId,
  post: sourceComment.post ?? null,
  htmlBody: '',
  baseScore: typeof ref.baseScore === 'number' ? ref.baseScore : 0,
  voteCount: 0,
  pageUrl: ref.pageUrl || '',
  author: ref.user?.username || '', rejected: false,
  topLevelCommentId: sourceComment.topLevelCommentId || ref._id,
  parentComment: null,
  extendedScore: null,
  afExtendedScore: ref.afExtendedScore ?? null,
  currentUserVote: null, currentUserExtendedVote: null,
  contents: { markdown: null },
  descendentCount: 0,
  directChildrenCount: 0,
  contextType: 'stub',
} as any as Comment);

/**
 * 1. Card View - Uses shared rendering components
 */
export const renderCardItem = (item: Post | Comment, state: ReaderState): string => {
  const isPost = 'title' in item;

  if (isPost) {
    // Render post header + body using shared components
    const post = item as Post;
    const headerHtml = renderPostHeader(post, { isFullPost: true, state });
    const bodyHtml = post.htmlBody ? renderPostBody(post, false) : '';
    return `
      <div class="pr-archive-item pr-post pr-item" data-id="${post._id}" data-post-id="${post._id}">
        ${headerHtml}
        ${bodyHtml}
      </div>
    `;
  }

  // Comment: render with shared renderComment
  const comment = item as Comment;
  const immediateParentId = comment.parentCommentId || comment.parentComment?._id || null;
  const parentFromState = immediateParentId ? state.commentById.get(immediateParentId) : null;
  const isContextParentFromState = !!parentFromState && !!(parentFromState as any).contextType;
  const parentComment = isContextParentFromState
    ? parentFromState
    : (comment.parentComment ? parentRefToStub(comment.parentComment, comment) : null);

  if (!parentComment || parentComment._id === comment._id) {
    return `<div class="pr-archive-item">${renderComment(comment, state)}</div>`;
  }

  // In card view, show immediate parent context with the current comment nested under it.
  const nestedCommentHtml = `<div class="pr-replies">${renderComment(comment, state)}</div>`;
  return `<div class="pr-archive-item">${renderComment(parentComment, state, nestedCommentHtml)}</div>`;
};

/**
 * 2. Index View
 */
const stripHtmlTags = (value: string): string => value.replace(/<[^>]+>/g, '');

export const extractSnippet = (
  text: string,
  maxLen: number,
  snippetTerms: readonly string[],
  snippetPattern?: RegExp | null
): string => {
  if (!text) return '';
  let bestMatchIndex = Number.POSITIVE_INFINITY;
  let bestMatchLength = 0;

  const matchPattern = snippetPattern === undefined
    ? buildHighlightRegex(snippetTerms)
    : snippetPattern;
  if (matchPattern) {
    matchPattern.lastIndex = 0;
    const firstMatch = matchPattern.exec(text);
    if (firstMatch && typeof firstMatch.index === 'number') {
      bestMatchIndex = firstMatch.index;
      bestMatchLength = firstMatch[0]?.length ?? 0;
    }
  }

  if (bestMatchIndex !== Number.POSITIVE_INFINITY) {
    const contextRadius = Math.max(0, Math.floor((maxLen - bestMatchLength) / 2));
    let start = Math.max(0, bestMatchIndex - contextRadius);
    let end = Math.min(text.length, bestMatchIndex + bestMatchLength + contextRadius);

    const targetLen = Math.min(maxLen, text.length);
    const currentLen = end - start;
    if (currentLen < targetLen) {
      const deficit = targetLen - currentLen;
      if (start === 0) {
        end = Math.min(text.length, end + deficit);
      } else if (end === text.length) {
        start = Math.max(0, start - deficit);
      }
    }

    const prefix = start > 0 ? '...' : '';
    const suffix = end < text.length ? '...' : '';
    return `${prefix}${text.slice(start, end)}${suffix}`;
  }

  return text.slice(0, maxLen) + (text.length > maxLen ? '...' : '');
};

export const renderIndexItem = (
  item: Post | Comment,
  options: RenderArchiveOptions = {}
): string => {
  const snippetTerms = options.snippetTerms ?? [];
  const snippetPattern = options.snippetPattern;
  const isPost = 'title' in item;
  let title: string;
  if (isPost) {
    title = (item as Post).title;
  } else {
    const bodyText = stripHtmlTags((item as Comment).htmlBody || '');
    title = extractSnippet(bodyText, INDEX_SNIPPET_MAX_LEN, snippetTerms, snippetPattern);
  }
  const context = isPost ? 'Post' : `Reply to ${getInterlocutorName(item)}`;
  const date = item.postedAt ? new Date(item.postedAt).toLocaleDateString() : '';

  return `
        <div class="pr-archive-index-item" data-id="${item._id}" data-action="expand-index-item" style="cursor: pointer;">
            <div class="pr-index-score" style="color: ${item.baseScore > 0 ? 'var(--pr-highlight)' : 'inherit'}">
                ${item.baseScore || 0}
            </div>
            <div class="pr-index-title">
                ${escapeHtml(title)}
            </div>
            <div class="pr-index-meta">
                ${context} • ${date}
            </div>
        </div>
    `;
};

const getInterlocutorName = (item: Post | Comment): string => {
  if ('title' in item) return " (Original Post)";
  const c = item as Comment;
  if (c.parentComment?.user?.displayName) return c.parentComment.user.displayName;
  if (c.post?.user?.displayName) return c.post.user.displayName;
  return "Unknown";
};
