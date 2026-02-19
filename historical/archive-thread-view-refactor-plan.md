# Archive Thread View → Power Reader Style Refactor Plan

## Goal

Make the archive's **Thread View** render comments identically to the Power Reader's main view — with nested reply trees, voting/reaction controls, metadata styling (score colors, font sizing), collapse/expand, action buttons ([g], [r], [t], [^], [−], [+]), and all the per-comment CSS classes (`.pr-comment`, `.pr-item`, etc.).

Currently the archive thread view has its own bespoke rendering in `archive/render.ts::renderThreadItem()` that produces a flat list with basic "parent context" blocks. The Power Reader, by contrast, uses `render/comment.ts::renderComment()` and `render/post.ts::renderPostGroup()` to produce a rich, interactive, nested tree.

---

## Current Architecture Comparison

### Power Reader (`render/`)
- **`render/post.ts::renderPostGroup(group, state)`** — Renders a post header + nested comment tree.
  - Calls `withMissingParentPlaceholders()` to fill gaps in the tree.
  - Calls `buildChildrenIndex()` to create parent→children map.
  - Calls `renderCommentTree()` recursively.
- **`render/comment.ts::renderComment(comment, state, repliesHtml)`** — Renders a single comment with:
  - Score-based background color, font sizing, recency highlighting.
  - Read/unread state and placeholder collapsing for read subtrees.
  - Full metadata bar via `renderMetadata()` (votes, reactions, author prefs).
  - Action controls: `[g]`, `[r]`, `[t]`, `[^]`, `[−]`, `[+]`.
  - CSS classes: `pr-comment pr-item read|unread rejected context reply-to-you collapsed`.
  - `data-*` attributes for event delegation (`data-id`, `data-author`, `data-parent-id`, `data-post-id`).
- **Depends on `ReaderState`** for:
  - `commentById`, `childrenByParentId` (indexes for tree traversal).
  - `currentUsername` (reply-to-you detection).
  - `subscribedAuthorIds` (author preference defaults).

### Archive Thread View (`archive/render.ts`)
- **`renderThreadItem(item, itemById)`** — Flat rendering per item:
  - If post → delegates to `renderCardItem()` (simple metadata + body).
  - If comment → traverses `itemById` upward to find parent chain, renders parents as simple `<div class="pr-thread-parent">` blocks with no interactivity.
  - Wraps in `<div class="pr-thread-wrapper">` with post context header.
  - Uses `renderCardItem()` for the target comment (basic metadata, no controls).
- **`ensureContextForItems()`** — Fetches missing parent comments into `itemById`.
- **No `ReaderState`** — uses a simple `Map<string, Post | Comment>` (`itemById`).

### Key Gaps
| Feature | Power Reader | Archive Thread |
|---------|-------------|---------------|
| Nested comment tree | ✅ Recursive `renderCommentTree` | ❌ Flat parent summary |
| Vote buttons (▲▼✓✗) | ✅ Interactive | ❌ Display only via `renderMetadata` |
| Reaction chips | ✅ Interactive | ❌ Display only |
| Score coloring | ✅ Computed per comment | ❌ None |
| Font sizing | ✅ Based on karma | ❌ None |
| Read/unread state | ✅ Tracked + placeholder collapse | ❌ N/A |
| [g][r][t][^][−][+] controls | ✅ Full set | ❌ None |
| Recency highlighting | ✅ CSS var | ❌ None |
| Post header with actions | ✅ `renderPostHeader()` | ❌ Simple link |
| Author preference indicators | ✅ ↑↓ with active state | ❌ None |
| Event delegation | ✅ Full system | ❌ None for thread items |

---

## Refactor Plan

### Phase 1: Refactor `navigation.ts` — Split, Consolidate, Reduce Tech Debt

**Why do this first:** `navigation.ts` is a 1067-line god file mixing DOM manipulation, server data fetching, state mutation, and re-rendering. It has 3 different ways to re-render a post group, 2 different ways to insert comments, and no centralized way to upsert posts. Cleaning this up first makes Phase 2 trivially mechanical AND reduces tech debt.

**Current function inventory (23 exported + 7 private):**

```
DOM-only (no state mutation, no server calls):
  44: collapsePost               — collapse post DOM
  56: expandPost                 — expand post DOM  
  65: syncPostToggleButtons      — sync collapse/expand button visibility (private)
  89: handlePostCollapse         — find post from target, call collapsePost
 118: handlePostExpand           — find post from target, call expandPost
 143: handleCommentCollapse      — collapse comment DOM
 151: handleCommentExpand        — expand comment DOM
 184: handleCommentCollapseToggle — toggle comment collapse
 350: handleReadMore             — expand truncated post body
 719: handleScrollToPostTop      — scroll to post header (+ toggle on double-tap)
 752: handleScrollToComments     — scroll to first comment
 761: handleScrollToNextPost     — scroll to next post
 986: handleScrollToRoot         — scroll to root comment

State mutation + re-render (no server calls):
 159: handleExpandPlaceholder    — forceVisible + reRenderPostGroup
 314: handleAuthorUp             — toggleAuthorPreference + renderUI
 332: handleAuthorDown           — toggleAuthorPreference + renderUI

Server fetch + state mutation + re-render:
 198: handleFindParent           — fetch parent comment, merge, re-render (COMPLEX: 112 lines, inline render path, renderUI fallback)
 495: handleLoadPost             — fetch post, upsert, inline re-render (62 lines)
 558: handleTogglePostBody       — fetch post or toggle DOM, upsert, re-render (117 lines, overlaps with handleLoadPost)
 676: handleLoadAllComments      — fetch all comments, merge, re-render
 773: handleLoadThread           — walk parent chain + fetch thread, merge, re-render
 836: handleLoadParents          — walk parent chain, merge, re-render
 910: handleLoadDescendants      — walk parent chain + fetch thread, merge, re-render
1013: handleLoadParentsAndScroll — handleLoadParents + scroll to root

Private utilities:
 370: reRenderPostGroup          — re-render a single post group (core render function)
 433: mergeComments              — deduplicated comment insertion + rebuildIndexes
 446: getPostIdFromTarget        — DOM traversal helper
 453: getCommentIdFromTarget     — DOM traversal helper
 458: findTopLevelAncestorId     — state traversal helper
 474: markAncestorChainForceVisible — state traversal helper
```

#### Step 1: Split into 3 files

Split `events/navigation.ts` into:

**`events/domActions.ts`** (~200 lines) — Pure DOM manipulation, no state or server:
- `collapsePost`, `expandPost`, `syncPostToggleButtons`
- `handlePostCollapse`, `handlePostExpand`
- `handleCommentCollapse`, `handleCommentExpand`, `handleCommentCollapseToggle`
- `handleReadMore`
- `handleScrollToPostTop` (note: calls `handleTogglePostBody` on double-tap — this cross-dependency stays as an import)
- `handleScrollToComments`, `handleScrollToNextPost`, `handleScrollToRoot`
- `getPostIdFromTarget`, `getCommentIdFromTarget` (DOM traversal helpers, shared)

**`events/stateOps.ts`** (~80 lines) — State mutation + utilities, no server calls, no rendering:
- `mergeComments` — deduplicated comment insertion + `rebuildIndexes`
- `upsertPost` — (new, extracted from scattered sites)
- `reRenderPostGroup` — re-render a single post group with viewport preservation
- `findTopLevelAncestorId` — state traversal
- `markAncestorChainForceVisible` — state traversal

**`events/serverActions.ts`** (~500 lines) — Server fetch + state mutation + re-render:
- `handleFindParent`
- `handleExpandPlaceholder`
- `handleAuthorUp`, `handleAuthorDown`
- `handleLoadPost`, `handleTogglePostBody`
- `handleLoadAllComments`
- `handleLoadThread`, `handleLoadParents`, `handleLoadDescendants`
- `handleLoadParentsAndScroll`

**`events/navigation.ts`** — becomes a thin re-export barrel (~20 lines):
```typescript
export { collapsePost, expandPost, handlePostCollapse, handlePostExpand, ... } from './domActions';
export { handleFindParent, handleLoadPost, ... } from './serverActions';
```

This preserves the existing import interface (`import { handleFoo } from './navigation'`) so `events/index.ts` needs zero changes initially, and they can be migrated to direct imports later.

#### Step 2: Consolidate render paths (within `stateOps.ts` / `serverActions.ts`)

Same as before — route all inline `renderPostGroup` calls through `reRenderPostGroup`:

- **`handleFindParent` (line 272-281):** Replace inline `postContainer.outerHTML = renderPostGroup(group, state)` + `setupLinkPreviews` with `reRenderPostGroup(postId, state)`. Keep the `setTimeout` scroll-to-parent logic after. Remove the `renderUI(state)` fallback at line 295 — replace with `reRenderPostGroup` (it already handles missing containers with a warning log).

- **`handleLoadPost` (line 537-548):** Replace inline group construction + render + `setupLinkPreviews` with `reRenderPostGroup(postId, state)`.

#### Step 3: Consolidate comment insertion paths (within `serverActions.ts`)

Route all direct `state.comments.push()` + `rebuildIndexes()` through `mergeComments`:

- **`handleFindParent` line 262:** Flags are set before push → `mergeComments([parentComment], state, true)`.
- **`handleLoadThread` line 799:** `mergeComments([parent], state, true)`.
- **`handleLoadDescendants` line 937:** `mergeComments([parent], state, true)`.

#### Step 4: Extract `upsertPost` function (into `stateOps.ts`)

```typescript
export const upsertPost = (post: Post, state: ReaderState): void => {
  if (!state.postById.has(post._id)) {
    state.posts.push(post);
  } else {
    const idx = state.posts.findIndex(p => p._id === post._id);
    if (idx >= 0) state.posts[idx] = post;
  }
  state.postById.set(post._id, post);
};
```

Replace all 5 scattered mutation sites in `handleLoadPost` and `handleTogglePostBody`.

#### Step 5: Deduplicate `handleLoadPost` / `handleTogglePostBody`

These two functions share ~40 lines of identical "fetch post → upsert → re-render → expand body" logic. Extract a shared helper:

```typescript
const fetchAndRenderPost = async (
  postId: string, 
  state: ReaderState
): Promise<Post | null> => {
  const res = await queryGraphQL<GetPostQuery, GetPostQueryVariables>(
    GET_POST_BY_ID, { id: postId }
  );
  const post = res?.post?.result as unknown as Post;
  if (!post) return null;
  upsertPost(post, state);
  reRenderPostGroup(postId, state);
  return post;
};
```

Then `handleLoadPost` and `handleTogglePostBody` both call this, and add their own post-render logic (expand body, scroll, update button state).

#### Step 6: Fix the hotkey `<select>` guard

In `hotkeys.ts` line 15, add `target.tagName === 'SELECT'` to the early return.

#### Step 7: Clean up `handleFindParent`

This function is 112 lines with deeply nested if/else branches (3 cases: parent in DOM, parent is placeholder, parent not in DOM). Simplify by extracting early returns:

```typescript
// Case 1: Top-level → navigate to post header
if (!parentId) { ... return; }
// Case 2: Parent in DOM and visible → scroll + highlight
const parentEl = document.querySelector(...)
if (parentEl && !isPlaceholder) { ... return; }
// Case 3: Parent is a read placeholder → expand + scroll
if (parentEl && isReadPlaceholder) { ... return; }
// Case 4: Parent not in DOM → fetch from server
...
```

This flattens the nesting and makes the 4 cases explicit.

#### Verification

After Phase 1:
- The Power Reader should behave identically — all changes are structural, not behavioral.
- `navigation.ts` shrinks from 1067 lines to ~20 (re-export barrel).
- The mutation surface is consolidated into 4 functions in `stateOps.ts`: `mergeComments`, `upsertPost`, `reRenderPostGroup`, and `renderUI` (still imported from `render/index.ts`).
- `events/index.ts` requires zero changes (imports still work via barrel).
- Phase 2 then becomes: move the 4 mutation functions from `stateOps.ts` behind the UIHost interface.

### Phase 2: Introduce a "UI Host" Abstraction for Re-render Callbacks

**Problem:** After Phase 1, `navigation.ts` has 4 consolidated mutation/render functions. But they're still hard-coded to the Power Reader's state model and render pipeline. In archive context, `renderUI()` would obliterate the entire archive DOM.

**Solution:** Create a `UIHost` interface that wraps the 4 consolidated functions. Navigation handlers call through UIHost instead of directly.

**Files to modify:** New file `render/uiHost.ts`, then `events/navigation.ts`

```typescript
// render/uiHost.ts
export interface UIHost {
  rerenderAll(): void;
  rerenderPostGroup(postId: string, anchorCommentId?: string): void;
  mergeComments(comments: Comment[], markAsContext?: boolean): number;
  upsertPost(post: Post): void;
}

let activeHost: UIHost | null = null;
export const setUIHost = (host: UIHost) => { activeHost = host; };
export const getUIHost = (): UIHost => {
  if (!activeHost) throw new Error('No UI host registered');
  return activeHost;
};
```

- **Power Reader host:** `rerenderAll` calls `renderUI(state)`, `rerenderPostGroup` calls the existing local `reRenderPostGroup` (which internally calls `setupLinkPreviews` + `refreshPostActionButtons` as post-render hooks), `mergeComments` calls existing `mergeComments` + `rebuildIndexes`, `upsertPost` updates `state.posts`/`state.postById` + `rebuildIndexes`.
- **Archive host:** `rerenderAll` calls `refreshView()`, `rerenderPostGroup` re-renders just that group within the archive feed + calls `setupLinkPreviews` + `refreshPostActionButtons`, `mergeComments` updates both `ArchiveState.items`/`itemById` AND the `ReaderState` projection then calls `rebuildIndexes`, `upsertPost` updates both `ArchiveState` and the `ReaderState` projection.
- **Both hosts' `rerenderPostGroup`** must include viewport-preservation logic (save anchor element's `getBoundingClientRect().top` before render, adjust `scrollY` after) — currently baked into the local `reRenderPostGroup` function. Extract this as a shared utility.

This is the single most important change — it decouples navigation from Power Reader page ownership.

**After Phase 1, the routing is simple — just 4 substitutions:**

| Consolidated function | → UIHost method |
|----------------------|-----------------|
| `renderUI(state)` (3 calls) | `getUIHost().rerenderAll()` |
| `reRenderPostGroup(postId, state, anchor?)` (all calls) | `getUIHost().rerenderPostGroup(postId, anchor)` |
| `mergeComments(comments, state, markAsContext?)` (all calls) | `getUIHost().mergeComments(comments, markAsContext)` |
| `upsertPost(post, state)` (all calls) | `getUIHost().upsertPost(post)` |

### Phase 3: Create a Shared `ReaderState` + Canonical State Strategy

**Problem:** The archive has `ArchiveState` with `items[]` and `itemById`, while `renderComment`/`renderPostGroup` require `ReaderState` with `comments[]`, `commentById`, `childrenByParentId`, etc. When `[r]`/`[t]` fetch new comments, `mergeComments` pushes to `state.comments` and calls `rebuildIndexes`, but `ArchiveState.items`/`itemById` wouldn't be updated — causing divergence.

**Strategy: `ArchiveState` is canonical; `ReaderState` is a derived projection.**

**Files to modify:** `archive/state.ts`

1. Add a stable `readerState: ReaderState` field on `ArchiveState` (created once in `createInitialArchiveState`, never replaced).
2. Add `rebuildReaderState(state: ArchiveState): void` that **mutates the existing `readerState` object in place** (reassigns `.comments`, `.posts`, clears and repopulates maps). This is critical: `attachEventListeners(readerState)` captures the object reference in a closure — if you replace the object, handlers reference stale state. The function:
   - Separates `items` into `comments` and `posts`.
   - Populates `commentById`, `postById`, `childrenByParentId` (reuse `rebuildIndexes` from `state.ts`).
   - Sets `currentUsername`/`currentUserId` from the logged-in user. Note: archive init already calls `initializeReactions()` but the current user info is fetched separately in the Power Reader's `loader.ts` via a GraphQL query. The archive will need its own small query or share the same mechanism.
   - `subscribedAuthorIds` is populated via a GraphQL subscriptions query in `services/loader.ts` (lines 267-270). For archive, leave as empty set initially — this only affects default author-preference indicators for subscribed users, which is cosmetic. Can be populated later if needed.
3. The archive's `UIHost.mergeComments` implementation:
   - Adds to `ArchiveState.items` and `itemById`.
   - Then calls `rebuildReaderState()` to keep the projection in sync.
   - This is the **single source of truth** contract.

### Phase 4: Group Archive Comments by Post for Thread View

**Files to modify:** `archive/render.ts`

1. In `renderArchiveFeed()`, when `viewMode === 'thread'`:
   - Separate visible items into posts and comments.
   - Run `ensureContextForItems()` first to fetch **real** parent comment bodies from the API (do NOT remove this — `withMissingParentPlaceholders` only creates empty stubs for structural integrity, not real content).
   - After context is loaded, add fetched context to `ArchiveState` (via the UIHost's `mergeComments`).
   - Group comments by `postId` into `PostGroup[]`.
   - For each group, call `renderPostGroup(group, readerState)`.
2. Remove `renderThreadItem()` — replaced by `renderPostGroup()`.
3. Keep `ensureContextForItems()` but adapt it to also update `ArchiveState` (not just `itemById`).

### Phase 5: Disable Read-State Tracking for Archive (But Make It Easy to Enable)

**Problem:** `renderComment` calls `getReadState()` from `GM_getValue` — a global store shared with the Power Reader. If the user has read comments in the main reader, archive would inherit that state: collapsing read comments into placeholders and auto-hiding low-score items. This is surprising for archive browsing.

**Solution:** Add an `archiveMode` flag (or similar) that disables read/auto-hide behavior.

**Files to modify:** `render/comment.ts`, `utils/storage.ts` (or a new config flag)

Add a global flag `window.__PR_ARCHIVE_MODE__ = true` set by archive init.
   - In `renderComment`: when archive mode is on, force `readState = {}` and `showAsPlaceholder = false`.
   - In `shouldAutoHide`: skip when archive mode is on.
   - `forceVisible` already exists per-comment; archive mode is the blanket version.
   - To enable read tracking later: just remove/namespace the flag. The infrastructure stays the same.

### Phase 6: Make `attachEventListeners` Idempotent + Wire Up for Archive

**Problem:** `attachEventListeners` adds `document.addEventListener` unconditionally. Calling it twice causes double-firing (vote then immediately un-vote, etc.). Also, `attachHotkeyListeners` may interfere with archive search inputs.

**Files to modify:** `events/index.ts`, `archive/index.ts`

1. Add a guard: use an `AbortController` stored module-level. On re-attach, abort the previous controller first, then re-attach with new signal.
   ```typescript
   let eventsAbort: AbortController | null = null;
   export const attachEventListeners = (state: ReaderState): void => {
     if (eventsAbort) eventsAbort.abort();
     eventsAbort = new AbortController();
     const signal = eventsAbort.signal;
     document.addEventListener('mousedown', (e) => { ... }, { signal });
     // etc.
   };
   ```
2. Hotkey listeners should ignore events when focus is in `<input>`, `<textarea>`, or `<select>` elements (archive toolbar has these). Verify `attachHotkeyListeners` already does this — if not, add the guard.
3. In `archive/index.ts`: call `attachEventListeners(readerState)` once during init (not on every re-render). Keep the `readerState` reference stable (mutated in place, not recreated).
4. Note: `main.ts` already has a guard (`root.dataset.listenersAttached`, line 160) that prevents double-attachment in the Power Reader. With the AbortController approach, this guard becomes redundant — remove it during Phase 2 refactor for consistency.

### Phase 7: Feature Setup for Archive Thread View

**Files to modify:** `archive/index.ts`

1. **Call after thread render (once, with idempotency guards):**
   - `setupLinkPreviews(comments)` — LW link hover previews.
   - `setupExternalLinks()` — opens external links in new tab.
   - `setupStickyHeader()` — sticky post header on scroll.
   - `setupInlineReactions(readerState)` — text-select → react.
   - `refreshPostActionButtons()` — updates [e]/[a] disabled states.
2. **Skip:**
   - `setupScrollTracking()` — marks items as read (disabled per decision #3 Decision 3).
3. **Idempotency:** These feature-setup functions may also attach global handlers. Apply same AbortController/guard pattern where needed. For `setupStickyHeader`, verify it doesn't conflict with the archive toolbar layout.

### Phase 8: Styles

**Files to modify:** `archive/index.ts`

1. Remove archive thread-specific CSS classes (`.pr-thread-wrapper`, `.pr-thread-parent`, `.pr-thread-parent-meta`, `.pr-thread-parent-body`, `.pr-thread-root-post`) — no longer used.
2. The main `styles.ts` already has all needed styles (`.pr-comment`, `.pr-post`, etc.) via `rebuildDocument()`.
3. Keep archive-specific styles for card/index views and toolbar/error UI.

### Phase 9: Handle Sorting in Thread View

**Files to modify:** `archive/render.ts`, `archive/index.ts`

1. In thread view, the dropdown sorts apply to **group ordering** (not individual items):
   - **Date (Newest/Oldest):** Sort groups by `max(comment.postedAt)` within each group.
   - **Karma (High/Low):** Sort groups by `max(baseScore)` among root comments in each group.
   - **Reply To (Name):** Disable or hide this option when thread view is active (no meaningful group-level equivalent).
2. **Within-group sort:** Handled by `renderPostGroup` using tree-karma (existing behavior).
3. Update UI: when switching to thread view, either hide or gray out "Reply To" sort option.

---

## Detailed File Changes

### New: `render/uiHost.ts`
- Define `UIHost` interface with `rerenderAll`, `rerenderPostGroup`, `mergeComments`, `upsertPost`.
- Module-level `setUIHost`/`getUIHost` accessors.

### `events/navigation.ts` → split into 3 files + barrel
- **Phase 1:** Split into `domActions.ts`, `stateOps.ts`, `serverActions.ts`. `navigation.ts` becomes a re-export barrel. Consolidate render paths, comment insertions, post mutations. Deduplicate `handleLoadPost`/`handleTogglePostBody`. Flatten `handleFindParent`.
- **Phase 2:** In `stateOps.ts`, replace 4 consolidated functions with `getUIHost().*` calls. Move function bodies into Power Reader's UIHost implementation.

### `events/hotkeys.ts`
- **Phase 1:** Add `target.tagName === 'SELECT'` to the input guard (line 15).

### `events/index.ts`
- **Phase 6:** Add `AbortController`-based idempotency to `attachEventListeners`.
- `attachHotkeyListeners` already guards against input/textarea/contentEditable (verified in `hotkeys.ts` lines 14-16). However, it does NOT guard `<select>` — add `target.tagName === 'SELECT'` to the guard. Archive toolbar has a `<select>` for sort/view mode.

### `archive/state.ts`
- Add `readerState: ReaderState` field.
- Add `rebuildReaderState()` function.
- Phase 3: ReaderState projection from ArchiveState.
- Populate `currentUsername`, `subscribedAuthorIds` from shared storage.

### `archive/render.ts`
- **Phase 4:** Rewrite `viewMode === 'thread'` branch to group items and call `renderPostGroup`.
- Remove `renderThreadItem()`.
- **Phase 9:** Implement group-level sorting logic for thread view.
- Keep `ensureContextForItems()` — adapt to update `ArchiveState` too.

### `archive/index.ts`
- **Phase 2:** Register archive `UIHost` via `setUIHost()`.
- **Phase 6:** Call `attachEventListeners(readerState)` once during init.
- **Phase 7:** Feature setup once (link previews, sticky header, etc.).
- **Phase 8:** Styles cleanup (remove obsolete CSS).
- **Phase 9:** Update sort dropdown handlers to trigger re-grouping in thread view.

### `render/comment.ts`
- Phase 5: Archive-mode read-state guard.
- Add archive-mode guard to skip read-state/auto-hide logic.

### `render/post.ts` (no changes expected)

### `main.ts` or Power Reader init
- Phase 2: Register Power Reader `UIHost` via `setUIHost()`.
- Register Power Reader `UIHost` via `setUIHost()`.

---

## Risks & Considerations

1. **`renderUI()` hard-calls are a critical blocker.** If not addressed via UIHost (Phase 2), `handleAuthorUp/Down` and `handleFindParent` fallback will destroy the archive page. This is the #1 priority.

2. **State divergence between `ArchiveState` and `ReaderState`** when `[r]`/`[t]` fetch new comments. The UIHost's `mergeComments` must update both. If only `ReaderState.comments` grows, switching to card/index view will show stale data.

3. **Read state is global.** Without the archive-mode guard, comments the user has read in the main Power Reader will appear as collapsed placeholders in the archive. The `shouldAutoHide` function may also collapse low-score comments unexpectedly.

4. **Posts may not be fully loaded.** `renderPostGroup` degrades when `fullPost` is missing (no body, minimal header). Archive comments embed `comment.post` with title/URL, but the full post body/metadata may be absent. Consider fetching posts lazily on `[e]` click (already handled by `handleTogglePostBody`/`handleLoadPost`).

5. **Auth for voting/reactions.** If the user isn't logged in, GraphQL mutations will fail. The archive should detect the logged-in user during init and set `state.currentUserId`/`currentUsername`. Vote/reaction controls will render regardless but will fail gracefully on click.

6. **Render limit + grouping semantics.** The archive's render limit currently caps the flat item list. In thread view, cutting at a render limit may split a post group. Options: (a) apply limit to groups, not items, (b) apply limit to items and include only complete groups up to the limit, (c) accept partial groups. Option (b) is simplest and most predictable.

7. **Feature setup idempotency.** `setupStickyHeader`, `setupInlineReactions`, `setupLinkPreviews` may also attach global handlers. Need to verify and guard against double-attachment, especially when switching between view modes.

8. **Hotkey interference.** Archive has a search input, sort dropdown, and other interactive elements. `attachHotkeyListeners` guards input/textarea/contentEditable but NOT `<select>` (verified in `hotkeys.ts` lines 14-16). Add `target.tagName === 'SELECT'` to the guard.

9. **`ReaderState` reference stability.** `attachEventListeners(readerState)` captures the object in a closure. `rebuildReaderState()` must mutate the existing object's fields (reassign `.comments`, `.posts`, clear and repopulate maps) — NOT create a new `ReaderState` object. If the reference changes, all event handlers silently operate on stale state. This is documented in Phase 3 but is easy to get wrong during implementation.

10. **Navigation handlers set flags on comments BEFORE calling merge/re-render.** For example, `handleLoadDescendants` (lines 953-956) sets `forceVisible = true` and `justRevealed = true` on each fetched comment, then calls `mergeComments`, then sets the flags again on the state copies. The UIHost's `mergeComments` must not clone comments (which would lose the flags) — it should store the same object references.

---

## Implementation Order

1. **Phase 1** — Split + consolidate `navigation.ts` (7 steps) (~3 hours)
2. **Phase 2** — UIHost abstraction (~1 hour)
3. **Phase 3** — `ReaderState` projection from `ArchiveState` (~1 hour)
4. **Phase 4** — Rewrite thread view rendering to use `renderPostGroup()` (~1.5 hours)
5. **Phase 5** — Archive-mode read-state guard (~30 min)
6. **Phase 6** — Make `attachEventListeners` idempotent + wire up (~1 hour)
7. **Phase 7** — Feature setup (link previews, sticky header, inline reactions) (~1 hour)
8. **Phase 8** — Clean up styles (~15 min)
9. **Phase 9** — Sorting adjustments (~30 min)

Total estimate: ~11-12 hours (2-3 days)

### Implementation Strategy: Sequential Phases with Verification

**Do NOT implement all phases in a single pass.** Each phase touches shared code and must be verified before the next builds on it. Recommended groupings:

1. **Phase 1 alone** — Consolidate `navigation.ts`. Purely behavioral-preserving refactor. Verify the Power Reader works identically — this is the lowest-risk, highest-leverage prep work.
2. **Phase 2 alone** — UIHost abstraction. Again verify the Power Reader works identically — no behavioral change, just indirection. This is the foundation everything else depends on.
3. **Phase 3 + 4 + 5 together** — ReaderState adapter, thread view rendering, archive-mode flag. These are tightly coupled and can be tested together by switching to thread view in the archive.
4. **Phase 6 + 7 together** — Event delegation + feature setup. Verify voting, reactions, [r]/[t], collapse/expand, sticky header all work in archive thread view.
5. **Phase 8 + 9 together** — Style cleanup + sorting. Low risk, can be done last.

Between each group, manually test by loading an archive and verifying the thread view renders correctly and interactivity works. Also verify the main Power Reader is not broken.

---

## Codebase Architecture Assessment

**Overall:** The codebase is well-organized at the module level — clear separation between render components (metadata, body, actions), event delegation, features, and utilities. The `PostGroup` abstraction, the render component split, and the event delegation pattern are all solid.

**Main architectural weakness:** `events/navigation.ts` (1067 lines) is a god file that mixes three concerns: (1) DOM manipulation (collapse/expand, scroll), (2) server data fetching (GraphQL queries for posts, comments, threads), and (3) state mutation + re-rendering. This coupling is the root cause of why the archive refactor is complex — you can't reuse the data-fetching logic without also pulling in the render pipeline. Phase -1 fully addresses this by splitting into `domActions.ts`, `stateOps.ts`, and `serverActions.ts`.

## Pre-existing Issues Found During Review

These are bugs or code-quality issues in the existing Power Reader code, independent of the archive refactor. Issues #1–3 are fully fixed by Phase -1. Issue #4 is fixed by Phase 0. Others can be fixed opportunistically or tracked separately.

1. ~~**`handleFindParent` has a redundant inline render path (line 272-278).**~~ Fixed by Phase -1 Step 2.

2. ~~**`handleFindParent` fallback calls `renderUI(state)` (line 295).**~~ Fixed by Phase -1 Step 2 + Step 7.

3. ~~**`handleLoadPost` and `handleTogglePostBody` have heavily duplicated logic.**~~ Fixed by Phase -1 Step 5.

4. ~~**`reRenderPostGroup` post-render hooks tightly coupled.**~~ Fixed by Phase 0 — hooks move into UIHost's `rerenderPostGroup` implementation.

5. **`sanitizeBodySimple` in `archive/render.ts` (line 245-248) is misleadingly documented.** Comment says "We might want a 'micro' renderBody" but it just calls the full `renderBody`. Dead code after this refactor (used only by `renderThreadItem` which is being removed).

6. **Widespread `any` types in `archive/index.ts`:** `sortItems` (line 643), `syncArchive` state parameter, `refreshView` filter closures all use `any` instead of `Post | Comment`. Not blocking but worth cleaning up.

7. **`withMissingParentPlaceholders` uses `as any` cast (line 79 of `render/post.ts`):** `placeholder.parentCommentId = ancestor.parentCommentId as any` — type mismatch that should be fixed properly.

---

## Decisions

1. **Voting/reactions:** ✅ Yes, fully interactive.
2. **[r]/[t] buttons:** ✅ Yes, should work (fetch from server, re-render).
3. **Read-state tracking:** ❌ No, but architect it so it's easy to enable later (e.g., a flag/option).
4. **Sticky header:** ✅ Yes.
5. **Sort modes:** Use the existing dropdown to control group ordering in thread view.
