import { defineConfig } from 'vite';
import monkey from 'vite-plugin-monkey';
import path from 'path';

import fs from 'fs';

// Get the script name from environment variable
const scriptName = process.env.VITE_SCRIPT || 'playground';
const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf-8'));


const scripts: Record<string, { name: string; match: string[]; entry: string }> = {
    'playground': {
        name: 'LessWrong GraphQL Helper',
        match: ['https://www.lesswrong.com/*', 'https://forum.effectivealtruism.org/*'],
        entry: 'src/scripts/playground/main.ts',
    },
    'power-reader': {
        name: 'LW Power Reader',
        match: [
            'https://www.lesswrong.com/*',
            'https://forum.effectivealtruism.org/*',
            'https://aistudio.google.com/*',
            'https://arena.ai/*',
            'https://www.arena.ai/*'
        ],
        entry: 'src/scripts/power-reader/main.ts',
    }
};

const config = scripts[scriptName];

if (!config) {
    throw new Error(`Unknown script: ${scriptName}`);
}

export default defineConfig({
    server: {
        cors: true,
        headers: {
            'Access-Control-Allow-Private-Network': 'true',
        },
    },
    plugins: [
        monkey({
            entry: path.resolve(__dirname, config.entry),
            userscript: {
                name: config.name,
                namespace: 'npm/vite-plugin-monkey',
                match: config.match,
                author: 'Wei Dai',
                require: ['https://cdn.jsdelivr.net/npm/dompurify@3.3.1/dist/purify.min.js'],
                grant: [
                    'GM_addStyle',
                    'GM_xmlhttpRequest',
                    'GM_setValue',
                    'GM_getValue',
                    'GM_log',
                    'GM_deleteValue',
                    'GM_addValueChangeListener',
                    'GM_openInTab',
                ],
                connect: ['lesswrong.com', 'forum.effectivealtruism.org', 'arena.ai', 'firestore.googleapis.com'],
                'run-at': 'document-start',
            },
            build: {
                fileName: `${scriptName}.user.js`,
            }
        }),
    ],
    resolve: {
        alias: {
            '@shared': path.resolve(__dirname, 'src/shared'),
        },
    },
    define: {
        '__APP_VERSION__': JSON.stringify(packageJson.version),
        '__PR_FIRESTORE_PROJECT_ID__': JSON.stringify(process.env.PR_FIRESTORE_PROJECT_ID || ''),
        '__PR_FIRESTORE_API_KEY__': JSON.stringify(process.env.PR_FIRESTORE_API_KEY || ''),
        '__PR_FIRESTORE_HOST__': JSON.stringify(process.env.PR_FIRESTORE_HOST || ''),
    },
});
