# LW Power Reader - Detailed Specification

## Overview

LW Power Reader is a userscript that provides an enhanced interface for reading recent comments on LessWrong (and potentially EA Forum). It replaces the native `/reader` page with a custom UI optimized for high-volume comment consumption.

> **CRITICAL ENFORCEMENT POLICY**: Never remove or downgrade a feature described in this document without explicit USER approval. If any discrepancy is observed between this SPEC and the code, either warn the USER immediately or fix the code to match the SPEC, depending on severity and impact on the user experience.
> **TAG NOTE**: Spec tag numbers do **not** have to be consecutive. Prioritize keeping existing tag IDs stable because tests use these tags to verify coverage.

## Target URLs

- **[PR-URL-01]** `https://www.lesswrong.com/reader` - Main reader interface
- **[PR-URL-02]** `https://www.lesswrong.com/reader/reset` - Clear all storage and show setup UI
- **[PR-URL-03]** `https://forum.effectivealtruism.org/reader`

**Route Behavior:**
- **[PR-URL-04]** `/reader` - If `loadFrom` is set, load comments from that date. If empty, show setup UI.
- **[PR-URL-05]** `/reader/reset` - Clear all persisted state (read dict, loadFrom, author prefs) and redirect to `/reader` to show setup UI.

---

## Core Architecture

### Page Takeover Strategy ("Nuclear Option")

**[PR-ARCH-01]** Since LessWrong is a React-heavy SPA, the userscript must completely take over the page to prevent conflicts:

1. **[PR-ARCH-02]** **Run at `document-start`** - Execute before any site scripts load
2. **[PR-ARCH-03]** **`window.stop()`** - Halt all pending resource loading
3. **[PR-ARCH-04]** **Script blocking** - MutationObserver removes any dynamically added `<script>` elements
4. **[PR-ARCH-05]** **DOM replacement** - Clear `document.documentElement.innerHTML` and inject custom UI
5. **[PR-ARCH-06]** **Protection observer** - Re-inject UI if site code attempts to clear it

### Data Source

- **[PR-DATA-01]** **API**: LessWrong GraphQL endpoint (`/graphql`)
- **[PR-DATA-02]** **Transport**: `GM_xmlhttpRequest` for cross-origin requests

---

## Features

### 1. Content Loading (Comments & Posts)

| Parameter | Value | Notes |
|-----------|-------|-------|
| Default load count | 800 max | Configurable via `loadMax` |
| Load method | Range-Bound Sequential Fetch | Fetches comments first, then posts in same window |
| Starting point | `loadFrom` datetime | Persisted ISO date string |
| Processing | Unified Stream | Merges posts and comments into post-centric groups |

**[PR-POST-01]** **Post Header Layout**:
- **Author Preference Arrows**: `↓` / `↑` for quick liking/disliking of authors.
- **Metadata**: Author name (clickable link to profile), timestamp (link to original post).
- **Vote Controls**: Karma and agreement vote buttons.
- **Action Buttons**: `[e]` (expand), `[a]` (load all), `[c]` (scroll to comments), `[n]` (next post).
- **Structural Toggles**: `[−]` (collapse), `[+]` (expand).

**Data Flow:**

1. **[PR-LOAD-01]** **Initial Fetch**: User info, comments, and current user data are fetched in parallel.
   - Comments use `allRecentComments` view.
   - If `loadFrom` is set: use `sortBy: "oldest"` to load forward.
   - If `loadFrom` is `__LOAD_RECENT__`: use `sortBy: "newest"` to get the latest batch.
   - **[PR-LOAD-01.1]** **Initial `loadFrom` Snapshot**: Immediately after the initial comments batch is fetched, set `loadFrom` to the datetime of the **oldest fetched comment**. This ensures that if the user leaves before reaching the bottom and later returns, the same comment window is loaded again.
2. **[PR-LOAD-02]** **Content Enrichment**: Before rendering, additional data is fetched:
   - **Post Bodies**: Full post content for the post batch is fetched via GraphQL (`new` selector), including body fields (`htmlBody`/`contents`).
   - **Header-Only Exception**: Full bodies are fetched only for posts in the **current post window**; header-only posts are created only for out-of-window posts referenced by comments and their bodies load on-demand.
   - **Post Batch Ordering**: The server currently returns the `new` post batch **newest-first**.
   - **Post Date Range**: Posts are fetched to match the date window of the fetched comments.
     - If `moreCommentsAvailable` is **true** (comments hit `loadMax`), fetch posts from `loadFrom` up to the **newest fetched comment**.
     - If `moreCommentsAvailable` is **false**, fetch **all posts newer than the oldest fetched comment** (open-ended to "now").
     - If `loadFrom` is `__LOAD_RECENT__`, treat the lower bound as the **oldest fetched comment** (the sentinel is not a real timestamp).
   - **Ordering Detail**: The post date window is derived from the **comment batch timestamps** (oldest/newest) captured for this load, not from any later `loadFrom` updates.
   - **Parent Placeholder Chain**: Comments include nested `parentComment` fields (multi-level), which are used to build a chain of parent placeholders with IDs (no extra fetch required in this phase).
   - **Subscriptions**: Author favor/subscription lists.
3. **[PR-LOAD-03]** **Single Render**: UI renders once with all data available. Status messages update in the header during loading phases.
   - **`moreCommentsAvailable`**: Set true **only** when the comments batch hits `loadMax`, indicating the server likely has more comments in this window. This flag shows the warning banner and can gate smart loading.
   - **`__LOAD_RECENT__` Mode**: When `loadFrom` is `__LOAD_RECENT__`, set `moreCommentsAvailable = false` to avoid paging in recent-mode.
4. **[PR-LOAD-04]** Items in the feed (posts and comment groups) are sorted by **Tree-Karma** descending (see Section 25).
   - Tie-breaker: Use `postedAt` (newest-first).
5. **[PR-LOAD-05]** Track read state locally with `{ [itemId]: 1 }` dictionary.

6. **[PR-LOAD-06]** **Smart Loading (Reply-Focused Heuristic)**:
   - **Deferred Phase**: Smart loading runs **after enrichment but before the initial render**, as a separate phase.
   - **Gating**: Skip smart loading unless `moreCommentsAvailable` is true (or a test override forces it).
   - **Reply-Focused Strategy**:
     - **Very High Activity Threads** (>= 3 unread comments with missing children in the same thread): Fetches the **full thread** (`GET_THREAD_COMMENTS`).
     - **All other unread comments with missing children**: Fetches **direct replies** only for each unread comment that has descendants.
     - **Missing Children Check**: Uses `directChildrenCount` vs loaded children count to detect missing descendants.
   - **Parent Context**: Missing parents are represented by placeholders; full parent loading happens on-demand via `[t]` or `[^]`.
   - **Parallel Fetching**: Thread and reply fetches run concurrently.

**First-Time Setup Flow:**

**[PR-SETUP-01]** On first use (or after `/reader/reset`), display a setup prompt with:
- **[PR-SETUP-02]** A **calendar date picker** to select `loadFrom` date
- **[PR-SETUP-03]** If left empty/confirmed without selection: load most recent 800 comments
- **[PR-SETUP-04]** Otherwise, selected date is stored in `loadFrom` as ISO 8601 string (start of day in user's timezone)

**Continuation/Pagination:**

- **[PR-LOAD-09]** When user scrolls to bottom of page, update `loadFrom` to the ISO timestamp of the **newest comment from the initial comments batch** + 1ms (excluding smart-load and user-triggered loads).
- **[PR-LOAD-10]** Store via `GM_setValue('power-reader-read-from', isoDateString)`
- **[PR-LOAD-11]** When `moreCommentsAvailable` is true (comments batch hit `loadMax`), show warning: "There are more comments available. Please reload after reading current comments to continue."

### 2. Post & Comment Threading

Items are organized post-centrically:
1. **[PR-THREAD-01]** Comments are grouped under their parent Post. If a comment's post was not in the `posts` fetch, a minimalist post header is still created.
2. **[PR-THREAD-02]** Post-Comment Integrity: Comments always render under their associated post regardless of fetch order.

**Post Display:**
- **[PR-POST-02]** **Unified Metadata**: Posts now use the same one-line metadata layout as comments (Author, Score, Reactions, Timestamp).
- **[PR-POST-03]** **Header-Only Definition**: Header-only posts are created when a comment carries a post reference **outside the current post load window**; they exist only to anchor comments.
- **[PR-POST-06]** **Conditional Controls**: Voting buttons are hidden for header-only posts or collapsed views to prevent voting before content is loaded, but the **karma score and agreement score MUST remain visible**.
- **[PR-POST-07]** **Inline Loading**: Clicking the title of a header-only post (`data-action="load-post"`) fetches the content via GraphQL and replaces the header with a full post render inside the current feed.
- **[PR-POST-04]** **Truncation**: Posts taller than `50vh` are truncated with a "Read More" button and gradient overlay.
- **[PR-POST-05]** **Expansion**: "Read More" expands the post to full height in-place.
- **[PR-POST-11]** **Smart Truncation Handling**: If a post is technically "truncated" (has the class) but its content fits within the allotted height, the "Read More" overlay MUST be hidden automatically, and the `[e]` button disabled with a descriptive tooltip.

**Read Tracking for Posts:**
- **[PR-POST-08]** **Body-Centric Marking**: Posts are marked as read when the bottom of their **body content** (`.pr-post-content`) is scrolled past, rather than the entire post-plus-comments container. If the body is collapsed or missing (header-only), the **header** bottom is used as the threshold instead.
- **[PR-POST-09]** **Read Style**: Greyed out title and body opacity reduced to 0.8.
- **[PR-POST-10]** **Counter**: Included in the "Unread Items" count in the status bar.
- **[PR-POST-12]** **Fully Read Filter**: If a post is marked as "read" (explicitly or via timestamp) AND it has no unread comments, it MUST NOT be rendered. This keeps the feed clean of fully consumed threads.

### 3. Comment Threading (Nested)

Comments under a post are organized hierarchically:

**Collapse behavior:**
- **[PR-NEST-01]** `[−]` button to **recursively collapse** an item and all its children. Collapsing any item MUST reveal a `[+]` (Expand) button, regardless of whether that item has children.
- **[PR-NEST-02]** **Post Collapse**: Collapsing a post hides both the **post body** (`.pr-post-content`) and all associated **comments**.
- **[PR-NEST-03]** Hover over `[+]` or a collapsed placeholder to preview content.
- **[PR-NEST-05]** **Interactive Thread Lines**: The left border of comment replies (`.pr-replies`) acts as a recursive toggle. Clicking the indentation line (or its 24px hit area) toggles the `collapsed` state of the parent comment. The line MUST darken and show a subtle background highlight on hover to indicate interactivity.

#### **Placeholder Logic**
- **[PR-NEST-04]** **Missing Parent Placeholders**: If a loaded comment references a parent comment that is not loaded, render an **empty placeholder comment** (no header or body) with a **read-style border**. This check must be re-applied any time comments are loaded or re-rendered.
- **[PR-NEST-04.1]** **Parent Chain via Nested Fields**: Use the nested `parentComment` fields returned by the server to build a chain of placeholder parents with correct IDs (multi-level), without additional fetches.
- **[PR-NEST-04.2]** **Depth Limit**: The placeholder chain only extends as far as the nested `parentComment` fields in the query; deeper parents require on-demand fetch via `[t]` or `[^]`.
- **Thread Integrity With Placeholders**: Thread structure must remain correct whether or not placeholders exist. Replies should nest under their true parent if loaded, or under the placeholder if the parent is missing.
- **[PR-NEST-06]** **Ancestor Continuity**: The rendering system MUST preserve the **full ancestor chain** in the DOM for every unread or context comment, even if those ancestors are marked as "read". This prevents broken threads and ensures that "Trace to Root" can always reach the top without forced server re-fetches for already loaded data.

### 4. Parent Navigation

- **[PR-NAV-01]** `[^]` button next to each comment. Always present, including for top-level comments.
- **Hover**: 
  - **Highlighing & Previews**: 
  - **[PR-NAV-02]** **Highlighting**:
    - **[PR-NAV-02.1]** **Comments**: If the parent is a comment and it exists in the DOM, applying the highlight (`.pr-parent-hover`, `#ffe066`) to the comment element (`.pr-comment`).
    - **[PR-NAV-02.2]** **Posts**: If the parent is a post, the highlight applies to **both** the post header (`.pr-post-header`) and the post body (`.pr-post-body-container`) if loaded.
    - **[PR-NAV-02.3]** **Sticky Sync**: If the sticky header is visible for the target post, it must **also** receive the highlight simultaneously with the main content.
    - **[PR-NAV-02.4]** **General Rule**: The highlight applies **regardless of visibility** and takes precedence over score and recency colors.
  - **[PR-NAV-03]** **Sample-Based Visibility**: Visibility detection for parent navigation MUST use `document.elementFromPoint()` to verify if the target is actually reachable/visible to the user, correctly accounting for overlaps from the Sticky Header, AI Box, or other floating UI without hardcoded offsets.
  - **[PR-NAV-04]** If the target is **obscured or partially off-screen** (the sample check fails), the preview popup is shown.
  - **[PR-NAV-05]** Targets inside the **sticky header** are considered partially visible (header only) and thus trigger a preview for the full content.
  - **[PR-NAV-09]** **Previewing**: If the target is off-screen, partially hidden, collapsed, or its content is not yet loaded ("unloaded"), it shows a preview popup instead.
- **Click**: Scrolls to parent comment or the Post Header. 
  - **[PR-NAV-06]** **Smart Scroll**: Post parents scroll to the top of the viewport (`block: 'start'`). Comment parents scroll to just below the **Sticky Header** of the destination post (accounting for its dynamic height).
  - **[PR-NAV-07]** **Highlight**: Provides a temporary animated flash highlight (`.pr-highlight-parent`).
  - **[PR-NAV-08]** **Deep Loading**: If a parent comment is not present in the current feed, clicking `[^]` fetches it from the server and injects it into the post group as context.
  - **[PR-NAV-10]** **Post-Rerender Event Reattachment**: After a post group is re-rendered (e.g., due to deep loading), hover previews and parent highlighting must be re-initialized on the new DOM elements.
- **[PR-NAV-11]** **Automatic Expansion**: When navigating via `[^]` (Find Parent) or `[t]` (Trace to Root), if any ancestors (including the target) are currently rendered as "read placeholders", the system MUST automatically mark them as `forceVisible` and re-render the post group to expand them. This provides the user with the full context of the thread they navigated to.

### 5. Read State Tracking

**Storage**: `GM_setValue` / `GM_getValue` (persisted across sessions)

- **Marking logic**:
- **[PR-READ-01]** **Item-Centric Threshold**: Items are marked read when their specific **content body** is scrolled past, rather than their entire bounding box (which might include long nested subthreads).
    - **Posts**: Marked when the bottom of `.pr-post-content` is passed. (See `[PR-POST-08]`).
    - **Comments**: Marked when the bottom of `.pr-comment-body` is passed. If a comment is collapsed, the bottom of the `.pr-comment-meta` (header) is used as the threshold.
- **[PR-READ-01.1]** **Marking logic**: (Legacy) Mark as read if the calculated threshold is above the viewport top.
- **[PR-READ-02]** **Bottom of Page Logic**: If the user reaches the absolute bottom of the document (`window.innerHeight + window.scrollY >= document.body.offsetHeight`), all currently visible unread comments become eligible for read-marking (using the same delay as the normal scroll-past threshold).
- **[PR-READ-03]** **Session Advancement**: When the "Bottom of Page" condition is met, update the stored `loadFrom` value to the ISO timestamp of the **newest comment from the initial comments batch PLUS 1 millisecond** (excluding smart-load and user-triggered loads). Advancement triggers unconditionally at bottom-of-page (no additional check on unread count).
- **[PR-READ-04]** **5-second delay** before marking - uses `setTimeout` to avoid marking during fast scrolling.
- **[PR-READ-05]** **Unread Persistence**: On page refresh, only unread items are shown with full content. Read comments with fewer than 2 unread descendants are collapsed into minimal placeholder bars (preserving thread structure context); read comments with 2+ unread descendants are rendered in full with greyed-out styling. Placeholders can be expanded on click, **or automatically when navigated to via `[^]` or `[t]`.**
- **[PR-READ-06]** **Cleanup**: During session advancement (bottom-of-page processing), read IDs with `postedAt` older than the new `loadFrom` are removed. IDs not found in the current loaded set are also removed (orphaned).
- **[PR-READ-07]** **Implicit Read State (Temporal Boundary)**: Any item (Post or Comment) with a `postedAt` timestamp older than the current `loadFrom` value is treated as **Read** by default, even if its ID is not present in the explicit `readState` storage. This ensures that old posts anchoring new comments are correctly greyed out and excluded from unread counts.

### 6. Author Information & Preferences

**[PR-AUTH-03]** **Full Name Display**: Authors are now displayed using their `displayName` (full name) instead of their `username` (short name/handle) whenever available.
**[PR-AUTH-04]** **Profile Links**: Author names are clickable links that open the user's profile (`/users/slug`) in a new tab.
**[PR-AUTH-09]** **Hover Previews**: Hovering over an author's name shows a preview popup containing:
- Display Name and Username
- Total Karma
- HTML Bio/Description (excerpt)

Users can also mark authors as favored or disfavored:

| Action | UI | Effect |
|--------|-----|--------|
| **[PR-AUTH-01]** Favor | Click `[↑]` next to author | Comments highlighted (e.g., green tint) |
| **[PR-AUTH-02]** Disfavor | Click `[↓]` next to author | Comments de-emphasized or hidden |

### 7. Visual Indicators

#### Color Coding

| Indicator | Color | Meaning |
|-----------|-------|---------|
| **[PR-VIS-01]** Comment points | Pink gradient | Higher normalized score = more pink header |
| **[PR-VIS-02]** Post points | Purple gradient | Higher normalized score = more purple header |
| **[PR-VIS-03]** Recency | Yellow gradient | More recent comments = more yellow body |
| **[PR-VIS-04]** Replies to you | Green border | Comments replying to you (2px unread, 1px read) |
| **[PR-VIS-05]** Read items | Grey text | Already viewed posts or comments |
| **[PR-VIS-06]** Normal items | Black border | Default state |
| **[PR-VIS-07]** Rejected/Junk | Thin red border | Moderated or rejected comments; **collapsed by default** |

#### 7.2 Content Formatting

- **[PR-VIS-08]** **Blockquotes**: Stylized with a distinct left border (`solid 3px #e0e0e0`).
- **[PR-VIS-09]** **Footnotes**: Footnote back-links (`^`) and content display **inline**.

#### Normalization Algorithm

**Baseline**: karma at author's voting power = no color (neutral).

**[PR-VIS-11]** Age-based expected points threshold:
```javascript
const base = 5 + 2 * Math.sqrt(ageHours);
pub = isPost ? base * 6.7 : base;
```

**[PR-VIS-12]** Normalized score calculation:
```javascript
normalized = (points - plb) / (pub - plb);
if (authorPreferences[author]) 
    normalized += authorPreferences[author] * 0.52;
```

**[PR-VIS-13]** Auto-hide threshold:
```javascript
if (normalized < -0.51) HideItem(x);
```

#### Dynamic Font Size

- **[PR-VIS-10]** Higher karma comments and posts get larger header font (up to 150%).
- **[PR-VIS-14]** **Unified Utility Buttons**: All text-based right-side buttons (`[e]`, `[a]`, `[^]`, etc.) use a unified `.text-btn` class with a constant **13px** font size and specific opacities: 0.8 (enabled), 1.0 (hover), 0.15 (disabled).
- **[PR-VIS-15]** **Reaction Scaling**: Unlike control buttons, reaction icons and chips MUST use relative units (`em`) to scale proportionally with the dynamic font size of the parent item.

### 8. Date/Time Display

- **[PR-DATE-01]** Convert all timestamps from UTC to user's local timezone.
- **[PR-DATE-02]** **Click on timestamp**: Always opens the original item permalink in a new tab.

---

### 11. Link Behavior

- **[PR-LINK-01]** All external links automatically get `target="_blank"`.
- **[PR-LINK-02]** Internal anchor links (`#...`) are preserved for in-page navigation.
- **[PR-LINK-03]** Links to `/reader` are kept as same-tab navigation.

---

### 12. Sticky Post Header

- **[PR-STICKY-01]** When the post header scrolls above viewport but comments are visible, a sticky header appears.
- **[PR-STICKY-02]** Only one sticky header shows at a time.
- **[PR-STICKY-03]** Sticky header matches the style of the original header.
- **[PR-STICKY-04]** **Post Navigation**: Clicking the title or empty areas in the sticky header scrolls the page back to the original post header.
- **[PR-STICKY-05]** **Hover on title or header**: Shows a preview of the post content (since body content is usually not visible in sticky mode).
- **[PR-STICKY-06]** **External Navigation**: Click the **date/timestamp** to open the post page in a new tab.
- **[PR-STICKY-07]** **Collapse/Expand**: Buttons synchronize state with original comments.
- **[PR-STICKY-08]** **Interactive Elements**: Voting buttons, reaction chips, and other interactive elements in the sticky header work normally without triggering the scroll-to-original-post behavior.

---

### 21. Post Header Action Buttons

Action buttons are displayed in the post header (both sticky and regular), positioned to the **left** of the existing collapse `[−]`/`[+]` buttons.

**[PR-POSTBTN-01]** **Load/Expand Post Body** (`[e]`):
- If the post body is **not yet loaded** (header-only post):
  - Fetches the full post content from the server.
  - Renders the post body in expanded mode.
  - Button shows `[...]` while loading.
- If the post body is **already loaded**:
  - Toggles between **truncated** (50vh max-height with gradient overlay) and **fully expanded** (no truncation).
- **Disabled State**: Disabled (0.15 opacity, no hover) if the post body is fully loaded AND its actual content height is less than the truncation threshold (fits within viewport without truncation). This is verified via precise DOM measurement (`scrollHeight` vs `offsetHeight`).
- **Tooltip**: "Expand/collapse or load post body" (active); "Post fits within viewport without truncation" (disabled).
- **Sticky Header Override**: If clicked from the **sticky header**, this action also scrolls the viewport back to the original post header. Regular post header buttons do not trigger a scroll.

**[PR-POSTBTN-06]** **Header Toggle Shortcut**:
- Clicking the **post title** or the **background** of a regular post header while it is already positioned at the top of the viewport (within 5px) triggers the `[e]` (Expansion) action. 

**[PR-POSTBTN-02]** **Load All Comments** (`[a]`):
*   Fetches **all** comments for this post from the server using the `postCommentsNew` GraphQL view.
*   Merges fetched comments into the current state.
*   Re-renders the post group in place.
*   Button shows `[...]` while loading.
*   **Disabled State**: Disabled if all comments (per `post.commentCount`) are already loaded in state.
*   **Tooltip**: "Load all X comments for this post" (active); "All X comments already loaded" (disabled).

**[PR-POSTBTN-03]** **Scroll to First Comment** (`[c]`):
*   Scrolls the page so the first comment is at the top (accounting for sticky headers).
*   **Disabled State**: Disabled if `post.commentCount === 0`.
*   **Tooltip**: "Scroll to first comment" (active); "No comments to scroll to" (disabled).

**[PR-POSTBTN-04]** **Scroll to Next Post** (`[n]`):
*   Scrolls the page to the header of the next available post group in the rendered DOM order.
*   **Disabled State**: Disabled if this is the last post in the current feed.
*   **Tooltip**: "Scroll to next post" (active); "No more posts in current feed" (disabled).

**[PR-POSTBTN-05]** **Collapse/Expand Post** (`[−]`/`[+]`):
- Toggles the visibility of the post body and its comments.
- **Sticky Header Override**: If clicked from the **sticky header**, this action also scrolls the viewport back to the original post header. Regular post header buttons do not trigger a scroll. This prevents the user from being stranded in an empty scroll area after collapsing a long thread.

**[PR-POSTBTN-07]** **Send to AI Studio** (`[g]`):
*   Triggers the Google AI Studio integration for this post.
*   Identical to the `g` shortkey action.
*   **Shift Modifier**: Holding **Shift** while clicking or pressing **`G`** (Shift+g) includes all unread **descendants** of the target in the XML payload.
*   **Tooltip**: "Send thread to AI Studio (Shortkey: g, Shift-G to include descendants)".

**Button Rendering:**
*   Buttons appear in this order (left to right): `[g]` `[e]` `[a]` `[c]` `[n]` ... `[−]`/`[+]`
*   Sticky header mirrors these buttons.
*   Disabled buttons use low opacity and `cursor: not-allowed`.

---

### 22. Comment Header Action Buttons

Action buttons are displayed in the comment header's `.pr-comment-controls` span, positioned to the **left** of the existing `[−]`/`[+]`/`[^]` buttons.

**[PR-CMTBTN-01]** **Load Replies** (`[r]`):
- Fetches all descendants of the current comment (replaces old "Load All Descendants").
- Uses `commentReplies` view recursively or full thread fetch logic.
- Merges fetched comments into state.
- Re-renders the post group.
- **Hiding Rule**: Hidden if the comment has 0 children OR if all its children are already loaded in state.

**[PR-CMTBTN-02]** **Load Parents & Scroll** (`[t]`):
- **Combined Action**: "Trace to Root".
- **Primary Function**: Scrolls to the top-level ancestor (Root) of the thread.
- **Data Loading**: If the top-level ancestor (or any intermediate parent) is missing from the state, it **recursively fetches** the missing parents from the server before scrolling.
- **Viewport**: After loading/scrolling, flashes the root comment with `.pr-highlight-parent`.
- **Hiding Rule**: Hidden if the comment is already at the top level (no parent).

**[PR-CMTBTN-03]** **Send to AI Studio** (`[g]`):
- Triggers the Google AI Studio integration for this comment.
- Identical to the `g` shortkey action.
- **Shift Modifier**: Holding **Shift** while clicking or pressing **`G`** (Shift+g) includes all unread **descendants** of the target in the XML payload.
- **Tooltip**: "Send thread to AI Studio (Shortkey: g, Shift-G to include descendants)".

**Button Rendering:**
- Buttons appear in this order: `[g]` `[r]` `[t]` ... `[^]` `[−]` `[+]`
- **Tooltips**: All buttons MUST have descriptive tooltips (e.g., "[t]" -> "Load parents and scroll to root").
- **Author Controls**: `[↑]` / `[↓]` must have tooltips explaining they affect author preferences.

**[PR-GQL-01]** **GET_POST_COMMENTS**: Fetch all comments for a post.
```graphql
query GetPostComments($postId: String!, $limit: Int) {
  comments(
    selector: { postCommentsNew: { postId: $postId } },
    limit: $limit
  ) {
    results { ...standardCommentFields }
  }
}
```

**[PR-GQL-02]** **GET_THREAD_COMMENTS**: Fetch all comments in a thread by top-level comment ID.
```graphql
query GetThreadComments($topLevelCommentId: String!, $limit: Int) {
  comments(
    selector: { repliesToCommentThreadIncludingRoot: { topLevelCommentId: $topLevelCommentId } },
    limit: $limit
  ) {
    results { ...standardCommentFields }
  }
}
```

**[PR-GQL-03]** **GET_NEW_POSTS_FULL**: Fetch posts in the enrichment window with body fields.
```graphql
query GetNewPostsFull($limit: Int, $after: String, $before: String) {
  posts(
    selector: { new: { after: $after, before: $before } },
    limit: $limit
  ) {
    results {
      _id
      title
      slug
      pageUrl
      postedAt
      baseScore
      voteCount
      commentCount
      wordCount
      htmlBody
      contents { markdown }
      user { _id username displayName slug karma }
    }
  }
}
```

Both comment queries use the same fragment fields as `GET_ALL_RECENT_COMMENTS` (including `topLevelCommentId` as a new field to add to the fragment).

---

### 13. Quick Help Panel (Collapsible)

- **[PR-HELP-01]** Collapsible panel at top explaining features.
- **[PR-HELP-02]** First visit: **Expanded** by default.
- **[PR-HELP-03]** Subsequent visits: **Collapsed** by default.
- **[PR-HELP-04]** State saved via `GM_setValue("helpCollapsed", boolean)`.
- **[PR-HELP-05]** **Multi-column layout**: The help content uses a CSS multi-column grid (2-3 columns depending on viewport width) to be more compact. Each section (h4 + its list) stays together via `break-inside: avoid`.
- **[PR-HELP-06]** **Shortcuts documented**: The help guide includes sections for Post and Comment Action Buttons, documenting both their icons/actions and their associated **keyboard hotkeys**.

---

### 14. Logged-In User Detection

- **[PR-USER-01]** Detect current logged-in user via GraphQL `currentUser` query.
- **[PR-USER-02]** Used to identify "replies to you" (comments where parent author = logged-in user).

---

---

### 16. Resizable View Width

- **[PR-LAYOUT-01]** Draggable resize handles on both left and right sides of the content area.
- **[PR-LAYOUT-02]** Width saved across sessions via `GM_setValue("viewWidth", pixels)`.

---

### 17. Hover Previews

- **[PR-PREV-01]** **Hover Delay**: 300ms.
- **[PR-PREV-02]** **Intentionality**: Ignore scroll-induced hovers.
- **[PR-PREV-03]** **Scroll Blocking**: Dismissed immediately on scroll.
- **[PR-PREV-04]** Mouse leaving trigger area dismisses preview.
- **[PR-PREV-05]** Click trigger = navigate same tab; Ctrl+click = new tab.

#### 17b. Post Link Preview
- **[PR-PREV-06]** Triggers on hover over post title links.

#### 17c. Comment Link Preview
- **[PR-PREV-07]** Detects comment URLs in body and shows full content preview.

---

### 18. Voting Buttons

- **[PR-VOTE-01]** Two-axis voting (karma + agreement).
- **[PR-VOTE-02]** **Karma voting**: `[▲]` `[▼]` buttons.
- **[PR-VOTE-03]** **Agreement voting**: `[✓]` `[✗]` buttons.
- **[PR-VOTE-04]** If logged in: Execute mutation, update UI optimistically.
- **[PR-VOTE-05]** If not logged in: Open login page in new tab.

---

### 19. Reaction System

- **[PR-REACT-01]** Scrapes reaction definitions from site webpack bundle.
- **[PR-REACT-02]** Caches definitions for 7 days.
- **[PR-REACT-03]** categorized reaction picker panel.
- **[PR-REACT-04]** **View Toggle**: Grid View vs List View.
- **[PR-REACT-05]** **Search**: Filter reactions by name/label.
- **[PR-REACT-06]** **Reaction Picker Tooltips**: Viewport-aware tooltips for icons within the reaction picker panel; native `title` tooltips for reaction chips in post/comment headers.
- **[PR-REACT-07]** **Inline Reactions**: Select text to react with a quote.
- **[PR-REACT-08]** **Display**: Reactions shown as chips in header with net scoring.

---

### 20. Google AI Studio Integration

- **[PR-AI-01]** **Shortkey**: Press **`g`** over any comment or post. 
    - **Closing Logic**: Typing `g` while the mouse is over an open AI response popup or the specific post/comment that originated it ("focal item") MUST close the popup instead of triggering a new request.
- **[PR-AI-02]** **Automation**: Opens AI Studio, selects model, injects thread XML and prompt.
- **[PR-AI-03]** **Display**: Responses captured and shown in formatted popup.
- **[PR-AI-04]** **Caching**: Responses cached in-memory for session.
- **[PR-AI-05]** **Depth**: Recursively fetches parent comments (up to 7 levels).
- **[PR-AI-06]** **Grounding**: Automatically disables Google Search grounding in AI Studio.
- **[PR-AI-07]** **URL Context**: Automatically enables the "URL context" tool in AI Studio.

---

### 21. Author Preferences

- **[PR-AUTH-05]** **Preference Controls**: `↓` / `↑` arrows in all comment and post headers.
- **[PR-AUTH-06]** **Persistence**: Preferences are saved locally via `GM_setValue`.
- **[PR-AUTH-07]** **Global Update**: Toggling a preference for an author immediately updates **all** visible comments and posts by that author across the entire interface.
- **[PR-AUTH-08]** **Visual Feedback**: Preferred authors are highlighted (pink meta header); disliked authors are auto-hidden (collapsed by default).

---

### 23. Keyboard Shortcuts (Hotkeys)

**[PR-HK-01]** **Hover-Triggered Actions**: Pressing a shortcut key while hovering over a post or comment triggers the corresponding action button for that specific item.
- **[PR-HK-02]** **Post Hotkeys**:
    - `e`: Toggle post body (Expand/Truncate/Load)
    - `a`: Load all comments
    - `c`: Scroll to comments
    - `n`: Scroll to next post
    - `g`: Send to AI Studio
    - `G` (Shift+g): Send to AI Studio with descendants
    - `-`: Collapse post and comments
    - `+` / `=`: Expand post and comments
- **[PR-HK-03]** **Comment Hotkeys**:
    - `r`: Load replies
    - `t`: Trace to root (load parents and scroll)
    - `g`: Send to AI Studio
    - `G` (Shift+g): Send to AI Studio with descendants
    - `^`: Find parent (scroll)
    - `-`: Collapse comment
    - `+` / `=`: Expand comment
- **[PR-HK-04]** **Input Suppression**: Hotkeys MUST be ignored when the user is typing in an `<input>`, `<textarea>`, or any `contenteditable` element to prevent accidental triggers.
- **[PR-HK-05]** **Alias Support**: The `=` key is supported as an alias for `+` (Expand) to allow one-handed use without requiring the Shift key.
- **[PR-HK-06]** **Feedback**: Successful hotkey triggers are logged to the console (Info level) and provide immediate visual feedback via the triggered action (e.g., scroll, collapse, or loading state).
- **[PR-HK-07]** **Post Action Fallback**: If a post-level hotkey (e.g., `n`, `a`, `c`, `e`) is pressed while hovering over a **comment**, the system MUST automatically identify the parent post and trigger the corresponding action on that post. This ensures seamless navigation without requiring the user to precisely hover the post header.

---

### 24. GraphQL Codegen & Developer Workflow

- **[PR-DEV-01]** **Automated Codegen**: The project uses `tooling/maybe-codegen.js` to automatically run `graphql-codegen` during `dev` and `build` tasks, but ONLY if `queries.ts` or the schema has changed. This maintains type safety while minimizing build overhead.

---

### 25. Tree-Karma Sorting

- **[PR-SORT-01]** **Tree-Karma Definition**: For any item (Post or Comment), its **Tree-Karma** is the maximum `baseScore` among all **unread** items (including the root itself) in the tree rooted at that item.
    - An item is considered "unread" if its ID is not present in the local `ReadTracker` dictionary.
    - If the tree (including the root) contains no unread items, something has gone wrong (as the feed should only contain unread content); in this case, the Tree-Karma is `-Infinity` and a **warning must be logged to the console**.
- **[PR-SORT-02]** **Top-Level Sorting**: Posts in the main feed are sorted by their **Tree-Karma** descending.
- **[PR-SORT-03]** **Hierarchical Comment Sorting**: At every level of the comment tree (top-level comments under a post, and replies within a comment group), items are sorted by their **Tree-Karma** descending.
- **[PR-SORT-04]** **Stability Policy**: Sorting is calculated during the rendering phase. To avoid UI instability, items MUST NOT be reshuffled dynamically as the user marks them "read" during a scroll session. The updated sort order will be reflected on the next full render or data load.

---

## Technical Requirements

### Userscript Metadata

**[PR-TECH-01]** Required Metadata Block:
```javascript
// ==UserScript==
// @name         LW Power Reader
// @namespace    http://weidai.com/
// @match        https://www.lesswrong.com/reader*
// @match        https://forum.effectivealtruism.org/reader*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @grant        GM_log
// @run-at       document-start
// @connect      lesswrong.com
// @connect      forum.effectivealtruism.org
// ==/UserScript==
```
