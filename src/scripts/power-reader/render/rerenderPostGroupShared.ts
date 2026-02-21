import type { Comment, Post } from '../../../shared/graphql/queries';
import type { ReaderState } from '../state';
import { setupLinkPreviews } from '../features/linkPreviews';
import { refreshPostActionButtons } from '../utils/dom';
import { Logger } from '../utils/logger';
import { VIEWPORT_CORRECTION_EPSILON_PX } from '../utils/navigationConstants';
import { logFindParentTrace } from '../utils/findParentTrace';
import { runWithViewTransition, withOverflowAnchorDisabled } from '../utils/viewTransition';

type PostGroup = {
    postId: string;
    title: string;
    comments: Comment[];
    fullPost: Post | undefined;
};

type RerenderPostGroupSharedOptions = {
    state: ReaderState;
    postId: string;
    anchorCommentId?: string;
    getPostById: (postId: string) => Post | undefined;
    getPostComments: (postId: string) => Comment[];
    renderPostGroupHtml: (group: PostGroup, state: ReaderState) => string;
    rerenderLogPrefix: string;
    tracePrefix: string;
    transitionLabelPrefix: string;
};

const round2 = (n: number): number => Math.round(n * 100) / 100;

const restoreExpandedPostBody = (postContainer: HTMLElement | null, wasExpanded: boolean): void => {
    if (!wasExpanded || !postContainer) return;

    const newBody = postContainer.querySelector('.pr-post-body-container') as HTMLElement | null;
    if (!newBody || !newBody.classList.contains('truncated')) return;

    newBody.classList.remove('truncated');
    newBody.style.maxHeight = 'none';

    const overlay = newBody.querySelector('.pr-read-more-overlay') as HTMLElement | null;
    if (overlay) overlay.style.display = 'none';

    const readMoreBtn = newBody.querySelector('.pr-post-read-more') as HTMLElement | null;
    if (readMoreBtn) readMoreBtn.style.display = 'none';
};

export const rerenderPostGroupShared = ({
    state,
    postId,
    anchorCommentId,
    getPostById,
    getPostComments,
    renderPostGroupHtml,
    rerenderLogPrefix,
    tracePrefix,
    transitionLabelPrefix,
}: RerenderPostGroupSharedOptions): void => {
    const postContainer = document.querySelector(`.pr-post[data-id="${postId}"]`) as HTMLElement | null;
    if (!postContainer) {
        Logger.warn(`${rerenderLogPrefix}: Container for post ${postId} not found`);
        return;
    }

    let beforeTop: number | null = null;
    if (anchorCommentId) {
        const anchorEl = postContainer.querySelector(`.pr-comment[data-id="${anchorCommentId}"]`) as HTMLElement | null;
        if (anchorEl) beforeTop = anchorEl.getBoundingClientRect().top;
    }

    const post = getPostById(postId);
    const postComments = getPostComments(postId);
    Logger.info(`${rerenderLogPrefix}: p=${postId}, comments=${postComments.length}`);

    const bodyContainer = postContainer.querySelector('.pr-post-body-container');
    const wasExpanded = !!(bodyContainer && !bodyContainer.classList.contains('truncated'));

    const group: PostGroup = {
        postId,
        title: post?.title || postComments.find(c => c.post?.title)?.post?.title || 'Unknown Post',
        comments: postComments,
        fullPost: post,
    };

    logFindParentTrace(`${tracePrefix}:rerender-start`, {
        postId,
        anchorCommentId: anchorCommentId || null,
        beforeTop: beforeTop === null ? null : round2(beforeTop),
        scrollY: round2(window.scrollY),
    });

    runWithViewTransition(() => {
        const restoreOverflowAnchor = withOverflowAnchorDisabled();
        try {
            postContainer.outerHTML = renderPostGroupHtml(group, state);
            logFindParentTrace(`${tracePrefix}:dom-replaced`, {
                postId,
                anchorCommentId: anchorCommentId || null,
                scrollY: round2(window.scrollY),
            });

            const newPostContainer = document.querySelector(`.pr-post[data-id="${postId}"]`) as HTMLElement | null;
            restoreExpandedPostBody(newPostContainer, wasExpanded);

            setupLinkPreviews(state.comments, newPostContainer || document);
            refreshPostActionButtons(postId);

            if (anchorCommentId && beforeTop !== null) {
                const newAnchor = document.querySelector(`.pr-comment[data-id="${anchorCommentId}"]`) as HTMLElement | null;
                if (newAnchor) {
                    const afterTop = newAnchor.getBoundingClientRect().top;
                    const delta = afterTop - beforeTop;
                    const oldScrollY = window.scrollY;
                    const targetY = Math.max(0, oldScrollY + delta);

                    logFindParentTrace(`${tracePrefix}:anchor-pass1`, {
                        postId,
                        anchorCommentId,
                        beforeTop: round2(beforeTop),
                        afterTop: round2(afterTop),
                        delta: round2(delta),
                        oldScrollY: round2(oldScrollY),
                        targetY: round2(targetY),
                    });
                    window.scrollTo(0, targetY);

                    const pass2Anchor = document.querySelector(`.pr-comment[data-id="${anchorCommentId}"]`) as HTMLElement | null;
                    if (pass2Anchor) {
                        const pass2Top = pass2Anchor.getBoundingClientRect().top;
                        const residual = pass2Top - beforeTop;
                        logFindParentTrace(`${tracePrefix}:anchor-pass2-check`, {
                            postId,
                            anchorCommentId,
                            pass2Top: round2(pass2Top),
                            residual: round2(residual),
                            scrollY: round2(window.scrollY),
                        });
                        if (Math.abs(residual) >= VIEWPORT_CORRECTION_EPSILON_PX) {
                            const adjustFrom = window.scrollY;
                            const pass2Target = Math.max(0, adjustFrom + residual);
                            window.scrollTo(0, pass2Target);
                            logFindParentTrace(`${tracePrefix}:anchor-pass2-applied`, {
                                postId,
                                anchorCommentId,
                                residual: round2(residual),
                                adjustFrom: round2(adjustFrom),
                                pass2Target: round2(pass2Target),
                            });
                        }
                    }
                } else {
                    logFindParentTrace(`${tracePrefix}:anchor-missing`, {
                        postId,
                        anchorCommentId,
                        scrollY: round2(window.scrollY),
                    });
                }
            }
        } finally {
            restoreOverflowAnchor();
            if (anchorCommentId) {
                const endAnchor = document.querySelector(`.pr-comment[data-id="${anchorCommentId}"]`) as HTMLElement | null;
                logFindParentTrace(`${tracePrefix}:rerender-end`, {
                    postId,
                    anchorCommentId,
                    endScrollY: round2(window.scrollY),
                    endAnchorTop: endAnchor ? round2(endAnchor.getBoundingClientRect().top) : null,
                });
            }
        }
    }, {
        enabled: true,
        traceLabel: `${transitionLabelPrefix}:rerenderPostGroup:${postId}:${anchorCommentId || 'none'}`,
        tracePrefix,
        errorContext: rerenderLogPrefix,
    });
};
