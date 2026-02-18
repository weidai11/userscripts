# Archive Search UX Implementation Plan

**Date**: 2026-02-18  
**Last reviewed**: 2026-02-18 (pass 5)  
**Prerequisite**: Phases 0–3 of `archive-search-greenfield.md` (engine, parser, worker) are complete.  
**Goal**: Complete Phase 4 (Structured Query UX + Facets) and implement UX improvements from the review in `archive/archive-search-ux-review.md`.

### Known Issues & Cross-Cutting Notes

1. **CSS custom property orphans**: `--pr-bg-secondary`, `--pr-text-primary`, `--pr-border-color` etc. are used throughout the archive CSS but **never defined** anywhere in the codebase. They resolve to nothing (transparent/inherit). All new CSS in this plan uses `var(--pr-X, <fallback>)` with explicit fallback values, matching the existing pattern. A future cleanup should define these in a `:root` block.
2. **Cross-change ordering for Changes 3→4→5**: Change 3 introduces `<select>` elements for scope and view as temporary placeholders. Changes 4 and 5 replace them with custom controls. The Reset button and `refreshView` code in Change 3 initially targets `<select>` elements; those references must be updated atomically when implementing Changes 4/5. Implementing B-batch (3+4+5) together avoids broken intermediate states.
3. **`index.ts` is the only file with archive-specific CSS**: The archive embeds a `<style>` block inside the HTML template string starting at ~line 58 of `index.ts`. It does NOT use `styles.ts` (which is for the main reader). All CSS additions in this plan go into that embedded `<style>` block.
4. **`runPostRenderHooks` (~line 404)**: This existing hook runs after every render cycle. Changes 10 (highlighting) and 11 (snippets) should wire into this hook rather than adding separate call sites.
5. **No existing E2E tests reference toolbar selectors**: A grep for `archive-scope`, `archive-sort`, `archive-view` in `tests/` returns zero results. Changes 3–5 are therefore not breaking for existing tests, but new E2E tests should be added.
6. **`ArchiveSortBy` vs `ArchiveSearchSortMode`**: These are identical type aliases defined in `state.ts` and `search/types.ts` respectively. The codebase uses both interchangeably. The plan uses `ArchiveSearchSortMode` consistently (from `search/types.ts`).

---

## Table of Contents

1. [Change 0: CSS Foundation — Define Missing Classes](#change-0)
2. [Change 1: Search Clear Button](#change-1)
3. [Change 2: Keyboard Shortcuts](#change-2)
4. [Change 3: Two-Tier Toolbar Restructure](#change-3)
5. [Change 4: Scope Segmented Control](#change-4)
6. [Change 5: View Mode Icon Tabs](#change-5)
7. [Change 6: Collapsible Syntax Cheatsheet](#change-6)
8. [Change 7: Sort Behavior Improvements](#change-7)
9. [Change 8: Structured Search Status Chips](#change-8)
10. [Change 9: Result Count in Toolbar](#change-9)
11. [Change 10: Search Result Term Highlighting](#change-10)
12. [Change 11: Index View Snippet Extraction](#change-11)
13. [Change 12: Facets — Type, Author, Date](#change-12)
14. [Change 13: Explain Panel (Debug Mode)](#change-13)
15. [Implementation Order](#implementation-order)
16. [Testing Strategy](#testing-strategy)

---

<a name="change-0"></a>
## Change 0: CSS Foundation — Define Missing Classes

**Goal**: Eliminate undefined CSS classes (`pr-input`, `pr-button`) and move inline styles to proper classes. This is a prerequisite for all subsequent changes since the new toolbar layout depends on a consistent design system.

### Current State

- `pr-input` is used on the search `<input>` (line 287 of `index.ts`) but has no CSS definition anywhere.
- `pr-button` is used on Resync, Load More, Render Selected/All, Retry, and collapse buttons (~9 instances in `index.ts`) but is never defined. The main reader uses a separate `pr-btn` class in `styles.ts` (line 157).
- The archive container uses inline `style="padding: 10px; background: var(--pr-bg-secondary); border-radius: 8px;"`.
- CSS custom properties like `--pr-bg-secondary` are used but never defined anywhere in the codebase (see Known Issues §1 above). The `var()` calls resolve to nothing, and the archive currently relies on host-page cascading.

### Plan

#### [MODIFY] `src/scripts/power-reader/archive/index.ts` — embedded `<style>` block (~lines 58–275)

Add at the top of the archive `<style>` injection:

```css
/* Input and button consistency */
.pr-input {
  padding: 8px 12px;
  border: 1px solid var(--pr-border-color, #ddd);
  border-radius: 6px;
  background: var(--pr-bg-primary, #fff);
  color: var(--pr-text-primary, #000);
  font-size: 0.95em;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
  box-sizing: border-box;
}
.pr-input:focus {
  border-color: #0078ff;
  box-shadow: 0 0 0 2px rgba(0, 120, 255, 0.15);
}
.pr-input::placeholder {
  color: var(--pr-text-tertiary, #999);
}

.pr-button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 8px 16px;
  background: var(--pr-bg-secondary, #f0f0f0);
  color: var(--pr-text-primary, #000);
  border: 1px solid var(--pr-border-color, #ddd);
  border-radius: 6px;
  font-size: 0.9em;
  cursor: pointer;
  transition: background 0.2s;
  white-space: nowrap;
}
.pr-button:hover {
  background: var(--pr-bg-hover, #e0e0e0);
}
.pr-button:active {
  background: var(--pr-bg-active, #d0d0d0);
}
.pr-button.primary {
  background: #0078ff;
  color: #fff;
  border-color: #0078ff;
}
.pr-button.primary:hover {
  background: #0056cc;
}

.pr-archive-container {
  padding: 10px;
  background: var(--pr-bg-secondary, #f9f9f9);
  border-radius: 8px;
}
```

Remove the inline `style=` attribute from the `.pr-archive-container` div in the HTML template. Remove the duplicate `select` styling from `.pr-archive-toolbar select` (merge into the new definition or keep as override).

### Verification

- Visual regression: all existing buttons, inputs, and selects should render at least as well as before.
- `npm run build` passes.

---

<a name="change-1"></a>
## Change 1: Search Clear Button

**Goal**: Add a visible `×` button inside the search input container to clear the query and reset to default state.

### Plan

#### [MODIFY] `src/scripts/power-reader/archive/index.ts` — HTML template

Wrap the search input and clear button in a container div:

```html
<div class="pr-search-container" style="flex: 2; min-width: 260px; position: relative;">
    <input type="text" id="archive-search"
           placeholder='Search by keyword, "phrase", or operator…'
           class="pr-input" style="width: 100%; padding-right: 30px;">
    <button id="archive-search-clear" class="pr-search-clear"
            type="button" aria-label="Clear search"
            style="display: none;">×</button>
</div>
```

**Note**: The simplified placeholder replaces the long operator-enumerating text.

#### [MODIFY] `src/scripts/power-reader/archive/index.ts` — CSS block

```css
.pr-search-container {
  position: relative;
  display: flex;
  align-items: center;
}
.pr-search-clear {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: var(--pr-text-tertiary, #999);
  font-size: 1.2em;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
  transition: color 0.2s;
}
.pr-search-clear:hover {
  color: var(--pr-text-primary, #000);
}
```

#### [MODIFY] `src/scripts/power-reader/archive/index.ts` — Event wiring (near line 350+)

```typescript
const clearBtn = document.getElementById('archive-search-clear') as HTMLButtonElement;

// Show/hide clear button based on input content
const updateClearButton = () => {
  if (clearBtn) clearBtn.style.display = searchInput.value ? '' : 'none';
};
searchInput.addEventListener('input', () => {
  updateClearButton();
  // existing debounce logic (scheduleSearchRefresh) must also be called here
  scheduleSearchRefresh();
});

clearBtn?.addEventListener('click', () => {
  searchInput.value = '';
  updateClearButton();
  // Clear button clears search text only. Use the Reset button (Change 3) for full state reset.
  // NOTE: Uses scopeSelect.value here (Change 1 is in batch A, before getScopeValue() exists in batch B).
  // When implementing batch B (Changes 3–5), update to getScopeValue().
  writeArchiveUrlState({ query: '', scope: scopeSelect.value as ArchiveSearchScope, sort: sortSelect.value as ArchiveSearchSortMode });
  refreshView();
});
```

### Notes

- The clear button clears search text only — it does NOT reset scope, sort, or view mode.
- The full "Reset all" link in Change 3 handles resetting everything to defaults.
- This follows standard UX: a `×` in a search input clears the input, not adjacent controls.

### Verification

- Clear button appears when text is in the input.
- Clicking it clears the query text and refreshes results (scope/sort/view unchanged).
- URL params update correctly (`?q=` is removed, scope/sort preserved).

---

<a name="change-2"></a>
## Change 2: Keyboard Shortcuts

**Goal**: Add `/` to focus search and `Escape` to clear/blur.

### Plan

#### [MODIFY] `src/scripts/power-reader/archive/index.ts` — After event wiring

```typescript
// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // '/' to focus search (when not already in an input/textarea)
  if (e.key === '/' && !isInTextInput(e.target)) {
    e.preventDefault();
    searchInput.focus();
    searchInput.select();
    return;
  }
});

searchInput.addEventListener('keydown', (e) => {
  // Escape: clear query if non-empty, else blur
  if (e.key === 'Escape') {
    if (searchInput.value) {
      searchInput.value = '';
      updateClearButton();
      refreshView();
    } else {
      searchInput.blur();
    }
    return;
  }
});

const isInTextInput = (target: EventTarget | null): boolean => {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return tagName === 'input' || tagName === 'textarea' || tagName === 'select'
    || target.isContentEditable;
};
```

**Implementation note**: The first code block above is conceptual. In practice, the Escape handler and the `/` handler should be merged into the existing event listeners rather than creating new ones:

1. The existing `searchInput` `keydown` handler (line 697 of `index.ts`) only handles `Enter`. Merge `Escape` handling into it:
2. The existing `searchInput` `input` handler (line 693 of `index.ts`) calls `scheduleSearchRefresh()`. The `updateClearButton()` call from Change 1 should already be merged into that handler (see Change 1).

```typescript
searchInput?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    if (searchDispatchTimer) {
      window.clearTimeout(searchDispatchTimer);
      searchDispatchTimer = null;
    }
    void refreshView();
  } else if (event.key === 'Escape') {
    if (searchInput.value) {
      searchInput.value = '';
      updateClearButton();
      // Also update URL to remove old query
      writeArchiveUrlState({ query: '', scope: scopeSelect.value as ArchiveSearchScope, sort: sortSelect.value as ArchiveSearchSortMode });
      refreshView();
    } else {
      searchInput.blur();
    }
  }
});
```

### Notes

- The `/` shortcut mirrors GitHub, Gmail, and Slack conventions.
- `Escape` follows a two-stage pattern: first clear, then blur. This is intentional — users often want to clear a query without losing focus.
- `Escape` also updates the URL state (removes `?q=`) to stay in sync — without this, pressing Escape would clear the input visually but leave the old query in the URL.

### Verification

- Press `/` anywhere on the page → search input focuses.
- Press `Escape` with text in search → clears text.
- Press `Escape` with empty search → blurs input.
- Typing `/` while already in the search input → types a literal `/` (for regex).

---

<a name="change-3"></a>
## Change 3: Two-Tier Toolbar Restructure

**Goal**: Split the single toolbar row into a primary row (search + resync) and a secondary row (scope, sort, view, result count, reset).

### Plan

#### [MODIFY] `src/scripts/power-reader/archive/index.ts` — HTML template

Replace the existing `.pr-archive-toolbar` div with:

```html
<div class="pr-archive-toolbar">
    <div class="pr-archive-toolbar-primary">
        <div class="pr-search-container" style="flex: 1; min-width: 260px; position: relative;">
            <input type="text" id="archive-search"
                   placeholder='Search by keyword, "phrase", or operator…'
                   class="pr-input" style="width: 100%; padding-right: 30px;">
            <button id="archive-search-clear" class="pr-search-clear"
                    type="button" aria-label="Clear search"
                    style="display: none;">×</button>
        </div>
        <button id="archive-resync" class="pr-button" title="Force re-download all data">
            ↻ Resync
        </button>
    </div>
    <div class="pr-archive-toolbar-secondary">
        <div class="pr-toolbar-controls">
            <!-- Scope: segmented control (Change 4) or select fallback -->
            <select id="archive-scope">
                <option value="authored">Scope: Authored</option>
                <option value="all">Scope: All</option>
            </select>
            <select id="archive-sort">
                <option value="date">Sort: Date ↓</option>
                <option value="date-asc">Sort: Date ↑</option>
                <option value="score">Sort: Karma ↓</option>
                <option value="score-asc">Sort: Karma ↑</option>
                <option value="replyTo">Sort: Reply To</option>
                <option value="relevance">Sort: Relevance</option>
            </select>
            <select id="archive-view">
                <option value="card">View: Card</option>
                <option value="index">View: Index</option>
                <option value="thread-full">View: Thread (Full)</option>
                <option value="thread-placeholder">View: Thread (Placeholder)</option>
            </select>
        </div>
        <div class="pr-toolbar-info">
            <span id="archive-result-count" class="pr-result-count"></span>
            <button id="archive-reset-filters" class="pr-toolbar-reset"
                    style="display: none;">Reset</button>
        </div>
    </div>
</div>
```

#### [MODIFY] `src/scripts/power-reader/archive/index.ts` — CSS block

```css
.pr-archive-toolbar {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.pr-archive-toolbar-primary {
  display: flex;
  gap: 10px;
  align-items: center;
}
.pr-archive-toolbar-secondary {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
  justify-content: space-between;
}
.pr-toolbar-controls {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}
.pr-toolbar-info {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-left: auto;
  font-size: 0.85em;
  color: var(--pr-text-secondary, #666);
}
.pr-result-count {
  white-space: nowrap;
}
.pr-toolbar-reset {
  background: none;
  border: none;
  color: var(--pr-text-tertiary, #999);
  cursor: pointer;
  font-size: 0.85em;
  text-decoration: underline;
  padding: 2px 4px;
}
.pr-toolbar-reset:hover {
  color: var(--pr-text-primary, #000);
}
```

#### [MODIFY] `src/scripts/power-reader/archive/index.ts` — Event wiring

Add "Reset" button logic:

```typescript
const resetBtn = document.getElementById('archive-reset-filters') as HTMLButtonElement;

const isNonDefaultState = (): boolean =>
  searchInput.value !== '' ||
  scopeSelect.value !== 'authored' ||
  sortSelect.value !== 'date' ||
  viewSelect.value !== 'card';

const updateResetButton = () => {
  if (resetBtn) resetBtn.style.display = isNonDefaultState() ? '' : 'none';
};

resetBtn?.addEventListener('click', () => {
  searchInput.value = '';
  scopeSelect.value = 'authored';
  sortSelect.value = 'date';
  viewSelect.value = 'card';
  updateClearButton();
  updateResetButton();
  writeArchiveUrlState({ query: '', scope: 'authored', sort: 'date' });
  refreshView();
});

// Call updateResetButton() after any control change
```

### Notes

- `Date ↓` is now the first sort option (previously `Relevance` was first).
- `Relevance` is moved to last since it's only meaningful with content queries.
- The toolbar labels now include prefixes (`Scope:`, `Sort:`, `View:`) inside the `<option>` text itself, making each dropdown self-describing even without external labels.
- The result count element (`#archive-result-count`) is populated in Change 9.
- **Ordering note**: The Reset button code here uses `scopeSelect.value` and `viewSelect.value`, which only work if scope/view are still `<select>` elements. When implementing Changes 4/5, update these references to `getScopeValue()`/`setScopeValue()` and `getViewValue()`/`setViewValue()`. Implement batch B (3+4+5) atomically.

### Affected Tests

- No existing E2E tests directly reference these toolbar selectors (verified by grep). New tests should be added — see Testing Strategy section.

---

<a name="change-4"></a>
## Change 4: Scope Segmented Control

**Goal**: Replace the Scope `<select>` with a two-button segmented toggle since it has only two values.

### Plan

#### [MODIFY] `src/scripts/power-reader/archive/index.ts` — HTML template

Replace the `<select id="archive-scope">` with:

```html
<div id="archive-scope" class="pr-segmented-control" role="group" aria-label="Search scope">
    <button data-value="authored" class="pr-seg-btn active" aria-pressed="true">Authored</button>
    <button data-value="all" class="pr-seg-btn" aria-pressed="false">All</button>
</div>
```

#### [MODIFY] `src/scripts/power-reader/archive/index.ts` — CSS block

```css
.pr-segmented-control {
  display: inline-flex;
  border: 1px solid var(--pr-border-color, #ddd);
  border-radius: 6px;
  overflow: hidden;
}
.pr-seg-btn {
  padding: 6px 14px;
  border: none;
  background: transparent;
  color: var(--pr-text-secondary, #666);
  cursor: pointer;
  font-size: 0.85em;
  transition: background 0.2s, color 0.2s;
  white-space: nowrap;
}
.pr-seg-btn + .pr-seg-btn {
  border-left: 1px solid var(--pr-border-color, #ddd);
}
.pr-seg-btn:hover:not(.active) {
  background: var(--pr-bg-hover, #f0f0f0);
}
.pr-seg-btn.active {
  background: #0078ff;
  color: #fff;
}
```

#### [MODIFY] `src/scripts/power-reader/archive/index.ts` — Event wiring

Since `archive-scope` is no longer a `<select>`, adapt the scope reading:

```typescript
const scopeContainer = document.getElementById('archive-scope')!;
const getScopeValue = (): ArchiveSearchScope =>
  (scopeContainer.querySelector('.pr-seg-btn.active') as HTMLElement)?.dataset.value as ArchiveSearchScope || 'authored';
const setScopeValue = (value: ArchiveSearchScope) => {
  scopeContainer.querySelectorAll('.pr-seg-btn').forEach(btn => {
    const el = btn as HTMLElement;
    const isActive = el.dataset.value === value;
    el.classList.toggle('active', isActive);
    el.setAttribute('aria-pressed', String(isActive));
  });
};

scopeContainer.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest('.pr-seg-btn') as HTMLElement;
  if (!btn || btn.classList.contains('active')) return;
  setScopeValue(btn.dataset.value as ArchiveSearchScope);
  refreshView();
});
```

Update all existing `scopeSelect.value` reads to use `getScopeValue()` and writes to use `setScopeValue(...)`.

#### URL state restoration

In `parseArchiveUrlState` usage, the scope value is restored from the URL. Update the restoration logic to call `setScopeValue(urlState.scope)` instead of `scopeSelect.value = urlState.scope`.

### Notes

- The segmented control requires updating references from `scopeSelect.value` to the helper functions throughout `index.ts`.
- The `aria-pressed` and `role="group"` attributes maintain accessibility parity with the `<select>`.

---

<a name="change-5"></a>
## Change 5: View Mode Icon Tabs

**Goal**: Replace the View `<select>` with an icon-based tab strip for immediate visibility of the current view mode.

### Plan

#### [MODIFY] `src/scripts/power-reader/archive/index.ts` — HTML template

Replace `<select id="archive-view">` with:

```html
<div id="archive-view" class="pr-view-tabs" role="tablist" aria-label="View mode">
    <button data-value="card" class="pr-view-tab active" role="tab"
            aria-selected="true" title="Card View">
        <span class="pr-view-icon">☰</span>
        <span class="pr-view-label">Card</span>
    </button>
    <button data-value="index" class="pr-view-tab" role="tab"
            aria-selected="false" title="Index View">
        <span class="pr-view-icon">≡</span>
        <span class="pr-view-label">Index</span>
    </button>
    <button data-value="thread-full" class="pr-view-tab" role="tab"
            aria-selected="false" title="Thread View (Full Context)">
        <span class="pr-view-icon">⊞</span>
        <span class="pr-view-label">Thread</span>
    </button>
    <button data-value="thread-placeholder" class="pr-view-tab" role="tab"
            aria-selected="false" title="Thread View (Placeholder Context)">
        <span class="pr-view-icon">⊟</span>
        <span class="pr-view-label">Compact</span>
    </button>
</div>
```

> **Icon rationale**: Uses basic Unicode box/line symbols (☰ ≡ ⊞ ⊟) that render consistently on all platforms, unlike emoji icons (🃏 🌲) which vary wildly across OS/browser combinations and may render as missing-glyph boxes in minimal environments.

#### [MODIFY] `src/scripts/power-reader/archive/index.ts` — CSS block

```css
.pr-view-tabs {
  display: inline-flex;
  border: 1px solid var(--pr-border-color, #ddd);
  border-radius: 6px;
  overflow: hidden;
}
.pr-view-tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 4px 12px;
  border: none;
  background: transparent;
  color: var(--pr-text-secondary, #666);
  cursor: pointer;
  font-size: 0.75em;
  transition: background 0.2s, color 0.2s;
  white-space: nowrap;
}
.pr-view-tab + .pr-view-tab {
  border-left: 1px solid var(--pr-border-color, #ddd);
}
.pr-view-tab:hover:not(.active) {
  background: var(--pr-bg-hover, #f0f0f0);
}
.pr-view-tab.active {
  background: var(--pr-bg-secondary, #f0f0f0);
  color: var(--pr-text-primary, #000);
  font-weight: 600;
}
.pr-view-icon {
  font-size: 1.3em;
}
.pr-view-label {
  font-size: 0.85em;
}

/* Hide labels on narrow viewports */
@media (max-width: 800px) {
  .pr-view-label { display: none; }
  .pr-view-tab { padding: 6px 10px; }
}
```

#### Event wiring

Same pattern as Change 4 — delegate click handler on the container, toggle `.active`, read `data-value`.

```typescript
const viewContainer = document.getElementById('archive-view')!;
const getViewValue = (): ArchiveViewMode =>
  (viewContainer.querySelector('.pr-view-tab.active') as HTMLElement)?.dataset.value as ArchiveViewMode || 'card';
const setViewValue = (value: ArchiveViewMode) => {
  viewContainer.querySelectorAll('.pr-view-tab').forEach(btn => {
    const el = btn as HTMLElement;
    const isActive = el.dataset.value === value;
    el.classList.toggle('active', isActive);
    el.setAttribute('aria-selected', String(isActive));
  });
};
```

### Notes

- Thread modes are visually distinguished by different box symbols (⊞ vs ⊟), plus text labels when viewport allows.
- On very narrow viewports, labels hide and only icons show — each has a `title` tooltip for hover clarity.
- The `aria-selected` attribute on each tab button ensures screen readers announce the active view mode.

---

<a name="change-6"></a>
## Change 6: Collapsible Syntax Cheatsheet

**Goal**: Add an expandable reference for the structured query language, using the existing `.pr-help` styling pattern.

### Plan

#### [MODIFY] `src/scripts/power-reader/archive/index.ts` — HTML template

After the `#archive-search-status` div, add:

```html
<details class="pr-help pr-search-help" id="archive-search-help">
    <summary>📖 Search syntax reference</summary>
    <div class="pr-help-content">
        <div class="pr-help-columns">
            <div class="pr-help-section">
                <h4>Text Search</h4>
                <ul>
                    <li><code>word</code> — plain keyword</li>
                    <li><code>"exact phrase"</code> — phrase match</li>
                    <li><code>/regex/i</code> — regex literal</li>
                    <li><code>*</code> — match all items</li>
                    <li><code>-term</code> — exclude results matching <code>term</code></li>
                </ul>
            </div>
            <div class="pr-help-section">
                <h4>Field Operators</h4>
                <ul>
                    <li><code>author:name</code> — filter by author</li>
                    <li><code>replyto:name</code> — filter by parent author</li>
                    <li><code>type:post</code> or <code>type:comment</code></li>
                </ul>
            </div>
            <div class="pr-help-section">
                <h4>Range Operators</h4>
                <ul>
                    <li><code>score:>10</code> — karma above 10</li>
                    <li><code>score:5..20</code> — karma 5 to 20</li>
                    <li><code>date:2025-01-01</code> — exact date</li>
                    <li><code>date:2025-01..2025-06</code> — date range</li>
                    <li><code>date:>2025-01-01</code> — after date</li>
                </ul>
            </div>
            <div class="pr-help-section">
                <h4>Examples</h4>
                <ul>
                    <li class="pr-search-example" data-query='author:"Eliezer" score:>50'><code>author:"Eliezer" score:>50</code></li>
                    <li class="pr-search-example" data-query='type:post date:2025-01..2025-06'><code>type:post date:2025-01..2025-06</code></li>
                    <li class="pr-search-example" data-query='"alignment tax" -type:comment'><code>"alignment tax" -type:comment</code></li>
                    <li class="pr-search-example" data-query='* -type:post'><code>* -type:post</code> (all comments)</li>
                </ul>
            </div>
        </div>
    </div>
</details>
```

#### [MODIFY] `src/scripts/power-reader/archive/index.ts` — CSS block

```css
.pr-search-help {
  margin-top: 8px;
}
.pr-search-example {
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 3px;
  transition: background 0.2s;
}
.pr-search-example:hover {
  background: var(--pr-bg-hover, #e0e0e0);
}
```

#### [MODIFY] `src/scripts/power-reader/archive/index.ts` — Event wiring

```typescript
// Clickable examples insert query into search bar
const helpEl = document.getElementById('archive-search-help');
helpEl?.addEventListener('click', (e) => {
  const target = (e.target as HTMLElement).closest('.pr-search-example') as HTMLElement;
  if (!target) return;
  const query = target.dataset.query;
  if (!query) return;
  searchInput.value = query;
  updateClearButton();
  refreshView();
  searchInput.focus();
});
```

### Notes

- Uses the existing `.pr-help` classes from `styles.ts` (lines 183–249), which provide rounded corners, summary toggle styling, and responsive column layout.
- Example queries are clickable — they populate the search bar and immediately execute.

---

<a name="change-7"></a>
## Change 7: Sort Behavior Improvements

**Goal**: (a) Reorder sort options to put `Date (Newest)` first. (b) Conditionally show `Relevance` only when a content query is active. (c) Add disabled-state tooltips for thread-view-incompatible options.

### Plan

#### (a) Option reorder — already handled in Change 3 HTML template.

#### (b) Conditional Relevance visibility

In the `refreshView` function (or the `updateSearchStatus` callback), after parsing the query:

```typescript
const updateSortOptions = (hasContentQuery: boolean, isThread: boolean) => {
  const relevanceOption = sortSelect.querySelector('option[value="relevance"]') as HTMLOptionElement;
  const replyToOption = sortSelect.querySelector('option[value="replyTo"]') as HTMLOptionElement;

  if (relevanceOption) {
    relevanceOption.disabled = !hasContentQuery;
    relevanceOption.title = hasContentQuery ? '' : 'Relevance sorting requires a search query';
    // If currently selected but now invalid, switch to date
    if (!hasContentQuery && sortSelect.value === 'relevance') {
      sortSelect.value = 'date';
    }
  }
  if (replyToOption) {
    replyToOption.disabled = isThread;
    replyToOption.title = isThread ? 'Not available in thread view' : '';
    if (isThread && sortSelect.value === 'replyTo') {
      sortSelect.value = 'date';
    }
  }
};
```

Call `updateSortOptions(hasContentQuery, isThreadMode(viewMode))` inside `refreshView` after parsing the query.

**Note**: The existing `viewSelect` change handler (lines 717–738 of `index.ts`) already disables `replyTo` and `relevance` in thread mode. The new `updateSortOptions` function **replaces** that inline logic with a unified function that handles both thread-mode disabling and content-query disabling. Remove the duplicate inline logic from the `viewSelect` handler when implementing this change.

#### (c) Determine `hasContentQuery`

Use the existing `isPositiveContentClause` from `ast.ts`:

```typescript
import { isPositiveContentClause } from './search/ast';

// After parsing:
const parsed = parseStructuredQuery(currentQuery);
// NOTE: isPositiveContentClause already checks !clause.negated internally,
// so no additional negation check is needed here.
const hasContentQuery = parsed.clauses.some(isPositiveContentClause);
```

### Notes

- This avoids the confusing degenerate case where `Relevance` is selected with no query and produces chronological results.
- The sort dropdown retains its `<select>` form since it has 6 options — too many for a segmented control.

---

<a name="change-8"></a>
## Change 8: Structured Search Status Chips

**Goal**: Replace the pipe-joined status text with individual styled chips for each warning/info message.

### Plan

#### [MODIFY] `src/scripts/power-reader/archive/index.ts` — `updateSearchStatus` function

Rewrite the message assembly to create individual chip elements:

```typescript
const updateSearchStatus = (
  diagnostics: SearchDiagnostics,
  resolvedScope: ArchiveSearchScope,
  contextItemCount: number,
  sortMode: ArchiveSearchSortMode
) => {
  if (!searchStatusEl) return;
  searchStatusEl.innerHTML = '';
  // Remove old class-based styling (replaced by per-chip styling)
  searchStatusEl.classList.remove('warning', 'error');

  const addChip = (text: string, type: 'info' | 'warning' | 'error' = 'info') => {
    const chip = document.createElement('span');
    chip.className = `pr-status-chip pr-status-${type}`;
    chip.textContent = text;
    searchStatusEl.appendChild(chip);
  };

  let hasMessages = false;

  if (resolvedScope === 'all') {
    addChip(`Scope: authored + ${contextItemCount} context items`, 'info');
    hasMessages = true;
    if (contextItemCount === 0) {
      addChip('Context cache may be incomplete', 'warning');
    }
    // Preserve existing replyTo+scope mixed semantics warning
    if (sortMode === 'replyTo') {
      addChip('replyTo ordering uses mixed authored/context semantics', 'info');
    }
  }
  if (diagnostics.partialResults) {
    addChip(`Partial results (${diagnostics.tookMs}ms budget hit)`, 'warning');
    hasMessages = true;

    const retryBtn = document.createElement('button');
    retryBtn.className = 'pr-search-retry-btn';
    retryBtn.textContent = 'Run without time limit';
    retryBtn.addEventListener('click', () => refreshView(0));
    searchStatusEl.appendChild(retryBtn);
  }
  for (const warning of diagnostics.warnings) {
    const type = warning.type === 'negation-only' || warning.type === 'invalid-query' ? 'error' : 'warning';
    addChip(warning.message, type);
    hasMessages = true;
  }

  if (!hasMessages) {
    searchStatusEl.textContent = ARCHIVE_SEARCH_HELP_TEXT;
  }
};
```

#### Call site update

The current `updateSearchStatus` already accepts 4 parameters including `sortMode` (verified at line 476–480 of `index.ts`), and the call site at line 583 already passes all 4 arguments:

```typescript
updateSearchStatus(result.diagnostics, result.resolvedScope, contextItems.length, sortMode);
```

**No call-site change needed** — only the function body changes (from pipe-joined text to styled chips). The existing `classList.remove('warning', 'error')` call at line 514 is also already present but happens *after* `classList.add` — the plan's rewrite correctly moves it to the top.

#### [MODIFY] `src/scripts/power-reader/archive/index.ts` — CSS block

```css
.pr-status-chip {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 0.8em;
  margin-right: 6px;
  margin-bottom: 4px;
  vertical-align: middle;
}
.pr-status-info {
  background: var(--pr-bg-secondary, #f0f0f0);
  color: var(--pr-text-secondary, #666);
}
.pr-status-warning {
  background: rgba(246, 196, 83, 0.15);
  color: #b8860b;
}
.pr-status-error {
  background: rgba(255, 107, 107, 0.15);
  color: #d32f2f;
}
```

### Notes

- All warnings are now displayed, not just the first one (current code only shows `diagnostics.warnings[0]`).
- The `ARCHIVE_SEARCH_HELP_TEXT` still appears when no search is active.

---

<a name="change-9"></a>
## Change 9: Result Count in Toolbar

**Goal**: Show the result count and query time inline in the secondary toolbar row.

### Plan

#### [MODIFY] `src/scripts/power-reader/archive/index.ts`

After `refreshView` completes and results are available, populate the result count element:

```typescript
const resultCountEl = document.getElementById('archive-result-count');

// Inside the search result callback:
const updateResultCount = (total: number, tookMs: number) => {
  if (!resultCountEl) return;
  if (total === 0 && !searchInput.value) {
    // Show total item count when not searching
    resultCountEl.textContent = `${state.items.length} items`;
  } else {
    resultCountEl.textContent = `${total.toLocaleString()} result${total !== 1 ? 's' : ''} \u2022 ${tookMs.toFixed(1)}ms`;
  }
};
```

Call `updateResultCount(result.total, result.diagnostics.tookMs)` wherever search results are handled.

### Notes

- When there's no active query, the count shows total archive size (e.g., "3,847 items") using `toLocaleString()` for comma formatting.
- When searching, it shows "423 results • 3.2ms".
- This provides always-visible feedback that the search actually ran.

---

<a name="change-10"></a>
## Change 10: Search Result Term Highlighting

**Goal**: Highlight matched terms/phrases in the rendered results (card and thread views).

### Plan

#### [NEW] `src/scripts/power-reader/archive/search/highlight.ts`

Create a new module for post-render highlighting:

```typescript
import { parseStructuredQuery } from './parser';

/**
 * Extract plain-text content terms from the current query
 * that should be highlighted in results.
 * Returns lowercased terms (from valueNorm) for case-insensitive matching.
 */
export const extractHighlightTerms = (query: string): string[] => {
  const parsed = parseStructuredQuery(query);
  const terms: string[] = [];

  for (const clause of parsed.clauses) {
    if (clause.negated) continue;
    switch (clause.kind) {
      case 'term':
        terms.push(clause.valueNorm);
        break;
      case 'phrase':
        terms.push(clause.valueNorm);
        break;
      // Regex highlighting is complex and deferred
      default:
        break;
    }
  }

  return terms;
};

/**
 * Apply <mark> tags to text nodes within a container that match
 * any of the provided terms.
 *
 * Matching is case-insensitive against the original text (no NFKC normalization).
 * This means composed Unicode characters (e.g., ﬁ ligature) won't match their
 * decomposed equivalents. This is acceptable for v1.
 *
 * NOTE: This function has NO dependency on normalizeForSearch. The terms
 * (from extractHighlightTerms) are already lowercased, and we use the 'gi'
 * flag for case-insensitive matching against the original DOM text.
 */
export const highlightTermsInContainer = (
  container: HTMLElement,
  terms: string[]
): void => {
  if (terms.length === 0) return;

  // Build a regex that matches any of the terms (longest first to avoid partial matches)
  const sorted = [...terms].sort((a, b) => b.length - a.length);
  const escaped = sorted.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(`(${escaped.join('|')})`, 'gi');

  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
  const textNodes: Text[] = [];
  while (walker.nextNode()) {
    textNodes.push(walker.currentNode as Text);
  }

  for (const textNode of textNodes) {
    const parent = textNode.parentElement;
    if (!parent) continue;
    // Skip existing highlights, code blocks, and script tags
    if (parent.closest('mark, code, pre, script, style')) continue;

    const text = textNode.textContent || '';
    // Split original text by the pattern — case-insensitive match against original.
    // When splitting with a capturing group regex, the result alternates:
    // [non-match, match, non-match, match, ...]
    // Odd-indexed parts are matched groups; even-indexed are non-matched text.
    const parts = text.split(pattern);
    if (parts.length <= 1) continue;

    const fragment = document.createDocumentFragment();
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!part) continue; // skip empty strings from split
      if (i % 2 === 1) {
        // Odd index = captured match group
        const mark = document.createElement('mark');
        mark.className = 'pr-search-highlight';
        mark.textContent = part;
        fragment.appendChild(mark);
      } else {
        fragment.appendChild(document.createTextNode(part));
      }
    }
    parent.replaceChild(fragment, textNode);
  }
};
```

#### [MODIFY] `src/scripts/power-reader/archive/index.ts`

After rendering the feed, call the highlighting function:

```typescript
import { extractHighlightTerms, highlightTermsInContainer } from './search/highlight';

// After renderArchiveFeed completes:
const applySearchHighlight = () => {
  const query = searchInput.value.trim();
  if (!query) return;

  const terms = extractHighlightTerms(query);
  if (terms.length === 0) return;

  const feedEl = document.getElementById('archive-feed');
  if (!feedEl) return;

  // Apply to comment bodies and post bodies
  feedEl.querySelectorAll('.pr-comment-body, .pr-post-body, .pr-index-title').forEach(el => {
    highlightTermsInContainer(el as HTMLElement, terms);
  });
};
```

#### [MODIFY] `src/scripts/power-reader/archive/index.ts` — CSS block

```css
.pr-search-highlight {
  background: rgba(255, 235, 59, 0.4);
  border-radius: 2px;
  padding: 0 1px;
}
```

### Notes

- Highlighting runs after DOM rendering, not during HTML string construction. This avoids the complexity of injecting `<mark>` into raw HTML strings.
- The highlighting is conservative: it only targets `.pr-comment-body`, `.pr-post-body`, and `.pr-index-title` to avoid contaminating metadata regions.
- Regex highlighting is intentionally deferred — the regex might not correspond to a simple string pattern and could cause performance issues.
- Per spec (§ Tokenization): "Preserve original text for snippet/highlight rendering; never highlight from normalized strings directly."
- **Wire into `runPostRenderHooks`** (~line 404 of `index.ts`) rather than adding a separate call after `renderArchiveFeed`. This ensures highlighting runs on all render paths (initial load, load-more, index expand-in-place).
- **Limitation**: The normalized terms are lowercased. The `'gi'` regex flag handles case-insensitive matching against original text, but NFKC-normalized characters (e.g., `ﬁ` → `fi`) won't match the original if the original uses the composed form. This is acceptable for v1.

### Verification

- Search for `alignment` → all instances of "alignment" in visible results are wrapped in `<mark>`.
- Phrase search `"alignment tax"` → the exact phrase is highlighted.
- Performance: highlighting 500 DOM elements should complete in < 50ms.

---

<a name="change-11"></a>
## Change 11: Index View Snippet Extraction

**Goal**: In index view, show a match-centered snippet instead of a head-of-body truncation.

### Current State

`renderIndexItem` (line 383 of `render.ts`) does:

```typescript
const title = isPost ? (item as Post).title
  : ((item as Comment).htmlBody || '').replace(/<[^>]+>/g, '').slice(0, 100) + '...';
```

This always shows the first 100 characters, which may not contain the matched term at all.

### Plan

#### [MODIFY] `src/scripts/power-reader/archive/render.ts` — add module-level snippet state

`renderIndexItem` is a synchronous function that returns an HTML string, so it cannot use dynamic imports or async patterns. Use a pre-computed terms array stored at module scope:

```typescript
// Module-level state for search-aware snippet extraction
let currentSnippetTerms: string[] = [];

export const setSnippetTerms = (terms: string[]) => {
  currentSnippetTerms = terms;
};

/**
 * Extract a snippet centered on the first match of any search term.
 * Falls back to head-of-body if no match found.
 */
const extractSnippet = (text: string, maxLen: number): string => {
  if (!text) return '';
  const textLower = text.toLowerCase();

  for (const term of currentSnippetTerms) {
    const idx = textLower.indexOf(term.toLowerCase());
    if (idx === -1) continue;

    const contextRadius = Math.floor((maxLen - term.length) / 2);
    const start = Math.max(0, idx - contextRadius);
    const end = Math.min(text.length, idx + term.length + contextRadius);
    const prefix = start > 0 ? '…' : '';
    const suffix = end < text.length ? '…' : '';
    return prefix + text.slice(start, end) + suffix;
  }

  // No match in body — fall back to head
  return text.slice(0, maxLen) + (text.length > maxLen ? '…' : '');
};
```

#### [MODIFY] `src/scripts/power-reader/archive/render.ts` — `renderIndexItem`

Update the comment title extraction:

```typescript
export const renderIndexItem = (item: Post | Comment): string => {
  const isPost = 'title' in item;

  let title: string;
  if (isPost) {
    title = (item as Post).title;
  } else {
    const bodyText = ((item as Comment).htmlBody || '').replace(/<[^>]+>/g, '');
    title = extractSnippet(bodyText, 120);
  }

  // ... rest unchanged ...
};
```

**Note**: The function signature is unchanged — no new parameters needed since snippet terms come from module state.

#### [MODIFY] `src/scripts/power-reader/archive/index.ts` — set snippet terms before render

In `refreshView`, before calling `renderArchiveFeed`:

```typescript
import { setSnippetTerms } from './render';
import { extractHighlightTerms } from './search/highlight';

// Inside refreshView, before renderArchiveFeed:
setSnippetTerms(extractHighlightTerms(searchInput.value));
```

### Verification

- Search for `alignment` → index view shows "…discussing the alignment tax and its implications for…" (centered on match) instead of a random first-100-chars snippet.
- Empty query shows head-of-body snippet as before.

---

<a name="change-12"></a>
## Change 12: Facets — Type, Author, Date Buckets

**Goal**: Per spec § Facets, show interactive facet chips above the result feed with counts by type, top authors, and date buckets.

### Design Decisions

Per spec:
- Facets append structured terms to the query.
- Conflicting facet clicks replace existing operators of the same kind.
- Facet computation runs asynchronously with a ≤ 30ms budget.
- When budget is exceeded, show "Facets delayed — refine query".

### Plan

#### [NEW] `src/scripts/power-reader/archive/search/facets.ts`

```typescript
import type { ArchiveItem } from './types';
import { parseStructuredQuery } from './parser';

export type FacetGroup = {
  label: string;
  items: FacetItem[];
};

export type FacetItem = {
  value: string;       // e.g., 'post', 'Eliezer Yudkowsky', '2025'
  queryFragment: string; // e.g., 'type:post', 'author:"Eliezer Yudkowsky"', 'date:2025-01..2025-12'
  count: number;
  active: boolean;     // true if the current query already includes this facet
};

export type FacetResult = {
  groups: FacetGroup[];
  delayed: boolean;
  computeMs: number;
};

const FACET_BUDGET_MS = 30;

/**
 * Determine which facet kinds are already active in the query by
 * parsing the AST rather than doing naive string matching.
 * Returns a set of active query fragments for comparison.
 */
const detectActiveFacets = (query: string): { types: Set<string>; authors: Set<string>; dateYears: Set<number> } => {
  const parsed = parseStructuredQuery(query);
  const types = new Set<string>();
  const authors = new Set<string>();
  const dateYears = new Set<number>();

  for (const clause of parsed.clauses) {
    if (clause.negated) continue;
    if (clause.kind === 'type') types.add(clause.itemType);
    if (clause.kind === 'author') authors.add(clause.valueNorm);
    if (clause.kind === 'date') {
      // Check if the date range spans a single year
      if (clause.minMs) {
        const year = new Date(clause.minMs).getFullYear();
        dateYears.add(year);
      }
    }
  }
  return { types, authors, dateYears };
};

/**
 * Compute facets from ArchiveItem[] (not SearchDoc[]).
 * This works directly on the search result items, avoiding the need to
 * thread SearchDoc[] through the result type.
 */
export const computeFacets = (
  items: readonly ArchiveItem[],
  currentQuery: string
): FacetResult => {
  const startMs = Date.now();
  const groups: FacetGroup[] = [];

  let postCount = 0;
  let commentCount = 0;
  const authorCounts = new Map<string, { display: string; count: number }>();
  const yearCounts = new Map<number, number>();

  for (let i = 0; i < items.length; i++) {
    // Check budget every 100 items to avoid Date.now() overhead on each iteration
    if (i % 100 === 0 && Date.now() - startMs > FACET_BUDGET_MS) {
      return { groups, delayed: true, computeMs: Date.now() - startMs };
    }
    const item = items[i];

    // Type
    const isPost = 'title' in item;
    if (isPost) postCount++;
    else commentCount++;

    // Author (use original displayName for display, normalized for keying)
    const displayName = item.user?.displayName || '';
    if (displayName) {
      const key = displayName.toLowerCase();
      const existing = authorCounts.get(key);
      if (existing) existing.count++;
      else authorCounts.set(key, { display: displayName, count: 1 });
    }

    // Year bucket
    if (item.postedAt) {
      const year = new Date(item.postedAt).getFullYear();
      if (!isNaN(year)) yearCounts.set(year, (yearCounts.get(year) || 0) + 1);
    }
  }

  // Parse query AST to determine active facets (instead of naive string matching)
  const active = detectActiveFacets(currentQuery);

  // Type group
  groups.push({
    label: 'Type',
    items: [
      { value: 'Posts', queryFragment: 'type:post', count: postCount, active: active.types.has('post') },
      { value: 'Comments', queryFragment: 'type:comment', count: commentCount, active: active.types.has('comment') }
    ].filter(f => f.count > 0)
  });

  // Author group (top 5, using original display names)
  const topAuthors = Array.from(authorCounts.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5);
  if (topAuthors.length > 0) {
    groups.push({
      label: 'Author',
      items: topAuthors.map(([normName, { display, count }]) => ({
        value: display,
        queryFragment: display.includes(' ') ? `author:"${display}"` : `author:${display}`,
        count,
        active: active.authors.has(normName)
      }))
    });
  }

  // Year group (only if multiple years)
  const sortedYears = Array.from(yearCounts.entries()).sort((a, b) => b[0] - a[0]);
  if (sortedYears.length > 1) {
    groups.push({
      label: 'Year',
      items: sortedYears.map(([year, count]) => ({
        value: String(year),
        queryFragment: `date:${year}-01-01..${year}-12-31`,
        count,
        active: active.dateYears.has(year)
      }))
    });
  }

  return { groups, delayed: false, computeMs: Date.now() - startMs };
};
```

> **Key change from v1 plan**: `computeFacets` now takes `ArchiveItem[]` instead of `ArchiveSearchDoc[]`. This eliminates the data gap — `SearchRunResult.items` is `ArchiveItem[]` and is directly usable. Active facet detection uses the parsed AST instead of naive `queryLower.includes()`, which prevents false positives on partial matches.

#### [MODIFY] `src/scripts/power-reader/archive/index.ts` — HTML template

Add a facet container between the toolbar and the feed:

```html
<div id="archive-facets" class="pr-archive-facets" style="display: none;"></div>
```

#### [MODIFY] `src/scripts/power-reader/archive/index.ts` — CSS block

```css
.pr-archive-facets {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.pr-facet-group {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.pr-facet-label {
  font-size: 0.8em;
  color: var(--pr-text-tertiary, #999);
  margin-right: 2px;
}
.pr-facet-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border: 1px solid var(--pr-border-color, #ddd);
  border-radius: 14px;
  font-size: 0.8em;
  cursor: pointer;
  background: transparent;
  color: var(--pr-text-secondary, #666);
  transition: background 0.2s, border-color 0.2s;
}
.pr-facet-chip:hover {
  background: var(--pr-bg-hover, #f0f0f0);
  border-color: #aaa;
}
.pr-facet-chip.active {
  background: rgba(0, 120, 255, 0.1);
  border-color: #0078ff;
  color: #0078ff;
}
.pr-facet-count {
  font-size: 0.9em;
  opacity: 0.7;
}
.pr-facet-delayed {
  font-size: 0.8em;
  color: var(--pr-text-tertiary, #999);
  font-style: italic;
}
```

#### [MODIFY] `src/scripts/power-reader/archive/index.ts` — Facet rendering and event wiring

```typescript
import { computeFacets } from './search/facets';

const facetsEl = document.getElementById('archive-facets')!;

const renderFacets = (result: SearchRunResult) => {
  // Compute facets directly from ArchiveItem[]
  const facetResult = computeFacets(
    result.items,
    searchInput.value
  );

  if (facetResult.groups.every(g => g.items.length === 0)) {
    facetsEl.style.display = 'none';
    return;
  }

  facetsEl.style.display = '';
  facetsEl.innerHTML = facetResult.groups.map(group => `
    <div class="pr-facet-group">
      <span class="pr-facet-label">${group.label}:</span>
      ${group.items.map(item => `
        <button class="pr-facet-chip ${item.active ? 'active' : ''}"
                data-fragment="${escapeHtml(item.queryFragment)}"
                title="${item.value} (${item.count})">
          ${escapeHtml(item.value)}
          <span class="pr-facet-count">(${item.count})</span>
        </button>
      `).join('')}
    </div>
  `).join('') + (facetResult.delayed ? '<span class="pr-facet-delayed">Facets delayed — refine query</span>' : '');
};

// Facet click handler
facetsEl.addEventListener('click', (e) => {
  const chip = (e.target as HTMLElement).closest('.pr-facet-chip') as HTMLElement;
  if (!chip) return;

  const fragment = chip.dataset.fragment;
  if (!fragment) return;

  if (chip.classList.contains('active')) {
    // Remove this facet from query
    removeQueryFragment(searchInput, fragment);
  } else {
    // Add or replace facet in query
    appendOrReplaceQueryFragment(searchInput, fragment);
  }

  updateClearButton();
  refreshView();
});
```

#### Helper: Query fragment manipulation

```typescript
const getFragmentKind = (fragment: string): string | null => {
  const match = fragment.match(/^(\w+):/);
  return match ? match[1] : null;
};

const removeQueryFragment = (input: HTMLInputElement, fragment: string) => {
  // Remove the fragment from the query text
  const escaped = fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  input.value = input.value.replace(new RegExp(`\\s*${escaped}`, 'gi'), '').trim();
};

const appendOrReplaceQueryFragment = (input: HTMLInputElement, fragment: string) => {
  const kind = getFragmentKind(fragment);
  if (kind) {
    // Remove existing operators of the same kind.
    // Pattern handles both unquoted (type:post) and quoted (author:"Name") values.
    const kindPattern = new RegExp(`${kind}:(?:"[^"]*"|\\S)+`, 'gi');
    input.value = input.value.replace(kindPattern, '').trim();
  }
  input.value = input.value ? `${input.value} ${fragment}` : fragment;
};
```

### Notes

- **v1 Simplification**: Facets are computed on the main thread from the `SearchRunResult.items` array. This is fine for typical result sets (< 5000 items). The spec allows deferring worker-side facet computation.
- The facet budget (30ms) is enforced — on large unfiltered archives, facets gracefully degrade with the "Facets delayed" message.
- Author facet values now use original `item.user.displayName` for display and lowercased name for keying/active-detection (fixed from v1 plan which used `authorNameNorm` for display).
- Active facet detection uses the parsed AST (`parseStructuredQuery`) instead of `queryLower.includes()`, preventing false positives on substrings like `type:poster` matching `type:post`.
- Year buckets only show when there's more than one distinct year.
- **Scalability note**: Since `SearchRunResult.items` returns full `ArchiveItem[]` hydrated on the main thread, facet computation on very large result sets (>10k items) may compete for main-thread time. If this becomes measurable, move facet computation to the worker post-v1.

---

<a name="change-13"></a>
## Change 13: Explain Panel (Debug Mode)

**Goal**: Per spec § Explainability, add an optional panel that shows match details for a selected result.

### Plan

This is lower priority and can be done as a follow-up. The engine already emits `explain: string[]` in diagnostics.

#### Approach

- Add a global debug flag (e.g., `?debug=1` URL param).
- When active, add a small "🔍" button next to each result item.
- Clicking it shows a floating panel with:
  - Matched fields (title/body)
  - Matched terms/regex
  - Score breakdown (token hits, phrase hits, author/replyTo hits)
  - RelevanceSignals for this item

#### Data availability gap

Currently, `SearchRunResult` returns `items` but not the per-item `RelevanceSignals`. The `runSearch` method computes `relevanceSignalsById` internally (engine.ts line 398) but doesn't expose it in the result type.

**Fix**: Add `relevanceSignalsById?: Map<string, RelevanceSignals>` to `SearchRunResult` and populate it when debug mode is active. This avoids the overhead in production while enabling the explain panel in debug mode.

### Verification

- `?debug=1` → clicking a result's debug icon shows match explanation.
- Without debug flag, no extra UI or computation overhead.

---

<a name="implementation-order"></a>
## Implementation Order

```
Change 0: CSS Foundation          (~30 min)  — prerequisite for all UI changes
   ↓
Change 1: Clear Button            (~30 min)  — quick win, independent
Change 2: Keyboard Shortcuts      (~20 min)  — quick win, independent
   ↓
Change 3: Two-Tier Toolbar        (~2 hr)    — structural change, gates Changes 4, 5, 9
   ├── Change 4: Scope Segmented  (~1 hr)    — depends on Change 3
   ├── Change 5: View Mode Tabs   (~1 hr)    — depends on Change 3
   └── Change 9: Result Count     (~30 min)  — depends on Change 3
   ↓
Change 6: Syntax Cheatsheet       (~1 hr)    — independent
Change 7: Sort Improvements       (~30 min)  — independent
Change 8: Status Chips            (~1 hr)    — independent
   ↓
Change 10: Term Highlighting      (~2 hr)    — depends on highlight.ts
Change 11: Index Snippets         (~1.5 hr)  — depends on highlight.ts terms
   ↓
Change 12: Facets                 (~4 hr)    — largest piece, Phase 4 core
   ↓
Change 13: Explain Panel          (~2 hr)    — optional, lowest priority
```

### Suggested batches

| Batch | Changes | Est. Time | Description |
|-------|---------|-----------|-------------|
| **A** | 0, 1, 2 | ~1.5 hr | CSS foundation + basic UX quick wins |
| **B** | 3, 4, 5 | ~4 hr | Toolbar restructure (implement atomically — see Known Issues §2) |
| **C** | 6, 7, 8, 9 | ~3 hr | Information architecture improvements |
| **D** | 10, 11 | ~3.5 hr | Search result relevance visibility |
| **E** | 12 | ~4 hr | Facets (Phase 4 core) |
| **F** | 13 | ~2 hr | Debug explain panel (optional) |

---

<a name="testing-strategy"></a>
## Testing Strategy

### Unit Tests

- **`highlight.ts`**: New test file for `extractHighlightTerms` and `highlightTermsInContainer` with DOM fixtures.
- **`facets.ts`**: Test `computeFacets` with mock `ArchiveItem` arrays, including budget-exceeded scenarios.
- **Sort conditional visibility**: Test `updateSortOptions` logic.

### Existing Test Updates

**No existing E2E tests reference toolbar selectors** (`archive-scope`, `archive-sort`, `archive-view`) — verified by grep across `tests/`. Changes 3–5 are therefore non-breaking for existing tests.

However, if any tests are added before batch B, they should use `#archive-scope`, `#archive-sort`, `#archive-view` IDs (which are preserved across all changes) rather than element-type selectors like `select#archive-scope` (which would break after Changes 4/5).

### New E2E Tests (recommended)

1. **Clear button**: Navigate to archive with `?q=test`, click clear, verify URL and results reset.
2. **Facet click**: Search for `*`, click `type:post` facet, verify query updates and results filter.
3. **Keyboard shortcut**: Press `/`, verify search input is focused.
4. **Snippet preview**: Search in index view, verify snippet contains the search term.
5. **Syntax cheatsheet**: Click an example query, verify it populates the search bar and runs.

---

## Appendix: Files Modified

| File | Changes | Notes |
|------|---------|-------|
| `src/scripts/power-reader/archive/index.ts` | 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12 | CSS block + HTML template + event wiring |
| `src/scripts/power-reader/archive/render.ts` | 11 | `setSnippetTerms` + `extractSnippet` + `renderIndexItem` |
| `src/scripts/power-reader/archive/search/highlight.ts` | 10, 11 (new file) | `extractHighlightTerms` + `highlightTermsInContainer` |
| `src/scripts/power-reader/archive/search/facets.ts` | 12 (new file) | `computeFacets` (works on `ArchiveItem[]`) |
| `src/scripts/power-reader/archive/search/types.ts` | 13 (add `relevanceSignalsById` to result type) | |
| `tests/archive-search-highlight.spec.ts` | 10 (new test file) | Unit tests for highlight extraction |
| `tests/archive-facets.spec.ts` | 12 (new test file) | Unit tests incl. budget-exceeded scenario |
