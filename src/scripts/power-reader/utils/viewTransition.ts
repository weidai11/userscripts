import { Logger } from './logger';
import { logFindParentTrace } from './findParentTrace';

type StartViewTransitionFn = ((update: () => void) => unknown) | undefined;

export type RunWithViewTransitionOptions = {
    enabled?: boolean;
    traceLabel?: string;
    tracePrefix?: string;
    errorContext: string;
};

let instantViewTransitionDepth = 0;

const enableInstantViewTransition = (): void => {
    instantViewTransitionDepth += 1;
    document.documentElement.classList.add('pr-vt-instant');
};

const disableInstantViewTransition = (): void => {
    instantViewTransitionDepth = Math.max(0, instantViewTransitionDepth - 1);
    if (instantViewTransitionDepth === 0) {
        document.documentElement.classList.remove('pr-vt-instant');
    }
};

const traceEvent = (prefix: string | undefined, event: string, data: Record<string, unknown>): void => {
    if (!prefix) return;
    logFindParentTrace(`${prefix}:${event}`, data);
};

export const withOverflowAnchorDisabled = (): (() => void) => {
    const htmlStyle = document.documentElement.style as any;
    const bodyStyle = document.body?.style as any;
    const prevHtml = htmlStyle.overflowAnchor || '';
    const prevBody = bodyStyle ? (bodyStyle.overflowAnchor || '') : '';

    htmlStyle.overflowAnchor = 'none';
    if (bodyStyle) bodyStyle.overflowAnchor = 'none';

    return () => {
        htmlStyle.overflowAnchor = prevHtml;
        if (bodyStyle) bodyStyle.overflowAnchor = prevBody;
    };
};

export const runWithViewTransition = (
    update: () => void,
    options: RunWithViewTransitionOptions
): void => {
    const enabled = options.enabled ?? true;
    const rawStartViewTransition = (document as any).startViewTransition as StartViewTransitionFn;
    const startViewTransition = rawStartViewTransition
        ? rawStartViewTransition.bind(document) as StartViewTransitionFn
        : undefined;
    const canUse = enabled && !(window as any).__PR_TEST_MODE__ && typeof startViewTransition === 'function';

    if (!canUse) {
        traceEvent(options.tracePrefix, 'transition-bypass', {
            label: options.traceLabel || '',
            enabled,
            hasApi: typeof startViewTransition === 'function',
        });
        try {
            update();
        } catch (error) {
            Logger.error(`${options.errorContext}: update failed (no transition path)`, error);
        }
        return;
    }

    try {
        traceEvent(options.tracePrefix, 'transition-start', { label: options.traceLabel || '' });
        enableInstantViewTransition();
        const transition: any = startViewTransition(() => {
            return update();
        });

        let cleaned = false;
        const cleanupInstant = () => {
            if (cleaned) return;
            cleaned = true;
            disableInstantViewTransition();
        };

        if (transition?.updateCallbackDone?.then) {
            transition.updateCallbackDone.then(() => {
                traceEvent(options.tracePrefix, 'transition-update-done', { label: options.traceLabel || '' });
            }).catch((error: unknown) => {
                Logger.warn(`${options.errorContext}: transition update callback failed`, error);
            });
        }

        if (transition?.finished?.then) {
            transition.finished.then(() => {
                traceEvent(options.tracePrefix, 'transition-finished', { label: options.traceLabel || '' });
                cleanupInstant();
            }).catch((error: unknown) => {
                Logger.warn(`${options.errorContext}: transition finished with error`, error);
                cleanupInstant();
            });
        } else if (transition?.updateCallbackDone?.finally) {
            transition.updateCallbackDone.finally(() => {
                cleanupInstant();
            });
        } else {
            cleanupInstant();
        }
    } catch (error) {
        Logger.warn(`${options.errorContext}: startViewTransition failed, falling back`, error);
        disableInstantViewTransition();
        try {
            update();
        } catch (updateError) {
            Logger.error(`${options.errorContext}: update failed after transition fallback`, updateError);
        }
    }
};
