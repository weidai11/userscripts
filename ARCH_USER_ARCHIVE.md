# User Archive 2.0 Architecture

## 🎯 Vision
Transform the user profile into a powerful, offline-first research tool that aggregates a user's *entire* intellectual history (posts & comments) into a searchable, analyzable, and interactive feed.

---

## 📅 Phased Implementation Plan

### Phase 1: Foundation & Data Layer
**Goal**: Fetch, store, and display massive amounts of data without freezing the browser.
- **Bulk Ingestion**: Specialized data loader to fetch 10,000+ items via pagination loops.
- **Smart Caching (IndexedDB)**: Persist full history locally. Subsequent visits only fetch *new* items since the last sync watermark.
- **Unified Feed**: A single chronological stream merging `Post` and `Comment` objects.
- **Threaded Context**: Group comments by thread, fetching surrounding context (parents/replies) from other users to reconstruct conversations.

### Phase 2: Parity & Search (Legacy Features)
**Goal**: Match and exceed the utility of `lw_user_archive.html`.
- **Client-Side Filters**: Instant regex filtering on body text.
- **Sorting**:
  - **Karma**: Best/Worst takes.
  - **Date**: Oldest/Newest.
  - **Reply-To**: Group by interlocutor.
- **View Modes**:
  - **Card View**: Full content (Power Reader style).
  - **Index View**: Dense list of titles/snippets.
  - **Thread View**: Context-heavy view focusing on conversation trees.
- **Reader Integration**: `[View in Archive]` buttons on authors in the main feed.

### Phase 3: Advanced Intelligence
**Goal**: Analytics and AI capabilities.
- **Deep Query Engine**: `score:>50 tag:"AI" date:2020..2022`.
- **Analytics Dashboard**: Karma graphs, heatmaps, word clouds.
- **AI Synthesis**: "Chat with Archive", Contradiction Checker.
- **Export**: JSON/Markdown dumps.

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
  viewMode: 'card' | 'index' | 'thread';
  filters: ArchiveFilter; // { regex, score, date, etc. }
  sortBy: 'date' | 'score' | 'replyTo';
}
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
  - **Note**: Unlike the main reader which uses date-windowed queries (`after`/`before`), the archive bulk fetch mechanism loops through *all* pages until it hits the `lastSyncDate` watermark.

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
    *   Mock GraphQL responses for partial/full syncs.
    *   Verify `lastSyncDate` updates correctly.
    *   Verify merging logic (deduplication) of new vs cached items.

2.  **Integration Tests (`archive/storage.spec.ts`)**:
    *   Test IndexedDB reads/writes using `fake-indexeddb` in Node environment.
    *   Verify schema upgrades (if any).

3.  **E2E Tests (`tests/archive.spec.ts`)**:
    *   **Mocked**: Load a fake user with 50 items. Verify filtering (`regex`) and sorting (`karma`) works in the UI.
    *   **Live (Sanity)**: One test to hit the real `userComments` endpoint to ensure schema compliance.

---

## ⚠️ Known Constraints & Risks
- **Memory Usage**: Loading 10,000+ objects into memory might be heavy. Phase 1 should implement virtualization (rendering only visible items) if DOM node count exceeds ~2,000.
- **Initial Sync**: The first sync for a power user (e.g. Gwern) might take 30s+. We need a robust progress bar in `render.ts`.
- **API Limits**: Bulk fetching must respect rate limits. The loader should implement cooperative backoff.
