# LessWrong Userscripts Workspace

High-performance Tampermonkey userscripts for **LessWrong** and **EA Forum**.

## 🚀 Key Project: LW Power Reader
A modern reimagining of the classic chronological reader, built for speed and context.

- **Chronological Density**: Uses `allRecentComments` with date-based pagination for a gap-free experience.
- **Deep Thread Context**: Auto-fetches missing parent chains for deep links.
- **Power Navigation**: Hotkeys like `[e]` (expand), `[a]` (load all), `[r]` (replies), `[t]` (trace to root).
- **Rich Reactions**: Independent Agreement voting and full "Pro" reaction (Insightful, Crux, etc.) support.
- **Advanced Filtering**: Author favoring, karma thresholds, and "Fully Read" thread hiding.
- **Local State**: Persistence for read tracking and preferences in browser storage.

## 📥 Installation
1. Install a userscript manager like **Tampermonkey**.
2. Click here to install: [**Install LW Power Reader**](https://github.com/weidai11/userscripts/raw/main/dist/power-reader.user.js)

## 🏗 VCS & Workflow
This repository uses **Jujutsu**. Use `jj` for all version control operations.

```bash
# Common jj commands
jj status
jj git push --bookmark main
```

### Development Workflow
1.  **Start Dev Server**: `npm run dev:power-reader` (PowerReader) or `npm run dev:playground`.
2.  **Install Loader**: Visit `http://localhost:5173/` and install the Tampermonkey loader script.
3.  **Visit Site**: Go to [lesswrong.com/reader](https://www.lesswrong.com/reader). The script takes over the `/reader` URL.
4.  **Edit & Reload**: Changes to `src/` trigger automatic reloads via HMR.

## 🛠 Tech Stack
- **Vite** + **TypeScript** + **[vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey)**.
- **GraphQL**: Type-safe queries with `graphql-codegen` (runs automatically on `dev`/`build`).
- **Playwright**: Robust E2E testing suite (100% mocked by default).

## 📜 Documentation & Guides
- **[GEMINI.md](./GEMINI.md)**: AI-friendly guide to architecture, commands, and conventions.
- **[TESTING.md](./TESTING.md)**: Workflows for running and debugging the test suite.
- **[SPEC.md](./src/scripts/power-reader/SPEC.md)**: Detailed feature requirements and UI specifications.
- **[GRAPHQL_API.md](./src/shared/GRAPHQL_API.md)**: Guide to the LessWrong and EA Forum API.
- **[NOTES.md](./NOTES.md)**: Technical "gotchas" and environment-specific solutions.

## 🔗 References
[CHANGELOG.md](./CHANGELOG.md) | [Old Power Reader Docs](./src/scripts/power-reader/old_power_reader_doc.md) | [Old Source](./src/scripts/power-reader/old_power_reader.js)
