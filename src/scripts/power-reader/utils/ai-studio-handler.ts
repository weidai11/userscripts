import { Logger } from './logger';
import { consumeAIPayloadKey, getPayloadStorageKeyFromHash } from './aiPayloadStorage';

declare const GM_getValue: (key: string, defaultValue?: any) => any;
declare const GM_deleteValue: (key: string) => void;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const AI_STUDIO_FALLBACK_PAYLOAD_KEY = 'ai_studio_prompt_payload';

/**
 * Main handler for AI Studio automation.
 */
export async function handleAIStudio() {
    const payloadStorageKey = getPayloadStorageKeyFromHash();
    const storageKey = payloadStorageKey || AI_STUDIO_FALLBACK_PAYLOAD_KEY;
    const payload = GM_getValue(storageKey);
    if (!payload) {
        if (payloadStorageKey) {
            Logger.warn(`AI Studio: Missing payload for key "${payloadStorageKey}".`);
        }
        return;
    }

    Logger.info('AI Studio: Automation triggered.');

    try {
        // 1. Disable Grounding (Search) but enable URL context
        await automateDisableSearch();
        await automateEnableUrlContext();

        // 2. Inject Prompt
        await injectPrompt(payload);

        // 3. Auto-Run
        await sleep(1000);
        await automateRun();

        Logger.info('AI Studio: Prompt submitted. Continue in this tab.');

    } catch (error) {
        Logger.error('AI Studio: Automation failed', error);
    } finally {
        if (typeof GM_deleteValue === 'function') {
            GM_deleteValue(storageKey);
        }
        if (payloadStorageKey) {
            consumeAIPayloadKey(payloadStorageKey);
        }
    }
}

async function waitForElement(selector: string, timeout: number = 30000): Promise<HTMLElement> {
    return new Promise((resolve, reject) => {
        const check = () => {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) return elements[0] as HTMLElement;
            return null;
        };

        const existing = check();
        if (existing) return resolve(existing);

        if (window.location.href.includes('accounts.google.com') || document.body?.innerText.includes('Sign in')) {
            return reject(new Error('Login Required'));
        }

        const observer = new MutationObserver((_, obs) => {
            const el = check();
            if (el) {
                obs.disconnect();
                resolve(el);
            }
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });

        setTimeout(() => {
            observer.disconnect();
            reject(new Error(`Timeout waiting for element: ${selector}`));
        }, timeout);
    });
}

async function automateDisableSearch() {
    const searchToggle = await waitForElement("button[aria-label='Grounding with Google Search']").catch(() => null);
    if (!searchToggle) return;
    if (searchToggle.classList.contains('mdc-switch--checked')) {
        searchToggle.click();
    }
}

async function automateEnableUrlContext() {
    Logger.debug('AI Studio: Searching for URL context toggle...');
    const urlToggle = await waitForElement(
        "button[aria-label='URL context'], button[aria-label='URL Context'], button[aria-label='Browse the url context'], button[aria-label='URL tool'], button[aria-label='URL Tool']",
        5000
    ).catch(() => null);

    if (urlToggle) {
        if (urlToggle.classList.contains('mdc-switch--unselected')) {
            Logger.info('AI Studio: Enabling URL context tool.');
            urlToggle.click();
        } else {
            Logger.debug('AI Studio: URL context tool already enabled.');
        }
    } else {
        Logger.warn('AI Studio: URL context toggle not found.');
    }
}

async function injectPrompt(payload: string) {
    const textarea = await waitForElement("textarea[aria-label='Enter a prompt']") as HTMLTextAreaElement;
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

async function automateRun() {
    const runBtn = await waitForElement('ms-run-button button');
    runBtn.focus();
    runBtn.click();
}
