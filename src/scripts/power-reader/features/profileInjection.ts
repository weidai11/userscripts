
import { Logger } from '../utils/logger';

/**
 * Feature: Profile Page Injection
 * Adds a link to the User Archive on user profile pages.
 */

declare const GM_addStyle: (css: string) => void;

/**
 * Extract username/slug from the current URL
 * Supports:
 * - /users/slug
 * - /users/id/slug
 */
const getUsernameFromUrl = (): string | null => {
    const path = window.location.pathname;
    if (!path.startsWith('/users/')) return null;

    const parts = path.split('/');
    // parts[0] = empty, parts[1] = users, parts[2] = slug/id, parts[3] = slug (optional)

    if (parts.length >= 4 && parts[3]) {
        return parts[3]; // /users/id/slug
    }
    if (parts.length >= 3) {
        return parts[2]; // /users/slug
    }
    return null;
};

/**
 * Inject the archive button into the profile actions area
 */
const injectArchiveButton = () => {
    const username = getUsernameFromUrl();
    if (!username) return;

    // Container that holds "Subscribe", "Message", etc.
    // .ProfilePage-mobileProfileActions is used on mobile but sometimes absent on desktop
    const container = document.querySelector('.ProfilePage-mobileProfileActions')
        || document.querySelector('.ProfilePage-header') // Desktop fallback
        || document.querySelector('.UsersProfile-header'); // Legacy fallback

    if (!container) {
        Logger.debug(`Profile Injection: valid container not found for ${username}`);
        return;
    }

    // Check if button already exists
    const existingButton = document.getElementById('pr-profile-archive-button') as HTMLAnchorElement | null;
    const targetHref = `/reader?view=archive&username=${encodeURIComponent(username)}`;

    if (existingButton) {
        // Update href if it changed (e.g. navigation between users)
        if (!existingButton.href.includes(username)) {
            existingButton.href = targetHref;
            Logger.debug(`Profile Injection: Updated button for ${username}`);
        }
        return;
    }

    // Styles
    if (!document.getElementById('pr-profile-injection-styles')) {
        GM_addStyle(`
      #pr-profile-archive-button {
        margin-left: 8px;
        transition: opacity 0.2s;
        text-transform: uppercase;
        font-weight: 600;
        letter-spacing: 0.5px;
        font-size: 0.875rem;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 5px 15px;
        min-width: 64px;
        box-sizing: border-box;
        line-height: 1.75;
        color: inherit;
        text-decoration: none;
        border: 1px solid rgba(0, 0, 0, 0.23);
        border-radius: 4px;
      }
      #pr-profile-archive-button:hover {
        opacity: 0.8;
      }
    `);
        const styleMarker = document.createElement('div');
        styleMarker.id = 'pr-profile-injection-styles';
        styleMarker.style.display = 'none';
        document.head.appendChild(styleMarker);
    }

    const button = document.createElement('a');
    button.id = 'pr-profile-archive-button';
    button.href = targetHref;

    // Mimic the native button style (MUI likely)
    // Converting to a standard look that fits both LW/EA
    button.className = 'MuiButtonBase-root MuiButton-root MuiButton-outlined';

    button.innerHTML = `
    <span class="MuiButton-label">
      ARCHIVE
    </span>
  `;

    container.appendChild(button);
    Logger.debug(`Profile Injection: Button injected for ${username}`);
};

/**
 * Setup mutation observer to handle SPA navigation
 */
export const setupProfileInjection = (): void => {
    let isHydrated = false;

    const detectAndInject = () => {
        // Only run on profile pages
        if (!window.location.pathname.startsWith('/users/')) return;

        if (document.querySelector('.ProfilePage-mobileProfileActions')) {
            isHydrated = true;
            injectArchiveButton();
        }
    };

    if (document.readyState === 'complete') {
        detectAndInject();
    } else {
        window.addEventListener('load', detectAndInject);
    }

    const observer = new MutationObserver(() => {
        // Check if we navigated to a profile page
        if (!window.location.pathname.startsWith('/users/')) return;

        if (!isHydrated) {
            if (document.querySelector('.ProfilePage-mobileProfileActions')) {
                isHydrated = true;
                injectArchiveButton();
            }
            return;
        }

        // Re-inject if removed OR check for update (href changes)
        injectArchiveButton();
    });

    if (document.documentElement) {
        observer.observe(document.documentElement, { childList: true, subtree: true });
    }

    // Cleanup: disconnect observer when navigating away from profile pages
    window.addEventListener('beforeunload', () => observer.disconnect());
};
