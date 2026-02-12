# Forum Magnum: Vote and Inbox Notifications Implementation

This document provides a technical overview of how voting and inbox notifications are implemented in the Forum Magnum codebase, and serves as a blueprint for implementing similar high-performance notification features in the **Power Reader** userscript.

---

## 1. Voting Implementation (The Append-Only Model)

### Data Model (`Votes` Collection)
Forum Magnum uses an **append-only** voting system. Votes are never modified; instead, new records are added, and old ones are marked as cancelled.

- **Primary Fields**:
    - `documentId`: The ID of the post, comment, or tag being voted on.
    - `userId`: The ID of the voter.
    - `voteType`: `smallUpvote`, `bigUpvote`, `smallDownvote`, `bigDownvote`, or `neutral`.
    - `power`: The numerical impact on the score (calculated based on user karma).
    - `cancelled`: A boolean flag (default `false`). Reversing a vote sets this to `true`.
    - `isUnvote`: A boolean flag identifying a record created specifically to reverse a previous vote.
    - `extendedVoteType`: A JSON field used for alternate voting systems like reactions (emojis, pro-reactions).

### Vote Notifications & Karma Model
Unlike many social platforms, Forum Magnum **does not** send a notification for every individual upvote or downvote. This is a design decision to prevent "notification spam" and focus on higher-level feedback.

- **`karmaPowersGained`**: The primary vote-related notification. It is sent when a user's karma reaches a threshold that increases their voting power (e.g., moving from a power-1 voter to a power-2 voter).
- **Aggregated Feedback**: Users generally track their "reputation" via their total Karma score in their profile, rather than individual "Someone upvoted you" pings.
- **Moderation Pings**: If a critical mass of downvotes triggers a moderation action (like automod hiding a comment), the user will receive a notification about the *deletion/rejection*, not the votes themselves.

### Client-Side Logic (`lib/voting/vote.ts`)
The server is the source of truth for all scores.
- **`performVoteServer`**: The main entry point.
    1.  **Validation**: Checks permissions and rate limits.
    2.  **Clear Old Votes**: Calls `clearVotesServer` to cancel any existing active votes by the user for that document.
    3.  **Add New Vote**: Calls `addVoteServer` to insert the new `Vote` record.
    4.  **Score Recalculation**: Calls `recalculateDocumentScores`, which re-fetches **all** non-cancelled votes for the document and recomputes total scores and reaction counts (`extendedScore`) from scratch.

---

## 2. Karma Change Notifier System (The "Replay" Model)

While the regular Inbox uses persistent records, the **Karma Change Notifier** (the star icon in the header) is a **pull-based** system. It does not store individual "karma notification" records; instead, it reconstructs your recent karma history on demand.

### Data Storage (`Users` Collection)
Tracking the "unseen" state of karma is handled by fields on the `User` document:
- **`karmaChangeLastOpened`**: A `TIMESTAMPTZ` recorded when the user last opened/closed the karma menu. 
- **`karmaChangeBatchStart`**: Used to identify the beginning of the current batch (daily/weekly).
- **`karmaChangeNotifierSettings`**: Stores user preferences for update frequency (`realtime`, `daily`, `weekly`, or `disabled`).

### Server-Side Logic (`getKarmaChanges`)
When the user views the header, the client requests the `User.karmaChanges` field. The server:
1.  **Determines the Window**: Calculates a `startDate` and `endDate` based on `lastOpened` and the user's frequency settings.
2.  **SQL Reconstruction**: Executes a query in `VotesRepo.ts` that:
    - Finds all votes where the user is an author (`authorIds @> ARRAY[userId]`).
    - Excludes self-votes.
    - Filters by the calculated time window.
    - Sums the `power` (or `afPower`) and aggregates **Reactions** from the `extendedVoteType` JSON field.
3.  **Joins for Context**: Joins with `Posts` and `Comments` to provide the titles and excerpts shown in the dropdown.

### Comparison: Inbox vs. Karma Notifier

| Feature | Regular Notifications (Inbox) | Karma Notifier (Star) |
| :--- | :--- | :--- |
| **Logic** | "User X replied to you." | "You gained +15 Karma on 3 items." |
| **Storage** | Persistent records in `Notifications`. | Computed on-the-fly from `Votes`. |
| **Trigger** | Server-side callbacks (Push). | Client-side query on page load (Pull). |
| **Acknowledgment** | Marked read individually or "Mark All". | Updated when the dropdown is closed. |

---

## 3. Notification System (The Callback & Debounce Model)

### Modular Notification Types (`notificationTypesServer.tsx`)
Notifications are highly modular. Each type (e.g., `newReply`, `newPost`) defines its own:
- **`emailSubject`**: How the subject line appears.
- **`emailBody`**: The React component used for the email body.
- **`loadData`**: An optional helper to fetch extra fragments (like participants in a conversation) before rendering.
- **`canCombineEmails`**: If true, the system will batch multiple instances of this notification into a single digest.

### Triggers and Side Effects
- **Collection Callbacks**: Logic in `server/callbacks/` (e.g., `commentCallbackFunctions.tsx`) triggers `createNotifications` after a successful mutation.
- **Smart Subscription Filtering**: The `getSubscribedUsers` helper filters the notification list to prevent duplicates (e.g., if you are both the author and a subscriber, you only get one "New Reply" alert).

### Batching and Delivery (`notificationBatching.tsx`)
- **Debouncers**: The system uses named debouncers (e.g., `notificationDebouncers[notificationType]`) to queue notifications.
- **Frequency**: Delivery is scheduled based on user settings:
    - `realtime`: Immediate creation and delivery.
    - `daily` / `weekly`: Records are marked `waitingForBatch: true` and processed by a cron job into a summary email.

---

## 4. Guide: Implementing Notifications in Power Reader

Power Reader can enhance the user experience by providing a high-speed interface for server-side notifications.

### Step 1: GraphQL Integration
To implement notifications, Power Reader should query the existing `Notifications` collection.

**Recommended Query**:
```graphql
query PowerReaderNotifications($userId: String!, $limit: Int) {
  notifications(selector: { userId: $userId, viewed: false, deleted: false }, limit: $limit) {
    results {
      _id
      message
      link
      type
      createdAt
      documentId
      documentType
    }
  }
}
```

### Step 2: Real-time Updates (Polling vs. Subscription)
Since Power Reader is a userscript, it should maintain high responsiveness:
- **Polling**: Fetch notifications every 60 seconds.
- **Optimistic Integration**: Intercept native LW WebSocket messages (if available) to update the notification count instantly.
- **Signal**: Update a local `#pr-notification-badge` to alert the user without interrupting their reading flow.

### Step 3: Actionable UI (High Speed "Inbox Zero")
Power Reader's design philosophy favors speed. The notification UI should:
1.  **Overlay Tray**: A side-drawer (like `NotificationsMenu.tsx`) that allows users to quickly scan messages.
2.  **Instant Mark-Read**: Clicking a notification should optimistically mark it as read on the server using the `markAsViewed` mutation:
    ```graphql
    mutation MarkNotificationRead($documentId: String!) {
      viewNotification(input: { selector: { documentId: $documentId } }) {
        result {
          _id
          viewed
        }
      }
    }
    ```
3.  **Inline Previews**: Hovering over a notification could reuse Power Reader's existing `Preview` component to show the comment or post content without navigating away.

### Step 4: Local Read Tracking Sync
Power Reader already tracks read status locally in `readTracking.ts`.
- **Hybrid System**: A notification for a comment you have **already read** in Power Reader (tracked locally) should be auto-marked as seen or visually de-emphasized.
- **Workflow**:
    - User scrolls past a comment in Power Reader.
    - `readTracking.ts` records the `commentId`.
    - Power Reader cross-references existing unread notifications.
    - If a match is found, it sends a background mutation to "view" that notification on the server.

### Step 5: Vote Notifications (Caution)
Since the Forum Magnum backend **does not** create notification records for individual votes, Power Reader should avoid trying to "synthesize" these.
- **Why?**: The only way to detect new votes is by polling the entire `Votes` collection for your own content, which is computationally expensive and against API best practices.
- **Best Practice**: Stick to the Forum's model—focus notifications on high-signal events (replies, mentions) and use the Karma score as the primary feedback mechanism for votes.

---

## Reference Files
- **Server Logic**: `packages/lesswrong/server/voteServer.ts`
- **Notification Types**: `packages/lesswrong/server/notificationTypesServer.tsx`
- **UI Components**: `packages/lesswrong/components/notifications/NotificationsMenu.tsx`
- **Batching**: `packages/lesswrong/server/notificationBatching.tsx`
