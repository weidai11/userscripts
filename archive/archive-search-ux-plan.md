# Archive Search UX Implementation Plan

**Date**: 2026-02-18  
**Last reviewed**: 2026-02-19 (pass 13)  
**Prerequisite**: Phases 0–3 of `archive-search-greenfield.md` (engine, parser, worker) are complete.  
**Goal**: Phase 4 (Structured Query UX + Facets) and the UX improvements from `archive/archive-search-ux-review.md` have been implemented.

### Status Snapshot (2026-02-19)

- Changes 0 through 13 have been implemented in the current codebase (`src/scripts/power-reader/archive/*` + related tests).
- This document is now primarily a historical implementation plan and audit reference, not a pending TODO list.
- Current intentional deviations/clarifications from early plan snippets:
  - Reset behavior keeps `useDedicatedScopeParam = false` so reset returns to default implicit scope handling.
  - Highlight matching uses shared `buildHighlightRegex` behavior (normalization-aware), not a naive `join('|')` regex.
  - Facet same-kind replacement/removal is string-based and currently regex-driven (with escaped operator kinds) rather than AST rewrite.
  - View tab icons use symbolic glyphs for compact visual distinction.
  - Changes 1-3 include pre-migration historical snippets (`scopeSelect`/`viewSelect`) and associated notes; implemented code uses `readUiState`/`applyUiState` helpers.

### Known Issues & Cross-Cutting Notes

1. **CSS custom property baseline**: `--pr-*` tokens are now defined in global reader styles (`styles.ts`) and injected during takeover/rebuild. Archive-specific CSS should still use `var(--pr-X, <fallback>)` where practical for resilience and future portability.
2. **Cross-change ordering for Changes 3→4→5**: Change 3 introduces `<select>` elements for scope and view as temporary placeholders. Changes 4 and 5 replace them with custom controls. The Reset button and `refreshView` code in Change 3 initially targets `<select>` elements; those references must be updated atomically when implementing Changes 4/5. Implementing B-batch (3+4+5) together avoids broken intermediate states.
3. **Archive CSS layering**: The archive embeds a `<style>` block inside the HTML template string starting at ~line 58 of `index.ts` for archive-specific rules. Global styles from `styles.ts` are still injected by takeover/rebuild and apply to archive UI too.
4. **`runPostRenderHooks` (~line 404)**: This existing hook runs after every render cycle. Changes 10 (highlighting) and 11 (snippets) should wire into this hook rather than adding separate call sites.
5. **Toolbar selector changes have broader regression surface than E2E tests**: A grep for `archive-scope`, `archive-sort`, `archive-view` in `tests/` finds many hits, including `tests/archive-context.spec.ts`, `tests/archive-route.spec.ts`, and `tests/archive-sync.spec.ts`. Many flows currently use `selectOption(...)` on these controls. In addition to test migration, run a full source grep for `.value` reads/writes and `'change'` listeners touching `#archive-scope`/`#archive-view` before and after Changes 4/5 to catch runtime regressions. Treat Batch B as a test-breaking migration: UI changes and test updates must land together.
6. **`ArchiveSortBy` vs `ArchiveSearchSortMode` type drift**: These are currently identical aliases in `state.ts` and `search/types.ts` but used interchangeably, which makes future changes error-prone. Add Change 0.5 (below) to unify aliases before implementing later UX changes.
7. **Global shortcut lifecycle**: Document-level keyboard handlers (Change 2) must be scoped to active archive UI and self-clean when archive DOM is removed to avoid interfering with host-page shortcuts in SPA transitions.
8. **UI state drift risk**: During the `<select>` → custom-control migration, keep DOM state, `ArchiveState`, and URL state synchronized via shared adapter helpers (`readUiState`, `applyUiState`, URL sync point) rather than ad-hoc per-handler writes.

---

## Table of Contents

1. [Change 0: CSS Foundation — Define Missing Classes](#change-0)
2. [Change 0.5: Sort Type Alias Unification](#change-0-5)
3. [Change 1: Search Clear Button](#change-1)
4. [Change 2: Keyboard Shortcuts](#change-2)
5. [Change 3: Two-Tier Toolbar Restructure](#change-3)
6. [Change 4: Scope Segmented Control](#change-4)
7. [Change 5: View Mode Icon Tabs](#change-5)
8. [Change 6: Collapsible Syntax Cheatsheet](#change-6)
9. [Change 7: Sort Behavior Improvements](#change-7)
10. [Change 8: Structured Search Status Chips](#change-8)
11. [Change 9: Result Count in Toolbar](#change-9)
12. [Change 10: Search Result Term Highlighting](#change-10)
13. [Change 11: Index View Snippet Extraction](#change-11)
14. [Change 12: Facets — Type, Author, Date](#change-12)
15. [Change 13: Explain Panel (Debug Mode)](#change-13)
16. [Implementation Order](#implementation-order)
17. [Testing Strategy](#testing-strategy)

---

<a name="change-0"></a>
## Change 0: CSS Foundation — Define Missing Classes

**Goal**: Eliminate undefined CSS classes (`pr-input`, `pr-button`) and move inline styles to proper classes. This is a prerequisite for all subsequent changes since the new toolbar layout depends on a consistent design system.

### Current State

- `pr-input` is used on the search `<input>` (line 287 of `index.ts`) but has no CSS definition anywhere.
- `pr-button` is used on Resync, Load More, Render Selected/All, Retry, and collapse buttons (~9 instances in `index.ts`) but is never defined. The main reader uses a separate `pr-btn` class in `styles.ts` (line 157).
- The archive container uses inline `style="padding: 10px; background: var(--pr-bg-secondary); border-radius: 8px;"`.
- CSS custom properties like `--pr-bg-secondary` are provided by global styles; keep fallback values in new archive rules for robustness.

### Plan

Historical snippet note: this section preserves pre-batch-B examples where scope/view are still `<select>` controls.

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

<a name="change-0-5"></a>
## Change 0.5: Sort Type Alias Unification

**Goal**: Remove duplicate sort aliases (`ArchiveSortBy`, `ArchiveSearchSortMode`) before adding more search/sort wiring, so type usage is consistent and future refactors are safer.

### Plan

Historical snippet note: this section documents the transitional toolbar structure before Change 4/5 helper-based control migration.

#### [MODIFY] `src/scripts/power-reader/archive/search/types.ts`

Make `ArchiveSearchSortMode` the single exported alias wired to `ArchiveSortBy` (which remains the source of truth in `state.ts`):

```typescript
import type { ArchiveSortBy } from '../state';

export type ArchiveSearchSortMode = ArchiveSortBy;
```

#### [MODIFY] dependency boundaries (required)

- `state.ts` must stay dependency-light and must not import from `search/types.ts` (or any search-layer module).
- Before merging, verify no import cycle is introduced (`state.ts` -> search/* -> `state.ts`).
- If any existing imports make this alias direction unsafe, extract the shared union to a leaf type module (e.g., `archive/types.ts`) and have both `state.ts` and `search/types.ts` import from that leaf.

#### [MODIFY] `src/scripts/power-reader/archive/index.ts` and related files

- Prefer `ArchiveSearchSortMode` in search-facing APIs (`runSearch`, URL state, diagnostics plumbing).
- Remove redundant casts between the two aliases where they are now identical.
- Keep runtime behavior unchanged.

#### [MODIFY] `src/scripts/power-reader/archive/state.ts`

- Keep `ArchiveSortBy` as the source-of-truth domain type for archive state.
- Add a short comment noting `ArchiveSearchSortMode` is intentionally an alias of this type.

### Verification

- Typecheck/build passes with no duplicate sort-type definitions.
- Repo grep for `ArchiveSortBy` / `ArchiveSearchSortMode` shows intentional usage boundaries (state vs search API), not ad-hoc mixing.
- Import graph check confirms no cycle between `state.ts` and search-layer modules.

---

<a name="change-1"></a>
## Change 1: Search Clear Button

**Goal**: Add a visible `×` button inside the search input container to clear the query text.

### Plan

Historical snippet note: this section preserves pre-batch-B examples where scope/view are still `<select>` controls.

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
const isInTextInput = (target: EventTarget | null): boolean => {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return tagName === 'input' || tagName === 'textarea' || tagName === 'select'
    || target.isContentEditable;
};

const isArchiveUiActive = (): boolean =>
  searchInput.isConnected &&
  searchInput.offsetParent !== null &&
  !!document.getElementById('archive-feed');

const ARCHIVE_SHORTCUT_HANDLER_KEY = '__PR_ARCHIVE_SHORTCUT_HANDLER__';
const previousArchiveShortcutHandler =
  (window as any)[ARCHIVE_SHORTCUT_HANDLER_KEY] as ((event: KeyboardEvent) => void) | undefined;
if (previousArchiveShortcutHandler) {
  document.removeEventListener('keydown', previousArchiveShortcutHandler);
}

// Keep global shortcut scoped to active archive UI.
// If archive DOM is torn down, remove this listener to prevent side-effects.
const handleArchiveGlobalKeydown = (event: KeyboardEvent) => {
  if (event.defaultPrevented) return;
  if (event.ctrlKey || event.metaKey || event.altKey) return;

  if (!isArchiveUiActive()) {
    document.removeEventListener('keydown', handleArchiveGlobalKeydown);
    if ((window as any)[ARCHIVE_SHORTCUT_HANDLER_KEY] === handleArchiveGlobalKeydown) {
      delete (window as any)[ARCHIVE_SHORTCUT_HANDLER_KEY];
    }
    return;
  }

  if (event.key === '/' && !isInTextInput(event.target)) {
    event.preventDefault();
    searchInput.focus();
    searchInput.select();
  }
};
(window as any)[ARCHIVE_SHORTCUT_HANDLER_KEY] = handleArchiveGlobalKeydown;
document.addEventListener('keydown', handleArchiveGlobalKeydown);

// Merge into the existing search keydown handler (Enter already exists).
searchInput?.addEventListener('keydown', (event: KeyboardEvent) => {
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
      // NOTE: in batch B (Changes 3–5), replace scopeSelect.value with getScopeValue().
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
- The document-level `/` listener is idempotent: any prior archive shortcut handler is removed before adding a new one.
- Shortcut handler ignores modified keystrokes (`Ctrl`/`Cmd`/`Alt`) and already-handled events to avoid clobbering host shortcuts.

### Verification

- Press `/` anywhere on the page → search input focuses.
- Press `Escape` with text in search → clears text.
- Press `Escape` with empty search → blurs input.
- Typing `/` while already in the search input → types a literal `/` (for regex).
- Navigate away/unmount archive UI in SPA mode → `/` no longer hijacks host page shortcuts.

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

  // Keep ArchiveState in sync with toolbar defaults before refresh.
  // Reset should return to implicit scope handling.
  useDedicatedScopeParam = false;
  state.sortBy = 'date';
  state.viewMode = 'card';

  const replyToOption = sortSelect.querySelector('option[value="replyTo"]') as HTMLOptionElement;
  const relevanceOption = sortSelect.querySelector('option[value="relevance"]') as HTMLOptionElement;
  if (replyToOption) replyToOption.disabled = false;
  if (relevanceOption) relevanceOption.disabled = false;

  updateClearButton();
  updateResetButton();
  writeArchiveUrlState({ query: '', scope: 'authored', sort: 'date' });
  void refreshView();
});

// Call updateResetButton() after any control change
```

#### [MODIFY] `src/scripts/power-reader/archive/index.ts` — add a small UI state adapter (recommended)

Use shared helpers so handlers do not manually drift DOM/state/URL updates:

```typescript
type ArchiveUiState = {
  query: string;
  scope: ArchiveSearchScope;
  sort: ArchiveSearchSortMode;
  view: ArchiveViewMode;
};

const readUiState = (): ArchiveUiState => ({
  query: searchInput.value,
  scope: getScopeValue(),
  sort: sortSelect.value as ArchiveSearchSortMode,
  view: getViewValue()
});

const applyUiState = (next: Partial<ArchiveUiState>, options: { silent?: boolean } = {}) => {
  if (next.query !== undefined) searchInput.value = next.query;
  if (next.scope !== undefined) setScopeValue(next.scope);
  if (next.sort !== undefined) {
    sortSelect.value = next.sort;
    state.sortBy = next.sort;
  }
  if (next.view !== undefined) {
    setViewValue(next.view);
    state.viewMode = next.view;
  }
  if (!options.silent) {
    updateClearButton();
    updateResetButton();
  }
};
```

Call these helpers from Reset, URL restoration, clear-button, and scope/view handlers to reduce stale-reference risk during Batch B migration. Prefer a single URL-write point (`refreshView` or an explicit `syncUrlState(readUiState())`) to avoid divergent query/scope/sort persistence.

### Notes

- `Date ↓` is now the first sort option (previously `Relevance` was first).
- `Relevance` is moved to last since it's only meaningful with content queries.
- The toolbar labels now include prefixes (`Scope:`, `Sort:`, `View:`) inside the `<option>` text itself, making each dropdown self-describing even without external labels.
- The result count element (`#archive-result-count`) is populated in Change 9.
- **Ordering note**: The Reset button code here uses `scopeSelect.value` and `viewSelect.value`, which only work if scope/view are still `<select>` elements. When implementing Changes 4/5, update these references to `getScopeValue()`/`setScopeValue()` and `getViewValue()`/`setViewValue()`. Implement batch B (3+4+5) atomically.
- In batch B, route reset behavior through shared helpers (`setScopeValue`, `setViewValue`, `applyViewModeChange`) so visual control state and `ArchiveState` remain synchronized.

### Affected Tests

- Existing E2E tests already reference toolbar selectors in `tests/archive-context.spec.ts`, `tests/archive-route.spec.ts`, and `tests/archive-sync.spec.ts`.
- Batch B must migrate those interactions from `<select>`-based calls (`selectOption(...)`) to segmented control/tab interactions.

---

<a name="change-4"></a>
## Change 4: Scope Segmented Control

**Goal**: Replace the Scope `<select>` with a two-button segmented toggle since it has only two values.

### Plan

#### [MODIFY] `src/scripts/power-reader/archive/index.ts` — HTML template

Replace the `<select id="archive-scope">` with:

```html
<div id="archive-scope" class="pr-segmented-control" role="radiogroup" aria-label="Search scope">
    <button data-value="authored" class="pr-seg-btn active" role="radio" aria-checked="true" tabindex="0">Authored</button>
    <button data-value="all" class="pr-seg-btn" role="radio" aria-checked="false" tabindex="-1">All</button>
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
.pr-seg-btn:focus-visible {
  outline: 2px solid #0078ff;
  outline-offset: -2px;
}
```

#### [MODIFY] `src/scripts/power-reader/archive/index.ts` — Event wiring

Since `archive-scope` is no longer a `<select>`, adapt the scope reading:

```typescript
const scopeContainer = document.getElementById('archive-scope');
let scopeFallbackValue: ArchiveSearchScope = 'authored';

const getScopeValue = (): ArchiveSearchScope => {
  if (!scopeContainer) return scopeFallbackValue;
  const active = scopeContainer.querySelector('.pr-seg-btn.active') as HTMLElement | null;
  return (active?.dataset.value as ArchiveSearchScope) || scopeFallbackValue;
};

const setScopeValue = (value: ArchiveSearchScope) => {
  scopeFallbackValue = value;
  if (!scopeContainer) return; // Safe during early boot / partial render states
  scopeContainer.querySelectorAll('.pr-seg-btn').forEach(btn => {
    const el = btn as HTMLElement;
    const isActive = el.dataset.value === value;
    el.classList.toggle('active', isActive);
    el.setAttribute('aria-checked', String(isActive));
    (el as HTMLButtonElement).tabIndex = isActive ? 0 : -1;
  });
};

scopeContainer?.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest('.pr-seg-btn') as HTMLElement;
  if (!btn || btn.classList.contains('active')) return;
  setScopeValue(btn.dataset.value as ArchiveSearchScope);
  useDedicatedScopeParam = true;
  refreshView();
});

scopeContainer?.addEventListener('keydown', (e: KeyboardEvent) => {
  const current = (e.target as HTMLElement).closest('.pr-seg-btn') as HTMLButtonElement | null;
  if (!current) return;
  const buttons = Array.from(scopeContainer.querySelectorAll('.pr-seg-btn')) as HTMLButtonElement[];
  const index = buttons.indexOf(current);
  if (index < 0) return;

  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  e.preventDefault();
  const delta = e.key === 'ArrowRight' ? 1 : -1;
  const nextButton = buttons[(index + delta + buttons.length) % buttons.length];
  nextButton.focus();
  setScopeValue(nextButton.dataset.value as ArchiveSearchScope);
  useDedicatedScopeParam = true;
  void refreshView();
});
```

Update all existing `scopeSelect.value` reads to use `getScopeValue()` and writes to use `setScopeValue(...)`.

#### URL state restoration

In `parseArchiveUrlState` usage, the scope value is restored from the URL. Update the restoration logic to call `setScopeValue(urlState.scope)` instead of `scopeSelect.value = urlState.scope`.

### Notes

- The segmented control requires updating references from `scopeSelect.value` to the helper functions throughout `index.ts`.
- `getScopeValue`/`setScopeValue` are null-safe and maintain fallback state so early boot ordering (DOM not yet injected) does not throw.
- Scope control uses `radiogroup`/`radio` semantics with roving tabindex and Left/Right keyboard support.
- Regression hardening: run `rg -n "archive-scope|archive-view"` and `rg -n "\\.value|addEventListener\\('change'" src/scripts/power-reader/archive` to ensure no stale `<select>` assumptions remain outside the rewritten handlers.

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
            aria-selected="true" tabindex="0" aria-label="Card view" title="Card View">
        <span class="pr-view-icon">☰</span>
        <span class="pr-view-label">Card</span>
    </button>
    <button data-value="index" class="pr-view-tab" role="tab"
            aria-selected="false" tabindex="-1" aria-label="Index view" title="Index View">
        <span class="pr-view-icon">≡</span>
        <span class="pr-view-label">Index</span>
    </button>
    <button data-value="thread-full" class="pr-view-tab" role="tab"
            aria-selected="false" tabindex="-1" aria-label="Thread view full context" title="Thread View (Full Context)">
        <span class="pr-view-icon">⊞</span>
        <span class="pr-view-label">Thread</span>
    </button>
    <button data-value="thread-placeholder" class="pr-view-tab" role="tab"
            aria-selected="false" tabindex="-1" aria-label="Thread view compact context" title="Thread View (Placeholder Context)">
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
.pr-view-tab:focus-visible {
  outline: 2px solid #0078ff;
  outline-offset: -2px;
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

Use the same delegated pattern as Change 4, but explicitly port the current `viewSelect?.addEventListener('change', ...)` behavior (state updates, sort-option disabling/enabling, fallback sort reassignment, `refreshView()`) to avoid regressions.

```typescript
const viewContainer = document.getElementById('archive-view');
let viewFallbackValue: ArchiveViewMode = 'card';
const getViewTabs = (): HTMLButtonElement[] =>
  viewContainer
    ? (Array.from(viewContainer.querySelectorAll('.pr-view-tab')) as HTMLButtonElement[])
    : [];

const getViewValue = (): ArchiveViewMode => {
  if (!viewContainer) return viewFallbackValue;
  const active = viewContainer.querySelector('.pr-view-tab.active') as HTMLElement | null;
  return (active?.dataset.value as ArchiveViewMode) || viewFallbackValue;
};

const setViewValue = (value: ArchiveViewMode) => {
  viewFallbackValue = value;
  getViewTabs().forEach((el) => {
    const isActive = el.dataset.value === value;
    el.classList.toggle('active', isActive);
    el.setAttribute('aria-selected', String(isActive));
    // Roving tabindex for keyboard focus management
    el.tabIndex = isActive ? 0 : -1;
  });
};

let viewModeRefreshTimer: number | null = null;
const VIEW_MODE_KEYBOARD_DEBOUNCE_MS = 80;

const scheduleViewRefresh = (source: 'pointer' | 'keyboard') => {
  if (viewModeRefreshTimer) {
    window.clearTimeout(viewModeRefreshTimer);
    viewModeRefreshTimer = null;
  }

  if (source === 'pointer') {
    void refreshView();
    return;
  }

  viewModeRefreshTimer = window.setTimeout(() => {
    viewModeRefreshTimer = null;
    void refreshView();
  }, VIEW_MODE_KEYBOARD_DEBOUNCE_MS);
};

const applyViewModeChange = (
  nextView: ArchiveViewMode,
  source: 'pointer' | 'keyboard'
) => {
  if (state.viewMode === nextView) return;
  state.viewMode = nextView;

  // Ported from existing viewSelect 'change' handler
  const replyToOption = sortSelect.querySelector('option[value="replyTo"]') as HTMLOptionElement;
  const relevanceOption = sortSelect.querySelector('option[value="relevance"]') as HTMLOptionElement;
  if (replyToOption) {
    if (isThreadMode(state.viewMode)) {
      replyToOption.disabled = true;
      if (relevanceOption) relevanceOption.disabled = true;
      if (state.sortBy === 'replyTo' || state.sortBy === 'relevance') {
        state.sortBy = 'date';
        sortSelect.value = 'date';
      }
    } else {
      replyToOption.disabled = false;
      if (relevanceOption) relevanceOption.disabled = false;
    }
  }

  scheduleViewRefresh(source);
};

viewContainer?.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest('.pr-view-tab') as HTMLButtonElement | null;
  if (!btn) return;
  const next = btn.dataset.value as ArchiveViewMode;
  setViewValue(next);
  applyViewModeChange(next, 'pointer');
});

const activateTabAt = (index: number, source: 'pointer' | 'keyboard' = 'keyboard') => {
  const tabs = getViewTabs();
  if (tabs.length === 0) return;

  // Wrap index for Left/Right navigation
  const normalized = (index + tabs.length) % tabs.length;
  const target = tabs[normalized];
  const next = target.dataset.value as ArchiveViewMode;
  target.focus();
  setViewValue(next);
  applyViewModeChange(next, source);
};

viewContainer?.addEventListener('keydown', (e: KeyboardEvent) => {
  const current = (e.target as HTMLElement).closest('.pr-view-tab') as HTMLButtonElement | null;
  if (!current) return;

  const tabs = getViewTabs();
  const currentIndex = tabs.indexOf(current);
  if (currentIndex < 0) return;

  switch (e.key) {
    case 'ArrowRight':
      e.preventDefault();
      activateTabAt(currentIndex + 1, 'keyboard');
      break;
    case 'ArrowLeft':
      e.preventDefault();
      activateTabAt(currentIndex - 1, 'keyboard');
      break;
    case 'Home':
      e.preventDefault();
      activateTabAt(0, 'keyboard');
      break;
    case 'End':
      e.preventDefault();
      activateTabAt(tabs.length - 1, 'keyboard');
      break;
    case 'Enter':
    case ' ':
      e.preventDefault();
      activateTabAt(currentIndex, 'keyboard');
      break;
    default:
      // Do not intercept Tab/Shift+Tab so focus can leave the tablist normally.
      break;
  }
});
```

Remove the legacy `viewSelect?.addEventListener('change', ...)` handler once the tab handler is in place, and update remaining reads/writes to use `getViewValue()`/`setViewValue(...)` (including Reset and URL restoration paths).
After initial DOM injection, call `setViewValue(getViewValue())` once so ARIA and roving-tabindex state is normalized even before first user interaction.

#### Accessibility (required)

Because this replaces a native `<select>`, implement keyboard behavior equivalent to a tablist:

- Left/Right arrow: move focus and selection between tabs.
- `Home`/`End`: jump to first/last tab.
- `Enter`/`Space`: activate the focused tab (if not already selected).
- Keep one tabbable tab at a time via roving `tabindex` (`0` on active, `-1` on others).
- Do not trap focus: leave `Tab`/`Shift+Tab` behavior untouched.

### Notes

- Thread modes are visually distinguished by different box symbols (⊞ vs ⊟), plus text labels when viewport allows.
- On very narrow viewports, labels hide and only icons show; each tab keeps an explicit `aria-label` (and optional `title`) so screen readers still announce intent.
- Keep `aria-selected` in sync with the active tab and preserve visible labels (or an explicit `aria-label`) on icon-only layouts.
- Keyboard-driven tab changes use a short debounce to reduce redundant refreshes while arrowing through tabs; pointer clicks remain immediate.
- `refreshView` already uses `activeQueryRequestId` to ignore stale responses, so rapid tab changes remain correctness-safe even when overlapping work is in flight.
- `getViewValue`/`setViewValue` are null-safe and preserve fallback state, preventing crashes during early boot before archive controls are injected.
- Regression hardening: after migration, grep for `#archive-view` `.value`/`change` assumptions outside the rewritten tab helpers and port them to `getViewValue()`/`setViewValue()`.

### Verification

- Hold `ArrowRight`/`ArrowLeft` across tabs: UI selection moves immediately, but search/render refresh fires at most once per debounce window.
- If multiple refreshes are in flight, stale responses are ignored by the existing `activeQueryRequestId` request guard.

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

**Goal**: (a) Reorder sort options to put `Date (Newest)` first. (b) Conditionally enable `Relevance` only when a content query is active. (c) Add disabled-state tooltips for thread-view-incompatible options.

### Plan

#### (a) Option reorder — already handled in Change 3 HTML template.

#### (b) Conditional Relevance enablement

In the `refreshView` function (or the `updateSearchStatus` callback), after parsing the query:

```typescript
const updateSortOptions = (hasContentQuery: boolean, isThread: boolean) => {
  const relevanceOption = sortSelect.querySelector('option[value="relevance"]') as HTMLOptionElement;
  const replyToOption = sortSelect.querySelector('option[value="replyTo"]') as HTMLOptionElement;

  if (relevanceOption) {
    relevanceOption.disabled = !hasContentQuery;
    relevanceOption.title = hasContentQuery ? '' : 'Relevance sorting requires a search query';
    // Property update only; do not dispatch 'change' events from this helper.
    // If currently selected but now invalid, switch to date
    if (!hasContentQuery && sortSelect.value === 'relevance') {
      sortSelect.value = 'date';
      state.sortBy = 'date';
    }
  }
  if (replyToOption) {
    replyToOption.disabled = isThread;
    replyToOption.title = isThread ? 'Not available in thread view' : '';
    // Property update only; do not dispatch 'change' events from this helper.
    if (isThread && sortSelect.value === 'replyTo') {
      sortSelect.value = 'date';
      state.sortBy = 'date';
    }
  }
};
```

Call `updateSortOptions(hasContentQuery, isThreadMode(viewMode))` inside `refreshView` after parsing the query.

Important ordering in `refreshView`: capture `sortMode` **after** `updateSortOptions(...)` runs, because `updateSortOptions` may rewrite `sortSelect.value` (e.g., `relevance` → `date`).

```typescript
const refreshView = async (budgetMs?: number) => {
  const requestId = ++activeQueryRequestId;
  const currentQuery = searchInput.value;
  const parsed = parseStructuredQuery(currentQuery);
  const hasContentQuery = parsed.clauses.some(isPositiveContentWithoutWildcard);
  const isThread = isThreadMode(state.viewMode);

  updateSortOptions(hasContentQuery, isThread);

  // Capture after option normalization so runSearch gets the effective value.
  const sortMode = sortSelect.value as ArchiveSearchSortMode;

  const result = await searchManager.runSearch({
    query: currentQuery,
    sortMode,
    // ...
  });
  // ...
};
```

**Note**: The existing `viewSelect` change handler (lines 717–738 of `index.ts`) already disables `replyTo` and `relevance` in thread mode. The new `updateSortOptions` function **replaces** that inline logic with a unified function that handles both thread-mode disabling and content-query disabling. Remove the duplicate inline logic from the `viewSelect` handler when implementing this change.

Idempotency / loop-safety requirement:

- `updateSortOptions` must remain side-effect-free beyond direct property updates (no synthetic `'change'` events).
- Repeated calls with the same inputs should be no-op after first normalization.
- Immediate UI normalization during typing is expected; `activeQueryRequestId` already prevents stale async responses from repainting outdated state.

#### (c) Determine `hasContentQuery`

Use `isPositiveContentWithoutWildcard` from `ast.ts`:

```typescript
import { isPositiveContentWithoutWildcard } from './search/ast';

// After parsing:
const parsed = parseStructuredQuery(currentQuery);
// NOTE: helper already checks !clause.negated internally.
const hasContentQuery = parsed.clauses.some(isPositiveContentWithoutWildcard);
```

### Notes

- This avoids degenerate cases where `Relevance` is selected with no meaningful scoring signal (`''`, wildcard-only `*`, etc.) and effectively falls back to chronology.
- The sort dropdown retains its `<select>` form since it has 6 options — too many for a segmented control.

### Verification

- UI value may normalize before earlier requests settle; this is intentional and correctness-safe with request-id guarding.
- When UI normalization rewrites sort to `date`, keep `state.sortBy` synchronized in the same branch.
- With empty/non-content query and `relevance` selected, `updateSortOptions` rewrites UI to `date` and `runSearch` receives `sortMode: 'date'` (no stale captured value).
- In thread mode, `replyTo` is disabled and if previously selected, both UI and request use fallback `date`.

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
    searchStatusEl.textContent = 'Ready';
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
- Keep no-message state short (`Ready`) since Change 6 adds a dedicated syntax cheatsheet.

---

<a name="change-9"></a>
## Change 9: Result Count in Toolbar

**Goal**: Show the result count and query time inline in the secondary toolbar row.

### Plan

#### [MODIFY] `src/scripts/power-reader/archive/index.ts`

`#archive-result-count` is introduced in Change 3 markup. In Change 9, do not add new HTML; only wire/update behavior after `refreshView` completes:

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

Add lightweight loading feedback tied to request lifecycle:

```typescript
const setSearchLoading = (isLoading: boolean) => {
  resultCountEl?.classList.toggle('is-loading', isLoading);
  feedEl?.classList.toggle('is-loading', isLoading);
};

const refreshView = async (budgetMs?: number) => {
  const requestId = ++activeQueryRequestId;
  setSearchLoading(true);
  try {
    const result = await searchManager.runSearch(/* ... */);
    if (requestId !== activeQueryRequestId) return;
    // ... existing success path ...
  } finally {
    if (requestId === activeQueryRequestId) {
      setSearchLoading(false);
    }
  }
};
```

#### [MODIFY] `src/scripts/power-reader/archive/index.ts` — CSS block

```css
#archive-result-count.is-loading,
#archive-feed.is-loading {
  opacity: 0.6;
  transition: opacity 120ms ease;
}
```

### Notes

- When there's no active query, the count shows total archive size (e.g., "3,847 items") using `toLocaleString()` for comma formatting.
- When searching, it shows "423 results • 3.2ms".
- This provides always-visible feedback that the search actually ran.
- Loading state is intentionally subtle (opacity-only) to avoid layout shift while still signaling active work.

### Verification

- While a search request is active, `#archive-result-count` and `#archive-feed` carry `.is-loading`.
- On latest-request completion, loading classes are removed; stale-request completions do not clear loading for a newer in-flight request.

---

<a name="change-10"></a>
## Change 10: Search Result Term Highlighting

**Goal**: Highlight matched terms/phrases in the rendered results (card and thread views).

### Plan

#### [NEW] `src/scripts/power-reader/archive/search/highlight.ts`

Create a new module for post-render highlighting:
Note: this snippet is abridged; `buildHighlightRegex` is defined in the same module before `highlightTermsInContainer`.

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
  const MAX_HIGHLIGHT_TERMS = 20;
  const MIN_HIGHLIGHT_TERM_LEN = 3;

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

  return Array.from(new Set(terms))
    .filter(term => term.length >= MIN_HIGHLIGHT_TERM_LEN)
    .slice(0, MAX_HIGHLIGHT_TERMS);
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
  // Stable signature: insensitive to query term ordering and duplicate clauses.
  const stableTerms = Array.from(new Set(terms)).sort((a, b) => a.localeCompare(b));
  const signature = stableTerms.join('\u001F');
  const previousSignature = container.getAttribute('data-pr-highlighted-terms');

  // Fast path for repeated renders with unchanged terms.
  if (previousSignature === signature) return;

  // If terms changed, remove old marks first so we don't accumulate stale highlights.
  if (previousSignature !== null) {
    container.querySelectorAll('mark.pr-search-highlight').forEach((mark) => {
      const text = document.createTextNode(mark.textContent || '');
      mark.replaceWith(text);
    });
    container.normalize();
  }

  if (stableTerms.length === 0) {
    // Mark as processed for empty term set too, so callers can skip repeat work.
    container.setAttribute('data-pr-highlighted-terms', signature);
    return;
  }

  // Build a normalization-aware regex from shared helper.
  const pattern = buildHighlightRegex(stableTerms);
  if (!pattern) {
    container.setAttribute('data-pr-highlighted-terms', signature);
    return;
  }

  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
  const textNodes: Text[] = [];
  while (walker.nextNode()) {
    textNodes.push(walker.currentNode as Text);
  }

  for (const textNode of textNodes) {
    const parent = textNode.parentElement;
    if (!parent) continue;
    // Skip existing highlights, code blocks, link text, and script/style tags.
    if (parent.closest('mark, code, pre, script, style, a')) continue;

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

  container.setAttribute('data-pr-highlighted-terms', signature);
};
```

#### [MODIFY] `src/scripts/power-reader/archive/index.ts`

After rendering the feed, call the highlighting function:

```typescript
import { extractHighlightTerms, highlightTermsInContainer } from './search/highlight';

// After renderArchiveFeed completes:
const applySearchHighlight = () => {
  const query = searchInput.value.trim();
  const terms = extractHighlightTerms(query);

  const feedEl = document.getElementById('archive-feed');
  if (!feedEl) return;

  const termsKey = Array.from(new Set(terms)).sort((a, b) => a.localeCompare(b)).join('\u001F');
  const highlightTargets = feedEl.querySelectorAll('.pr-comment-body, .pr-post-body, .pr-index-title');
  if (highlightTargets.length > 1200) return; // guardrail for very large DOMs

  // Apply to comment bodies and post bodies. Skip nodes already highlighted for this exact term set.
  highlightTargets.forEach(el => {
    const node = el as HTMLElement;
    if (node.getAttribute('data-pr-highlighted-terms') === termsKey) return;
    highlightTermsInContainer(node, terms);
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
- Run highlighting at the end of `runPostRenderHooks` so earlier hooks that inspect/attach behavior to raw text nodes execute first.
- Use `data-pr-highlighted-terms` as a per-node term-signature marker. Re-renders with the same term set skip work; when terms change, old marks are removed then reapplied for only the affected nodes.
- Longest-first term sorting avoids nested marks for substring overlaps (e.g., `align` vs `alignment`). True partial-overlap pairs (e.g., `abc` and `bcd`) follow standard leftmost regex matching and may not highlight both overlaps; acceptable for v1.
- Guardrails: ignore tiny terms (`len < 3`), cap term count, and skip highlighting on very large rendered result sets.
- **Limitation**: The normalized terms are lowercased. The `'gi'` regex flag handles case-insensitive matching against original text, but NFKC-normalized characters (e.g., `ﬁ` → `fi`) won't match the original if the original uses the composed form. This is acceptable for v1.
- v2 TODO: evaluate a normalization-aware text walker (potentially with `Intl.Segmenter`) for better Unicode-equivalent highlighting.

### Verification

- Search for `alignment` → all instances of "alignment" in visible results are wrapped in `<mark>`.
- Phrase search `"alignment tax"` → the exact phrase is highlighted.
- Performance: highlighting 500 DOM elements should complete in < 50ms.
- Empty query path: nodes get `data-pr-highlighted-terms=""` and subsequent renders skip reprocessing.

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

#### [MODIFY] `src/scripts/power-reader/archive/render.ts` — make snippet terms an explicit render input

Avoid module-level mutable state by threading snippet terms through render calls:

```typescript
export type RenderArchiveOptions = {
  snippetTerms?: readonly string[];
};

/**
 * Extract a snippet centered on the first match of any search term.
 * Falls back to head-of-body if no match found.
 */
const extractSnippet = (
  text: string,
  maxLen: number,
  snippetTerms: readonly string[]
): string => {
  if (!text) return '';
  const textLower = text.toLowerCase();

  for (const term of snippetTerms) {
    const idx = textLower.indexOf(term.toLowerCase());
    if (idx === -1) continue;

    const contextRadius = Math.max(0, Math.floor((maxLen - term.length) / 2));
    let start = Math.max(0, idx - contextRadius);
    let end = Math.min(text.length, idx + term.length + contextRadius);

    // Re-balance to use the full snippet budget when one side is clipped by boundaries.
    const targetLen = Math.min(maxLen, text.length);
    const currentLen = end - start;
    if (currentLen < targetLen) {
      const deficit = targetLen - currentLen;
      if (start === 0) {
        end = Math.min(text.length, end + deficit);
      } else if (end === text.length) {
        start = Math.max(0, start - deficit);
      }
    }

    const prefix = start > 0 ? '…' : '';
    const suffix = end < text.length ? '…' : '';
    return prefix + text.slice(start, end) + suffix;
  }

  return text.slice(0, maxLen) + (text.length > maxLen ? '…' : '');
};

export const renderIndexItem = (
  item: Post | Comment,
  options: RenderArchiveOptions = {}
): string => {
  const snippetTerms = options.snippetTerms ?? [];
  const isPost = 'title' in item;

  let title: string;
  if (isPost) {
    title = (item as Post).title;
  } else {
    const bodyText = ((item as Comment).htmlBody || '').replace(/<[^>]+>/g, '');
    title = extractSnippet(bodyText, 120, snippetTerms);
  }

  // ... rest unchanged ...
};
```

#### [MODIFY] `src/scripts/power-reader/archive/render.ts` — `renderArchiveFeed`

Pass snippet terms down when rendering index rows:

```typescript
export const renderArchiveFeed = async (
  container: HTMLElement,
  items: ArchiveItem[],
  viewMode: ArchiveViewMode,
  readerState: ReaderState,
  sortBy: ArchiveSortBy,
  options: RenderArchiveOptions = {}
) => {
  // ...
  const visibleItems = items.slice(0, currentRenderLimit);
  if (viewMode === 'index') {
    container.innerHTML = visibleItems.map(item =>
      renderIndexItem(item as Post | Comment, { snippetTerms: options.snippetTerms })
    ).join('');
  }
  // ...
};
```

#### [MODIFY] `src/scripts/power-reader/archive/index.ts` and `src/scripts/power-reader/archive/uiHost.ts`

Compute snippet terms from the active query and pass them to every `renderArchiveFeed` call site:

```typescript
import { extractHighlightTerms } from './search/highlight';

const snippetTerms = extractHighlightTerms(searchInput.value);
await renderArchiveFeed(feedEl!, activeItems, state.viewMode, uiHost.getReaderState(), state.sortBy, { snippetTerms });
```

Also update direct `renderIndexItem(item)` fallback paths (e.g., index collapse handler) to pass `{ snippetTerms }` so snippets stay query-consistent across incremental UI interactions.

### Notes

- Snippet extraction is best-effort and term/phrase-centric. It intentionally uses plain substring matching from `snippetTerms`, not full AST replay.
- Match windows are re-balanced when one side is clipped by text boundaries so short leading/trailing matches still use most of `maxLen`.
- Regex clauses and certain normalized matches that the search engine can find may not produce match-centered snippets; in those cases, fallback head snippets remain acceptable for v1.
- A v2 path is to pass parsed query/AST match metadata into rendering for engine-exact snippet alignment.

### Verification

- Search for `alignment` → index view shows "…discussing the alignment tax and its implications for…" (centered on match) instead of a random first-100-chars snippet.
- Empty query shows head-of-body snippet as before.
- Very long term/phrase (> `maxLen`) still preserves the matched segment (no negative-radius truncation bug).

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
import { normalizeForSearch } from './normalize';

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
const escapeQueryQuotedValue = (value: string): string =>
  value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

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

    // Author (use original displayName for display, normalize key exactly like parser/search docs)
    const displayName = item.user?.displayName || '';
    if (displayName) {
      const key = normalizeForSearch(displayName);
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
      items: topAuthors.map(([normName, { display, count }]) => {
        const needsQuote = /[\s":]/u.test(display);
        const queryFragment = needsQuote
          ? `author:"${escapeQueryQuotedValue(display)}"`
          : `author:${display}`;
        return {
          value: display,
          queryFragment,
          count,
          active: active.authors.has(normName)
        };
      })
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

  const hasFacetItems = facetResult.groups.some(g => g.items.length > 0);
  if (!hasFacetItems && !facetResult.delayed) {
    facetsEl.style.display = 'none';
    return;
  }

  facetsEl.style.display = '';
  if (!hasFacetItems && facetResult.delayed) {
    facetsEl.innerHTML = '<span class="pr-facet-delayed">Facets delayed — refine query</span>';
    return;
  }

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

const normalizeQueryWhitespace = (value: string): string =>
  value.replace(/\s+/g, ' ').trim();

const removeQueryFragment = (input: HTMLInputElement, fragment: string) => {
  // Remove the fragment from the query text
  const escaped = fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  input.value = normalizeQueryWhitespace(
    input.value.replace(new RegExp(`(^|\\s)${escaped}(?=\\s|$)`, 'gi'), ' ')
  );
};

const appendOrReplaceQueryFragment = (input: HTMLInputElement, fragment: string) => {
  const kind = getFragmentKind(fragment);
  if (kind) {
    // Remove existing operators of the same kind.
    // Intentional UX choice: this replaces all same-kind filters, including
    // manually typed ones, to keep facet interactions deterministic.
    // Pattern handles unquoted values and quoted values with escaped quotes.
    const kindPattern = new RegExp(`(^|\\s)-?${kind}:(?:"(?:[^"\\\\]|\\\\.)*"|\\S+)(?=\\s|$)`, 'gi');
    input.value = normalizeQueryWhitespace(input.value.replace(kindPattern, ' '));
  }
  input.value = normalizeQueryWhitespace(input.value ? `${input.value} ${fragment}` : fragment);
};
```

### Notes

- **v1 Simplification**: Facets are computed on the main thread from the `SearchRunResult.items` array. This is fine for typical result sets (< 5000 items). The spec allows deferring worker-side facet computation.
- `escapeHtml` already exists in `../utils/rendering` and is already used/imported in archive rendering paths; Change 12 reuses that utility (no new helper needed).
- The facet budget (30ms) is enforced — on large unfiltered archives, facets gracefully degrade with the "Facets delayed" message (including the empty-group case where no chips are yet available).
- Author facet values now use original `item.user.displayName` for display and lowercased name for keying/active-detection (fixed from v1 plan which used `authorNameNorm` for display).
- Active facet detection uses the parsed AST (`parseStructuredQuery`) instead of `queryLower.includes()`, preventing false positives on substrings like `type:poster` matching `type:post`.
- Year buckets only show when there's more than one distinct year.
- Date facet "active" is intentionally inferred from positive date-clause year starts (`minMs`). Complex cross-year ranges may light up the start year chip in v1.
- Facet replacement is kind-based (`author:`, `type:`, `date:`). Clicking a facet replaces all existing operators of that kind, including manually typed ones; this is intentional for predictable single-choice facet UX.
- String replacement uses token-boundary-aware patterns and handles negated forms (e.g., `-type:post`) to reduce accidental substring removals.
- If future parser versions add boolean grouping/`OR`, revisit kind-wide replacement behavior so facet actions do not unexpectedly flatten complex same-kind expressions.
- **Scalability note**: Since `SearchRunResult.items` returns full `ArchiveItem[]` hydrated on the main thread, facet computation on very large result sets (>10k items) may compete for main-thread time. If this becomes measurable, move facet computation to the worker post-v1.
- Instrument facet runtime (`computeMs`) in debug logs so delayed-state frequency can be measured before deciding whether worker migration should be prioritized.

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

#### [MODIFY] `src/scripts/power-reader/archive/index.ts` — detect debug mode and pass through

```typescript
const isDebugMode = (): boolean =>
  new URLSearchParams(window.location.search).get('debug') === '1';
```

Inside `refreshView`, pass debug mode into search execution:

```typescript
const result = await searchManager.runSearch({
  query: searchInput.value,
  scopeParam,
  sortMode,
  limit: state.items.length + contextItems.length + 5,
  debugExplain: isDebugMode(),
  ...(budgetMs !== undefined ? { budgetMs } : {})
});
```

#### Data availability gap

Currently, `SearchRunResult` returns `items` but not the per-item `RelevanceSignals`. The `runSearch` method computes `relevanceSignalsById` internally (engine.ts line 398) but doesn't expose it in the result type.

**Fix**:

- Add `debugExplain?: boolean` to `runSearch` request/options types (`ArchiveSearchManager` and underlying search execution request shape).
- Update worker message schema in `src/scripts/power-reader/archive/search/protocol.ts` so `runQuery` request payload includes `debugExplain` and result payload can carry explainability metadata.
- Wire `protocol.ts` shape changes through `worker.ts` and `workerFactory.ts` so main-thread and worker contracts stay in sync.
- Add `relevanceSignalsById?: Map<string, RelevanceSignals>` to `SearchRunResult`.
- Populate `relevanceSignalsById` only when `debugExplain` is true.

This avoids the overhead in production while enabling the explain panel in debug mode.

### Verification

- `?debug=1` → clicking a result's debug icon shows match explanation.
- `?debug=1` → `runSearch` receives `debugExplain: true` and returns `relevanceSignalsById`.
- Without debug flag, no extra UI or computation overhead (`debugExplain: false`, no signals payload).

---

<a name="implementation-order"></a>
## Implementation Order

```
Change 0: CSS Foundation          (~30 min)  — prerequisite for all UI changes
Change 0.5: Sort Type Unification (~20 min)  — prevents alias drift before new wiring
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
| **A** | 0, 0.5, 1, 2 | ~2 hr | Foundation + type cleanup + basic UX quick wins |
| **B** | 3, 4, 5 | ~4 hr | Toolbar restructure (implement atomically — see Known Issues §2) |
| **C** | 6, 7, 8, 9 | ~3 hr | Information architecture improvements |
| **D** | 10, 11 | ~3.5 hr | Search result relevance visibility, including `renderArchiveFeed` options signature rollout and index expand/collapse call-site updates |
| **E** | 12 | ~4 hr | Facets (Phase 4 core) |
| **F** | 13 | ~2 hr | Debug explain panel (optional) |

---

<a name="testing-strategy"></a>
## Testing Strategy

### Unit Tests

- **`highlight.ts`**: New test file for `extractHighlightTerms` and `highlightTermsInContainer` with DOM fixtures, including overlap cases (`align`/`alignment`) and documented partial-overlap behavior (`abc`/`bcd`).
- **`facets.ts`**: Test `computeFacets` with mock `ArchiveItem` arrays, including budget-exceeded scenarios.
- **Sort conditional visibility**: Test `updateSortOptions` logic.

### Existing Test Updates

Existing E2E tests already reference these selectors heavily, especially in `tests/archive-context.spec.ts`, `tests/archive-route.spec.ts`, and `tests/archive-sync.spec.ts`.

Batch B must include test migrations for scope/view interactions:

1. Replace `selectOption(...)` for `#archive-scope` and `#archive-view` with helper actions that click segmented/tab buttons by `data-value`.
2. Keep selectors ID-based (`#archive-scope`, `#archive-sort`, `#archive-view`) so test locators survive markup changes.
3. Add assertions for tab semantics (`aria-selected`) and thread-mode sort disabling to preserve behavior currently validated through `<select>` state.
4. Treat Batch B as breaking for old tests: merge UI changes and test migration in the same PR/commit range so CI is not left red on `selectOption` calls against non-`<select>` elements.

### New E2E Tests (recommended)

1. **Clear button**: Navigate to archive with `?q=test`, click clear, verify URL and results reset.
2. **Facet click**: Search for `*`, click `type:post` facet, verify query updates and results filter.
3. **Keyboard shortcut**: Press `/`, verify search input is focused.
4. **Snippet preview**: Search in index view, verify snippet contains the search term.
5. **Syntax cheatsheet**: Click an example query, verify it populates the search bar and runs.
6. **View tab keyboard a11y**: With focus on `#archive-view`, verify Arrow/Home/End and Enter/Space change active tab, while Tab moves focus out normally.
7. **Loading feedback**: Trigger a slow search path, verify `#archive-result-count`/`#archive-feed` enter and exit `.is-loading` state correctly.

---

## Appendix: Files Modified

| File | Changes | Notes |
|------|---------|-------|
| `src/scripts/power-reader/archive/index.ts` | 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12 | CSS block + HTML template + event wiring |
| `src/scripts/power-reader/archive/render.ts` | 11 | explicit `snippetTerms` render options + `extractSnippet` + `renderIndexItem` |
| `src/scripts/power-reader/archive/search/highlight.ts` | 10, 11 (new file) | `extractHighlightTerms` + `highlightTermsInContainer` |
| `src/scripts/power-reader/archive/search/facets.ts` | 12 (new file) | `computeFacets` (works on `ArchiveItem[]`) |
| `src/scripts/power-reader/archive/search/types.ts` | 0.5, 13 | sort alias unification + `relevanceSignalsById` (debug explainability) |
| `src/scripts/power-reader/archive/state.ts` | 0.5 | keep `ArchiveSortBy` as source-of-truth alias target |
| `tests/archive-search-highlight.spec.ts` | 10 (new test file) | Unit tests for highlight extraction |
| `tests/archive-facets.spec.ts` | 12 (new test file) | Unit tests incl. budget-exceeded scenario |
