
declare const GM_getValue: (key: string, defaultValue: any) => any;

const PREFIX = '[LW Power Reader]';

/**
 * Level-based logger utility
 */
export const Logger = {
    // Reset cache (no-op now, kept for API compatibility)
    reset: () => { },

    debug: (msg: string, ...args: any[]) => {
        // ALWAYS log debug messages using console.debug
        // User can hide them via browser console levels (Verbose)
        console.debug(`${PREFIX} 🐛 ${msg}`, ...args);
    },

    info: (msg: string, ...args: any[]) => {
        // ALWAYS log info messages using console.info
        console.info(`${PREFIX} ℹ️ ${msg}`, ...args);
    },

    warn: (msg: string, ...args: any[]) => {
        console.warn(`${PREFIX} ⚠️ ${msg}`, ...args);
    },

    error: (msg: string, ...args: any[]) => {
        console.error(`${PREFIX} ❌ ${msg}`, ...args);
    }
};
