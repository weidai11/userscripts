# LessWrong Userscripts Workspace

This workspace is designed for fast, modern development of Tampermonkey userscripts, specifically focused on enhancing the **LessWrong** and **Effective Altruism Forum** experience.

## 🚀 Projects

- **[LW Power Reader](./src/scripts/power-reader/)**: A modern reimagining of the classic LW Power Reader.
  - *Goal*: High-speed, threaded comment reading with advanced filtering (author favoring, karma thresholds, recency highlighting).
  - *Features*:
    - **Agreement Voting**: Compare/Vote on Agreement vs Karma independently.
    - **Pro Reactions**: Full support for "Insightful", "Crux", etc., including a rich picker and search.
    - **Inline Reactions**: Select text to "react" to specific parts of a comment (yellow highlight).
    - **Author Preferences**: Boost or penalize authors to adjust their visibility.
    - **Smart Loading**: Heuristic-based loading that intelligently switches between "walking" the comment tree and fetching full threads to optimize performance and data usage.
    - **Recursive Ancestor Context**: Automatically fetches and displays missing parent comments when navigating deep links, ensuring full context is always available.
    - **Navigation Shortcodes**: Quick-action buttons for power users: `[a]` (Load All), `[c]` (Scroll to Comments), `[n]` (Next Post), `[r]` (Load Replies), `[t]` (Load Parents & Scroll to Root).
    - **Linear Comment Loading**: Uses `allRecentComments` with `sortBy: "oldest"` and date-based pagination for a reliable, gap-free chronological reading experience.
    - **Junk Filtering**: Automatically collapses and highlights "rejected" (moderated) comments with a red border.
    - **Local Read Tracking**: Marks comments as read on scroll; persisted locally without server sync.
    - **Setup UI**: First-time users pick a starting date via calendar, or load most recent 800 comments.
  - *Context*: Based on the original [1.0.8 script](./src/scripts/power-reader/old_power_reader.js) by Wei Dai.
- **[Playground](./src/scripts/playground/)**: A space for experimental helpers (e.g., GraphQL query testing).

## 🛠 Tech Stack

- **Vite**: Ultra-fast build tool and dev server.
- **TypeScript**: Type-safe userscript development.
- **[vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey)**: Handles userscript header generation, asset injection, and HMR.
- **Shared Code**: Utilities and documentation (like [GRAPHQL_API.md](./src/shared/GRAPHQL_API.md)) are shared across scripts.

## 📖 Development Workflow

### 1. Start the Dev Server
Run the dev command for the script you are working on:

```bash
# For Power Reader
npm run dev:power-reader

# For Playground
npm run dev:playground
```

### 2. Install the Loader
After starting the server, visit:
`http://localhost:5173/` (or the specific script port)

Tampermonkey will prompt you to install the "loader" script. You only need to do this **once**.

### 3. Visit the Reader
The Power Reader is available at a dedicated URL that we take over:
[https://www.lesswrong.com/reader](https://www.lesswrong.com/reader)

### 3. Fast Iteration
Leave the dev server running. Files changed in `src/scripts/` will trigger an automatic browser reload (or HMR) via the loader script.

### 4. GraphQL Codegen
The project uses `graphql-codegen` to generate TypeScript types from your queries.
- **Automatic**: Runs automatically before `dev` and `build` commands if `queries.ts` or the schema has changed.
- **Manual**: Run `npm run codegen` to force regeneration.
- **Schema Update**: Run `npm run update-schema` to fetch the latest API definition from LessWrong.

## 📂 Structure

- `src/scripts/`: Individual userscript projects.
- `src/shared/`: Shared TypeScript logic, types, and references.
- `vite.config.ts`: Dynamic configuration that switches the build target based on the `VITE_SCRIPT` environment variable.

## 📜 Development Conventions
- **No `&&` in PowerShell**: The environment uses PowerShell 5.1 which does not support the `&&` operator. Use `;` or separate command calls instead.
- **Paths**: Use backslashes `\` for local file paths on Windows, or forward slashes `/` if the tool handles them.
- **ESM Only**: The project uses `type: "module"`. Avoid `__dirname`; use `import.meta.url` instead.
- **Live Server Policy**: ONLY `tests/api-sanity.spec.ts` is allowed to hit the live LessWrong/EA Forum servers. All other tests MUST be 100% mocked using `page.route` and `page.addInitScript` to prevent unintended external network requests and 429 errors.

## 📜 References
- [LessWrong GraphQL API Guide](./src/shared/GRAPHQL_API.md)
- [LessWrong GraphQL Tutorial](./src/shared/GraphQL_tutorial.md)
- [Old Power Reader Documentation](./src/scripts/power-reader/old_power_reader_doc.md)
- [Old Power Reader Source](./src/scripts/power-reader/old_power_reader.js) (Historical reference from 2012)
