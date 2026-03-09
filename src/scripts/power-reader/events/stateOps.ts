
/**
 * State operations for Power Reader
 * Handles pure state mutations and renders without external data fetching
 */

import type { ReaderState } from '../state';
import { markCommentRevealed } from '../types/uiCommentFlags';

/**
 * Find the top-level ancestor ID for a comment by walking up the state tree
 */
export const findTopLevelAncestorId = (commentId: string, state: ReaderState): string | null => {
    let current = state.commentById.get(commentId);
    if (!current) return null;

    const visited = new Set<string>();
    while (current) {
        if (visited.has(current._id)) break;
        visited.add(current._id);
        if (!current.parentCommentId) return current._id;
        const parent = state.commentById.get(current.parentCommentId);
        if (!parent) return null; // Chain is broken in local state
        current = parent;
    }
    return null;
};

/**
 * Mark a comment and all its ancestors as forceVisible
 */
export const markAncestorChainForceVisible = (commentId: string, state: ReaderState): void => {
    let currentId: string | null = commentId;
    const visited = new Set<string>();

    while (currentId) {
        if (visited.has(currentId)) break;
        visited.add(currentId);

        const comment = state.commentById.get(currentId);
        if (!comment) break;

        markCommentRevealed(comment);

        currentId = comment.parentCommentId || null;
    }
};
