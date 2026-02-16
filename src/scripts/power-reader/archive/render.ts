
import { Logger } from '../utils/logger';
import { renderMetadata } from '../render/components/metadata';
import { renderBody } from '../render/components/body';
import { escapeHtml } from '../utils/rendering';
import { fetchCommentsByIds } from './loader';
import type { ArchiveViewMode } from './state';
import type { Post, Comment } from '../../../shared/graphql/queries';

let currentRenderLimit = (window as any).__PR_RENDER_LIMIT_OVERRIDE || 10000;

/**
 * Configure view state (called by index.ts)
 */
export const updateRenderLimit = (limit: number) => {
    currentRenderLimit = limit;
};

/**
 * Increment view limit (Load More)
 */
export const incrementRenderLimit = (delta: number) => {
    currentRenderLimit += delta;
};

/**
 * Main Render Function
 */
export const renderArchiveFeed = async (container: HTMLElement, items: (Post | Comment)[], viewMode: ArchiveViewMode, itemById: Map<string, Post | Comment>): Promise<void> => {
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
        // Render shell first
        container.innerHTML = `<div class="pr-loading-context">Loading conversation context...</div>`;

        // Ensure context is loaded
        await ensureContextForItems(visibleItems, itemById);

        // Render
        container.innerHTML = visibleItems.map(item => renderThreadItem(item, itemById)).join('');
    } else {
        container.innerHTML = visibleItems.map(item => renderCardItem(item)).join('');
    }
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

    return `
      <div class="${classes}" data-id="${item._id}">
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

/**
 * 3. Thread View Logic
 */
const renderThreadItem = (item: Post | Comment, itemById: Map<string, Post | Comment>): string => {
    const isPost = 'title' in item;

    // If it's a post, regular card view is enough, but maybe labelled "Thread Starter"
    if (isPost) {
        return renderCardItem(item);
    }

    const comment = item as Comment;
    const parents: Comment[] = [];

    // Traverse up using itemById to find parents with bodies
    // Note: comment.parentComment typically lacks htmlBody, so we check itemById
    let current: any = comment.parentComment;
    while (current) {
        const fullParent = itemById.get(current._id);
        if (fullParent && !('title' in fullParent)) { // Ensure it's a comment
            parents.unshift(fullParent as Comment);
            current = (fullParent as Comment).parentComment;
        } else if (current._id) {
            // We might have hit a parent we didn't fetch or it's a post (roots are posts)
            // If parent is a post, we don't add it to 'parents' array of comments
            break;
        } else {
            break;
        }
    }

    // Always include the root post context if available
    let postContext = '';
    const post = 'post' in comment ? (comment as any).post : null; // Check if post is embedded
    // or try fetching from itemById if we have postId
    const fullPost = itemById.get(comment.postId);
    if (fullPost && 'title' in fullPost) {
        postContext = `
            <div class="pr-thread-root-post">
                <a href="${fullPost.pageUrl}" target="_blank" class="pr-thread-post-link">
                    📝 ${escapeHtml((fullPost as Post).title)}
                </a>
                <span class="pr-thread-post-meta">by ${(fullPost as Post).user?.displayName || 'Unknown'}</span>
            </div>
        `;
    } else if (post) {
        postContext = `
            <div class="pr-thread-root-post">
                <a href="${post.pageUrl}" target="_blank" class="pr-thread-post-link">
                    📝 ${escapeHtml(post.title)}
                </a>
            </div>
        `;
    }


    const parentHtml = parents.map(p => `
        <div class="pr-thread-parent">
            <div class="pr-thread-parent-meta">
                Replying to <strong>${escapeHtml(p.user?.displayName || p.author || 'Unknown')}</strong>
            </div>
            <div class="pr-thread-parent-body">
                ${sanitizeBodySimple(p.htmlBody || '')}
            </div>
        </div>
    `).join('');

    return `
        <div class="pr-thread-wrapper" style="margin-bottom: 30px; border: 1px solid var(--pr-border-subtle); border-radius: 8px; overflow: hidden;">
            ${postContext}
            <div class="pr-thread-parents" style="background: var(--pr-bg-secondary); padding: 10px;">
                ${parentHtml}
            </div>
            ${renderCardItem(comment)} 
        </div>
    `;
};

/**
 * Fetch missing parent comments for the visible items
 */
const ensureContextForItems = async (items: (Post | Comment)[], itemById: Map<string, Post | Comment>): Promise<void> => {
    const missingIds = new Set<string>();

    for (const item of items) {
        if ('title' in item) continue; // It's a post, no parents needed (it is the root)

        let current: any = (item as Comment).parentComment;
        let depth = 0;
        // Traverse up to 5 levels to get context
        while (current && depth < 5) {
            if (!itemById.has(current._id)) {
                missingIds.add(current._id);
            }
            // If we don't have the item in itemById, we can't continue traversing up easily 
            // unless the shallow parent object has a parent reference (which it does in GraphQL usually)
            // But we need to be careful not to traverse indefinitely on shallow objects
            if (current.parentComment) {
                current = current.parentComment;
            } else {
                break;
            }
            depth++;
        }

        // Also ensure Post is loaded if not
        if (item.postId && !itemById.has(item.postId)) {
            // Actually we don't have a fetchPostsByIds yet, and usually post info is embedded.
            // Let's assume post info is sufficient in the comment object for now (comment.post).
        }
    }

    if (missingIds.size > 0) {
        Logger.info(`Thread View: Fetching ${missingIds.size} missing context comments...`);
        const fetched = await fetchCommentsByIds(Array.from(missingIds));

        for (const c of fetched) {
            itemById.set(c._id, c);
        }
    }
};

const getInterlocutorName = (item: Post | Comment): string => {
    if ('title' in item) return " (Original Post)";
    const c = item as Comment;
    if (c.parentComment?.user?.displayName) return c.parentComment.user.displayName;
    if (c.post?.user?.displayName) return c.post.user.displayName;
    return "Unknown";
};

// Simple stripper for parent context to avoid rendering full widgets
const sanitizeBodySimple = (html: string): string => {
    // We just want text and basic formatting, no massive widgets or buttons
    // But renderBody handles sanitization. We might want a "micro" renderBody.
    return renderBody(html, null);
};
