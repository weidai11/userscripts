import type { ReaderState } from '../state';
import type { UIHost } from './uiHost';
import { rebuildIndexes } from '../state';
import { renderUI } from './index';
import type { Comment, Post } from '../../../shared/graphql/queries';
import { renderPostGroup as renderPostGroupHTML } from './post';
import { rerenderPostGroupShared } from './rerenderPostGroupShared';
import {
    clearCommentContextType,
    copyTransientCommentUiFlags,
    getCommentContextType,
    setCommentContextType,
} from '../types/uiCommentFlags';


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
        rerenderPostGroupShared({
            state: this.state,
            postId,
            anchorCommentId,
            getPostById: id => this.state.postById.get(id),
            getPostComments: id => this.state.comments.filter(c => c.postId === id),
            renderPostGroupHtml: renderPostGroupHTML,
            rerenderLogPrefix: 'reRenderPostGroup',
            tracePrefix: 'host',
            transitionLabelPrefix: 'power-reader',
        });
    }

    mergeComments(newComments: Comment[], markAsContext: boolean = true, postIdMap?: Map<string, string>): number {
        let changed = 0;
        for (const c of newComments) {
            const existing = this.state.commentById.get(c._id);
            const existingType = existing ? getCommentContextType(existing) : undefined;
            const incomingType = getCommentContextType(c);
            const existingHasBody = !!(existing?.htmlBody && existing.htmlBody.trim().length > 0);
            const incomingHasBody = !!(c.htmlBody && c.htmlBody.trim().length > 0);
            const shouldReplaceExisting = !!existing && (
                !markAsContext ||
                ((existingType === 'stub' || existingType === 'missing') && incomingType !== 'stub' && incomingType !== 'missing') ||
                (!existingHasBody && incomingHasBody)
            );

            if (!existing || shouldReplaceExisting) {
                if (markAsContext) {
                    setCommentContextType(c, 'fetched');
                } else {
                    clearCommentContextType(c);
                }
                if (postIdMap && postIdMap.has(c._id)) {
                    c.postId = postIdMap.get(c._id)!;
                }
                if (!existing) {
                    this.state.comments.push(c);
                    this.state.commentById.set(c._id, c);
                    changed++;
                } else {
                    copyTransientCommentUiFlags(existing, c);
                    const idx = this.state.comments.indexOf(existing);
                    if (idx >= 0) {
                        this.state.comments[idx] = c;
                        this.state.commentById.set(c._id, c);
                        changed++;
                    }
                }
            }
        }
        if (changed > 0) rebuildIndexes(this.state);
        return changed;
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
