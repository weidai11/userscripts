import type { Page } from '@playwright/test';
import fs from 'fs';
import path from 'url';
import { fileURLToPath } from 'url';
import { default as pathLib } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = pathLib.dirname(__filename);

let cachedScriptContent: string | null = null;

export function getScriptContent(): string {
    if (cachedScriptContent) return cachedScriptContent;
    const scriptPath = pathLib.resolve(__dirname, '../../dist/power-reader.user.js');
    if (!fs.existsSync(scriptPath)) {
        throw new Error('Userscript bundle not found. Run build first.');
    }
    cachedScriptContent = fs.readFileSync(scriptPath, 'utf8');
    return cachedScriptContent;
}

interface MockCurrentUser {
    _id: string;
    username: string;
    slug?: string;
    karma?: number;
    reactPaletteStyle?: string;
}

interface ScrapedReaction {
    name: string;
    label: string;
    svg: string;
}

export interface MockSetupOptions {
    currentUser?: MockCurrentUser | null;
    comments?: Record<string, unknown>[];
    posts?: Record<string, unknown>[];
    subscriptions?: Record<string, unknown>[];
    storage?: Record<string, unknown>;
    scrapedReactions?: ScrapedReaction[] | null;
    onInit?: string;
    onGraphQL?: string;
    onMutation?: string; // Legacy alias
    mockHtml?: string;
    // Legacy flag used by many tests. This no longer enables terminal log piping
    // during multi-file runs (to keep full-suite output clean).
    verbose?: boolean;
    appDebugMode?: boolean;
    appVerbose?: boolean;
    testMode?: boolean;
    skipStorageDefaults?: boolean;
    strictGraphQL?: boolean;
}

interface SerializedMockData {
    currentUser: MockCurrentUser | null;
    comments: Record<string, unknown>[];
    posts: Record<string, unknown>[];
    subscriptions: Record<string, unknown>[];
    storage: Record<string, unknown>;
    scrapedReactionsJson: string | null;
    onInit: string | null;
    onGraphQL: string | null;
    testMode: boolean;
    verbose: boolean;
    strictGraphQL: boolean;
}

const DEFAULT_SCRAPED_REACTIONS = [
    { name: 'agree', label: 'Agreed', svg: '' },
    { name: 'insightful', label: 'Insightful', svg: '' },
    { name: 'thanks', label: 'Thanks', svg: '' },
    { name: 'laugh', label: 'Haha!', svg: '' },
    { name: 'disagree', label: 'Disagree', svg: '' },
    { name: 'important', label: 'Important', svg: '' },
    { name: 'plus', label: 'Plus One', svg: '' },
    { name: 'shrug', label: 'Unsure', svg: '' },
    { name: 'thumbs-up', label: 'Seen', svg: '' },
    { name: 'thumbs-down', label: 'Seen', svg: '' },
];

const DEFAULT_CURRENT_USER: MockCurrentUser = {
    _id: 'test-user-id',
    username: 'TestUser',
    slug: 'test-user',
};

const DEFAULT_MOCK_HTML = '<!DOCTYPE html><html><head><title>Mock LW</title></head><body><div id="main-content"></div></body></html>';

const DEFAULT_COMMENTS = [
    {
        _id: 'c1',
        postId: 'p1',
        pageUrl: 'https://www.lesswrong.com/posts/p1/post',
        htmlBody: '<p>Default mock comment content</p>',
        postedAt: new Date().toISOString(),
        baseScore: 10,
        user: { _id: 'u1', username: 'Author1', karma: 100 },
        post: { _id: 'p1', title: 'Default Post', baseScore: 10 }
    }
];

const DEFAULT_POSTS = [
    {
        _id: 'p1',
        title: 'Default Post',
        htmlBody: '<p>Default post body</p>',
        postedAt: new Date().toISOString(),
        user: { _id: 'u1', username: 'Author1' }
    }
];

export async function setupMockEnvironment(page: Page, options?: MockSetupOptions): Promise<void> {
    const opts = options ?? {};
    const mockHtml = opts.mockHtml ?? DEFAULT_MOCK_HTML;
    const comments = opts.comments ?? (opts.posts ? [] : DEFAULT_COMMENTS);
    const posts = opts.posts ?? (opts.comments ? [] : DEFAULT_POSTS);
    const isSingleFileRun = process.env.PW_SINGLE_FILE_RUN === 'true';
    const forceBrowserLogs = process.env.PW_FORCE_BROWSER_LOGS === 'true';
    const shouldPipeBrowserConsole = isSingleFileRun || forceBrowserLogs;
    const allowVerboseLogs = shouldPipeBrowserConsole && (opts.verbose || isSingleFileRun || forceBrowserLogs);

    if (shouldPipeBrowserConsole) {
        // Mirror browser console output only in single-spec runs, unless explicitly forced.
        page.on('console', msg => {
            const type = msg.type();
            const text = msg.text();

            if (type === 'error') {
                console.error('BROWSER ERROR:', text);
            } else if (type === 'warning') {
                if (allowVerboseLogs) console.warn('BROWSER WARN:', text);
            } else if (type === 'debug') {
                if (allowVerboseLogs) console.log('BROWSER DEBUG:', text);
            } else {
                // Info/Log messages
                if (allowVerboseLogs) console.log('BROWSER:', text);
            }
        });
    }

    // SINGLE ROUTE HANDLER
    await page.route('**/*', route => {
        const url = route.request().url();
        if (url.includes('lesswrong.com') || url.includes('effectivealtruism.org')) {
            if (url.includes('/reader') || url.includes('/reader/reset') || url === 'https://www.lesswrong.com/') {
                return route.fulfill({ status: 200, contentType: 'text/html', body: mockHtml });
            }
            if (url.includes('chunks') || url.includes('bundle.js')) {
                return route.fulfill({ status: 200, contentType: 'application/javascript', body: '/* mock */' });
            }
            if (url.includes('.svg') || url.includes('.png') || url.includes('.ico')) {
                return route.fulfill({ status: 200, body: '' });
            }

            if (allowVerboseLogs) {
                console.warn(`[BLOCKER] Aborting un-mocked request: ${url}`);
            }
            return route.abort();
        }
        return route.continue();
    });

    const storageDefaults: Record<string, unknown> = opts.skipStorageDefaults ? {} : {
        'power-reader-read-from': '__LOAD_RECENT__',
        'power-reader-read': '{}',
        'power-reader-debug-mode': opts.appDebugMode ?? false,
        'power-reader-verbose': opts.appVerbose ?? false,
        'power-reader-scrollMarkDelay': opts.testMode ? 100 : 5000,
        // Also provide prefixed keys for EA Forum tests
        'ea-power-reader-read-from': '__LOAD_RECENT__',
        'ea-power-reader-read': '{}',
        'ea-power-reader-debug-mode': opts.appDebugMode ?? false,
        'ea-power-reader-verbose': opts.appVerbose ?? false,
        'ea-power-reader-scrollMarkDelay': opts.testMode ? 100 : 5000,
    };

    const scrapedReactionsJson = opts.scrapedReactions ? JSON.stringify({
        timestamp: Date.now(),
        reactions: opts.scrapedReactions
    }) : null;

    const mergedStorage = { ...storageDefaults };
    for (const [key, val] of Object.entries(opts.storage || {})) {
        mergedStorage[key] = (typeof val === 'object' && val !== null) ? JSON.stringify(val) : val;
    }

    if (scrapedReactionsJson) {
        mergedStorage['power-reader-scraped-reactions'] = scrapedReactionsJson;
    }

    const serialized: SerializedMockData = {
        currentUser: opts.currentUser === undefined ? DEFAULT_CURRENT_USER : opts.currentUser,
        comments,
        posts,
        subscriptions: opts.subscriptions ?? [],
        storage: mergedStorage,
        scrapedReactionsJson,
        onInit: opts.onInit ?? null,
        onGraphQL: opts.onGraphQL ?? opts.onMutation ?? null,
        testMode: opts.testMode ?? false,
        verbose: opts.verbose ?? false,
        strictGraphQL: opts.strictGraphQL ?? true,
    };

    await page.addInitScript((data: SerializedMockData) => {

    const win = (window as any);
    win.__GM_CALLS = {};
    if (data.testMode) {
      win.__PR_TEST_MODE__ = true;
      win.PR_TEST_SCROLL_DELAY = 100;
    }

        const storage: Record<string, any> = {};
        for (const [key, value] of Object.entries(data.storage)) {
            storage[key] = value;
        }

        const polyfills = {
            GM_setValue: (k: string, v: any) => {
                storage[k] = v;
                // Store a deep clone in __GM_CALLS to prevent reference leaks
                try {
                    win.__GM_CALLS[k] = JSON.parse(JSON.stringify(v));
                } catch {
                    win.__GM_CALLS[k] = v;
                }
            },
            GM_getValue: (k: string, d: any) => {
                const val = storage[k];
                return val !== undefined ? val : d;
            },
            GM_deleteValue: (k: string) => { delete storage[k]; },
            GM_xmlhttpRequest: (options: any) => {
                if (options.url.endsWith('/graphql')) {
                    const body = JSON.parse(options.data || '{}');
                    const query = body.query || '';
                    const variables = body.variables || {};

                    console.log(`[GRAPHQL] ${query.substring(0, 100).replace(/\\n/g, ' ')}... Variables: ${JSON.stringify(variables)}`);

                    if (data.onGraphQL) {
                        try {
                            const handler = new Function('query', 'variables', 'body', data.onGraphQL);
                            const res = handler(query, variables, body);
                            if (res !== null && res !== undefined) {
                                if (res instanceof Promise) {
                                    res.then(resolvedRes => {
                                        setTimeout(() => options.onload({ responseText: JSON.stringify(resolvedRes) }), 10);
                                    }).catch(err => {
                                        console.error('Error in async onGraphQL handler:', err);
                                        if (options.onerror) options.onerror(err);
                                    });
                                } else {
                                    setTimeout(() => options.onload({ responseText: JSON.stringify(res) }), 10);
                                }
                                return;
                            }
                        } catch (e) {
                            console.error('Error in onGraphQL handler:', e);
                            if (data.strictGraphQL) {
                                const msg = `Strict GraphQL mock: onGraphQL handler threw for query ${query.substring(0, 80)}`;
                                if (options.onerror) {
                                    options.onerror({ message: msg });
                                } else {
                                    throw new Error(msg, { cause: e });
                                }
                                return;
                            }
                        }
                    }

                    let handled = false;
                    let resp: any = { data: {} };
                    if (query.includes('GetCurrentUser')) {
                        handled = true;
                        resp = { data: { currentUser: data.currentUser } };
                    }
                    else if (query.includes('GetSubscriptions')) {
                        handled = true;
                        resp = { data: { subscriptions: { results: data.subscriptions } } };
                    }
                    else if (query.includes('GetAllRecentComments') || query.includes('allRecentComments')) {
                        handled = true;
                        resp = { data: { comments: { results: data.comments } } };
                    }
                    else if (query.includes('GetNewPosts')) {
                        handled = true;
                        resp = { data: { posts: { results: data.posts } } };
                    }
                    else if (query.includes('GetThreadComments')) {
                        handled = true;
                        const rootId = variables.topLevelCommentId;
                        const results = data.comments.filter(c =>
                            c.topLevelCommentId === rootId || c._id === rootId
                        );
                        resp = { data: { comments: { results } } };
                    } else if (query.includes('GetCommentReplies')) {
                        handled = true;
                        const parentId = variables.parentCommentId || variables.commentId;
                        const results = data.comments.filter(c =>
                            (c as any).parentCommentId === parentId
                        );
                        resp = { data: { comments: { results } } };
                    } else if (query.includes('GetRepliesBatch')) {
                        handled = true;
                        const results: any = {};
                        Object.keys(variables).forEach(key => {
                            if (key.startsWith('id')) {
                                const id = variables[key];
                                const children = data.comments.filter(c => c.parentCommentId === id);
                                results[`r${key.slice(2)}`] = { results: children };
                            }
                        });
                        resp = { data: results };
                    } else if (query.includes('GetThreadsBatch')) {
                        handled = true;
                        const results: any = {};
                        Object.keys(variables).forEach(key => {
                            if (key.startsWith('id')) {
                                const id = variables[key];
                                const thread = data.comments.filter(c =>
                                    c.topLevelCommentId === id || c._id === id
                                );
                                results[`t${key.slice(2)}`] = { results: thread };
                            }
                        });
                        resp = { data: results };
                    } else if (query.includes('GetCommentsByIds')) {
                        handled = true;
                        const ids = new Set(variables.commentIds || []);
                        const results = data.comments.filter(c => ids.has(c._id as string));
                        resp = { data: { comments: { results } } };
                    } else if (query.includes('GetPost')) {
                        handled = true;
                        const post = data.posts.find(p => p._id === variables.id);
                        resp = { data: { post: { result: post } } };
                    } else if (query.includes('GetComment')) {
                        handled = true;
                        const comment = data.comments.find(c => c._id === variables.id);
                        resp = { data: { comment: { result: comment } } };
                    } else if (query.includes('GetUser')) {
                        handled = true;
                        // Find user in comments or posts
                        let user = null;
                        for (const c of data.comments) {
                            if (c.user && (c.user as any)._id === variables.id) {
                                user = c.user;
                                break;
                            }
                        }
                        if (!user) {
                            for (const p of data.posts) {
                                if (p.user && (p.user as any)._id === variables.id) {
                                    user = p.user;
                                    break;
                                }
                            }
                        }
                        resp = { data: { user: { result: user } } };
                    }

                    if (!handled && data.strictGraphQL) {
                        const compactQuery = query.replace(/\s+/g, ' ').trim().slice(0, 120);
                        const msg = `Strict GraphQL mock: Unhandled query "${compactQuery}"`;
                        console.error(msg);
                        if (options.onerror) {
                            options.onerror({ message: msg });
                        } else {
                            throw new Error(msg);
                        }
                        return;
                    }

                    setTimeout(() => options.onload({ responseText: JSON.stringify(resp) }), 10);
                    return;
                }

                // Fallback for other URLs (like script scraping)
                fetch(options.url)
                    .then(res => res.text())
                    .then(text => {
                        if (options.onload) options.onload({ responseText: text, status: 200 });
                    })
                    .catch(err => {
                        if (options.onerror) options.onerror(err);
                    });
            },
            GM_openInTab: (url: string) => { win.__OPENED_TAB = url; },
            GM_addStyle: () => { },
            GM_log: console.log
        };

        win.open = (url: string) => { win.__OPENED_TAB = url; return null; };

        Object.assign(win, polyfills);
        Object.assign(globalThis, polyfills);

        // 0. Custom Init (run after polyfills to allow overrides)
        if (data.onInit) {
            try {
                new Function(data.onInit)();
            } catch (e) {
                console.error('onInit error:', e);
            }
        }
    }, serialized);
}

export async function initPowerReader(page: Page, options?: MockSetupOptions): Promise<void> {
    const scriptContent = getScriptContent();
    await setupMockEnvironment(page, options);
    await page.goto('https://www.lesswrong.com/reader', { waitUntil: 'domcontentloaded' });
    await page.evaluate(scriptContent);
    await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached', timeout: 15000 });
}
