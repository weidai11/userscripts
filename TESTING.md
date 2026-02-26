# Testing Guide

This project uses a hybrid testing strategy combining **manual in-browser validation** (via Tampermonkey) and **automated headless testing** (via Playwright).

---

## 1. Manual Testing (Development)
For active development, userscripts are served locally and hot-reloaded in your browser.

### Setup
1.  **Start the Dev Server**:
    ```bash
    npm run dev:power-reader
    # or
    npm run dev:playground
    ```
2.  **Install the Loader**:
    Open `http://localhost:5173/main.user.js` in your browser. Tampermonkey/Violentmonkey will prompt you to install a "dev" version of the script.
3.  **Browse**:
    Navigate to [LessWrong.com](https://www.lesswrong.com/reader) (or matched URL). The script will load from your local server.
4.  **Iterate**:
    Save changes in VS Code. The browser script will reload automatically (or require a manual refresh depending on the plugin).

---

## 2. Agent-Based Preliminary Testing
You can task the AI agent to perform quick sanity checks using the `file://` protocol. This is faster than setting up a full E2E environment for simple verifications.

### Requirements
- **Developer Mode**: Must be enabled in `chrome://extensions`.
- **File Access**: "Allow access to file URLs" must be enabled for the Tampermonkey extension.

### Workflow
1.  **Build**: `npm run build:power-reader`
2.  **Install**: Ask the agent to navigate to the local file URL (e.g., `file:///c:/Users/Wei%20Dai/Code/userscripts/dist/power-reader.user.js`).
    - The agent can click "Install" or "Reinstall" on the Tampermonkey page.
3.  **Verify**: The agent can then navigate to a live LessWrong page (e.g., a specific post) to verify visual elements like the sticky header, reaction buttons, or overall layout.

---

## 3. Automated Testing (Playwright)
We use **Playwright** to inject the compiled userscript into a headless browser environment. This ensures the script executes correctly, manipulates the DOM, and handles network requests.

### Core Test Commands

| Scope | Command | Description |
|-------|---------|-------------|
| **Power Reader (Full)** | `npm run test:power-reader` | Builds the script and runs the main E2E suite (`power-reader.spec.ts`). |
| **All Tests** | `npm test` | Runs all spec files in the `tests/` directory. (Uses 4 workers by default). |
| **Archive Mode** | `npx playwright test tests/archive-route.spec.ts` | Verifies the User Archive 2.0 view, data loading, and rendering. |
| **UI-Only** | `npx playwright test tests/power-reader.ui.spec.ts` | Tests interactive features like Picker Toggle, Read Marking, and Parent Nav. |
| **Voting Logic** | `npx playwright test tests/voting.*` | Runs unit (`voting.unit.spec.ts`) and E2E (`voting.e2e.spec.ts`, uses mocked responses) voting tests. |
| **Live API** | `npx playwright test tests/api-sanity.spec.ts` | **Hits real LessWrong API**. Comprehensively checks all GraphQL fields used by the power-reader. |
| **Firestore Sync** | `npm run test:sync-emulator` | Validates Firestore security rules and CAS logic using a local emulator. |

### Test Suites Breakdown

The `tests/` directory contains several categories of tests:

#### 🟢 Main E2E (`power-reader.spec.ts`)
The primary integration test.
- **Mocks**: `GM_xmlhttpRequest`, `GM_setValue`/`getValue`, and GraphQL responses.
- **Verifies**: Script injection, page takeover, rendering of comments, and "Reply to You" styling.
- **Exclusion**: Ensures script does *not* run on non-target pages (e.g., Homepage).

#### 🟣 User Archive (`archive-route.spec.ts`)
Validates the new User Archive 2.0 subsystem.
- **Routing**: Verifies that `/archive?username=...` triggers the archive takeover.
- **Bulk Loading**: Mocks the paginated `GetUserPosts` and `GetUserComments` queries.
- **Rendering**: Ensures unified chronological feed displays both posts and comments correctly.
- **Pagination Guardrail**: Confirms archive does not expose bottom-of-list "Load More" item pagination controls.

#### 🔵 UI Interactions (`power-reader.ui.spec.ts`)
Focuses on user interactions within the rendered Power Reader interface.
- **Grid/List Toggle**: Verifies the reaction picker switches views correctly.
- **Parent Navigation**: Tests clicking `[^]` to highlight/scroll to parent.
- **Read State**: Validates the 5-second delay logic for marking comments as read.

#### 🟡 Feature Specific
- `post-loading.ui.spec.ts`: Tests range-bound sequential fetching, inline post loading, and unified metadata.
- `sticky-header.spec.ts`: Verifies the sticky header appears/disappears on scroll.
- `hover-previews.spec.ts`: Tests hover cards for links and parents.
- `reactions.ui.spec.ts`: Validates reaction picker interactions, search, and view toggling.
- `voting.ui.spec.ts`: Verifies karma and agreement voting and optimistic UI updates.
- `scraping.spec.ts`: Validates the resilience of the reaction scraping regex against mock page sources.
- `voting.unit.spec.ts`: Tests local state updates (optimistic UI) without browser context.

#### 🔴 Live API
- `api-sanity.spec.ts`: Real network requests to the LW API that comprehensively check all GraphQL fields used by the power-reader (comments, posts, users, vote mutation structure) in 2 requests.

### 🛡️ Live Server Policy
ONLY `tests/api-sanity.spec.ts` is allowed to hit the live LessWrong/EA Forum servers. This test verifies the contract between the script and the real API. 

All other tests MUST be 100% mocked using:
1.  **`page.route`**: To intercept initial page loads and asset requests (JS chunks, CSS, images).
2.  **`page.addInitScript`**: To polyfill `GM_xmlhttpRequest` and other userscript-specific APIs to return mock GraphQL data.

**Why?**
- **Speed**: Mocked tests are orders of magnitude faster.
- **Reliability**: Tests don't fail when the real site is down or undergoing maintenance.
- **Rate Limiting**: Prevents triggering 429 errors during CI or intensive local testing.
- **Determinism**: Ensures tests run against known data shapes.

---

## 4. Firestore Sync Integration Testing (Emulator)
This suite (`tests/integration/firestore-sync/run.ts`) validates the persistence sync layer (v3) against a local Firestore emulator.

### Why use an emulator?
- **Rules Validation**: Ensures the security rules (`firestore.rules`) correctly enforce the schema, map-size caps, and path constraints.
- **CAS Correctness**: Validates that the optimistic concurrency (Check-And-Set) logic using `updateTime` preconditions works as intended under conflict.
- **Protocol Safety**: Confirms that only single-write `documents:commit` operations are used.

### Running the Tests
```powershell
# Autostart the emulator, run tests, and shut down
$env:PR_SYNC_EMULATOR_AUTOSTART="1"; npm run test:sync-emulator

# Or manually manage the emulator
firebase emulators:start --only firestore --project demo-pr-sync
npm run test:sync-emulator
```

---

## 5. Debugging & Logs

### File Logging (Automatic)
We use a custom `FileReporter` that automatically saves test output (stdout and stderr) to a timestamped file.
- **Location**: `test_logs/test_run_YYYYMMDD_HHMMSS.log`
- **Feature**: At the end of every test run, the full absolute path to the log file is printed to the console.
- **Benefit**: No need for manual `pwsh` scripts; just run `npm test` and check the log if something fails.
- **Debug/Verbose Logs**: Browser debug/verbose logs are only piped during a single spec run. Multi-file/full-suite runs suppress these logs even if tests pass `verbose: true` to helpers.
- **Temporary Override**: If you intentionally need browser logs in a multi-file run, set `PW_FORCE_BROWSER_LOGS=true` for that command, then unset it afterward.

### PowerShell Logger (Legacy)
If you need to stream logs in real-time or if Playwright fails to start entirely, use our helper script:

### Visual Debugging
To see what the browser is actually doing, run Playwright in headed mode with the inspector:

```bash
npx playwright test tests/power-reader.spec.ts --headed --debug
```

### Screenshots
Tests often capture screenshots on failure or specific checkpoints. Look for `power_reader_screenshot.png` or check the `playwright-report/` folder after a run.

### Archive Mode & Large Datasets
Archive testing can be slow if rendering thousands of items.
- **`__PR_ARCHIVE_LARGE_THRESHOLD`**: You can override the performance dialog threshold (default 10,000) by setting this on `window` in `onInit`. This allows testing the "Large Dataset" logic with small item counts (e.g., 100).
- **Behavior note**: This is about initial render cap selection; archive does not use user-clickable list pagination ("Load More") at the bottom of the feed.

---

## 6. How E2E Tests Work
Since userscripts run in a unique environment, our tests mimic this:

1.  **Build**: `npm run build:power-reader` compiles the TS to a single `.user.js` file.
2.  **Read**: Test file reads the content of `dist/power-reader.user.js`.
3.  **Route**: Playwright intercepts `https://www.lesswrong.com/reader` and `https://www.lesswrong.com/archive` to serve a mock HTML skeleton.
4.  **Inject**: `page.addInitScript()` injects the userscript content *before* page load.
5.  **Mock GM**: `window.GM_xmlhttpRequest` and others are polyfilled in the test context to intercept requests and return mock data.
6.  **Wait**: Tests wait for `#lw-power-reader-ready-signal`, a DOM element added by `main.ts` when initialization is complete.

### Critical Implementation Details
- **`window.stop()`**: The script calls this to halt the native site. In tests, use `{ waitUntil: 'commit' }` for navigation to avoid waiting for a `load` event that never fires.
- **Selectors**: Tests rely on stable classes like `.pr-comment`, `.pr-post-header`. Avoid testing implementation details like specific internal IDs unless necessary.

---

## 7. Build Verification
Always verify the build before committing.

```bash
npm run build:power-reader
```
Check `dist/power-reader.user.js`. The file should:
- Start with the `// ==UserScript==` metadata block.
- Be minimized/bundled (depending on Vite config).
- Contain all imported modules (no `require` or `import` statements left).

---

## 8. Troubleshooting & Common Pitfalls

### Sticky Header & Discovered Posts
The sticky header logic relies on `getBoundingClientRect()` to identify the current post. This can be problematic in headless tests where layout might differ from a real browser.

#### Test Quirks
1.  **Visibility Conditions**: The header only appears if a `.pr-post` top is `< 100px` and bottom is `> 100px`. In tests, ensure you:
    - Inject a large height via `page.addStyleTag` (e.g., `.pr-post { height: 1500px !important; }`).
    - Scroll deep enough to trigger the condition but not so deep that the bottom passes the threshold.
2.  **Post Truncation**: Posts are truncated by default (max-height: 50vh). This can prevent sticky headers from activating if the post isn't tall enough to span the viewport during a scroll.
    - **Fix**: Click the "Read More" button to expand the post naturally:
      ```ts
      const readMoreBtn = page.locator('.pr-read-more-btn').first();
      if (await readMoreBtn.isVisible()) {
          await readMoreBtn.click();
      }
      ```
3.  **Discovered Posts**: Posts discovered via comments (not in the initial `GET_NEW_POSTS` batch) must be added to the global `postsData` array in `main.ts` for the sticky header to find their metadata.
3.  **Unread Counter**: Discovered posts (those only found via comments) are NOT counted as top-level "Unread Items" in the status bar, although they are available for metadata and the sticky header. Only posts explicitly fetched in the "New Posts" batch count towards the unread total.

### ReadTracker & Unread Counts
The `ReadTracker` service updates the global "Unread Count" in the status bar.

#### Common Issues
- **Increment/Decrement Races**: In environments where many items are marked read simultaneously (like scrolling fast over a dense thread), decrementing a counter based on the previous UI text can cause race conditions, leading to negative or incorrect counts.
- **Fix**: The service now recalculates the count by doing a fresh `querySelectorAll` for unread items in the DOM. This is much more robust against concurrent updates.
- **Bottom Message Triggers**: The "Check Server for More" message triggers when the unread count hits 0 while at the bottom of the page. In tests, ensure the viewport is small enough or the spacer is tall enough to satisfy the `isAtBottom` condition precisely.

### Locator Strictness (Strict Mode Violations)
- **Symptom**: `Error: strict mode violation: locator(...) resolved to 2 elements`
- **Cause**: Playwright locators are strict by default. If your selector matches multiple elements (e.g. `.pr-reaction-picker-grid` appearing in both "Primary" and "Emotions" sections), the test will fail.
- **Fix**: Scope your locators precisely.
  - Use `.first()`, `.nth(i)`, or `.last()`.
  - Use container filters: `picker.locator('.section-primary').locator('.grid')`.

### Visibility vs. Attachment
- **Symptom**: `Timeout 5000ms waiting for locator('#signal')` even though the logic seems correct.
- **Cause 1 (Structural)**: `waitForSelector` defaults to `{ state: 'visible' }`. Helper elements like `<div id="signal"></div>` often have 0 height/width, making them "invisible".
- **Cause 2 (Logical)**: The element is rendered but immediately hidden/closed by a race condition or event bubbling bug (see "Detached Element Bubble Bug" in `NOTES.md`).
- **Fix**: 
  - For non-visual markers, use `{ state: 'attached' }`.
  - For standard UI, **don't assume it's a test fluke**. Check browser logs for re-renders or "Click Outside" logic that might be hiding the element prematurely.

### Test Environment Physics (Scrolling & Clamping)
- **Symptom**: `window.scrollTo` appears to have shifted the scroll position, but only partially (e.g., stopping 185px short), or `window.scrollY` remains 0.
- **Cause 1 (Clamping)**: Browsers "clamp" the scroll position at the bottom. If the target element is 500px from the bottom and you try to scroll to it with `{ top: targetTop }`, the browser will stop when the bottom of the page hits the bottom of the viewport. The element will *never* reach the top of the viewport unless the page is tall enough.
- **Cause 2 (Height Loss)**: If you nuke the body (`document.documentElement.innerHTML = ''`) during userscript init, you might lose the page's natural height. Scrolling on a 0px tall body is a no-op.
- **Fix**: Inject a massive min-height style or a decorative spacer in your test *before* attempting scroll actions:
  ```ts
  // In the test setup:
  await page.evaluate(() => {
    const spacer = document.createElement('div');
    spacer.style.height = '5000px';
    document.body.appendChild(spacer);
  });
  ```

### Mock Data Fragility
- **Symptom**: "Element not found" because the UI didn't render as expected (e.g. missing reaction buttons).
- **Cause**: The test mocks the network response (e.g. scraped script chunks). If your mock string doesn't perfectly align with the `reactions.ts` parsing logic, the fallback ("Bootstrap") reactions will take over.
- **Fix**: Ensure your mock data strings (e.g. `const mockBundle = ...`) contain the exact regex patterns your parser expects. If parsing fails, the UI falls back to a limited set of default reactions, causing specific assertions (like "changemind") to fail.

### Debugging Hover Previews
The hover preview system uses an "Intentional Hover" check to avoid flickering when scrolling. This can make E2E tests brittle if not handled correctly.

#### Key Mechanisms
- **`mousemove` tracking**: Previews only show if the mouse moved within the last 50ms before the `mouseenter` event, OR if no scroll occurred in the last 100ms.
- **Mocking content**: The tests (`hover-previews.spec.ts`) mock both the reader page and the GraphQL API. Ensure the `GetPost` or `GetComment` queries in your mock return enough content to be visible.

#### Handling in Tests
If a hover test fails like "Element not found":
1.  **Manual Event Dispatch**: Playwright's `.hover()` can be flaky in high-concurrency environments (CI) because the browser might miss the exact timing window or hit-test calculation. The most robust way to trigger these tests is to:
    - Move the mouse to set the `lastMouseMoveTime` (required by "Proximity Check"): `await page.mouse.move(x, y)`.
    - Manually dispatch the event: `await element.dispatchEvent('mouseenter')`.
2.  **Settle Time**: Use `page.waitForTimeout(500)` after script injection. The reader needs a moment to attach its global listeners to `window` and `document`.
3.  **Threshold Awareness**: The application uses a **200ms threshold** for "intentional hover" (checks if mouse moved recently). Ensure your test moves the mouse < 200ms before dispatching `mouseenter`.
4.  **Trace logs**: Run tests with `--debug` and look for `BROWSER: isIntentionalHover: true/false` in the console.

---

### Hit-Testing (`elementFromPoint`)
- **Current behavior**: Post and comment containers are always laid out (no `content-visibility` gating).
- **Impact**: Hit-testing and visibility checks should not require special "wake up layout" helpers.
- **If a test fails**: Prefer validating sticky-header offsets, scroll position, and hover intentionality timing rather than adding forced reflow/paint workarounds.

