Userscripts for LessWrong and EA Forum

# Overview & Tech Stack
- Core Stack: Vite + [vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey), TypeScript (ESM), GraphQL (LW API), Playwright (E2E).
- Architecture: Site takeover (`window.stop()`), React DOM clearing, custom GraphQL client.

# Pre-push Checklist
1. Increment version.
2. Run `jj st` and confirm no temporary files are included.
3. Run `jj --no-pager diff --git`. Do a quick sanity check on the diff.
4. Generate the commit message from the actual diff, then set it with `jj desc -m "..."`.
5. Include relevant requirement IDs in commit messages when applicable (e.g., `PR-UARCH-*`, `PR-PREV-*`).
6. Run `npm run lint:changed`
7. Run `npm run lint:app`
8. Run `npm test`
9. Run `jj bookmark set main`
10. Run `jj git push` (don't run this without explicit user direction)

# Key Commands
- Build: `npm run build:power-reader`
- Test: `npm test` (E2E) | `npm run test:sync-emulator` (Firestore integration)
- Lint: `npm run lint:changed` | `npm run lint:app`
- Tooling: `npm run codegen` (types) | `update-schema` (latest LW API). `codegen` runs automatically on `dev`/`build`.

# Conventions & Gotchas
- Shell: PowerShell 5.1. No `&&`, use `;`. Use backslashes `\` for local Windows paths. Use quotes around "paths with spaces". Do not prefix commands with shell executables like `cmd` or `powershell`. Quote `@` if used
- Code: ESM only (no `__dirname`). Use `/// <reference types="vite-plugin-monkey/client" />` for `GM_*` types. Use `htmlBody` for content.
- Testing: Wait for `#lw-power-reader-ready-signal`. Mock `GM_*` and GraphQL via `addInitScript`.
- Sync Testing: Run Firestore integration checks with `$env:PR_SYNC_EMULATOR_AUTOSTART="1"; npm run test:sync-emulator`. This validates security rules and CAS logic against a local emulator.
- Playwright browser log piping: Enabled only for single-spec runs, or explicitly with `PW_FORCE_BROWSER_LOGS=true`.
- Spec-driven changes: For behavior changes, update `src/scripts/power-reader/SPEC.md` requirement IDs and add/update matching tests.
- Logic: Use getters (e.g., `() => state.data`) for component props to avoid stale closures.

# References
README.md TESTING.md NOTES.md CHANGELOG.md src/scripts/power-reader/SPEC.md src/shared/graphql/lw_schema.graphql
