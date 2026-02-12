# AGENTS.md

Userscripts for LessWrong and EA Forum, built with Vite + vite-plugin-monkey.

## Commands
- `npm run dev:power-reader` - Dev server for power-reader userscript
- `npm run build:power-reader` - Build power-reader userscript to dist/
- `pwsh -File scripts/test_with_logs.ps1 tests/power-reader.spec.ts` - Recommended test runner for Windows
- `npm run test:power-reader` - Standard build and test command
- `npx playwright test tests/api-sanity.spec.ts` - Check if LessWrong API field names are still valid

## Architecture
- Scripts: `src/scripts/{playground,power-reader}/main.ts`
- Shared code: `src/shared/` - GraphQL client and queries
- Path alias: `@shared` → `src/shared/`
- Tests: `tests/*.spec.ts` using Playwright
- Output: `dist/{script}.user.js` (Automatically increments version on build)

## Critical Warnings
- **GraphQL**: `plaintextExcerpt` is DEPRECATED. Use `htmlBody`.
- **Takeover**: LessWrong/EA Forum are React-heavy. Use the "Nuclear Option" (window.stop + innerHTML clear) at `document-start` to avoid background crashes.
- **E2E**: Wait for `#lw-power-reader-ready-signal`. **Mocks MUST handle initialization queries** (`GetAllRecentComments`, `GetSubscriptions`) and provide a safe fallback `{ data: {} }` to prevent hanging.

## Code Style
- TypeScript with strict mode, ES2022 target, ESM modules
- Use explicit types; avoid `any`
- Import shared code via `@shared` alias or relative `../../shared/`
- Userscript APIs: GM_addStyle, GM_xmlhttpRequest, GM_setValue, GM_getValue, GM_log
