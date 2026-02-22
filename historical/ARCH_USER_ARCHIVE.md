# User Archive 2.0 Architecture

## 🎯 Vision
Transform the user profile into a powerful, offline-first research tool that aggregates a user's *entire* intellectual history (posts & comments) into a searchable, analyzable, and interactive feed.

---

## 📅 Phased Implementation Plan

### Phase 1: Foundation & Data Layer (✅ Completed)
**Goal**: Fetch, store, and display massive amounts of data without freezing the browser.
- **Bulk Ingestion**: Specialized data loader to fetch 10,000+ items via pagination loops.
- **Smart Caching (IndexedDB)**: Persist full history locally. Subsequent visits only fetch *new* items since the last sync watermark.
- **Unified Feed**: A single chronological stream merging `Post` and `Comment` objects.
- **Threaded Context** ✅: Group comments by thread, with full or placeholder parent context.

### Phase 2: Parity & Search (✅ Completed)
**Goal**: Match and exceed the utility of `lw_user_archive.html`.
- **Client-Side Filters (✅ Done)**: Instant regex filtering on body text via search bar.
- **Render Guardrail (✅ Done)**: Bounded render caps with chunked DOM insertion for large datasets (no user-click pagination controls).
- **Sorting (✅ Done)**:
  - **Karma**: Best/Worst takes.
  - **Date**: Oldest/Newest.
  - **Reply-To**: Group by interlocutor.
- **View Modes (✅ Done)**:
  - **Card View**: Full content (Power Reader style). Each comment shows its immediate parent as a header-only stub.
  - **Index View**: Dense list of titles/snippets. Click to expand in-place to card view.
  - **Thread View (Full)**: Context-heavy view with full parent comments fetched from server.
  - **Thread View (Placeholder)**: Context view with stub parent comments (metadata-only, no network requests).
- ✅ **Profile Page Integration**: Injected "Archive" button on user profile pages.
- ✅ **Feed Integration**: `[View in Archive]` buttons on user hover cards.

### Phase 3: Advanced Intelligence
**Goal**: Analytics and AI capabilities.
- **Deep Query Engine**: `score:>50 tag:"AI" date:2020..2022`.
- **Analytics Dashboard**: Karma graphs, heatmaps, word clouds.
- **AI Synthesis**: "Chat with Archive", Contradiction Checker.
- **Export**: JSON/Markdown dumps.

### Phase 4: Advanced Search (Greenfield Architecture, ✅ Completed)
**Goal**: Deterministic, multi-stage local search engine capable of complex AST evaluation without blocking the UI thread.
- **Worker Architecture**: `worker.ts` maintains partitioned indices (`authored`, `context`) off the main thread to prevent UI lockup.
- **Structured Parser**: Safe AST parsing (`parser.ts`) supporting exact phrases, ReDoS-protected regex literals, negated clauses, and structured operators (`score:`, `date:`, `type:`, `author:`, `replyto:`).
- **Execution Engine**: `engine.ts` executes **Stage A** (cheap operations: structured field bounds, negative filters, index-driven token intersections) before proceeding to candidate scanning in **Stage B** (expensive regex/phrase evaluation on matched body text).
- **Time Budgeting**: Engine respects configurable latency bounds (`budgetMs`) to degrade gracefully and return partial results on massive candidate sets without thrashing CPU.
- **UX Parity & Upgrades**: Semantic UI elements (Segmented Controls for Scope, Icon Tabs for View Mode), dynamic keyword Highlighting, intelligent Facet extraction, and robust URL state synchronization.

---

## 🏗️ Technical Architecture

### 1. Routing & Entry Point
The archive shares the Power Reader's "nuclear takeover" mechanism but bifurcates immediately after routing.

- **URL Pattern**: `https://www.lesswrong.com/reader?view=archive&username=Wei_Dai`
- **`router.ts` Updates**:
  - Extend `RouteResult` to support `{ type: 'archive', username: string }`.
  - Parse query parameters: `const params = new URLSearchParams(window.location.search);`.
  - Check `params.get('view') === 'archive'`.
- **`main.ts` Updates**:
  - Detect `archive` route type.
  - Call `initArchive(username)` instead of the standard `loadAndRender()`.
  - Use common `executeTakeover()` to clear the React app.

### 2. State Management (`archive/state.ts`)
A dedicated state object separate from the main feed to avoid pollution.
```typescript
interface ArchiveState {
  // Target User
  username: string;
  userId: string;
  
  // Data Store
  items: (Post | Comment)[]; // Unified list
  itemIndex: Map<string, Post | Comment>;
  
  // Caching
  lastSyncDate: string; // Watermark for incremental updates
  
  // View State
  viewMode: 'card' | 'index' | 'thread-full' | 'thread-placeholder';
  filters: ArchiveFilter; // { regex, score, date, etc. }
  sortBy: 'date' | 'score' | 'replyTo';
}

/**
 * Helper to check if a view mode is any thread variant
 */
const isThreadMode = (mode: ArchiveViewMode): boolean =>
  mode === 'thread-full' || mode === 'thread-placeholder';
```

### 3. Data Layer (`archive/loader.ts` & `archive/storage.ts`)
- **Incremental Loading Strategy**:
  1. Check **IndexedDB** for existing user history.
  2. Fetch only items *newer* than `lastSyncDate` from GraphQL.
  3. Merge new items into IndexedDB.
  4. Load full dataset into memory for instant filtering.
  
- **GraphQL Queries**:
  - **UserComments**: Fetch comments by `userId`.
  - **UserPosts**: Fetch posts by `userId`.
  - **Note**: The archive bulk fetch mechanism performs a forward sync using `after` cursors and `sortBy: "oldest"`, starting from the `lastSyncDate` watermark and continuing until all new items are retrieved. This matches the main reader's date-windowed query patterns.

- **Reuse**:
  - Import `fetchRepliesBatch` from `../services/loader` to implement "Threaded Context".
  - Import `queryGraphQL` wrapper for type safety.

### 4. Component Architecture & Refactoring
To avoid duplicating the complex rendering logic in `render/comment.ts` and `render/post.ts`, we will extract shared sub-components.

| Existing Logic | Current Location | New Home (`render/components/`) | Notes |
|----------------|------------------|---------------------------------|-------|
| Vote arrows | `utils/rendering.ts` | `actions.ts` | Stateless rendering of vote UI |
| Reaction picker | `utils/rendering.ts` | `actions.ts` | Stateless rendering of reaction UI |
| Comment body | `render/comment.ts` | `body.ts` | Includes `highlightQuotes` & `sanitizeHtml` |
| Meta (Author/Date) | `render/comment.ts` | `metadata.ts` | Standardized header for posts & comments |
| Post specific | `render/post.ts` | `post-body.ts` | Truncation logic and "Read More" |

**Refactoring Plan**:
1. Create `src/scripts/power-reader/render/components/`.
2. Move logic from `comment.ts` and `post.ts` into these pure functions.
3. Update main Reader to use new components.
4. Build Archive renderer using these same components.

### 5. Infrastructure & Logic Reuse

| Module | Reused? | Notes |
|--------|---------|-------|
| `events/hotkeys.ts` | ✅ Yes | Works via standard `.pr-item` and `data-action` attributes. |
| `utils/rendering.ts` | ✅ Yes | Core HTML generation helpers. |
| `services/loader.ts` | 🟡 Partial | `fetchRepliesBatch` is reused; smart loading logic is NOT. |
| `services/ReadTracker.ts` | ❌ No | Archive does not track read state (you are viewing history). |
| `components/StickyHeader.ts` | ⚠️ TBD | Archive may need a simpler version (user stats vs post stats). |
| `styles.ts` | ✅ Yes | Shared CSS variables and visual system. |

### Context Type System

The archive uses a unified `contextType` enum to represent different comment states:

```typescript
type ContextType = 'missing' | 'fetched' | 'stub' | undefined;

// 'missing' - Structural placeholder (parent not in any query)
// 'fetched' - Full comment loaded from server for ancestry
// 'stub'    - Metadata-only from parentComment ref (author, date)
// undefined - Normal user-authored comment
```

**Benefits**:
- Replaces scattered boolean flags (`isPlaceholder`, `isContext`)
- Enables discriminated rendering paths
- Preserves context across view switches (both `'fetched'` and `'stub'` persist)
- Guard in `mergeComments` prevents overwriting stubs with fetched versions

**Rendering Behavior**:
| contextType | CSS Class | Vote Buttons | Body Content |
|-------------|-----------|--------------|--------------|
| `'missing'` | `.pr-missing-parent` | ❌ | None (invisible div) |
| `'fetched'` | `.context` | ✅ | Full body |
| `'stub'` | `.pr-context-placeholder` | ❌ | None (header-only) |
| `undefined` | - | ✅ | Full body |

### 6. Directory Structure
```
src/scripts/power-reader/
├── archive/              <-- NEW SUBSYSTEM
│   ├── index.ts          (Entry point: initArchive)
│   ├── state.ts          (ArchiveState)
│   ├── loader.ts         (GraphQL loop + Normalization)
│   ├── storage.ts        (IndexedDB wrapper)
│   ├── render.ts         (Dashboard + Feed)
│   └── events.ts         (Archive-specific listeners)
├── render/
│   ├── components/       <-- NEW SHARED
│   │   ├── body.ts       (Content rendering)
│   │   ├── metadata.ts   (Headers)
│   │   └── actions.ts    (Voting/Reactions)
```

---

## 🧪 Testing Strategy

Since the Archive relies heavily on IndexedDB and massive data sets, standard E2E tests are insufficient.

1.  **Unit Tests (`archive/loader.spec.ts`)**:
    *   Verifies adaptive batch size calculations.
    *   Mock GraphQL responses for partial/full syncs.
    *   Verify `lastSyncDate` updates correctly.
    *   Verify merging logic (deduplication) of new vs cached items.

2.  **Integration Tests (`archive/storage.spec.ts`)**:
    *   Test IndexedDB reads/writes using `fake-indexeddb` in Node environment.
    *   Verify schema upgrades (if any).

3.  **E2E Tests (`tests/archive-route.spec.ts`)**:
    *   **Mocked**: Load a fake user with 50 items. Verify filtering (`regex`) and sorting (`karma`) works in the UI.
    *   **Context Fetching**: Verifies that threaded view correctly fetches and renders missing parent context.
    *   **Resync Mechanism**: Verifies that clicking "Resync" triggers a full history fetch.
    *   **Status Indicators**: Verifies formatting of the status line during sync, success, and error states.
    *   **Header Injection**: `tests/header-injection.spec.ts` verifies both Reader and Archive link injection into the site header.
    *   **Live (Sanity)**: `tests/api-sanity.spec.ts` hits the real GraphQL endpoint to ensure schema compliance for all fields.

---

## ⚠️ Known Constraints & Risks
- ✅ **Memory Usage**: Virtualization (via `LARGE_DATASET_THRESHOLD`) prevents the browser from freezing when rendering 10,000+ items.
- ✅ **Initial Sync**: Adaptive batching and optimized payloads reduce the initial sync time for power users by ~80%.
- ✅ **API Limits**: The adaptive loader naturally slows down on throttled connections and bubbles up `429` errors for manual retry.
