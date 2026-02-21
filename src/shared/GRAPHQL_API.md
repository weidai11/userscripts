# GraphQL API Documentation

Forum Magnum (LessWrong, EA Forum) exposes a powerful GraphQL API for interacting with the site's data. This document provides a complete guide to the API's structure, parameters, and core collections.

**GitHub Repository**: [https://github.com/ForumMagnum/ForumMagnum](https://github.com/ForumMagnum/ForumMagnum)

## Endpoints

- **Production**:
  - LessWrong: `https://www.lesswrong.com/graphql`
  - EA Forum: `https://forum.effectivealtruism.org/graphql`
- **Development**: `http://localhost:3000/graphql`
- **Interactive Explorer (GraphiQL)**: `/graphiql` on any instance.

## Authentication

Most mutations and sensitive query fields require authentication.
Include an `Authorization` header with a bearer token:
`Authorization: Bearer <your_token>`

---

## Legacy vs. Modern API Patterns

The ForumMagnum API is currently in a transition phase. You will encounter two distinct patterns for querying collections.

### 1. The Modern Pattern (`selector` + Top-level Args)
This is the **preferred pattern** for all new development. It improves type safety by using specific input objects for each view.

*   **Structure**: The `selector` argument is a map where the key is the **view name** (e.g., `recentComments`) and the value is a specific input type (e.g., `CommentsRecentCommentsViewTerms`).
*   **Pagination**: Controls like `limit` and `offset` are passed as **top-level arguments** alongside `selector`.
*   **Example**:
    ```graphql
    query {
      posts(selector: { hot: {} }, limit: 10) { ... }
    }
    ```

### 2. The Legacy Pattern (`input` Wrapper)
Used by older versions of the codebase and still supported by the server for backward compatibility.

*   **Structure**: All arguments are wrapped in a single `input` object. Parameters are passed inside a `terms` sub-object.
*   **Selection**: The view is specified as a string `view: "viewName"` inside the `terms`.
*   **Pagination**: `limit` and `offset` are also passed inside `terms`.
*   **Example**:
    ```graphql
    query {
      posts(input: { terms: { view: "hot", limit: 10 } }) { ... }
    }
    ```

> **Relationship**: The server internally maps the `selector` pattern to the `input` pattern. Using the modern pattern is recommended because it allows `graphql-codegen` to provide accurate types for the arguments required by specific views.

### Cross-Site Compatibility

As of February 2026, **LessWrong** supports both patterns, while **EA Forum** only supports the legacy `input`/`terms` pattern. The EA Forum runs an older version of ForumMagnum that predates the modern `selector` refactor (~April 2025).

Our queries are written in the modern syntax (for codegen type safety on LW), and a **runtime adapter** in `src/shared/graphql/client.ts` automatically rewrites them to legacy format when running on EA Forum. See `LEGACY_ADAPTERS` in that file. When adding a new query that uses `selector`, you must also register it in the adapter so it works on EAF.

---

## Global Query Structure

The API distinguishes between **Single Document** queries (`post`, `user`) and **Multi-Document** queries (`posts`, `users`).

### Multi-Document Queries (Plural)
Almost every collection has a plural query that supports common pagination and filtering parameters.

#### Common Arguments:
- **`selector`**: A structured object where the **key** is the name of a predefined "view" (e.g., `new`, `top`, `curated`) and the **value** is an object of view-specific terms.
- **`limit`**: `Int` (Default: collection-specific, Max: 1000). Number of results to return.
- **`offset`**: `Int`. Number of results to skip (used for pagination).
- **`enableTotal`**: `Boolean`. If `true`, the output will include `totalCount`.
- **`input`**: (Legacy) An object containing `terms`, `enableTotal`, and `resolverArgs`.

#### Output Format:
```graphql
type Multi[Collection]Output {
  results: [Collection!]!
  totalCount: Int # Only populated if enableTotal: true was passed
}
```

### Single Document Queries
Used to fetch a specific record by ID or unique field.

#### Common Arguments:
- **`selector`**: An### Selectors
Most single-document queries and mutations use a `SelectorInput`:
```graphql
input SelectorInput {
  _id: String
  documentId: String # Often an alias for _id
  slug: String # Supported by some collections like Posts and Users
}
```

### Special Data Types
- **`Date`**: Stored as ISO 8601 strings (e.g., `2023-10-27T10:00:00Z`).
- **`JSON`**: Arbitrary JSON objects, often used for settings or rich content blobs.
- **`HTML` / `Markdown`**: Content is often stored in both formats. You usually request one or the other from a `contents` field.
- **`allowNull`**: `Boolean` (Default: `false`). If `true`, returns `null` instead of throwing an error if the document is not found.
- **`input`**: (Legacy) An object containing `selector` and `allowNull`.

---

## Core Collections

### Posts

#### Plural Query: `posts`
**Example: Recent Curated Posts**
```graphql
query GetCurated($limit: Int, $offset: Int) {
  posts(
    selector: { curated: { af: false } },
    limit: $limit,
    offset: $offset,
    enableTotal: true
  ) {
    results {
      _id
      title
      postedAt
    }
    totalCount
  }
}
```

**Common `PostSelector` Views:**
- `new`: Recently posted.
- `top`: Highest base score.
- `magic`: Algorithmically sorted (mix of score, recency, and user personalization).
- `curated`: Curated content.
- `frontpage`: Posts appearing on the frontpage.
- `daily`: Top posts of the day.
- `drafts`: User's drafts (requires auth).
- `tagRelevance`: Posts associated with a specific `tagId`.

#### Filtering Parameters
Most post views (e.g., `new`, `top`, `magic`) support standard filtering terms handled by the `defaultView`.
- **`after`**: ISO 8601 Date String (e.g., `2024-01-01`). Select items created **on or after** this date (`$gte`).
- **`before`**: ISO 8601 Date String. Select items created **strictly before** this date (`$lt`).
- **`timeField`**: `String`. The field to apply `after` and `before` filters to. Defaults to `postedAt`. Use `"modifiedAt"` for incremental syncs.
- **`karmaThreshold`**: `Int`. Filter by minimum `baseScore`.
- **`userId`**: `String`. Filter by author ID.
- **`af`**: `Boolean`. Filter for Alignment Forum posts.
- **`excludeEvents`**: `Boolean`. Exclude event posts.

**Example: Fetch New Posts After Date**
```graphql
query GetPostsAfterDate {
  posts(selector: {
    new: { after: "2023-01-01" }
  }) {
    results { _id title postedAt }
  }
}
```

### Pagination Limits & Workarounds
The API enforces a strict `offset` limit of **2000** (definedByKey `maxAllowedApiSkip`). Queries with `offset > 2000` will throw an error.

**Preferred Method: Date-Based Pagination**
**Preferred Method: Date-Based Pagination**
Standard views like `recentComments` / `allRecentComments` (for comments) and `new` / `top` (for posts) support `after` and `before` terms. This is the **standard way** to fetch items in chronological order without hitting the 2000-deep offset limit.

### Incremental Synchronization (Syncing Edits)
For clients performing incremental syncs, fetching only content that has changed since the last sync is critical.

| Collection | Filter Field | Selector Argument | Status |
| :--- | :--- | :--- | :--- |
| **Posts** | `modifiedAt` | `timeField: "modifiedAt"` | **Supported**. All `defaultView` based views support this. |
| **Comments** | `lastEditedAt` | N/A | **Partial / Not Supported**. `lastEditedAt` exists but cannot be filtered via `timeField` yet. |

#### Syncing Posts by Edit Time
```graphql
query SyncModifiedPosts($after: Date) {
  posts(selector: {
    new: { after: $after, timeField: "modifiedAt" }
  }) {
    results { _id title modifiedAt }
  }
}
```
 
 ```graphql
query GetCommentsByDate($after: String, $limit: Int) {
  comments(selector: {
    allRecentComments: { after: $after, sortBy: "oldest" }
  }, limit: $limit) {
    results { _id postedAt body extendedScore user { username } }
  }
}
```

**Deprecated Method: Thread-Based Pagination**
Previously used when date-based filtering was unavailable:

1. Query `posts` using the "Recent Discussion" view:
   ```graphql
   query ActiveThreads($before: String) {
     posts(input: {
       terms: {
         view: "recentDiscussionThreadsList"
         timeField: "lastCommentedAt"
         before: $before  # ISO Date String
         limit: 20
       }
     }) {
       results { _id title lastCommentedAt }
     }
   }
   ```
2. Iterate through these posts and fetch their recent comments.
3. This effectively reconstructs the conversation history by iterating through "when threads were active" rather than linear comment creation.

### Read Statuses & Unread Tracking
The system tracks "read" status at the **Post** level, not per interaction.
- **Storage**: `ReadStatuses` table stores a `lastUpdated` timestamp for each `(userId, postId)` pair.
- **Logic**: Any comment on a post with `postedAt < lastUpdated` is implicitly considered "read".
- **API Usage**:
  - **Read**: Fetch `Post.lastVisitedAt` (maps to `ReadStatuses.lastUpdated`).
  - **Write**: Use mutation `markPostCommentsRead(postId: String!)`. This updates the timestamp to `NOW()`.

### Comment Views
Comments are primarily fetched via the `comments` query.
- **Standard Views**:
  - `recentComments`: Global stream of recent comments (subject to 2000 offset limit).
  - `postCommentsNew`: Comments for a specific post, sorted newest first.
  - `postCommentsOld`: Comments for a specific post, sorted oldest first.
- **Sorting**:
  - `postedAt` (default)
  - `baseScore` (top)
**Filtering (`selector` fields)**
- `userId`: Filter by author.
- `karmaThreshold`: `Int`. Minimum score (e.g., `karmaThreshold: 30`).
- `after`, `before`: ISO 8601 Date strings. Filter by `postedAt`. (Now supported by `recentComments` and `allRecentComments`).
- **Note**: `timeField` is **not** currently supported for comments. Filtering is always against `postedAt`.

**Sorting**
While many views have intrinsic sorts (e.g. `new` sorts by date), you can sometimes override this with `sortedBy` in the selector terms.
- `new`
- `old`
- `top`
- `magic`
- `recentComments`

---

### Tags

#### Plural Query: `tags`
**Example: Core Tags**
```graphql
query GetCoreTags {
  tags(selector: { coreTags: {} }) {
    results {
      _id
      name
      slug
      postCount
    }
  }
}
```

**Common `TagSelector` Views:**
- `tagBySlug`: Fetch a single tag by `camelCaseSlug` (passed as `slug` in terms).
- `allTagsAlphabetical`: All tags, sorted A-Z.
- `coreTags`: Core site tags/categories.
- `userTags`: Tags created by a specific user.

---

### Other Useful Collections

#### Sequences
**Query: `sequences`**
Used for fetching sequences (ordered series of posts).
```graphql
query GetUserSequences($userId: String) {
  sequences(selector: { userProfile: { userId: $userId } }) {
    results {
      _id
      title
      slug
      htmlDescription
    }
  }
}
```

#### Notifications
**Query: `notifications`**
Used for fetching user notifications.
```graphql
query GetMyNotifications {
  notifications(selector: { userNotifications: { userId: "my_user_id" } }) {
    results {
      _id
      type
      link
      read
    }
  }
}
```

---

### Comments

#### Plural Query: `comments`
Used to fetch comments for a post, profile, or the entire site.

**Example: Comments for a Post**
```graphql
query GetPostComments($postId: String!, $limit: Int) {
  comments(
    selector: { postCommentsOld: { postId: $postId } },
    limit: $limit
  ) {
    results {
      _id
      body
      baseScore
      user { username }
    }
  }
}
```

#### Available Terms (`CommentsViewTerms`)
The `input.terms` object supports these parameters (though support varies by view):

| Parameter | Type | Description |
| :--- | :--- | :--- |
| `view` | String | The specific view to use (defaults to `default`). |
| `postId` | String | Filter by a specific post. |
| `userId` | String | Filter by a specific user. |
| `commentIds` | String[] | Fetch a specific set of comment IDs (uses `$in`). |
| `before` | Date/String | Filter for comments posted before this date (view-specific). |
| `after` | Date/String | Filter for comments posted after this date (view-specific). |
| `sortBy` | String | Sorting mode (e.g. `top`, `new`, `magic`). |
| `limit` | Int | Number of results to return (default varies by view, often 5 or 20). |
| `minimumKarma` | Int | Minimum `baseScore` threshold. |
| `drafts` | String | "exclude", "include-my-draft-replies", "include", or "drafts-only". |

#### Views
*   **`defaultView`**: Base view. Hides deleted/unreviewed comments. Supports `userId`, `commentIds`.
*   **`recentComments`**: Optimized for recent activity (`score > 0`, `deletedPublic: false`). **Supports `after` and `before`**.
*   **`allRecentComments`**: Like `recentComments` but without score filter. **Supports `after` and `before`**.
*   **`postsItemComments`**: For post feeds. **Supports `after`**. Requires `postId`.
*   **`profileComments`**: Comments by a specific `userId`.
*   **`postCommentsTop` / `New` / `Old`**: Specialized sorts for a specific `postId`.
*   **`topShortform`**: Top-rated shortform. **Supports `after` and `before`**.

#### Sorting Modes
| Mode | MongoDB Sort | Synonyms |
| :--- | :--- | :--- |
| `top` | `{ baseScore: -1 }` | |
| `magic` | `{ score: -1 }` | |
| `new` | `{ postedAt: -1 }` | `newest`, `recentComments` |
| `old` | `{ postedAt: 1 }` | `oldest` |

#### Technical Notes
*   **Date Filtering**: `after`/`before` are supported by major global views like `recentComments` and `allRecentComments`, as well as `postsItemComments` and `topShortform`.
*   **Hidden/Deleted**: Most views automatically hide deleted comments and unreviewed comments from non-authors.

---

### Users

#### Single Query: `user`
**Example: Fetch by Slug**
```graphql
query GetUser($slug: String!) {
  user(selector: { slug: $slug }) {
    result {
      _id
      username
      karma
      reactPaletteStyle # "listView" or "gridView" (user preference)
      biography { html }
    }
  }
}
```

#### Plural Query: `users`
**Common `UserSelector` Views:**
- `allUsers`: List of all users (supports `sort` by `karma`, `postCount`, etc.).
- `usersByUserIds`: Fetch multiple users by `userIds` array.
- `recentlyActive`: Users who commented or posted recently.

---

## Mutations

### Creating & Updating
Mutations follow a standard pattern using `Create[Collection]DataInput` and `Update[Collection]DataInput`.

**Example: Create a Comment**
```graphql
mutation CreateComment($postId: String!, $body: String!) {
  createComment(data: {
    postId: $postId,
    contents: {
      markdown: $body
    }
  }) {
    data {
      _id
    }
  }
}
```

### Voting & Interactions
Voting and read-tracking are handled via specialized mutations.

#### 1. Voting
Each collection that supports voting has a `performVote[Collection]` mutation (e.g., `performVotePost`, `performVoteComment`).

**Mutations:**
- `performVotePost(documentId: String, voteType: String, extendedVote: JSON)`
- `performVoteComment(documentId: String, voteType: String, extendedVote: JSON)`
- `performVoteMessage(documentId: String, voteType: String, extendedVote: JSON)`
- `performVoteTagRel(documentId: String, voteType: String, extendedVote: JSON)`
- `performVoteTag(documentId: String, voteType: String, extendedVote: JSON)`
- `performVoteMultiDocument(documentId: String, voteType: String, extendedVote: JSON)`
- `performVoteRevision(documentId: String, voteType: String, extendedVote: JSON)`
- `performVoteElectionCandidate(documentId: String, voteType: String, extendedVote: JSON)`

**Mutation Results**:
The `performVote*` mutations return a `VoteResult` object, which wraps the updated entity inside a `document` property.
```graphql
mutation Vote($documentId: String!, $voteType: String!) {
  performVoteComment(documentId: $documentId, voteType: $voteType) {
    document {
      _id
      baseScore
      voteCount
      currentUserVote
      currentUserExtendedVote
    }
    showVotingPatternWarning
  }
}
```
*Contrast*: The legacy `setVoteComment` mutation (if used) typically returns the `Comment` object directly without the `document` wrapper. Modern code should use `performVote` and expect the wrapper.

**Standard Vote Types (`voteType`):**
- `smallUpvote` / `smallDownvote`: Standard 1-point votes (scaling with user karma).
- `bigUpvote` / `bigDownvote`: Strong votes (available to high-karma users).
- `upvote` / `downvote`: Aliases for small/standard votes.
- `neutral`: Removes the current vote on this axis.

#### 2. Agreement Axis (Comments)
Comments typically use a "Two Axis" voting system (specifically `namesAttachedReactions`) allowing users to vote on both Karma and Agreement.

**Casting an Agreement Vote:**
```json
{
  "agreement": "smallUpvote" | "smallDownvote" | "bigUpvote" | "bigDownvote" | "neutral"
}
```

**Fetching Agreement Scores:**
The `afExtendedScore` field contains specialized counters for the Agreement axis:
```json
{
  "agreement": 15,
  "agreementVoteCount": 3
}
```
*   `agreement`: The net agreement score (this is the correct field for "Agreement Only" values).
*   `agreementVoteCount`: Total number of users who have cast an agreement/disagreement vote.

> **Note**: There is also an `afBaseScore` field, but this often represents a different aggregation (e.g. alignment-weighted) and may differ from the raw agreement count. Use `afExtendedScore.agreement` for the standard agreement value.

#### 3. Reactions (Comments, Messages, Tags, Posts)
Reactions allow users to attach semantic markers or emojis to content. They are mainly used in `namesAttachedReactions` and `reactionsAndLikes` voting systems.

**Casting a Reaction (`extendedVote` Input):**
```json
{
  "reacts": [
    {
      "react": "insightful",
      "vote": "created",
      "quotes": ["optional text snippet"]
    }
  ]
}
```
*   **`react`**: The unique name of the reaction (e.g., `"thanks"`, `"agree"`, `"insightful"`, `"important"`, `"crux"`).
*   **`vote`**: One of `"created"`, `"seconded"`, or `"disagreed"`.
*   **`quotes`**: For "inline reactions", an array containing the exact text snippet being reacted to.

**Fetching Reactions (`extendedScore` Output):**
Aggregated reaction data is returned in the `extendedScore` JSON field. The structure is a **Record/Map** where the keys are reaction names and the values are arrays of votes.

```typescript
{
  "reacts": {
    "insightful": [
      {
        "userId": "user_123",
        "reactType": "created" | "seconded" | "disagreed",
        "quotes": [
          { "quote": "specifically this part", "score": 1 }
        ]
      },
      // ... more users who reacted "insightful"
    ],
    "thanks": [
      { "userId": "user_456", "reactType": "created" }
    ]
  }
}
```

#### 4. Read Status
Track which posts and comments a user has seen.

**Mutations:**
- `markAsReadOrUnread(postId: String, isRead: Boolean)`: Toggles the read state of a post. Returns the new `isRead` state.
- `markPostCommentsRead(postId: String!)`: Marks all current comments in a post as seen.

---

## User Activity & History
The API provides dedicated queries for fetching a user's chronological history.

### Reading History
Fetch the authenticated user's recently read posts.
```graphql
query GetMyHistory($limit: Int) {
  UserReadHistory(limit: $limit) {
    posts {
      _id
      title
      slug
    }
  }
}
```

### Commenting History
Fetch posts that the authenticated user has commented on.
```graphql
query GetCommentedPosts($limit: Int) {
  PostsUserCommentedOn(limit: $limit) {
    posts {
      _id
      title
    }
  }
}
```

---

## Technical Details

### Advanced Filtering (`selector` terms)
In addition to standard views, many plural queries support advanced filtering terms:
- **`karmaThreshold`**: `Int`. Filter results by a minimum numeric score.
- **`meta`**: `Boolean`. Filter for (or exclude) meta-discussion posts.
- **`exactPostIds`**: `String[]`. Fetches exactly the requested list of IDs, bypassing most other view logic (but respecting permissions).

### Specialized Feed Resolvers
Some feeds are available as top-level queries rather than plural collection queries:
- **`CuratedAndPopularThisWeek`**: Returns a mix of curated and high-karma recent posts.
- **`PostsWithActiveDiscussion`**: Posts with the most recent comment activity.
- **`PopularComments`**: A "Magic" sort for comments based on score and recency.
- **`CommentsWithReacts`**: Returns comments that have at least one reaction.

### Headers & Client Identification
- **`Authorization`**: `Bearer <token>` for authenticated requests.
- **`client-id` / `clientid`**: (Optional) A unique string used to track state (like read status or recommendations) for anonymous users.
- **`Referer`**: The site uses the Referer header to determine which forum (LessWrong vs EA Forum) to prioritize for certain localized settings.

**Output Fields:**
- `baseScore`: Total numeric karma score.
- `voteCount`: Total number of uncancelled votes.
- `extendedScore`: JSON object containing aggregated data for the extra axes.
- `afExtendedScore`: JSON object specifically containing the `agreement` score and vote counts.
- `currentUserVote`: The user's current `voteType`.
- `currentUserExtendedVote`: The user's current `extendedVote` object.

---

### Revisions & Rich Text
Large text fields (Post `contents`, User `biography`) are stored as **Revisions**.
When querying, you can select:
- `html`: Rendered HTML.
- `markdown`: Original markdown content.

### Synthetic Fields
Some views (like `magic` or `frontpage`) use **Synthetic Fields** like `score` (decayed karma) or `filteredScore` (customized for user settings). These are computed on-the-fly during the query.

### Loader Cache
The server use dataloaders to batch database requests. If you query multiple objects (e.g., authors for a list of posts), the server efficiently batches these into a single SQL/Mongo query.

---

## Implementation Reference

- **Schema Definitions**: `packages/lesswrong/lib/collections/<collection>/newSchema.ts`
- **Query & Mutation Definitions**: `packages/lesswrong/server/collections/<collection>/queries.ts` and `mutations.ts`
- **View Logic**: `packages/lesswrong/lib/collections/<collection>/views.ts`
- **Default Resolvers**: `packages/lesswrong/server/resolvers/defaultResolvers.ts`
- **Global API Setup**: `app/graphql/route.ts` and `packages/lesswrong/server/vulcan-lib/apollo-server/initGraphQL.ts`

---

## Type Generation & Schema Maintenance

To ensure type safety, we use `graphql-codegen` to generate TypeScript types from the LessWrong schema.

### Updating the Schema
The site schema changes periodically. To fetch the latest version:
1. Run `npm run update-schema`.
2. This script performs two actions:
   - Fetches the current introspection schema using `src/shared/graphql/fetch_schema.js`.
   - Automatically fixes known server bugs (e.g., `EmptyViewInput` field errors).
   - Triggers `npm run codegen` to update `src/generated/graphql.ts`.

### Manual Fixes in `lw_schema.json`
If `graphql-codegen` fails due to validation errors (e.g., "Input Object type X must define one or more fields"), the `fetch_schema.js` script handles common cases, but manual intervention in the JSON file may occasionally be required.

#### The `EmptyViewInput` Issue
The modern `selector` pattern uses `EmptyViewInput` for views that don't take arguments (e.g., `selector: { magic: {} }`). However, the GraphQL specification requires all Input objects to have at least one field. The LessWrong server often violates this by returning an object with zero fields, causing `graphql-codegen` to fail.

Our `fetch_schema.js` script automatically injects a dummy `_unused` field into these objects to satisfy the validator while preserving compatibility.

### Usage in Code
Import types from `src/generated/graphql.ts` or use the aliases defined in `src/shared/graphql/queries.ts`.
