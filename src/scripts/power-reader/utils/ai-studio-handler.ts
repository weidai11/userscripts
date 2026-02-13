import { Logger } from './logger';
import { sanitizeHtml } from './sanitize';

declare const GM_getValue: (key: string, defaultValue?: any) => any;
declare const GM_setValue: (key: string, value: any) => void;
declare const GM_deleteValue: (key: string) => void;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Main handler for AI Studio automation.
 */
export async function handleAIStudio() {
    const payload = GM_getValue('ai_studio_prompt_payload');
    if (!payload) {
        Logger.debug('AI Studio: No payload found in GM storage, skipping automation.');
        return;
    }

    Logger.info('AI Studio: Automation triggered.');

    try {
        // 1. Wait for the model selector and ensure "Flash 3" is selected
        GM_setValue('ai_studio_status', 'Configuring AI model...');
        await automateModelSelection();

        // 2. Disable Grounding (Search) but enable URL context
        await automateDisableSearch();
        await automateEnableUrlContext();

        // 3. Inject Prompt
        GM_setValue('ai_studio_status', 'Injecting metadata thread...');
        const requestId = GM_getValue('ai_studio_request_id');
        await injectPrompt(payload);

        // 4. Auto-Run
        await sleep(500);
        GM_setValue('ai_studio_status', 'Submitting prompt...');
        await automateRun();

        // 5. Wait for Response to complete
        const responseText = await waitForResponse();

        // 6. Return Payload
        GM_setValue('ai_studio_status', 'Response received!');
        GM_setValue('ai_studio_response_payload', {
            text: responseText,
            requestId: requestId,
            includeDescendants: GM_getValue('ai_studio_include_descendants', false),
            timestamp: Date.now()
        });

        GM_deleteValue('ai_studio_prompt_payload');
        GM_deleteValue('ai_studio_request_id');
        GM_deleteValue('ai_studio_include_descendants');
        GM_deleteValue('ai_studio_status');

        Logger.info('AI Studio: Response sent. Tab will close in 5m if no interaction.');

        let hasInteracted = false;
        const markInteracted = () => {
            if (!hasInteracted) {
                hasInteracted = true;
                Logger.info('AI Studio: User returned to tab. Auto-close canceled.');
            }
        };

        // Activity detection only starts after the user has switched away (blurred) the tab.
        // This prevents mouse/keyboard activity during the active automation phase 
        // from accidentally keeping the tab open.
        window.addEventListener('blur', () => {
            window.addEventListener('mousedown', markInteracted, { once: true, capture: true });
            window.addEventListener('keydown', markInteracted, { once: true, capture: true });
            window.addEventListener('mousemove', markInteracted, { once: true, capture: true });
        }, { once: true });

        setTimeout(() => {
            // Only close if no return interaction AND it's not currently the active tab
            if (!hasInteracted && document.visibilityState !== 'visible') {
                Logger.info('AI Studio: Idle and backgrounded. Closing tab.');
                window.close();
            } else if (!hasInteracted) {
                Logger.info('AI Studio: 5m reached but tab is currently visible. Postponing close.');
            }
        }, 5 * 60 * 1000);

    } catch (error) {
        Logger.error('AI Studio: Automation failed', error);
        GM_setValue('ai_studio_status', `Error: ${error instanceof Error ? error.message : String(error)}`);
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

async function automateModelSelection() {
    const modelCard = await waitForElement('button.model-selector-card');
    if (modelCard.innerText.includes('Flash 3') || modelCard.innerText.includes('Gemini 3 Flash')) {
        return;
    }
    modelCard.click();
    const flash3Btn = await waitForElement('button[id*="gemini-3-flash-preview"]');
    flash3Btn.click();
}

async function automateDisableSearch() {
    const searchToggle = await waitForElement("button[aria-label='Grounding with Google Search']");
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
    textarea.value = payload;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.focus();
    textarea.setSelectionRange(0, 0);
}

async function automateRun() {
    const runBtn = await waitForElement('ms-run-button button');
    runBtn.focus();
    runBtn.click();
}

async function waitForResponse(timeoutMs: number = 180000): Promise<string> {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        let generationStarted = false;
        let hasRetried = false;

        const checkCompletion = () => {
            const elapsed = Date.now() - startTime;
            if (elapsed > timeoutMs) return reject(new Error('Timeout'));

            const stopBtn = document.querySelector('button[aria-label="Stop generation"], .ms-button-spinner, mat-icon[data-icon-name="stop"], mat-icon[data-icon-name="progress_activity"]');
            const runBtn = document.querySelector('ms-run-button button') as HTMLElement | undefined;
            const hasResponseNodes = document.querySelector('ms-cmark-node') !== null;
            const hasError = document.querySelector('.model-error') !== null;

            if (stopBtn || hasResponseNodes || hasError) {
                if (!generationStarted) {
                    generationStarted = true;
                    GM_setValue('ai_studio_status', 'AI is thinking...');
                }
            }

            if (generationStarted && !stopBtn && runBtn && runBtn.textContent?.includes('Run')) {
                const turnList = document.querySelectorAll('ms-chat-turn');
                const lastTurn = turnList[turnList.length - 1];
                if (!lastTurn) return setTimeout(checkCompletion, 1000);

                const errorEl = lastTurn.querySelector('.model-error');
                if (errorEl) {
                    if (!hasRetried) {
                        const rerunBtn = document.querySelector('button[name="rerun-button"], .rerun-button') as HTMLElement;
                        if (rerunBtn) {
                            GM_setValue('ai_studio_status', 'Retrying...');
                            hasRetried = true;
                            generationStarted = false;
                            rerunBtn.click();
                            return setTimeout(checkCompletion, 2000);
                        }
                    }
                    return resolve(`<div class="pr-ai-error">Error: ${errorEl.textContent}</div>`);
                }

                const editIcon = Array.from(lastTurn.querySelectorAll('.material-symbols-outlined'))
                    .find(el => el.textContent?.trim() === 'edit');
                if (!editIcon) return setTimeout(checkCompletion, 1000);

                const container = lastTurn.querySelector('div.model-response-content, .message-content, .turn-content') || lastTurn;
                const cleanHtml = sanitizeHtml(container.innerHTML.replace(/<button[^>]*>.*?<\/button>/g, ''));

                if (cleanHtml.length > 10) {
                    return resolve(`<div class="pr-ai-text">${cleanHtml}</div>`);
                }
            }
            setTimeout(checkCompletion, 1000);
        };
        checkCompletion();
    });
}
