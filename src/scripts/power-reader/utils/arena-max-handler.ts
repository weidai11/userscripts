import { Logger } from './logger';
import { consumeAIPayloadKey, getPayloadStorageKeyFromHash } from './aiPayloadStorage';

declare const GM_getValue: (key: string, defaultValue?: any) => any;
declare const GM_deleteValue: (key: string) => void;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const ARENA_PROMPT_REINJECT_TIMEOUT_MS = 45000;
const ARENA_PROMPT_SETTLE_DELAY_MS = 120;
const ARENA_PROMPT_RECHECK_DELAY_MS = 200;
const ARENA_SEND_ATTEMPTS = 3;
const ARENA_SEND_ATTEMPT_TIMEOUT_MS = 12000;
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

const normalizeText = (value: string): string =>
    value.replace(/\s+/g, ' ').trim();

function isArenaSendButton(btn: HTMLButtonElement): boolean {
    return (
        btn.type === 'submit' ||
        (btn.getAttribute('aria-label') || '').toLowerCase().includes('send') ||
        !!btn.querySelector('svg.lucide-arrow-up, svg.lucide-send')
    );
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

function hasNearbySendButton(textarea: HTMLTextAreaElement): boolean {
    const container = textarea.closest('form') || textarea.parentElement?.parentElement || textarea.parentElement;
    if (!container) return false;
    const buttons = Array.from(container.querySelectorAll('button')) as HTMLButtonElement[];
    return buttons.some((btn) => isArenaSendButton(btn));
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

function getPayloadProbe(payload: string): string {
    return normalizeText(payload).slice(0, 180);
}

function textareaContainsProbe(textarea: HTMLTextAreaElement | null, payloadProbe: string): boolean {
    if (!textarea) return false;
    const value = normalizeText(textarea.value || '');
    if (!payloadProbe) return value.length > 0;
    return value.includes(payloadProbe);
}

function findSendButtonNearTextarea(textarea: HTMLTextAreaElement): HTMLButtonElement | null {
    const container = textarea.closest('form') || textarea.parentElement?.parentElement || textarea.parentElement;
    if (!container) return null;
    const buttons = Array.from(container.querySelectorAll('button')) as HTMLButtonElement[];
    return buttons.find((btn) => isArenaSendButton(btn)) ?? null;
}

async function ensurePromptPersisted(payload: string, timeoutMs: number = ARENA_PROMPT_REINJECT_TIMEOUT_MS): Promise<HTMLTextAreaElement> {
    const deadline = Date.now() + timeoutMs;
    const payloadProbe = getPayloadProbe(payload);
    let lastIssue = 'unknown';

    while (Date.now() < deadline) {
        try {
            const remaining = Math.max(250, deadline - Date.now());
            const textarea = await waitForArenaTextarea(Math.min(4000, remaining));
            setTextareaValue(textarea, payload);
            await sleep(ARENA_PROMPT_SETTLE_DELAY_MS);
            const current = findArenaTextarea() ?? textarea;
            if (textareaContainsProbe(current, payloadProbe)) {
                return current;
            }
            lastIssue = 'composer reset after injection';
        } catch (error) {
            lastIssue = error instanceof Error ? error.message : String(error);
        }
        await sleep(ARENA_PROMPT_RECHECK_DELAY_MS);
    }

    throw new Error(`Prompt injection did not persist (${lastIssue})`);
}

async function injectPrompt(payload: string) {
    await ensurePromptPersisted(payload);
}

async function automateRun(payload: string) {
    const payloadProbe = getPayloadProbe(payload);
    let lastIssue = 'send button unavailable';

    for (let attempt = 1; attempt <= ARENA_SEND_ATTEMPTS; attempt++) {
        const textarea = await ensurePromptPersisted(payload, ARENA_SEND_ATTEMPT_TIMEOUT_MS);
        const runBtn = findSendButtonNearTextarea(textarea);

        if (runBtn && !runBtn.disabled) {
            runBtn.focus();
            runBtn.click();
            lastIssue = 'send button click did not produce submission signal';
        } else {
            textarea.dispatchEvent(new KeyboardEvent('keydown', {
                key: 'Enter',
                code: 'Enter',
                charCode: 13,
                keyCode: 13,
                bubbles: true,
                ctrlKey: true,
                metaKey: true
            }));
            lastIssue = runBtn ? 'send button disabled' : 'send button missing';
        }

        await sleep(350);

        const current = findArenaTextarea();
        const hasStopIcon = document.querySelector('svg.lucide-square') !== null;
        const promptStillPresent = textareaContainsProbe(current, payloadProbe);
        const submissionStarted = hasStopIcon || !promptStillPresent;
        if (submissionStarted) return;

        Logger.warn(`Arena Max: Submit attempt ${attempt} did not take, retrying...`);
    }

    throw new Error(`Failed to submit prompt (${lastIssue})`);
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
        await injectPrompt(payload);

        await automateRun(payload);

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
