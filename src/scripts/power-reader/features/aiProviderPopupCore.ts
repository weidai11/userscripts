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
import { getAuthorHandle } from '../utils/author';
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
import { consumeAIPayloadKey, registerAIPayloadKey } from '../utils/aiPayloadStorage';

declare const GM_setValue: ((key: string, value: any) => void) | undefined;
declare const GM_openInTab: ((url: string, options?: { active?: boolean }) => void) | undefined;
declare const GM_deleteValue: ((key: string) => void) | undefined;

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
  promptPayloadKey: string;
  getPromptPrefix: () => string;
  defaultPromptPrefix: string;
}

interface AIProviderFeature {
  handleSend: (state: ReaderState, includeDescendants?: boolean, focalItemId?: string) => Promise<void>;
}

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

const makeIndent = (depth: number): string => '  '.repeat(Math.max(0, depth));

const indentMultiline = (value: string, depth: number): string =>
  value.replace(/^/gm, makeIndent(depth));

const toXml = (
  items: AIThreadItem[],
  focalId: string,
  descendants: AIThreadItem[] = [],
  depth: number = 0
): string => {
  if (items.length === 0) return '';
  const item = items[0];
  const remaining = items.slice(1);
  const indent = makeIndent(depth);
  const childIndent = makeIndent(depth + 1);

  const isFocal = item._id === focalId;
  const type: 'post' | 'comment' = typeof item.title === 'string' ? 'post' : 'comment';
  const author = getAuthorHandle(item, 'unknown');
  const md = item.contents?.markdown || item.htmlBody || '(no content)';
  const titleAttr = type === 'post' && item.title ? ` title="${escapeXmlAttr(item.title)}"` : '';

  let xml = `${indent}<${type} id="${escapeXmlAttr(item._id)}" author="${escapeXmlAttr(author)}"${isFocal ? ' is_focal="true"' : ''}${titleAttr}>\n`;
  xml += `${childIndent}<body_markdown>\n${indentMultiline(escapeXmlText(md), depth + 2)}\n${childIndent}</body_markdown>\n`;

  if (isFocal && descendants.length > 0) {
    xml += `${childIndent}<descendants>\n`;
    xml += `${descendantsToXml(descendants, focalId, depth + 2)}\n`;
    xml += `${childIndent}</descendants>\n`;
  }

  if (remaining.length > 0) {
    xml += `${toXml(remaining, focalId, descendants, depth + 1)}\n`;
  }
  xml += `${indent}</${type}>`;
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
  parentId: string,
  depth: number
): string => {
  const children = childrenByParent.get(parentId) || [];
  if (children.length === 0) return '';

  const indent = makeIndent(depth);
  const childIndent = makeIndent(depth + 1);

  return children.map(child => {
    const author = getAuthorHandle(child, 'unknown');
    const md = child.contents?.markdown || child.htmlBody || '(no content)';
    let xml = `${indent}<comment id="${escapeXmlAttr(child._id)}" author="${escapeXmlAttr(author)}">\n`;
    xml += `${childIndent}<body_markdown>\n${indentMultiline(escapeXmlText(md), depth + 2)}\n${childIndent}</body_markdown>\n`;
    const grandChildrenXml = descendantsToXmlWithIndex(childrenByParent, child._id, depth + 1);
    if (grandChildrenXml) {
      xml += `${grandChildrenXml}\n`;
    }
    xml += `${indent}</comment>`;
    return xml;
  }).join('\n');
};

const descendantsToXml = (
  descendants: AIThreadItem[],
  parentId: string,
  depth: number = 0
): string => {
  // Build parent->children index once to avoid repeated full-array scans per recursion level.
  const childrenByParent = buildDescendantChildrenIndex(descendants);
  return descendantsToXmlWithIndex(childrenByParent, parentId, depth);
};

const buildPayloadStorageKey = (baseKey: string): string =>
  `${baseKey}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 10)}`;

const toTimestamp = (value?: string | null): number => {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const buildProviderUrl = (baseUrl: string, payloadKey: string): string => {
  try {
    const url = new URL(baseUrl);
    const hashParams = new URLSearchParams(url.hash.startsWith('#') ? url.hash.slice(1) : url.hash);
    hashParams.set('pr_payload_key', payloadKey);
    url.hash = hashParams.toString();
    return url.toString();
  } catch {
    const separator = baseUrl.includes('#') ? '&' : '#';
    return `${baseUrl}${separator}pr_payload_key=${encodeURIComponent(payloadKey)}`;
  }
};

const fetchItemMarkdown = async (
  itemId: string,
  itemIsPost: boolean,
  state: ReaderState,
  providerName: string
): Promise<AIThreadItem | null> => {
  if (itemIsPost) {
    const p = state.postById.get(itemId);
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

    const isPost = itemEl.classList.contains('pr-post');
    Logger.info(`${config.name}: Target identified - ${isPost ? 'Post' : 'Comment'} ${id} (Include descendants: ${includeDescendants})`);

    try {
      setStatusMessage(`${config.statusTag} Building conversation thread...`, '#007bff');

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
          itemEl.classList.remove('being-summarized');
          return;
        }

        descendants = (decision === 'continue_without_loading' ? baselineDescendants : fullDescendants) as AIThreadItem[];
        descendants.sort((a, b) => toTimestamp(a.postedAt) - toTimestamp(b.postedAt));
      }

      const threadXml = lineage.length > 0 ? toXml(lineage, id, descendants) : '';
      const finalPayload = (config.getPromptPrefix() || config.defaultPromptPrefix) + threadXml;
      const payloadStorageKey = buildPayloadStorageKey(config.promptPayloadKey);
      const providerUrl = buildProviderUrl(config.openUrl, payloadStorageKey);

      Logger.info(`${config.name}: Opening tab with deep threaded payload...`);
      if (typeof GM_setValue !== 'function') {
        throw new Error('GM_setValue unavailable');
      }
      GM_setValue(payloadStorageKey, finalPayload);
      registerAIPayloadKey(payloadStorageKey);

      try {
        if (typeof GM_openInTab !== 'function') {
          throw new Error('GM_openInTab unavailable');
        }
        GM_openInTab(providerUrl, { active: true });
      } catch (openError) {
        if (typeof GM_deleteValue === 'function') {
          GM_deleteValue(payloadStorageKey);
        }
        consumeAIPayloadKey(payloadStorageKey);
        throw openError;
      }

      setStatusMessage(config.openingStatusText, '#28a745');
      // Clear handoff highlight after a short delay now that completion is shown in provider tab.
      window.setTimeout(() => {
        if (itemEl?.isConnected) itemEl.classList.remove('being-summarized');
      }, 3000);
    } catch (error) {
      Logger.error(`${config.name}: Failed to prepare threaded payload`, error);
      setStatusMessage(`[${config.name}] Failed to prepare payload. Check console.`, '#dc3545');
      itemEl.classList.remove('being-summarized');
    }
  };

  return { handleSend };
};
