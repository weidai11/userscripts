import type { AISendTarget } from './aiProviderPopupCore';
import { isGreaterWrongHost } from '../utils/forum';

export interface ForumResolvedAITarget extends AISendTarget {
  containerEl: HTMLElement | null;
}

// GreaterWrong-specific selectors are appended only on GreaterWrong hosts so
// LW/EAF target resolution stays byte-for-byte unchanged. `.post`, `.comment-item`,
// `.comment-body`, etc. are generic class names that could collide on LW/EAF pages.
const GW_SELECTORS = {
  commentContainers: isGreaterWrongHost() ? ['.comment-item'] : [],
  commentBodies: isGreaterWrongHost() ? ['.comment-body'] : [],
  postBodies: isGreaterWrongHost() ? ['.post', '.post-body'] : [],
  postLinkContexts: isGreaterWrongHost() ? ['.post-title-link'] : [],
  excludedRegions: isGreaterWrongHost() ? ['.page-toolbar', '#bottom-bar'] : [],
};

const COMMENT_CONTAINER_SELECTORS = ['.comments-node', '.CommentFrame-node', ...GW_SELECTORS.commentContainers];
const FEED_CARD_SELECTORS = ['.LWPostsItem-postsItem', '.PostsItem2-root', '.PostsItem-root'];
const COMMENT_BODY_SELECTORS = [
  '.CommentsItem-content',
  '.CommentBody-root',
  '.commentBody',
  '.CommentsItem-body',
  '.CommentFrame-body',
  ...GW_SELECTORS.commentBodies,
];
const POST_BODY_SELECTORS = ['#postBody', '.PostsPage-postsPage', '.PostsPage-post', ...GW_SELECTORS.postBodies];
const STRUCTURAL_COMMENT_LINK_CONTEXT_SELECTORS = [
  '.CommentsItem-meta',
  '.CommentsItemMeta-root',
  '.CommentsItemDate-root',
  '.CommentFrame-meta',
  '.CommentMeta',
  '.comment-meta',
  '.commentTime',
];
const STRUCTURAL_POST_LINK_CONTEXT_SELECTORS = [
  '.LWPostsItem-title',
  '.PostsItem2-title',
  '.PostsItem-title',
  '.PostsPageTitle-root',
  ...GW_SELECTORS.postLinkContexts,
  'h1',
  'h2',
];
const EXCLUDED_REGION_SELECTORS = [
  'header',
  'footer',
  'nav',
  '[role="navigation"]',
  '[role="search"]',
  '[role="complementary"]',
  'aside',
  '.FixedPositionToC',
  '.TableOfContents',
  '.table-of-contents',
  '.Header-root',
  '.GlobalHeader-root',
  '.UsersMenu-root',
  '.SearchBar-root',
  '.GlobalSidebar-root',
  ...GW_SELECTORS.excludedRegions,
];
const COMMENT_PERMALINK_ROOT_SELECTOR = '.CommentPermalink-root';

const joinSelector = (selectors: string[]): string => selectors.join(', ');
const COMMENT_CONTAINER_SELECTOR = joinSelector(COMMENT_CONTAINER_SELECTORS);
const FEED_CARD_SELECTOR = joinSelector(FEED_CARD_SELECTORS);
const POST_BODY_SELECTOR = joinSelector(POST_BODY_SELECTORS);
const BODY_CONTENT_SELECTOR = joinSelector([...COMMENT_BODY_SELECTORS, ...POST_BODY_SELECTORS]);
const STRUCTURAL_COMMENT_LINK_CONTEXT_SELECTOR = joinSelector(STRUCTURAL_COMMENT_LINK_CONTEXT_SELECTORS);
const STRUCTURAL_POST_LINK_CONTEXT_SELECTOR = joinSelector(STRUCTURAL_POST_LINK_CONTEXT_SELECTORS);
const EXCLUDED_REGION_SELECTOR = joinSelector(EXCLUDED_REGION_SELECTORS);
const COMMENT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{1,127}$/;

const extractCommentId = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  let decoded = trimmed;
  try {
    decoded = decodeURIComponent(trimmed);
  } catch {
    // Keep raw value if decoding fails.
  }

  const normalized = decoded
    .replace(/^#/, '')
    .replace(/^(?:comment(?:s)?(?:id)?|id)[-_:=/]*/i, '')
    .trim();

  if (!COMMENT_ID_PATTERN.test(normalized)) return null;
  return normalized;
};

const COMMENT_ID_PATH_PATTERN = /\/(?:comment|answer)\/([A-Za-z0-9_-]{2,128})\/?$/i;

const parseCommentIdFromHref = (href: string): string | null => {
  try {
    const url = new URL(href, window.location.origin);
    const commentId = url.searchParams.get('commentId');
    if (commentId) return extractCommentId(commentId);

    // `/comment/{cid}` / `/answer/{cid}` permalink path forms are GreaterWrong-specific;
    // keep LW/EAF acceptance surface byte-for-byte unchanged.
    if (isGreaterWrongHost()) {
      const pathMatch = url.pathname.match(COMMENT_ID_PATH_PATTERN);
      if (pathMatch?.[1]) return extractCommentId(pathMatch[1]);
    }

    const hash = url.hash.startsWith('#') ? url.hash.slice(1) : url.hash;
    const hashMatch = hash.match(/(?:^|[/?&])comment(?:id)?[-_:/=]([A-Za-z0-9_-]{2,128})(?:$|[/?&])/i);
    if (hashMatch?.[1]) return extractCommentId(hashMatch[1]);
  } catch {
    return null;
  }
  return null;
};

const getCommentIdFromCurrentUrl = (): string | null => {
  try {
    const url = new URL(window.location.href);
    const fromParam = extractCommentId(url.searchParams.get('commentId'));
    if (fromParam) return fromParam;
    if (isGreaterWrongHost()) {
      const pathMatch = url.pathname.match(COMMENT_ID_PATH_PATTERN);
      if (pathMatch?.[1]) return extractCommentId(pathMatch[1]);
    }
    return null;
  } catch {
    return null;
  }
};

const parsePostIdFromPath = (pathOrHref: string): string | null => {
  const match = pathOrHref.match(/\/posts\/([A-Za-z0-9_-]+)/i);
  return match?.[1] || null;
};

const parsePostIdFromAnchor = (anchor: HTMLAnchorElement): string | null => {
  const href = anchor.getAttribute('href') || anchor.href || '';
  return parsePostIdFromPath(href);
};

const getClosestElement = (target: EventTarget | null): HTMLElement | null => {
  if (!target) return null;
  if (target instanceof HTMLElement) return target;
  if (target instanceof Element) return target.parentElement;
  if (target instanceof Node) return target.parentElement;
  return null;
};

const isInExcludedRegion = (el: HTMLElement): boolean => !!el.closest(EXCLUDED_REGION_SELECTOR);

const isInBodyContent = (el: HTMLElement): boolean => !!el.closest(BODY_CONTENT_SELECTOR);

const getStructuralCommentLinkId = (anchor: HTMLAnchorElement): string | null => {
  const commentId = parseCommentIdFromHref(anchor.href || anchor.getAttribute('href') || '');
  if (!commentId) return null;
  if (!anchor.closest(STRUCTURAL_COMMENT_LINK_CONTEXT_SELECTOR)) return null;
  return commentId;
};

const isStructuralPostLink = (anchor: HTMLAnchorElement): boolean => {
  if (!parsePostIdFromAnchor(anchor)) return false;
  // On GreaterWrong, a `/posts/` link inside a comment container resolves to the
  // enclosing comment (SPEC PR-AI-12). LW/EAF resolution stays unchanged.
  if (isGreaterWrongHost() && getCommentContainer(anchor)) return false;
  if (isInBodyContent(anchor)) return false;
  return !!anchor.closest(STRUCTURAL_POST_LINK_CONTEXT_SELECTOR);
};

const getPostIdFromCurrentUrl = (): string | null => parsePostIdFromPath(window.location.pathname);

const findFirstPostLinkInContainer = (container: Element): HTMLAnchorElement | null =>
  (container.querySelector('a[href*="/posts/"]') as HTMLAnchorElement | null);

const getPostIdHintForElement = (el: HTMLElement): string | null => {
  const nearestPostAnchor = el.closest('a[href*="/posts/"]') as HTMLAnchorElement | null;
  const fromAnchor = nearestPostAnchor ? parsePostIdFromAnchor(nearestPostAnchor) : null;
  if (fromAnchor) return fromAnchor;

  // GreaterWrong comments carry `data-post-id` (e.g. on pages whose URL has no /posts/ segment).
  // It sits on the inner `.comment` div, which may be the element itself or a descendant of it.
  if (isGreaterWrongHost()) {
    const dataPostId = el.closest('[data-post-id]')?.getAttribute('data-post-id')
      ?? el.querySelector('.comment[data-post-id]')?.getAttribute('data-post-id');
    if (dataPostId && COMMENT_ID_PATTERN.test(dataPostId.trim())) return dataPostId.trim();
  }

  const card = el.closest(FEED_CARD_SELECTOR);
  if (card) {
    const cardLink = findFirstPostLinkInContainer(card);
    const fromCard = cardLink ? parsePostIdFromAnchor(cardLink) : null;
    if (fromCard) return fromCard;
  }

  return getPostIdFromCurrentUrl();
};

const buildCommentTarget = (commentId: string, sourceEl: HTMLElement | null, containerEl: HTMLElement | null): ForumResolvedAITarget => ({
  itemId: commentId,
  isPost: false,
  sourceEl,
  postIdHint: (containerEl || sourceEl) ? getPostIdHintForElement((containerEl || sourceEl) as HTMLElement) : getPostIdFromCurrentUrl(),
  containerEl,
});

const buildPostTarget = (postId: string, sourceEl: HTMLElement | null, containerEl: HTMLElement | null): ForumResolvedAITarget => ({
  itemId: postId,
  isPost: true,
  sourceEl,
  containerEl,
});

const getCommentContainer = (el: HTMLElement): HTMLElement | null =>
  el.closest(COMMENT_CONTAINER_SELECTOR) as HTMLElement | null;

const getCommentIdFromContainer = (container: HTMLElement): string | null => {
  const fromContainerId = extractCommentId(container.id);
  if (fromContainerId) return fromContainerId;

  const structuralContexts = container.querySelectorAll(
    STRUCTURAL_COMMENT_LINK_CONTEXT_SELECTOR
  ) as NodeListOf<HTMLElement>;

  for (const contextEl of structuralContexts) {
    if (contextEl.closest(COMMENT_CONTAINER_SELECTOR) !== container) continue;
    const anchors = contextEl.querySelectorAll('a[href]') as NodeListOf<HTMLAnchorElement>;
    for (const anchor of anchors) {
      const fromAnchor = parseCommentIdFromHref(anchor.href || anchor.getAttribute('href') || '');
      if (fromAnchor) return fromAnchor;
    }
  }

  const permalinkRoot = container.closest(COMMENT_PERMALINK_ROOT_SELECTOR) as HTMLElement | null;
  if (permalinkRoot) {
    const focalCommentContainer = permalinkRoot.querySelector(COMMENT_CONTAINER_SELECTOR) as HTMLElement | null;
    if (focalCommentContainer === container) {
      return getCommentIdFromCurrentUrl();
    }
  }

  return null;
};

const resolvePostContainer = (el: HTMLElement): HTMLElement | null =>
  (el.closest(FEED_CARD_SELECTOR) as HTMLElement | null)
  || (el.closest(POST_BODY_SELECTORS.join(', ')) as HTMLElement | null)
  || null;

export const resolveForumAITargetFromElement = (rawEl: EventTarget | null): ForumResolvedAITarget | null => {
  const el = getClosestElement(rawEl);
  if (!el) return null;
  if (isInExcludedRegion(el)) return null;

  const anchor = el.closest('a[href]') as HTMLAnchorElement | null;
  if (anchor && !isInExcludedRegion(anchor)) {
    const commentId = getStructuralCommentLinkId(anchor);
    if (commentId) {
      const container = getCommentContainer(anchor);
      const contextEl = container || anchor;
      return buildCommentTarget(commentId, contextEl, container || contextEl);
    }

    if (isStructuralPostLink(anchor)) {
      const postId = parsePostIdFromAnchor(anchor);
      if (postId) {
        const container = resolvePostContainer(anchor) || anchor;
        return buildPostTarget(postId, container, container);
      }
    }
  }

  const commentContainer = getCommentContainer(el);
  if (commentContainer) {
    const commentId = getCommentIdFromContainer(commentContainer);
    if (commentId) {
      return buildCommentTarget(commentId, commentContainer, commentContainer);
    }
  }

  // On GreaterWrong, a `/posts/` link inside a comment container resolves to the
  // enclosing comment (SPEC PR-AI-12). LW/EAF resolution stays unchanged.
  if (anchor && !isInBodyContent(anchor) && !isInExcludedRegion(anchor) && (!isGreaterWrongHost() || !getCommentContainer(anchor))) {
    const postId = parsePostIdFromAnchor(anchor);
    if (postId) {
      const container = resolvePostContainer(anchor) || anchor;
      return buildPostTarget(postId, container, container);
    }
  }

  const card = el.closest(FEED_CARD_SELECTOR);
  if (card) {
    const link = findFirstPostLinkInContainer(card);
    const postId = link ? parsePostIdFromAnchor(link) : null;
    const fallback = postId || (card as HTMLElement).getAttribute('data-post-id') || null;
    if (fallback) {
      return buildPostTarget(fallback, card as HTMLElement, card as HTMLElement);
    }
  }

  const postBodyContainer = el.closest(POST_BODY_SELECTOR) as HTMLElement | null;
  if (postBodyContainer) {
    const postIdFromUrl = getPostIdFromCurrentUrl();
    if (postIdFromUrl) {
      const anchorPostId = anchor ? parsePostIdFromAnchor(anchor) : null;
      if (!anchorPostId || anchorPostId === postIdFromUrl) {
        const container = postBodyContainer || el;
        return buildPostTarget(postIdFromUrl, container, container);
      }
    }
  }

  return null;
};
