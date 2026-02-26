userscripts for **LessWrong** and **EA Forum**.

## Overview & Tech Stack
- **Core Stack**: Vite + [vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey), TypeScript (ESM), GraphQL (LW API), Playwright (E2E).
- **Architecture**: Site takeover (`window.stop()`), React DOM clearing, custom GraphQL client.

## Pre-push Checklist
1. Increment version.
2. Run `jj st` and confirm no temporary files are included.
3. Run `jj --no-pager diff --git`.
4. Generate the commit message from the actual diff, then set it with `jj desc -m "..."`.
5. Include relevant requirement IDs in commit messages when applicable (e.g., `PR-UARCH-*`, `PR-PREV-*`).
6. Run `npm test`
7. Run `jj bookmark set main`
8. Run `jj git push` (don't run this without explicit user direction)

## Key Commands
- **Build**: `npm run build:power-reader`
- **Test**: `npm test`
- **Tooling**: `npm run codegen` (types) | `update-schema` (latest LW API). `codegen` runs automatically on `dev`/`build`.

## Conventions & Gotchas
- **Shell**: PowerShell 5.1 (No `&&`, use `;`). Use backslashes `\` for local Windows paths.
- **Shell Execution**: Run commands directly; do not prefix commands with shell executables like `cmd` or `powershell`. Quote `@` if used
- **Code**: ESM only (no `__dirname`). Use `/// <reference types="vite-plugin-monkey/client" />` for `GM_*` types. Use `htmlBody` for content.
- **Testing**: Wait for `#lw-power-reader-ready-signal`. Mock `GM_*` and GraphQL via `addInitScript`.
- **Playwright browser log piping**: Enable only for single-spec runs, or explicitly with `PW_FORCE_BROWSER_LOGS=true`.
- **Spec-driven changes**: For behavior changes, update `src/scripts/power-reader/SPEC.md` requirement IDs and add/update matching tests.
- **Logic**: Use getters (e.g., `() => state.data`) for component props to avoid stale closures.
- **GraphQL**: Schema reference in `src/shared/graphql/lw_schema.graphql`.

## References
./README.md ./TESTING.md ./NOTES.md ./CHANGELOG.md ./src/scripts/power-reader/SPEC.md
