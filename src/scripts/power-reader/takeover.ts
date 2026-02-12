/**
 * Nuclear Option: Page takeover for Power Reader
 * Completely replaces the LessWrong page with our custom UI
 */

import { STYLES } from './styles';
import { Logger } from './utils/logger';
import { getState } from './state';

declare const __APP_VERSION__: string;

/**
 * Execute the nuclear option to take over the page
 */
export const executeTakeover = (): void => {
  // Expose state for tests
  (window as any).getState = getState;

  // 1. Stop all site processing immediately
  window.stop();

  // 2. Block dynamically added scripts
  const originalCreateElement = document.createElement.bind(document);
  document.createElement = function (tagName: string, options?: ElementCreationOptions): HTMLElement {
    if (tagName.toLowerCase() === 'script') {
      Logger.warn('Blocking script creation attempt');
      // Return a dummy div instead of a script to prevent errors in site code but block execution
      return originalCreateElement('div');
    }
    return originalCreateElement(tagName, options);
  };

  const scriptObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof HTMLScriptElement) {
          node.remove();
        }
      });
    });
  });
  scriptObserver.observe(document.documentElement, { childList: true, subtree: true });

  Logger.info('Initializing...');

  // 3. Protection observer - Re-inject UI if site code attempts to clear it
  const protectionObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        const root = document.getElementById('power-reader-root');
        // If body exists but our root is gone, re-build
        if (document.body && !root && !document.querySelector('.pr-loading')) {
          Logger.warn('UI cleared by site code! Re-injecting...');
          rebuildDocument();
        }
      }
    }
  });
  protectionObserver.observe(document.documentElement, { childList: true, subtree: true });
};

/**
 * Rebuild the DOM with our custom structure
 */
export const rebuildDocument = (): void => {
  const html = `
    <head>
      <meta charset="UTF-8">
      <title>Less Wrong: Power Reader v${__APP_VERSION__}</title>
      <style>${STYLES}</style>
    </head>
    <body>
      <div id="power-reader-root">
        <div class="pr-loading">Loading Power Reader...</div>
      </div>
      <div id="pr-sticky-header" class="pr-sticky-header"></div>
      <div id="lw-power-reader-ready-signal" style="display: none;"></div>
    </body>
  `;

  if (document.documentElement) {
    document.documentElement.innerHTML = html;
  } else {
    // Edge case: In some frames or ultra-early states, documentElement might be missing (rare)
    // We can try to write to document directly if open
    Logger.warn('document.documentElement is missing, attempting fallback write');
    document.write(html);
    document.close();
  }
};

/**
 * Signal that the reader is ready (for tests and other consumers)
 */
export const signalReady = (): void => {
  const signal = document.getElementById('lw-power-reader-ready-signal');
  if (signal) {
    signal.style.display = 'block';
  }
  // Also set global flag per SPEC
  (window as any).__LW_POWER_READER_READY__ = true;
};

/**
 * Get the root element for the reader UI
 */
export const getRoot = (): HTMLElement | null => {
  return document.getElementById('power-reader-root');
};
