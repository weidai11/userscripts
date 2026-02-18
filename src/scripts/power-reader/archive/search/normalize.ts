import type {
  ArchiveCorpusName,
  ArchiveItem,
  ArchiveItemType,
  ArchiveSearchDoc
} from './types';

const HTML_TAG_PATTERN = /<[^>]+>/g;
const WHITESPACE_PATTERN = /\s+/g;
const MARKDOWN_LINK_PATTERN = /\[([^\]]+)\]\(([^)]+)\)/g;
const MARKDOWN_IMAGE_PATTERN = /!\[([^\]]*)\]\(([^)]+)\)/g;
const MARKDOWN_FORMATTING_PATTERN = /(^|\s)[>#*_~`-]+(?=\s|$)/gm;
const MARKDOWN_CODE_FENCE_PATTERN = /```/g;
const MARKDOWN_INLINE_CODE_PATTERN = /`/g;
const MARKDOWN_LATEX_PATTERN = /\$\$?/g;
const PUNCT_FOLD_PATTERN = /[^\p{L}\p{N}\s]/gu;
const APOSTROPHE_PATTERN = /['’]/g;
const TOKEN_SPLIT_PATTERN = /\s+/g;

const COMMON_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
  '&#x27;': "'",
  '&#x2F;': '/',
};

const ENTITY_PATTERN = /&(?:#(?:x[0-9a-fA-F]+|\d+)|[a-z][a-z0-9]*);/gi;

const decodeHtmlEntities = (html: string): string => {
  if (typeof document !== 'undefined') {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = html;
    return textarea.value;
  }

  return html.replace(ENTITY_PATTERN, (entity) => {
    const known = COMMON_ENTITIES[entity.toLowerCase()];
    if (known) return known;
    if (entity.startsWith('&#x')) {
      const code = parseInt(entity.slice(3, -1), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : entity;
    }
    if (entity.startsWith('&#')) {
      const code = parseInt(entity.slice(2, -1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : entity;
    }
    return entity;
  });
};

const collapseWhitespace = (value: string): string =>
  value.replace(WHITESPACE_PATTERN, ' ').trim();

const stripHtmlToText = (html: string): string => {
  const decoded = decodeHtmlEntities(html);
  return collapseWhitespace(decoded.replace(HTML_TAG_PATTERN, ' '));
};

const stripMarkdownFormatting = (markdown: string): string => {
  let text = markdown;
  text = text.replace(MARKDOWN_IMAGE_PATTERN, '$1');
  text = text.replace(MARKDOWN_LINK_PATTERN, '$1');
  text = text.replace(MARKDOWN_CODE_FENCE_PATTERN, ' ');
  text = text.replace(MARKDOWN_INLINE_CODE_PATTERN, '');
  text = text.replace(MARKDOWN_LATEX_PATTERN, '');
  text = text.replace(MARKDOWN_FORMATTING_PATTERN, '$1');
  return collapseWhitespace(text);
};

export const normalizeForSearch = (value: string): string => {
  if (!value) return '';
  const nfkc = value.normalize('NFKC').toLowerCase();
  return collapseWhitespace(nfkc.replace(APOSTROPHE_PATTERN, '').replace(PUNCT_FOLD_PATTERN, ' '));
};

const normalizeBody = (item: ArchiveItem): string => {
  const markdown = item.contents?.markdown;
  if (typeof markdown === 'string' && markdown.trim().length > 0) {
    return normalizeForSearch(stripMarkdownFormatting(markdown));
  }

  const htmlBody = typeof item.htmlBody === 'string' ? item.htmlBody : '';
  return normalizeForSearch(stripHtmlToText(htmlBody));
};

const normalizeTitle = (item: ArchiveItem): string =>
  'title' in item && typeof item.title === 'string' ? normalizeForSearch(item.title) : '';

const getItemType = (item: ArchiveItem): ArchiveItemType =>
  'title' in item ? 'post' : 'comment';

const getAuthorDisplayName = (item: ArchiveItem): string => {
  if (item.user?.displayName) return item.user.displayName;
  if (item.user?.username) return item.user.username;
  return '';
};

const getReplyToDisplayName = (item: ArchiveItem): string => {
  if ('title' in item) return '';
  if (item.parentComment?.user?.displayName) return item.parentComment.user.displayName;
  if (item.post?.user?.displayName) return item.post.user.displayName;
  return '';
};

export const buildArchiveSearchDoc = (item: ArchiveItem, source: ArchiveCorpusName): ArchiveSearchDoc => {
  const titleNorm = normalizeTitle(item);
  const bodyNorm = normalizeBody(item);

  return {
    id: item._id,
    itemType: getItemType(item),
    source,
    postedAtMs: Number.isFinite(new Date(item.postedAt).getTime()) ? new Date(item.postedAt).getTime() : 0,
    baseScore: typeof item.baseScore === 'number' ? item.baseScore : 0,
    authorNameNorm: normalizeForSearch(getAuthorDisplayName(item)),
    replyToNorm: normalizeForSearch(getReplyToDisplayName(item)),
    titleNorm,
    bodyNorm
  };
};

export const tokenizeForIndex = (normText: string): string[] => {
  if (!normText) return [];
  const tokens = normText.split(TOKEN_SPLIT_PATTERN);
  const output: string[] = [];
  const seen = new Set<string>();

  for (const token of tokens) {
    if (!token || token.length < 2) continue;
    if (seen.has(token)) continue;
    seen.add(token);
    output.push(token);
  }

  return output;
};
