
import { Logger } from '../utils/logger';
import { renderMetadata } from '../render/components/metadata';
import { renderBody } from '../render/components/body';
import { escapeHtml } from '../utils/rendering';
import { fetchCommentsByIds } from './loader';
import type { ArchiveViewMode } from './state';
import type { Post, Comment } from '../../../shared/graphql/queries';
import type { ReaderState } from '../state';
import { renderPostGroup } from '../render/post';
import { getUIHost } from '../render/uiHost';

let currentRenderLimit = (window as any).__PR_RENDER_LIMIT_OVERRIDE || 5000;

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
    let current: any = comment.parentComment;
    let depth = 0;

    // Traverse up to 5 levels to get context
    while (current && depth < 5) {
      if (!state.commentById.has(current._id)) {
        missingIds.add(current._id);
        // Track which post this context belongs to
        if (!commentPostIdMap.has(current._id)) {
          commentPostIdMap.set(current._id, itemPostId);
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
    const fetched = await fetchCommentsByIds(Array.from(missingIds));

    // [WS2-FIX] Use UIHost to merge comments and set postIds (Deduplicated logic)
    getUIHost().mergeComments(fetched, true, commentPostIdMap);
  }
};

/**
 * Main Render Function
 * [P2-FIX] Thread view now loads parent context before rendering
 * [WS3-FIX] Accepts sortBy parameter for group-level thread sorting
 */
export const renderArchiveFeed = async (
  container: HTMLElement,
  items: (Post | Comment)[],
  viewMode: ArchiveViewMode,
  state: ReaderState,
  sortBy?: 'date' | 'date-asc' | 'score' | 'score-asc' | 'replyTo'
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
    container.innerHTML = visibleItems.map(item => renderIndexItem(item)).join('');
  } else if (viewMode === 'thread') {
    // [P2-FIX] Load parent context first, then render thread view
    // [WS3-FIX] Pass sortBy for group-level sorting
    await ensureContextForItems(visibleItems, state);
    renderThreadView(container, visibleItems, state, sortBy);
  } else {
    container.innerHTML = visibleItems.map(item => renderCardItem(item)).join('');
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
  sortBy?: 'date' | 'date-asc' | 'score' | 'score-asc' | 'replyTo'
) => {
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
      while (currentId && depth < 10) {
        if (state.commentById.has(currentId)) {
          inclusionCommentIds.add(currentId);
          const parent = state.commentById.get(currentId)!;
          currentId = parent.parentCommentId || (parent as any).parentComment?._id || null;
        } else {
          break;
        }
        depth++;
      }
    }
  });

  // 2. Group comments by postId
  const postGroups = new Map<string, { postId: string; comments: Comment[]; maxDate: Date; maxScore: number }>();

  // [WS2-FIX] Also collect post IDs from visible items (posts without comments)
  const visiblePostIds = new Set<string>();
  items.forEach(item => {
    if ('title' in item) {
      visiblePostIds.add(item._id);
    }
  });

  // Initialize groups for all post IDs (from comments and from visible posts)
  inclusionCommentIds.forEach(commentId => {
    const comment = state.commentById.get(commentId);
    if (!comment) return;
    const postId = comment.postId;
    visiblePostIds.add(postId);
  });

  // Create post groups with metrics
  visiblePostIds.forEach(postId => {
    const comments: Comment[] = [];
    let maxDate = new Date(0);
    let maxScore = Number.NEGATIVE_INFINITY;

    // Collect comments for this post
    inclusionCommentIds.forEach(commentId => {
      const comment = state.commentById.get(commentId);
      if (comment && comment.postId === postId) {
        comments.push(comment);
        const commentDate = new Date(comment.postedAt);
        if (commentDate > maxDate) maxDate = commentDate;
        if (typeof comment.baseScore === 'number' && comment.baseScore > maxScore) {
          maxScore = comment.baseScore;
        }
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

    postGroups.set(postId, {
      postId,
      comments,
      maxDate,
      // Preserve negative karma; fallback to 0 only when no numeric score exists.
      maxScore: maxScore === Number.NEGATIVE_INFINITY ? 0 : maxScore
    });
  });

  // 3. [WS3-FIX] Sort post groups by computed metrics
  const sortedGroups = Array.from(postGroups.values());
  switch (sortBy) {
    case 'date-asc':
    case 'replyTo': // Fallback to date for replyTo in thread view
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

  // 5. Render each post group with all inclusion comments
  let html = '';

  sortedGroups.forEach(group => {
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

  container.innerHTML = html;
};


/**
 * 1. Card View (Existing Logic)
 */
const renderCardItem = (item: Post | Comment): string => {
    const isPost = 'title' in item;
    const classes = `pr-archive-item pr-item ${isPost ? 'pr-post' : 'pr-comment'}`;
    const metadataHtml = renderMetadata(item);

    let contentHtml = '';
    if (isPost) {
        const post = item as Post;
        contentHtml = `<h3>${escapeHtml(post.title)}</h3>` + renderBody(post.htmlBody || '', post.extendedScore);
    } else {
        const comment = item as Comment;
        contentHtml = renderBody(comment.htmlBody || '', comment.extendedScore);
    }

    // Ensure we have a data-post-id for fallback navigation lookups
    const dataset = `data-id="${item._id}" ${!isPost && (item as Comment).postId ? `data-post-id="${(item as Comment).postId}"` : ''}`;

    return `
      <div class="${classes}" ${dataset}>
        <div class="pr-archive-item-header">
           ${metadataHtml}
        </div>
        <div class="pr-archive-item-body">
           ${contentHtml}
        </div>
      </div>
    `;
};

/**
 * 2. Index View (Existing Logic)
 */
const renderIndexItem = (item: Post | Comment): string => {
    const isPost = 'title' in item;
    const title = isPost ? (item as Post).title : ((item as Comment).htmlBody || '').replace(/<[^>]+>/g, '').slice(0, 100) + '...';
    const context = isPost ? 'Post' : `Reply to ${getInterlocutorName(item)}`;
    const date = new Date(item.postedAt).toLocaleDateString();

    return `
        <div class="pr-archive-index-item" data-id="${item._id}">
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

// ... unused helpers removed (renderThreadItem, ensureContextForItems, sanitizeBodySimple)
