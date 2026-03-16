# Archive Toolbar UI Redesign Plan

## Current Layout (top to bottom)

```
Row 1  [=============search input==============] [Resync]
Row 2  [Authored|All] [Date â–¾] [â˜° â‰¡ âŠž âŠŸ]          5,438 items
Row 3  Ready
Row 4  â–¶ Search syntax reference          (full-width gray bar)
Row 5  Facets delayed â€” refine query      (or: clickable chips)
       â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ gap â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
       <feed content>
```

## Proposed Layout

```
â”Œâ”€ sticky â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ Row 1  [=============search input============Ã—] [?] [ðŸ”„] â”‚
â”‚ Row 2  [Authored|All]   [Date â–¾]   [â˜° â‰¡ âŠž âŠŸ]  5,438 items â”‚
â”‚ Row 3  [Type: Posts(312) Comments(5126)] [Year: 2025 2024â€¦] â”‚  â† facets (when present)
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
Row 4  âš  Scope: authored + 42 context items    (only when non-idle)
       â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ gap â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
       <feed content>

         â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
         â”‚  (popover, shown on ? click)    â”‚
         â”‚  Text Search  â”‚  Operators  â”‚â€¦  â”‚
         â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

---

## Change 1: Sticky Toolbar

**What:** Make `.pr-archive-toolbar` (rows 1+2) plus the facets row sticky at the top of the viewport.

**HTML changes:**
- Wrap toolbar + facets in a new `<div class="pr-archive-sticky-header">` inside `.pr-archive-container`.

**CSS:**
```css
.pr-archive-sticky-header {
    position: sticky;
    top: 0;
    z-index: 1500; /* align with existing app sticky header layering in takeover UI */
    background: var(--pr-bg-secondary, #f9f9f9);
}
.pr-archive-sticky-header.pr-is-scrolled {
    border-bottom: 1px solid var(--pr-border-subtle, #eee);
}
```

**Scroll detection:** Use an `IntersectionObserver` on a sentinel `<div>` placed just before the sticky header. When the sentinel leaves the viewport, toggle `.pr-is-scrolled` on the sticky header. This avoids a permanent border when the page is at the top. Use observer threshold `0` (not `1.0`) to avoid brittle behavior on sub-pixel layouts/zoom levels.

**Why not make search-status sticky too:** The status row shows warnings/chips that can be tall (retry buttons, scope info). Keeping it non-sticky avoids the sticky region growing unpredictably.

---

## Change 2: Resync â†’ Compact Icon Button

**What:** Replace the full `[Resync]` button with a small `ðŸ”„` icon button. Keep it in the primary row (next to search).

**New HTML:**
```html
<button id="archive-resync" class="pr-button pr-icon-btn" type="button"
        title="Force re-download all data" aria-label="Resync">ðŸ”„</button>
```

**New CSS:**
```css
.pr-icon-btn {
    padding: 6px 8px;
    min-width: unset;
    font-size: 1.1em;
    line-height: 1;
}
```

**Position:** Stays in `toolbar-primary`, rightmost. Row becomes: `[search Ã—] [?] [ðŸ”„]`.

**Behavior:** Unchanged â€” click shows `confirm()` dialog, then calls `performSync(true)`.

**Icon consistency note:** If this surface already has a shared icon system, use that icon source instead of raw emoji; otherwise keep the emoji for this iteration.

---

## Change 3: Search Help â†’ Popover

**What:** Replace the full-width `<details class="pr-help">` block with a `?` icon button that toggles a floating popover panel.

**Trigger button:**
```html
<button id="archive-search-help-btn" class="pr-button pr-icon-btn" type="button"
        title="Search syntax help" aria-label="Search help" aria-expanded="false"
        aria-controls="archive-search-help-popover">?</button>
```
Placed in `toolbar-primary`, between the search container and the ðŸ”„ button.

**Popover panel:**
Same inner content as the current `<details>` help (the `.pr-help-content` div with its 4 sections). Wrapped in:
```html
<div id="archive-search-help-popover" class="pr-search-help-popover"
     role="region" aria-label="Search syntax reference" style="display: none;">
    <!-- existing help content -->
</div>
```

**Popover CSS:**
```css
.pr-search-help-popover {
    position: absolute;
    top: calc(100% + 4px); /* anchored just below toolbar-primary */
    left: 50%;
    transform: translateX(-50%);
    width: min(95vw, 700px);
    max-height: calc(100vh - var(--pr-archive-toolbar-height, 72px));
    overflow-y: auto;
    z-index: 1600;      /* above archive sticky header but below modal overlays */
    background: var(--pr-bg-secondary, #f9f9f9);
    border: 1px solid var(--pr-border-color, #ddd);
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    padding: 15px;
}
```

Set `overflow: visible` on `.pr-archive-sticky-header`, `.pr-archive-toolbar`, and `.pr-archive-toolbar-primary` so the overlay cannot be clipped by parent containers. Keep any scrolling overflow on child containers (for example, `#archive-facets`) rather than on these parent wrappers.

**Close behavior:**
- Click `?` button again (toggle)
- Press `Escape` while popover is visible (`keydown` listener on `document`, attached on open and removed on close)
- Click a search example chip after it fills the query
- Click anywhere outside the popover (`pointerdown` listener on document, removed on close); outside-click logic must check `!popover.contains(event.target)` and ignore the `?` trigger button to avoid close/reopen races when toggling via mouse.
- Use the same event family for both trigger and outside-close handling (for example, `pointerdown` on trigger + document) rather than mixing `click` and `pointerdown`.

**Accessibility:** Toggle `aria-expanded` on the button on open/close.

**Migration:** Remove `<details id="archive-search-help">` element entirely. Remove `searchHelpEl` variable. Re-attach the `.pr-search-example` click listener to the new popover panel element. Update `tests/archive-route.spec.ts` selectors/assertions from the `<details>/<summary>` interaction to the new `#archive-search-help-btn` + `#archive-search-help-popover` flow.

**Container positioning:** Render the popover as a child of `.pr-archive-toolbar-primary` (with `position: relative`) so it stays anchored to the same row as the `?` trigger. Visual overlap with lower rows is expected for an overlay. If an ancestor outside this subtree clips overflow, fall back to rendering the popover in `document.body` with viewport-relative positioning.

---

## Change 4: Hide Idle "Ready" Status

**What:** The `#archive-search-status` div shows "Ready" when idle â€” this wastes a full row. Hide the element when there are no meaningful messages.

**Code change in `updateSearchStatus()`:**
```ts
// Before:
if (!hasMessages) {
    searchStatusEl.textContent = 'Ready';
}

// After:
searchStatusEl.classList.toggle('pr-is-hidden', !hasMessages);
const hasVisibleStatus = hasCriticalDiagnostics || diagnostics.partialResults;
const diagnosticsWarningSummary = diagnostics.partialResults ? 'Partial results' : buildWarningSummary(diagnostics);
statusBadgeEl.classList.toggle('pr-is-hidden', !hasVisibleStatus);
statusBadgeEl.textContent = diagnosticsWarningSummary;
```

**CSS:** Add a utility class:
```css
.pr-is-hidden {
    display: none !important;
}
```

**Initial HTML:** Add `class="pr-is-hidden"` to `#archive-search-status` (start hidden).

**Why not merge into toolbar-info:** The search status can contain multiple chips, a retry button, and multi-line content. Cramming this into the toolbar-info row would create layout instability. Better to simply hide when empty, show as a full-width message row when there's something to say.

**Visibility mitigation:** For high-severity diagnostics (for example, partial-result warnings), also mirror a compact warning badge in the sticky row so critical state is still visible while scrolling.
Position the badge in `toolbar-info` next to the item count so it does not shift primary action buttons.
Minimal structure:
```html
<span id="archive-status-badge" class="pr-archive-status-badge pr-is-hidden"
      role="status" aria-live="polite"></span>
```
```css
.pr-archive-status-badge {
    margin-left: 8px;
    padding: 2px 8px;
    border-radius: 999px;
    font-size: 12px;
    background: var(--pr-warning-bg, #fff3cd);
    border: 1px solid var(--pr-warning-border, #f0c36d);
    color: var(--pr-warning-text, #7a4f00);
}
```

---

## Change 5: Move Facets Up (Into Sticky Region)

**What:** Move `#archive-facets` from its current position (after the `<details>` help block) to inside the sticky header wrapper, directly after `.pr-archive-toolbar`.

**Current HTML order:**
```
.pr-archive-toolbar
#archive-search-status    "Ready"
details#archive-search-help
#archive-facets           (hidden by default)
```

**New HTML order (inside sticky wrapper):**
```
.pr-archive-sticky-header
  .pr-archive-toolbar
    .pr-archive-toolbar-primary
    .pr-archive-toolbar-secondary
  #archive-facets           (moved here)
#archive-search-status      (outside sticky, hidden when idle)
```

**Sticky height impact:** The facet row is compact (~35px when visible). When `display: none` (default, or no facets), adds 0px. Acceptable for sticky.

**Facet overflow guard:** Add a cap so sticky height cannot dominate small viewports:
```css
#archive-facets {
    max-height: var(--pr-archive-facets-max-height, 120px);
    overflow-y: auto;
}
@media (max-height: 760px) {
    #archive-facets {
        max-height: var(--pr-archive-facets-max-height-small, 72px);
        overflow-y: auto;
    }
}
```

**The "Facets delayed" message** already renders inside `#archive-facets` via `createFacetDelayedMessageEl()` â€” no change needed, it naturally moves with the container.

---

## Change 6: Visual Separators Between Control Groups

**What:** Add wider spacing between the three logical groups in `toolbar-secondary`: scope toggle, sort dropdown, and view tabs.

**Approach:** Increase the gap between groups from 8px to 16px by adding margin to the sort dropdown, creating visual breathing room without adding border/divider elements (which clash with the dropdown's own border).

**CSS:**
```css
#archive-sort {
    margin-left: 8px;
    margin-right: 8px;
}
```

**Result:** `[Authored|All]   [Date â–¾]   [â˜°â‰¡âŠžâŠŸ]` â€” wider gaps between groups while `.pr-toolbar-controls` internal `gap: 8px` stays for consistency.

---

## Change 7: Normalize View Tab Height

**What:** Change view tabs from vertical stacked layout (icon above label) to horizontal inline layout (icon + label side by side), matching the height of the segmented control and sort dropdown.

**CSS changes:**
```css
.pr-view-tab {
    flex-direction: row;   /* was: column */
    gap: 4px;              /* was: 2px */
    padding: 6px 10px;     /* was: 4px 12px */
}
```

Each tab becomes single-line `[â˜° Card]` instead of a two-line stack. The existing `@media (max-width: 800px)` rule already hides `.pr-view-label`, so narrow viewports keep icon-only tabs.

**Height result:** View tabs ~32px (matching segmented control ~32px) instead of current ~42px.

---

## Implementation Order

1. **Change 5 + Change 1** â€” structural HTML reordering (move facets, add sticky wrapper)
2. **Change 4** â€” hide idle status (small code change; best done with the sticky/header reshuffle because status is moving out of the sticky region)
3. **Change 2 + Change 3** â€” both modify toolbar-primary row (Resync icon + help popover)
4. **Change 6 + Change 7** â€” CSS-only polish (separators + tab height)

## What Is NOT Changing

- **Sort dropdown** stays as a native `<select>`. Custom dropdowns add JS complexity for marginal visual gain.
- **Scope toggle** (Authored/All) segmented control design stays. The pattern works well.
- **Result count** position stays in toolbar-info (right side of secondary row).
- **Reset button** behavior unchanged (appears when any non-default filter is active).
- **Error UI** (`#archive-error-container`) and its retry/resync buttons are separate from the toolbar and unaffected.
