# Plan: Native Forum "Send to AI" Hotkeys

## Goal
Enable `g/G` and `m/M` hotkeys on native LessWrong and EA Forum pages (outside `/reader`) so users can send hovered posts/comments to AI Studio or Arena Max from regular forum UI.

## Scope
- In scope:
  - Native LW and EAF hotkeys in `forum-injection` mode.
  - Targeting hovered comment/post on LW/EAF pages.
  - Reuse existing AI payload + tab handoff pipeline.
  - Add tests for forum-mode behavior.
  - Update spec text to explicitly cover native LW/EAF hotkey support.
- Out of scope:
  - Full reader takeover behavior on native pages.
  - New UI controls/chips on native pages.

## Current State (Why it does not work)
- `forum-injection` route currently only runs header link injection and returns.
- Hotkeys are attached only in reader mode and require `.pr-item` DOM.
- AI target resolution currently assumes reader DOM (`.pr-comment/.pr-post`), so native LW/EAF elements are not targetable.

## Observed Native Forum DOM Hooks (LW/EAF)
- Comment node container has stable id-based hook:
  - Closest `.comments-node, .CommentFrame-node` with `id=<commentId>`.
- Comment permalink/time links contain:
  - `?commentId=<commentId>`.
- Comment wrappers include:
  - `.CommentsItem-root`.
- Post page root contains:
  - `#postBody`.
- Post id on post pages is reliably parseable from URL:
  - `/posts/<postId>/...`.
- Home/feed post cards include:
  - `.LWPostsItem-postsItem` and post links `/posts/<postId>/...`.

## Proposed Design

### 1. Add forum-mode hotkey feature
- New module: `src/scripts/power-reader/features/forumAIHotkeys.ts`.
- Attach in `main.ts` inside `forum-injection` branch:
  - keep `setupHeaderInjection()`
  - add `setupForumAIHotkeys(getState())`
- Behavior:
  - key handling for `g`, `G`, `m`, `M`
  - ignore input/textarea/select/contenteditable
  - ignore ctrl/alt/meta
  - ignore repeated keydown auto-repeat (`event.repeat`) and gate sends with a per-operation in-flight lock so rapid keypresses do not open duplicate tabs
  - manage the in-flight lock with `try/finally` release plus safety timeout/reset so hangs/rejections cannot deadlock hotkeys
  - track current hover target via delegated `mouseover`/`mouseout` on forum pages, with strict keypress-time `elementFromPoint` validation for live/current target
  - explicitly clear stored hover target when pointer leaves targetable areas (`mouseout`) or enters non-target zones to avoid stale trigger context
  - at keypress time, perform a final target validation (e.g., current element-under-cursor check) before dispatch to prevent stale-hover sends after dynamic DOM changes
  - when `elementFromPoint` hits transient hovercard/tooltip overlays, permit a short-lived fallback to last known valid target (time-bounded) instead of mis-targeting
  - only call `preventDefault()` after a valid target/action is resolved; otherwise allow native site hotkeys to continue
  - trigger provider handler using resolved native target
  - inject a small CSS shim for native-page target highlighting (`.being-summarized`) so handoff focus is visible in forum mode
  - clear native highlight state in a `finally` path (or short timeout fallback) so `.being-summarized` is never left stuck after handoff

### 2. Add native target resolver
- New helper module: `src/scripts/power-reader/features/forumAITargetResolver.ts`.
- Resolution order under mouse:
  - precedence rule: the deepest explicit link under pointer wins over broader container context (e.g., explicit `/posts/...` or `?commentId=...` link beats enclosing comment/post container).
  1. If hovering a structural comment permalink/timestamp UI link with `commentId`, target that linked comment id.
     - use explicit structural selector allowlist (for example comment metadata/timestamp/permalink wrappers) instead of generic body-content anchors.
  2. Else if hovering a structural post permalink/title UI link `/posts/<id>/...`, target that linked post id.
     - use explicit structural selector allowlist (for example post title/permalink metadata wrappers) instead of generic body-content anchors.
  3. Else if inside `.comments-node, .CommentFrame-node` and has `id`, target comment by id (normalize known DOM id prefixes like `comment-` to raw comment id before provider/GraphQL usage).
     - for comment targets, include `postIdHint` from nearest post context (URL/card/container) whenever available so descendant mode can avoid redundant lineage lookups.
     - normalization must support both raw ids and host-specific prefixed forms observed on LW/EAF.
  4. Else if closest ancestor post link `/posts/<id>/...`:
     - always target the explicitly hovered post link id (even when currently on a post page)
     - on feed card: target hovered card post (`<id>`)
  5. Else if hover is within a recognized post-card container (e.g., `.LWPostsItem-postsItem`) without direct link focus, resolve post id from that card context.
     - resolution rule: from the closest card container, select the first descendant anchor matching `/posts/<id>/...` and parse `<id>`; fallback to a stable card data attribute (e.g., `data-post-id`) when present.
  6. Else if on a post page and hover target is within the main post container (e.g., `#postBody`), resolve post id directly from current URL `/posts/<id>/...`.
     - gating rule: apply this URL fallback only when keypress target is not an anchor and has no anchor ancestor resolving to a different `/posts/<id>/...`.
  7. Else if no hover match but URL hash/deep-link encodes a comment target, use that hash comment id as fallback.
  8. Else no-op.
- Exclusions:
  - Do not resolve links inside TOC/navigation regions (`FixedPositionToC`, table-of-contents containers, generic nav/ARIA navigation regions) to avoid false targeting.
  - Exclude site-global header/navigation/search/user/global-sidebar containers from resolver targeting using stable structural anchors and ARIA roles (`nav`, `search`, `complementary`, header/footer regions, `[role="navigation"]`), with class-pattern checks only as secondary fallback.
  - Exclude generic body-content links inside comment/post body wrappers from Step 1/2 link-targeting unless they match structural permalink/title/timestamp selectors.
- Cross-forum requirement:
  - Keep resolver selectors host-agnostic for LW/EAF shared structure; where hosts diverge, gate small selector overrides by forum host.

### 3. Refactor AI provider core to accept explicit targets
- Extend provider API to support explicit target input in addition to current reader-DOM lookup.
- Example shape:
  - `{ itemId: string, isPost: boolean, sourceEl?: HTMLElement | null, postIdHint?: string }`
- Refactor rule:
  - in `handleSend`, prioritize the explicit target object's `isPost` over DOM class detection, and only fall back to DOM detection when no explicit target is passed
  - when explicit target is passed, DOM highlight element (`sourceEl`) is optional; send flow must remain functional even if no compatible `.pr-*` element exists
- Keep existing reader behavior unchanged.
- Forum hotkey path calls provider with explicit target so `.pr-*` selectors are not required.
- Forum-mode caching rule:
  - when `fetchItemMarkdown` retrieves focal post/comment in forum mode, sync it through a helper that updates Maps (`state.postById` / `state.commentById`) as cache-first state.
  - forum-mode sync must not perturb reader-feed ordering/visibility semantics; do not promote ad-hoc forum-fetched items into canonical reader list arrays (`state.posts` / `state.comments`) from hotkey sends.
  - if array writes are ever needed in reader initialization paths, route them through an explicit deduped feed-hydration helper separate from forum hotkey sync.
  - guard index rebuild semantics: `rebuildIndexes` (or equivalent index refresh) must preserve forum-mode cache metadata or keep it in a separate map so forum-fetched focal items are not dropped by array-based reindex paths.
  - cache write policy should be non-destructive/non-downgrading (merge-aware) so partial forum fetch payloads do not overwrite richer objects when reader-mode state is already populated.
  - merge strategy should explicitly update existing entries in place with field-aware merging (not blind shallow overwrite), preserving richer metadata while filling missing fields like markdown, vote/reaction state, and nested content fields.
  - for volatile fields (e.g., score/count/timestamps), prefer values from the newest fetch operation by explicit fetch metadata (`fetchStartedAt` timestamp or monotonic request sequence), not response-arrival order.
  - for content fields, use explicit precedence: prefer non-empty `contents.markdown`; if unavailable, prefer non-empty `htmlBody`; never overwrite non-empty content with empty/null payloads.
  - for lite→full transitions, always upgrade content-bearing fields (`contents.markdown`, `htmlBody`) while preserving existing local/runtime metadata.
  - atomicity requirement: perform sync through a single upsert helper with deterministic keying; map writes are mandatory in forum mode, and any reader-array writes (when explicitly enabled) must be deduped and atomic.
  - lifecycle requirement: bound forum-mode map growth with LRU/TTL trimming (target defaults: max 1000 entries per map and 24h TTL) so long-lived SPA sessions do not accumulate unbounded cache entries.
- Sequencing requirement:
  - `fetchItemMarkdown` results must be synced into state before entering any descendant-path decisions so focal/post metadata is available when descendant helpers execute.

### 4. Ensure descendant mode works without reader-loaded state
- Existing logic already fetches lineage from GraphQL and can fetch post comments via cache helper.
- Required adjustment:
  - For forum-mode targets, derive `postId` and focal metadata from the focal lineage item (e.g., `lineage.at(-1)`) with an explicit empty-lineage safety guard, rather than `state.commentById` / DOM dataset lookups.
  - For comment targets on post pages/feed cards, prioritize `target.postIdHint` from resolver context before lineage fallback to avoid redundant lineage fetches.
  - For comment targets, treat the focal comment's own `postId` as primary; use post-level lineage context as fallback when needed.
  - Ensure forum-mode cache-sync of focal items runs before descendant-branch execution so descendant helpers have required post/comment metadata context.
  - After focal sync, check `state.commentById[itemId]?.postId` before lineage fallback to avoid redundant network fetches.
  - enforce sequencing with an explicit await boundary (`await ensureFocalContextResolved(...)`) before entering descendant XML construction/fetch path.
  - Descendant branch sequencing must not attempt `postId` resolution before focal lineage fetch succeeds; if lineage is empty, fail gracefully and skip descendant fetch path.
  - If focal lineage resolves but no valid `postId` is available for a comment target, attempt one targeted full-comment fetch fallback for `postId`; if still missing, abort descendant fetch path gracefully with user-visible status (no throw).
  - before side effects (`GM_openInTab`), re-check active operation token + abort signal and suppress handoff when operation has been invalidated by navigation/re-init.
- Shift variants:
  - `G` / `M` continue to include descendants.
  - Large descendant confirmation logic remains unchanged.

### 5. Native feedback behavior
- Reader `.pr-status` is unavailable on native pages.
- Forum-mode success/failure feedback:
  - primary: lightweight visible feedback (toast/status chip/overlay) during async prepare+handoff operations
  - implementation detail: decouple status routing from AI-provider core via a shared status manager/host abstraction (resolved from current environment) so `setStatusMessage` can target reader status line or forum-mode native feedback UI (e.g., top-right toast using a shared top-layer z-index constant set high enough to clear sticky headers/widgets and overlays, with logger fallback)
  - implementation detail: define a `StatusReporter` interface (`setMessage(msg: string, color?: string)`, `clear()`) and inject the correct implementation (`ReaderStatusReporter` vs `ForumToastStatusReporter`) at provider setup time.
  - boundary rule: AI providers remain responsible for message content semantics; `StatusReporter` is responsible only for delivery/rendering.
  - wiring detail: resolve reporter at provider-config/setup layer (not threaded through every helper call).
  - mount rule: forum toast/status UI should mount under `document.body` (not nested component containers) to avoid stacking-context clipping.
  - top-layer host rule: keep a dedicated status host as the last child of `document.body` (re-append on show if needed) so equal-z overlays do not obscure status UI by DOM order.
  - resilience requirement: status routing must verify DOM host readiness (`document.body`/target mount present) before UI writes; if unavailable, degrade to safe no-op/logging (never throw or block handoff flow)
  - concurrency rule: status updates must be operation-scoped (token/sequence id) so overlapping sends do not let stale operations overwrite newer status UI.
  - cleanup rule: status clear/hide actions must also be operation-scoped (only clear if opId matches active status owner) to avoid clearing newer in-flight status from older operations.
  - timeout rule: forum status/toast messages should auto-dismiss on safety timeout (for example 5-10s) if explicit clear is missed.

## Spec Updates (planned)
- Add/adjust requirements in `SPEC.md`:
  - Hotkeys section: `g/G/m/M` supported on native LW and EAF pages in forum-injection mode.
  - AI section: native LW/EAF hotkeys use same payload/handoff behavior as reader.
  - Clarify target model on native pages: hovered comment/post inferred from LW DOM/permalink.
- Clarify any host-specific selector fallbacks used for EAF parity.

## Test Plan

### New test file
- `tests/forum-ai-hotkeys.spec.ts`

### Core test cases
1. Native post page, hover comment, press `g`:
   - calls `GM_openInTab` with AI Studio URL.
   - stores payload key (`ai_studio_prompt_payload:*`).
2. Native post page, hover comment, press `m`:
   - opens Arena Max URL.
3. Native post page, hover comment, press `Shift+G`:
   - payload includes descendants XML.
4. Input suppression on native page:
   - focused input + `g` does not trigger send.
5. TOC exclusion:
   - hovering TOC post link + `g` does not trigger send.
6. Feed card post targeting:
   - hover feed post title card + `g` targets the post id from URL.
7. Selection suppression outside target:
   - with non-empty selection outside the resolved hovered target, `g/m` hotkeys are ignored to reduce conflicts with selection-driven tools/extensions.
8. Selection inside target:
   - with non-empty selection inside the resolved hovered target element, `g/m` still sends for that target.
9. Rapid keypress dedupe:
   - hold key / double-press `g` quickly and verify only one send pipeline + tab open is triggered while operation is in-flight.
10. Soft navigation persistence:
   - navigate from home/feed to a post page via client-side navigation and verify listeners stay correct (no duplicates, no stale target context) and hotkeys resolve the new route context.
11. EAF parity:
   - run equivalent comment/post hotkey tests on `forum.effectivealtruism.org` mocked pages and verify resolver + handoff behavior matches LW.
12. Content link vs structural link precedence:
   - hover a generic in-body `/posts/...` link inside comment text and verify target remains the enclosing comment unless link matches structural permalink/title selector.
13. Stale-operation suppression on navigation:
   - trigger hotkey, navigate before async fetch resolves, and verify no delayed stale tab open occurs after route change/teardown.
14. Transient overlay interception:
   - with tooltip/hovercard overlay under cursor at keypress, verify resolver falls back to recent valid target (or safe no-op) rather than wrong target.

### Test harness approach
- Serve minimal mocked LW/EAF-like HTML in Playwright route handlers for both forum hosts.
- Load built userscript bundle (`dist/power-reader.user.js`).
- Mock GM APIs and GraphQL responses (`GetPost`, `GetComment`, `GetPostComments`).

## Implementation Order
1. Ensure minimal forum-mode state bootstrap is stable (host/site/user/context essentials, including auth-linked user fields required by send/fetch paths) before hotkey listener setup.
2. Align lifecycle/idempotency strategy for native mode setup paths (`setupHeaderInjection` and new forum-hotkey setup).
3. Add forum hotkey module + wiring in `main.ts`.
4. Add native target resolver.
5. Refactor AI provider API for explicit target.
6. Fix descendant-mode postId derivation for forum-mode comments.
7. Add forum hotkey tests.
8. Update `SPEC.md`.
9. Run build + targeted tests + coverage audit.

## Implementation Notes
- Inject forum-mode highlight CSS shim via `GM_addStyle` (consistent with existing header-injection pattern), using sufficient specificity (and `!important` where necessary) so `.being-summarized` remains visible against native forum backgrounds.
- Set `.being-summarized { pointer-events: none; }` (or equivalent highlight overlay strategy) so validation via `elementFromPoint` is not intercepted by the highlight shim.
- Apply selection suppression check against logical item container containment (resolved comment/post container), not just exact hovered leaf element: if selection is non-empty and outside item container, suppress hotkey; if selection is inside item container, allow send.
- Forum mode should evaluate selection suppression synchronously at keydown via `window.getSelection()` (no dependency on reader-mode selection listeners).
- Native mode: enforce selection suppression by default.
- Reader mode: expose the same preference and allow mode-specific defaults, but keep one unified selection-suppression setting model across modes.
- Implement selection suppression through a dedicated helper so future selection-based send features can adjust behavior in one place.
- Consolidate forum-mode CSS shim into a single native-UI style block to avoid redundant `GM_addStyle` calls/style drift across soft navigations.
- Add explicit in-flight operation guard (`event.repeat` + operation lock) so forum hotkeys cannot spawn duplicate sends/tabs during rapid key presses.
- Remove `.being-summarized` on success/failure in a shared cleanup helper; add timeout-based safety cleanup in case tab handoff returns early or throws.
- On abort/teardown (including soft navigation re-init), clear any lingering `.being-summarized` markers for operations owned by the aborted controller.
- On abort/teardown safety path, also run a global cleanup pass for stale `.being-summarized` classes to recover from interrupted operations.
- Use one shared `Z_INDEX_TOP_LAYER` constant set to max 32-bit safe overlay level (`2147483647`) and verify forum toast/confirm overlays against known LW/EAF high-z-index widgets/modals.
- Re-check operation validity immediately before handoff side effects (`GM_openInTab`) to prevent stale async completions opening tabs after navigation.

## Validation Commands
- `npm run build:power-reader`
- `npx playwright test tests/forum-ai-hotkeys.spec.ts`
- `npm run test:audit`

## Risks and Mitigations
- Risk: LW/EAF class names may drift or diverge.
  - Mitigation: prefer comment id from `.comments-node` id and permalink `commentId` fallback, plus URL post-id parsing; keep host-specific selector overrides minimal and well-tested.
- Risk: conflicts with site keyboard behavior.
  - Mitigation: strict input/modifier suppression and limited key scope (`g/m` only in forum mode).
- Risk: accidental targeting from non-content links (TOC, nav).
  - Mitigation: explicit exclusion zones before resolving targets.
- Risk: redundant hover/mouse listeners or duplicated setup if forum feature initialization runs more than once.
  - Mitigation: add an idempotency guard and teardown via `AbortController`, mirroring reader-mode lifecycle patterns, and ensure listener persistence/re-attachment strategy is aligned with the existing header-injection mutation-observer lifecycle used on native LW pages.
  - Guard detail: use a singleton/listeners-attached flag (module-level or `window` sentinel) to prevent duplicate key handlers during soft navigations/re-inits.
  - Integration detail: align guard strategy across both `setupHeaderInjection` and `setupForumAIHotkeys` so observers/listeners do not multiply across native soft navigations.
  - Teardown detail: bind forum hover/mouse listeners with the same abort signal so they are deterministically removed during feature teardown/navigation re-init.
  - Rationale note: even if script init is typically single-entry, keep these guards as defensive lifecycle hygiene for future soft re-init scenarios.
  - Signal propagation detail: use one shared `AbortSignal` for all forum-mode listeners (`keydown`, `mouseover`, `mouseout`, and any mouse-position fallback listener) for deterministic teardown.
  - Implementation detail: keep a module-level singleton `AbortController` (or window sentinel) to guarantee prior listener teardown before re-attach.
  - Abort ordering rule: abort previous controller at the very start of setup before creating/assigning a new controller.
- Risk: feedback UI hidden behind native overlays/sticky UI.
  - Mitigation: add `Z_INDEX_TOP_LAYER` (`2147483647`) to `src/scripts/power-reader/config.ts` and reuse it for all top-layer forum UI.
  - Consistency note: apply the same top-layer z-index policy to native modal/confirmation overlays used in AI send flows (including large-descendant confirmation).
- Risk: unbounded forum-mode cache growth in long-lived SPA sessions.
  - Mitigation: enforce LRU/TTL trimming policy for forum-mode map upserts.
