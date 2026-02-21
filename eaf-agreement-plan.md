# EAF Agreement Separation: UserScripts Implementation Plan

## Background & Objective
The Effective Altruism Forum (EAF) recently moved away from a unified "Karma" or "Agreement" score (like LessWrong uses) and instead displays **"Agree" and "Disagree"** metrics separately for both posts and comments. The goal is to investigate how EAF handles this data natively and plan how to best support displaying these distinct axes cleanly within the `power-reader` and `user-archive` scripts.

---

## EAF Backend Architecture
Based on the `ForumMagnum` codebase:
EAF natively replaced standard vote counts with an "Emoji Reactions" system specifically tailored to their domain.
- **Anonymous Reactions**: `agree` (Tick mark) and `disagree` (Cross mark). These function as the primary voting mechanism.
- **Public Reactions**: EAF supports `love`, `helpful`, `insightful`, `changed-mind`, and `laugh`.
- **Data Location**: These metrics are stored inside the `extendedScore` JSON object on the `Comment` and `Post` documents instead of `baseScore`.
  - Number of agrees: `extendedScore.agree` (Number)
  - Number of disagrees: `extendedScore.disagree` (Number)

When a user votes, the API processes an `extendedVote` object where `agree: true/false` and `disagree: true/false` are mutually exclusive values.

---

## Current State of UserScripts
In the `userscripts/default` workspace:
1. `GRAPHQL_API.md` and `queries.ts` show that `extendedScore` is already being retrieved for Posts and Comments.
2. It's mapped to a `NamesAttachedReactionsScore` type in typescript.
3. However, current UI components only render standard Karma (`baseScore`), missing these separated statistics entirely on EAF records.

---

## Implementation Plan

### Phase 1: Environment & Context Detection
Instead of hardcoding domain checks, our UI components should dynamically adapt based on whether `extendedScore` contains EAF's specific keys (`agree` / `disagree`), as well as the standard site config payload.
* **Logic**: If `extendedScore?.agree` or `extendedScore?.disagree` are defined (even if 0, usually present when the voting system is initialized), we render the split EAF styles.

### Phase 2: Updating the Display Components (UI)
1. **Comment / Post Meta Headers**:
   - Current display: `· [Heart/Star] <baseScore>`
   - New EAF display: Extract `.agree` and `.disagree` from `extendedScore`.
   - Render two separate pills or tags:
     - `[Tick Icon] {extendedScore.agree}` (Colored green/primary on EAF)
     - `[Cross Icon] {extendedScore.disagree}` (Colored red/secondary on EAF)
2. **Icons**:
   - Implement SVG components identical to EAF’s `TickReactionIcon` and `CrossReactionIcon` in `src/shared/icons/`.

### Phase 3: Handling Interactivity (If Applicable)
If Power Reader or User Archive intends to support *submitting* reactions natively:
1. Ensure the voting GraphQL mutation correctly sets `extendedVote` state.
2. Implement mutual exclusivity logic: When a user clicks "Agree", it must proactively remove their "Disagree" state (and vice versa) before submitting the GraphQL mutation (replicating `getEmojiMutuallyExclusivePartner` from `eaEmojiPalette.ts`).

### Phase 4: Other EA Emojis (Optional / Future-proofing)
Since the new system relies entirely on `eaEmojiPalette`, displaying other emojis like `helpful` or `insightful` would just be a matter of looping through `extendedScore` and rendering the corresponding icon for any keys with a value `> 0`, matching the EAF frontend behavior (`EAReactsSection.tsx`).

---

## Summary of Action Items
1. Add `Tick` and `Cross` SVG icons to the shared component library.
2. Modify the ItemMeta rendering functions in `user-archive` and `power-reader` to check for EAF agreement flags in `extendedScore`.
3. If flags exist, bypass/hide standard `baseScore` rendering and inject the two distinct agreement pills instead.
