import type { Comment } from '../../../shared/graphql/queries';

export type CommentContextType = 'missing' | 'fetched' | 'stub';

export type UICommentFlags = {
    forceVisible?: boolean;
    justRevealed?: boolean;
    contextType?: CommentContextType;
};

export type UIComment = Comment & UICommentFlags;

const asUIComment = (comment: Comment): UIComment => comment as UIComment;

export const isForceVisible = (comment: Comment): boolean =>
    asUIComment(comment).forceVisible === true;

export const setForceVisible = (comment: Comment, value: boolean): void => {
    asUIComment(comment).forceVisible = value;
};

export const isJustRevealed = (comment: Comment): boolean =>
    asUIComment(comment).justRevealed === true;

export const setJustRevealed = (comment: Comment, value: boolean): void => {
    asUIComment(comment).justRevealed = value;
};

export const markCommentRevealed = (comment: Comment): void => {
    setForceVisible(comment, true);
    setJustRevealed(comment, true);
};

export const getCommentContextType = (comment: Comment): CommentContextType | undefined =>
    asUIComment(comment).contextType;

export const setCommentContextType = (comment: Comment, contextType: CommentContextType): void => {
    asUIComment(comment).contextType = contextType;
};

export const clearCommentContextType = (comment: Comment): void => {
    asUIComment(comment).contextType = undefined;
};

export const copyTransientCommentUiFlags = (from: Comment, to: Comment): void => {
    if (isForceVisible(from) && !isForceVisible(to)) {
        setForceVisible(to, true);
    }
    if (isJustRevealed(from) && !isJustRevealed(to)) {
        setJustRevealed(to, true);
    }
};
