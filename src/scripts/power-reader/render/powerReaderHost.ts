
import type { ReaderState } from '../state';
import type { UIHost } from './uiHost';
import { rebuildIndexes } from '../state';
import { renderUI } from './index';
import type { Comment, Post } from '../../../shared/graphql/queries';
import { renderPostGroup as renderPostGroupHTML } from './post';
import { setupLinkPreviews } from '../features/linkPreviews';
import { refreshPostActionButtons } from '../utils/dom';
import { Logger } from '../utils/logger';

type StartViewTransitionFn = ((update: () => void) => unknown) | undefined;

const isFindParentTraceEnabled = (): boolean => {
    try {
        return (window as any).__PR_FIND_PARENT_TRACE__ === true || localStorage.getItem('pr-find-parent-trace') === '1';
    } catch {
        return (window as any).__PR_FIND_PARENT_TRACE__ === true;
    }
};

const logFindParentTrace = (event: string, data: Record<string, unknown>): void => {
    if (!isFindParentTraceEnabled()) return;
    let json = '';
    try {
        json = JSON.stringify(data);
    } catch {
        json = '[unserializable]';
    }
    Logger.info(`[FindParentTrace] ${event} ${json}`, data);
};

const withOverflowAnchorDisabled = (): (() => void) => {
    const htmlStyle = document.documentElement.style as any;
    const bodyStyle = document.body?.style as any;
    const prevHtml = htmlStyle.overflowAnchor || '';
    const prevBody = bodyStyle ? (bodyStyle.overflowAnchor || '') : '';

    htmlStyle.overflowAnchor = 'none';
    if (bodyStyle) bodyStyle.overflowAnchor = 'none';

    return () => {
        htmlStyle.overflowAnchor = prevHtml;
        if (bodyStyle) bodyStyle.overflowAnchor = prevBody;
    };
};

let instantViewTransitionDepth = 0;

const enableInstantViewTransition = (): void => {
    instantViewTransitionDepth += 1;
    document.documentElement.classList.add('pr-vt-instant');
};

const disableInstantViewTransition = (): void => {
    instantViewTransitionDepth = Math.max(0, instantViewTransitionDepth - 1);
    if (instantViewTransitionDepth === 0) {
        document.documentElement.classList.remove('pr-vt-instant');
    }
};

const runWithViewTransition = (
    update: () => void,
    enabled: boolean = true,
    traceLabel?: string
): void => {
    const rawStartViewTransition = (document as any).startViewTransition as StartViewTransitionFn;
    const startViewTransition = rawStartViewTransition
        ? rawStartViewTransition.bind(document) as StartViewTransitionFn
        : undefined;
    const canUse = enabled && !(window as any).__PR_TEST_MODE__ && typeof startViewTransition === 'function';
    if (!canUse) {
        logFindParentTrace('host:transition-bypass', {
            label: traceLabel || '',
            enabled,
            hasApi: typeof startViewTransition === 'function',
        });
        try {
            update();
        } catch (error) {
            Logger.error('rerenderPostGroup: update failed (no transition path)', error);
        }
        return;
    }

    try {
        logFindParentTrace('host:transition-start', { label: traceLabel || '' });
        enableInstantViewTransition();
        const transition: any = startViewTransition(() => {
            return update();
        });
        let cleaned = false;
        const cleanupInstant = () => {
            if (cleaned) return;
            cleaned = true;
            disableInstantViewTransition();
        };
        if (transition?.updateCallbackDone?.then) {
            transition.updateCallbackDone.then(() => {
                logFindParentTrace('host:transition-update-done', { label: traceLabel || '' });
            }).catch((error: unknown) => {
                Logger.warn('rerenderPostGroup: transition update callback failed', error);
            });
        }
        if (transition?.finished?.then) {
            transition.finished.then(() => {
                logFindParentTrace('host:transition-finished', { label: traceLabel || '' });
                cleanupInstant();
            }).catch((error: unknown) => {
                Logger.warn('rerenderPostGroup: transition finished with error', error);
                cleanupInstant();
            });
        } else {
            cleanupInstant();
        }
    } catch (error) {
        Logger.warn('rerenderPostGroup: startViewTransition failed, falling back', error);
        disableInstantViewTransition();
        try {
            update();
        } catch (updateError) {
            Logger.error('rerenderPostGroup: update failed after transition fallback', updateError);
        }
    }
};


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

        logFindParentTrace('host:rerender-start', {
            postId,
            anchorCommentId: anchorCommentId || null,
            beforeTop: beforeTop === null ? null : Math.round(beforeTop * 100) / 100,
            scrollY: Math.round(window.scrollY * 100) / 100,
        });

        runWithViewTransition(() => {
            const restoreOverflowAnchor = withOverflowAnchorDisabled();
            try {
                postContainer.outerHTML = renderPostGroupHTML(group, this.state);
                logFindParentTrace('host:dom-replaced', {
                    postId,
                    anchorCommentId: anchorCommentId || null,
                    scrollY: Math.round(window.scrollY * 100) / 100,
                });

                // If it was expanded, it might have been re-rendered as truncated (default).
                const newPostContainer = document.querySelector(`.pr-post[data-id="${postId}"]`) as HTMLElement | null;
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
                setupLinkPreviews(this.state.comments, newPostContainer || document);
                refreshPostActionButtons(postId);

                if (anchorCommentId && beforeTop !== null) {
                    const newAnchor = document.querySelector(`.pr-comment[data-id="${anchorCommentId}"]`) as HTMLElement;
                    if (newAnchor) {
                        const afterTop = newAnchor.getBoundingClientRect().top;
                        const delta = afterTop - beforeTop;
                        const oldScrollY = window.scrollY;
                        const targetY = Math.max(0, oldScrollY + delta);
                        Logger.info(`Viewport Preservation [${anchorCommentId}]: beforeTop=${beforeTop.toFixed(2)}, afterTop=${afterTop.toFixed(2)}, delta=${delta.toFixed(2)}, oldScrollY=${oldScrollY.toFixed(2)}`);
                        logFindParentTrace('host:anchor-pass1', {
                            postId,
                            anchorCommentId,
                            beforeTop: Math.round(beforeTop * 100) / 100,
                            afterTop: Math.round(afterTop * 100) / 100,
                            delta: Math.round(delta * 100) / 100,
                            oldScrollY: Math.round(oldScrollY * 100) / 100,
                            targetY: Math.round(targetY * 100) / 100,
                        });
                        window.scrollTo(0, targetY);

                        const pass2Anchor = document.querySelector(`.pr-comment[data-id="${anchorCommentId}"]`) as HTMLElement;
                        if (pass2Anchor) {
                            const pass2Top = pass2Anchor.getBoundingClientRect().top;
                            const residual = pass2Top - beforeTop;
                            logFindParentTrace('host:anchor-pass2-check', {
                                postId,
                                anchorCommentId,
                                pass2Top: Math.round(pass2Top * 100) / 100,
                                residual: Math.round(residual * 100) / 100,
                                scrollY: Math.round(window.scrollY * 100) / 100,
                            });
                            if (Math.abs(residual) >= 0.5) {
                                const adjustFrom = window.scrollY;
                                const pass2Target = Math.max(0, adjustFrom + residual);
                                window.scrollTo(0, pass2Target);
                                logFindParentTrace('host:anchor-pass2-applied', {
                                    postId,
                                    anchorCommentId,
                                    residual: Math.round(residual * 100) / 100,
                                    adjustFrom: Math.round(adjustFrom * 100) / 100,
                                    pass2Target: Math.round(pass2Target * 100) / 100,
                                });
                            }
                        }
                    } else {
                        logFindParentTrace('host:anchor-missing', {
                            postId,
                            anchorCommentId,
                            scrollY: Math.round(window.scrollY * 100) / 100,
                        });
                    }
                }
            } finally {
                restoreOverflowAnchor();
                if (anchorCommentId) {
                    const endAnchor = document.querySelector(`.pr-comment[data-id="${anchorCommentId}"]`) as HTMLElement;
                    logFindParentTrace('host:rerender-end', {
                        postId,
                        anchorCommentId,
                        endScrollY: Math.round(window.scrollY * 100) / 100,
                        endAnchorTop: endAnchor ? Math.round(endAnchor.getBoundingClientRect().top * 100) / 100 : null,
                    });
                }
            }
        }, true, `power-reader:rerenderPostGroup:${postId}:${anchorCommentId || 'none'}`);
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
