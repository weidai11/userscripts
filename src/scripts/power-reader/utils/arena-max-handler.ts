import { Logger } from './logger';

declare const GM_getValue: (key: string, defaultValue?: any) => any;
declare const GM_setValue: (key: string, value: any) => void;
declare const GM_deleteValue: (key: string) => void;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const ARENA_AUTO_CLOSE_INITIAL_DELAY_MS = 5 * 60 * 1000;
const ARENA_AUTO_CLOSE_RETRY_DELAY_MS = 60 * 1000;
const ARENA_PROMPT_REINJECT_TIMEOUT_MS = 45000;
const ARENA_PROMPT_SETTLE_DELAY_MS = 120;
const ARENA_PROMPT_RECHECK_DELAY_MS = 200;
const ARENA_SEND_ATTEMPTS = 3;
const ARENA_SEND_ATTEMPT_TIMEOUT_MS = 12000;

const ARENA_LIKE_RESPONSE_BUTTON_SELECTOR = "button[aria-label='Like this response']";

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

const ARENA_RESPONSE_SELECTORS = [
    '.prose',
    '.markdown',
    '[data-message-author-role="assistant"]',
    '[data-testid*="assistant"]'
].join(', ');

const normalizeText = (value: string): string =>
    value.replace(/\s+/g, ' ').trim();

const sharedPrefixLength = (a: string, b: string): number => {
    const max = Math.min(a.length, b.length);
    let i = 0;
    while (i < max && a[i] === b[i]) i++;
    return i;
};

function isLikelyPromptEchoText(cleanText: string, submittedPrompt: string): boolean {
    if (!cleanText || !submittedPrompt) return false;
    if (cleanText === submittedPrompt) return true;

    const promptProbe = submittedPrompt.slice(0, 220);
    const textProbe = cleanText.slice(0, 220);
    if (promptProbe.length >= 60 && cleanText.includes(promptProbe)) return true;
    if (textProbe.length >= 60 && submittedPrompt.includes(textProbe)) return true;

    return sharedPrefixLength(cleanText, submittedPrompt) >= 80;
}

const isLikelyUserMessage = (message: HTMLElement | undefined): boolean => {
    if (!message) return false;
    if (message.matches('[data-message-author-role="user"], [data-testid*="user"]')) return true;
    return !!message.closest('[data-message-author-role="user"], [data-testid*="user"]');
};

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

function getLatestArenaResponseCandidate(): HTMLElement | undefined {
    const assistantMessages = Array.from(
        document.querySelectorAll<HTMLElement>('[data-message-author-role="assistant"], [data-testid*="assistant"]')
    );
    if (assistantMessages.length > 0) return assistantMessages[assistantMessages.length - 1];

    const richMessages = Array.from(document.querySelectorAll<HTMLElement>('.markdown, .prose'));
    if (richMessages.length > 0) return richMessages[richMessages.length - 1];

    return undefined;
}

function getAllLikeResponseButtons(): HTMLButtonElement[] {
    return Array.from(document.querySelectorAll<HTMLButtonElement>(ARENA_LIKE_RESPONSE_BUTTON_SELECTOR));
}

function getLatestLikeResponseButton(): HTMLButtonElement | undefined {
    const buttons = getAllLikeResponseButtons();
    if (buttons.length === 0) return undefined;
    buttons.sort((a, b) => b.getBoundingClientRect().top - a.getBoundingClientRect().top);
    return buttons[0];
}

type ArenaResponseCandidateScore = {
    el: HTMLElement;
    score: number;
    verticalGap: number;
    horizontalOverlap: number;
    cleanTextLength: number;
    isUser: boolean;
};

function scoreResponseCandidatesAboveLikeButton(button: HTMLButtonElement): ArenaResponseCandidateScore[] {
    const buttonRect = button.getBoundingClientRect();
    const allCandidates = Array.from(document.querySelectorAll<HTMLElement>(ARENA_RESPONSE_SELECTORS));
    const uniqueCandidates = Array.from(new Set(allCandidates));

    const scored: ArenaResponseCandidateScore[] = [];

    for (const candidate of uniqueCandidates) {
        if (!isVisibleElement(candidate)) continue;
        if (candidate.contains(button) || button.contains(candidate)) continue;

        const rect = candidate.getBoundingClientRect();
        const verticalGap = buttonRect.top - rect.bottom;
        if (verticalGap < -8) continue;

        const horizontalOverlap = Math.max(
            0,
            Math.min(buttonRect.right, rect.right) - Math.max(buttonRect.left, rect.left)
        );
        const cleanTextLength = normalizeText(candidate.textContent || '').length;
        if (cleanTextLength === 0) continue;

        const isUser = isLikelyUserMessage(candidate);
        const score =
            -Math.abs(verticalGap) +
            horizontalOverlap +
            Math.min(cleanTextLength, 500) +
            (isUser ? -1000 : 0);

        scored.push({ el: candidate, score, verticalGap, horizontalOverlap, cleanTextLength, isUser });
    }

    scored.sort((a, b) => b.score - a.score);
    return scored;
}

async function waitForResponse(timeoutMs: number = 180000): Promise<string> {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        let generationStarted = false;
        let sawCandidateResponseNode = false;
        let observedResponseChange = false;

        const submittedPrompt = normalizeText(String(GM_getValue('arena_max_prompt_payload') || ''));

        const getMessageSignature = (message: HTMLElement | undefined): string =>
            message
                ? `${message.childElementCount}:${normalizeText(message.textContent || '')}`
                : '';

        const initialMessages = document.querySelectorAll<HTMLElement>(ARENA_RESPONSE_SELECTORS);
        const initialMessageCount = initialMessages.length;
        const initialLastSignature = getMessageSignature(getLatestArenaResponseCandidate());
        const initialLikeButtonCount = getAllLikeResponseButtons().length;
        const initialLatestLikeButton = getLatestLikeResponseButton();

        const checkCompletion = () => {
            const elapsed = Date.now() - startTime;
            if (elapsed > timeoutMs) {
                const hint = sawCandidateResponseNode
                    ? 'response controls never appeared'
                    : `no response nodes found for selectors: ${ARENA_RESPONSE_SELECTORS}`;
                return reject(new Error(`Timeout (${hint})`));
            }

            const hasStopIcon = document.querySelector('svg.lucide-square') !== null;
            const latestLikeButton = getLatestLikeResponseButton();
            const likeButtonCount = getAllLikeResponseButtons().length;

            if (latestLikeButton) {
                sawCandidateResponseNode = true;
            }

            const messages = document.querySelectorAll<HTMLElement>(ARENA_RESPONSE_SELECTORS);
            const lastMessage = getLatestArenaResponseCandidate();
            if (lastMessage) {
                sawCandidateResponseNode = true;
            }
            const currentLastSignature = getMessageSignature(lastMessage);
            if (messages.length !== initialMessageCount || currentLastSignature !== initialLastSignature) {
                observedResponseChange = true;
            }

            if (hasStopIcon && !generationStarted) {
                generationStarted = true;
                GM_setValue('arena_max_status', 'AI is thinking...');
            }

            const likeButtonChanged =
                likeButtonCount > initialLikeButtonCount ||
                (latestLikeButton && latestLikeButton !== initialLatestLikeButton);

            if ((generationStarted || observedResponseChange || likeButtonChanged) && latestLikeButton) {
                const anchoredCandidate = scoreResponseCandidatesAboveLikeButton(latestLikeButton)[0]?.el;
                if (anchoredCandidate) {
                    const cleanText = normalizeText(anchoredCandidate.textContent || '');
                    const isPromptEcho = submittedPrompt.length > 0 && isLikelyPromptEchoText(cleanText, submittedPrompt);
                    if (cleanText.length > 0 && !isLikelyUserMessage(anchoredCandidate) && !isPromptEcho) {
                        const contentNode = anchoredCandidate.querySelector<HTMLElement>('.markdown, .prose') || anchoredCandidate;
                        return resolve(`<div class="pr-ai-text">${contentNode.innerHTML}</div>`);
                    }
                }
            }

            setTimeout(checkCompletion, 250);
        };

        checkCompletion();
    });
}

/**
 * Main handler for Arena Max automation.
 */
export async function handleArenaMax() {
    const payload = GM_getValue('arena_max_prompt_payload');
    if (!payload) {
        Logger.debug('Arena Max: No payload found in GM storage, skipping automation.');
        return;
    }

    Logger.info('Arena Max: Automation triggered.');

    try {
        GM_setValue('arena_max_status', 'Waiting for input field...');

        GM_setValue('arena_max_status', 'Injecting metadata thread...');
        const requestId = GM_getValue('arena_max_request_id');
        await injectPrompt(payload);

        await sleep(1000);
        GM_setValue('arena_max_status', 'Submitting prompt...');
        await automateRun(payload);

        GM_setValue('arena_max_status', 'Waiting for response (or Cloudflare challenge)...');
        const responseText = await waitForResponse();

        GM_setValue('arena_max_status', 'Response received!');
        GM_setValue('arena_max_response_payload', {
            text: responseText,
            requestId,
            includeDescendants: GM_getValue('arena_max_include_descendants', false),
            timestamp: Date.now()
        });

        GM_deleteValue('arena_max_prompt_payload');
        GM_deleteValue('arena_max_request_id');
        GM_deleteValue('arena_max_include_descendants');
        GM_deleteValue('arena_max_status');

        Logger.info('Arena Max: Response sent. Tab will close in 5m if no interaction.');

        let hasInteracted = false;
        const markInteracted = () => {
            if (!hasInteracted) {
                hasInteracted = true;
                Logger.info('Arena Max: User returned to tab. Auto-close canceled.');
            }
        };

        window.addEventListener('blur', () => {
            window.addEventListener('mousedown', markInteracted, { once: true, capture: true });
            window.addEventListener('keydown', markInteracted, { once: true, capture: true });
            window.addEventListener('mousemove', markInteracted, { once: true, capture: true });
        }, { once: true });

        const checkClose = () => {
            if (!hasInteracted && document.visibilityState !== 'visible') {
                Logger.info('Arena Max: Idle and backgrounded. Closing tab.');
                window.close();
            } else if (!hasInteracted) {
                Logger.info('Arena Max: 5m reached but tab is currently visible. Postponing close.');
                setTimeout(checkClose, ARENA_AUTO_CLOSE_RETRY_DELAY_MS);
            }
        };

        setTimeout(checkClose, ARENA_AUTO_CLOSE_INITIAL_DELAY_MS);
    } catch (error) {
        Logger.error('Arena Max: Automation failed', error);
        GM_setValue('arena_max_status', `Error: ${error instanceof Error ? error.message : String(error)}`);
    }
}
