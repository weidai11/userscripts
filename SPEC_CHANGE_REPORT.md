# SPEC Change Implementation Report

**Date**: 2026-02-09
**Old SPEC**: `archive/SPEC_old.md`
**New SPEC**: `src/scripts/power-reader/SPEC.md`

## Changes Implemented

### 1. [PR-LOAD-01.1] Initial `loadFrom` Snapshot (NEW)
- **File**: `main.ts`
- After initial fetch, `loadFrom` is set to the oldest fetched comment's date.
- Also captures `initialBatchNewestDate` on `state` for session advancement.

### 2. [PR-LOAD-03] `moreCommentsAvailable` Semantics Fix
- **File**: `services/loader.ts`
- Previously: `allComments.length >= loadMax || batchPosts.length >= loadMax` (posts incorrectly included).
- Now: Only `allComments.length >= CONFIG.loadMax`, and forced `false` for `__LOAD_RECENT__` mode.

### 3. [PR-LOAD-04] Comment Ordering: Newest-First Within Post Groups
- **Files**: `render/post.ts`, `state.ts`
- Root comments and child comments now sorted newest-first (was oldest-first).

### 4. [PR-LOAD-02] Enrichment Post Date Range Clarification
- **File**: `services/loader.ts`
- Fixed `__LOAD_RECENT__` lower bound to use oldest comment date.
- `endDate` (upper bound) uses newest comment date when `moreCommentsAvailable`.
- Both are derived from comment batch timestamps, not `loadFrom` updates.

### 5. [PR-NEST-04.1/04.2] Multi-Level Placeholder Parent Chain
- **File**: `render/post.ts`
- `withMissingParentPlaceholders` now walks the nested `parentComment` chain (up to 5 levels from GraphQL query) to create a multi-level chain of placeholders with correct linking.
- Depth is limited by the query nesting depth (currently 5 levels).

### 6. [PR-GQL-03] `GET_NEW_POSTS_FULL` Query Added
- **File**: `shared/graphql/queries.ts`
- New query with `htmlBody` and `contents { markdown }` for fetching posts with full body fields.
- Not yet wired into enrichment (enrichment continues to use `GET_NEW_POSTS_LITE` for batch fetching; full bodies load on-demand per existing behavior).

### 7. [PR-READ-03/PR-LOAD-16] Session Advancement Uses Initial Batch Newest
- **Files**: `services/ReadTracker.ts`, `features/scrollTracking.ts`, `render/index.ts`, `state.ts`
- Session advancement now uses the newest comment from the initial comments batch (excluding smart-load and user-triggered loads), per the new spec.

### 8. Smart Loading Docstring Fix
- **File**: `services/loader.ts`
- Updated docstring threshold from "(5+)" to "(3+)" to match actual code (threshold was already 3).

## Pre-Existing Issues Fixed

### A. `Comment.parentComment` type now recursive (**FIXED**)
- **File**: `shared/graphql/queries.ts`
- Added `ParentCommentRef` recursive type; `Comment.parentComment` now typed as `ParentCommentRef | null` matching the 5-level nested GraphQL query.

### B. ~~GET_NEW_POSTS_LITE fields~~ — Not an issue (removed from report).

### C. Wrong generated type imports (**FIXED**)
- **File**: `services/loader.ts`
- `GetNewPostsQuery`/`GetNewPostsQueryVariables` did not exist in codegen output. Fixed to use `GetNewPostsLiteQuery`/`GetNewPostsLiteQueryVariables`.

### D. Unused imports in `services/loader.ts` (**FIXED**)
- Removed unused `GET_COMMENTS_BY_IDS`, `GetCommentsByIdsQuery`, `GetCommentsByIdsQueryVariables`.

### E. `parentIdsToFetch` unused variable (**FIXED**)
- Removed leftover variable from `runSmartLoading`.

## Remaining Pre-Existing Type Errors (Not From Our Changes)

### F. `VoteResponse` type mismatch in `voting.ts`
- `VoteResponse.document` expects full `Comment` but the vote mutation only returns partial fields. Pre-existing, not related to SPEC changes.

### G. Nullable mismatches in `preview.ts`
- `htmlBody` and `post.htmlBody` can be `null | undefined` but are passed to functions expecting `string`. Pre-existing.
