# Userscript Persistence Plan v3 (Firestore)

## 0. Decisions Locked for v3
- Site-scoped sync stays required (`lw` and `eaf` isolated).
- No opt-in UI flow; sync defaults to enabled for logged-in users.
- Existing `/reader/reset` UX is reused.
- Initial synced subset: `read`, `loadFrom`, `authorPrefs`.
- No routine forum profile writes for sync payloads; only one-time sync-secret bootstrap/repair in `abTestOverrides`.
- `setLoadFrom()` remains a pure setter (no implicit read clearing).
- External KV is Cloud Firestore (single-doc envelope per sync node).
- v3 primary transport is Firestore REST via `GM_xmlhttpRequest` (no Firestore SDK dependency in v3).
- Flush correctness relies on REST CAS with Firestore `currentDocument.updateTime` preconditions, not client-side flush locks.
- Auth posture for v3 is unauthenticated capability-URL access gated by strict path + schema rules (no `request.auth` requirement in v3 rules).
- `expiresAt` TTL timestamp is required on every envelope write and must stay within bounded future range.
- Test strategy is three-layered: mocked unit tests, Firestore Emulator integration tests, and live-site E2E tests.
- Everything else from v2 remains locked unless explicitly updated for the Firestore storage layer.

### 0.1 Simplification Decisions Locked (Do Not Revert in v3)
- Sync architecture stays collapsed to:
  - `firestoreSyncBackend.ts` (I/O + REST CAS writes)
  - `persistenceSync.ts` (single sync state machine: init -> pull -> merge -> maybe-flush, plus reset entrypoint)
- Do not reintroduce split sync modules (`syncIdentity.ts`, `syncMerge.ts`, `syncEngine.ts`) in v3.
- Do not reintroduce `metaRevision` torn-write detection in v3.
  - Startup recovery rule remains: if sync meta is missing/invalid/inconsistent, conservatively mark syncable fields dirty.
- Do not reintroduce duplicated local per-key `authorPrefs` metadata maps in sync meta.
  - Authoritative per-key version/updated fields remain in envelope `fields.authorPrefs.value`.
- `loadFrom` no-version resolution remains the simplified fallback:
  - prefer `__LOAD_RECENT__` if either side is sentinel
  - else max ISO when both ISO
  - else non-empty value
  - do not restore matrix-table fallback logic in v3.
- Identity fallback remains probe-only (`lastSyncNode` diagnostics read); no fallback-node copy-forward writes in v3.

### 0.2 Firestore Project Setup (v3)
- Use a dedicated Firestore project/environment for userscript sync rollout.
- Database must be Firestore Native mode, `(default)` database.
- Rule and TTL deployments must target the same project/database used by userscript REST endpoints.
- Cost model is operation-based (reads/writes/deletes), not bandwidth-based as in RTDB.
- Initial launch should stay within free-tier limits only if observed active users and sync cadence remain below quota budgets; otherwise enable billing and alerts before broad rollout.

## 1. Architecture (Deterministic External KV -> Firestore Doc)
Power Reader derives a deterministic per-user sync node from user ID plus a random per-user sync secret stored in `currentUser.abTestOverrides`, then stores envelope JSON in Firestore.

Flow:
1. Resolve sync identity from forum GraphQL (`_id` + `abTestOverrides.pr_sync_secret_v1`).
2. If secret missing, bootstrap it once via `updateUser` merge-write.
3. Derive deterministic sync node via SHA-256.
4. Read/write envelope at Firestore doc path `pr_sync_v1/{site}/nodes/{syncNode}`.

## 2. Identity Derivation

### 2.1 Identity Source and Secret Bootstrap
Reuse existing `GET_CURRENT_USER` and add `abTestOverrides` to its selection set (do not add a second startup identity query).

Rules:
- If `currentUser` is null: skip sync.
- If `_id` missing: skip sync and log warning.
- Secret key name: `pr_sync_secret_v1`.
- Use existing `currentUser.abTestOverrides?.pr_sync_secret_v1` when present.
- Distinguish null causes:
  - if `abTestOverrides` is null with GraphQL field-level authorization error, fail closed for this session (disable sync, no retries).
  - only treat `abTestOverrides === null` as `{}` when the query has no field-level authorization error.
- If missing, bootstrap once:
  0. acquire bootstrap lock (`pr-sync-lock-{site}-{userId}`) before any write
  1. read current `abTestOverrides`
  2. merge `{ pr_sync_secret_v1: crypto.randomUUID() }` into the existing object
  3. call `updateUser(selector: { _id }, data: { abTestOverrides: merged })`
  4. confirm mutation response contains `abTestOverrides.pr_sync_secret_v1`; if present and differs from local candidate, adopt response value
  5. perform one verify re-read; if verify value differs from adopted value or missing, retry up to 2 times
  6. only after adopted value and verify read match, treat secret as finalized for this session
  7. release bootstrap lock
- if bootstrap lock cannot be acquired, skip local bootstrap write and do short delay + re-read loop to adopt whichever tab wrote the secret.
- always release bootstrap lock in `finally`, including error paths
- bootstrap lock must include ownership token + expiry:
  - lock payload: `{ token, expiresAtMs }`
  - release only when stored token matches owner token
  - treat expired locks as stale and reclaim
- lock acquisition order:
  - prefer `navigator.locks` when available (origin-scoped mutual exclusion)
  - fallback to localStorage token+expiry lock when `navigator.locks` unavailable
- Secret type guard: require `typeof secret === 'string'` and minimum expected length; otherwise treat as invalid and skip sync for current session.
- If bootstrap fails after retries, skip sync for current session and show non-blocking status.
- Accepted risk note: bootstrap uses read-merge-write on `abTestOverrides` and can still overwrite unrelated concurrent writes from other clients; accepted as low-impact because bootstrap is rare.
- Accepted security tradeoff note:
  - `abTestOverrides` is a convenience capability-token store, not a hardened secret manager.
  - if forum session or page execution context is compromised (for example XSS, malicious extension, privileged forum tooling), `pr_sync_secret_v1` can be read and sync-node access can be derived.
  - v3 accepts this for low-sensitivity sync data (`read`, `loadFrom`, `authorPrefs`) in exchange for zero-friction cross-device bootstrap.
  - server-side authorization on `updateUser(selector: { _id }, ...)` remains a trusted dependency; userscript code cannot harden a backend authz regression.

### 2.2 Deterministic Node
Canonical input:
```text
pr-sync-v1|{site}|{userId}|{syncSecret}
```

Derivation:
- `digest = SHA-256(utf8(input))`
- `syncNode = pr_sync_{hexLower(digest)}` (lowercase hex only)

Stability:
- Same user/site => same node across devices.
- Different sites => different nodes.
- Persist `lastSyncNode` only after secret finalization and after current node validity is confirmed (successful pull or successful push).

### 2.3 Identity Migration Fallback
If sync secret is rotated/reset, current derived node can change and remote state can appear missing.

Fallback strategy (probe-only, no copy-forward in v3):
1. Try current derived node first.
2. Gate probe by user identity:
   - only consider `power-reader-sync-meta.lastSyncNode` when `meta.lastUserId === currentUser._id`
   - if user mismatch, ignore/clear `lastSyncNode`, `pendingRemoteReset`, `pendingRemoteResetAt`, and `pendingRemoteResetTargets` before continuing
3. If `pendingRemoteReset` is active, skip fallback probe until reset replay succeeds.
4. If current node is empty/not found and probe is eligible, probe `power-reader-sync-meta.lastSyncNode` in read-only mode.
5. If fallback node has valid envelope, record diagnostics only (no migration write, no copy-forward).
6. Persist `lastSyncNode` after current-node validity is confirmed (not at first derivation attempt).

Rationale:
- Keeps migration behavior simple and avoids extra CAS/multi-node write complexity in v3.
- Prevents cross-account fallback probing on shared browsers.
- Accepted UX tradeoff: after secret rotation, old-node data may be unreachable without manual recovery/reset.

### 2.4 Bootstrap Mutation Shape
Use the same mutation shape on LW and EAF:
```graphql
mutation UpdateSyncSecret($id: String!, $data: UpdateUserDataInput!) {
  updateUser(selector: { _id: $id }, data: $data) {
    data {
      _id
      abTestOverrides
    }
  }
}
```

Operational note:
- `updateUser` triggers expensive server callbacks in ForumMagnum; keep bootstrap rare (first run or secret repair only), never in steady-state flush loop.
- Legacy adapter note: keep this mutation as a standard `updateUser(selector, data)` call. Production console verification already succeeded on LW and EAF, so no `LEGACY_ADAPTERS` mutation rewrite is required for v3.

## 3. Firestore Storage Contract

### 3.1 Envelope Schema
```ts
interface PRSyncEnvelopeV1 {
  schemaVersion: 1;
  site: 'lw' | 'eaf'; // intentionally duplicated (URL already site-scoped) for diagnostics
  lastPushedBy: string; // deviceId
  lastPushedAt: string; // ISO diagnostics; server-derived when available (commit response updateTime)
  lastPushedAtMs?: number; // optional diagnostics; epoch-ms from server updateTime when available
  expiresAt: string; // required ISO datetime; server-time anchored when possible, adapter writes Firestore Timestamp
  fields: {
    // clearEpoch is monotonic and used for clear durability across devices
    read: { updatedAt: string; updatedBy: string; clearEpoch: number; value: Record<string, 1> }; // updatedBy = writerId (`${deviceId}:${tabId}`)
    // loadFrom stores clear barrier even when value is absent (local setup state)
    loadFrom: { updatedAt: string; updatedBy: string; version: number; clearEpoch: number; value?: '__LOAD_RECENT__' | string };
    // per-key version + field clearEpoch support concurrent edits and durable clears
    authorPrefs: {
      updatedAt: string;
      updatedBy: string;
      clearEpoch: number;
      value: Record<string, { v: -1 | 0 | 1; version: number; updatedAt: string; updatedBy: string }>; // store neutral as explicit v=0, do not delete keys to clear preference
    };
  };
}
```

Serialization note (v3 REST adapter):
- On write, convert envelope `expiresAt` ISO string to Firestore `timestampValue`.
- On read, normalize Firestore timestamp fields back to ISO strings in the client envelope model.
- Time-source policy:
  - Prefer server-derived time anchors (`writeResults[0].updateTime`, doc `updateTime`) for envelope timestamps.
  - If no server anchor exists yet (first write/new doc), use conservative client fallback for initial write only; switch to server-anchored values after first successful commit.

`updatedBy` note:
- treat `updatedBy` as opaque string for merge tie-breaks; writer-id format (`deviceId:tabId`) is a convention for diagnostics, not a strict validation requirement.

### 3.2 Endpoint Pattern (v3 Primary: REST)
- Firestore document path:
  - Collection: `pr_sync_v1`
  - Doc: `{site}`
  - Subcollection: `nodes`
  - Doc: `{syncNode}`
- REST endpoints:
  - `GET https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents/pr_sync_v1/{site}/nodes/{syncNode}`
  - `POST https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents:commit`
- Auth model in v3:
  - v3 decision: unauthenticated requests are allowed and evaluated by Security Rules (no `request.auth` checks in v3 rules).
  - This intentionally preserves v2-like capability-URL behavior (derived node secrecy) with explicit abuse/cost monitoring.
  - Firebase ID token / OAuth auth hardening remains a future option, not part of v3 scope.
- SDK/offline note:
  - v3 uses REST only, so Firestore SDK offline persistence/IndexedDB cache behavior is not in scope.
  - If SDK transport is introduced later, explicitly choose cache mode (for example disable persistent local cache for userscript context).

### 3.2.1 REST Write Surface Constraint (v3)
- v3 write path uses `documents:commit` only.
- Each commit request must include exactly one `Write` operation (single-doc envelope write).
- Do not use multi-write commit batches in v3.
- Do not use document PATCH for steady-state writes in v3.
- Runtime guard: assert `writes.length === 1` and the write is an `update` with `currentDocument` precondition.
- Integration tests enforce the single-write commit constraint.

### 3.2.2 API Key Posture (Tampermonkey)
- Firestore REST requests use Firebase web API key for project identification.
- Requests include `?key={FIREBASE_WEB_API_KEY}` on Firestore REST URLs.
- API key is treated as public (not a secret); security relies on Firestore Rules + capability node secrecy.
- Prefer API restrictions to Firestore API surface where possible.
- HTTP referrer restrictions can be unreliable under `GM_xmlhttpRequest`; validate in staging before relying on referrer-only restrictions.
- If referrer-restricted keys break userscript requests on LW/EAF, use an unrestricted web key with strict Firestore Rules and active abuse monitoring.

### 3.3 Concurrency Control (Required)
Blind full-document overwrite is not acceptable for multi-device sync.

Use optimistic concurrency with Firestore REST preconditions:
1. read doc (`GET`) and capture `updateTime` when it exists.
   - `404 NOT_FOUND` is treated as "no remote envelope" (not an error).
2. if doc does not exist:
   - attempt create via `documents:commit` with precondition `currentDocument.exists = false`
   - if create precondition fails (raced creator), re-read and continue with update protocol
3. if doc exists:
   - merge local dirty fields onto latest using epoch/version semantics (`read.clearEpoch`, `loadFrom.version/clearEpoch`, `authorPrefs per-key version/field clearEpoch`)
   - enforce envelope caps on merged result before write:
     - if merged `read.value` exceeds cap, apply read overflow clear (`value = {}`, increment `read.clearEpoch`)
     - if merged `authorPrefs.value` exceeds cap, run compaction policy before write
   - write via `documents:commit` with precondition `currentDocument.updateTime = <captured>`
4. on precondition failure, re-read latest, re-merge, retry
   - if retry re-read detects unsupported higher remote schema version, abort CAS loop and enter session read-only mode immediately
5. on success, capture new server `updateTime` from `writeResults` for next CAS token cache
- Retry cap: 3 conflict retries per flush attempt.
- Add small randomized retry jitter between CAS retries.
- Reset path also uses `updateTime` precondition CAS (no blind unconditional reset writes), so clear-epoch barriers cannot regress under concurrent writers.
- Firestore document hard cap is 1 MiB; keep merged-envelope cap handling active on all write paths.

### 3.3.1 REST Request Shapes (CAS)
Create-if-missing (`documents:commit`, single write):
```json
{
  "writes": [
    {
      "update": { "name": "projects/{PROJECT}/databases/(default)/documents/pr_sync_v1/{site}/nodes/{syncNode}", "fields": { "...": "..." } },
      "currentDocument": { "exists": false }
    }
  ]
}
```

Update existing (`documents:commit`, single write):
```json
{
  "writes": [
    {
      "update": { "name": "projects/{PROJECT}/databases/(default)/documents/pr_sync_v1/{site}/nodes/{syncNode}", "fields": { "...": "..." } },
      "currentDocument": { "updateTime": "<opaque_update_time_token_from_firestore>" }
    }
  ]
}
```

Note:
- The `"update.fields"` payload above is schematic; actual payload must use Firestore typed values as defined in section 3.3.2.
- Fragment is illustrative, not exhaustive; required schema children must still be included.

Token capture:
- Read token source: `GET .../documents/...` response `updateTime`.
- Write token source: `commit` response `writeResults[0].updateTime`.
- CAS token rule: treat `updateTime` as opaque string token; store/reuse exact server string with no Date parse/reformat/rounding.
- If `writeResults[0].updateTime` is missing/empty/malformed, treat as uncertain write outcome and retry using normal retry policy (do not clear dirty flags).
- On any precondition failure, re-read, re-merge, retry within bounded conflict budget.

### 3.3.2 Firestore REST Typed Value Mapping (Required)
- Firestore REST `commit` payloads must use typed value wrappers (`mapValue`, `stringValue`, `integerValue`, `timestampValue`), not raw JSON primitives.
- Integer fields (`clearEpoch`, `version`, `lastPushedAtMs`) must be encoded as integer values, not doubles/strings.
- Envelope serializer/deserializer must be centralized so reads/writes preserve type stability across retries.
- Use narrow, explicit encoders for known envelope shapes; fail closed on unexpected types (`undefined`, `NaN`, non-integer numeric fields).

Concrete example fragment:
```json
{
  "fields": {
    "schemaVersion": { "integerValue": "1" },
    "site": { "stringValue": "lw" },
    "expiresAt": { "timestampValue": "2026-08-24T12:00:00Z" },
    "fields": {
      "mapValue": {
        "fields": {
          "read": {
            "mapValue": {
              "fields": {
                "clearEpoch": { "integerValue": "12" },
                "value": {
                  "mapValue": {
                    "fields": {
                      "post_abc": { "integerValue": "1" }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
```

### 3.3.3 CAS Conflict and Timeout Classification
- Implement `isCasConflict(error)` helper for REST writer path.
- Treat as CAS conflict when status/code indicates Firestore contention/precondition mismatch (for example HTTP `409` with `ABORTED`/`FAILED_PRECONDITION`, or equivalent precondition-failure response).
- Do not assume only HTTP `412` semantics for Firestore `documents:commit`.
- Explicit REST classification:
  - `404 NOT_FOUND` on `GET` -> missing document
  - `403 PERMISSION_DENIED` on `GET` -> fail closed for session (sync disabled/local-only, surface status)
  - `409 ABORTED` / `409 FAILED_PRECONDITION` -> CAS conflict (re-read + re-merge)
  - `409 ALREADY_EXISTS` on create-if-missing path -> creator race (re-read + continue)
  - `403 PERMISSION_DENIED` on `commit` -> disable pushes for session (rules/auth mismatch status)
  - `400 INVALID_ARGUMENT` -> serialization/type bug path (fail closed for session + status hint)
- GM request timeout per `GET`/`commit`: 10-20s bounded timeout.
- Timeout/network failures are retryable network errors (normal backoff path, not schema/cap rejection path).
- In-flight flush state must always clear in `finally`, including timeout/abort/error paths, so scheduler cannot deadlock.

### 3.3.4 Server Time Policy (v3)
- `updateTime` CAS tokens are authoritative server values and must be reused as opaque strings.
- `lastPushedAt` / `lastPushedAtMs` should be sourced from server `updateTime` when commit succeeds.
- `expiresAt` generation:
  - preferred: derive from latest known server anchor time + TTL window
  - fallback: if no server anchor is available (first write/new doc), use client time for initial envelope only, with rules enforcing bounded window against `request.time`
  - after first successful commit, rotate to server-anchored derivation
- Local-only timestamps remain client-derived by design (non-authoritative):
  - lock expiry (`expiresAtMs`)
  - retry/cooldown scheduling (`disabledUntilMs`, `nextProbeAtMs`)
  - per-day budgeting (`dayKeyUtc`)
  - local pending markers (`pendingRemoteResetAt`)

Future option (not v3): SDK-backed transaction transport can be added later if bundle/runtime tradeoffs are acceptable.

### 3.4 Practical Throughput Note
- Typical sustained write guidance for a single Firestore document is about one write per second.
- Planned v3 cadence (8s debounce + 45s read-only throttle) remains comfortably below this.

### 3.4.1 Quota Visibility Constraint
- There is no client-safe API to query remaining Firestore quota from a userscript.
- Quota/billing telemetry is available through privileged cloud monitoring APIs, which are not embeddable in client userscripts.
- v3 therefore uses error-driven handling (`429` / `RESOURCE_EXHAUSTED`) plus client-side self-budgeting and cooldown policies.

### 3.5 Envelope Size Budget (v3)
- `read.value` at 10k IDs: typically ~150-220KB serialized.
- `authorPrefs.value` at 1k keys with per-entry metadata: typically ~80-180KB serialized.
- Envelope metadata/field scaffolding: low KB range.
- Practical worst-case budget remains well below Firestore 1 MiB document limit, with rule caps providing hard bounds.

### 3.6 Diagnostics Timestamp Source (v3 REST)
- `lastPushedAt` / `lastPushedAtMs` are diagnostics only (non-authoritative for merge correctness).
- On successful commit, parse Firestore `writeResults.updateTime` from the response.
- Use parsed server update time for diagnostics/runtime status; do not depend on client wall-clock for authoritative ordering.
- `lastPushedAtMs` remains optional in stored envelopes and may be omitted when diagnostics-only runtime capture is sufficient.

### 3.7 Firestore Constraints & Rules Reality Check
- Rules can strongly enforce:
  - exact doc path (`site` + `node` pattern)
  - top-level key allowlists
  - scalar type/length checks for known fields
  - map size caps
- Rules cannot strongly enforce full per-leaf contracts for arbitrary dynamic maps at this scale (`read.value`, `authorPrefs.value`).
- v3 rules therefore enforce broad shape/caps and bounded string/integer constraints, while per-entry normalization/validation remains client-side.
- Client validator also rejects out-of-range epoch/version values and malformed dynamic keys before merge/write.

### 3.8 Field-Path and Index Guardrails
- Dynamic map keys consume field paths and index entries even when doc size is below 1 MiB.
- Maintain field-path safety target with configured caps:
  - target envelope field-path count budget: `< 15,000` (headroom below common 20k-field project/document constraints)
  - keep `read.value <= 10,000` and `authorPrefs.value <= 1,000` under this budget assumption
- Deployment requirement: apply Firestore field index overrides to disable indexing for large dynamic maps:
  - `fields.read.value`
  - `fields.authorPrefs.value`
- If index overrides are missing/misconfigured and writes fail due to index/field-path limits, enter overcapacity handling and reduce pressure (same quota-limited safeguards).
- If index overrides cannot be reliably deployed to all target environments, lower caps before rollout (for example reduce read/authorPrefs caps) to preserve field-path/index headroom.

### 3.9 Optional Pull Optimization (Masked Metadata Probe)
- Optional optimization for steady-state background pulls:
  1. metadata probe `GET` with selected `mask.fieldPaths` (for example `schemaVersion`, `site`, `fields.read.clearEpoch`, `fields.loadFrom`, `fields.authorPrefs.clearEpoch`) and `updateTime`
  2. if `updateTime` (or relevant epochs) changed, fetch full envelope
- Tradeoff: extra code/round-trip, but significantly lower bandwidth when large envelopes are unchanged.

## 4. Local Metadata and State

Local keys (site-scoped):
- `power-reader-sync-meta`
- `power-reader-device-id`
- `power-reader-sync-enabled`
- `power-reader-sync-quota-meta`

```ts
interface LocalSyncMetaV1 {
  schemaVersion: 1;
  deviceId: string;
  fields: {
    readUpdatedAt: string;
    readClearEpoch: number;
    loadFromUpdatedAt: string;
    loadFromVersion: number;
    loadFromClearEpoch: number;
    authorPrefsUpdatedAt: string;
    authorPrefsClearEpoch: number;
  };
  dirty: {
    read: boolean;
    loadFrom: boolean;
    authorPrefs: boolean;
  };
  lastSyncNode?: string;
  lastUserId?: string;
  pendingRemoteReset?: boolean;
  pendingRemoteResetAt?: string; // ISO
  pendingRemoteResetTargets?: {
    readClearEpoch: number;
    loadFromClearEpoch: number;
    authorPrefsClearEpoch: number;
  };
}
```

Runtime-only retry state (not persisted):
```ts
interface RetryRuntimeState {
  retryCount: number;
  nextRetryAtMs: number;
}
```

### 4.1 Local Consistency Invariants (Tampermonkey Storage)
- Treat local state + sync meta updates as a single logical commit.
- Never clear dirty flags unless the corresponding remote write has been confirmed successful.
- On startup, if sync meta is missing/invalid/inconsistent, conservatively mark syncable fields dirty and continue.

Runtime-only sync state (not persisted):
```ts
interface SyncRuntimeState {
  tabId: string;
  writerId: string; // `${deviceId}:${tabId}`
  updateTimeByNode: Map<string, string>;
  lastSuccessAtMs?: number;
  lastError?: string;
  quotaMode?: 'normal' | 'quota_limited' | 'local_budget_limited';
  quotaDisabledUntilMs?: number;
  localBudgetPushesToday?: number;
}
```

```ts
interface LocalSyncQuotaMetaV1 {
  schemaVersion: 1;
  mode?: 'normal' | 'quota_limited' | 'local_budget_limited';
  disabledUntilMs?: number; // circuit-breaker window end
  nextProbeAtMs?: number; // earliest remote probe attempt in quota_limited mode
  cooldownLevel?: number; // 0..N, increases on repeated quota hits
  dayKeyUtc?: string; // e.g. '2026-02-25'
  pushesToday?: number; // per-user local push counter
  lastQuotaErrorAtMs?: number;
}
```

Device ID:
- `crypto.randomUUID()` (fallback random hex).
- Persist across resets.
- Source of truth is `power-reader-device-id`.
- `power-reader-sync-meta.deviceId` is a convenience copy populated from `power-reader-device-id` at init time.

Runtime gate default:
- Missing `power-reader-sync-enabled` => enabled.
- Only explicit `false` disables.

No-op policy:
- Use dirty flags, not full-payload hashing each debounce tick.

## 5. Merge Semantics

### 5.1 Startup Hydration
- `read`:
  - compute `effectiveReadClearEpoch = max(local.read.clearEpoch, remote.read.clearEpoch)`.
  - clear epoch is dominant for invalidation:
    - if a side's `read.clearEpoch` is less than `effectiveReadClearEpoch`, discard that side's entire read set.
    - do not use `read.updatedAt` to rescue a side whose clear epoch is stale.
  - union remaining non-stale read sets.
  - this makes reset/overflow read-clears durable across devices.
  - reset/overflow clear is intentionally destructive across devices once `effectiveReadClearEpoch` advances.
- `authorPrefs`:
  - compute `effectiveAuthorPrefsClearEpoch = max(local.authorPrefs.clearEpoch, remote.authorPrefs.clearEpoch)`.
  - discard a side's entire `authorPrefs.value` when its `authorPrefs.clearEpoch` is below the effective clear epoch.
  - start from non-stale remote entries, then apply local preferences as authoritative for changed keys.
  - when local value differs from retained remote entry, increment that key's envelope `version` and stamp `updatedAt`/`updatedBy` with local writer diagnostics.
  - local sync meta does not persist per-key `authorPrefs` versions; per-key envelope metadata is authoritative for downstream merges.
  - normal clear action must write explicit `v: 0` (not key deletion).
- `authorPrefs` compaction note: when local compaction removes old `v:0` tombstones under cap pressure, very stale non-zero prefs can theoretically be reintroduced by another device. This is an accepted cap-pressure tradeoff in v3.
- `loadFrom`:
  - compute `effectiveLoadFromClearEpoch = max(local.loadFrom.clearEpoch, remote.loadFrom.clearEpoch)`.
  - discard side loadFrom candidates where `clearEpoch < effectiveLoadFromClearEpoch`.
  - during merge, normalize `loadFrom.value`:
    - treat explicit `null` as missing/absent
    - validate non-null non-sentinel strings as ISO datetime; invalid strings are treated as missing.
  - value resolution uses simplified fallback only:
    - prefer `__LOAD_RECENT__` if either side is sentinel
    - else if both are valid ISO values, choose max ISO
    - else choose the non-empty value when only one exists
    - else prefer remote (final deterministic catch-all)
  - `loadFrom.version` remains a monotonic change counter (lifecycle semantics), not the primary value-resolution authority in v3.
- `loadFrom=''` is not synchronized. In envelope form, this is represented by `fields.loadFrom.value` being absent.

### 5.2 Merge Logging for Surprising Overrides
Log when sentinel/ISO overrides happen in either direction:
- `merge-loadFrom-override local=__LOAD_RECENT__ remote=ISO result=__LOAD_RECENT__`
- `merge-loadFrom-override local=ISO remote=__LOAD_RECENT__ result=__LOAD_RECENT__`

### 5.3 Schema Version
- Unknown higher remote version: ignore remote payload, warn, and disable pushes for current session (read-only sync mode).
- Pre-launch assumption: no lower deployed versions exist for this schema; if encountered, treat as unsupported and skip merge/push for current session.
- Full-document write compatibility rule: any additive envelope field change requires a schemaVersion bump (including optional fields).
- Rules coupling constraint: Firestore rules currently enforce `schemaVersion == 1`; any schema bump requires coordinated client + rules deployment before writes resume.
- Merge correctness relies on monotonic epochs/versions, not wall-clock timestamps.
- Clock skew note: timestamps remain diagnostics/tie-break data only.
- Future-skew guard: if remote field timestamp is more than 24h ahead of local wall clock, clamp it to `now + 5m` for logging/UI.
- Invalid/unparseable timestamps are treated as missing for diagnostics/tie-break only.

### 5.4 Envelope Validation and Corruption Handling
Before merge, validate remote envelope shape strictly.

On validation failure:
- ignore remote for current session and continue local-only
- log warning (`sync-remote-invalid`)
- disable normal pushes for current session to avoid writing from an uncertain merge basis
- keep local dirty flags intact
- still allow explicit `/reader/reset` flow to attempt authoritative remote clear (if identity/secret available)
- optionally surface non-blocking UI hint: "Remote sync data appears invalid; use reset to clear remote."

### 5.5 Authoritative Ordering Invariants
- `read` authority: `clearEpoch` dominates; timestamps are non-authoritative.
- `loadFrom` authority: `clearEpoch` barriers plus simplified sentinel/ISO fallback; timestamps are diagnostics only.
- `authorPrefs` authority: field-level `clearEpoch` plus local-changed-key overrides written with per-key envelope metadata.
- `lastPushedAt` / `lastPushedAtMs` are diagnostics only and never drive merge correctness.

## 6. Sync Engine Behavior

### 6.1 Guards and Startup Order
Integration point with current app startup:
- run sync init after takeover/document rebuild and before `loadFrom` setup gating checks in `main.ts`.
- effective order: `executeTakeover()` -> `rebuildDocument()` -> sync init (including reset short-circuit) -> setup gate decision -> load/render.

1. Determine route.
2. Skip sync in archive mode.
3. If reset route, run reset flow and return immediately (no sync pull before reset).
4. Check compile-time/runtime gates.
5. Reuse startup `GET_CURRENT_USER` response (extended with `abTestOverrides`) as sync identity source.
6. If anonymous or missing user id: skip sync.
7. If identity query returns authorization errors for `abTestOverrides` (forbidden/permission-denied), fail closed for this session:
  - disable sync engine startup
  - suppress retry scheduling (no retry storm)
  - surface non-blocking status (`Sync: unavailable (identity permission)`).
8. Resolve sync secret (existing or bootstrap mutation flow).
9. If sync secret unavailable after bootstrap attempts:
  - if `pendingRemoteReset` is active, keep pending flags/barriers unchanged and skip pull/merge (prevent resurrection).
  - if `pendingRemoteReset` remains unresolved across repeated sessions/time window, surface stronger status hint (for example `Sync reset pending: sign in again / check identity permissions`) so users understand why replay cannot complete.
  - skip sync for this session.
10. If `pendingRemoteReset` is set in local sync meta, attempt remote reset CAS loop first (authoritative clear replay) before any pull/merge.
    - while `pendingRemoteReset` is active, do not run fallback-node probe.
    - replay is idempotent: use stored target clear epochs when present and write `max(remoteEpoch, targetEpoch)` (no additional `+1`).
11. Pull + merge before setup gating.
12. While `pendingRemoteReset` remains active, suppress late pull-apply UI refresh behavior for remote payloads (prevents pre-reset resurrection visibility).

Secret-later availability rule:
- if session starts with missing secret and `pendingRemoteReset` is set, the first successful remote write after secret becomes available must be pending-reset replay before any normal flush.

First-run initialization behavior:
- if `power-reader-sync-meta` is absent but local state already has non-empty syncable fields, initialize sync meta and mark those fields dirty so first sync push includes existing local state.

User-switch/logout guard:
- Track `lastUserId` inside `power-reader-sync-meta`.
- If `currentUser` is null: never push, keep local state untouched for now.
- If `currentUser._id` differs from `lastUserId`, treat as account switch:
  - do not push existing dirty local data
  - clear local synced fields (`read`, `loadFrom`, `authorPrefs`)
  - clear fallback/reset pointers: `lastSyncNode`, `pendingRemoteReset`, `pendingRemoteResetAt`, `pendingRemoteResetTargets`
  - clear sync runtime/meta dirty flags and runtime CAS token cache (`updateTimeByNode`), set new `lastUserId`, and perform pull-first for the new user
  - goal: prevent cross-account local data bleed and wrong-node fallback probing.

Startup UX:
- Show lightweight `Syncing...` status while initial pull is in flight.
- If pull+merge does not complete within 5s, continue with local-only startup path for this session and keep sync in background.
- If pull completes after timeout, still apply merged data and trigger a state refresh; show brief non-blocking notice (for example `Synced state applied`) to explain any visible update.

Graceful degradation requirement:
- if bootstrap/pull/push all fail, reader remains fully functional in local-only mode; only sync status indicator reflects degraded sync state.

### 6.2 Flush Triggers and Transport
- Debounce: 8s.
- Max wait: 30s.
- Primary steady-state transport: Firestore REST via `GM_xmlhttpRequest`.
- v3 does not depend on Firestore Web SDK initialization/bundling.
- Global per-node write floor: do not attempt successful commit cadence faster than once per 5s per sync node (except reset flow).
- If changes occur faster than floor interval, coalesce via dirty flags and schedule at next allowed write slot.

Background remote refresh:
- Prefer pull-on-focus:
  - on `visibilitychange=visible` and window `focus`, pull when last successful pull is older than 2 minutes
  - keep this non-blocking (no render stall)
- Keep a low-frequency fallback periodic pull every 10 minutes (with small jitter) while reader is open.
- Coordinate pulls across tabs using shared `localStorage` key `pr-sync-last-pull-at-{site}-{userId}`:
  - before focus/poll pull, read key and skip if last pull was within interval window
  - after successful pull, update key with current timestamp
  - if localStorage unavailable, fall back to per-tab periodic pull behavior
- Skip pull while a local flush attempt is in-flight; run one pull immediately after flush completion if needed.
- If a flush trigger fires while pull is in-flight, defer/coalesce the flush until pull completes, then evaluate dirty state and run one flush attempt.
- If pull fails, keep UI unchanged and retry on next trigger/interval (non-blocking).
- If Firestore transport is blocked by userscript permissions/connectivity (for example missing `@connect firestore.googleapis.com`), surface explicit status (`Sync blocked by userscript permissions/connectivity`).

Visibilitychange strategy:
- On `visibilitychange=hidden`, trigger immediate flush with the configured transport (best-effort, not teardown-safe).
- No unload-time write path in v3; last-moment unsynced changes may reconcile next session.

Best-effort cross-tab push coordination:
- Maintain shared `localStorage` key `pr-sync-last-push-at-{site}-{userId}`.
- After successful push, update key timestamp.
- Before starting a non-reset push, if key indicates a very recent push within floor window, defer/coalesce local push.
- If localStorage is unavailable, fallback to per-tab scheduling only.

Read push throttling:
- If only `read` changed, enforce minimum 45s interval between pushes (acceptable range: 30-60s; default 45s).
- If `loadFrom` or `authorPrefs` changed, use normal cadence (8-30s).
- read-only window is measured from last successful read-only push.
- if `loadFrom`/`authorPrefs` becomes dirty during a read-only throttle window, bypass read throttle and flush on normal cadence.
- Throttle lifecycle: when read-only throttle window expires, schedule one flush attempt immediately if read is still dirty.

### 6.3 Retry
- Backoff on network/5xx: 2s, 5s, 15s, 60s + jitter.
- CAS conflict detection uses `isCasConflict(error)` (status + Firestore error status string), not a single HTTP code assumption.
- On repeated CAS conflicts (failed `updateTime` precondition), coalesce pending local changes into one queued flush state and schedule conflict backoff (for example 1s, 3s, 10s + jitter) instead of immediate retry storms.
- Keep at most one in-flight flush per tab; additional local changes only update dirty state for next coalesced attempt.
- On provider validation/cap rejection, apply merged-envelope cap handling first (read overflow clear / authorPrefs compaction), then retry once before entering normal backoff.
- Never block reader UI.
- `retryCount`/`nextRetryAtMs` are runtime-memory state only (not persisted in GM).
- Always clear in-flight flush markers in `finally`, including timeout/abort/error paths.
- Dirty flags are cleared only after confirmed successful write responses.

### 6.4 Read-State Bounds
- No `readOrder` list in v3.
- Primary bound remains existing app behavior: read marks are periodically cleaned when `loadFrom` advances.
- No read-mark pruning in v3.
- Read overflow guard (read-only, does not touch `authorPrefs`):
  - before push, if local `read.value` exceeds Firestore rule cap (10k keys), clear local read marks (`read.value = {}`), increment `read.clearEpoch` (monotonic), and update `read.updatedAt`.
  - push the cleared read state so the clear propagates across devices via `clearEpoch` semantics.
  - if server still rejects write for read-size reasons, keep local read cleared, log warning, and continue local-only for read sync until next successful push.
  - apply the same check to merged envelopes (startup merge and CAS retry merges), not only local pre-push state.
- Author preference overflow guard (authorPrefs-only):
  - before push, if local `authorPrefs.value` exceeds Firestore rule cap (1000 keys), compact in this order:
    1. remove oldest `v: 0` entries first (oldest by per-key `updatedAt` ascending, deterministic tie-break by `updatedBy` ascending then author key ascending)
    2. if still above cap, remove oldest remaining entries regardless of `v`
  - after compaction, update field-level `authorPrefs.updatedAt/updatedBy` and push compacted map.
  - compaction is local pre-push only; it never clears `read`.
  - apply the same compaction check to merged envelopes (startup merge and CAS retry merges), not only local pre-push state.
- Dynamic key hygiene (client-side):
  - enforce dynamic key length caps (for example <= 64 chars)
  - enforce expected key charset/pattern where possible
  - drop/ignore invalid keys with diagnostics logging
- Decision note (intentional): reject loadFrom-redundancy pruning (`drop where postedAt < loadFrom`) for v3. Reason: read-state does not store authoritative per-ID `postedAt`, and deriving it at prune time would require extra metadata/network lookups and can misclassify data during boundary changes/imports.

Payload estimate note:
- 10k read IDs is typically on the order of ~150-220KB serialized envelope size (varies with key length/metadata).
- this estimate is primarily for `read.value`; total envelope size can be higher with `authorPrefs` metadata (capped at 1000 keys by rules).

Known limitation:
- `read` merge is union-based and does not propagate explicit "unread" actions across devices.

### 6.5 Sync Status UX
Expose a lightweight header status:
- `Sync: OK (2m ago)`
- `Sync: syncing...`
- `Sync: offline (retrying...)`
- `Sync: quota-limited (retry in 14m)`
- `Sync: rate-limited (local budget)`
- `Sync: remote-invalid (push paused; reset recommended)`

Add a user-facing sync toggle in the same header/debug area:
- `Sync: on/off` backed by `power-reader-sync-enabled`
- Default remains enabled; toggle is for troubleshooting and temporary opt-out.
- Toggle-off behavior:
  - immediately stop flush scheduling/retries and clear runtime sync state (`updateTimeByNode`, retry runtime state).
  - preserve local dirty flags (do not discard unsynced local changes).
  - do not perform remote delete on toggle-off.
- Toggle-on behavior:
  - resume normal scheduler and attempt pull/flush with preserved dirty flags.

Add a `Copy Sync Debug Summary` action containing:
- site + tabId
- current sync node suffix (for example last 8 chars only, never full raw identifier)
- last success timestamp
- last error (if any)
- current dirty flags
- retry runtime state

### 6.6 Quota / Overcapacity Mode
Quota detection and mode entry:
- Treat Firestore quota/overcapacity responses (`HTTP 429`, `RESOURCE_EXHAUSTED`, or equivalent quota-exceeded error text) as quota-limited mode triggers.
- On first trigger, enter `quota_limited` mode and persist cooldown state in `power-reader-sync-quota-meta`.
- Also publish shared cross-tab cooldown key `pr-sync-quota-next-retry-at-{site}-{userId}` to prevent retry stampedes.

Circuit-breaker cooldown:
- Cooldown schedule: 5m -> 15m -> 60m -> 6h max (with jitter), increasing by `cooldownLevel`.
- Do not hard-lock until "midnight"; use cooldown/probe windows to avoid timezone/reset-boundary assumptions.
- During cooldown, skip normal remote writes and periodic pulls; remain local-first.
- Keep a single probe attempt when cooldown expires (`nextProbeAtMs`) to test recovery; if it fails with quota again, advance cooldown level.
- On successful probe/write, reset `quota_limited` mode and cooldown level.

Local durability and prioritization:
- Never drop unsynced local state in quota mode: preserve dirty flags and `pendingRemoteReset` barriers.
- When recovering from quota mode, flush by priority:
  1. reset replay / clear barriers
  2. `loadFrom` and `authorPrefs`
  3. `read`
- `read` can remain on an elevated throttle window during early recovery to reduce immediate re-pressure.

Client-side self-budget (defensive):
- Because global quota is not introspectable from client, enforce per-user/day local push budget in `power-reader-sync-quota-meta`.
- Suggested defaults:
  - soft threshold: `100 pushes/day` -> enter `local_budget_limited` and raise minimum push interval to 10 minutes
  - hard threshold: `200 pushes/day` -> pause non-critical pushes until next UTC day boundary
- Even in hard local-budget mode, allow high-priority reset replay and critical barrier writes at reduced cadence.

Idle/hidden behavior:
- If page is hidden or user is idle beyond configured threshold, suspend periodic pulls and non-critical pushes.
- Keep existing `visibilitychange=hidden` best-effort flush behavior.

UX and recovery:
- Expose statuses:
  - `Sync: quota-limited (retry in Xm)`
  - `Sync: rate-limited (local budget)`
- After recovery success, ramp back to normal cadence gradually (avoid immediate full-rate burst).

## 7. setLoadFrom and Read Clearing

### 7.1 Rule
`setLoadFrom(value)` stays a pure setter and must not clear read state.

`loadFrom.version` lifecycle:
- initialize `loadFromVersion` to `0` when no synced `loadFrom` has ever been written.
- first synced non-empty `loadFrom` write uses `version = 1`.
- increment `loadFrom.version` on each explicit synced `setLoadFrom(value)` change where normalized value differs from last synced value (`__LOAD_RECENT__` or ISO).
- local-only `setLoadFrom('')` outside reset path remains transient and does not increment sync version/dirty state.
- `/reader/reset` clear increments both `loadFrom.clearEpoch` and `loadFrom.version`.

### 7.2 Explicit Reset Helper
Add explicit helper for reset/setup-only flows:
- `setLoadFromAndClearRead(value: string)`
- Behavior: `setLoadFrom(value)` + `setReadState({})`

Use this helper only for intentional user reset paths (for example setup restart/change-date), not for normal auto-advance.
- All user-facing clear/reset flows should route through `/reader/reset` so remote clear-epoch barriers are authoritative.
- Local-only `setLoadFrom('')` outside reset flow is treated as transient and may be overwritten by remote hydration.

### 7.3 Existing `clearReadState()` Relationship
- Keep existing `clearReadState()` as-is for full local reset semantics (`setReadState({})` + `setLoadFrom('')`).
- `setLoadFromAndClearRead(value)` is additive and used when setting a new explicit `loadFrom` value while clearing read state.
- Do not replace `clearReadState()` with `setLoadFromAndClearRead`.

### 7.4 Export/Import Interaction
- `exportState()` / import remain local-state tools and do not include remote sync secret material.
- Importing local state marks relevant sync fields dirty and schedules a normal debounced flush (if sync is enabled and identity is available).
- If sync is disabled, import applies locally only; remote update waits until sync is re-enabled.

## 8. Reset Semantics

### 8.1 Canonical Route
`/reader/reset` remains canonical.

### 8.2 Reset Flow
1. Fetch sync identity.
2. Resolve sync secret from existing `abTestOverrides` only (do not bootstrap on reset path).
   - If secret missing:
     - skip remote clear write for this request
     - increment local clear barriers (`read/loadFrom/authorPrefs`) using local values (`+1`)
     - store `pendingRemoteResetTargets` from those incremented barrier values
     - set `pendingRemoteReset = true` (`pendingRemoteResetAt = now`) so reset replay runs before next pull
3. If secret is available, derive `syncNode`.
4. Mark reset-in-progress in runtime state and cancel/suppress in-flight flush attempts for the current tab.
5. Increment `resetGeneration` counter; every flush attempt must compare captured generation at start vs current generation before write and abort if changed.
6. If secret is available, run CAS reset write loop (authoritative but conflict-safe):
   - read current remote envelope first
   - if `pendingRemoteResetTargets` exists, use replay targets with `next = max(remote, target)` (idempotent replay; no additional increment)
   - otherwise compute new reset targets once: `next = max(local, remote) + 1` for `read/loadFrom/authorPrefs`
   - write cleared envelope using `currentDocument.updateTime` precondition
   - reset write must include fresh bounded `expiresAt` (server-anchor preferred) and standard diagnostics fields (`lastPushedBy`, `lastPushedAt`/`lastPushedAtMs`)
   - on precondition conflict, re-read latest, recompute, retry (same conflict retry cap policy)
   - this prevents reset from regressing clear epochs during concurrent writes and avoids replay double-increment
7. Clear local reader storage (`STORAGE_KEYS` reader-state keys only; excludes sync-meta/device-id/sync-enabled/sync-quota-meta) in all cases.
8. If remote CAS reset succeeded:
   - clear `power-reader-sync-meta` (normal post-reset baseline)
9. If remote CAS reset failed or was skipped due to missing secret:
   - do not clear `power-reader-sync-meta`
   - persist incremented local clear epochs + `pendingRemoteResetTargets`, and set `pendingRemoteReset = true` (`pendingRemoteResetAt = now`)
   - mark sync dirty state so remote reset replay is retried before next pull
10. Preserve `power-reader-device-id` and `power-reader-sync-enabled`.
11. Preserve `abTestOverrides.pr_sync_secret_v1` (no rotation in v3 reset).
12. Redirect to `/reader`.

Failure policy:
- Local clear proceeds even if remote clear write fails or secret is temporarily unavailable, but clear barriers remain in sync meta and remote reset is retried before next pull to prevent data resurrection.

## 9. Security Requirements (Firestore)
- Never store `_id` / `syncSecret` in payload.
- Never log raw identity material.
- Treat node URL as capability secret.

Accepted risk note:
- External KV access is capability-URL based (derived from user id + random sync secret), not strong authenticated ACL per user.
- Public users who only know `_id` cannot derive sync node without the secret.
- Moderators/admins with privileged access to user `abTestOverrides` can derive user sync nodes.
- If forum/page execution is compromised, attacker code running as the user can query `abTestOverrides`, derive node access, and read/write sync state.
- For v3 this remains accepted as low-sensitivity data risk (read marks and preferences).
- For v3 this also implies operation-cost exposure (Firestore bills per operation), so quota/billing alerts and abuse monitoring are required.
- Optional envelope encryption using sync secret is deferred (not in v3) because it adds key/version migration complexity and does not mitigate privileged-forum-role secret access.

### 9.1 What Firestore Rules Enforce Well
- Exact doc-path access (`get`/`create`/`update`) with `list` denied.
- Deny-by-default collection/list/scan behavior for this path (no parent enumeration).
- No collection-group or broader read path is granted by rules in v3; only exact document `get` is allowed on the sync path.
- Top-level and nested schema allowlisting via `keys().hasOnly([...])`.
- Map size caps via `.size()` for `read.value` and `authorPrefs.value`.

### 9.2 Firestore Limitation to Account For
- Firestore Rules cannot strongly enforce "generic map value type" contracts for arbitrary dynamic keys as strictly as RTDB per-child validators.
- Rules evaluation cost can also become a concern on near-cap dynamic maps.
- v3 therefore combines strict fixed-shape rules with client-side envelope validation/normalization and bounded map/doc-size caps.
- In v3, per-key `authorPrefs.value[author]` leaf contract (`{v,version,updatedAt,updatedBy}`) is treated as client-enforced, not rules-enforced.

### 9.3 Firestore Rules Baseline (v3)
```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    match /pr_sync_v1/{site}/nodes/{node} {
      allow list: if false;

      allow get: if siteOk(site) && nodeOk(node);

      allow create, update: if siteOk(site) && nodeOk(node) && validEnvelope(site);

      allow delete: if false; // v3 keeps reset-as-cleared-envelope
    }

    function siteOk(site) {
      return site in ['lw', 'eaf'];
    }

    function nodeOk(node) {
      return node.matches('^pr_sync_[0-9a-f]{64}$');
    }

    function validEnvelope(site) {
      let d = request.resource.data;
      let allowed = ['schemaVersion','site','lastPushedBy','lastPushedAt','fields','lastPushedAtMs','expiresAt'];
      return d.keys().hasOnly(allowed)
        && d.schemaVersion == 1
        && d.site == site
        && (d.lastPushedBy is string) && d.lastPushedBy.size() <= 128
        && (d.lastPushedAt is timestamp)
        && (!('lastPushedAtMs' in d) || (d.lastPushedAtMs is int && d.lastPushedAtMs >= 0 && d.lastPushedAtMs <= 253402300799999))
        && (d.expiresAt is timestamp)
        && d.expiresAt > request.time
        // 180d target + 1d skew headroom for first-write client-time fallback.
        && d.expiresAt < request.time + duration.value(15638400, 's')
        && validFields(d.fields);
    }

    function validFields(f) {
      return (f is map)
        && f.keys().hasOnly(['read','loadFrom','authorPrefs'])
        && validRead(f.read)
        && validLoadFrom(f.loadFrom)
        && validAuthorPrefs(f.authorPrefs);
    }

    function validRead(r) {
      return (r is map)
        && r.keys().hasAll(['updatedAt','updatedBy','clearEpoch','value'])
        && r.keys().hasOnly(['updatedAt','updatedBy','clearEpoch','value'])
        && (r.updatedAt is timestamp)
        && (r.updatedBy is string) && r.updatedBy.size() <= 128
        && (r.clearEpoch is int) && r.clearEpoch >= 0 && r.clearEpoch <= 1000000000
        && (r.value is map)
        && r.value.size() <= 10000;
      // Dynamic entry-value validation (`== 1`) is enforced client-side in v3.
    }

    function validLoadFrom(lf) {
      return (lf is map)
        && lf.keys().hasAll(['updatedAt','updatedBy','version','clearEpoch'])
        && lf.keys().hasOnly(['updatedAt','updatedBy','version','clearEpoch','value'])
        && (lf.updatedAt is timestamp)
        && (lf.updatedBy is string) && lf.updatedBy.size() <= 128
        && (lf.version is int) && lf.version >= 0 && lf.version <= 1000000000
        && (lf.clearEpoch is int) && lf.clearEpoch >= 0 && lf.clearEpoch <= 1000000000
        && (!('value' in lf) || (lf.value is string && lf.value.size() <= 40
             && (lf.value == '__LOAD_RECENT__' || lf.value.matches('^\\d{4}-\\d{2}-\\d{2}T.*$'))));
    }

    function validAuthorPrefs(ap) {
      return (ap is map)
        && ap.keys().hasAll(['updatedAt','updatedBy','clearEpoch','value'])
        && ap.keys().hasOnly(['updatedAt','updatedBy','clearEpoch','value'])
        && (ap.updatedAt is timestamp)
        && (ap.updatedBy is string) && ap.updatedBy.size() <= 128
        && (ap.clearEpoch is int) && ap.clearEpoch >= 0 && ap.clearEpoch <= 1000000000
        && (ap.value is map)
        && ap.value.size() <= 1000;
      // Dynamic-key entry shape is validated client-side in v3.
    }
  }
}
```

### 9.4 Required Retention / Bloat Mitigation
- Every write must include bounded-future `expiresAt` (for example `now + 180 days`) and Firestore TTL must be enabled for that field.
- TTL is eventual, not immediate (typically within 24 hours).
- Retention expectation: target TTL window is 180 days since last successful write.
- TTL-expiry UX acceptance:
  - if a user returns after TTL expiry and the remote doc was deleted, pull will see missing-doc (`404`) and a new baseline is created on next push
  - this is accepted in v3 (stale cross-device history beyond retention window is intentionally not preserved)

### 9.5 Commit Endpoint Abuse Guardrails
- Because `documents:commit` can express multi-write operations, v3 constrains client write payloads to exactly one write per request.
- Rules restrict writable scope to `pr_sync_v1/{site}/nodes/{node}` and deny `list`; no other project document paths are writable through this client.
- Integration tests assert single-write commit payload shape and deny-list behavior.

### 9.6 API Key and Incident Response Playbook
- API key posture:
  - Firebase web API key is treated as public identifier, not secret material.
  - Prefer API restriction to required Firestore APIs when possible.
  - Validate Tampermonkey request-header/referrer behavior before relying on referrer restrictions.
- Incident response (abuse/cost spike):
  1. tighten caps / reduce cadence via remote config or client hotfix
  2. temporarily disable remote writes (keep local-only mode)
  3. rotate API key and redeploy metadata if key-level abuse suspected
  4. temporarily shorten TTL retention window for cleanup pressure relief
  5. if needed, migrate to authenticated write mode in a follow-up version

### 9.7 Optional Integrity Tag (Deferred)
- Consider adding envelope integrity MAC keyed by `syncSecret` in a follow-up version:
  - `integrity: { alg: 'HS256', mac: base64(HMAC_SHA256(syncSecret, canonicalPayload)) }`
  - canonical payload should exclude purely diagnostic fields (`lastPushedAt*`) to avoid false mismatches
- On read, invalid/missing MAC would be treated as remote-invalid (local-only push-disabled mode, reset still allowed).
- Deferred from v3 to avoid canonicalization/migration complexity in initial rollout.

## 10. Client Coordination (Simplified)
Flush path:
- No localStorage lock for flushes in v3.
- Rely on backend CAS (`currentDocument.updateTime` precondition) for correctness.
- Same-device concurrent tabs may generate extra retries but remain correct.

Bootstrap path:
- Keep a short-lived bootstrap lock only for sync-secret initialization.
- Lock key: `pr-sync-lock-{site}-{userId}`.
- Prefer `navigator.locks` for primary mutual exclusion when available.
- Fallback lock value in localStorage must include `{token, expiresAtMs}` and support stale-lock reclaim.
- If lock cannot be acquired, skip local bootstrap write and adopt remote secret via re-read.
- If both lock mechanisms are unavailable, proceed lockless and rely on read/verify retry.

Pull coalescing:
- Use shared `pr-sync-last-pull-at-{site}-{userId}` for best-effort cross-tab pull dedupe.
- If localStorage unavailable, each tab falls back to independent pull triggers.

Push coalescing (best effort):
- Use shared `pr-sync-last-push-at-{site}-{userId}` to reduce same-device multi-tab push bursts.
- Respect per-node write floor before starting non-reset pushes.
- If localStorage unavailable, each tab falls back to independent push scheduling.

Quota coordination:
- Use shared `pr-sync-quota-next-retry-at-{site}-{userId}` so tabs respect a single cooldown window.
- While cooldown is active, only one tab should perform the recovery probe attempt when `nextProbeAtMs` elapses.

Future optimization note:
- BroadcastChannel can be added later for low-latency same-device tab hints (for example "push just completed"), while keeping localStorage keys as durable coordination state.

## 11. Implementation Plan (File-by-File)

1. `src/shared/graphql/queries.ts`
- extend `GET_CURRENT_USER` to include `abTestOverrides` for sync identity reuse
- add `UPDATE_SYNC_SECRET` mutation constant (selector/data shape)

2. `src/scripts/power-reader/services/firestoreSyncBackend.ts` (new; replaces `externalSyncBackend.ts`)
- backend adapter for Firestore doc path `pr_sync_v1/{site}/nodes/{syncNode}`
- provide `getEnvelope(site, node)`
- provide REST helpers for read + `currentDocument.updateTime` precondition writes (`documents:commit`)
- provide commit-response parsing helpers (`writeResults.updateTime`) for diagnostics
- treat malformed/empty commit response token (`writeResults[0].updateTime`) as uncertain outcome and retry without clearing dirty flags
- store/reuse CAS `updateTime` tokens as exact opaque strings (no Date parse/reformat)
- support diagnostics fields (`lastPushedAtMs`) and required TTL field (`expiresAt`)
- convert client envelope values to Firestore REST typed values (`mapValue`/`stringValue`/`integerValue`/`timestampValue`) on write
- convert Firestore REST typed values back to normalized client envelope shape on read
- enforce required bounded `expiresAt` generation on write (`serverAnchor + ttlWindow` preferred; `now + ttlWindow` fallback only when no server anchor exists)
- source diagnostics timestamps from server anchors when available (avoid client-clock drift in envelope diagnostics)
- use `GM_xmlhttpRequest` transport (v3 primary)
- apply bounded per-request timeout (10-20s) and classify timeout/network errors as retryable
- enforce single-write `documents:commit` payload shape
- enforce runtime guard for single-write update+precondition commit payload
- implement create-if-missing via `exists=false` precondition and raced-creator fallback re-read path
- expose REST error classifier for conflict/create-race/type errors (`ABORTED`/`FAILED_PRECONDITION`/`ALREADY_EXISTS`/`INVALID_ARGUMENT`)

3. `src/scripts/power-reader/services/persistenceSync.ts` (new)
- single sync state machine module (init -> pull -> merge -> maybe-flush, plus reset entrypoint)
- contains identity/bootstrap logic, merge logic, scheduler/retry logic, and runtime status model (no additional sync submodules in v3)
- sync node derivation (SHA-256)
- sync secret bootstrap/read/verify flow (`pr_sync_secret_v1` in `abTestOverrides`)
- bootstrap lock helpers with token+expiry (`navigator.locks` preferred, localStorage fallback)
- persist `lastSyncNode` only after secret finalization and confirmed current-node validity
- fallback-node behavior is probe-only (`lastSyncNode` read-only diagnostics; no copy-forward writes)
- startup pull/merge
- pending remote-reset replay (`pendingRemoteReset`) before startup pull when prior reset write failed
- idempotent pending-reset replay using stored `pendingRemoteResetTargets` (`max(remote,target)` without extra increment)
- pull-on-focus (visible/focus) with stale threshold + low-frequency fallback poll (10m + jitter)
- cross-tab pull coalescing via `pr-sync-last-pull-at-{site}-{userId}`
- flush triggers defer while pull is in-flight and coalesce to one post-pull flush attempt
- cross-tab push coalescing via `pr-sync-last-push-at-{site}-{userId}` (best-effort)
- startup `Syncing...` UI state + 5s startup timeout fallback
- writer id generation (`${deviceId}:${tabId}`) for all `updatedBy` writes
- clear-epoch/version merge semantics for read/loadFrom/authorPrefs
- simplified loadFrom fallback branch (sentinel/ISO/non-empty rules; no matrix table)
- future-skew timestamp guard for diagnostics/UI only
- invalid timestamp normalization (treat unparseable timestamps as missing)
- user-switch local-sync-data clear before pull-first
- user-switch clearing of `lastSyncNode`/`pendingRemoteReset`/`pendingRemoteResetAt`/`pendingRemoteResetTargets` for cross-account safety
- user-switch runtime cleanup includes `updateTimeByNode` CAS cache reset
- higher-schema read-only mode gate
- strict envelope validation + corruption fallback
- missing remote doc (`404 NOT_FOUND`) treated as empty envelope, not fatal error
- invalid remote envelope puts session into local-only + push-disabled mode (reset still allowed)
- optional in-memory `updateTime` cache for REST precondition path
- late-startup merge apply + non-blocking "Synced state applied" notice
- fail-closed identity permission detection (`abTestOverrides` access denied => session-disabled sync, no retries)
- explicit null-vs-unauthorized handling for `abTestOverrides`
- enforce pending-reset replay precedence when secret becomes available later in session
- conflict retry loop + coalescing/backoff for precondition failures
- minimum non-reset write floor per node (5s) with dirty coalescing between slots
- reset-generation cancellation checks for in-flight flushes
- reset CAS clear loop (`max(local,remote)+1` recompute on conflict) for read/loadFrom/authorPrefs barriers
- quota error detection (`429`/`RESOURCE_EXHAUSTED`) and quota-limited circuit breaker
- cooldown/probe schedule management (5m -> 15m -> 60m -> 6h max + jitter)
- local daily push self-budget enforcement and local budget-limited mode
- hidden/idle gating for non-critical pulls/pushes

4. `src/scripts/power-reader/utils/storage.ts`
- add sync metadata helpers
- add quota metadata helpers (`power-reader-sync-quota-meta`)
- add cross-tab push timestamp helper key (`pr-sync-last-push-at-{site}-{userId}`)
- startup recovery path: when sync meta is missing/invalid/inconsistent, conservatively mark syncable fields dirty
- include `pendingRemoteReset`/`pendingRemoteResetAt`/`pendingRemoteResetTargets` helpers
- add `setLoadFromAndClearRead(value)` helper
- keep `setLoadFrom(value)` pure
- track `loadFrom.version` lifecycle (init/increment/reset-clear semantics)
- add read-overflow guard helper (read-only local clear + `read.clearEpoch` increment on cap exceed)
- do not persist per-key `authorPrefs` sync metadata in local sync meta; rely on authoritative per-key envelope entries
- add authorPrefs overflow-compaction helper (drop oldest `v:0` first, then oldest overall only if still above cap)
- clear sync meta in reset path only after successful remote CAS reset write (preserve device-id/sync-enabled)
- reset path: clear sync meta only on successful remote reset write; on failure persist incremented barriers + pending reset flag
- integrate import path with sync dirty-flag marking (when sync enabled)
- add guarded lock helpers that no-op when localStorage is unavailable

5. `src/scripts/power-reader/main.ts`
- initialize sync before setup gating
- place sync init after takeover/document rebuild and before setup gate branch (`loadFrom` check)
- skip sync in archive mode
- call remote-clear-envelope reset helper on `/reader/reset`
- use `setLoadFromAndClearRead` only in explicit reset/setup flows
- if sync secret bootstrap/read fails, skip sync and surface non-blocking status (`Sync: unavailable`)

6. `src/scripts/power-reader/render/index.ts`
- ensure reset UI routes to `/reader/reset`
- add sync status label, sync on/off toggle (`power-reader-sync-enabled`), and `Copy Sync Debug Summary` action in header/debug area
- include quota-specific status text (`quota-limited`, `local budget-limited`) with retry ETA when available

7. `src/scripts/power-reader/SPEC.md`
- add `PR-PERSIST-*` requirement section and tags defined below

8. Metadata/config updates
- add `firestore.googleapis.com` to userscript `@connect` list in metadata output path
- add matching host allowance in `vite.config.ts` monkey metadata/connect config
- detect missing/blocked connect permission path and surface explicit sync status hint

9. Firestore deployment artifacts
- add Firestore index override config that disables indexing for large dynamic maps:
  - `fields.read.value`
  - `fields.authorPrefs.value`
- document deploy command/path so index overrides are consistently applied to the target project/database

10. Firestore emulator integration test harness
- add integration suite under `tests/integration/firestore-sync/` that targets Firestore Emulator only
- add emulator test helpers (start/wait/reset) under `tests/helpers/firestoreEmulator.ts`
- run REST calls against emulator endpoints to validate real rules + `currentDocument.updateTime` CAS behavior
- load the same rules file used for deployment so integration assertions reflect production rules logic
- add scripts (for example `test:sync-emulator`) so emulator tests run in CI without hitting production
- enforce a hard guard in tests that endpoint host is localhost/emulator and fail if production host is configured

## 12. SPEC and Test Plan

### 12.1 SPEC IDs
Keep `PR-PERSIST-01` through `PR-PERSIST-43`, add `PR-PERSIST-44` through `PR-PERSIST-48`, add quota-mode IDs `PR-PERSIST-49` through `PR-PERSIST-56`, add emulator-integration IDs `PR-PERSIST-57` through `PR-PERSIST-60`, add hardening IDs `PR-PERSIST-61` through `PR-PERSIST-68`, add protocol-hardening IDs `PR-PERSIST-69` through `PR-PERSIST-77`, and add additional robustness IDs `PR-PERSIST-78` through `PR-PERSIST-82`.

v2 -> v3 mapping note:
- Some IDs retain intent but change backend-specific meaning under Firestore (notably `PR-PERSIST-27` and `PR-PERSIST-36`).
- This is intentional; Firestore rule primitives differ from RTDB child validators/root-write semantics.

Initial tags:
- `PR-PERSIST-01`: deterministic sync node derivation
- `PR-PERSIST-02`: external KV storage (Firestore document backend)
- `PR-PERSIST-03`: site-scoped sync
- `PR-PERSIST-04`: startup hydrate before setup gate
- `PR-PERSIST-05`: reset clears local state + writes remote cleared envelope
- `PR-PERSIST-06`: synced fields (`read`, `loadFrom`, `authorPrefs`)
- `PR-PERSIST-07`: anonymous/missing-identity guard
- `PR-PERSIST-08`: loadFrom override logging
- `PR-PERSIST-09`: Firestore conflict handling (failed `updateTime` precondition path)
- `PR-PERSIST-10`: `setLoadFrom` pure + explicit clear helper semantics
- `PR-PERSIST-11`: identity fallback uses user-gated `lastSyncNode` probe for diagnostics only (no copy-forward writes)
- `PR-PERSIST-12`: unknown-higher-schema read-only mode (including mid-CAS-retry re-read detection)
- `PR-PERSIST-13`: strict envelope validation / corruption handling (invalid remote => local-only push-disabled session mode, reset still allowed)
- `PR-PERSIST-14`: read-only throttling (default 45s, allowed 30-60s)
- `PR-PERSIST-15`: one-time sync-secret bootstrap and verification in `abTestOverrides`
- `PR-PERSIST-16`: late startup sync apply with visible non-blocking notice
- `PR-PERSIST-17`: sync toggle (`power-reader-sync-enabled`) UX + behavior
- `PR-PERSIST-18`: export/import dirty-mark + sync interaction semantics
- `PR-PERSIST-19`: read-overflow guard (local read clear + `read.clearEpoch` propagation)
- `PR-PERSIST-20`: authorPrefs overflow compaction (oldest `v:0` first, then oldest overall if required)
- `PR-PERSIST-21`: pull-on-focus + fallback periodic pull with cross-tab coalescing, with flush deferral while pull is in-flight
- `PR-PERSIST-22`: clear-epoch barriers for `read`, `loadFrom`, `authorPrefs`
- `PR-PERSIST-23`: simplified `loadFrom` fallback merge plus local-authoritative `authorPrefs` changed-key merge
- `PR-PERSIST-24`: identity permission fail-closed (no retry storms)
- `PR-PERSIST-25`: reset uses CAS loop and monotonic clear-epoch advancement under conflict
- `PR-PERSIST-26`: conflict coalescing/backoff for repeated `updateTime` precondition failures
- `PR-PERSIST-27`: Firestore rules enforce structure/caps while client validation enforces dynamic-leaf value shapes
- `PR-PERSIST-28`: `loadFrom.version` lifecycle (init/increment/reset semantics)
- `PR-PERSIST-29`: Firestore server-time diagnostics path supports optional `lastPushedAtMs`
- `PR-PERSIST-30`: reset-failure durability via persisted barriers + `pendingRemoteReset`
- `PR-PERSIST-31`: post-merge cap enforcement on all write paths (including CAS retries)
- `PR-PERSIST-32`: optional `loadFrom.value` validation support for clear-barrier-only states
- `PR-PERSIST-33`: `lastSyncNode` persisted only after secret finalization and confirmed current-node validity
- `PR-PERSIST-34`: fallback-node probe is user-gated (`lastUserId` match) and blocked while `pendingRemoteReset` is active
- `PR-PERSIST-35`: user-switch clears fallback/reset pointers (`lastSyncNode`, `pendingRemoteReset`, `pendingRemoteResetAt`, `pendingRemoteResetTargets`) and runtime CAS cache
- `PR-PERSIST-36`: Firestore rules allow only exact doc-path get/create/update; `list` denied
- `PR-PERSIST-37`: top-level allowlists in Firestore rules with client-side dynamic-entry validation fallback
- `PR-PERSIST-38`: optional `lastPushedAtMs` acceptance in schema + rules
- `PR-PERSIST-39`: idempotent pending-reset replay via stored target clear epochs
- `PR-PERSIST-40`: `loadFrom.value` null-normalized-to-absent and bounded sentinel/ISO validation
- `PR-PERSIST-41`: required-child enforcement for `read`, `loadFrom`, `authorPrefs` objects in Firestore rules
- `PR-PERSIST-42`: delete unsupported in v3 Firestore rules (reset writes cleared envelope)
- `PR-PERSIST-43`: sync node derivation uses lowercase hex encoding
- `PR-PERSIST-44`: Firestore document path contract (`pr_sync_v1/{site}/nodes/{syncNode}`)
- `PR-PERSIST-45`: concurrency via Firestore REST `currentDocument.updateTime` precondition
- `PR-PERSIST-46`: Firestore rules enforce `read.value.size <= 10000` and `authorPrefs.value.size <= 1000`
- `PR-PERSIST-47`: deny Firestore `list` to prevent parent enumeration
- `PR-PERSIST-48`: required TTL retention via bounded `expiresAt` policy
- `PR-PERSIST-49`: no client quota introspection; quota handling is error-driven (`429`/`RESOURCE_EXHAUSTED`)
- `PR-PERSIST-50`: quota-limited circuit breaker persists cooldown and probe schedule
- `PR-PERSIST-51`: quota-limited mode preserves dirty state and pending reset barriers (no data loss)
- `PR-PERSIST-52`: cross-tab quota cooldown coordination via shared retry timestamp key
- `PR-PERSIST-53`: per-user/day local push self-budget with soft/hard thresholds
- `PR-PERSIST-54`: hidden/idle gating suspends non-critical sync activity
- `PR-PERSIST-55`: post-recovery ramp-up avoids immediate full-rate burst
- `PR-PERSIST-56`: UI exposes quota-limited and local-budget-limited states with retry ETA
- `PR-PERSIST-57`: Firestore Emulator integration suite validates REST path end-to-end without production dependencies
- `PR-PERSIST-58`: Emulator tests validate deployed rules behavior (path constraints, `list` deny, schema/map-size enforcement)
- `PR-PERSIST-59`: Emulator tests validate `currentDocument.updateTime` CAS precondition conflict/retry behavior
- `PR-PERSIST-60`: Integration tests enforce emulator-only endpoints (fail closed on production Firestore host)
- `PR-PERSIST-61`: write protocol uses single-write `documents:commit` payloads only
- `PR-PERSIST-62`: create-if-missing uses `exists=false` precondition with raced-creator re-read fallback
- `PR-PERSIST-63`: bootstrap lock uses ownership token + expiry and stale-lock reclaim
- `PR-PERSIST-64`: bootstrap lock prefers `navigator.locks` with localStorage fallback
- `PR-PERSIST-65`: pending reset replay is prioritized over late pull-apply when reset is unresolved
- `PR-PERSIST-66`: startup recovery marks syncable fields dirty when local sync meta is missing/invalid/inconsistent
- `PR-PERSIST-67`: Firestore index overrides disable indexing for large dynamic maps (`fields.read.value`, `fields.authorPrefs.value`)
- `PR-PERSIST-68`: incident response path supports temporary write-disable and API-key/TTL operational controls
- `PR-PERSIST-69`: `expiresAt` is required and bounded by rules (`request.time < expiresAt < request.time + 181d`, where 180d target + 1d skew headroom)
- `PR-PERSIST-70`: Firestore REST writer uses explicit typed-value serialization/deserialization
- `PR-PERSIST-71`: CAS conflict detection handles Firestore contention/precondition variants (not single-code only)
- `PR-PERSIST-72`: REST requests use bounded timeout, malformed commit token responses are treated as uncertain outcomes, and in-flight state always clears in `finally`
- `PR-PERSIST-73`: missing doc (`404 NOT_FOUND`) is treated as empty remote envelope
- `PR-PERSIST-74`: non-reset write cadence enforces per-node minimum interval with dirty coalescing
- `PR-PERSIST-75`: best-effort cross-tab push coalescing uses shared last-push timestamp key
- `PR-PERSIST-76`: invalid remote envelope enters local-only push-disabled mode for session
- `PR-PERSIST-77`: long-lived pending reset with missing secret surfaces stronger user-facing status hint
- `PR-PERSIST-78`: CAS update token (`updateTime`) is treated as opaque exact server string (no parse/reformat)
- `PR-PERSIST-79`: rules bound `clearEpoch`/`version` integers to sane upper limits and client validates bounds
- `PR-PERSIST-80`: missing/blocked Firestore userscript connect permission surfaces explicit sync status hint
- `PR-PERSIST-81`: reset CAS writes include fresh bounded `expiresAt` and standard diagnostics fields
- `PR-PERSIST-82`: dynamic-key hygiene enforces local key length/charset bounds before merge/write
- `PR-PERSIST-83`: envelope timestamps (`expiresAt`, diagnostics) prefer server-time anchors; client-time fallback is first-write-only

### 12.2 Tests
Layering requirement:
- Unit tests: mocked transport/clock/storage for deterministic logic validation.
- Integration tests: Firestore Emulator only; validate REST <-> rules <-> CAS behavior.
- E2E tests: live site/browser behavior validation (no emulator dependency).

1. Unit: deterministic sync node derivation.
2. Unit: sync-secret bootstrap handles `abTestOverrides === null` as `{}` only when no GraphQL field authorization error.
3. Unit: sync-secret bootstrap writes merged `abTestOverrides` without dropping existing keys.
4. Unit: sync-secret bootstrap adopts remote secret on concurrent write mismatch.
5. Unit: sync-secret bootstrap verify re-read catches overwrite and retries (cap 2).
6. Unit: bootstrap uses mutation-response confirmation + single verify read before derivation.
7. Unit: sync-secret type validation rejects malformed/coerced values.
8. Unit: read merge with `clearEpoch` prevents stale-device reintroduction after reset/overflow clear.
9. Unit: read merge discards side with lower `clearEpoch` even when that side has newer `read.updatedAt`.
10. Unit: normal author preference clear path uses explicit `v: 0` (compaction may later remove old tombstones under cap pressure).
11. Unit: merge logic (`loadFrom`, `authorPrefs`) including simplified `loadFrom` fallback resolution, omission handling for `loadFrom=''`, and local-changed-key `authorPrefs` overwrite semantics.
12. Unit: loadFrom version backfill for legacy local state preserves monotonic change-counter semantics.
13. Unit: simplified loadFrom fallback prefers `__LOAD_RECENT__`, else max ISO, else non-empty.
14. Unit: loadFrom missing maps to `''`; invalid ISO string is treated as missing.
15. Unit: `updatedBy` uses writer id (`deviceId:tabId`) for deterministic same-device tie-breaks.
16. Unit: future-skew guard clamps remote timestamps >24h ahead to `now + 5m` for diagnostics/UI.
17. Unit: invalid/unparseable timestamps are treated as missing for merge resolution.
18. Unit: `effectiveReadClearEpoch` computation is monotonic and independent of wall-clock skew.
19. Unit: `setLoadFrom` does not clear read state.
20. Unit: `setLoadFromAndClearRead` clears read state intentionally.
21. Unit: `clearReadState()` semantics remain unchanged and separate from `setLoadFromAndClearRead`.
22. Unit: conflict retry loop on Firestore CAS write failures (failed `updateTime` precondition).
23. Unit: read-overflow guard clears local read state, increments `read.clearEpoch`, and retries push.
24. Unit: read-overflow guard does not modify `authorPrefs`.
25. Unit: authorPrefs overflow compaction removes oldest `v:0` entries first by (`updatedAt`,`updatedBy`,`authorKey`) order.
26. Unit: if `v:0` compaction is insufficient, authorPrefs overflow compaction removes oldest remaining entries regardless of `v`.
27. Unit: authorPrefs compaction updates field-level `authorPrefs.updatedAt/updatedBy`.
28. Unit: read-only throttle semantics (timer from last successful read-only push; bypass when `loadFrom`/`authorPrefs` dirty).
29. Unit: pull-on-focus triggers pull only when stale threshold is exceeded and is non-blocking on failures.
30. Unit: fallback periodic pull runs at configured low-frequency interval and is non-blocking on failures.
31. Unit: bootstrap lock path degrades safely when localStorage is unavailable.
32. Unit: `updateTime` cache usage path (REST precondition mode) and CAS retry on failed precondition.
33. Unit: persistent Firestore precondition failures coalesce flushes (single in-flight) and apply bounded conflict backoff.
34. Unit: REST precondition write path uses `currentDocument.updateTime` and re-read/merge/retry on mismatch.
35. Unit: unknown higher schema enters read-only mode (no push).
36. Unit: additive envelope fields are rejected unless schemaVersion is bumped.
37. Unit: invalid remote envelope enters local-only push-disabled mode for session; explicit reset path remains allowed.
38. Unit: first sync init marks non-empty existing local fields dirty when sync meta is absent.
39. Unit: import marks fields dirty and schedules flush only when sync is enabled.
40. Unit: toggle-off clears runtime sync state but preserves dirty flags; toggle-on resumes flushes.
41. E2E: startup hydrate bypasses setup when remote has data.
42. E2E: late startup pull (post-timeout) applies merged state and shows non-blocking notice.
43. E2E: identity fallback probes `lastSyncNode` in read-only mode for diagnostics (no copy-forward write).
44. E2E: anonymous user skips sync.
45. E2E: sync-secret bootstrap happens once, then steady-state sync performs no `updateUser` calls.
46. E2E: two simultaneous tabs on first run converge to one secret and one sync node.
47. E2E: debounced writes use primary transport.
48. E2E: `/reader/reset` short-circuits before sync pull and writes CAS-protected remote cleared envelope + local clear.
49. E2E: sync status indicator and sync on/off toggle update behavior correctly.
50. E2E: persistent KV failure keeps reader fully usable in local-only mode.
51. E2E: periodic pull applies cross-device updates without full page reload.
52. E2E: network failures do not block render.
53. E2E: logout/user-switch clears local synced fields and prevents cross-account state bleed.
54. E2E: reset during in-flight flush does not allow stale write after reset (generation guard/cancel path).
55. Unit: periodic pull coalescing across tabs honors shared last-pull timestamp key and skips redundant pulls.
56. Unit: identity permission-denied on `abTestOverrides` disables sync for session and suppresses retries.
57. E2E: pull-on-focus picks up remote updates without waiting for fallback periodic interval.
58. Unit: loadFrom clear-epoch barrier prevents stale device resurrection after reset.
59. Unit: authorPrefs clear-epoch barrier prevents stale device resurrection after reset.
60. Unit (table-driven): merge matrix covers epoch/version + fallback cases + compaction side effects.
61. Unit: simulated two-device CAS conflicts converge without dropping dirty fields.
62. Unit: loadFrom version lifecycle increments only on synced value changes and reset clear.
63. Unit: reset CAS loop recomputes epochs on conflict (`max(local,remote)+1` for fresh reset, `max(remote,target)` for replay) and never regresses clear epochs.
64. Unit: identity parsing distinguishes null-with-auth-error (fail-closed) from null-without-error (treat empty).
65. Unit: malformed entries fail validation expectations (`read.value != 1`; invalid `authorPrefs` entry shape rejected by client validator).
66. Unit: envelope with `fields.loadFrom.value` absent passes validation and merge round-trip.
67. Unit: merged `read.value` size > cap (including CAS retry merges) triggers overflow-clear before write.
68. E2E: remote reset write failure retains local barriers and prevents pre-reset data resurrection on subsequent pull.
69. Unit: user-switch clears `lastSyncNode`/`pendingRemoteReset`/`pendingRemoteResetAt`/`pendingRemoteResetTargets` pointers, clears runtime CAS cache, and fallback-node probe is blocked when `lastUserId` mismatches current user.
70. Unit: `lastSyncNode` is not overwritten until current node validity is confirmed (successful pull/push).
71. Unit: `pendingRemoteReset` blocks fallback-node probe until reset replay succeeds.
72. Unit: envelope write with `lastPushedAtMs` present passes validation when numeric and fails when invalid type.
73. Unit: Firestore rules deny `list` and restrict access to exact doc path contract.
74. Unit: `authorPrefs.value.$author` malformed entries are rejected/ignored by validation path (rules + client safeguards).
75. E2E: reset with missing secret sets `pendingRemoteReset` and does not allow remote resurrection on next session.
76. Unit: pending-reset replay is idempotent (repeated replays do not keep incrementing clear epochs).
77. Unit: `loadFrom.value = null` is normalized to absent during validation/merge.
78. Unit: Firestore rule validation rejects envelopes missing required field children (for example `read.clearEpoch` missing or `loadFrom.version` missing).
79. Unit: Firestore path builder emits `pr_sync_v1/{site}/nodes/{syncNode}` for both sites.
80. Unit: REST precondition writer enforces `currentDocument.updateTime` and retries on mismatch.
81. Unit: v3 unauthenticated rules posture allows exact-path access without `request.auth`, while still denying `list`.
82. Unit: Firestore rules map-size caps enforce `read.value <= 10000` and `authorPrefs.value <= 1000`.
83. Unit: required `expiresAt` ISO in client envelope is converted to Firestore `timestampValue` on write; missing/out-of-range values are rejected.
84. Unit: quota error classifier maps `HTTP 429` / `RESOURCE_EXHAUSTED` responses to quota-limited mode.
85. Unit: entering quota-limited mode persists `disabledUntilMs` / `nextProbeAtMs` / `cooldownLevel` and survives reload.
86. Unit: quota-limited mode pauses routine pushes/pulls but preserves dirty flags and `pendingRemoteReset`.
87. Unit: cross-tab cooldown key `pr-sync-quota-next-retry-at-{site}-{userId}` prevents retry stampede.
88. Unit: local daily push self-budget tracks UTC day rollover and applies soft/hard thresholds.
89. Unit: hidden/idle gating suspends non-critical sync activity while preserving `visibilitychange=hidden` best-effort flush.
90. Unit: successful recovery probe exits quota-limited mode and resets cooldown level.
91. Unit: recovery ramp-up restores normal cadence gradually (no immediate burst).
92. E2E: on server quota exhaustion, UI shows `Sync: quota-limited` with retry ETA and reader remains fully usable local-only.
93. E2E: after cooldown, recovery probe resumes sync and drains queued dirty fields in priority order.
94. Unit: `/reader/reset` storage clear preserves `power-reader-sync-quota-meta`.
95. Integration (Emulator): REST read/write against `pr_sync_v1/{site}/nodes/{syncNode}` succeeds for valid envelope.
96. Integration (Emulator): `list` attempts are denied by rules.
97. Integration (Emulator): invalid `site`/`syncNode` path patterns are denied.
98. Integration (Emulator): `read.value` map-size cap rejects >10k entries.
99. Integration (Emulator): `authorPrefs.value` map-size cap rejects >1k entries.
100. Integration (Emulator): missing required children (`read.clearEpoch`, `loadFrom.version`, etc.) are rejected.
101. Integration (Emulator): `currentDocument.updateTime` precondition conflict returns failure and retry path converges.
102. Integration (Emulator): successful write updates `updateTime`; subsequent conditional write with stale token fails.
103. Integration (Emulator): reset CAS loop (`max(local,remote)+1` / replay path) remains monotonic under precondition conflicts.
104. Integration (Emulator): required bounded `expiresAt` conversion to Firestore timestamp passes rules and unbounded/missing values are rejected.
105. Integration (Emulator): endpoint guard fails tests if host is not emulator/localhost.
106. Integration (Emulator): write requests use single-write `documents:commit` payload shape only.
107. Integration (Emulator): concurrent create-on-missing races converge via `exists=false` precondition + re-read fallback without dropping dirty fields.
108. Unit: bootstrap lock ownership token prevents non-owner unlock.
109. Unit: stale lock expiry path reclaims lock and proceeds safely.
110. Unit: `navigator.locks` path is preferred when available; localStorage fallback used otherwise.
111. Unit: pending reset unresolved state suppresses late pull-apply UI path.
112. Unit: when secret appears later, pending-reset replay executes before normal flush.
113. Unit: startup recovery marks syncable fields dirty when sync meta is missing/invalid/inconsistent.
114. Integration (Emulator): index-override deployment check validates non-indexed configuration for large dynamic maps.
115. Runbook drill: simulated abuse incident follows write-disable -> tighten -> recovery sequence without data loss.
116. Unit: Firestore typed-value serializer emits stable `mapValue`/`stringValue`/`integerValue`/`timestampValue` payloads and round-trips envelope fields.
117. Unit: `isCasConflict(error)` returns true for Firestore contention/precondition variants (for example `ABORTED`, `FAILED_PRECONDITION`) and false for non-conflict errors.
118. Unit: REST timeout path is retryable and always clears in-flight flush state in `finally`.
119. Unit: malformed commit response without usable `writeResults[0].updateTime` is treated as uncertain outcome and does not clear dirty flags.
120. Unit: if CAS retry re-read surfaces higher schema version, loop aborts and session enters read-only mode.
121. Unit: flush trigger while pull is in-flight is deferred/coalesced and runs once after pull completion.
122. Unit: `GET` `404 NOT_FOUND` missing-doc response is treated as empty remote envelope.
123. Unit: per-node non-reset write floor (5s) coalesces dirty writes instead of issuing faster commits.
124. Unit: cross-tab last-push key defers redundant same-device pushes inside write-floor window.
125. Integration (Emulator): rules reject missing `expiresAt`, past `expiresAt`, and `expiresAt` beyond configured max horizon.
126. E2E: long-lived `pendingRemoteReset` with unavailable secret surfaces stronger user hint while preserving local-only safety.
127. Unit: CAS token cache stores exact Firestore `updateTime` strings without Date parse/reformat and reuses them verbatim in preconditions.
128. Integration (Emulator): rules reject out-of-range `clearEpoch`/`version` values above configured max bounds.
129. E2E: missing/blocked `@connect firestore.googleapis.com` path surfaces `Sync blocked by userscript permissions/connectivity` status.
130. Unit: reset envelope writer always includes bounded `expiresAt` plus diagnostics fields (`lastPushedBy`, `lastPushedAt`/`lastPushedAtMs`).
131. Unit: dynamic key hygiene drops invalid/oversized keys before merge/write and logs diagnostics.
132. Unit: runtime commit guard rejects any payload that is not exactly one `update` write with `currentDocument` precondition.
133. Unit: REST error classifier maps `409 ALREADY_EXISTS` create race to re-read path and `400 INVALID_ARGUMENT` to fail-closed status path.
134. Unit: `expiresAt` derivation prefers server anchor time when available and uses client fallback only on first-write/no-anchor path.
135. Unit: REST error classifier maps Firestore `403 PERMISSION_DENIED` on commit to push-disabled session mode with visible status.

## 13. Rollout and Validation Checklist
- Confirm `currentUser.abTestOverrides` readable on LW and EAF in production.
- Confirm bootstrap mutation shape works on LW and EAF (`updateUser(selector, data)`).
- Confirm no legacy mutation adapter is required for bootstrap path on LW/EAF production endpoints.
- Confirm generated sync secret is random UUID and not equal to `_id`.
- Confirm bootstrap runs only when secret missing and not in steady-state.
- Confirm bootstrap mutation-response + verify read prevents split-node first flush across simultaneous tabs.
- Confirm `lastSyncNode` persists only after finalized secret and confirmed current-node validity (pull/push), not provisional derivation.
- Confirm `abTestOverrides.pr_sync_secret_v1` persists as a string value (no server-side numeric coercion).
- Confirm bootstrap write does not materially conflict with concurrent non-PowerReader `abTestOverrides` updates (accepted residual risk documented).
- Confirm Firestore project/database provisioning is correct: target project, Firestore Native mode, `(default)` database.
- Confirm Firestore rules/TTL are deployed to the correct target project/environment.
- Confirm Firestore billing alerts and quota alerts are configured before broad rollout.
- Confirm operational monitoring includes read/write rate alerts and document-count growth tracking for abuse detection.
- Confirm design assumption is documented: remaining global quota cannot be queried from client; behavior is error-driven.
- Confirm locked v3 simplification decisions remain intact (2-file sync architecture + single state machine, no `metaRevision`, no local per-key `authorPrefs` meta duplication, simplified loadFrom fallback, probe-only fallback node behavior).
- Confirm Firestore Emulator integration suite runs in CI and passes before live-site E2E gating.
- Confirm emulator tests load the same rules source used for production deployment.
- Confirm integration suite hard-fails if any test target resolves to production Firestore host.
- Confirm v3 auth posture is deployed as intended (unauthenticated capability-URL model with no `request.auth` requirement).
- Confirm transport path is wired correctly for REST (`documents`/`commit` endpoints via `GM_xmlhttpRequest`).
- Confirm REST requests include configured API key query parameter (`?key=...`) and rules still enforce security posture.
- Confirm missing/blocked userscript connect permission path surfaces explicit status (`Sync blocked by userscript permissions/connectivity`).
- Confirm Firestore rules compile/deploy successfully and `.size()` caps evaluate as intended.
- Confirm Firestore rules require bounded `expiresAt` (`request.time < expiresAt < request.time + horizon`) on writes.
- Confirm rules duration bound syntax uses unit-string form (`duration.value(15638400, 's')`).
- Confirm Firestore rules and client validation reject out-of-range `clearEpoch`/`version` values above configured max bounds.
- Confirm Firestore index overrides are deployed for `fields.read.value` and `fields.authorPrefs.value`.
- Confirm `currentDocument.updateTime` precondition semantics for the writer path.
- Confirm CAS token handling preserves exact server `updateTime` strings without parse/reformat precision loss.
- Confirm envelope `expiresAt`/diagnostics timestamp derivation prefers server anchors, with client fallback only when no server anchor exists yet.
- Confirm create-if-missing path uses `exists=false` precondition and race fallback behavior.
- Confirm writer enforces single-write `documents:commit` payload shape.
- Confirm runtime commit guard rejects non-single-write or non-update/precondition payload shapes.
- Confirm Firestore REST typed-value serialization/deserialization is used consistently (`mapValue`/`stringValue`/`integerValue`/`timestampValue`).
- Confirm missing-doc `GET` (`404 NOT_FOUND`) path is handled as empty remote envelope.
- Confirm repeated precondition failures trigger coalesced retry behavior (single in-flight flush, bounded conflict backoff).
- Confirm CAS conflict classifier handles Firestore contention/precondition variants (not single status-code assumption).
- Confirm REST error classifier maps `ALREADY_EXISTS` create races to re-read and `INVALID_ARGUMENT` to fail-closed status path.
- Confirm REST error classifier maps Firestore `PERMISSION_DENIED` (`403`) to fail-closed/push-disabled session behavior with clear status.
- Confirm request timeout behavior is bounded and in-flight flush state is always cleared in `finally`.
- Confirm malformed/empty commit responses without usable `writeResults[0].updateTime` are treated as uncertain outcomes (dirty flags preserved, retry path engaged).
- Confirm CAS retry loop aborts into read-only mode if higher unsupported schema is discovered mid-retry.
- Confirm `429` / `RESOURCE_EXHAUSTED` responses enter quota-limited mode (not generic network retry only).
- Confirm quota cooldown schedule (5m -> 15m -> 60m -> 6h max + jitter) is persisted and honored across reloads/tabs.
- Confirm merged envelope cap checks run after merge (including CAS retry merges), not just local pre-push.
- Confirm any additive envelope field change is paired with schemaVersion bump before rollout.
- Confirm reset route writes a remote cleared envelope (not delete) and stale devices do not reintroduce old reads.
- Confirm reset path uses CAS-protected clear write loop (no clear-epoch regression under concurrent writes).
- Confirm reset writes include fresh bounded `expiresAt` and standard diagnostics fields.
- Confirm reset remote-write failure keeps pending reset barriers in sync meta and retries clear before next pull.
- Confirm reset `STORAGE_KEYS` clear scope excludes sync-meta/device-id/sync-enabled/sync-quota-meta keys.
- Confirm pending-reset replay uses stored targets and remains idempotent across repeated retries/sessions.
- Confirm read-overflow guard triggers local read clear + `read.clearEpoch` propagation, without clearing author prefs.
- Confirm client-side dynamic-key hygiene enforces key length/charset bounds before merge/write.
- Confirm authorPrefs overflow compaction drops oldest `v:0` entries first, then oldest remaining only if necessary to satisfy cap.
- Confirm first sync init marks pre-existing local data dirty when sync meta is absent.
- Confirm user switch clears local synced fields and `lastSyncNode` before pull-first for new user.
- Confirm user switch also clears `pendingRemoteReset`/`pendingRemoteResetAt`/`pendingRemoteResetTargets` and resets runtime `updateTimeByNode` cache.
- Confirm fallback-node probe is blocked when `meta.lastUserId !== currentUser._id`.
- Confirm bootstrap lock and pull-coalescing paths degrade safely when localStorage is unavailable.
- Confirm bootstrap lock ownership token + expiry prevents deadlock after tab crash.
- Confirm `navigator.locks` primary path works and localStorage fallback remains correct.
- Confirm pull-on-focus updates on-page state from other devices without requiring reload.
- Confirm periodic pull coalescing prevents redundant same-device multi-tab pulls within interval window.
- Confirm flush triggers are deferred/coalesced while pull is in-flight, then run once after pull completion.
- Confirm non-reset writes respect global per-node write floor and coalesce bursts.
- Confirm best-effort cross-tab push coalescing (`pr-sync-last-push-at-*`) reduces same-device redundant pushes.
- Confirm cross-tab quota cooldown key prevents same-device retry stampedes.
- Confirm same-device concurrent bootstrap tabs converge on a single secret/node.
- Confirm `lastSyncNode` is only updated after current-node validity is confirmed (not after derivation alone).
- Confirm `pendingRemoteReset` blocks fallback-node probe until reset replay completes.
- Confirm `/reader/reset` suppresses/aborts in-flight flush attempts so stale payloads cannot land after reset.
- Confirm `clearEpoch` barrier comparisons are monotonic and independent of client clock skew.
- Confirm permission-denied `abTestOverrides` responses disable sync for session without retry storms.
- Confirm null `abTestOverrides` with field-level authorization error is treated as fail-closed, while null-without-error is treated as empty object.
- Confirm Firestore rules enforce map-size caps and required fixed-shape fields.
- Confirm Firestore rules accept `loadFrom` objects with no `value` child (clear-barrier-only state).
- Confirm `loadFrom.value` strings are bounded to sentinel/ISO-like pattern and explicit null is normalized to absent client-side.
- Confirm writes with optional `lastPushedAtMs` pass/fail according to numeric validation rule.
- Confirm commit-response `writeResults.updateTime` is parsed and surfaced correctly as diagnostics (`lastPushedAt` / `lastPushedAtMs`).
- Confirm Firestore rules deny `list` and restrict access to exact document paths.
- Confirm malformed dynamic `authorPrefs` entries are blocked/neutralized by validation path (rules + client checks).
- Confirm Firestore rules reject envelopes missing required children in `read`, `loadFrom`, or `authorPrefs` objects.
- Confirm reset with missing secret sets `pendingRemoteReset` and prevents remote resurrection on next session.
- Confirm unresolved `pendingRemoteReset` suppresses late pull-apply UI behavior.
- Confirm secret-available-later flow runs reset replay before normal writes.
- Confirm long-lived pending-reset + missing-secret condition surfaces stronger user hint (not silent indefinite pending state).
- Confirm server-time diagnostics (`lastPushedAtMs`) remain non-authoritative and merge logic stays epoch/version driven.
- Confirm Firestore document size remains below 1 MiB under cap pressure.
- Confirm field-path and index-entry headroom remain within budget under configured caps.
- Confirm observed write cadence stays below practical per-document sustained write guidance.
- Confirm required TTL policy behavior is acceptable with eventual (~24h) deletion lag.
- Confirm provider-side monitoring/quotas are in place for unauthenticated random-node write abuse.
- Confirm quota and abuse limits for heavy readers; verify free-tier sufficiency for expected active users.
- Confirm local self-budget thresholds (soft/hard daily push limits) reduce single-user quota pressure as intended.
- Confirm hidden/idle gating suspends non-critical sync activity without data loss.
- Confirm quota-limited and local-budget-limited UI states render with retry ETA.
- Confirm recovery probe and ramp-up behavior avoid immediate post-recovery write bursts.
- Confirm userscript metadata includes `firestore.googleapis.com` in `@connect`.
- Confirm API key posture in userscript context is validated (including referrer-restriction behavior under `GM_xmlhttpRequest`).
- Confirm REST calls work from userscript context (`GM_xmlhttpRequest` connectivity/CORS posture).
- Confirm `vite.config.ts` emits matching connect metadata.
- Confirm incident runbook steps are documented and practiced (temporary write disable, cap tighten, key rotation, TTL adjust, recovery).

## 14. Firestore Reference Links
- Firestore Rules `Map.size()` and related map/list APIs: <https://firebase.google.com/docs/reference/rules/rules.Map>
- Firestore security rules for structuring/allowlisting fields: <https://firebase.google.com/docs/firestore/security/rules-fields>
- Firestore TTL policies: <https://firebase.google.com/docs/firestore/ttl>
- Firestore REST API usage and auth: <https://firebase.google.com/docs/firestore/use-rest-api>
- Firestore quotas and limits (including document size): <https://firebase.google.com/docs/firestore/enterprise/quotas-native-mode>
- Firestore REST precondition reference (`updateTime`, `exists`): <https://firebase.google.com/docs/firestore/reference/rest/v1beta1/Precondition>
- Firestore single-document write-rate guidance discussion: <https://groups.google.com/g/firebase-talk/c/sXmPclfystk>
