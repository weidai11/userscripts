/**
 * AI Studio integration feature for Power Reader
 * Handles sending content to AI Studio and displaying responses
 */

import { queryGraphQL } from '../../../shared/graphql/client';
import { GET_POST, GET_COMMENT } from '../../../shared/graphql/queries';
import type { Post } from '../../../shared/graphql/queries';
import type {
  GetPostQuery,
  GetPostQueryVariables,
  GetCommentQuery,
  GetCommentQueryVariables
} from '../../../generated/graphql';
import type { ReaderState } from '../state';
import { AI_STUDIO_PROMPT_PREFIX } from '../utils/ai-studio-prompt';
import { getAIStudioPrefix } from '../utils/storage';
import { Logger } from '../utils/logger';

declare const GM_setValue: ((key: string, value: any) => void) | undefined;
declare const GM_openInTab: ((url: string, options?: { active?: boolean }) => void) | undefined;
declare const GM_addValueChangeListener: ((key: string, callback: (key: string, oldValue: any, newValue: any, remote: boolean) => void) => number) | undefined;

/**
 * Handle sending content to AI Studio
 */
export const handleSendToAIStudio = async (state: ReaderState, includeDescendants: boolean = false): Promise<void> => {
  // Find element under mouse
  const target = document.elementFromPoint(state.lastMousePos.x, state.lastMousePos.y);
  if (!target) {
    Logger.warn('AI Studio: No element found under mouse.');
    return;
  }

  const itemEl = target.closest('.pr-comment, .pr-post') as HTMLElement;
  if (!itemEl) {
    Logger.warn('AI Studio: No comment or post found under mouse.');
    return;
  }

  // Clear any existing highlights first
  document.querySelectorAll('.being-summarized').forEach(el => el.classList.remove('being-summarized'));
  itemEl.classList.add('being-summarized');

  const id = itemEl.dataset.id;
  if (!id) {
    Logger.warn('AI Studio: Element has no ID.');
    return;
  }

  // Check session cache first - only if not including descendants (descendants might change)
  if (!includeDescendants && state.sessionAICache[id] && !(window as any).PR_FORCE_AI_REGEN) {
    Logger.info(`AI Studio: Using session-cached answer for ${id}`);
    displayAIPopup(state.sessionAICache[id], state);
    return;
  }
  (window as any).PR_FORCE_AI_REGEN = false;

  const isPost = itemEl.classList.contains('pr-post');
  Logger.info(`AI Studio: Target identified - ${isPost ? 'Post' : 'Comment'} ${id} (Include descendants: ${includeDescendants})`);

  try {
    const statusEl = document.querySelector('.pr-status');
    if (statusEl) statusEl.innerHTML = '<span style="color: #007bff;">[AI Studio] Building conversation thread...</span>';

    const requestId = Math.random().toString(36).substring(2, 10);

    // Build lineage (up to 6 comments + 1 post + focal)
    const lineage: any[] = [];
    let currentId: string | null = id;
    let currentIsPost = isPost;

    while (currentId && lineage.length < 8) {
      const item = await fetchItemMarkdown(currentId, currentIsPost, state);
      if (!item) break;

      lineage.unshift(item);

      if (currentIsPost) {
        currentId = null;
      } else {
        if (item.parentCommentId) {
          currentId = item.parentCommentId;
          currentIsPost = false;
        } else if (item.postId) {
          currentId = item.postId;
          currentIsPost = true;
        } else {
          currentId = null;
        }
      }
    }

    // Handle descendants if requested
    let descendants: any[] = [];
    if (includeDescendants) {
      if (isPost) {
        // For posts, descendants are all loaded comments for this post
        descendants = state.comments.filter(c => c.postId === id);
      } else {
        // For comments, descendants are all comments where this id is in the ancestry
        // Using a simpler approach: all comments whose topLevelCommentId is this id OR who have this id as parent
        // Better: recursively find all children already in state.
        const found = new Set<string>();
        const toCheck = [id];
        while (toCheck.length > 0) {
          const cid = toCheck.pop()!;
          const children = state.comments.filter(c => c.parentCommentId === cid);
          children.forEach(c => {
            if (!found.has(c._id)) {
              found.add(c._id);
              descendants.push(c);
              toCheck.push(c._id);
            }
          });
        }
      }

      // Sort descendants by Tree-Karma or date? Let's use date for XML flow.
      descendants.sort((a, b) => new Date(a.postedAt).getTime() - new Date(b.postedAt).getTime());

      // Filter out comments that are in lineage (the focal item itself)
      descendants = descendants.filter(d => d._id !== id);
    }

    // Assemble XML
    const threadXml = lineage.length > 0 ? toXml(lineage, id, descendants) : '';
    const prefix = getAIStudioPrefix() || AI_STUDIO_PROMPT_PREFIX;
    const finalPayload = prefix + threadXml;

    // Open AI Studio
    Logger.info('AI Studio: Opening tab with deep threaded payload...');
    state.currentAIRequestId = requestId;
    if (typeof GM_setValue === 'function') {
      GM_setValue('ai_studio_request_id', requestId);
      GM_setValue('ai_studio_prompt_payload', finalPayload);
      GM_setValue('ai_studio_include_descendants', includeDescendants);
    }
    if (typeof GM_openInTab === 'function') {
      GM_openInTab('https://aistudio.google.com/prompts/new_chat', { active: true });
    }

    if (statusEl) statusEl.innerHTML = '<span style="color: #28a745;">[AI Studio] Opening AI Studio tab...</span>';
  } catch (error) {
    Logger.error('AI Studio: Failed to prepare threaded payload', error);
    alert('Failed to send thread to AI Studio. Check console.');
  }
};

/**
 * Fetch item markdown content
 */
const fetchItemMarkdown = async (
  itemId: string,
  itemIsPost: boolean,
  state: ReaderState
): Promise<any> => {
  // Check cache
  if (itemIsPost) {
    const p = state.posts.find(p => p._id === itemId);
    if (p?.contents?.markdown) return p;
  } else {
    const c = state.comments.find(c => c._id === itemId);
    if (c?.contents?.markdown) return c;
  }

  // Server fallback
  Logger.info(`AI Studio: Fetching ${itemId} source from server...`);
  if (itemIsPost) {
    const res = await queryGraphQL<GetPostQuery, GetPostQueryVariables>(GET_POST, { id: itemId });
    return res?.post?.result || null;
  } else {
    const res = await queryGraphQL<GetCommentQuery, GetCommentQueryVariables>(GET_COMMENT, { id: itemId });
    return res?.comment?.result || null;
  }
};

/**
 * Convert items to nested XML structure
 */
const toXml = (items: any[], focalId: string, descendants: any[] = []): string => {
  if (items.length === 0) return '';
  const item = items[0];
  const remaining = items.slice(1);

  const isFocal = item._id === focalId;
  const type = (item as Post).title ? 'post' : 'comment';
  const author = item.user?.username || item.author || 'unknown';
  const md = item.contents?.markdown || item.htmlBody || '(no content)';

  let xml = `<${type} id="${item._id}" author="${author}"${isFocal ? ' is_focal="true"' : ''}>\n`;
  xml += `<body_markdown>\n${md}\n</body_markdown>\n`;

  if (isFocal && descendants.length > 0) {
    xml += `<descendants>\n`;
    xml += descendantsToXml(descendants, focalId).split('\n').map(line => '  ' + line).join('\n') + '\n';
    xml += `</descendants>\n`;
  }

  if (remaining.length > 0) {
    xml += toXml(remaining, focalId, descendants).split('\n').map(line => '  ' + line).join('\n') + '\n';
  }
  xml += `</${type}>`;
  return xml;
};

/**
 * Convert a flat list of descendants to nested XML structure
 */
const descendantsToXml = (descendants: any[], parentId: string): string => {
  const children = descendants.filter(d => d.parentCommentId === parentId || (parentId === d.postId && !d.parentCommentId));
  if (children.length === 0) return '';

  return children.map(child => {
    const author = child.user?.username || child.author || 'unknown';
    const md = child.contents?.markdown || child.htmlBody || '(no content)';
    let xml = `<comment id="${child._id}" author="${author}">\n`;
    xml += `  <body_markdown>\n${md.split('\n').map((l: string) => '    ' + l).join('\n')}\n  </body_markdown>\n`;
    const grandChildrenXml = descendantsToXml(descendants, child._id);
    if (grandChildrenXml) {
      xml += grandChildrenXml.split('\n').map(line => '  ' + line).join('\n') + '\n';
    }
    xml += `</comment>`;
    return xml;
  }).join('\n');
};

/**
 * Display AI response in a popup
 */
export const displayAIPopup = (text: string, state: ReaderState, includeDescendants: boolean = false): void => {
  if (state.activeAIPopup) {
    const content = state.activeAIPopup.querySelector('.pr-ai-popup-content');
    if (content) content.innerHTML = text;
    state.activeAIPopup.classList.toggle('pr-ai-include-descendants', includeDescendants);
    return;
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
    <div class="pr-ai-popup-content">${text}</div>
  `;

  document.body.appendChild(popup);
  state.activeAIPopup = popup;

  popup.querySelector('.pr-ai-popup-close')?.addEventListener('click', () => closeAIPopup(state));
  popup.querySelector('.pr-ai-popup-regen')?.addEventListener('click', () => {
    (window as any).PR_FORCE_AI_REGEN = true;
    const isShifted = popup.classList.contains('pr-ai-include-descendants');
    handleSendToAIStudio(state, isShifted);
  });
};

/**
 * Close the AI popup
 */
export const closeAIPopup = (state: ReaderState): void => {
  if (state.activeAIPopup) {
    state.activeAIPopup.remove();
    state.activeAIPopup = null;
  }
  document.querySelectorAll('.being-summarized').forEach(el => el.classList.remove('being-summarized'));
};

/**
 * Initialize AI Studio response listener
 */
export const initAIStudioListener = (state: ReaderState): void => {
  // Skip if GM API not available (e.g., in tests without full userscript environment)
  if (typeof GM_addValueChangeListener !== 'function') {
    Logger.debug('AI Studio: GM_addValueChangeListener not available, skipping listener setup');
    return;
  }

  GM_addValueChangeListener('ai_studio_response_payload', (_key, _oldVal, newVal, remote) => {
    if (!newVal || !remote) return;

    const { text, requestId, includeDescendants } = newVal;
    if (requestId === state.currentAIRequestId) {
      Logger.info('AI Studio: Received matching response!');

      // Cache the response
      const target = document.querySelector('.being-summarized') as HTMLElement;
      if (target?.dataset.id) {
        state.sessionAICache[target.dataset.id] = text;
      }

      displayAIPopup(text, state, !!includeDescendants);

      // Restore status bar
      const statusEl = document.querySelector('.pr-status');
      if (statusEl) statusEl.innerHTML = 'AI Studio response received.';

      const stickyEl = document.getElementById('pr-sticky-ai-status');
      if (stickyEl) {
        stickyEl.classList.remove('visible');
        stickyEl.textContent = '';
      }

      window.focus();
    } else {
      Logger.debug('AI Studio: Received response for different request. Ignoring.');
    }
  });

  GM_addValueChangeListener('ai_studio_status', (_key, _oldVal, newVal, remote) => {
    if (!newVal || !remote) return;
    Logger.debug(`AI Studio Status: ${newVal}`);

    const statusEl = document.querySelector('.pr-status');
    if (statusEl) {
      statusEl.innerHTML = `<span style="color: #28a745;">[AI Studio] ${newVal}</span>`;
    }

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

  // Auto-close popup if target scrolls off-screen
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
          Logger.info('AI Studio: Target scrolled off-screen. Auto-closing popup.');
          closeAIPopup(state);
        }
      }
    }, 500);
  }, { passive: true });
};

/**
 * Setup keyboard handler for AI Studio
 */
export const setupAIStudioKeyboard = (state: ReaderState): void => {
  document.addEventListener('keydown', (e) => {
    // Ignore if typing in an input or textarea
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }

    const key = e.key;
    const lowerKey = key.toLowerCase();

    if (lowerKey === 'g' || key === 'Escape') {
      if (state.activeAIPopup) {
        // Close on Escape always
        if (key === 'Escape') {
          closeAIPopup(state);
          return;
        }

        // Close on 'g' only if mouse is in popup or focal item
        const elementUnderMouse = document.elementFromPoint(state.lastMousePos.x, state.lastMousePos.y);
        const isInPopup = !!elementUnderMouse?.closest('.pr-ai-popup');
        const isInFocalItem = !!elementUnderMouse?.closest('.being-summarized');

        if (isInPopup || isInFocalItem) {
          closeAIPopup(state);
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          return;
        }
      }
    }
  });
};
