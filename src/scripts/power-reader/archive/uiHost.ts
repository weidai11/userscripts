
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
import { saveContextualItems } from './storage';

export class ArchiveUIHost implements UIHost {
    private archiveState: ArchiveState;
    private readerState: ReaderState;
    private feedContainer: HTMLElement | null = null;
    private renderCallback: (() => void | Promise<void>) | null = null;
    private searchStateRevision = 0;
    private canonicalStateRevision = 0;

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
    state.archiveUsername = this.archiveState.username;
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

    public getSearchStateRevision(): number {
      return this.searchStateRevision;
    }

    public getCanonicalStateRevision(): number {
      return this.canonicalStateRevision;
    }

    private bumpSearchStateRevision(): void {
      this.searchStateRevision += 1;
    }

    private bumpCanonicalStateRevision(): void {
      this.canonicalStateRevision += 1;
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

    this.bumpCanonicalStateRevision();
  }

  /**
   * [WS1-FIX] Re-sort canonical items by postedAt descending to maintain stable ordering
   */
  private sortCanonicalItems(): void {
    this.archiveState.items.sort((a, b) => {
      return new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime();
    });
  }

  private upsertReaderComment(comment: Comment): void {
    const idx = this.readerState.comments.findIndex(c => c._id === comment._id);
    if (idx >= 0) {
      this.readerState.comments[idx] = comment;
    } else {
      this.readerState.comments.push(comment);
    }
    this.readerState.commentById.set(comment._id, comment);
  }

  private shouldReplaceExistingComment(existing: Comment, incoming: Comment, markAsContext: boolean): boolean {
    // Non-context merge paths should always upsert latest server data.
    if (!markAsContext) return true;

    const existingType = (existing as any).contextType;
    const incomingType = (incoming as any).contextType;
    const existingIsStub = existingType === 'stub' || existingType === 'missing';
    const incomingIsStub = incomingType === 'stub' || incomingType === 'missing';
    const existingHasBody = typeof existing.htmlBody === 'string' && existing.htmlBody.trim().length > 0;
    const incomingHasBody = typeof incoming.htmlBody === 'string' && incoming.htmlBody.trim().length > 0;

    // Core upgrade path: placeholder context must be replaceable by fetched/full context.
    if (existingIsStub && !incomingIsStub) return true;
    if (!existingHasBody && incomingHasBody) return true;
    if (incomingType === 'fetched' && existingType !== 'fetched') return true;

    return false;
  }

  private mergeComment(existing: Comment, incoming: Comment, markAsContext: boolean): Comment {
    const merged = { ...existing, ...incoming } as Comment;

    // Preserve transient UI flags if the incoming payload does not carry them.
    if ((existing as any).forceVisible && !(merged as any).forceVisible) {
      (merged as any).forceVisible = true;
    }
    if ((existing as any).justRevealed && !(merged as any).justRevealed) {
      (merged as any).justRevealed = true;
    }

    if (markAsContext) {
      const existingType = (existing as any).contextType;
      const incomingType = (incoming as any).contextType;

      // Never downgrade fetched context to stub placeholders.
      if (incomingType === 'stub' && existingType && existingType !== 'stub') {
        (merged as any).contextType = existingType;
      } else if (!incomingType) {
        (merged as any).contextType = existingType || 'fetched';
      }
    } else {
      // Canonical comments are not context placeholders.
      delete (merged as any).contextType;
    }

    return merged;
  }

  private persistContextualData(comments: Comment[] = [], posts: Post[] = []): void {
    const username = this.archiveState.username;
    if (!username) return;

    const contextualComments = comments.filter(comment => {
      const type = (comment as any).contextType;
      if (type === 'stub' || type === 'missing') return false;
      return !this.archiveState.itemById.has(comment._id);
    });

    const contextualPosts = posts.filter(post => !this.archiveState.itemById.has(post._id));

    if (contextualComments.length === 0 && contextualPosts.length === 0) return;

    void saveContextualItems(username, contextualComments, contextualPosts).catch((e) => {
      Logger.warn('Failed to persist contextual archive data.', e);
    });
  }

  rerenderAll(): void {
    if (!this.feedContainer) return;

    // [P1-FIX] Mutate ReaderState in place instead of replacing to preserve identity
    // Event listeners hold a reference to this.readerState, so we must not replace the object

    // Preserve non-canonical context items (comments/posts fetched only for thread context).
    const existingContext = this.readerState.comments.filter(c => !this.archiveState.itemById.has(c._id));
    const existingPosts = this.readerState.posts.filter(p => !this.archiveState.itemById.has(p._id));

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
    this.bumpSearchStateRevision();

    if (this.renderCallback) {
      const maybePromise = this.renderCallback();
      if (maybePromise instanceof Promise) {
        void maybePromise.catch((error) => {
          Logger.error('ArchiveUIHost: render callback failed', error);
        });
      }
    } else if (this.feedContainer) {
      void renderArchiveFeed(
        this.feedContainer,
        this.archiveState.items,
        this.archiveState.viewMode,
        this.readerState,
        this.archiveState.sortBy
      ).catch((error) => {
        Logger.error('ArchiveUIHost: renderArchiveFeed failed', error);
      });
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
    let changed = 0;
    let canonicalTouched = false;
    const contextPosts = new Map<string, Post>();
    const contextCommentsToPersist: Comment[] = [];

    for (const incoming of newComments) {
      if (postIdMap && postIdMap.has(incoming._id)) {
        incoming.postId = postIdMap.get(incoming._id)!;
      }
      if (markAsContext && !(incoming as any).contextType) {
        (incoming as any).contextType = 'fetched';
      }
      // Ensure root post context is available for grouped thread rendering and post actions.
      if ((incoming as any).post?._id) {
        const rootPost = (incoming as any).post as Post;
        const isCanonicalRootPost = this.archiveState.itemById.has(rootPost._id);

        // Context fetches return PostFieldsLite; never overwrite canonical archive posts with lite payloads.
        if (!markAsContext || !isCanonicalRootPost) {
          this.upsertPost(rootPost, false);
        }
        if (!isCanonicalRootPost) {
          contextPosts.set(rootPost._id, rootPost);
        }
      }

      const existing = this.readerState.commentById.get(incoming._id);
      if (!existing) {
        this.upsertReaderComment(incoming);
        changed++;
      } else if (this.shouldReplaceExistingComment(existing, incoming, markAsContext)) {
        const merged = this.mergeComment(existing, incoming, markAsContext);
        this.upsertReaderComment(merged);
        changed++;
      }

      // Context comments should never be promoted into canonical archive items.
      if (!markAsContext) {
        const canonical = this.readerState.commentById.get(incoming._id) || incoming;
        this.syncItemToCanonical(canonical);
        canonicalTouched = true;
      } else if ((incoming as any).contextType !== 'stub' && (incoming as any).contextType !== 'missing') {
        const contextual = this.readerState.commentById.get(incoming._id) || incoming;
        contextCommentsToPersist.push(contextual);
      }
    }

    if (canonicalTouched) {
      this.sortCanonicalItems();
    }
    if (changed > 0) {
      rebuildIndexes(this.readerState);
    }
    if (changed > 0 || canonicalTouched) {
      this.bumpSearchStateRevision();
    }
    if (markAsContext && (contextCommentsToPersist.length > 0 || contextPosts.size > 0)) {
      this.persistContextualData(contextCommentsToPersist, Array.from(contextPosts.values()));
    }
    return changed;
  }

  upsertPost(post: Post, persistContext: boolean = true): void {
    const isCanonicalPost = this.archiveState.itemById.has(post._id);

    if (!this.readerState.postById.has(post._id)) {
      this.readerState.posts.push(post);
    } else {
      const idx = this.readerState.posts.findIndex(p => p._id === post._id);
      if (idx >= 0) this.readerState.posts[idx] = post;
    }
    this.readerState.postById.set(post._id, post);

    if (isCanonicalPost) {
      // Keep canonical archive posts in sync when full post data is fetched.
      this.syncItemToCanonical(post);
      this.sortCanonicalItems();
    } else {
      // Non-canonical posts are context-only and should survive rerenders without polluting archive items.
      if (!(post as any).contextType) (post as any).contextType = 'fetched';
      if (persistContext) {
        this.persistContextualData([], [post]);
      }
    }
    this.bumpSearchStateRevision();
  }
}
