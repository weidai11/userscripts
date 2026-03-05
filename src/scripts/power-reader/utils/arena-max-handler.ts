import { Logger } from './logger';
import { consumeAIPayloadKey, getPayloadStorageKeyFromHash } from './aiPayloadStorage';

declare const GM_getValue: (key: string, defaultValue?: any) => any;
declare const GM_deleteValue: (key: string) => void;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const ARENA_INPUT_DETECTED_DELAY_MS = 2000;
const ARENA_SEND_BUTTON_ENABLE_TIMEOUT_MS = 8000;
const ARENA_SEND_BUTTON_POLL_INTERVAL_MS = 200;
const ARENA_FALLBACK_PAYLOAD_KEY = 'arena_max_prompt_payload';

const ARENA_TEXTAREA_PRIMARY_SELECTORS = [
    "textarea[name='message']",
    "textarea[placeholder='Ask anything...']",
    "textarea[placeholder^='Ask anything']"
].join(', ');

const ARENA_TEXTAREA_CLASS_FALLBACK_SELECTORS = [
    "textarea[class*='w-full'][class*='resize-none']",
    "textarea[class*='bg-surface-secondary'][class*='resize-none']",
    "textarea[class*='box-border'][class*='resize-none']"
].join(', ');

const NEGATIVE_BUTTON_KEYWORDS = ['dismiss', 'close', 'cancel', 'banner', 'skip', 'later'];

function getButtonSignals(btn: HTMLButtonElement): string {
    return [
        btn.getAttribute('aria-label') || '',
        btn.getAttribute('title') || '',
        btn.textContent || ''
    ].join(' ').toLowerCase();
}

function hasNegativeButtonSignal(btn: HTMLButtonElement): boolean {
    const signals = getButtonSignals(btn);
    return NEGATIVE_BUTTON_KEYWORDS.some((kw) => signals.includes(kw));
}

function hasSendWordSignal(btn: HTMLButtonElement): boolean {
    const signals = getButtonSignals(btn);
    return /\b(send|submit|run)\b/.test(signals);
}

function hasArrowLikeSendIcon(btn: HTMLButtonElement): boolean {
    if (btn.querySelector('svg.lucide-arrow-up, svg.lucide-send, svg[class*="arrow-up"], svg[class*="send"]')) {
        return true;
    }
    const paths = Array.from(btn.querySelectorAll('svg path'));
    return paths.some((path) => {
        const d = (path.getAttribute('d') || '').replace(/[\s,]+/g, '').toUpperCase();
        // Common Arena send icon path: M3 12L21 12 ... L12.5 3.5 ... L12.5 20.5
        return d.includes('M312L2112') && d.includes('L12.53.5') && d.includes('L12.520.5');
    });
}

function hasPositiveSendSignal(btn: HTMLButtonElement): boolean {
    return btn.type === 'submit' || hasSendWordSignal(btn) || hasArrowLikeSendIcon(btn);
}

function getSendButtonScore(btn: HTMLButtonElement, textarea: HTMLTextAreaElement): number {
    if (hasNegativeButtonSignal(btn)) return -10_000;
    if (!hasPositiveSendSignal(btn)) return -5_000;

    let score = 0;
    const hasSendWord = hasSendWordSignal(btn);
    const hasArrowIcon = hasArrowLikeSendIcon(btn);
    const sameForm = textarea.closest('form') !== null && textarea.closest('form') === btn.closest('form');

    if (sameForm) score += 120;
    if (hasSendWord) score += 120;
    if (hasArrowIcon) score += 100;
    if (btn.type === 'submit') score += 80;

    return score;
}

function isArenaSendButton(btn: HTMLButtonElement): boolean {
    return !hasNegativeButtonSignal(btn) && hasPositiveSendSignal(btn);
}

function isInteractableTextarea(el: Element): el is HTMLTextAreaElement {
    if (!(el instanceof HTMLTextAreaElement)) return false;
    if (el.disabled || el.readOnly) return false;
    if (el.getAttribute('aria-hidden') === 'true') return false;
    return true;
}

function isVisibleElement(el: HTMLElement): boolean {
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    return true;
}

function isEnabledAndVisibleButton(btn: HTMLButtonElement): boolean {
    return !btn.disabled && isVisibleElement(btn);
}

function hasNearbySendButton(textarea: HTMLTextAreaElement): boolean {
    const container = textarea.closest('form') || textarea.parentElement?.parentElement || textarea.parentElement;
    if (!container) return false;
    const buttons = Array.from(container.querySelectorAll('button')) as HTMLButtonElement[];
    return buttons.some((btn) => isArenaSendButton(btn));
}

function getElementCenter(el: HTMLElement): { x: number; y: number } {
    const rect = el.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function getElementDistance(a: HTMLElement, b: HTMLElement): number {
    const ca = getElementCenter(a);
    const cb = getElementCenter(b);
    return Math.hypot(ca.x - cb.x, ca.y - cb.y);
}

function getNearbyButtonCandidates(textarea: HTMLTextAreaElement): HTMLButtonElement[] {
    const containers: Element[] = [];
    const form = textarea.closest('form');
    if (form) containers.push(form);

    let ancestor: Element | null = textarea.parentElement;
    let steps = 0;
    while (ancestor && steps < 5) {
        containers.push(ancestor);
        ancestor = ancestor.parentElement;
        steps += 1;
    }

    const dedupButtons = new Set<HTMLButtonElement>();
    for (const container of containers) {
        const buttons = Array.from(container.querySelectorAll('button'))
            .filter((el): el is HTMLButtonElement => el instanceof HTMLButtonElement);
        for (const btn of buttons) dedupButtons.add(btn);
    }

    return Array.from(dedupButtons).filter(isArenaSendButton);
}

function findArenaTextarea(): HTMLTextAreaElement | null {
    const primaryCandidates = Array.from(document.querySelectorAll(ARENA_TEXTAREA_PRIMARY_SELECTORS))
        .filter(isInteractableTextarea);
    const primaryWithSend = primaryCandidates.find(hasNearbySendButton);
    if (primaryWithSend) return primaryWithSend;
    const primaryVisible = primaryCandidates.find((el) => isVisibleElement(el));
    if (primaryVisible) return primaryVisible;
    if (primaryCandidates.length > 0) return primaryCandidates[0];

    const fallbackCandidates = Array.from(document.querySelectorAll(ARENA_TEXTAREA_CLASS_FALLBACK_SELECTORS))
        .filter(isInteractableTextarea);
    const fallbackWithSend = fallbackCandidates.find((el) => hasNearbySendButton(el) && isVisibleElement(el));
    if (fallbackWithSend) return fallbackWithSend;
    const fallbackVisible = fallbackCandidates.find((el) => isVisibleElement(el));
    if (fallbackVisible) return fallbackVisible;
    return fallbackCandidates.find(hasNearbySendButton) ?? fallbackCandidates[0] ?? null;
}

async function waitForArenaTextarea(timeout: number = 30000): Promise<HTMLTextAreaElement> {
    return new Promise((resolve, reject) => {
        const hasLoginGate = () =>
            window.location.href.includes('arena.ai/login') ||
            document.body?.innerText.includes('Sign in');

        const check = () => {
            if (hasLoginGate()) return 'LOGIN_REQUIRED';
            return findArenaTextarea();
        };

        let settled = false;
        let timeoutId = 0;
        let pollId = 0;
        const observer = new MutationObserver(() => {
            evaluate();
        });

        const cleanup = () => {
            observer.disconnect();
            if (timeoutId) window.clearTimeout(timeoutId);
            if (pollId) window.clearInterval(pollId);
        };

        const resolveOnce = (el: HTMLTextAreaElement) => {
            if (settled) return;
            settled = true;
            cleanup();
            resolve(el);
        };

        const rejectOnce = (message: string) => {
            if (settled) return;
            settled = true;
            cleanup();
            reject(new Error(message));
        };

        const evaluate = () => {
            const el = check();
            if (el === 'LOGIN_REQUIRED') {
                rejectOnce('Login Required');
                return;
            }
            if (el) {
                resolveOnce(el);
            }
        };

        observer.observe(document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'style', 'hidden', 'aria-hidden', 'disabled', 'readonly', 'placeholder']
        });
        pollId = window.setInterval(evaluate, 250);
        timeoutId = window.setTimeout(() => {
            rejectOnce(`Timeout waiting for Arena textarea: ${ARENA_TEXTAREA_PRIMARY_SELECTORS} || ${ARENA_TEXTAREA_CLASS_FALLBACK_SELECTORS}`);
        }, timeout);

        evaluate();
    });
}

function setTextareaValue(textarea: HTMLTextAreaElement, payload: string): void {
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
    if (nativeSetter) {
        nativeSetter.call(textarea, payload);
    } else {
        textarea.value = payload;
    }
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));
    textarea.focus();
    textarea.setSelectionRange(0, 0);
}

function findSendButtonNearTextarea(textarea: HTMLTextAreaElement): HTMLButtonElement | null {
    const candidates = getNearbyButtonCandidates(textarea)
        .filter(isEnabledAndVisibleButton)
        .filter((btn) => getSendButtonScore(btn, textarea) > 0);
    if (candidates.length === 0) return null;

    let best: HTMLButtonElement | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const btn of candidates) {
        const score = getSendButtonScore(btn, textarea);
        const distance = getElementDistance(textarea, btn);
        if (score > bestScore || (score === bestScore && distance < bestDistance)) {
            best = btn;
            bestScore = score;
            bestDistance = distance;
        }
    }
    return bestScore > 0 ? best : null;
}

function clickSendButton(button: HTMLButtonElement): void {
    button.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    button.focus();
    if (typeof PointerEvent !== 'undefined') {
        button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        button.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    }
    button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    button.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    button.click();
}

async function injectPrompt(payload: string): Promise<HTMLTextAreaElement> {
    const textarea = await waitForArenaTextarea();
    await sleep(ARENA_INPUT_DETECTED_DELAY_MS);
    setTextareaValue(textarea, payload);
    return textarea;
}

async function automateRun(textarea: HTMLTextAreaElement) {
    const targetTextarea = findArenaTextarea() ?? textarea;

    const runBtn = findSendButtonNearTextarea(targetTextarea);
    if (runBtn && !runBtn.disabled) {
        clickSendButton(runBtn);
        return;
    }
    const deadline = Date.now() + ARENA_SEND_BUTTON_ENABLE_TIMEOUT_MS;
    while (Date.now() < deadline) {
        await sleep(ARENA_SEND_BUTTON_POLL_INTERVAL_MS);
        const latestTextarea = findArenaTextarea() ?? targetTextarea;
        const enabledBtn = findSendButtonNearTextarea(latestTextarea);
        if (enabledBtn && !enabledBtn.disabled) {
            clickSendButton(enabledBtn);
            return;
        }
    }
    Logger.warn('Arena Max: send button did not enable in time; using non-click fallbacks');

    const form = targetTextarea.closest('form');
    if (form) {
        if (typeof form.requestSubmit === 'function') {
            form.requestSubmit();
            return;
        }
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        return;
    }
    Logger.warn('Arena Max: no form ancestor for requestSubmit fallback');

    targetTextarea.focus();

    const dispatchEnterSequence = (mods: Pick<KeyboardEventInit, 'ctrlKey' | 'metaKey'> = {}) => {
        const eventInit: KeyboardEventInit = {
            key: 'Enter',
            code: 'Enter',
            charCode: 13,
            keyCode: 13,
            bubbles: true,
            ...mods
        };
        targetTextarea.dispatchEvent(new KeyboardEvent('keydown', eventInit));
        targetTextarea.dispatchEvent(new KeyboardEvent('keypress', eventInit));
        targetTextarea.dispatchEvent(new KeyboardEvent('keyup', eventInit));
    };

    dispatchEnterSequence();
    dispatchEnterSequence({ ctrlKey: true, metaKey: false });
    dispatchEnterSequence({ ctrlKey: false, metaKey: true });
}

/**
 * Main handler for Arena Max automation.
 */
export async function handleArenaMax() {
    const payloadStorageKey = getPayloadStorageKeyFromHash();
    const storageKey = payloadStorageKey || ARENA_FALLBACK_PAYLOAD_KEY;
    const payload = GM_getValue(storageKey);
    if (!payload) {
        if (payloadStorageKey) {
            Logger.warn(`Arena Max: Missing payload for key "${payloadStorageKey}".`);
        }
        return;
    }

    Logger.info('Arena Max: Automation triggered.');

    try {
        const textarea = await injectPrompt(payload);
        await automateRun(textarea);

        Logger.info('Arena Max: Prompt submitted. Continue in this tab.');
    } catch (error) {
        Logger.error('Arena Max: Automation failed', error);
    } finally {
        if (typeof GM_deleteValue === 'function') {
            GM_deleteValue(storageKey);
        }
        if (payloadStorageKey) {
            consumeAIPayloadKey(payloadStorageKey);
        }
    }
}
