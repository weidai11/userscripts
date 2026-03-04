import type { ReaderState } from '../state';
import { Z_INDEX_TOP_LAYER } from '../config';
import { handleSendToAIStudio, handleSendToArenaMax } from './aiProviders';
import { resetForumAICache, type StatusReporter } from './aiProviderPopupCore';
import { resolveForumAITargetFromElement, type ForumResolvedAITarget } from './forumAITargetResolver';
import { Logger } from '../utils/logger';

declare const GM_addStyle: ((css: string) => void) | undefined;

const FORUM_STYLE_MARKER_ID = 'pr-forum-ai-hotkeys-style-marker';
const FORUM_STATUS_HOST_ID = 'pr-forum-ai-status-host';
const FORUM_STATUS_ID = 'pr-forum-ai-status';
const STATUS_AUTO_CLEAR_MS = 7000;
const LOCK_SAFETY_TIMEOUT_MS = 15000;
const FALLBACK_TARGET_MAX_AGE_MS = 120;
const SELECTION_CONTEXT_SELECTOR = [
  '.comments-node[id]',
  '.CommentFrame-node[id]',
  '.LWPostsItem-postsItem',
  '.PostsItem2-root',
  '.PostsItem-root',
  '#postBody',
  '.PostsPage-postsPage',
  '.PostsPage-post',
].join(', ');
const INTERACTIVE_TARGET_SELECTOR = [
  'button',
  'a[href]',
  'summary',
  'details',
  '[role="button"]',
  '[role="menuitem"]',
  '[role="option"]',
  '[role="listbox"]',
  '[role="dialog"]',
  '[aria-haspopup="menu"]',
].join(', ');

let forumHotkeysAbort: AbortController | null = null;
let lastMousePos = { x: 0, y: 0 };
let hasPointerHistory = false;
let lastResolvedTarget: { target: ForumResolvedAITarget; ts: number } | null = null;
let inFlight = false;
let inFlightToken = 0;
let inFlightTimeout: number | null = null;

class ForumToastStatusReporter implements StatusReporter {
  private clearTimeout: number | null = null;
  private version = 0;

  setMessage(message: string, color?: string): void {
    const statusEl = this.ensureStatusElement();
    if (!statusEl) return;

    this.version += 1;
    const currentVersion = this.version;

    statusEl.textContent = message;
    if (color) {
      statusEl.style.borderColor = color;
      statusEl.style.color = color;
    } else {
      statusEl.style.borderColor = '#333';
      statusEl.style.color = '#222';
    }
    statusEl.style.opacity = '1';

    if (this.clearTimeout) {
      window.clearTimeout(this.clearTimeout);
    }
    this.clearTimeout = window.setTimeout(() => {
      if (this.version === currentVersion) {
        this.clear();
      }
    }, STATUS_AUTO_CLEAR_MS);
  }

  clear(): void {
    const statusEl = document.getElementById(FORUM_STATUS_ID) as HTMLElement | null;
    if (!statusEl) return;
    statusEl.style.opacity = '0';
    this.clearTimeout = null;
  }

  private ensureStatusElement(): HTMLElement | null {
    const host = this.ensureHost();
    if (!host) return null;

    let statusEl = document.getElementById(FORUM_STATUS_ID) as HTMLElement | null;
    if (!statusEl) {
      statusEl = document.createElement('div');
      statusEl.id = FORUM_STATUS_ID;
      statusEl.style.pointerEvents = 'none';
      statusEl.style.padding = '8px 10px';
      statusEl.style.background = '#fff';
      statusEl.style.border = '1px solid #333';
      statusEl.style.borderRadius = '8px';
      statusEl.style.boxShadow = '0 8px 24px rgba(0,0,0,0.25)';
      statusEl.style.fontSize = '12px';
      statusEl.style.fontWeight = '600';
      statusEl.style.lineHeight = '1.35';
      statusEl.style.maxWidth = 'min(520px, 92vw)';
      statusEl.style.opacity = '0';
      statusEl.style.transition = 'opacity 120ms ease-out';
      host.appendChild(statusEl);
    }

    return statusEl;
  }

  private ensureHost(): HTMLElement | null {
    if (!document.body) return null;

    let host = document.getElementById(FORUM_STATUS_HOST_ID) as HTMLElement | null;
    if (!host) {
      host = document.createElement('div');
      host.id = FORUM_STATUS_HOST_ID;
      host.style.position = 'fixed';
      host.style.top = '12px';
      host.style.right = '12px';
      host.style.zIndex = String(Z_INDEX_TOP_LAYER);
      host.style.pointerEvents = 'none';
      document.body.appendChild(host);
    }

    return host;
  }
}

const forumStatusReporter = new ForumToastStatusReporter();

const getTargetElement = (target: EventTarget | null): HTMLElement | null => {
  if (!target) return null;
  if (target instanceof HTMLElement) return target;
  if (target instanceof Element) return target.parentElement;
  if (target instanceof Node) return target.parentElement;
  return null;
};

const isEditableTarget = (target: EventTarget | null): boolean => {
  const el = getTargetElement(target);
  if (!el) return false;
  const role = el.getAttribute('role');
  return el.tagName === 'INPUT'
    || el.tagName === 'TEXTAREA'
    || el.tagName === 'SELECT'
    || el.isContentEditable
    || role === 'textbox'
    || role === 'combobox';
};

const isInteractiveTarget = (target: EventTarget | null): boolean => {
  const el = getTargetElement(target);
  if (!el) return false;
  return !!el.closest(INTERACTIVE_TARGET_SELECTOR);
};

const isPointerOnInteractiveElement = (): boolean => {
  if (!hasPointerHistory) return false;
  const elUnderPointer = document.elementFromPoint(lastMousePos.x, lastMousePos.y);
  if (!(elUnderPointer instanceof Element)) return false;
  return !!elUnderPointer.closest(INTERACTIVE_TARGET_SELECTOR);
};

const hasActiveSelectionOutside = (containerEl: HTMLElement | null): boolean => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return false;
  if (!selection.toString().trim()) return false;
  if (!containerEl) return true;

  for (let i = 0; i < selection.rangeCount; i += 1) {
    const range = selection.getRangeAt(i);
    if (!containerEl.contains(range.commonAncestorContainer)) {
      return true;
    }
  }

  return false;
};

const ensureForumStyles = (): void => {
  if (document.getElementById(FORUM_STYLE_MARKER_ID)) return;
  if (typeof GM_addStyle !== 'function') return;

  GM_addStyle(`
    .being-summarized {
      outline: 2px solid #ff8a00 !important;
      outline-offset: 2px !important;
      background-color: rgba(255, 138, 0, 0.08) !important;
    }
  `);

  const marker = document.createElement('div');
  marker.id = FORUM_STYLE_MARKER_ID;
  marker.style.display = 'none';
  const markerHost = document.head || document.documentElement;
  if (!markerHost) return;
  markerHost.appendChild(marker);
};

const clearAllHighlights = (): void => {
  document.querySelectorAll('.being-summarized').forEach((el) => el.classList.remove('being-summarized'));
};

const clearInFlightLock = (token: number): void => {
  if (token !== inFlightToken) return;
  inFlight = false;
  if (inFlightTimeout) {
    window.clearTimeout(inFlightTimeout);
    inFlightTimeout = null;
  }
};

const resolveTargetAtPointer = (): ForumResolvedAITarget | null => {
  if (hasPointerHistory) {
    const elUnderPointer = document.elementFromPoint(lastMousePos.x, lastMousePos.y);
    const pointerResolved = resolveForumAITargetFromElement(elUnderPointer);
    if (pointerResolved) {
      lastResolvedTarget = { target: pointerResolved, ts: Date.now() };
      return pointerResolved;
    }
  }

  const activeElementResolved = resolveForumAITargetFromElement(document.activeElement);
  if (activeElementResolved) {
    lastResolvedTarget = { target: activeElementResolved, ts: Date.now() };
    return activeElementResolved;
  }

  if (lastResolvedTarget && Date.now() - lastResolvedTarget.ts <= FALLBACK_TARGET_MAX_AGE_MS) {
    return lastResolvedTarget.target;
  }

  return null;
};

const getSelectionContext = (resolved: ForumResolvedAITarget): HTMLElement | null => {
  if (resolved.containerEl) return resolved.containerEl;
  if (resolved.sourceEl) {
    return (resolved.sourceEl.closest(SELECTION_CONTEXT_SELECTOR) as HTMLElement | null) || resolved.sourceEl;
  }
  return null;
};

const startNavigationAbortWatcher = (
  expectedHref: string,
  abortController: AbortController
): (() => void) => {
  const onAbort = () => {
    window.clearInterval(timer);
  };
  const timer = window.setInterval(() => {
    if (window.location.href !== expectedHref && !abortController.signal.aborted) {
      Logger.debug('[Forum AI Hotkeys] URL changed during in-flight send; aborting operation.');
      abortController.abort();
    }
  }, 120);
  abortController.signal.addEventListener('abort', onAbort, { once: true });

  return () => {
    window.clearInterval(timer);
    abortController.signal.removeEventListener('abort', onAbort);
  };
};

export const setupForumAIHotkeys = (state: ReaderState): void => {
  if (forumHotkeysAbort) {
    forumHotkeysAbort.abort();
  }
  resetForumAICache(state);

  clearAllHighlights();
  hasPointerHistory = false;
  lastResolvedTarget = null;
  inFlight = false;
  inFlightToken += 1;
  if (inFlightTimeout) {
    window.clearTimeout(inFlightTimeout);
    inFlightTimeout = null;
  }

  forumHotkeysAbort = new AbortController();
  const signal = forumHotkeysAbort.signal;

  ensureForumStyles();

  document.addEventListener('mousemove', (event: MouseEvent) => {
    hasPointerHistory = true;
    lastMousePos.x = event.clientX;
    lastMousePos.y = event.clientY;
  }, { passive: true, signal });

  document.addEventListener('mouseover', (event: MouseEvent) => {
    const resolved = resolveForumAITargetFromElement(event.target);
    if (resolved) {
      lastResolvedTarget = { target: resolved, ts: Date.now() };
    }
  }, { signal });

  document.addEventListener('mouseout', (event: MouseEvent) => {
    if (!lastResolvedTarget) return;
    const related = event.relatedTarget as Element | null;
    if (!related) {
      lastResolvedTarget = null;
      return;
    }

    const currentContainer = lastResolvedTarget.target.containerEl || lastResolvedTarget.target.sourceEl;
    if (currentContainer && currentContainer.contains(related)) {
      return;
    }

    const resolvedRelated = resolveForumAITargetFromElement(related);
    if (!resolvedRelated || resolvedRelated.itemId !== lastResolvedTarget.target.itemId || resolvedRelated.isPost !== lastResolvedTarget.target.isPost) {
      lastResolvedTarget = null;
    }
  }, { signal });

  document.addEventListener('keydown', async (event: KeyboardEvent) => {
    if (event.ctrlKey || event.altKey || event.metaKey) return;
    if (event.repeat) return;
    if (event.defaultPrevented) return;
    if (isEditableTarget(event.target)) return;
    if (isInteractiveTarget(event.target) || isInteractiveTarget(document.activeElement)) return;

    const key = event.key.toLowerCase();
    const isAIHotkey = key === 'g' || key === 'm';
    if (!isAIHotkey) return;
    if (isPointerOnInteractiveElement()) return;

    const resolved = resolveTargetAtPointer();
    if (!resolved) return;

    const selectionContainer = getSelectionContext(resolved);
    if (hasActiveSelectionOutside(selectionContainer)) {
      return;
    }

    if (inFlight) {
      Logger.debug('[Forum AI Hotkeys] Ignoring keypress while another send is in progress.');
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    inFlight = true;
    const token = ++inFlightToken;
    const sendAbort = new AbortController();
    const expectedHref = window.location.href;
    const stopNavigationWatcher = startNavigationAbortWatcher(expectedHref, sendAbort);
    const onSetupAbort = () => {
      sendAbort.abort();
    };
    signal.addEventListener('abort', onSetupAbort, { once: true });
    if (inFlightTimeout) {
      window.clearTimeout(inFlightTimeout);
      inFlightTimeout = null;
    }
    inFlightTimeout = window.setTimeout(() => {
      if (token !== inFlightToken || sendAbort.signal.aborted) return;
      Logger.warn('[Forum AI Hotkeys] Send timed out. Aborting in-flight operation.');
      forumStatusReporter.setMessage('[AI] Request timed out. Canceled.', '#dc3545');
      sendAbort.abort();
    }, LOCK_SAFETY_TIMEOUT_MS);

    try {
      if (key === 'g') {
        await handleSendToAIStudio(state, event.shiftKey, undefined, resolved, {
          statusReporter: forumStatusReporter,
          abortSignal: sendAbort.signal,
          expectedHref,
        });
      } else {
        await handleSendToArenaMax(state, event.shiftKey, undefined, resolved, {
          statusReporter: forumStatusReporter,
          abortSignal: sendAbort.signal,
          expectedHref,
        });
      }
    } finally {
      stopNavigationWatcher();
      signal.removeEventListener('abort', onSetupAbort);
      clearInFlightLock(token);
    }
  }, { signal });
};
