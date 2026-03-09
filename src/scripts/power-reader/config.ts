/**
 * Configuration constants for Power Reader
 */

declare global {
  interface Window {
    PR_TEST_LIMIT?: number;
    PR_TEST_SCROLL_DELAY?: number;
  }
}

export const CONFIG = {
  loadMax: window.PR_TEST_LIMIT ?? 800,
  highlightLastN: 33,
  scrollMarkDelay: window.PR_TEST_SCROLL_DELAY ?? 5000, // 5 seconds
  hoverDelay: 300,
  maxPostHeight: '50vh',
} as const;

export type Config = typeof CONFIG;

export const Z_INDEX_TOP_LAYER = 2147483647;
