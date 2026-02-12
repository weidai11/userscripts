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
            'https://www.lesswrong.com/reader*',
            'https://forum.effectivealtruism.org/reader*',
            'https://www.greaterwrong.com/reader*',
            'https://aistudio.google.com/*'
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
                grant: ['GM_addStyle', 'GM_xmlhttpRequest', 'GM_setValue', 'GM_getValue', 'GM_log'],
                connect: ['lesswrong.com', 'forum.effectivealtruism.org'],
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
    },
});
