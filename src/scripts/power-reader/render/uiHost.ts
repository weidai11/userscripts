
import type { Post } from '../../../shared/graphql/queries';
import type { Comment } from '../../../shared/graphql/queries';

/**
 * UIHost interface for decoupling navigation logic from the specific
 * rendering implementation (Power Reader main feed vs Archive thread view).
 */
export interface UIHost {
    /**
     * Re-render the entire UI.
     * Power Reader: calls renderUI(state)
     * Archive: updates list + renderArchiveFeed
     */
    rerenderAll(): void;

    /**
     * Re-render a specific post group, preserving the viewport position
     * relative to an anchor comment if provided.
     */
    rerenderPostGroup(postId: string, anchorCommentId?: string): void;

    /**
     * Merge new comments into the state and return the number of new comments added.
     * Power Reader: updates state.comments + rebuildIndexes
     * Archive: updates ArchiveState.items + ReaderState projection + rebuildIndexes
     */
    mergeComments(comments: Comment[], markAsContext?: boolean, postIdMap?: Map<string, string>): number;

    /**
     * Upsert a post into the state.
     * Power Reader: updates state.posts/postById
     * Archive: updates ArchiveState.items + ReaderState projection
     */
    upsertPost(post: Post): void;
}

let activeHost: UIHost | null = null;

export const setUIHost = (host: UIHost): void => {
    activeHost = host;
};

export const getUIHost = (): UIHost => {
    if (!activeHost) {
        throw new Error('No UI host registered. Ensure setUIHost is called during initialization.');
    }
    return activeHost;
};
