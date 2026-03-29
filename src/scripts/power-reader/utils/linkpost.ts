export const isLinkpostCategory = (value: unknown): boolean =>
  typeof value === 'string' && value.toLowerCase() === 'linkpost';

export const normalizeLinkpostUrl = (raw?: string | null): string | null => {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed, window.location.origin);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.toString();
  } catch {
    return null;
  }
};

const normalizeComparableUrl = (raw?: string | null): string | null => {
  const normalized = normalizeLinkpostUrl(raw);
  if (!normalized) return null;
  try {
    const url = new URL(normalized);
    let path = url.pathname.replace(/\/+$/, '');
    if (!path) path = '/';
    return `${url.origin}${path}`;
  } catch {
    return null;
  }
};

export const isSelfLinkpostUrl = (
  linkUrl?: string | null,
  pageUrl?: string | null
): boolean => {
  const linkComparable = normalizeComparableUrl(linkUrl);
  const pageComparable = normalizeComparableUrl(pageUrl);
  if (!linkComparable || !pageComparable) return false;
  return linkComparable === pageComparable;
};

export const getRenderableLinkpostUrl = (
  postCategory: unknown,
  linkUrl?: string | null,
  pageUrl?: string | null
): string | null => {
  if (!isLinkpostCategory(postCategory)) return null;
  const normalizedLink = normalizeLinkpostUrl(linkUrl);
  if (!normalizedLink) return null;
  if (isSelfLinkpostUrl(normalizedLink, pageUrl)) return null;
  return normalizedLink;
};
