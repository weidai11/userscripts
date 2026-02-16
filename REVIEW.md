# Internal Review Playbook (LessWrong Userscripts)

This document defines the minimum standard for internal review before external review.
Primary goal: catch functional regressions early, especially in `power-reader`.

## Review Priorities

1. Correctness and user-visible behavior
2. Regression risk in existing workflows
3. Integration contracts (state, call signatures, imports)
4. Platform safety (Windows included)

Code style and refactors are secondary unless they increase regression risk.

## Severity Rubric

- `P0`: Data loss, security issue, or unrecoverable breakage
- `P1`: Core workflow broken for normal users
- `P2`: Significant behavior regression with workaround
- `P3`: Tooling/type/maintainability issue without immediate runtime breakage

Do not mark "ready" with unresolved `P0`/`P1` findings.

## Mandatory Review Flow

### 1) Scope and Risk

- [ ] List touched user workflows (auth, archive, voting, reactions, sorting, pagination)
- [ ] Identify cross-cutting concerns (state persistence, session state, navigation)

### 2) Changeset Sanity

- [ ] Run `jj st` and `jj diff`
- [ ] Confirm every changed file is intentional
- [ ] Check for accidental artifacts/debug files
- [ ] Reject reserved Windows names: `CON`, `PRN`, `AUX`, `NUL`, `COM1-9`, `LPT1-9`

### 3) Contract Audit

- [ ] If state shape changed, verify all required fields are initialized
- [ ] If function signature changed, verify all call sites
- [ ] If imports changed, verify paths resolve correctly

### 4) Workflow Verification

- [ ] Validate affected end-to-end flows manually or via tests
- [ ] Confirm behavior remains stable across transitions (sort, paginate, rerender, route change)

### 5) Evidence and Verdict

- [ ] Write findings with severity, impact, repro, expected behavior
- [ ] Record what was executed (commands/tests)
- [ ] State explicit verdict: `Ready` or `Not ready`

## High-Risk Invariants (From Recent Misses)

### Auth-State Completeness

- Logged-in state must populate both `currentUserId` and `currentUsername`
- Auth-gated actions must behave as logged-in when session is valid

Reviewer checks:
- [ ] Trace guards used by event handlers (`!!state.currentUserId`, etc.)
- [ ] Verify initialization path sets all required auth fields

### Sort Persistence Through Pagination

- User-selected sort must survive "Load More"
- No silent fallback to default sort during rerender/update paths

Reviewer checks:
- [ ] Compare initial render arguments vs update/load-more arguments
- [ ] Ensure `sortBy` (or equivalent) is passed consistently

### Signature Changes Need Full Call-Site Coverage

Reviewer checks:
- [ ] Find all references for changed functions
- [ ] Confirm each call site passes appropriate args

### Import Path Integrity

Reviewer checks:
- [ ] Verify relative path depth after file moves/refactors
- [ ] Confirm with "Go to Definition" or TypeScript compile

### Windows Safety

Reviewer checks:
- [ ] No reserved device-name files in repo
- [ ] No case-only rename assumptions without validation

## Flake vs Real-Bug Triage

- Fails consistently in isolated run: treat as real bug
- Fails only in parallel: investigate isolation/race; do not auto-dismiss
- Missing state/import/type errors: treat as real bug until disproven
- Timeouts: ambiguous; inspect logs and rerun targeted tests

## Minimum Evidence Required for Internal Sign-Off

- [ ] Commands run and pass/fail summary
- [ ] Manual scenarios tested for touched workflows
- [ ] Known gaps or assumptions explicitly documented
- [ ] Intentional behavior changes called out clearly

## Review Output Template

Use this structure in internal notes (`tmp/review.md`):

### Findings

- `[P1] Title - path:line`
- Impact:
- Repro:
- Expected:
- Suggested fix:

### Open Questions / Assumptions

- List unknowns that could change severity or scope

### Validation Performed

- Commands run:
- Manual scenarios:

### Verdict

- `Ready` or `Not ready` with rationale

## Useful Commands (PowerShell)

- `jj st`
- `jj diff`
- `rg "renderArchiveFeed\\(" src\\scripts\\power-reader`
- `rg "currentUserId|currentUsername" src\\scripts\\power-reader`
- `rg "\\.\\./\\.\\./shared/graphql/queries|\\.\\./\\.\\./\\.\\./shared/graphql/queries" src\\scripts\\power-reader`
- `npm run test:power-reader`
- `npx playwright test`
