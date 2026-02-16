
import type { UIHost } from '../render/uiHost';
import type { ArchiveState } from './state';
import type { ReaderState } from '../state';
import { createInitialState, rebuildIndexes } from '../state';
import type { Comment, Post } from '../../../shared/graphql/queries';
import { renderArchiveFeed } from './render';
import { renderPostGroup } from '../render/post';
import { setupLinkPreviews } from '../features/linkPreviews';
import { refreshPostActionButtons } from '../utils/dom';
import { Logger } from '../utils/logger';

export class ArchiveUIHost implements UIHost {
    private archiveState: ArchiveState;
    private readerState: ReaderState;
    private feedContainer: HTMLElement | null = null;
    private renderCallback: (() => void | Promise<void>) | null = null;

    constructor(archiveState: ArchiveState, feedContainer: HTMLElement | null, renderCallback?: () => void | Promise<void>) {
        this.archiveState = archiveState;
        this.feedContainer = feedContainer;
        this.renderCallback = renderCallback || null;
        this.readerState = this.syncReaderState();
    }

  private syncReaderState(): ReaderState {
    // Create a new reader state (or reset existing)
    const state = createInitialState();
    state.isArchiveMode = true;
    // [P1-FIX] Populate both username and userId for authenticated actions
    const currentUser = (window as any).LessWrong?.params?.currentUser;
    state.currentUsername = currentUser?.username || null;
    state.currentUserId = currentUser?._id || null;

        // Populate from archive items
        this.archiveState.items.forEach(item => {
            if ('title' in item) {
                state.posts.push(item as Post);
                state.postById.set(item._id, item as Post);
            } else {
                state.comments.push(item as Comment);
                state.commentById.set(item._id, item as Comment);
            }
        });

        rebuildIndexes(state);
        return state;
    }

    public getReaderState(): ReaderState {
        return this.readerState;
    }

    /**
     * Update the container reference if it changes (e.g. after re-render of parent)
     */
    public setContainer(container: HTMLElement) {
        this.feedContainer = container;
    }

  /**
   * [WS1-FIX] Canonical mutation helper: Updates both ArchiveState and ReaderState
   * Ensures single source of truth with ArchiveState as canonical
   */
  private syncItemToCanonical(item: Post | Comment): void {
    const id = item._id;

    // Check if item already exists to avoid O(N) findIndex search
    const exists = this.archiveState.itemById.has(id);

    // Update ArchiveState.itemById (upsert)
    this.archiveState.itemById.set(id, item);

    if (exists) {
        // Only perform O(N) scan if we know we need to replace an existing reference
        const existingIndex = this.archiveState.items.findIndex(i => i._id === id);
        if (existingIndex >= 0) {
            this.archiveState.items[existingIndex] = item;
        }
    } else {
        // Fast path for new items
        this.archiveState.items.push(item);
    }
  }

  /**
   * [WS1-FIX] Re-sort canonical items by postedAt descending to maintain stable ordering
   */
  private sortCanonicalItems(): void {
    this.archiveState.items.sort((a, b) => {
      return new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime();
    });
  }

  rerenderAll(): void {
    if (!this.feedContainer) return;

    // [P1-FIX] Mutate ReaderState in place instead of replacing to preserve identity
    // Event listeners hold a reference to this.readerState, so we must not replace the object

    // [WS1-FIX] Track context items explicitly using isContext flag
    // Context items are canonical for the live archive session but may be filtered at render time
    const existingContext = this.readerState.comments.filter(c => (c as any).isContext === true);
    const existingPosts = this.readerState.posts.filter(p => (p as any).isContext === true);

    // Clear and rebuild from archive items
    this.readerState.comments.length = 0;
    this.readerState.posts.length = 0;
    this.readerState.commentById.clear();
    this.readerState.postById.clear();
    this.readerState.childrenByParentId.clear();

    // Populate from archive items (canonical source)
    this.archiveState.items.forEach(item => {
      if ('title' in item) {
        this.readerState.posts.push(item as Post);
        this.readerState.postById.set(item._id, item as Post);
      } else {
        this.readerState.comments.push(item as Comment);
        this.readerState.commentById.set(item._id, item as Comment);
      }
    });

    // Restore context comments/posts (preserve across rerenders)
    existingContext.forEach(c => {
      if (!this.readerState.commentById.has(c._id)) {
        this.readerState.comments.push(c);
        this.readerState.commentById.set(c._id, c);
      }
    });
    existingPosts.forEach(p => {
      if (!this.readerState.postById.has(p._id)) {
        this.readerState.posts.push(p);
        this.readerState.postById.set(p._id, p);
      }
    });

    rebuildIndexes(this.readerState);

    if (this.renderCallback) {
      this.renderCallback();
    } else if (this.feedContainer) {
      renderArchiveFeed(this.feedContainer, this.archiveState.items, this.archiveState.viewMode, this.readerState, this.archiveState.sortBy);
    }
  }

    rerenderPostGroup(postId: string, anchorCommentId?: string): void {
        const postContainer = document.querySelector(`.pr-post[data-id="${postId}"]`) as HTMLElement;
        if (!postContainer) {
            // In Archive Thread View, we might just be viewing a list of post groups.
            // If the group is not found, maybe it's not rendered yet?
            Logger.warn(`ArchiveUIHost: Container for post ${postId} not found`);
            return;
        }

        let beforeTop: number | null = null;
        if (anchorCommentId) {
            const anchorEl = postContainer.querySelector(`.pr-comment[data-id="${anchorCommentId}"]`) as HTMLElement;
            if (anchorEl) beforeTop = anchorEl.getBoundingClientRect().top;
        }

        const post = this.readerState.postById.get(postId);
        const postComments = this.readerState.comments.filter(c => c.postId === postId);

        const group = {
            postId,
            title: post?.title || postComments.find(c => c.post?.title)?.post?.title || 'Unknown Post',
            comments: postComments,
            fullPost: post,
        };

        // Render using standard Power Reader renderer
        postContainer.outerHTML = renderPostGroup(group, this.readerState);

        setupLinkPreviews(this.readerState.comments);
        refreshPostActionButtons(postId);

        if (anchorCommentId && beforeTop !== null) {
            const newAnchor = document.querySelector(`.pr-comment[data-id="${anchorCommentId}"]`) as HTMLElement;
            if (newAnchor) {
                const afterTop = newAnchor.getBoundingClientRect().top;
                const delta = afterTop - beforeTop;
                const oldScrollY = window.scrollY;
                window.scrollTo(0, Math.max(0, oldScrollY + delta));
            }
        }
    }

  mergeComments(newComments: Comment[], markAsContext: boolean = true, postIdMap?: Map<string, string>): number {
    let added = 0;
    for (const c of newComments) {
      if (!this.readerState.commentById.has(c._id)) {
        if (markAsContext) (c as any).isContext = true;
        if (postIdMap && postIdMap.has(c._id)) {
          c.postId = postIdMap.get(c._id)!;
        }
        this.readerState.comments.push(c);
        this.readerState.commentById.set(c._id, c);
        added++;
      }

      // [P2-FIX] Only sync to canonical ArchiveState if NOT a context comment
      // Context comments (loaded for thread view ancestry) should not pollute the canonical archive set
      // They remain in ReaderState for rendering but won't appear in card/index views
      if (!markAsContext) {
        this.syncItemToCanonical(c);
      }
    }

    if (added > 0) {
      // [WS1-FIX] Keep canonical ordering stable (only matters for canonical items)
      this.sortCanonicalItems();
      rebuildIndexes(this.readerState);
    }
    return added;
  }

  upsertPost(post: Post): void {
    if (!this.readerState.postById.has(post._id)) {
      this.readerState.posts.push(post);
    } else {
      const idx = this.readerState.posts.findIndex(p => p._id === post._id);
      if (idx >= 0) this.readerState.posts[idx] = post;
    }
    this.readerState.postById.set(post._id, post);

    // [WS1-FIX] Sync to canonical ArchiveState
    this.syncItemToCanonical(post);
    this.sortCanonicalItems();
  }
}
