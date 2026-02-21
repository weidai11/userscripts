# LessWrong Userscripts (AGENTS.md)

High-performance Tampermonkey userscripts for **LessWrong** and **EA Forum**.

## 🚀 Overview & Tech Stack
- **Primary Project**: LW Power Reader (Chronological reader, voting, read tracking, advanced filtering).
- **Core Stack**: Vite + [vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey), TypeScript (ESM), GraphQL (LW API), Playwright (E2E).
- **Architecture**: Site takeover (`window.stop()`), React DOM clearing, custom GraphQL client.

## 🏗 Structure & VCS
- **VCS**: This repository uses Jujutsu. Common commands:
  - `jj st` (status), `jj log` (history), `jj --no-pager diff --git` (full changes), `jj desc -m "msg"` (set commit message)
  - Before pushing, generate the commit message from the actual diff (`jj --no-pager diff --git`), then set it with `jj desc -m "..."`
  - Include relevant requirement IDs in commit messages when applicable (e.g., `PR-UARCH-*`, `PR-PREV-*`).
  - `jj bookmark set main` (update branch pointer to current commit BEFORE push)
  - `jj git push` (sync changed bookmarks to remote)
  - **Pre-push checklist**: run `jj st` (avoid adding temp files), `jj --no-pager diff --git`, `npx playwright test` (or targeted suite), and `npm run test:audit`.
  - **PowerShell Note**: Quote `@` if used (e.g., `jj show '@'`), as it is a reserved symbol.
- **Folders**:
  - `src/scripts/`: `power-reader/` (main), `playground/` (experimental).
  - `src/shared/`: Shared `graphql/` logic and queries.
  - `tests/`: Playwright suites. `dist/`: Output scripts. `test_logs/`: Test artifacts.

## 📖 Key Commands
- **Dev**: `npm run dev:power-reader` | `dev:playground` (HMR enabled).
- **Build**: `npm run build:power-reader` | `build:playground` (Auto-runs `npm audit`).
- **Test**: `npm test` (all) | `npm run test:power-reader` (E2E) | `npx playwright test`.
- **Tooling**: `npm run codegen` (types) | `update-schema` (latest LW API). `codegen` runs automatically on `dev`/`build`.

## 📜 Conventions & Gotchas
- **Shell**: PowerShell 5.1 (No `&&`, use `;`). Use backslashes `\` for local Windows paths.
- **Shell Execution**: Run commands directly; do not prefix commands with shell executables like `cmd` or `powershell`.
- **Code**: ESM only (no `__dirname`). Use `/// <reference types="vite-plugin-monkey/client" />` for `GM_*` types. Use `htmlBody` for content.
- **Testing**: Wait for `#lw-power-reader-ready-signal`. Mock `GM_*` and GraphQL via `addInitScript`.
- **Playwright browser log piping**: Enable only for single-spec runs, or explicitly with `PW_FORCE_BROWSER_LOGS=true`.
- **Spec-driven changes**: For behavior changes, update `src/scripts/power-reader/SPEC.md` requirement IDs and add/update matching tests.
- **Logic**: Use getters (e.g., `() => state.data`) for component props to avoid stale closures.
- **GraphQL**: Schema reference in `src/shared/graphql/lw_schema.graphql`.

## 🔗 References
[README.md](./README.md) | [TESTING.md](./TESTING.md) | [NOTES.md](./NOTES.md) | [CHANGELOG.md](./CHANGELOG.md) | [SPEC.md](./src/scripts/power-reader/SPEC.md)
