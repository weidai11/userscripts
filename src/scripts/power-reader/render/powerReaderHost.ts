
import type { ReaderState } from '../state';
import type { UIHost } from './uiHost';
import { rebuildIndexes } from '../state';
import { renderUI } from './index';
import type { Comment, Post } from '../../../shared/graphql/queries';
import { renderPostGroup as renderPostGroupHTML } from './post';
import { setupLinkPreviews } from '../features/linkPreviews';
import { refreshPostActionButtons } from '../utils/dom';
import { Logger } from '../utils/logger';


/**
 * Default UIHost implementation for the main Power Reader feed.
 */
export class PowerReaderUIHost implements UIHost {
    private state: ReaderState;

    constructor(state: ReaderState) {
        this.state = state;
    }

    rerenderAll(): void {
        renderUI(this.state);
    }

    rerenderPostGroup(postId: string, anchorCommentId?: string): void {
        const postContainer = document.querySelector(`.pr-post[data-id="${postId}"]`) as HTMLElement;
        if (!postContainer) {
            Logger.warn(`reRenderPostGroup: Container for post ${postId} not found`);
            return;
        }

        let beforeTop: number | null = null;
        if (anchorCommentId) {
            const anchorEl = postContainer.querySelector(`.pr-comment[data-id="${anchorCommentId}"]`) as HTMLElement;
            if (anchorEl) beforeTop = anchorEl.getBoundingClientRect().top;
        }

        const post = this.state.postById.get(postId);
        const postComments = this.state.comments.filter(c => c.postId === postId);
        Logger.info(`reRenderPostGroup: p=${postId}, comments=${postComments.length}`);

        // Detect current expansion state
        const bodyContainer = postContainer.querySelector('.pr-post-body-container');
        const wasExpanded = bodyContainer && !bodyContainer.classList.contains('truncated');

        const group = {
            postId,
            title: post?.title || postComments.find(c => c.post?.title)?.post?.title || 'Unknown Post',
            comments: postComments,
            fullPost: post,
        };
        postContainer.outerHTML = renderPostGroupHTML(group, this.state);

        // If it was expanded, it might have been re-rendered as truncated (default).
        const newPostContainer = document.querySelector(`.pr-post[data-id="${postId}"]`);
        if (wasExpanded && newPostContainer) {
            const newBody = newPostContainer.querySelector('.pr-post-body-container') as HTMLElement;
            if (newBody && newBody.classList.contains('truncated')) {
                newBody.classList.remove('truncated');
                newBody.style.maxHeight = 'none';
                const overlay = newBody.querySelector('.pr-read-more-overlay') as HTMLElement;
                if (overlay) overlay.style.display = 'none';
                const readMoreBtn = newBody.querySelector('.pr-post-read-more') as HTMLElement;
                if (readMoreBtn) readMoreBtn.style.display = 'none';
            }
        }

        // Post-render setup hooks
        setupLinkPreviews(this.state.comments);
        refreshPostActionButtons(postId);

        if (anchorCommentId && beforeTop !== null) {
            const newAnchor = document.querySelector(`.pr-comment[data-id="${anchorCommentId}"]`) as HTMLElement;
            if (newAnchor) {
                const afterTop = newAnchor.getBoundingClientRect().top;
                const delta = afterTop - beforeTop;
                const oldScrollY = window.scrollY;
                Logger.info(`Viewport Preservation [${anchorCommentId}]: beforeTop=${beforeTop.toFixed(2)}, afterTop=${afterTop.toFixed(2)}, delta=${delta.toFixed(2)}, oldScrollY=${oldScrollY.toFixed(2)}`);
                window.scrollTo(0, Math.max(0, oldScrollY + delta));
            }
        }
    }

    mergeComments(newComments: Comment[], markAsContext: boolean = true, postIdMap?: Map<string, string>): number {
        let added = 0;
        for (const c of newComments) {
            if (!this.state.commentById.has(c._id)) {
                if (markAsContext) (c as any).contextType = 'fetched';
                if (postIdMap && postIdMap.has(c._id)) {
                    c.postId = postIdMap.get(c._id)!;
                }
                this.state.comments.push(c);
                added++;
            }
        }
        if (added > 0) rebuildIndexes(this.state);
        return added;
    }

    upsertPost(post: Post): void {
        if (!this.state.postById.has(post._id)) {
            this.state.posts.push(post);
        } else {
            // Replace existing sparse post with full post
            const idx = this.state.posts.findIndex(p => p._id === post._id);
            if (idx >= 0) this.state.posts[idx] = post;
        }
        this.state.postById.set(post._id, post);
    }
}
