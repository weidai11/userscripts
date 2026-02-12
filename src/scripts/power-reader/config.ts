/**
 * Configuration constants for Power Reader
 */

declare global {
  interface Window {
    PR_TEST_LIMIT?: number;
  }
}

export const CONFIG = {
  loadMax: (window as any).PR_TEST_LIMIT || 800,
  highlightLastN: 33,
  scrollMarkDelay: (window as any).PR_TEST_SCROLL_DELAY ?? 5000, // 5 seconds
  hoverDelay: 300,
  maxPostHeight: '50vh',
} as const;

export type Config = typeof CONFIG;
