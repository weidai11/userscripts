/**
 * External links feature for Power Reader
 * Ensures external links open in new tabs
 */

/**
 * Setup external link handling
 */
export const setupExternalLinks = (): void => {
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const link = target.closest('a');
    if (!link) return;

    const hostname = link.hostname;
    const pathname = link.pathname;
    const isReaderLink = pathname.startsWith('/reader');
    const isAnchor = link.getAttribute('href')?.startsWith('#');

    if (isAnchor) return;

    // Open in new tab if:
    // 1. Different hostname (external)
    // 2. Same hostname but NOT a reader link
    if (hostname && (hostname !== window.location.hostname || !isReaderLink)) {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    }
  }, { capture: true, passive: true });
};
