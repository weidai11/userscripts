# Archive Search/Sort UI/UX Review & Redesign Proposals

**Date**: 2026-02-18  
**Scope**: Toolbar controls for search, sort, scope, and view mode in the User Archive  
**Source files reviewed**:
- `src/scripts/power-reader/archive/index.ts` (toolbar HTML, event wiring, search status)
- `src/scripts/power-reader/archive/render.ts` (feed rendering, index/card/thread views)
- `src/scripts/power-reader/archive/state.ts` (state model)
- `src/scripts/power-reader/archive/search/urlState.ts` (URL state sync)
- `src/scripts/power-reader/archive/search/types.ts` (search type definitions)
- `src/scripts/power-reader/styles.ts` (global styles)
- `archive/archive-search-greenfield.md` (spec)

---

## 1. Current State Summary

### Toolbar Layout (lines 285–309 of `index.ts`)

The current toolbar is a single wrapping `<div class="pr-archive-toolbar">` containing five inline controls in a flex row:

```
[ Search Input (flex:2) ] [ Scope ▾ ] [ Sort ▾ ] [ View ▾ ] [ Resync ]
```

Below it, a `<div id="archive-search-status">` shows either help text, warnings, or result-count metadata.

### What Works

| Aspect | Assessment |
|--------|-----------|
| **Query language power** | Excellent — full structured syntax (`author:`, `date:`, `score:`, regex, phrases) is a genuine differentiator. |
| **URL state sync** | Solid — query, sort, and scope are all URL-persisted and shareable. Oversized queries fall back to session storage with pointer params. |
| **Debounced live search** | Good UX — 180ms trailing debounce with immediate dispatch on Enter. |
| **Search status feedback** | Adequate — parse warnings, partial-result badges, and scope context hints are all surfaced. |
| **Sort mode disable in thread view** | Good — "Reply To" and "Relevance" options are correctly disabled when thread view is active. |
| **Large dataset guard** | Useful — the render-count dialog prevents browser freeze on 10k+ results. |

---

## 2. Problems & Friction Points

### 2.1 🔴 Discoverability of Query Language (Critical)

**Problem**: The query language is the single most powerful feature of the archive, but it's almost invisible. The search input's placeholder text is extremely long and gets truncated on most resolutions:

```
Search terms, "phrases", /regex/, author:, replyto:, type:, score:, date:, scope:
```

The tooltip (on hover, set via `input.title`) is only visible after ~1 second of hovering and shows a plain-text multi-line string — easy to miss entirely. The status line below defaults to a similarly dense, single-line hint:

```
Search tips: terms, "phrases", /regex/i, author:, replyto:, type:post|comment, score:>10, date:2025-01-01..2025-01-31, scope:all
```

**Impact**: New users will not discover operators. Power users can't quickly refresh their memory of the date range syntax without trial and error.

**Redesign proposal**:

1. **Collapsible syntax cheatsheet** — Add a `<details>` element (matching the existing `.pr-help` style) below the search bar, with a summary toggle like _"📖 Search syntax reference"_. When expanded, show a two-column table of operators with live examples that are clickable to insert into the search bar.

2. **Placeholder simplification** — Replace the long placeholder with a short, friendly prompt:
   ```
   Search by keyword, "phrase", or operator...
   ```

3. **Inline autocomplete hints** — When the user types a known prefix (e.g., `author:`, `date:`), show a transient inline tooltip below the input displaying the expected value format. This can be a simple `<div>` positioned relative to the search container that appears on `input` events when the cursor is adjacent to an operator token.

4. **Status line as contextual guide** — When the search input is empty and focused, show the help text. Once the user starts typing, the status line should switch to showing parse diagnostics or result count. Currently the help text persists until search results arrive, which is correct but could be more intentional.

---

### 2.2 🟡 Toolbar Crowding and Visual Weight (Moderate)

**Problem**: Five inline controls on one flex row creates visual clutter, especially on narrower viewports. The `<select>` elements all use browser-default styling with no icons, labels, or visual grouping to indicate what each dropdown controls.

Current visual hierarchy is flat — every control has equal weight, but Sort and Scope are secondary to Search.

**Redesign proposal**:

1. **Two-tier toolbar** — Split the toolbar into a primary row (search input + most-used action) and a secondary row (scope, sort, view mode):

   ```
   ┌──────────────────────────────────────────┐
   │  Row 1:  [ 🔍 Search ···················· ] [Resync]  │
   │  Row 2:  [Scope ▾] [Sort ▾] [View ▾]  (N results)    │
   └──────────────────────────────────────────┘
   ```

2. **Labeled dropdowns** — Prefix each `<select>` with a visible `<label>` or icon to eliminate ambiguity:
   - 🌐 Scope: `Authored` / `Authored + Context`
   - ↕ Sort: `Date (Newest)` / etc.
   - 👁 View: `Card` / `Index` / `Thread (Full)` / `Thread (Placeholder)`

3. **Segmented-control for Scope** — Since Scope has only two values, replace the dropdown with a toggle/segmented button:
   ```
   [ Authored | All ]
   ```
   This reduces one click and makes the current state immediately visible.

4. **Segmented-control or icon tabs for View Mode** — View mode also has a small, fixed set of options. Consider an icon-based toggle strip:
   ```
   [ 🃏 ] [ ≡ ] [ 🌲 ] [ 🌲· ]
    Card   Index  Thread  Thread
                  (Full) (Placeholder)
   ```
   With tooltips on hover. This eliminates the need for a dropdown and gives instant visibility of the current view.

---

### 2.3 🟡 Scope and Sort Conceptual Overlap with Query Language (Moderate)

**Problem**: The `scope:` and `sort:` are already part of the search spec's URL model, yet `scope:` can also be specified inside the query text itself. The spec defines precedence rules (URL `scope` param wins over in-query `scope:`), but this duality is confusing:

- Typing `scope:all` in the search bar _changes the Scope dropdown_ as a side effect.
- Users don't know whether to use the dropdown or the query text.
- The in-query `scope:` is immediately canonicalized out and pushed to the URL param, so it disappears from the search input on reload — breaking the mental model of "what I type is what I see."

**Redesign proposal**:

1. **Remove `scope:` from query grammar for v1 UI** — Keep the in-query `scope:` parsing for API/URL compatibility, but in the UI, consistently guide users toward the dropdown/toggle. When `scope:all` is detected in the query text, quietly extract it and update the dropdown rather than showing a dual-intent query.

2. **Move result count to the secondary toolbar row** — Currently the count appears in the `pr-status` line at the top of the page (near the header `h1`), separated from the search controls. Moving it adjacent to the toolbar gives tighter feedback:
   ```
   Row 2: [Scope ▾] [Sort ▾] [View ▾]   423 results • 3.2ms
   ```

---

### 2.4 🟡 Sort Mode `relevance` Confuses Users (Moderate)

**Problem**: "Relevance" is the first option in the sort dropdown. However:
- With an empty query, "relevance" degenerates to chronological order, which is unintuitive.
- The relevance scoring model is simple (token/phrase match + recency tie-break) and there's no explain panel yet. Users can't tell *why* results are ranked the way they are.
- In thread view, "Relevance" is force-disabled (falls back to `date`), but there's no explanation of why.

**Redesign proposal**:

1. **Conditionally show Relevance** — Only show "Relevance" as a sort option when the search query contains at least one content clause (term, phrase, regex). When the query is empty or only contains field/control operators, default to `date` and hide the relevance option. This avoids a degenerate sorting mode.

2. **Disabled-state explanation** — When "Relevance" or "Reply To" are disabled in thread view, display a tooltip on the disabled `<option>` explaining why (e.g., _"Not available in thread view — threads are sorted by group date"_).

3. **Default sort should match context** — When the user navigates to the archive without any URL params, default to `date` (newest first), not `relevance`. This is already the behavior (the code defaults `sortSelect.value` to `'date'` when no URL state), but the dropdown lists `relevance` first, which suggests it's the recommended default.
   - **Fix**: Reorder options to put `Date (Newest)` first.

---

### 2.5 🟢 Search Status and Parse Feedback (Minor Enhancement)

**Problem**: Warnings and errors are rendered in a single-line `<div>` below the search bar. Multiple warnings are pipe-joined (`|`), which is readable but not scannable. The color coding is basic (`#f6c453` for warning, `#ff6b6b` for error).

**Redesign proposal**:

1. **Structured error display** — Instead of pipe-joining, show each warning as a small pill/chip with an icon:
   ```
   ⚠️ Invalid regex: /foo  |  ℹ️ Context cache may be incomplete
   ```

2. **Inline query highlighting** — When a parse warning relates to a specific token (they all have a `token` field in `SearchWarning`), subtly highlight or underline that token in the search input. This provides targeted feedback instead of a disconnected message.

3. **Transition animation** — Add a subtle fade-in transition when the search status text changes, to draw the eye without being jarring.

---

### 2.6 🟡 Missing Result Highlighting / Snippet Preview (Moderate)

**Problem**: The search results show full items (card view) or truncated text (index view), but neither highlights the matching terms. Users can't quickly scan *where* their query matched, especially in long comments.

**Redesign proposal**:

1. **Term highlighting in card view** — After rendering, perform a client-side pass that wraps matched terms/phrases in `<mark>` tags. Use the parsed AST to identify content terms and highlight them in `.pr-comment-body` and `.pr-post-body`. Apply a subtle highlight color (`background: #fff59d` — matching the existing `.pr-highlight` style).

2. **Snippet preview in index view** — In `renderIndexItem`, instead of showing the first 100 characters of the body (which may not contain the match at all), extract a snippet centered on the first match location with `±50` characters of context. Show the match in bold or highlighted.

---

### 2.7 🔴 No Clear "Reset" / "Clear Search" Affordance (Critical)

**Problem**: There is no visible way to clear the search and return to the full archive browse mode. The user must:
1. Manually select and delete all text in the search input, OR
2. Reload the page.

There's no "X" clear button, no "Show all" link, and no "Reset filters" action.

**Redesign proposal**:

1. **Clear button (`×`) inside the search input** — Show a small clear icon/button at the right edge of the search input when it contains text. Clicking it clears the query, resets scope to `authored`, and triggers a refresh. This is a standard search UX pattern.

2. **Reset all filters** — Add a subtle "Reset" link in the secondary toolbar row that resets query, scope, sort, and view mode to defaults. Only visible when any non-default state is active.

---

### 2.8 🟢 CSS/Styling Issues (Minor)

**Problem**: Several CSS concerns:
- The `pr-input` class is used on the search input but has **no definition** in `styles.ts` or the inline archive styles. The input gets no custom styling beyond the inline `flex: 2; min-width: 260px`. It falls back to the browser default, which clashes with the styled `<select>` elements.
- The `pr-button` class (used on Resync, Load More) is also not defined in the visible stylesheets. The `pr-btn` class in `styles.ts` (line 157) is the styled one but not used here.
- The archive toolbar container uses an inline `style="padding: 10px; background: var(--pr-bg-secondary); border-radius: 8px;"` instead of a class. CSS variables like `--pr-bg-secondary` are not defined in the viewed styles, meaning this likely falls back to transparent.

**Redesign proposal**:

1. **Define `pr-input` and `pr-button` classes** (or rename to `pr-btn`). Ensure the search input has consistent styling:
   ```css
   .pr-input {
     padding: 8px 12px;
     border: 1px solid var(--pr-border-color, #ddd);
     border-radius: 6px;
     background: var(--pr-bg-primary, #fff);
     color: var(--pr-text-primary, #000);
     font-size: 0.95em;
     outline: none;
     transition: border-color 0.2s;
   }
   .pr-input:focus {
     border-color: #0078ff;
     box-shadow: 0 0 0 2px rgba(0, 120, 255, 0.15);
   }
   ```

2. **Move inline styles to the stylesheet** — The archive container's background/padding should be a proper class (`.pr-archive-container`).

---

### 2.9 🟡 Keyboard Accessibility (Moderate)

**Problem**: There are no keyboard shortcuts for the archive search workflow:
- No shortcut to focus the search input (e.g., `/` or `Ctrl+K`).
- No keyboard shortcut to cycle sort modes.
- No way to dismiss the large-dataset dialog without a mouse click.
- The "Expand/Collapse" pattern in index view requires mouse clicks.

**Redesign proposal**:

1. **`/` to focus search** — Intercept `/` keypress (when not already in an input) to focus the search input and select all text. This mirrors GitHub, Slack, and many other power-user tools.

2. **`Escape` to clear/unfocus** — When the search input is focused, pressing Escape should clear the current query (if any) or blur the input.

3. **Enter in index view** — Allow keyboard users to expand an index item by pressing Enter when it has focus (requires making index items focusable with `tabindex`).

---

### 2.10 🟢 Facets Not Implemented Yet (Deferred — per spec)

The greenfield spec (Section "Facets", lines 419–429) calls for:
- Result counts by type (post/comment), top authors, and date buckets
- Facet clicks that append/replace structured terms

This is listed as a Phase 4 item. Including it here for completeness:

**Recommendation**: When implemented, facets should appear as horizontal chip groups between the toolbar and the result feed:

```
Type: [All] [Posts (142)] [Comments (281)]
Authors: [Wei Dai (89)] [Eliezer (34)] [+12 more]
Year: [2025 (156)] [2024 (203)] [2023 (64)]
```

Active facets should be visually distinct (filled/selected state). Clicking a facet should update the search query and URL immediately.

---

## 3. Proposed Redesign — Integrated Layout

Combining the above proposals, here is a suggested layout for the archive toolbar region:

```
┌──────────────────────────────────────────────────────┐
│ User Archive: Wei_Dai  v1.2.3                        │
│ 3,847 items synced • Last sync: 2 min ago            │
├──────────────────────────────────────────────────────┤
│                                                      │
│  🔍 [ Search by keyword, "phrase", or operator... ×] │
│                                                      │
│  📖 Search syntax reference  ▸  (collapsible)        │
│                                                      │
│  ┌─────────────────────────────────────────────┐     │
│  │ Scope: [Authored | All]   Sort: [Date ▾]    │     │
│  │ View:  [🃏][≡][🌲][🌲·]                     │     │
│  │                423 results • 3.2ms  [Reset]  │     │
│  └─────────────────────────────────────────────┘     │
│                                                      │
│  ⚠️ Context cache may be incomplete                   │
│                                                      │
│  Type: [All] [Posts (142)] [Comments (281)]           │  ← Phase 4
│  Top authors: [Wei Dai (89)] [Eliezer (34)]          │  ← Phase 4
│                                                      │
├──────────────────────────────────────────────────────┤
│                                                      │
│  [Result feed - card/index/thread view]              │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

## 4. Priority Ranking

| # | Issue | Severity | Effort | Impact |
|---|-------|----------|--------|--------|
| 1 | No clear/reset button | 🔴 Critical | Low | High — basic UX affordance |
| 2 | Query language discoverability | 🔴 Critical | Medium | High — feature is invisible |
| 3 | Missing `pr-input` / `pr-button` CSS | 🟡 Moderate | Low | Medium — visual inconsistency |
| 4 | Toolbar crowding & flat hierarchy | 🟡 Moderate | Medium | Medium — cognitive load |
| 5 | Sort `relevance` default confusion | 🟡 Moderate | Low | Medium — confusing behavior |
| 6 | Result highlighting / snippets | 🟡 Moderate | Medium | High — search usability |
| 7 | Scope dropdown vs. in-query duality | 🟡 Moderate | Low | Low-Medium — edge-case confusion |
| 8 | Keyboard accessibility | 🟡 Moderate | Low-Medium | Medium — power-user ergonomics |
| 9 | Search status pill formatting | 🟢 Minor | Low | Low — polish |
| 10 | Facets (Phase 4) | 🟢 Deferred | High | High — but scheduled for later |

---

## 5. Recommended Implementation Order

### Quick Wins (≤ 1 hour each)

1. **Add search clear button** — Append a `<span>` or `<button>` inside the search container that calls `searchInput.value = ''; refreshView();` on click. Show/hide based on input content.

2. **Fix missing CSS classes** — Define `.pr-input` and `.pr-button` (or align to `.pr-btn`). Move inline styles on `.pr-archive-container` to a class.

3. **Reorder sort options** — Put `Date (Newest)` first. Show `Relevance` only when a content query is active.

4. **Shorten placeholder** — Replace with `Search by keyword, "phrase", or operator…`.

5. **`/` to focus search** — ~10 lines of keydown listener.

### Medium Effort (1–4 hours each)

6. **Two-tier toolbar** — Restructure HTML into two rows with proper label/icon prefixes.

7. **Collapsible syntax cheatsheet** — Add a `<details class="pr-help">` block with operator table.

8. **Scope segmented control** — Replace `<select>` with a two-button toggle.

9. **Search result highlighting** — Post-render pass to `<mark>` matched terms in card/thread views.

### Larger Effort (4+ hours)

10. **Inline autocomplete hints** — Context-aware hints when typing operator prefixes.

11. **Index view snippet extraction** — Extract match-centered snippets instead of head-of-body truncation.

12. **Facets** — Per the greenfield spec, Phase 4 implementation.

---

## 6. Non-Functional Notes

- **Test impact**: Changes 1–5 are CSS/HTML-only or event-listener additions. They should not break any existing E2E tests. Changes 6–8 modify the toolbar DOM structure and will require updating selectors in `archive-search.spec.ts`, `archive-route.spec.ts`, and `archive-url-state.spec.ts`.

- **Accessibility**: All interactive elements should have unique `id` attributes (already present for most). New controls (clear button, segmented toggles) should have `aria-label` attributes.

- **Mobile**: The archive is primarily a desktop power-user tool, but the toolbar should remain usable at `768px` viewport width. The two-tier layout naturally handles this via `flex-wrap`.
