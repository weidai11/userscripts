import { Logger } from './logger';

export const isFindParentTraceEnabled = (): boolean => {
    try {
        return (window as any).__PR_FIND_PARENT_TRACE__ === true || localStorage.getItem('pr-find-parent-trace') === '1';
    } catch {
        return (window as any).__PR_FIND_PARENT_TRACE__ === true;
    }
};

export const logFindParentTrace = (event: string, data: Record<string, unknown>): void => {
    if (!isFindParentTraceEnabled()) return;

    const json = (() => {
        try {
            return JSON.stringify(data);
        } catch {
            return '[unserializable]';
        }
    })();

    Logger.info(`[FindParentTrace] ${event} ${json}`, data);
};
