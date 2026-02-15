# Project Notes

## Ideas for LW Power Reader
- **GraphQL Integration**: Fetch user karma and comment agreement data for enhanced filtering.
- **Modern UI**: Use a sleek side-panel or floating dashboard instead of raw DOM injection.
- **Performance**: High-speed threading was a core feature of the original; maintain that using modern JS/async patterns.

---

## Build & Environment

### ESM and `__dirname`
In this project (`type: "module"`), `__dirname` is not available. 
- **Problem**: Playwright tests or Node scripts will crash if they use `__dirname`.
- **Solution**: Use `fileURLToPath` and `import.meta.url` to derive paths (see `tests/power-reader.spec.ts`).

### Userscript Output Names
Vite-plugin-monkey defaults to `userscripts.user.js`.
- **Problem**: Multiple scripts in the monorepo will overwrite each other in `dist/`.
- **Solution**: The `vite.config.ts` dynamically sets `build.fileName` based on the `VITE_SCRIPT` environment variable.

### Build Templates
The classic Vite "Vanilla TS" template includes assets (CSS/SVGs) that break when moving to a subfolder monorepo.
- **Problem**: `npm run build` fails with "Could not resolve" errors.
- **Solution**: Keep userscript entry points (`main.ts`) minimal or strictly relative to their script folder.

---

## Userscript Environment

### Userscript Types & GM_xmlhttpRequest
- **Problem**: TypeScript doesn't recognize Greasemonkey APIs (`GM_*`) even with `@types/greasemonkey`.
- **Solution**: Use `/// <reference types="vite-plugin-monkey/client" />` at the top of files that use these APIs. This allows `vite-plugin-monkey` to handle the types correctly without extra dependencies.

### React Site Takeover (The Nuclear Option)
- **Problem**: React sites (like LessWrong) keep running in the background even if you hide their UI. They may try to update the DOM, causing `NotFoundError` when they can't find their expected nodes.
- **Solution**: Use `window.stop()` immediately at `document-start`, block all future script injections via `MutationObserver`, and reset `document.documentElement.innerHTML = ''`. This kills the original React environment entirely.

### Scraping Reactions from Bundle
- **Context**: LW API does not provide reaction definitions.
- **Solution**: We scrape the `client.*.js` bundle using regex (`name:"agree",label:"Agreed"`). This is brittle but necessary.
- **Gotcha**: If LW changes their build system or obfuscation, this will break. Always maintain a hardcoded fallback list in `reactions.ts`.

---

## GraphQL & API

### GraphQL API Drift
- **Problem**: Older documentation (including our local `GraphQL.md`) may reference `plaintextExcerpt`.
- **Solution**: Always use **`htmlBody`** for comment content. Check the latest schema in GraphiQL if queries fail with "field not found".

### extendedScore Structure
- **Problem**: The `extendedScore` field in GraphQL is typed as `JSON` but has a specific internal structure.
- **Gotcha**: It is NOT a simple list of reactions. It is a **Record** (`{ [reactionName]: UserReactInfo[] }`).
- **Test Mocking**: Your mocks MUST reflect this structure. Returning a flat list or simple counts will crash the UI renderer which expects to iterate over keys.
- **Generic Queries**: The `queryGraphQL` helper is now generic: `queryGraphQL<TData, TVariables>(QUERY, variables)`. ALWAYS use the generated types from `src/generated/graphql` when calling it. This enforces type safety for variables and return values, preventing runtime errors due to missing or mismatched variables.


### GraphQL Schema Maintenance
- **Problem**: The LessWrong GraphQL server sometimes returns a schema that is technically invalid (e.g., `EmptyViewInput` with no fields), which causes `graphql-codegen` to crash with "Input Object type EmptyViewInput must define one or more fields."
- **Solution**: Use the `npm run update-schema` command. It runs a specialized script (`src/shared/graphql/fetch_schema.js`) that uses Playwright to fetch the introspection result through a browser (bypassing the production API's CORS/User-Agent restrictions) and applies a post-processing fix to inject a dummy `_unused` field into any empty Input objects before saving the JSON.

### Mutation Response Structure
- **Problem**: LessWrong mutations wrap the updated document within a result object (e.g., `performVoteComment { document { ... } }`).
- **Solution**: Mocks in tests must match this nesting exactly. The userscript's UI synchronization logic expects `response.performVoteComment.document`. If the mock returns a top-level `vote` or `comment` object instead, the update will be ignored, leading to inconsistent UI states in tests.

### GraphQL Batching with Aliasing
- **Problem**: Fetching data for many independent IDs (e.g., context for 50 different comments) often hits the "800 threads" bottleneck if done one-by-one.
- **Solution**: Use GraphQL Aliasing to group multiple queries into one request.
  ```graphql
  query Batch($id0: String!, $id1: String!) {
    r0: comments(selector: { commentReplies: { parentCommentId: $id0 } }) { results { ... } }
    r1: comments(selector: { commentReplies: { parentCommentId: $id1 } }) { results { ... } }
  }
  ```
- **Implementation**: See `fetchRepliesBatch` and `fetchThreadsBatch` in `loader.ts`. Chunk size is limited to ~15-30 to avoid hitting HTTP header size limits.

### Ancestry Mapping (Instant Context)
- **Strategy**: Instead of recursive "Walk Up" calls, include several levels of shallow `parentComment` (just `_id` and `parentCommentId`) in the initial comment fragment.
- **Benefit**: 5-10 levels covers 99% of threads, allowing the reader to build a complete ancestry map for 0 extra network cost during initial load.

### Date-Based Comment Loading
- **Problem**: The old per-post thread loading approach was complex and required syncing read state with the server.
- **Solution**: Use `allRecentComments` view with `after` parameter for simple linear chronological loading. Store `loadFrom` datetime locally and update it when user scrolls to bottom. No server sync needed.

### Range-Bound Sequential Fetching
- **Context**: Merging posts and comments into a single feed can lead to an "infinite range" problem if not capped. If a user has 10,000 unread comments over a month, fetching posts for that entire month while only showing 800 comments leads to a massive sync issue.
- **Solution**: Cap the post fetch date range. Fetch comments first to determine the exact time window they cover. Use the oldest comment's date as `after` and the newest comment's date as `before` (if the comment batch hit the limit). This ensures posts and comments are strictly synchronized in the current view.

---

## UI & Rendering

### Fixed Positioning & Scroll
- **Problem**: When using `position: fixed` for UI elements (like a global picker), using `rect.bottom + window.scrollY` from `getBoundingClientRect()` will cause the element to appear off-screen if the page is scrolled.
- **Solution**: For `fixed` elements, use the raw coordinates from `getBoundingClientRect()` as they are already relative to the viewport. Only add scroll offsets for `absolute` positioned elements.

### Event Delegation & Child Elements
- **Problem**: Using `e.target.dataset.action` in a root click listener fails if the user clicks an icon or text inside the button.
- **Solution**: Use `(e.target as HTMLElement).closest('[data-action]')` to correctly identify the action regardless of which child was clicked.

### Scroll Tracking Robustness
- **Problem**: Hardcoded pixel thresholds for marking comments as read (e.g., `rect.bottom < 100`) are fragile and depend on viewport size.
- **Solution**: Use relative values like `window.innerHeight * 0.8` to ensure consistent behavior across different screen resolutions and test environments.

### Bottom-of-Page Read Marking
- **Problem**: Even with "mark only when fully scrolled past" logic, unread comments can get stuck at the bottom of the page because they never leave the screen.
- **Solution**: Implement a "Bottom of Page" condition in the scroll listener. If `window.innerHeight + window.scrollY >= document.body.offsetHeight`, mark all currently visible unread comments as read immediately.

### Sticky Header Interaction Sync
- **Problem**: Changing state (like collapsing a post) via a sticky header feels disconnected if the original post header doesn't stay in sync.
- **Solution**: When clicking buttons in the sticky header, perform the action on the **original** DOM elements (e.g., triggering a scroll to the post before collapsing). This ensures that if the user scrolls back up, the UI state is consistent.

### The Detached Element Bubble Bug
- **Problem**: A UI component (like a picker) closes instantly when an internal button (like a view toggle) is clicked, even though the click was "inside".
- **Cause**: If clicking the button triggers a re-render (`innerHTML = ...`), the button is removed from the DOM. However, the `click` event continues to bubble up to `document`. A "Click Outside" handler on the document checks `if (!picker.contains(event.target))`. Since the button is now detached, `contains` returns `false`, and the picker closes.
- **Solution**: Use `e.stopPropagation()` on internal buttons that trigger re-renders to prevent the event from reaching the document-level "Click Outside" listener.

### Reaction Picker "Instant Close" Bug
- **Problem**: Clicking the `+` button opens the reaction picker, but it disappears immediately.
- **Cause**: The picker opens on `mousedown`, but the subsequent `click` event bubbles to a document-level `closeHandler`. That handler check `if (!picker.contains(e.target) && e.target !== button)` failed if the user clicked a child element of the button (like an icon or the "+" text itself).
- **Solution**: Use `!button.contains(e.target as Node)` instead of a direct equality check. This ensure that clicks anywhere on or inside the button are ignored by the click-away logic.

### Global Tooltips for Scrollable Containers
- **Problem**: Tooltips inside scrollable containers (like the Reaction Picker) are clipped by `overflow: hidden` or restricted by the container's width.
- **Solution**: Move to a **Global Tooltip** pattern. Render a single tooltip div at `document.body` level. 
- **Implementation**: Use `mouseover`/`mouseout` delegation on the container. Calculate the tooltip position using `getBoundingClientRect()` of the trigger and adjust for viewport boundaries (flip/shift).
- **Gotcha**: Remember to hide the global tooltip when the parent component (e.g. the Picker) closes.

### Stateful Re-rendering in Components
- **Problem**: Calling `render()` on every state change (like a reaction vote or search input) destroys the current focus and scroll position.
- **Solution**: 
    1.  Separate the data state from the UI rendering.
    2.  In `_render()`, re-inject `innerHTML` but specifically handle focus: if the search input was focused, focus it again after re-rendering and restore the cursor position (`setSelectionRange`).
    3.  For scroll preservation in long lists, consider only re-rendering specific nodes or using a virtual DOM approach (though for a picker, a simple `innerHTML` refresh with focus restoration is usually sufficient).

### Post-Centric Read Tracking (The Body-Only Check)
- **Problem**: Marking a post as "read" only after scrolling past its entire container (including all comments) is frustrating for users who want the post marked read as soon as they finish the main text.
- **Solution**: In `ReadTracker.ts`, we perform a specialized check for `.pr-post` items. We extract the bounding box of the `.pr-post-content` (the body) instead of the whole post group. If the body has been scrolled past, the post is marked read, even if dozens of unread comments remain visible below it.
- **Gotcha**: If the post body is collapsed or missing (header-only post), we fall back to checking the `.pr-post-header` instead. This ensures header-only posts are still marked read correctly.

### Post Truncation Measurement Race
- **Problem**: The `[e]` (toggle expansion) button is disabled on load even for very long posts.
- **Cause**: The `refreshPostActionButtons` utility determines if a post "fits" (and thus doesn't need a toggle) by checking `scrollHeight > offsetHeight`. If the container has the `.truncated` class but no CSS-enforced `max-height` yet, the element renders at its natural full height. Thus `scrollHeight == offsetHeight`, and the utility erroneously disables the button.
- **Solution**: Apply the `max-height` constraint as an inline style during the initial render whenever the `.truncated` class is applied. This ensures the first layout pass correctly reflects the clipped state for measurement logic.

### Forum Injection & Hydration Safety
- **Context**: Injecting links into a live React application (like the LessWrong forum) is risky because React's "Hydration" process expects the DOM to exactly match its server-rendered state. If a userscript modifies the DOM too early, React may crash with a "Hydration Mismatch" (Error #418).
- **Solution**: 
    1. **Delay**: Wait 2 seconds after `window.load` before performing the initial injection.
    2. **Guarded Observer**: Use a `MutationObserver` to maintain the link during SPA navigations, but only act if the initial hydration window has passed.
    3. **Pre-Injection Check**: Always verify `document.getElementById('link-id')` is missing before injecting to avoid duplicates.

### Layout Sizing in Dynamic Grids (The Width: 0 Hack)
- **Problem**: A flexbox list with `flex-wrap: wrap` and `width: 50%` items will try to expand its container to accommodate the longest un-wrapped label, breaking a parent container that is supposed to be sized by a different child (the grid).
- **Solution**: Apply `width: 0; min-width: 100%` to the wrapping container. This trick forces the flex container to ignore its children's intrinsic width when the parent is calculating its own `fit-content` size, effectively making the container "follow" the width dictated by other elements (like a fixed-width grid header) while still filling the available 100% once the parent size is decided.

### Unified Item Rendering (Posts as Comments)
- **Problem**: Posts originally had a very different visual style (big headers, no vote buttons in metadata), which made the feed look inconsistent.
- **Solution**: Standardize post metadata to match the comment-meta block. Use a `renderPostMetadata` helper that shares logic with `renderComment` for timestamps, authors, and reactions. This provides a clean, unified "Power Reader" feed experience.

### Inline Styling for Footnotes
- **Problem**: Next.js/React rendering of footnotes often wraps the content in a `<p>` which causes a line break after the `^` backlink, making the UI jumpy.
- **Solution**: Apply `display: inline !important` and `margin: 0 !important` to both the footnote wrapper and any internal paragraphs to force a single-line flow.

### Parent Navigation for Top-Level Comments
- **Context**: Users expect `[^]` to do *something* for top-level comments.
- **Solution**: Map the parent of a top-level comment to the parent Post. This provides a consistent navigation experience rather than having the button be a "no-op".

### Smart Positioning & Viewport Clamping
- **Problem**: When a preview is triggered near the screen edge, centering it on the trigger might cause the preview to overlap the trigger itself, or be "clamped" back into the viewport by the browser, leading to flickering or obscured triggers.
- **Solution**: Implement a `wasClamped` check. If the preview's calculated left/right coordinate was modified to stay within the viewport (`clamp`), AND it still overlaps the trigger's horizontal bounds, force it to the opposite side of the trigger.
- **Gotcha**: A vertical centering typo (`tr.width` instead of `tr.height`) will cause off-center previews that trigger "overlap" logic too easily.

### Visibility 'Logical Catch-22'
- **Problem**: When navigating to or highlighting a parent, if you apply the highlight class (`.pr-parent-hover`) *before* checking visibility, the class itself (which adds a border or background) can cause the element to fail its own visibility check if the border makes it overlap with a floating header.
- **Gotcha**: Even worse, if you use `document.elementFromPoint()`, the element that is highlighted might "block" the sampler from seeing it as the primary element if there are Z-index or margin issues.
- **Solution**: Always perform the **Visibility Check FIRST**, then apply the highlight classes. This ensures a clean sample of the DOM in its "natural" state.

### Technical Hover Stabilization (E2E)
- **Problem**: Hover and preview tests in Playwright are notoriously flaky because the application's "Intentional Hover" check rejects events if the mouse hasn't moved recently OR if a scroll occurred within 300ms.
- **Solution**:
    1. **Scroll Cooldown**: After any scroll or page load, add `page.waitForTimeout(500)` in tests to wait out the intentionality window.
    2. **Explicit Mouse Move**: Use `page.mouse.move(0, 0)` followed by a move to the target's center. 
    3. **Event Dispatch**: Manually dispatching `dispatchEvent('mouseenter')` after moving the mouse is the most reliable way to satisfy both Playwright's hit-testing and the script's `lastMouseMoveTime` requirements.

### Post-Aware Height Measurement for Scrolling
- **Problem**: When jumping to a parent comment or post, using a global sticky header's height as a scroll offset can be inaccurate if you're transitioning between posts with different title lengths (e.g., 1-line vs 3-lines).
- **Solution**: Use **post-aware measurement**. In `smartScrollTo`, identify the target element's parent `.pr-post`, find *its* `.pr-post-header`, and use its specific `offsetHeight`. This ensures the scroll lands exactly where that post's specific header will be stickied.
- **Gotcha**: If you navigate to a post itself, avoid `block: 'center'`. Using `window.scrollTo` to align the `postHeader`'s top with `window.pageYOffset` ensures a perfectly seamless transition to the sticky state (which triggers at `top < 0`).

### CSS Highlight Specificity
- **Problem**: Inline styles (like those used for score or recency colors) take precedence over CSS classes even if both use `!important`. This can cause highlights like `.pr-parent-hover` to be invisible if the element already has a recency color.
- **Solution**: 
  1. Avoid using `!important` in inline styles injected by the renderer if a CSS class needs to override them. 
  2. Use CSS Variables for secondary highlights (like recency) and apply them via a low-priority rule, then override them or use `!important` classes only for high-priority temporary highlights (like hover/parent nav).
  3. Example: `.pr-comment[style*="--pr-recency-color"]` attribute selector shared same specificity as classes, so the order in `styles.ts` matters.

---

## Architecture & State

### Getter Pattern for Dynamic State
- **Problem**: Components (like `ReadTracker` or `ReactionPicker`) that are initialized once but need to access a reactive/updating data source (like `commentsData`) can end up with stale data if it's passed directly as a value.
- **Solution**: Pass a **getter function** `() => commentsData` instead. This ensures that every time the component accesses the data, it gets the most recent reference from the main module's state.

### Document State Persistence in Groups
- **Problem**: When loading post content inline, we must update the global `postsData` set so that if the user performs a re-render (e.g., toggling a preference), the newly loaded content doesn't disappear.
- **Solution**: Push the newly fetched `Post` object into the global `postsData` array and immediately re-render that specific post group. Since `renderUI` also uses this data, the load is persistent across the session.

---

## Testing & Playwright

### Playwright & Userscript Testing
- **Problem**: Userscript APIs (like `GM_xmlhttpRequest`) don't exist in a standard browser. Tests fail when the script tries to run.
- **Solution**: Use `page.addInitScript` to mock these APIs *before* injecting the userscript. For GraphQL, mock the specific responses needed for the UI to render.

### Agent Browser Tool Limitations
- **Problem**: The internal `browser_subagent` tool may fail if environmental variables (like `$HOME`) are not set in its sandbox.
- **Solution**: Fall back to the local Playwright setup via `run_command` in your terminal to generate screenshots and verify UI.

### Greedy Mock Pattern Matching
- **Problem**: In Playwright mocks, using `query.includes('currentUser')` to identify the user query will also match the `GetRecentComments` query, because the latter contains fields like `currentUserVote`. This causes the test to incorrectly return a user object when comments are expected, leading to "Cannot read properties of undefined (reading 'results')" errors.

### Initialization Query Coverage
- **Problem**: Userscripts often fire boilerplate setup queries like `GetSubscriptions` or `GetActiveThreads` during initialization. If your Playwright mock doesn't handle these, the script might hang or throw errors before reaching the code you actually want to test.
- **Solution**: Check the console logs for "Unhandled Mock Query" (if using the helper logs) and ensure all startup queries return at least an empty data structure `{ data: {} }`.

### Mock Fallback Strategy
- **Problem**: Unexpected background requests (e.g. tracking, auto-refresh) can cause mocks to return `undefined`, hanging the `GM_xmlhttpRequest` promise.
- **Solution**: Always include a safe default in your mock handlers: `let responseData: any = { data: {} };`. Only overwrite it if a specific query is matched.

### ID Synchronization
- **Problem**: Mock data IDs (e.g. `postId: 'p1'`) must strictly match the selectors or logic used in the test. 
- **Solution**: Avoid varying ID formats (e.g. mixing `post-1` and `p1`) across different mock objects within the same test suite.

### Playwright Signal Visibility
- **Problem**: `page.waitForSelector('#id')` waits for the element to be visible by default. If your "ready signal" is a hidden div, the test will timeout.
- **Solution**: Always use `await page.waitForSelector('#id', { state: 'attached' })` for hidden signal elements.

### Playwright Strict Mode
- **Problem**: Generic selectors (e.g. `.class-name`) crash if they match multiple elements, whereas jQuery/DOM APIs often just pick the first one.
- **Solution**: Be explicit. Use `.first()` if you truly don't care, or refine the selector to be unique. This catches bugs where duplicate UI components render unexpectedly.

### Test Coverage vs. Reaction Filtering
- **Problem**: Removing a reaction (like "insightful") from the primary section of the picker caused tests to fail because they expected a specific count of elements.
- **Lesson**: If tests rely on `toHaveCount` for UI sections, ensure those sections contain stable sets of elements. Conversely, when scraping dynamic data, tests should be flexible or verify the existence of specific critical items rather than fixed counts.

### Log Retention in CI/Test Reporters
- **Problem**: Running long test suites locally or in CI can generate hundreds of log files, eating up disk space.
- **Solution**: Implement a `cleanupLogs` method in the custom test reporter (`FileReporter.ts`) that reads the `test_logs/` directory and unlinks old files, keeping only a fixed window (e.g., last 50 runs).

### Page Object Model (POM) in Playwright
- **Problem**: E2E tests often contain long, brittle locators (e.g., `page.locator('#power-reader-root .pr-comment').first()`). If the CSS classes change, every test file needs an update.
- **Solution**: Encapsulate locators and common actions (like `waitForReady`) in a `PowerReaderPage` class. This provides a central place for maintenance and allows for cleaner, more expressive test code (`await prPage.getComment(0)`).

### Hover Intent and Playwright Stability
- **Problem**: The "intentional hover" logic relies on detecting a `mousemove` event within a short window (50ms). Playwright's `.hover()` can sometimes trigger too quickly or without a precise enough mouse move to be caught by the script's listeners in high-concurrency environments.
- **Solution**: In tests, always:
    1. Add a small `page.waitForTimeout(500)` after page injection to let the reader settle.
    2. Follow `await locator.hover()` with a slight coordinate move using `page.mouse.move(...)` inside the element's bounding box. This guarantees a `mousemove` event that satisfies the intentionality check.

### Scraping Resiliency in Tests
- **Problem**: Reaction scraping fails in simple test environments because the mock HTML doesn't contain the expected Next.js script bundles.
- **Solution**: The readers falls back to `BOOTSTRAP_REACTIONS` in these cases. If a test specifically requires non-bootstrap reactions (like `laugh`), the mock must either provide the relevant script tags or pre-fill the `power-reader-scraped-reactions` GM storage in `beforeEach`.

### Test Regression: Missing `htmlBody` in `Post` Mock
- **Problem**: Adding logic to check for post content visibility (e.g., in `linkPreviews.ts`) can break existing E2E tests if their mock `Post` objects only contain the `title` and `_id`, but the logic now returns `null` if `htmlBody` is missing.
- **Solution**: Always provide a non-empty `htmlBody` in your test mocks for "Fully Loaded" posts, and specifically test with empty `htmlBody` for header-only (unloaded) scenarios.



### Data Attributes for Test Targeting
- **Problem**: In complex UI tests (like `preview-smart-positioning.ui.spec.ts`), using generic classes like `.pr-find-parent` and relying on `.first()` or `.last()` is brittle. If worker A and worker B both use the same mock HTML, Playwright might get confused or match multiple elements in a way that breaks "Strict Mode".
- **Solution**: Inject unique metadata into the test HTML. Using `data-side="left"` and `data-side="right"` allows locators to be perfectly unambiguous even if the DOM structure is identical across different test cases.

### 429 Rate Limiting in API Tests (Vercel)
- **Problem**: The `tests/api-sanity.spec.ts` suite hits the live `lesswrong.com/graphql` endpoint to verify schema integrity. These requests are frequently blocked by Vercel's security checkpoint with a `429 Too Many Requests` status when using standard Playwright `request` API.
- **Diagnosis**: Check the test log for `[api-sanity] BatchA HTTP 429` or `Vercel Security Checkpoint`.
- **Solution**: We have refactored the test (`api-sanity.spec.ts`) to use `page.evaluate(fetch)` inside a real browser context. This inherits the browser's User-Agent and TLS fingerprint, significantly reducing the chance of being blocked. If failures persist, it indicates a strict IP ban; wait for it to clear or run tests on a different network.
