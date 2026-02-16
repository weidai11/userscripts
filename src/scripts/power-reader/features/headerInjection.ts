/**
 * Feature: Unified Header Injection
 * Injects Power Reader link (always) and User Archive link (on profile pages) into the forum header.
 */

import { Logger } from '../utils/logger';

declare const GM_addStyle: (css: string) => void;

/**
 * Extract username/slug from the current URL
 * Supports: /users/slug and /users/id/slug
 */
const getUsernameFromUrl = (): string | null => {
  const path = window.location.pathname;
  if (!path.startsWith('/users/')) return null;

  const parts = path.split('/');
  if (parts.length >= 4 && parts[3]) {
    return parts[3];
  }
  if (parts.length >= 3) {
    return parts[2];
  }
  return null;
};

/**
 * Add shared styles once
 */
const addSharedStyles = (): void => {
  if (document.getElementById('pr-header-injection-styles')) return;

  GM_addStyle(`
    #pr-header-links-container {
      display: inline-flex;
      align-items: center;
      margin-right: 12px;
    }
    #pr-header-links-container a {
      transition: opacity 0.2s !important;
      text-decoration: none !important;
    }
    #pr-header-links-container a:hover {
      opacity: 0.7 !important;
    }
    #pr-archive-link {
      margin-left: 8px;
    }
  `);

  const styleMarker = document.createElement('div');
  styleMarker.id = 'pr-header-injection-styles';
  styleMarker.style.display = 'none';
  document.head.appendChild(styleMarker);
};

/**
 * Create the Reader link (always visible)
 */
const createReaderLink = (): HTMLAnchorElement => {
  const link = document.createElement('a');
  link.id = 'pr-reader-link';
  link.href = '/reader';
  link.className = 'MuiButtonBase-root MuiButton-root MuiButton-text UsersMenu-userButtonRoot';
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

  return link;
};

/**
 * Create the Archive link (profile pages only)
 */
const createArchiveLink = (username: string): HTMLAnchorElement => {
  const link = document.createElement('a');
  link.id = 'pr-archive-link';
  link.href = `/reader?view=archive&username=${encodeURIComponent(username)}`;
  link.className = 'MuiButtonBase-root MuiButton-root MuiButton-text UsersMenu-userButtonRoot';
  link.style.color = 'inherit';
  link.style.display = 'inline-flex';
  link.style.alignItems = 'center';

  link.innerHTML = `
    <span class="MuiButton-label">
      <span class="UsersMenu-userButtonContents" style="font-weight: 500;">
        User Archive
      </span>
    </span>
  `;

  return link;
};

/**
 * Inject links into the forum header
 */
const injectLinks = (): void => {
  const container = document.querySelector('.Header-rightHeaderItems');
  if (!container) return;

  // Get or create container
  let linksContainer = document.getElementById('pr-header-links-container');

  if (!linksContainer) {
    addSharedStyles();
    linksContainer = document.createElement('div');
    linksContainer.id = 'pr-header-links-container';

    // Insert after search bar or at start of container
    const searchBar = container.querySelector('.SearchBar-root');
    if (searchBar) {
      searchBar.after(linksContainer);
    } else {
      container.prepend(linksContainer);
    }
  }

  // Ensure Reader link (idempotent)
  if (!document.getElementById('pr-reader-link')) {
    linksContainer.appendChild(createReaderLink());
  }

  // Handle Archive link
  const username = getUsernameFromUrl();
  const existingArchiveLink = document.getElementById('pr-archive-link');

  if (username) {
    if (!existingArchiveLink) {
      linksContainer.appendChild(createArchiveLink(username));
      Logger.debug(`Header Injection: Added Archive link for ${username}`);
    } else {
      // Update href if username changed (e.g. navigation between profiles)
      const expectedHref = `/reader?view=archive&username=${encodeURIComponent(username)}`;
      if (existingArchiveLink.getAttribute('href') !== expectedHref) {
        existingArchiveLink.setAttribute('href', expectedHref);
      }
    }
  } else {
    if (existingArchiveLink) {
      existingArchiveLink.remove();
      Logger.debug('Header Injection: Removed Archive link');
    }
  }
};

/**
 * Setup mutation observer to ensure links persist across page loads.
 * Uses hydration detection to avoid issues with React SSR.
 */
export const setupHeaderInjection = (): void => {
  let isHydrated = false;

  const detectHydration = () => {
    if (document.querySelector('.Header-rightHeaderItems')) {
      isHydrated = true;
      injectLinks();
    }
  };

  if (document.readyState === 'complete') {
    detectHydration();
  } else {
    window.addEventListener('load', detectHydration);
  }

  const observer = new MutationObserver(() => {
    if (!isHydrated) {
      if (document.querySelector('.Header-rightHeaderItems')) {
        isHydrated = true;
        injectLinks();
      }
      return;
    }

    // Re-inject or update links if anything changes in the header
    // We check efficiently if the container is missing OR if we just need to update (handled by injectLinks)
    if (document.querySelector('.Header-rightHeaderItems')) {
      injectLinks();
    }
  });

  if (document.documentElement) {
    observer.observe(document.documentElement, { childList: true, subtree: true });
  } else {
    const earlyCheck = setInterval(() => {
      if (document.documentElement) {
        clearInterval(earlyCheck);
        observer.observe(document.documentElement, { childList: true, subtree: true });
      }
    }, 100);
  }

  window.addEventListener('beforeunload', () => observer.disconnect());
};
