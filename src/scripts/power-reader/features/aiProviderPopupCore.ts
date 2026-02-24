import { queryGraphQL } from '../../../shared/graphql/client';
import { GET_POST, GET_COMMENT } from '../../../shared/graphql/queries';
import type { Post, Comment } from '../../../shared/graphql/queries';
import type {
  GetPostQuery,
  GetPostQueryVariables,
  GetCommentQuery,
  GetCommentQueryVariables
} from '../../../generated/graphql';
import type { ReaderState } from '../state';
import { Logger } from '../utils/logger';
import { sanitizeHtml } from '../utils/sanitize';
import {
  fetchAllPostCommentsWithCache,
  getAvailablePostComments,
  isPostComplete,
  collectCommentDescendants
} from '../services/postDescendantsCache';
import {
  promptLargeDescendantConfirmation,
  shouldPromptForLargeDescendants
} from '../utils/descendantConfirm';

declare const GM_setValue: ((key: string, value: any) => void) | undefined;
declare const GM_openInTab: ((url: string, options?: { active?: boolean }) => void) | undefined;
declare const GM_addValueChangeListener: ((key: string, callback: (key: string, oldValue: any, newValue: any, remote: boolean) => void) => number) | undefined;

interface AIUserRef {
  username?: string | null;
}

interface AIContentRef {
  markdown?: string | null;
}

interface AIThreadItem {
  _id: string;
  title?: string | null;
  author?: string | null;
  user?: AIUserRef | null;
  contents?: AIContentRef | null;
  htmlBody?: string | null;
  postId?: string | null;
  parentCommentId?: string | null;
  postedAt?: string | null;
}

interface AIProviderConfig {
  name: string;
  statusTag: string;
  openingStatusText: string;
  openUrl: string;
  cacheKeyPrefix: string;
  hotkey: string;
  requestIdKey: string;
  promptPayloadKey: string;
  includeDescendantsKey: string;
  responsePayloadKey: string;
  statusKey: string;
  getPromptPrefix: () => string;
  defaultPromptPrefix: string;
}

interface AIProviderFeature {
  handleSend: (state: ReaderState, includeDescendants?: boolean, focalItemId?: string) => Promise<void>;
  displayPopup: (text: string, state: ReaderState, includeDescendants?: boolean) => void;
  closePopup: (state: ReaderState) => void;
  initListener: (state: ReaderState) => void;
  setupKeyboard: (state: ReaderState) => void;
}

const popupAutoCloseScrollAttached = new WeakSet<ReaderState>();

const setStatusMessage = (message: string, color?: string): void => {
  const statusEl = document.querySelector('.pr-status') as HTMLElement | null;
  if (!statusEl) return;

  statusEl.textContent = '';
  if (!color) {
    statusEl.textContent = message;
    return;
  }

  const span = document.createElement('span');
  span.style.color = color;
  span.textContent = message;
  statusEl.appendChild(span);
};

const escapeXmlText = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const escapeXmlAttr = (value: string): string =>
  escapeXmlText(value).replace(/"/g, '&quot;').replace(/'/g, '&apos;');

const toXml = (items: AIThreadItem[], focalId: string, descendants: AIThreadItem[] = []): string => {
  if (items.length === 0) return '';
  const item = items[0];
  const remaining = items.slice(1);

  const isFocal = item._id === focalId;
  const type: 'post' | 'comment' = (item as Post).title ? 'post' : 'comment';
  const author = item.user?.username || item.author || 'unknown';
  const md = item.contents?.markdown || item.htmlBody || '(no content)';

  let xml = `<${type} id="${escapeXmlAttr(item._id)}" author="${escapeXmlAttr(author)}"${isFocal ? ' is_focal="true"' : ''}>\n`;
  xml += `<body_markdown>\n${escapeXmlText(md)}\n</body_markdown>\n`;

  if (isFocal && descendants.length > 0) {
    xml += '<descendants>\n';
    xml += descendantsToXml(descendants, focalId).split('\n').map(line => '  ' + line).join('\n') + '\n';
    xml += '</descendants>\n';
  }

  if (remaining.length > 0) {
    xml += toXml(remaining, focalId, descendants).split('\n').map(line => '  ' + line).join('\n') + '\n';
  }
  xml += `</${type}>`;
  return xml;
};

const buildDescendantChildrenIndex = (descendants: AIThreadItem[]): Map<string, AIThreadItem[]> => {
  const byParent = new Map<string, AIThreadItem[]>();
  descendants.forEach((descendant) => {
    const parentKey = descendant.parentCommentId || descendant.postId;
    if (!parentKey) return;
    if (!byParent.has(parentKey)) byParent.set(parentKey, []);
    byParent.get(parentKey)!.push(descendant);
  });
  return byParent;
};

const descendantsToXmlWithIndex = (
  childrenByParent: Map<string, AIThreadItem[]>,
  parentId: string
): string => {
  const children = childrenByParent.get(parentId) || [];
  if (children.length === 0) return '';

  return children.map(child => {
    const author = child.user?.username || child.author || 'unknown';
    const md = child.contents?.markdown || child.htmlBody || '(no content)';
    let xml = `<comment id="${escapeXmlAttr(child._id)}" author="${escapeXmlAttr(author)}">\n`;
    xml += `  <body_markdown>\n${escapeXmlText(md).split('\n').map((l: string) => '    ' + l).join('\n')}\n  </body_markdown>\n`;
    const grandChildrenXml = descendantsToXmlWithIndex(childrenByParent, child._id);
    if (grandChildrenXml) {
      xml += grandChildrenXml.split('\n').map(line => '  ' + line).join('\n') + '\n';
    }
    xml += '</comment>';
    return xml;
  }).join('\n');
};

const descendantsToXml = (descendants: AIThreadItem[], parentId: string): string => {
  // Build parent->children index once to avoid repeated full-array scans per recursion level.
  const childrenByParent = buildDescendantChildrenIndex(descendants);
  return descendantsToXmlWithIndex(childrenByParent, parentId);
};

const fetchItemMarkdown = async (
  itemId: string,
  itemIsPost: boolean,
  state: ReaderState,
  providerName: string
): Promise<AIThreadItem | null> => {
  if (itemIsPost) {
    const p = state.posts.find(p => p._id === itemId);
    if (p?.contents?.markdown) return p;
  } else {
    const c = state.commentById.get(itemId);
    if (c?.contents?.markdown) return c;
  }

  Logger.info(`${providerName}: Fetching ${itemId} source from server...`);
  if (itemIsPost) {
    const res = await queryGraphQL<GetPostQuery, GetPostQueryVariables>(GET_POST, { id: itemId });
    return (res?.post?.result as unknown as AIThreadItem) || null;
  } else {
    const res = await queryGraphQL<GetCommentQuery, GetCommentQueryVariables>(GET_COMMENT, { id: itemId });
    return (res?.comment?.result as unknown as AIThreadItem) || null;
  }
};

export const createAIProviderFeature = (config: AIProviderConfig): AIProviderFeature => {
  const getCacheKey = (id: string, includeDescendants: boolean = false): string =>
    `${config.cacheKeyPrefix}:${id}:${includeDescendants ? 'with_descendants' : 'base'}`;

  const closePopup = (state: ReaderState): void => {
    if (state.activeAIPopup) {
      state.activeAIPopup.remove();
      state.activeAIPopup = null;
    }
    document.querySelectorAll('.being-summarized').forEach(el => el.classList.remove('being-summarized'));
  };

  const handleSend = async (
    state: ReaderState,
    includeDescendants: boolean = false,
    focalItemId?: string
  ): Promise<void> => {
    let itemEl: HTMLElement | null = null;

    if (focalItemId) {
      itemEl = document.querySelector(`.pr-comment[data-id="${focalItemId}"], .pr-post[data-id="${focalItemId}"]`) as HTMLElement | null;
      if (!itemEl) {
        Logger.warn(`${config.name}: Focal item ${focalItemId} no longer in DOM.`);
        return;
      }
    } else {
      const target = document.elementFromPoint(state.lastMousePos.x, state.lastMousePos.y);
      if (target) {
        itemEl = target.closest('.pr-comment, .pr-post') as HTMLElement | null;
      }
      if (!itemEl) {
        itemEl = document.querySelector('.being-summarized.pr-comment, .being-summarized.pr-post') as HTMLElement | null;
      }
    }

    if (!itemEl) {
      Logger.warn(`${config.name}: No comment or post found under mouse.`);
      return;
    }

    document.querySelectorAll('.being-summarized').forEach(el => el.classList.remove('being-summarized'));
    itemEl.classList.add('being-summarized');

    const id = itemEl.dataset.id;
    if (!id) {
      Logger.warn(`${config.name}: Element has no ID.`);
      return;
    }

    const cacheKey = getCacheKey(id, includeDescendants);
    if (state.sessionAICache[cacheKey] && !(window as any).PR_FORCE_AI_REGEN) {
      Logger.info(`${config.name}: Using session-cached answer for ${id}`);
      displayPopup(state.sessionAICache[cacheKey], state, includeDescendants);
      return;
    }
    (window as any).PR_FORCE_AI_REGEN = false;

    const isPost = itemEl.classList.contains('pr-post');
    Logger.info(`${config.name}: Target identified - ${isPost ? 'Post' : 'Comment'} ${id} (Include descendants: ${includeDescendants})`);

    try {
      setStatusMessage(`${config.statusTag} Building conversation thread...`, '#007bff');

      const requestId = Math.random().toString(36).substring(2, 10);
      const lineage: AIThreadItem[] = [];
      let currentId: string | null = id;
      let currentIsPost = isPost;

      while (currentId && lineage.length < 8) {
        const item = await fetchItemMarkdown(currentId, currentIsPost, state, config.name);
        if (!item) break;

        lineage.unshift(item);

        if (currentIsPost) {
          currentId = null;
        } else if (item.parentCommentId) {
          currentId = item.parentCommentId;
          currentIsPost = false;
        } else if (item.postId) {
          currentId = item.postId;
          currentIsPost = true;
        } else {
          currentId = null;
        }
      }

      if (lineage.length === 0) {
        throw new Error(`Unable to load source content for ${isPost ? 'post' : 'comment'} ${id}`);
      }

      let descendants: AIThreadItem[] = [];
      if (includeDescendants) {
        let baselineDescendants: Comment[] = [];
        let fullDescendants: Comment[] = [];
        let actualDescendantCount = 0;
        let decision: 'load_all' | 'continue_without_loading' | 'cancel' = 'load_all';
        let prompted = false;

        if (isPost) {
          const post = state.postById.get(id);
          const totalCount = post?.commentCount ?? -1;
          baselineDescendants = getAvailablePostComments(state, id);
          fullDescendants = baselineDescendants;
          actualDescendantCount = totalCount >= 0 ? totalCount : baselineDescendants.length;

          // For posts, we usually know the exact descendant count from post.commentCount.
          // Prompt before any network fetch so "continue without loading" avoids unnecessary work.
          if (totalCount >= 0 && shouldPromptForLargeDescendants(actualDescendantCount)) {
            decision = await promptLargeDescendantConfirmation({
              descendantCount: actualDescendantCount,
              subjectLabel: 'post'
            });
            prompted = true;
          }

          if (decision === 'load_all' && !isPostComplete(state, id, totalCount)) {
            setStatusMessage(`${config.statusTag} Loading descendants...`, '#007bff');
            await fetchAllPostCommentsWithCache(state, id, totalCount);
            // Never discard already-available descendants if server fetch is partial/empty.
            fullDescendants = getAvailablePostComments(state, id);
            actualDescendantCount = totalCount >= 0 ? totalCount : fullDescendants.length;
          }
        } else {
          const focalComment = state.commentById.get(id);
          const postId = focalComment?.postId || itemEl.dataset.postId || '';
          const postTotalCount = state.postById.get(postId)?.commentCount ?? -1;
          const baselineSource = postId ? getAvailablePostComments(state, postId) : state.comments;
          baselineDescendants = collectCommentDescendants(baselineSource, id);
          fullDescendants = baselineDescendants;
          actualDescendantCount = baselineDescendants.length;

          if (shouldPromptForLargeDescendants(actualDescendantCount)) {
            decision = await promptLargeDescendantConfirmation({
              descendantCount: actualDescendantCount,
              subjectLabel: 'comment'
            });
            prompted = true;
          }

          if (decision === 'load_all' && postId && !isPostComplete(state, postId, postTotalCount)) {
            setStatusMessage(`${config.statusTag} Loading descendants...`, '#007bff');
            await fetchAllPostCommentsWithCache(state, postId, postTotalCount);
            const mergedSource = getAvailablePostComments(state, postId);
            fullDescendants = collectCommentDescendants(mergedSource, id);
            actualDescendantCount = fullDescendants.length;
          }
        }

        if (!prompted && shouldPromptForLargeDescendants(actualDescendantCount)) {
          decision = await promptLargeDescendantConfirmation({
            descendantCount: actualDescendantCount,
            subjectLabel: isPost ? 'post' : 'comment'
          });
        }

        if (decision === 'cancel') {
          setStatusMessage(`${config.statusTag} Action canceled.`, '#dc3545');
          return;
        }

        descendants = (decision === 'continue_without_loading' ? baselineDescendants : fullDescendants) as AIThreadItem[];
        descendants.sort((a, b) => new Date(a.postedAt || '').getTime() - new Date(b.postedAt || '').getTime());
      }

      const threadXml = lineage.length > 0 ? toXml(lineage, id, descendants) : '';
      const finalPayload = (config.getPromptPrefix() || config.defaultPromptPrefix) + threadXml;

      Logger.info(`${config.name}: Opening tab with deep threaded payload...`);
      state.currentAIRequestId = requestId;
      if (typeof GM_setValue === 'function') {
        GM_setValue(config.requestIdKey, requestId);
        GM_setValue(config.promptPayloadKey, finalPayload);
        GM_setValue(config.includeDescendantsKey, includeDescendants);
      }
      if (typeof GM_openInTab === 'function') {
        GM_openInTab(config.openUrl, { active: true });
      }

      setStatusMessage(config.openingStatusText, '#28a745');
    } catch (error) {
      Logger.error(`${config.name}: Failed to prepare threaded payload`, error);
      setStatusMessage(`[${config.name}] Failed to prepare payload. Check console.`, '#dc3545');
    }
  };

  const displayPopup = (text: string, state: ReaderState, includeDescendants: boolean = false): void => {
    if (state.activeAIPopup) {
      state.activeAIPopup.remove();
      state.activeAIPopup = null;
    }

    const popup = document.createElement('div');
    popup.className = `pr-ai-popup${includeDescendants ? ' pr-ai-include-descendants' : ''}`;
    popup.innerHTML = `
    <div class="pr-ai-popup-header">
      <h3>Summary and Potential Errors</h3>
      <div class="pr-ai-popup-actions">
        <button class="pr-ai-popup-regen">Regenerate</button>
        <button class="pr-ai-popup-close">Close</button>
      </div>
    </div>
    <div class="pr-ai-popup-content"></div>
  `;

    const popupContent = popup.querySelector('.pr-ai-popup-content');
    if (popupContent) popupContent.innerHTML = sanitizeHtml(text);

    document.body.appendChild(popup);
    state.activeAIPopup = popup;

    popup.querySelector('.pr-ai-popup-close')?.addEventListener('click', () => closePopup(state));
    popup.querySelector('.pr-ai-popup-regen')?.addEventListener('click', () => {
      (window as any).PR_FORCE_AI_REGEN = true;
      const isShifted = popup.classList.contains('pr-ai-include-descendants');
      const focalId = (document.querySelector('.being-summarized') as HTMLElement | null)?.dataset.id;
      handleSend(state, isShifted, focalId);
    });
  };

  const initListener = (state: ReaderState): void => {
    if (typeof GM_addValueChangeListener !== 'function') {
      Logger.debug(`${config.name}: GM_addValueChangeListener not available, skipping listener setup`);
      return;
    }

    GM_addValueChangeListener(config.responsePayloadKey, (_key, _oldVal, newVal, remote) => {
      if (!newVal || !remote) return;

      const { text, requestId, includeDescendants } = newVal;
      const includeDescendantsMode = !!includeDescendants;
      if (requestId === state.currentAIRequestId) {
        Logger.info(`${config.name}: Received matching response!`);

        const target = document.querySelector('.being-summarized') as HTMLElement;
        if (target?.dataset.id) {
          state.sessionAICache[getCacheKey(target.dataset.id, includeDescendantsMode)] = text;
        }

        displayPopup(text, state, includeDescendantsMode);
        setStatusMessage(`${config.name} response received.`);

        const stickyEl = document.getElementById('pr-sticky-ai-status');
        if (stickyEl) {
          stickyEl.classList.remove('visible');
          stickyEl.textContent = '';
        }

        window.focus();
      } else {
        Logger.debug(`${config.name}: Received response for different request. Ignoring.`);
      }
    });

    GM_addValueChangeListener(config.statusKey, (_key, _oldVal, newVal, remote) => {
      if (!newVal || !remote) return;
      Logger.debug(`${config.name} Status: ${newVal}`);

      const statusEl = document.querySelector('.pr-status');
      if (statusEl) setStatusMessage(`${config.statusTag} ${String(newVal)}`, '#28a745');

      const stickyEl = document.getElementById('pr-sticky-ai-status');
      if (stickyEl) {
        stickyEl.textContent = `AI: ${newVal}`;
        stickyEl.classList.add('visible');

        if (newVal === 'Response received!' || newVal.startsWith('Error:')) {
          setTimeout(() => {
            if (stickyEl.textContent?.includes(newVal)) {
              stickyEl.classList.remove('visible');
            }
          }, 5000);
        }
      }
    });

    if (!popupAutoCloseScrollAttached.has(state)) {
      popupAutoCloseScrollAttached.add(state);
      let scrollThrottle: number | null = null;
      window.addEventListener('scroll', () => {
        if (scrollThrottle || !state.activeAIPopup) return;

        scrollThrottle = window.setTimeout(() => {
          scrollThrottle = null;
          if (!state.activeAIPopup) return;

          const target = document.querySelector('.being-summarized');
          if (target) {
            const rect = target.getBoundingClientRect();
            const isVisible = rect.bottom > 0 && rect.top < window.innerHeight;
            if (!isVisible) {
              Logger.info('AI Popup: Target scrolled off-screen. Auto-closing popup.');
              if (state.activeAIPopup) {
                state.activeAIPopup.remove();
                state.activeAIPopup = null;
              }
              document.querySelectorAll('.being-summarized').forEach(el => el.classList.remove('being-summarized'));
            }
          }
        }, 500);
      }, { passive: true });
    }
  };

  const setupKeyboard = (state: ReaderState): void => {
    document.addEventListener('keydown', (e) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      const key = e.key;
      const lowerKey = key.toLowerCase();

      if (key === 'Escape') {
        closePopup(state);
        return;
      }

      if (e.ctrlKey || e.altKey || e.metaKey) {
        return;
      }

      if (lowerKey === config.hotkey) {
        if (state.activeAIPopup) {
          const elementUnderMouse = document.elementFromPoint(state.lastMousePos.x, state.lastMousePos.y);
          const isInPopup = !!elementUnderMouse?.closest('.pr-ai-popup');
          const isInFocalItem = !!elementUnderMouse?.closest('.being-summarized');

          if (isInPopup || isInFocalItem) {
            closePopup(state);
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
          }
        }
      }
    });
  };

  return {
    handleSend,
    displayPopup,
    closePopup,
    initListener,
    setupKeyboard
  };
};
