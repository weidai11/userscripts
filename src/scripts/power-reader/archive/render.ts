
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

const getDefaultRenderLimit = (): number => {
  const override = (window as any).__PR_RENDER_LIMIT_OVERRIDE;
  return typeof override === 'number' && Number.isFinite(override) && override > 0
    ? override
    : Number.MAX_SAFE_INTEGER;
};

let currentRenderLimit = getDefaultRenderLimit();
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
  currentRenderLimit = getDefaultRenderLimit();
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

    // Traverse up to 20 levels to get context
    while (current && depth < 20) {
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
    let depth = 0;

    while (current?._id && depth < 20) {
      // Keep walking upward even when an ancestor is already seen/loaded;
      // that avoids skipping deeper missing ancestors on shared chains.
      if (!state.commentById.has(current._id) && !seen.has(current._id)) {
        seen.add(current._id);
        stubs.push(parentRefToStub(current, comment));
      }
      current = current.parentComment;
      depth++;
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
  abortSignal?: AbortSignal,
  onProgress?: (percent: number) => void
): Promise<void> => {
  container.innerHTML = '';
  if (items.length === 0) {
    return Promise.resolve();
  }

  // Render first 250 items synchronously for immediate visual feedback
  const SYNC_THRESHOLD = 250;
  const firstBatchSize = Math.min(items.length, SYNC_THRESHOLD);

  let firstHtml = '';
  for (let i = 0; i < firstBatchSize; i++) {
    if (abortSignal?.aborted) return Promise.resolve();
    firstHtml += renderFn(items[i]);
  }
  container.insertAdjacentHTML('beforeend', firstHtml);

  if (onProgress) onProgress(Math.round((firstBatchSize / items.length) * 100));

  if (items.length <= firstBatchSize) {
    return Promise.resolve();
  }

  // Render the rest in large background chunks
  return new Promise((resolve) => {
    let currentIndex = firstBatchSize;
    const BACKGROUND_CHUNK_SIZE = 500; // Large chunks finish the list quickly

    const renderNextChunk = () => {
      if (abortSignal?.aborted) {
        resolve();
        return;
      }

      const end = Math.min(currentIndex + BACKGROUND_CHUNK_SIZE, items.length);
      const htmlParts: string[] = [];
      for (let i = currentIndex; i < end; i++) {
        htmlParts.push(renderFn(items[i]));
      }

      container.insertAdjacentHTML('beforeend', htmlParts.join(''));
      currentIndex = end;

      if (onProgress) onProgress(Math.round((currentIndex / items.length) * 100));

      if (currentIndex < items.length) {
        // Use setTimeout(0) to yield to the browser but continue as fast as possible
        // This avoids artificially inflating the Render metric by waiting for VSync cycles
        setTimeout(renderNextChunk, 0);
      } else {
        resolve();
      }
    };

    setTimeout(renderNextChunk, 0);
  });
};

export const renderArchiveFeed = async (
  container: HTMLElement,
  items: (Post | Comment)[],
  viewMode: ArchiveViewMode,
  state: ReaderState,
  sortBy?: ArchiveSortBy,
  options: RenderArchiveOptions & { abortSignal?: AbortSignal, onProgress?: (percent: number) => void } = {}
): Promise<void> => {
  if (items.length === 0) {
    container.innerHTML = '<div class="pr-status">No items found for this user.</div>';
    return;
  }

  // Set loading cursor on body only for the heavy synchronous start
  document.body.style.cursor = 'wait';

  try {
    const visibleItems = items.slice(0, currentRenderLimit);

    if (viewMode === 'index') {
      const snippetTerms = options.snippetTerms ?? [];
      const snippetPattern = options.snippetPattern ?? buildHighlightRegex(snippetTerms);
      const renderPromise = renderChunked(
        visibleItems,
        (item) => renderIndexItem(item, { ...options, snippetTerms, snippetPattern }),
        container,
        options.abortSignal,
        options.onProgress
      );
      // Reset cursor as soon as the first batch is likely painted
      document.body.style.cursor = '';
      await renderPromise;
    } else if (isThreadMode(viewMode)) {
      if (viewMode === 'thread-full') {
        await ensureContextForItems(visibleItems, state);
      } else {
        ensurePlaceholderContext(visibleItems, state);
      }
      
      if (options.abortSignal?.aborted) return;

      const renderPromise = renderThreadView(container, visibleItems, state, sortBy, options.abortSignal, options.onProgress);
      document.body.style.cursor = '';
      await renderPromise;
    } else {
      const renderPromise = renderChunked(
        visibleItems,
        (item) => renderCardItem(item, state),
        container,
        options.abortSignal,
        options.onProgress
      );
      document.body.style.cursor = '';
      await renderPromise;
    }

    if (options.abortSignal?.aborted) return;

    // [PR-FIX] Add truncation note if results are capped by render limit
    const isTruncated = items.length > currentRenderLimit;
    if (isTruncated) {
      const footer = document.createElement('div');
      footer.className = 'pr-render-truncation-note';
      footer.style.textAlign = 'center';
      footer.style.padding = '20px';
      footer.style.color = 'var(--pr-text-secondary)';
      footer.style.borderTop = '1px solid var(--pr-border-subtle)';
      footer.style.marginTop = '10px';
      footer.textContent = `Showing first ${currentRenderLimit.toLocaleString()} of ${items.length.toLocaleString()} items. Large datasets are capped for performance.`;
      container.appendChild(footer);
    }
  } finally {
    // Reset cursor just in case it wasn't reset earlier
    if (document.body.style.cursor === 'wait') {
      document.body.style.cursor = '';
    }
  }
};

const renderThreadView = (
  container: HTMLElement,
  items: (Post | Comment)[],
  state: ReaderState,
  sortBy?: ArchiveSortBy,
  abortSignal?: AbortSignal,
  onProgress?: (percent: number) => void
): Promise<void> => {
  // 1. Build inclusion set: visible comments + their ancestors
  const inclusionCommentIds = new Set<string>();

  items.forEach(item => {
    if (!('title' in item)) {
      inclusionCommentIds.add(item._id);

      // [WS2-FIX] Add ancestor IDs from state.commentById
      const comment = item as Comment;
      let currentId: string | null = comment.parentCommentId || (comment as any).parentComment?._id || null;
      let depth = 0;
      while (currentId && depth < 20) { 
        if (inclusionCommentIds.has(currentId)) break; // Optimization: Stop if parent is already in the set
        inclusionCommentIds.add(currentId);
        const parent = state.commentById.get(currentId);
        currentId = parent?.parentCommentId || (parent as any)?.parentComment?._id || null;
        depth++;
      }
    }
  });

  // 2. Group into Posts
  const postGroups = new Map<string, {
    postId: string;
    comments: Comment[];
    maxDate: Date;
    maxScore: number;
  }>();

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
    let maxDateStr = "";
    let maxScore = Number.NEGATIVE_INFINITY;
    group.comments.forEach(c => {
      if (c.postedAt > maxDateStr) maxDateStr = c.postedAt;
      if (typeof c.baseScore === 'number' && c.baseScore > maxScore) {
        maxScore = c.baseScore;
      }
    });
    const post = state.postById.get(postId);
    if (post) {
      if (post.postedAt > maxDateStr) maxDateStr = post.postedAt;
      if (typeof post.baseScore === 'number' && post.baseScore > maxScore) {
        maxScore = post.baseScore;
      }
    }
    group.maxDate = new Date(maxDateStr || 0); // Re-instantiate once per group for sorting compatibility
    group.maxScore = maxScore === Number.NEGATIVE_INFINITY ? 0 : maxScore;
  });

  // 3. Sort post groups
  const sortedGroups = Array.from(postGroups.values());
  switch (sortBy) {
    case 'date-asc':
      sortedGroups.sort((a, b) => a.maxDate.getTime() - b.maxDate.getTime());
      break;
    case 'replyTo':
    case 'relevance':
      // Fallback to newest-first (matching default)
      sortedGroups.sort((a, b) => b.maxDate.getTime() - a.maxDate.getTime());
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

  if (sortedGroups.length === 0) {
    return Promise.resolve();
  }

  // Render first 25 post groups synchronously
  const SYNC_GROUP_THRESHOLD = 25;
  const firstBatchSize = Math.min(sortedGroups.length, SYNC_GROUP_THRESHOLD);

  const firstHtmlParts: string[] = [];
  for (let i = 0; i < firstBatchSize; i++) {
    if (abortSignal?.aborted) return Promise.resolve();
    const group = sortedGroups[i];
    const post = state.postById.get(group.postId);
    const postComments = group.comments;
    if (!post && postComments.length === 0) continue;

    const postGroup = {
      postId: group.postId,
      title: post?.title || postComments.find(c => c.post?.title)?.post?.title || 'Unknown Post',
      comments: postComments,
      fullPost: post
    };
    firstHtmlParts.push(renderPostGroup(postGroup, state));
  }
  container.insertAdjacentHTML('beforeend', firstHtmlParts.join(''));

  if (onProgress) onProgress(Math.round((firstBatchSize / sortedGroups.length) * 100));

  if (sortedGroups.length <= firstBatchSize) {
    return Promise.resolve();
  }

  // Render remaining thread groups in larger background chunks
  return new Promise<void>((resolve) => {
    let currentIndex = firstBatchSize;
    const BACKGROUND_CHUNK_SIZE = 50;

    const renderNextChunk = () => {
      if (abortSignal?.aborted) {
        resolve();
        return;
      }

      const end = Math.min(currentIndex + BACKGROUND_CHUNK_SIZE, sortedGroups.length);
      const htmlParts: string[] = [];

      for (let i = currentIndex; i < end; i++) {
        const group = sortedGroups[i];
        const post = state.postById.get(group.postId);
        const postComments = group.comments;
        if (!post && postComments.length === 0) continue;

        const postGroup = {
          postId: group.postId,
          title: post?.title || postComments.find(c => c.post?.title)?.post?.title || 'Unknown Post',
          comments: postComments,
          fullPost: post
        };
        htmlParts.push(renderPostGroup(postGroup, state));
      }

      container.insertAdjacentHTML('beforeend', htmlParts.join(''));
      currentIndex = end;

      if (onProgress) onProgress(Math.round((currentIndex / sortedGroups.length) * 100));

      if (currentIndex < sortedGroups.length) {
        setTimeout(renderNextChunk, 0);
      } else {
        resolve();
      }
    };

    setTimeout(renderNextChunk, 0);
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

const parentRefToFetchedContext = (ref: ParentCommentRef, sourceComment: Comment): Comment => ({
  ...parentRefToStub(ref, sourceComment),
  htmlBody: typeof ref.htmlBody === 'string' ? ref.htmlBody : '',
  contents: { markdown: ref.contents?.markdown ?? null },
  parentComment: ref.parentComment ?? null,
  contextType: 'fetched',
} as any as Comment);

const placeholderPostForTopLevelComment = (comment: Comment, state: ReaderState): Post => {
  const statePost = state.postById.get(comment.postId);
  if (statePost) return statePost;
  if (comment.post) return comment.post;

  return {
    _id: comment.postId,
    title: '',
    slug: '',
    pageUrl: `${window.location.origin}/posts/${comment.postId}`,
    postedAt: comment.postedAt || new Date().toISOString(),
    baseScore: 0,
    voteCount: 0,
    user: null,
    extendedScore: null,
    afExtendedScore: null,
    currentUserVote: null,
    currentUserExtendedVote: null,
    contents: { markdown: null },
    commentCount: 0,
    wordCount: 0,
  } as unknown as Post;
};

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
  const inlineParent = comment.parentComment;
  const inlineParentHasBody = typeof inlineParent?.htmlBody === 'string'
    && inlineParent.htmlBody.trim().length > 0;
  const parentCommentRaw = inlineParentHasBody && inlineParent
    ? parentRefToFetchedContext(inlineParent, comment)
    : (parentFromState || (inlineParent ? parentRefToStub(inlineParent, comment) : null));

  if (!parentCommentRaw || parentCommentRaw._id === comment._id) {
    const headerHtml = renderPostHeader(placeholderPostForTopLevelComment(comment, state), { state });
    const nestedCommentHtml = `<div class="pr-replies">${renderComment(comment, state)}</div>`;
    return `
      <div class="pr-archive-item pr-archive-top-level-comment">
        ${headerHtml}
        ${nestedCommentHtml}
      </div>
    `;
  }

  // [PR-UARCH-29] In card view, show immediate parent context with the current comment nested under it.
  // Contextual parents in card view are ALWAYS rendered as header-only stubs to keep the feed compact.
  const parentComment = { ...parentCommentRaw, contextType: 'stub' } as Comment;
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
