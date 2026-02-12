/**
 * Feature: Header Injection
 * Adds a link to /reader in the main site header on all forum pages.
 */

import { Logger } from '../utils/logger';

declare const GM_addStyle: (css: string) => void;

/**
 * Inject the link to /reader into the forum header
 */
export const injectReaderLink = (): void => {
  const container = document.querySelector('.Header-rightHeaderItems');
  if (!container) return;

  // Avoid duplicate injection
  if (document.getElementById('pr-header-link')) return;

  // Add hover effect style once
  if (!document.getElementById('pr-header-injection-styles')) {
    GM_addStyle(`
      #pr-header-link {
        transition: opacity 0.2s !important;
      }
      #pr-header-link:hover {
        opacity: 0.7 !important;
        text-decoration: none !important;
      }
    `);
    const styleMarker = document.createElement('div');
    styleMarker.id = 'pr-header-injection-styles';
    styleMarker.style.display = 'none';
    document.head.appendChild(styleMarker);
  }

  const link = document.createElement('a');
  link.id = 'pr-header-link';
  link.href = '/reader';
  // Use Mui classes for look & feel
  link.className = 'MuiButtonBase-root MuiButton-root MuiButton-text UsersMenu-userButtonRoot';
  link.style.marginRight = '12px';
  link.style.textDecoration = 'none';
  link.style.color = 'inherit';
  link.style.display = 'inline-flex';
  link.style.alignItems = 'center';

  link.innerHTML = `
    <span class="MuiButton-label">
      <span class="UsersMenu-userButtonContents" style="display: flex; align-items: center; gap: 6px;">
        <span style="
          background: #333; 
          color: #fff; 
          padding: 2px 5px; 
          border-radius: 3px; 
          font-size: 0.75em; 
          font-weight: 900;
          letter-spacing: 0.5px;
          line-height: 1;
        ">POWER</span>
        <span style="font-weight: 500;">Reader</span>
      </span>
    </span>
  `;

  // Insert after search bar or at start
  const searchBar = container.querySelector('.SearchBar-root');
  if (searchBar) {
    searchBar.after(link);
  } else {
    container.prepend(link);
  }

  Logger.debug('Header Injection: Reader link injected');
};

/**
 * Setup a mutation observer to ensure the link persists across SPA navigations.
 * Uses a strict guard and delay to avoid React hydration mismatches (Error #418).
 */
export const setupHeaderInjection = (): void => {
  let isHydrated = false;

  // Detect hydration by observing when the header container actually appears in the DOM,
  // rather than relying on a fixed timeout which is fragile on slow connections.
  const detectHydration = () => {
    if (document.querySelector('.Header-rightHeaderItems')) {
      isHydrated = true;
      injectReaderLink();
      return;
    }
    // Header not yet present; a MutationObserver below will catch it when it appears.
  };

  if (document.readyState === 'complete') {
    detectHydration();
  } else {
    window.addEventListener('load', detectHydration);
  }

  const observer = new MutationObserver(() => {
    if (!isHydrated) {
      // Check if the header has appeared (hydration complete)
      if (document.querySelector('.Header-rightHeaderItems')) {
        isHydrated = true;
        injectReaderLink();
      }
      return;
    }
    // Re-inject if link was removed by SPA navigation
    if (!document.getElementById('pr-header-link')) {
      injectReaderLink();
    }
  });

  if (document.documentElement) {
    observer.observe(document.documentElement, { childList: true, subtree: true });
  } else {
    // Extreme early load fallback
    const earlyCheck = setInterval(() => {
      if (document.documentElement) {
        clearInterval(earlyCheck);
        observer.observe(document.documentElement, { childList: true, subtree: true });
      }
    }, 100);
  }
};
