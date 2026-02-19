# Archive Search Greenfield Architecture

## Purpose

Define a from-scratch search architecture for User Archive that is:

- Fast on very large archives (10k-100k+ items)
- Expressive enough for research workflows
- Deterministic and debuggable
- Compatible with offline-first constraints

This document also provides a migration path from the current implementation.

## Current Baseline (What Exists Today)

- Search input in archive toolbar performs immediate filtering on each input event.
- Query behavior is:
  - Valid regex: run regex against title/body text.
  - Invalid regex: fallback to case-insensitive substring.
- Filtering is done by scanning `state.items` and rebuilding text per item in the hot path.
- Sorting and view rendering happen after filtering.

This baseline is correct and simple, but it scales poorly because query-time work is O(N * text processing) on each keystroke.

## Greenfield Design Goals

- `P95 query latency < 50ms` for 20k items on typical desktop.
- `P95 query latency < 120ms` for 100k items.
- Add structured queries (`author:`, `date:`, `score:`, `type:`).
- Keep canonical authored archive state isolated from thread-context cache.
- Make every search state URL-shareable and reproducible.
- Ship a narrow v1: structured query + deterministic relevance only (no fuzzy layer).

Benchmark envelope (required for acceptance):

- Browser: Chromium stable channel used in CI.
- Dataset shapes: mixed post/comment corpus with realistic body lengths and score/date distributions.
- Hardware classes:
  - Reference desktop (baseline for SLO pass/fail)
  - Lower-tier laptop profile (used for regression alerts, not hard fail)
- Cross-browser policy: no cross-browser gate for default enablement in this phase.

## Non-Goals

- Semantic vector search (can be a later extension).
- Server-side indexing requirements.
- Replacing existing archive sync pipeline in initial rollout.

## Adversarial Review Scope

This design is reviewed against hostile or failure-prone conditions:

- Worst-case query inputs (catastrophic regex, giant token sets, malformed mixed syntax)
- Large datasets under memory pressure
- IndexedDB quota errors and schema upgrades
- Worker startup/message failures
- Sync/index races producing stale or inconsistent results
- Behavioral regressions versus the structured search specification

## Non-Negotiable Invariants

The implementation must never violate these:

- Archive UI remains responsive while queries execute.
- Query behavior follows the structured search specification (no legacy mode fallback).
- Search never mutates canonical archive data.
- A failed index build never blocks fallback search.
- Result ordering is deterministic for identical corpus + query + sort mode.
- Search memory usage stays within declared budget for the target dataset envelope.

## System Overview

The search system is split into five layers:

1. `Normalizer`
  - Converts raw Post/Comment into a compact `SearchDoc`.
  - Runs once per item update, not per query.

2. `Indexer`
  - Builds and updates in-memory indexes over `SearchDoc`.
  - Optional persisted index snapshots in IndexedDB.

3. `Parser`
  - Converts user query text into a typed AST.
  - Handles graceful fallback for malformed operators.

4. `Engine`
  - Executes AST via two-stage plan:
    - Stage A: cheap candidate narrowing (indexes, numeric/date filters).
    - Stage B: expensive checks (regex/phrases) on reduced candidate set.

5. `Ranker`
  - Produces deterministic ordering for `relevance` mode.
  - Existing archive sort modes remain available.

## Core Data Model

Introduce a dedicated search document schema:

```ts
type SearchDoc = {
  id: string;
  itemType: "post" | "comment";
  postedAtMs: number;
  baseScore: number;     // maps to item.baseScore from LW GraphQL API (not score or allKarma)

  authorNameNorm: string;
  replyToNorm: string;     // empty for posts

  titleNorm: string;       // may be empty
  bodyNorm: string;        // markdown-preferred (formatting stripped), HTML-stripped + entity-decoded fallback; may be empty
};
```

Rules:

- `SearchDoc` is derived data and can be rebuilt from canonical archive items.
- Normalizer pipeline (markdown-preferred path): strip markdown formatting syntax (emphasis markers, link brackets and URLs, blockquote prefixes, heading markers, code fences, inline code backticks, LaTeX delimiters `$`/`$$`) -> collapse whitespace -> lowercase/normalize. Formula and code content is preserved; only formatting delimiters are stripped.
- Normalizer pipeline (HTML fallback path): decode HTML entities -> strip tags -> collapse whitespace -> lowercase/normalize.
- The goal for both paths is plain-text content free of formatting artifacts.
- Empty or missing title/body fields normalize to `""`; such items remain searchable via other fields (for example `author:`).
- Do not persist duplicated per-doc concatenations or per-doc token arrays in `SearchDoc`; keep memory budget for index structures.
- Keep two isolated corpora/indexes:
  - Authored corpus (default search scope)
  - Context corpus (thread reconstruction scope)
- `scope:all` executes across both corpora and merges/dedupes at query time.
- If an item exists in both corpora, authored payload wins during merge.

## Query Language (V1)

### Supported Syntax

- Plain tokens: `alignment doom`
- Phrase: `"goodhart law"`
- Regex literal: `/foo.*bar/i`
- Explicit wildcard (match-all content clause): `*`
- Negation: `-term`, `-author:alice`
- Field operators:
  - `type:post`, `type:comment` (separate tokens; omitting `type:` matches both; multiple `type:` filters AND together, so `type:post type:comment` produces zero results)
  - `author:<text>`
  - `replyto:<text>`
  - `scope:authored`, `scope:all` (`all` = authored + contextual cache)
  - `score:>N`, `score:<N`, `score:N..M`
  - `date:>YYYY-MM-DD`, `date:<YYYY-MM-DD`
  - `date:YYYY-MM-DD..YYYY-MM-DD`, `date:YYYY-MM-DD..`, `date:..YYYY-MM-DD`
  - `date:YYYY-MM-DD` (single-day shorthand -> expanded to day range)

Score semantics:

- `score:>N` is strictly greater than N. `score:<N` is strictly less than N.
- `score:N..M` is inclusive of both bounds.
- Score values may be negative (for example `score:>-5`, `score:-10..0`).
- Negation applies to the entire range or comparison expression: `-score:5..10` excludes items with scores 5 through 10 inclusive; `-date:2024-01-01..2024-01-31` excludes items from that date range.
- Open right-range `date:YYYY-MM-DD..` terminates at first whitespace after `..`; following text is parsed as a separate clause.

Sort control:

- Sort is controlled by dedicated UI control + URL `sort` param (not query grammar in v1).

Empty query:

- An empty query (no content clauses, no field filters) returns all items in the active scope, ordered by the current sort mode. This is the default archive browse behavior.
- A query containing only control directives (for example `scope:all`) is treated as browse-all in the resolved scope, ordered by current sort mode.

Default boolean semantics:

- Plain tokens use `AND` semantics by default.
- Phrases are treated as required terms unless explicitly negated.

Field matching semantics:

- `author:` and `replyto:` are case-insensitive substring filters against full normalized names.
- Query-side normalization uses the same pipeline as indexed names (lowercase + Unicode normalization + punctuation folding).
- Stage A may use prefix/token candidate maps for speed, but final field match validation is substring-based for correctness.
- Field values may be quoted to include spaces (for example `author:"wei dai"`); unquoted values terminate at whitespace.

Date semantics:

- Date parsing uses UTC day boundaries.
- `date:YYYY-MM-DD` expands to that whole UTC day.
- `date:>YYYY-MM-DD` means strictly after the end of that UTC day.
- `date:<YYYY-MM-DD` means strictly before the start of that UTC day.
- `date:YYYY-MM-DD..YYYY-MM-DD` is inclusive of both UTC day boundaries.
- `date:YYYY-MM-DD..` means `>= start_of_day(YYYY-MM-DD)`.
- `date:..YYYY-MM-DD` means `<= end_of_day(YYYY-MM-DD)`.

### Query Contract

- Single user-facing query UX: structured only (no legacy/structured toggle).
- Query semantics are defined entirely by this structured grammar and execution model.
- Regex is supported only via explicit regex literal tokens.
- Invalid regex literals are treated as parse warnings and excluded from execution.

### Parsing Precedence (Derisked)

To avoid ambiguous behavior drift, parse in this order:

1. Explicit regex literal token (`/.../flags`)
2. Structured field operators (`author:`, `date:`, `score:`, `type:`, `scope:`)
3. Explicit wildcard token (`*`) as `MatchAll` content clause
4. Quoted phrases
5. Plain tokens

Parsing notes:

- Field operator parsing (step 2) consumes quoted values after `:` (for example `author:"wei dai"`) before the general quoted-phrase pass.
- Multiple `*` tokens collapse to one `MatchAll` AST clause.
- `*` is a no-op when any other positive content clause exists.

Partial-failure policy:

- Unknown operator-like text (for example `foo:bar` where `foo` is unsupported) is treated as a plain token.
- Reserved control operators outside query grammar (for example `sort:...`) produce a parse warning and are excluded from execution.
- Known operators with invalid values (for example malformed `date:` range) produce a parse warning and are excluded from execution.
- Unsupported date shorthands in v1 (for example `date:2024` or `date:2024-01`) produce a parse warning and are excluded.
- Invalid regex literals produce a parse warning and are excluded from execution.
- A leading `-` immediately before an operator token denotes negation (for example `-score:>5`), while `-` immediately after `:` in numeric/date values denotes a signed value (for example `score:>-5`).

### Regex Safety Guardrails

- Reject patterns above a max length budget (for example, 512 chars).
- Reject or downgrade nested quantifier patterns known to trigger catastrophic backtracking.
- Apply hard per-query execution budget in Worker; on timeout, return partial failure and downgrade to plain-text search path.
- Never run untrusted regex directly on the main thread.
- Surface a user-visible warning when safety downgrade occurs.

Safety policy notes:

- Safety downgrade must still preserve "no crash + usable fallback" behavior.
- Malformed regex literal tokens are downgraded to parse warnings and excluded from execution.

## Execution Strategy

### Stage A: Candidate Narrowing

- Apply cheap filter clauses first:
  - `type`, `score`, `date`
  - `author` and `replyto` candidate narrowing via normalized name indexes, followed by substring verification
  - Plain token intersections using inverted index
  - Scope resolution:
    - `scope:authored` -> authored corpus only
    - `scope:all` -> authored + context corpora
- Candidate seeding rule: if no Stage A clause yields a narrowed candidate set (for example phrase-only, regex-only, or single-character-token queries), seed Stage B with the full resolved scope corpus.

### Stage B: Expensive Matching

- Run regex/phrase checks only on narrowed candidates.
- Apply negations last to avoid wasted work.
- Phrase matching in v1 is exact contiguous substring match against normalized text fields (`titleNorm` and `bodyNorm`) with no fuzzy expansion; a match in either field satisfies the clause.
- Regex matching runs against `titleNorm` and `bodyNorm` separately; a match in either field satisfies the clause. Engine does not require a persisted concatenated field.

Negation semantics (normative):

- Negations are applied only after at least one positive content clause produces a candidate set.
- `scope` (and other control directives) are not positive content clauses.
- Queries composed only of negations are rejected with a user-facing validation message.
- `*` is the explicit way to form match-all queries before applying negations (for example `* -author:alice`).
- Field negation (for example `-author:alice`) has the same precedence as positive field filters and is applied in the final exclusion pass.
- If a query has no positive content clause and no negations (for example `scope:all`), it resolves to browse-all for the selected scope.

### Ranking

- V1 relevance (narrow and deterministic):
  - Token/phrase match score
  - Exact field-hit boosts (`author`, `replyto`)
  - Recency tie-break (`postedAtMs` descending)
  - Final tie-break: lexical `id` ascending (ensures full determinism)
- Deferred beyond v1:
  - Fuzzy matching
  - Advanced weighting and tuning layers

- For non-relevance sorts, retain existing deterministic order semantics.

### Scope-All Merge and Tie-Break Rules

For `scope:all`, results are merged from authored and context corpora, deduped by ID, with authored payload precedence.

Deterministic non-relevance ordering:

- Primary key: selected sort mode key (`date`, `date-asc`, `score`, `score-asc`, `replyTo`).
- Secondary key: corpus priority (`authored` before `context`) when primary key ties.
- Tertiary key: `postedAtMs` descending.
- Final key: lexical `id` ascending.

`replyTo` sort key:

- `replyTo` sort orders by lexical `replyToNorm` (empty values sort last), then applies the tie-break chain above.
- Items with empty `replyToNorm` (typically posts) are ordered by `postedAtMs` descending within the empty-value block, then lexical `id` ascending.

## Index Structures

In-memory indexes:

- Authored corpus indexes:
  - `authored.docsById: Map<string, SearchDoc>`
  - `authored.tokenIndex: Map<string, Uint32Array>`
  - `authored.authorIndex: Map<string, Uint32Array>`
  - `authored.replyToIndex: Map<string, Uint32Array>`
  - `authored.dateSortedIds: number[]`
  - `authored.scoreSortedIds: number[]`
  - `authored.replyToSortedIds: number[]`
- Context corpus indexes (same shape under `context.*` namespace).
- `idToOrdinal` and `ordinalToId` are maintained per corpus.
- Name indexes are candidate accelerators (name tokens/prefixes); final `author:`/`replyto:` semantics are enforced by substring verification.
- Name index keys are normalized name tokens (same tokenizer policy as content terms), not whole-name strings.
- Multi-token name filters intersect token postings first, then run full-name substring verification.
- Build-time mutable postings (`number[]`) are internal only and compacted to `Uint32Array` before query serving.
- Context corpus index build strategy: opportunistic idle-time warm-up after authored index is ready, with cancellation if user interaction or sync pressure increases.

Optional persistence:

- Persist `SearchDoc` rows and lightweight token postings in IndexedDB.
- Rebuild postings if schema/version mismatch.

## Worker Architecture

Search should run in a dedicated Worker in greenfield design:

- Main thread responsibilities:
  - Input events
  - URL sync
  - Result rendering

- Worker responsibilities:
  - Parse query
  - Execute plan
  - Return ranked IDs and diagnostics

Worker fallback requirements:

- If Worker creation fails (CSP/runtime limits), use main-thread fallback engine with stricter limits.
- If Worker crashes repeatedly, trip a session kill-switch and keep archive usable with bounded fallback search.
- Main-thread fallback must disable complex regex execution and use bounded chunked scans to preserve UI responsiveness.
- Fallback engine still uses the same parser/AST and supports all non-regex structured operators (`author`, `replyto`, `type`, `score`, `date`, `scope`, negation, `*`).
- Regex literals in fallback are downgraded to literal contains checks under the same execution budgets.

Main-thread fallback constants (required):

- Per-slice CPU budget: `<= 8ms`
- Inter-slice yield delay: `>= 0ms` (next task tick)
- Max docs scanned per slice: `1000`
- Max total fallback query budget before early-stop: `150ms`
- Regex in fallback mode: disabled (forced literal contains)
- Stale query policy: cancel previous query immediately on new input

Transfer and startup guardrails:

- Full indexing (`index.full.start`/`index.full.chunk`/`index.full.commit`) must support chunked ingestion to avoid giant structured-clone pauses.
- Use compact ordinals and typed arrays for postings transport.
- Enforce startup budget; if exceeded, keep serving bounded fallback search until background indexing completes.
- During chunked full rebuild, Worker serves queries from the last committed index until `index.full.commit` swap succeeds.
- Example startup SLO: worker-ready within `<= 1500ms` on 20k corpus and `<= 5000ms` on 100k corpus in reference environment.

Message protocol:

```ts
type SearchWorkerRequest =
  | { kind: "index.full.start"; batchId: string; schemaVersion: number }
  | { kind: "index.full.chunk"; batchId: string; chunkIndex: number; totalChunks: number; docs: SearchDoc[] }
  | { kind: "index.full.commit"; batchId: string }
  | { kind: "index.patch"; patchId: string; upserts: SearchDoc[]; deletes: string[]; schemaVersion: number }
  | { kind: "query.run"; requestId: string; query: string; limit: number; expectedIndexVersion?: number }
  | { kind: "query.cancel"; requestId: string };

type SearchWorkerResponse =
  | { kind: "index.ready"; source: "full" | "patch"; indexVersion: number; docCount: number; buildMs: number; batchId?: string; patchId?: string }
  | { kind: "query.result"; requestId: string; indexVersion: number; ids: string[]; total: number; tookMs: number; explain?: string[] }
  | { kind: "error"; requestId?: string; batchId?: string; patchId?: string; message: string };
```

Schema version compatibility:

- If the worker receives a `schemaVersion` it does not support (for example, worker is a stale cached copy), it responds with `error` (including `batchId` if applicable) and the main thread falls back to the fallback engine until the worker script is reloaded.

`expectedIndexVersion` semantics:

- `expectedIndexVersion` on `query.run` is advisory. The main thread sets it from the last received `index.ready.indexVersion`. The worker always executes against its current index and returns the actual `indexVersion` in the response. The main thread discards responses where `response.indexVersion < expectedIndexVersion`.

Chunked full-indexing rules:

- `chunkIndex` is 0-based.
- Chunks for a given `batchId` must arrive strictly in `chunkIndex` order.
- `totalChunks` is immutable for a `batchId`; any mismatch across chunks is rejected with `error`.
- Duplicate or out-of-order chunks for the active `batchId` are rejected with `error` (including `batchId`).
- `index.full.commit` is rejected unless all expected chunks were received exactly once.
- A new `index.full.start` with a different `batchId` cancels any in-progress full-index batch and starts a new one.

Pagination contract (v1):

- No cursor protocol in v1.
- Worker returns `ids.length <= limit`.
- `total` is the full candidate count before truncation to `limit`.
- Main thread handles incremental loading by re-issuing `query.run` with larger `limit`.
- This is a known v1 simplification: each "Load More" re-executes the full query. Offset-based or cursor-based pagination can be introduced post-v1 if incremental-loading latency becomes measurable.

Explain payload contract (v1):

- `explain` remains debug-only in v1 and is intentionally unstructured (`string[]`).
- Structured explain payload can be introduced post-v1 without affecting query semantics.

### Input Dispatch Policy (normative)

- Use trailing debounce for text input dispatch: `180ms` default.
- Dispatch immediately on Enter key, facet click, scope change, sort change, or explicit search submit.
- On each new dispatch, send `query.cancel` for prior in-flight request and ignore any stale responses by `requestId`.

## UX Design

### Search Bar

- Keep single search input.
- Add syntax hint and examples on focus.
- Show parse state:
  - valid query
  - degraded mode (fallback applied)
  - parse warning (non-fatal)
  - partial results (time budget hit)

### Facets

- Show result counts for:
  - type (post/comment)
  - top authors in result set
  - date buckets (year/month)

Facet clicks append structured terms to query. When a facet-appended operator conflicts with an existing operator of the same kind in the query, it replaces the existing operator rather than appending (for example, clicking the `comment` type facet when `type:post` is active replaces it with `type:comment`).
Facet computation runs in Worker asynchronously after primary results.
Facet computation is budgeted (`<= 30ms` per query cycle); when budget is exceeded or match set is very large, UI shows `Facets delayed - refine query` and keeps results interactive.
Queries with `*` (match-all) or an empty content clause may produce corpus-wide match sets that exceed the facet budget on large archives; the `Facets delayed` UX applies in this case.

### Scope Disclosure

- When `scope:all` is active, show `Searching authored + cached context (N items)` in UI.
- If context cache is empty or sparse, show `Context cache may be incomplete` hint.
- When `scope:all` + `sort=replyTo` is active, show `replyTo ordering is computed over mixed authored/context semantics`.

### Explainability

- Optional "Why matched" panel for selected row:
  - matched fields
  - matched terms/regex
  - score components (if relevance mode)

### Early-Stop UX (normative)

- If execution hits the fallback total query budget, return partial results with an explicit `Partial results (time budget hit)` badge.
- Do not silently truncate without signaling.
- Keep partial results interactive; do not auto-rerun in a loop.
- Provide a refinement hint (for example, add `author:`, `date:`, `type:`) rather than forcing an immediate retry.

## URL & Session Model

Search state should be URL-native:

- `?view=archive&username=...&q=...&sort=...&scope=...`

Constraints:

- Cap encoded query length at `2000` characters; degrade gracefully when exceeding this budget.
- URL decoding/parsing failures must not break archive render; fall back to empty query.
- Persist oversized queries in session storage with URL pointer key when practical.
- Invalid or missing scope always defaults to `scope:authored`.
- URL `scope` param uses literal values `authored` (default; may be omitted) and `all`.
- Canonical URL state stores `sort` and `scope` as dedicated params; `q` is reserved for search terms and field filters.
- If `q` contains `scope:` and dedicated URL `scope` param also exists, dedicated URL `scope` takes precedence and conflicting in-query scope is ignored with a parse warning.
- If `q` contains `scope:` and no dedicated URL `scope` param exists, the in-query `scope:` is honored for that query and immediately canonicalized to a dedicated URL `scope` param on the next URL serialization.
- URL serialization emits canonical state (dedicated `sort`/`scope` params and de-duplicated `q`) to avoid drift across reload/share cycles.

Benefits:

- Shareable investigations
- Reproducible debugging
- Easy test fixtures

## Storage Schema (Greenfield)

IndexedDB stores:

1. `archive_items` (existing canonical authored items)
2. `archive_contextual_cache` (existing contextual thread data)
3. `archive_search_docs` (new derived docs)
4. `archive_search_meta`:
  - schema version
  - last indexed watermark
  - index health stats

Schema versioning:

- `SEARCH_SCHEMA_VERSION` increments on tokenizer/query semantics changes.
- On mismatch, rebuild search docs/index asynchronously.

Quota and corruption handling:

- If writing search-derived stores fails, continue using in-memory index for the current session.
- If both persistent and in-memory index builds fail, fall back to bounded fallback search path.
- Track and expose last successful index build timestamp.

## Consistency Model

Search is eventually consistent with canonical archive items.

- Query results may lag behind sync merges until patch indexing finishes.
- Patch indexing must be atomic per batch: either all upserts/deletes applied, or none.
- Worker applies each patch against an isolated mutable index snapshot and swap-commits only on success.
- `indexVersion` is a monotonically increasing integer, incremented on each successful `index.full.commit` or `index.patch` application.
- Include `indexVersion` in query responses for debugging stale-result reports.
- On version mismatch between UI expectation and worker response, discard stale response.
- `index.ready` is required after successful full/patch indexing; missing ack implies build/apply did not complete and should trigger retry or full rebuild.
- Context corpus index invalidates whenever new contextual items are persisted.
- After `saveContextualItems` completes, main thread emits `index.patch` upserts for context-origin items; if context index is not initialized yet, queue patches until warm-up begins.
- UI should show lightweight "indexing updates" indicator when sync patches are pending.

## Tokenization and Locale Policy

- Default tokenizer: Unicode-aware lowercase normalization with punctuation folding.
- Preserve original text for snippet/highlight rendering; never highlight from normalized strings directly.

### Tokenization Specification (v1)

- Normalize with Unicode NFKC + lowercase before token extraction.
- Token boundaries use whitespace and punctuation separators.
- Hyphen and slash split tokens (for example `well-known` -> `well`, `known`).
- Apostrophes are folded out within tokens (for example `don't` -> `dont`).
- Numeric terms are indexable tokens (for example `2024`, `100k`).
- Indexed token minimum length is `2` code points.
- Single-character plain tokens are treated as Stage B literal substring checks (not inverted-index terms) to protect index size.

### CJK and Low-Confidence Segments

- For non-whitespace scripts when tokenizer confidence is low, each contiguous low-confidence segment is treated as one substring-phrase clause.
- CJK fallback does not split into per-character AND clauses.

## Observability

Track local metrics (no external telemetry required initially):

- Query latency (`tookMs`)
- Candidate counts per execution stage
- Zero-result rate
- Fallback usage rate by cause (regex safety downgrade, worker unavailable/crash, startup budget exceeded, storage/index failure)
- Cache hit rate for repeated queries

Result caching (v1):

- The worker may cache the last N query results keyed by normalized `(query, sort, scope)`. Cache is invalidated on any `indexVersion` change. When cache is not implemented, the cache hit rate metric reports zero.

Expose metrics in debug mode for tuning.

Add hard-stop operational metrics:

- Worker crash count per session
- Regex safety downgrade count
- Fallback-engine activation count
- Index rebuild duration and failure rate
- Peak search memory footprint (MB)

## Testing Strategy

### Conformance Corpus (required)

- Maintain a versioned JSON fixture corpus at `tests/archive-search/conformance/*.json` for structured-query behavior.
- Minimum initial coverage: `50+` query/expected-output fixtures spanning all operators, negation, scope behavior, malformed input handling, and deterministic ordering checks.
- Each fixture defines: input query, scope/sort controls, expected ordered ID list (or stable prefix), and expected parse warnings.
- Warning assertions validate warning count and warning type tags (`invalid-regex`, `malformed-date`, `unknown-operator`, etc.), not exact message strings.
- Corpus must be updated in the same change whenever grammar or execution semantics change.
- Ownership: archive search changes are not done until conformance fixtures are updated or explicitly marked unaffected.

### Unit

- Parser grammar and AST snapshots
- Operator semantics (`date`, `score`, negation, phrase)
- Regex literal behavior and invalid-literal handling
- Ranker determinism

### Integration

- Index rebuild and patch correctness
- Schema upgrade/rebuild path
- Worker protocol resilience

Scope fixture matrix (required):

- Overlap case: same ID appears in authored and context corpus -> authored payload wins.
- Context-only match case: appears only when `scope:all`.
- Authored-only match case: appears in both scopes.
- Tie-case per non-relevance sort mode validating the declared tie-break chain.
- Dedupe stability across repeated queries and incremental index patches.

### E2E

- Structured query behavior in all view modes
- Regex literal behavior and safety downgrade behavior
- `scope:all` includes contextual matches; default authored scope remains unchanged
- `scope:all` merges/dedupes across authored and context indexes with stable ordering
- URL restore/share behavior
- Large dataset latency budget checks

## Migration Path From Current Code

### Phase 0: Baseline Freeze

- Add perf probes around current search path.
- Add structured-query conformance corpus and expected outputs.

### Phase 1: Precompute SearchDoc (No UX Change)

- Add normalizer and `SearchDoc` cache in archive runtime.
- Replace per-keystroke text reconstruction with cached normalized `titleNorm`/`bodyNorm` fields for linear scan.
- Keep existing input/control layout unchanged while validating structured semantics behind feature flag with conformance fixtures.

### Phase 2: Introduce Parser + Engine (Main Thread)

- Add parser/AST and two-stage engine.
- Gate behind `__PR_ARCHIVE_SEARCH_STRUCTURED`.
- Keep existing sort/view controls unchanged.
- Expose structured UX only (no mode toggle).
- Deprecate legacy `ArchiveFilter` state model and migrate persisted filter state to structured query state.
- Existing `ArchiveFilter.minScore` is subsumed by `score:` operators.
- Existing `ArchiveFilter.startDate` and `ArchiveFilter.endDate` are subsumed by `date:` operators.

### Phase 3: Worker Offload

- Move parser+engine+indexes into Worker.
- Keep rendering and archive state ownership on main thread.
- Add kill-switch config to disable Worker path quickly without redeploying architecture.

### Phase 4: Structured Query UX + Facets

- Add chips/facet UI and URL-state sync.
- Add explain panel in debug mode.

### Phase 5: Optional Fuzzy Layer

- Deferred out of v1 and tracked as a separate post-launch enhancement.

## Proposed Module Layout

```text
src/scripts/power-reader/archive/search/
  types.ts
  normalize.ts
  parser.ts
  ast.ts
  planner.ts          # translates parsed AST into execution plan (index path selection, stage ordering)
  engine.ts
  fallback.ts
  ranker.ts
  searchIndex.ts
  worker.ts
  protocol.ts
```

Integration points:

- `archive/index.ts`: input wiring, URL sync, result rendering call.
- `archive/state.ts`: add search runtime state (`query`, `scope`, `lastDiagnostics`).
- `archive/storage.ts`: add search-doc stores and schema migrations.

## Risks and Mitigations

1. Risk: Query language complexity hurts usability.
   - Mitigation: plain text remains first-class; operators are additive.

2. Risk: Worker introduces race conditions.
   - Mitigation: request IDs + cancellation tokens; ignore stale responses.

3. Risk: Index memory growth on huge archives.
   - Mitigation: compact ordinals, compacted typed-array postings, lazy postings load.

4. Risk: Behavior regressions from parser rollout.
   - Mitigation: conformance corpus + deterministic fixtures + phased rollout with kill-switch.

5. Risk: Catastrophic regex causes CPU spikes.
   - Mitigation: regex safety lint + execution budget + downgrade path.

6. Risk: IndexedDB quota/corruption makes search unavailable.
   - Mitigation: in-memory fallback and bounded fallback engine with explicit status.

7. Risk: Worker unavailable in some runtime contexts.
   - Mitigation: feature-detected fallback engine and session kill-switch.

## Rollout Gates and Abort Criteria

Enable by default only when all are true:

- Search conformance: zero critical mismatches across structured-query conformance corpus.
- Performance: latency SLO met on representative large fixtures.
- Stability: Worker crash rate below threshold.
- Reliability: fallback activation below threshold.

Thresholds must be declared before launch (examples):

- Worker crash rate: `< 0.5%` of archive sessions
- Fallback activation: `< 2%` of archive sessions
- Conformance mismatch rate: `< 0.1%` of sampled queries
- Peak search memory: `< 250MB` on the 100k-item reference fixture
- No cross-browser gating requirement for initial default enablement

Critical mismatch definition (for conformance gates):

- Missing item versus expected conformance output for a test query.
- Extra item versus expected conformance output for a test query.
- Different ordering for non-relevance sort modes (`date`, `date-asc`, `score`, `score-asc`, `replyTo`).
- Failure of `scope:all` merge/dedupe/tie-break rules versus fixture expectations.

Immediate rollback/kill-switch triggers:

- Main-thread lockups attributable to search path
- Persistent result corruption or nondeterminism
- Repeated conformance failures in structured-query fixtures
- Archive render error rate exceeds 2x the pre-rollout baseline rate for the same session population

## Execution Checklist

1. Land `SearchDoc` normalizer and cache.
2. Add parser + engine behind feature flag.
3. Build structured-query conformance suite (including regex literal safety cases).
4. Add worker protocol and move execution off main thread.
5. Add structured query docs/help text in archive UI.
6. Enable by default after perf and conformance targets are met.

## Definition of Done

- Structured-query conformance corpus passes with zero critical mismatches.
- Measured query latency targets are met on representative large fixtures.
- No regressions in archive view rendering, sorting, or context isolation.
