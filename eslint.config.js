import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
      "no-empty": ["error", { "allowEmptyCatch": true }]
    },
    languageOptions: {
      globals: {
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        fetch: 'readonly',
        navigator: 'readonly',
        HTMLElement: 'readonly',
        HTMLAnchorElement: 'readonly',
        HTMLInputElement: 'readonly',
        HTMLDetailsElement: 'readonly',
        NodeListOf: 'readonly',
        DOMRect: 'readonly',
        Range: 'readonly',
        MouseEvent: 'readonly',
        MutationObserver: 'readonly',
        Event: 'readonly',
        DOMParser: 'readonly',
        Node: 'readonly',
        confirm: 'readonly',
        alert: 'readonly',
        process: 'readonly',
        GM_setValue: 'readonly',
        GM_getValue: 'readonly',
        GM_addStyle: 'readonly',
        GM_xmlhttpRequest: 'readonly',
        GM_log: 'readonly'
      }
    }
  },
  {
    ignores: [
      "dist/*",
      "node_modules/*",
      "src/generated/*",
      "playwright-report/*",
      "test-results/*",
      "archive/*",
      "tests/fixtures/*"
    ]
  }
);
