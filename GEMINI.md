# LessWrong Userscripts (GEMINI.md)

High-performance Tampermonkey userscripts for **LessWrong** and **EA Forum**.

## 🚀 Overview & Tech Stack
- **Primary Project**: LW Power Reader (Chronological reader, voting, read tracking, advanced filtering).
- **Core Stack**: Vite + [vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey), TypeScript (ESM), GraphQL (LW API), Playwright (E2E).
- **Architecture**: Site takeover (`window.stop()`), React DOM clearing, custom GraphQL client.

## 🏗 Structure & VCS
- **VCS**: This repository uses Jujutsu. Use `jj` for all VCS operations (`status`, `diff`, `log`, `branch`/`bookmark`, `commit`/`describe`, etc.).
- **Folders**:
  - `src/scripts/`: `power-reader/` (main), `playground/` (experimental).
  - `src/shared/`: Shared `graphql/` logic and queries.
  - `tests/`: Playwright suites. `dist/`: Output scripts. `test_logs/`: Test artifacts.

## 📖 Key Commands
- **Dev**: `npm run dev:power-reader` | `dev:playground` (HMR enabled).
- **Build**: `npm run build:power-reader` | `build:playground` (Patches version).
- **Test**: `npm test` (all) | `npm run test:power-reader` (E2E) | `npx playwright test --debug`.
- **Tooling**: `npm run codegen` (types) | `update-schema` (latest LW API). `codegen` runs automatically on `dev`/`build`.

## 📜 Conventions & Gotchas
- **Shell**: PowerShell 5.1 (No `&&`, use `;`). Use backslashes `\` for local Windows paths.
- **Code**: ESM only (no `__dirname`). Use `/// <reference types="vite-plugin-monkey/client" />` for `GM_*` types. Use `htmlBody` for content.
- **Testing**: Wait for `#lw-power-reader-ready-signal`. Mock `GM_*` and GraphQL via `addInitScript`.
- **Logic**: Use getters (e.g., `() => state.data`) for component props to avoid stale closures.
- **GraphQL**: Schema reference in `src/shared/graphql/lw_schema.graphql`.

## 🔗 References
[README.md](./README.md) | [TESTING.md](./TESTING.md) | [NOTES.md](./NOTES.md) | [CHANGELOG.md](./CHANGELOG.md)
