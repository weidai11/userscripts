/**
 * Centralized state management for Power Reader
 * Replaces scattered global variables with a single typed state object
 */

import type { Comment, Post } from '../../shared/graphql/queries';

export interface ReaderState {
  // Current user info
  currentUsername: string | null;
  currentUserId: string | null;
  currentUserPaletteStyle: 'listView' | 'gridView' | null;

  // Data
  comments: Comment[];
  posts: Post[];

  // Indexes for O(1) lookups (rebuilt after data changes)
  commentById: Map<string, Comment>;
  postById: Map<string, Post>;
  childrenByParentId: Map<string, Comment[]>;

  // Subscriptions
  subscribedAuthorIds: Set<string>;

  // Loading state
  moreCommentsAvailable: boolean;
  primaryPostsCount: number;
  initialBatchNewestDate: string | null;

  // Selection + mouse for inline reactions and AI Studio
  currentSelection: { text: string; range: Range } | null;
  lastMousePos: { x: number; y: number };

  // AI Studio integration
  currentAIRequestId: string | null;
  activeAIPopup: HTMLElement | null;
  sessionAICache: Record<string, string>;
}

/**
 * Create a fresh initial state
 */
export const createInitialState = (): ReaderState => ({
  currentUsername: null,
  currentUserId: null,
  currentUserPaletteStyle: null,
  comments: [],
  posts: [],
  commentById: new Map(),
  postById: new Map(),
  childrenByParentId: new Map(),
  subscribedAuthorIds: new Set(),
  moreCommentsAvailable: false,
  primaryPostsCount: 0,
  initialBatchNewestDate: null,
  currentSelection: null,
  lastMousePos: { x: 0, y: 0 },
  currentAIRequestId: null,
  activeAIPopup: null,
  sessionAICache: {},
});

/**
 * Rebuild indexes after data changes
 * Call this after updating comments or posts arrays
 */
export const rebuildIndexes = (state: ReaderState): void => {
  // Rebuild comment index
  state.commentById.clear();
  state.comments.forEach(c => state.commentById.set(c._id, c));

  // Rebuild post index
  state.postById.clear();
  state.posts.forEach(p => state.postById.set(p._id, p));

  // Rebuild children index (parent -> children mapping)
  state.childrenByParentId.clear();
  state.comments.forEach(c => {
    const parentId = c.parentCommentId || '';
    if (!state.childrenByParentId.has(parentId)) {
      state.childrenByParentId.set(parentId, []);
    }
    state.childrenByParentId.get(parentId)!.push(c);
  });

  // Sort children by date
  state.childrenByParentId.forEach(children => {
    children.sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime());
  });
};

/**
 * Sync a comment in state after a vote or update
 */
export const syncCommentInState = (state: ReaderState, commentId: string, updates: Partial<Comment>): void => {
  const comment = state.commentById.get(commentId);
  if (comment) {
    Object.assign(comment, updates);
  }
};

/**
 * Sync a post in state after a vote or update
 */
export const syncPostInState = (state: ReaderState, postId: string, updates: Partial<Post>): void => {
  const post = state.postById.get(postId);
  if (post) {
    Object.assign(post, updates);
  }
};

// Singleton state instance for the application
let globalState: ReaderState | null = null;

export const getState = (): ReaderState => {
  if (!globalState) {
    globalState = createInitialState();
  }
  return globalState;
};

export const resetState = (): ReaderState => {
  globalState = createInitialState();
  return globalState;
};
