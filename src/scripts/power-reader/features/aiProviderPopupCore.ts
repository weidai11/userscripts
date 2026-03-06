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
import { randomBase36 } from '../utils/random';
import { isLinkpostCategory, normalizeLinkpostUrl } from '../utils/linkpost';

declare const GM_setValue: ((key: string, value: any) => void) | undefined;
declare const GM_openInTab: ((url: string, options?: { active?: boolean }) => void) | undefined;
declare const GM_deleteValue: ((key: string) => void) | undefined;

interface AIUserRef {
  username?: string | null;
  displayName?: string | null;
}

interface AIContentRef {
  markdown?: string | null;
}

interface AIThreadItem {
  _id: string;
  title?: string | null;
  linkUrl?: string | null;
  postCategory?: string | null;
  author?: string | null;
  user?: AIUserRef | null;
  contents?: AIContentRef | null;
  htmlBody?: string | null;
  postId?: string | null;
  parentCommentId?: string | null;
  postedAt?: string | null;
  post?: { linkUrl?: string | null; postCategory?: string | null } | null;
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
  handleSend: (
    state: ReaderState,
    includeDescendants?: boolean,
    focalItemId?: string,
    target?: AISendTarget,
    options?: AISendOptions
  ) => Promise<void>;
}

export interface AISendTarget {
  itemId: string;
  isPost: boolean;
  sourceEl?: HTMLElement | null;
  postIdHint?: string | null;
}

export interface StatusReporter {
  setMessage: (message: string, color?: string) => void;
  clear: () => void;
}

export interface AISendOptions {
  statusReporter?: StatusReporter;
  abortSignal?: AbortSignal;
  expectedHref?: string;
}

const readerStatusReporter: StatusReporter = {
  setMessage(message: string, color?: string): void {
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
  },
  clear(): void {
    const statusEl = document.querySelector('.pr-status') as HTMLElement | null;
    if (!statusEl) return;
    statusEl.textContent = '';
  },
};

const isNonEmptyText = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const createAbortError = (): Error => {
  const err = new Error('Operation aborted');
  err.name = 'AbortError';
  return err;
};

const ensureNotAborted = (signal?: AbortSignal): void => {
  if (signal?.aborted) throw createAbortError();
};

const ensureOperationActive = (options?: AISendOptions): void => {
  ensureNotAborted(options?.abortSignal);
  if (options?.expectedHref && window.location.href !== options.expectedHref) {
    throw createAbortError();
  }
};

const isAbortError = (err: unknown): boolean =>
  err instanceof Error && err.name === 'AbortError';

const FORUM_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const FORUM_CACHE_MAX_ENTRIES = 1000;
let forumFetchSeq = 0;
const forumCacheMetaByKey = new Map<string, {
  kind: 'post' | 'comment';
  id: string;
  seq: number;
  updatedAt: number;
}>();

export const resetForumAICache = (state?: ReaderState): void => {
  forumFetchSeq = 0;
  forumCacheMetaByKey.clear();
  if (state) {
    state.forumCommentById.clear();
    state.forumPostById.clear();
  }
};

const forumCacheKey = (kind: 'post' | 'comment', id: string): string => `${kind}:${id}`;

const getCachedPost = (state: ReaderState, postId: string): Post | undefined =>
  state.postById.get(postId) || state.forumPostById.get(postId);

const getCachedComment = (state: ReaderState, commentId: string): Comment | undefined =>
  state.commentById.get(commentId) || state.forumCommentById.get(commentId);

const removeForumCacheEntry = (state: ReaderState, key: string): void => {
  const meta = forumCacheMetaByKey.get(key);
  if (!meta) return;
  if (meta.kind === 'post') {
    state.forumPostById.delete(meta.id);
  } else {
    state.forumCommentById.delete(meta.id);
  }
  forumCacheMetaByKey.delete(key);
};

const pruneForumCache = (state: ReaderState): void => {
  const now = Date.now();
  for (const [key, meta] of forumCacheMetaByKey) {
    if (now - meta.updatedAt > FORUM_CACHE_TTL_MS) {
      removeForumCacheEntry(state, key);
    } else {
      // Entries are ordered from oldest to newest by upsertForumCacheItem.
      break;
    }
  }

  while (forumCacheMetaByKey.size > FORUM_CACHE_MAX_ENTRIES) {
    const oldestKey = forumCacheMetaByKey.keys().next().value as string | undefined;
    if (!oldestKey) break;
    removeForumCacheEntry(state, oldestKey);
  }
};

const mergeThreadItem = <T extends AIThreadItem>(existing: T | null | undefined, incoming: T): T => {
  if (!existing) return incoming;

  const existingMd = existing.contents?.markdown;
  const incomingMd = incoming.contents?.markdown;
  const mergedMd = isNonEmptyText(incomingMd)
    ? incomingMd
    : (isNonEmptyText(existingMd) ? existingMd : (incomingMd ?? existingMd ?? null));

  const mergedContents = {
    ...(existing.contents || {}),
    ...(incoming.contents || {}),
    markdown: mergedMd,
  };

  const existingHtml = existing.htmlBody;
  const incomingHtml = incoming.htmlBody;
  let mergedHtml = existingHtml;
  if (isNonEmptyText(incomingHtml)) {
    mergedHtml = incomingHtml;
  } else if (isNonEmptyText(existingHtml) && (incomingHtml === null || incomingHtml === '' || incomingHtml === undefined)) {
    mergedHtml = existingHtml;
  }

  Object.assign(existing, incoming, {
    contents: mergedContents,
    htmlBody: mergedHtml,
  });

  return existing;
};

const upsertForumCacheItem = (
  state: ReaderState,
  kind: 'post' | 'comment',
  id: string,
  incoming: AIThreadItem,
  seq: number
): AIThreadItem => {
  const key = forumCacheKey(kind, id);
  const meta = forumCacheMetaByKey.get(key);
  if (meta && seq < meta.seq) {
    const existing = kind === 'post'
      ? (getCachedPost(state, id) as unknown as AIThreadItem | undefined)
      : (getCachedComment(state, id) as unknown as AIThreadItem | undefined);
    if (existing) return existing;
  }

  if (kind === 'post') {
    const existing = getCachedPost(state, id) as unknown as AIThreadItem | undefined;
    const merged = mergeThreadItem(existing, incoming);
    state.forumPostById.set(id, merged as unknown as Post);
  } else {
    const existing = getCachedComment(state, id) as unknown as AIThreadItem | undefined;
    const merged = mergeThreadItem(existing, incoming);
    state.forumCommentById.set(id, merged as unknown as Comment);
  }

  forumCacheMetaByKey.delete(key);
  forumCacheMetaByKey.set(key, {
    kind,
    id,
    seq,
    updatedAt: Date.now(),
  });
  pruneForumCache(state);

  return kind === 'post'
    ? ((state.forumPostById.get(id) as unknown as AIThreadItem) || incoming)
    : ((state.forumCommentById.get(id) as unknown as AIThreadItem) || incoming);
};

const setStatusMessage = (reporter: StatusReporter, message: string, color?: string): void => {
  reporter.setMessage(message, color);
};

const getStatusReporter = (custom?: StatusReporter): StatusReporter =>
  custom || readerStatusReporter;

const clearHighlight = (itemEl: HTMLElement | null): void => {
  if (itemEl?.isConnected) {
    itemEl.classList.remove('being-summarized');
  }
};

const highlightItem = (itemEl: HTMLElement | null): void => {
  document.querySelectorAll('.being-summarized').forEach(el => el.classList.remove('being-summarized'));
  if (itemEl) itemEl.classList.add('being-summarized');
};

const escapeXmlText = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const escapeXmlAttr = (value: string): string =>
  escapeXmlText(value).replace(/"/g, '&quot;').replace(/'/g, '&apos;');

const makeIndent = (depth: number): string => '  '.repeat(Math.max(0, depth));

const getAuthorLabelForAI = (item: AIThreadItem, fallback: string = 'unknown'): string => {
  const displayName = item.user?.displayName;
  if (isNonEmptyText(displayName)) return displayName.trim();
  return getAuthorHandle(item, fallback);
};

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
  const author = getAuthorLabelForAI(item, 'unknown');
  const md = item.contents?.markdown || item.htmlBody || '(no content)';
  const titleAttr = type === 'post' && item.title ? ` title="${escapeXmlAttr(item.title)}"` : '';
  const linkUrlTag = type === 'post' && isLinkpostCategory(item.postCategory) && isNonEmptyText(item.linkUrl)
    ? `${childIndent}<link_url>${escapeXmlText(normalizeLinkpostUrl(item.linkUrl) || item.linkUrl)}</link_url>\n`
    : '';
  const commentPostLinkTag = type === 'comment' && isLinkpostCategory(item.post?.postCategory) && isNonEmptyText(item.post?.linkUrl)
    ? `${childIndent}<post_link_url>${escapeXmlText(normalizeLinkpostUrl(item.post!.linkUrl!) || item.post!.linkUrl!)}</post_link_url>\n`
    : '';

  let xml = `${indent}<${type} id="${escapeXmlAttr(item._id)}" author="${escapeXmlAttr(author)}"${isFocal ? ' is_focal="true"' : ''}${titleAttr}>\n`;
  xml += linkUrlTag;
  xml += commentPostLinkTag;
  xml += `${childIndent}<body_markdown>\n${escapeXmlText(md)}\n${childIndent}</body_markdown>\n`;

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
    const author = getAuthorLabelForAI(child, 'unknown');
    const md = child.contents?.markdown || child.htmlBody || '(no content)';
    let xml = `${indent}<comment id="${escapeXmlAttr(child._id)}" author="${escapeXmlAttr(author)}">\n`;
    xml += `${childIndent}<body_markdown>\n${escapeXmlText(md)}\n${childIndent}</body_markdown>\n`;
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
  `${baseKey}:${Date.now().toString(36)}:${randomBase36(8)}`;

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
  providerName: string,
  options?: AISendOptions
): Promise<AIThreadItem | null> => {
  ensureOperationActive(options);

  if (itemIsPost) {
    const p = getCachedPost(state, itemId);
    if (p?.contents?.markdown) return p;
  } else {
    const c = getCachedComment(state, itemId);
    if (c?.contents?.markdown) return c;
  }

  Logger.info(`${providerName}: Fetching ${itemId} source from server...`);
  const seq = ++forumFetchSeq;
  if (itemIsPost) {
    const res = await queryGraphQL<GetPostQuery, GetPostQueryVariables>(GET_POST, { id: itemId });
    ensureOperationActive(options);
    const fetched = (res?.post?.result as unknown as AIThreadItem) || null;
    if (!fetched) return null;
    return upsertForumCacheItem(state, 'post', itemId, fetched, seq);
  } else {
    const res = await queryGraphQL<GetCommentQuery, GetCommentQueryVariables>(GET_COMMENT, { id: itemId });
    ensureOperationActive(options);
    const fetched = (res?.comment?.result as unknown as AIThreadItem) || null;
    if (!fetched) return null;
    return upsertForumCacheItem(state, 'comment', itemId, fetched, seq);
  }
};

export const createAIProviderFeature = (config: AIProviderConfig): AIProviderFeature => {
  const handleSend = async (
    state: ReaderState,
    includeDescendants: boolean = false,
    focalItemId?: string,
    target?: AISendTarget,
    options?: AISendOptions
  ): Promise<void> => {
    const reporter = getStatusReporter(options?.statusReporter);
    let itemEl: HTMLElement | null = null;
    let id: string | null = null;
    let isPost = false;
    let postIdHint: string | null = null;

    if (target) {
      id = target.itemId;
      isPost = !!target.isPost;
      postIdHint = target.postIdHint || null;
      itemEl = target.sourceEl || null;
    }

    if (!id && focalItemId) {
      itemEl = document.querySelector(`.pr-comment[data-id="${focalItemId}"], .pr-post[data-id="${focalItemId}"]`) as HTMLElement | null;
      if (!itemEl) {
        Logger.warn(`${config.name}: Focal item ${focalItemId} no longer in DOM.`);
        return;
      }
      id = focalItemId;
      isPost = itemEl.classList.contains('pr-post');
    } else if (!id) {
      const target = document.elementFromPoint(state.lastMousePos.x, state.lastMousePos.y);
      if (target) {
        itemEl = target.closest('.pr-comment, .pr-post') as HTMLElement | null;
      }
      if (!itemEl) {
        itemEl = document.querySelector('.being-summarized.pr-comment, .being-summarized.pr-post') as HTMLElement | null;
      }
      if (itemEl) {
        id = itemEl.dataset.id || null;
        isPost = itemEl.classList.contains('pr-post');
        postIdHint = itemEl.dataset.postId || null;
      }
    }

    if (!id) {
      Logger.warn(`${config.name}: Target has no item id.`);
      return;
    }

    if (!itemEl && !target) {
      Logger.warn(`${config.name}: No comment or post found under mouse.`);
      return;
    }

    try {
      ensureOperationActive(options);
      highlightItem(itemEl);
      Logger.info(`${config.name}: Target identified - ${isPost ? 'Post' : 'Comment'} ${id} (Include descendants: ${includeDescendants})`);
      setStatusMessage(reporter, `${config.statusTag} Building conversation thread...`, '#007bff');

      const lineage: AIThreadItem[] = [];
      let currentId: string | null = id;
      let currentIsPost = isPost;

      while (currentId && lineage.length < 8) {
        ensureOperationActive(options);
        const item = await fetchItemMarkdown(currentId, currentIsPost, state, config.name, options);
        ensureOperationActive(options);
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
          const post = getCachedPost(state, id);
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
            }, options?.abortSignal);
            prompted = true;
          }

          if (decision === 'load_all' && !isPostComplete(state, id, totalCount)) {
            setStatusMessage(reporter, `${config.statusTag} Loading descendants...`, '#007bff');
            await fetchAllPostCommentsWithCache(state, id, totalCount);
            ensureOperationActive(options);
            // Never discard already-available descendants if server fetch is partial/empty.
            fullDescendants = getAvailablePostComments(state, id);
            actualDescendantCount = totalCount >= 0 ? totalCount : fullDescendants.length;
          }
        } else {
          const focalComment = getCachedComment(state, id);
          let postId = focalComment?.postId || postIdHint || itemEl?.dataset.postId || '';
          if (!postId) {
            const fetchedFocal = await fetchItemMarkdown(id, false, state, config.name, options);
            ensureOperationActive(options);
            postId = fetchedFocal?.postId || postIdHint || '';
          }
          if (!postId) {
            setStatusMessage(reporter, `${config.statusTag} Unable to resolve post context for descendants.`, '#dc3545');
            clearHighlight(itemEl);
            return;
          }
          const postTotalCount = getCachedPost(state, postId)?.commentCount ?? -1;
          const baselineSource = postId ? getAvailablePostComments(state, postId) : state.comments;
          baselineDescendants = collectCommentDescendants(baselineSource, id);
          fullDescendants = baselineDescendants;
          actualDescendantCount = baselineDescendants.length;

          if (shouldPromptForLargeDescendants(actualDescendantCount)) {
            decision = await promptLargeDescendantConfirmation({
              descendantCount: actualDescendantCount,
              subjectLabel: 'comment'
            }, options?.abortSignal);
            prompted = true;
          }

          if (decision === 'load_all' && postId && !isPostComplete(state, postId, postTotalCount)) {
            setStatusMessage(reporter, `${config.statusTag} Loading descendants...`, '#007bff');
            await fetchAllPostCommentsWithCache(state, postId, postTotalCount);
            ensureOperationActive(options);
            const mergedSource = getAvailablePostComments(state, postId);
            fullDescendants = collectCommentDescendants(mergedSource, id);
            actualDescendantCount = fullDescendants.length;
          }
        }

        if (!prompted && shouldPromptForLargeDescendants(actualDescendantCount)) {
          decision = await promptLargeDescendantConfirmation({
            descendantCount: actualDescendantCount,
            subjectLabel: isPost ? 'post' : 'comment'
          }, options?.abortSignal);
        }

        if (decision === 'cancel') {
          setStatusMessage(reporter, `${config.statusTag} Action canceled.`, '#dc3545');
          clearHighlight(itemEl);
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
      ensureOperationActive(options);
      if (typeof GM_setValue !== 'function') {
        throw new Error('GM_setValue unavailable');
      }
      GM_setValue(payloadStorageKey, finalPayload);
      registerAIPayloadKey(payloadStorageKey);

      try {
        ensureOperationActive(options);
        if (typeof GM_openInTab !== 'function') {
          throw new Error('GM_openInTab unavailable');
        }
        ensureOperationActive(options);
        GM_openInTab(providerUrl, { active: true });
      } catch (openError) {
        if (typeof GM_deleteValue === 'function') {
          GM_deleteValue(payloadStorageKey);
        }
        consumeAIPayloadKey(payloadStorageKey);
        throw openError;
      }

      setStatusMessage(reporter, config.openingStatusText, '#28a745');
      // Clear handoff highlight after a short delay now that completion is shown in provider tab.
      window.setTimeout(() => {
        clearHighlight(itemEl);
      }, 3000);
    } catch (error) {
      if (isAbortError(error)) {
        setStatusMessage(reporter, `${config.statusTag} Action canceled.`, '#dc3545');
      } else {
        Logger.error(`${config.name}: Failed to prepare threaded payload`, error);
        setStatusMessage(reporter, `[${config.name}] Failed to prepare payload. Check console.`, '#dc3545');
      }
      clearHighlight(itemEl);
    }
  };

  return { handleSend };
};
