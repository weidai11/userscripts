# LessWrong Userscripts Workspace

High-performance Tampermonkey userscripts for **LessWrong** and **EA Forum**.

## 🚀 Key Project: LW Power Reader
A fast, context-first reader for LessWrong and the EA Forum, designed to make high-volume reading and thread navigation feel effortless.

- **Chronological Reader Core**: Shows comments in strict time order with date-based pagination, so you can read without gaps.
- **Deep Thread Context**: Loads missing parents and replies so deep comments still make sense.
- **Post + Comment Power Actions**: Inline controls to expand/load post bodies, load all comments, jump between posts, and navigate thread roots.
- **Sticky Header Navigation**: Keeps post controls and key metadata visible while scrolling long threads.
- **Keyboard-First Workflow**: Hotkeys for post/comment actions, including fallback from hovered comments to parent post actions.
- **AI Studio Integration**: Send posts or comment threads to Google AI Studio (`g` / `Shift+G`), with customizable prompt prefix.
- **Rich Voting & Reactions**: Karma + agreement voting, reaction picker, and inline quote reactions with highlighted quoted text.
- **Smart Prioritization**: Sorts by "most important unread content first" using <abbr title="Prioritizes posts/threads by the highest-karma unread item within them.">tree-karma sorting</abbr> and can apply <abbr title="Hides threads once the post and relevant comments are all read.">fully read thread hiding</abbr>.
- **Personalization**: Author preference controls, read tracking, and saved layout/settings in browser storage.
- **Site-wide Entry Point**: Accessible from any forum page via an injected "POWER Reader" header link.

### Glossary (Power Reader Terms)
- **<abbr title="Loads missing parent comments and jumps to the top-level comment in the current thread.">Trace to root (`[t]`)</abbr>**: Load missing parents and jump to the top-level comment in the thread.
- **<abbr title="Fetches direct and nested child comments for a selected comment.">Load replies (`[r]`)</abbr>**: Fetch descendants for a comment, even if they are not in the current feed batch.
- **<abbr title="Hides a thread from the active view once the post and all relevant comments are read.">Fully read thread hiding</abbr>**: If a post and all relevant comments are read, the thread is filtered from the current view.
- **<abbr title="Ranks posts/threads by the most important unread content inside them, using karma-weighted signals.">Tree-karma sorting</abbr>**: Prioritizes a post/thread by the highest-karma unread item inside it.
- **<abbr title="Treats items older than your session start time as already read, even if they were never explicitly marked read.">Implicit read cutoff</abbr>**: Items older than your session start time can be treated as already read.

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
3.  **Visit Site**: Go to any forum page (e.g. [LessWrong](https://www.lesswrong.com)). Use the "POWER Reader" link in the header or visit `/reader` directly.
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
