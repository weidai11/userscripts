export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  ContentTypeData: { input: any; output: any; }
  Date: { input: any; output: any; }
  JSON: { input: any; output: any; }
};

export type AdminEmailAudienceFilterInput = {
  excludeDeleted: Scalars['Boolean']['input'];
  excludeUnsubscribed: Scalars['Boolean']['input'];
  includeUnknownRisk: Scalars['Boolean']['input'];
  maxMailgunRisk?: InputMaybe<MailgunRiskLevel>;
  onlyAdmins: Scalars['Boolean']['input'];
  requireMailgunValid: Scalars['Boolean']['input'];
  verifiedEmailOnly: Scalars['Boolean']['input'];
};

export type AdminEmailPreviewAudienceInput = {
  filter: AdminEmailAudienceFilterInput;
};

export type AdminSendBulkEmailInput = {
  batchSize?: InputMaybe<Scalars['Int']['input']>;
  concurrency?: InputMaybe<Scalars['Int']['input']>;
  filter: AdminEmailAudienceFilterInput;
  from?: InputMaybe<Scalars['String']['input']>;
  html?: InputMaybe<Scalars['String']['input']>;
  maxRecipients?: InputMaybe<Scalars['Int']['input']>;
  runId?: InputMaybe<Scalars['String']['input']>;
  subject: Scalars['String']['input'];
  text?: InputMaybe<Scalars['String']['input']>;
};

export type AdminSendTestEmailInput = {
  from?: InputMaybe<Scalars['String']['input']>;
  html?: InputMaybe<Scalars['String']['input']>;
  subject: Scalars['String']['input'];
  text?: InputMaybe<Scalars['String']['input']>;
  userId: Scalars['String']['input'];
};

export type AdvisorRequestSelector = {
  default?: InputMaybe<EmptyViewInput>;
  requestsByUser?: InputMaybe<AdvisorRequestsRequestsByUserInput>;
};

export type AdvisorRequestsRequestsByUserInput = {
  userId?: InputMaybe<Scalars['String']['input']>;
};

export enum AllTagsActivityFeedEntryType {
  TagCreated = 'tagCreated',
  TagDiscussionComment = 'tagDiscussionComment',
  TagRevision = 'tagRevision'
}

export type ArbitalTagContentRelSelector = {
  default?: InputMaybe<EmptyViewInput>;
};

export type AutosaveContentType = {
  type?: InputMaybe<Scalars['String']['input']>;
  value?: InputMaybe<Scalars['ContentTypeData']['input']>;
};

export type BanSelector = {
  default?: InputMaybe<EmptyViewInput>;
};

export type BookSelector = {
  default?: InputMaybe<EmptyViewInput>;
};

export type BookmarkSelector = {
  myBookmarkedPosts?: InputMaybe<EmptyViewInput>;
  myBookmarks?: InputMaybe<EmptyViewInput>;
  userDocumentBookmark?: InputMaybe<BookmarksUserDocumentBookmarkInput>;
};

export type BookmarksUserDocumentBookmarkInput = {
  collectionName?: InputMaybe<Scalars['String']['input']>;
  documentId?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type ChapterSelector = {
  SequenceChapters?: InputMaybe<ChaptersSequenceChaptersInput>;
  default?: InputMaybe<EmptyViewInput>;
};

export type ChaptersSequenceChaptersInput = {
  limit?: InputMaybe<Scalars['String']['input']>;
  sequenceId?: InputMaybe<Scalars['String']['input']>;
};

export type CkEditorUserSessionSelector = {
  default?: InputMaybe<EmptyViewInput>;
};

export type ClientIdSelector = {
  default?: InputMaybe<EmptyViewInput>;
  getClientId?: InputMaybe<ClientIdsGetClientIdInput>;
};

export type ClientIdsGetClientIdInput = {
  clientId?: InputMaybe<Scalars['String']['input']>;
};

export type CoauthorStatusInput = {
  confirmed: Scalars['Boolean']['input'];
  requested: Scalars['Boolean']['input'];
  userId: Scalars['String']['input'];
};

export type CollectionDefaultViewInput = {
  collectionIds?: InputMaybe<Array<Scalars['String']['input']>>;
};

export type CollectionSelector = {
  default?: InputMaybe<CollectionDefaultViewInput>;
};

export type CommentDefaultViewInput = {
  commentIds?: InputMaybe<Array<Scalars['String']['input']>>;
  minimumKarma?: InputMaybe<Scalars['Int']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type CommentModeratorActionSelector = {
  activeCommentModeratorActions?: InputMaybe<CommentModeratorActionsActiveCommentModeratorActionsInput>;
  default?: InputMaybe<EmptyViewInput>;
};

export type CommentModeratorActionsActiveCommentModeratorActionsInput = {
  limit?: InputMaybe<Scalars['String']['input']>;
};

export type CommentSelector = {
  afPostCommentsTop?: InputMaybe<CommentsAfPostCommentsTopInput>;
  afRecentDiscussionThread?: InputMaybe<CommentsAfRecentDiscussionThreadInput>;
  afSubmissions?: InputMaybe<CommentsAfSubmissionsInput>;
  alignmentSuggestedComments?: InputMaybe<CommentsAlignmentSuggestedCommentsInput>;
  allCommentsDeleted?: InputMaybe<CommentsAllCommentsDeletedInput>;
  allRecentComments?: InputMaybe<CommentsAllRecentCommentsInput>;
  answersAndReplies?: InputMaybe<CommentsAnswersAndRepliesInput>;
  checkedByModGPT?: InputMaybe<CommentsCheckedByModGptInput>;
  commentReplies?: InputMaybe<CommentsCommentRepliesInput>;
  debateResponses?: InputMaybe<CommentsDebateResponsesInput>;
  default?: InputMaybe<CommentDefaultViewInput>;
  defaultModeratorResponses?: InputMaybe<CommentsDefaultModeratorResponsesInput>;
  draftComments?: InputMaybe<CommentsDraftCommentsInput>;
  forumEventComments?: InputMaybe<CommentsForumEventCommentsInput>;
  latestSubforumDiscussion?: InputMaybe<CommentsLatestSubforumDiscussionInput>;
  legacyIdComment?: InputMaybe<CommentsLegacyIdCommentInput>;
  moderatorComments?: InputMaybe<CommentsModeratorCommentsInput>;
  nominations2018?: InputMaybe<CommentsNominations2018Input>;
  nominations2019?: InputMaybe<CommentsNominations2019Input>;
  postCommentsBest?: InputMaybe<CommentsPostCommentsBestInput>;
  postCommentsDeleted?: InputMaybe<CommentsPostCommentsDeletedInput>;
  postCommentsMagic?: InputMaybe<CommentsPostCommentsMagicInput>;
  postCommentsNew?: InputMaybe<CommentsPostCommentsNewInput>;
  postCommentsOld?: InputMaybe<CommentsPostCommentsOldInput>;
  postCommentsRecentReplies?: InputMaybe<CommentsPostCommentsRecentRepliesInput>;
  postCommentsTop?: InputMaybe<CommentsPostCommentsTopInput>;
  postLWComments?: InputMaybe<CommentsPostLwCommentsInput>;
  postsItemComments?: InputMaybe<CommentsPostsItemCommentsInput>;
  profileComments?: InputMaybe<CommentsProfileCommentsInput>;
  profileRecentComments?: InputMaybe<CommentsProfileRecentCommentsInput>;
  questionAnswers?: InputMaybe<CommentsQuestionAnswersInput>;
  recentComments?: InputMaybe<CommentsRecentCommentsInput>;
  recentDebateResponses?: InputMaybe<CommentsRecentDebateResponsesInput>;
  recentDiscussionThread?: InputMaybe<CommentsRecentDiscussionThreadInput>;
  rejected?: InputMaybe<CommentsRejectedInput>;
  repliesToAnswer?: InputMaybe<CommentsRepliesToAnswerInput>;
  repliesToCommentThread?: InputMaybe<CommentsRepliesToCommentThreadInput>;
  repliesToCommentThreadIncludingRoot?: InputMaybe<CommentsRepliesToCommentThreadIncludingRootInput>;
  reviews?: InputMaybe<CommentsReviewsInput>;
  reviews2018?: InputMaybe<CommentsReviews2018Input>;
  reviews2019?: InputMaybe<CommentsReviews2019Input>;
  rss?: InputMaybe<CommentsRssInput>;
  shortform?: InputMaybe<CommentsShortformInput>;
  shortformFrontpage?: InputMaybe<CommentsShortformFrontpageInput>;
  shortformLatestChildren?: InputMaybe<CommentsShortformLatestChildrenInput>;
  sunshineNewCommentsList?: InputMaybe<CommentsSunshineNewCommentsListInput>;
  sunshineNewUsersComments?: InputMaybe<CommentsSunshineNewUsersCommentsInput>;
  tagDiscussionComments?: InputMaybe<CommentsTagDiscussionCommentsInput>;
  tagSubforumComments?: InputMaybe<CommentsTagSubforumCommentsInput>;
  topShortform?: InputMaybe<CommentsTopShortformInput>;
};

export enum CommentSortingMode {
  GroupByPost = 'groupByPost',
  Magic = 'magic',
  New = 'new',
  Newest = 'newest',
  Old = 'old',
  Oldest = 'oldest',
  RecentComments = 'recentComments',
  RecentDiscussion = 'recentDiscussion',
  Top = 'top'
}

export type CommentsAfPostCommentsTopInput = {
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  commentIds?: InputMaybe<Array<Scalars['String']['input']>>;
  minimumKarma?: InputMaybe<Scalars['Int']['input']>;
  postId?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type CommentsAfRecentDiscussionThreadInput = {
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  commentIds?: InputMaybe<Array<Scalars['String']['input']>>;
  limit?: InputMaybe<Scalars['String']['input']>;
  minimumKarma?: InputMaybe<Scalars['Int']['input']>;
  postId?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type CommentsAfSubmissionsInput = {
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  commentIds?: InputMaybe<Array<Scalars['String']['input']>>;
  limit?: InputMaybe<Scalars['String']['input']>;
  minimumKarma?: InputMaybe<Scalars['Int']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type CommentsAlignmentSuggestedCommentsInput = {
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  commentIds?: InputMaybe<Array<Scalars['String']['input']>>;
  minimumKarma?: InputMaybe<Scalars['Int']['input']>;
  postId?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type CommentsAllCommentsDeletedInput = {
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  commentIds?: InputMaybe<Array<Scalars['String']['input']>>;
  minimumKarma?: InputMaybe<Scalars['Int']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type CommentsAllRecentCommentsInput = {
  after?: InputMaybe<Scalars['String']['input']>;
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  commentIds?: InputMaybe<Array<Scalars['String']['input']>>;
  limit?: InputMaybe<Scalars['String']['input']>;
  minimumKarma?: InputMaybe<Scalars['Int']['input']>;
  sortBy?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type CommentsAnswersAndRepliesInput = {
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  commentIds?: InputMaybe<Array<Scalars['String']['input']>>;
  minimumKarma?: InputMaybe<Scalars['Int']['input']>;
  postId?: InputMaybe<Scalars['String']['input']>;
  sortBy?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type CommentsCheckedByModGptInput = {
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  commentIds?: InputMaybe<Array<Scalars['String']['input']>>;
  minimumKarma?: InputMaybe<Scalars['Int']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type CommentsCommentRepliesInput = {
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  commentIds?: InputMaybe<Array<Scalars['String']['input']>>;
  minimumKarma?: InputMaybe<Scalars['Int']['input']>;
  parentCommentId?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type CommentsDebateResponsesInput = {
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  commentIds?: InputMaybe<Array<Scalars['String']['input']>>;
  minimumKarma?: InputMaybe<Scalars['Int']['input']>;
  postId?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type CommentsDefaultModeratorResponsesInput = {
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  commentIds?: InputMaybe<Array<Scalars['String']['input']>>;
  minimumKarma?: InputMaybe<Scalars['Int']['input']>;
  tagId?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type CommentsDraftCommentsInput = {
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  commentIds?: InputMaybe<Array<Scalars['String']['input']>>;
  drafts?: InputMaybe<Scalars['String']['input']>;
  minimumKarma?: InputMaybe<Scalars['Int']['input']>;
  postId?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type CommentsForumEventCommentsInput = {
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  commentIds?: InputMaybe<Array<Scalars['String']['input']>>;
  forumEventId?: InputMaybe<Scalars['String']['input']>;
  minimumKarma?: InputMaybe<Scalars['Int']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type CommentsLatestSubforumDiscussionInput = {
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  commentIds?: InputMaybe<Array<Scalars['String']['input']>>;
  minimumKarma?: InputMaybe<Scalars['Int']['input']>;
  profileTagIds?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type CommentsLegacyIdCommentInput = {
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  commentIds?: InputMaybe<Array<Scalars['String']['input']>>;
  legacyId?: InputMaybe<Scalars['String']['input']>;
  minimumKarma?: InputMaybe<Scalars['Int']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type CommentsModeratorCommentsInput = {
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  commentIds?: InputMaybe<Array<Scalars['String']['input']>>;
  minimumKarma?: InputMaybe<Scalars['Int']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type CommentsNominations2018Input = {
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  commentIds?: InputMaybe<Array<Scalars['String']['input']>>;
  minimumKarma?: InputMaybe<Scalars['Int']['input']>;
  postId?: InputMaybe<Scalars['String']['input']>;
  sortBy?: InputMaybe<CommentSortingMode>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type CommentsNominations2019Input = {
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  commentIds?: InputMaybe<Array<Scalars['String']['input']>>;
  minimumKarma?: InputMaybe<Scalars['Int']['input']>;
  postId?: InputMaybe<Scalars['String']['input']>;
  sortBy?: InputMaybe<CommentSortingMode>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type CommentsPostCommentsBestInput = {
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  commentIds?: InputMaybe<Array<Scalars['String']['input']>>;
  minimumKarma?: InputMaybe<Scalars['Int']['input']>;
  postId?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type CommentsPostCommentsDeletedInput = {
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  commentIds?: InputMaybe<Array<Scalars['String']['input']>>;
  minimumKarma?: InputMaybe<Scalars['Int']['input']>;
  postId?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type CommentsPostCommentsMagicInput = {
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  commentIds?: InputMaybe<Array<Scalars['String']['input']>>;
  minimumKarma?: InputMaybe<Scalars['Int']['input']>;
  postId?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type CommentsPostCommentsNewInput = {
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  commentIds?: InputMaybe<Array<Scalars['String']['input']>>;
  minimumKarma?: InputMaybe<Scalars['Int']['input']>;
  postId?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type CommentsPostCommentsOldInput = {
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  commentIds?: InputMaybe<Array<Scalars['String']['input']>>;
  minimumKarma?: InputMaybe<Scalars['Int']['input']>;
  postId?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type CommentsPostCommentsRecentRepliesInput = {
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  commentIds?: InputMaybe<Array<Scalars['String']['input']>>;
  minimumKarma?: InputMaybe<Scalars['Int']['input']>;
  postId?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type CommentsPostCommentsTopInput = {
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  commentIds?: InputMaybe<Array<Scalars['String']['input']>>;
  minimumKarma?: InputMaybe<Scalars['Int']['input']>;
  postId?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type CommentsPostLwCommentsInput = {
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  commentIds?: InputMaybe<Array<Scalars['String']['input']>>;
  minimumKarma?: InputMaybe<Scalars['Int']['input']>;
  postId?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type CommentsPostsItemCommentsInput = {
  after?: InputMaybe<Scalars['String']['input']>;
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  commentIds?: InputMaybe<Array<Scalars['String']['input']>>;
  limit?: InputMaybe<Scalars['String']['input']>;
  minimumKarma?: InputMaybe<Scalars['Int']['input']>;
  postId?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type CommentsProfileCommentsInput = {
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  commentIds?: InputMaybe<Array<Scalars['String']['input']>>;
  drafts?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['String']['input']>;
  minimumKarma?: InputMaybe<Scalars['Int']['input']>;
  sortBy?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type CommentsProfileRecentCommentsInput = {
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  commentIds?: InputMaybe<Array<Scalars['String']['input']>>;
  limit?: InputMaybe<Scalars['String']['input']>;
  minimumKarma?: InputMaybe<Scalars['Int']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type CommentsQuestionAnswersInput = {
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  commentIds?: InputMaybe<Array<Scalars['String']['input']>>;
  minimumKarma?: InputMaybe<Scalars['Int']['input']>;
  postId?: InputMaybe<Scalars['String']['input']>;
  sortBy?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type CommentsRecentCommentsInput = {
  after?: InputMaybe<Scalars['String']['input']>;
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  commentIds?: InputMaybe<Array<Scalars['String']['input']>>;
  limit?: InputMaybe<Scalars['String']['input']>;
  minimumKarma?: InputMaybe<Scalars['Int']['input']>;
  sortBy?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type CommentsRecentDebateResponsesInput = {
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  commentIds?: InputMaybe<Array<Scalars['String']['input']>>;
  limit?: InputMaybe<Scalars['String']['input']>;
  minimumKarma?: InputMaybe<Scalars['Int']['input']>;
  postId?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type CommentsRecentDiscussionThreadInput = {
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  commentIds?: InputMaybe<Array<Scalars['String']['input']>>;
  limit?: InputMaybe<Scalars['String']['input']>;
  minimumKarma?: InputMaybe<Scalars['Int']['input']>;
  postId?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type CommentsRejectedInput = {
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  commentIds?: InputMaybe<Array<Scalars['String']['input']>>;
  limit?: InputMaybe<Scalars['String']['input']>;
  minimumKarma?: InputMaybe<Scalars['Int']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type CommentsRepliesToAnswerInput = {
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  commentIds?: InputMaybe<Array<Scalars['String']['input']>>;
  minimumKarma?: InputMaybe<Scalars['Int']['input']>;
  parentAnswerId?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type CommentsRepliesToCommentThreadIncludingRootInput = {
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  commentIds?: InputMaybe<Array<Scalars['String']['input']>>;
  minimumKarma?: InputMaybe<Scalars['Int']['input']>;
  topLevelCommentId: Scalars['String']['input'];
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type CommentsRepliesToCommentThreadInput = {
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  commentIds?: InputMaybe<Array<Scalars['String']['input']>>;
  minimumKarma?: InputMaybe<Scalars['Int']['input']>;
  topLevelCommentId?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type CommentsReviews2018Input = {
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  commentIds?: InputMaybe<Array<Scalars['String']['input']>>;
  minimumKarma?: InputMaybe<Scalars['Int']['input']>;
  postId?: InputMaybe<Scalars['String']['input']>;
  sortBy?: InputMaybe<CommentSortingMode>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type CommentsReviews2019Input = {
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  commentIds?: InputMaybe<Array<Scalars['String']['input']>>;
  minimumKarma?: InputMaybe<Scalars['Int']['input']>;
  postId?: InputMaybe<Scalars['String']['input']>;
  sortBy?: InputMaybe<CommentSortingMode>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type CommentsReviewsInput = {
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  commentIds?: InputMaybe<Array<Scalars['String']['input']>>;
  minimumKarma?: InputMaybe<Scalars['Int']['input']>;
  postId?: InputMaybe<Scalars['String']['input']>;
  reviewYear?: InputMaybe<Scalars['Int']['input']>;
  sortBy?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type CommentsRssInput = {
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  commentIds?: InputMaybe<Array<Scalars['String']['input']>>;
  minimumKarma?: InputMaybe<Scalars['Int']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type CommentsShortformFrontpageInput = {
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  commentIds?: InputMaybe<Array<Scalars['String']['input']>>;
  maxAgeDays?: InputMaybe<Scalars['Int']['input']>;
  minimumKarma?: InputMaybe<Scalars['Int']['input']>;
  relevantTagId?: InputMaybe<Scalars['String']['input']>;
  showCommunity?: InputMaybe<Scalars['Boolean']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type CommentsShortformInput = {
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  commentIds?: InputMaybe<Array<Scalars['String']['input']>>;
  minimumKarma?: InputMaybe<Scalars['Int']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type CommentsShortformLatestChildrenInput = {
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  commentIds?: InputMaybe<Array<Scalars['String']['input']>>;
  minimumKarma?: InputMaybe<Scalars['Int']['input']>;
  topLevelCommentId?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type CommentsSunshineNewCommentsListInput = {
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  commentIds?: InputMaybe<Array<Scalars['String']['input']>>;
  limit?: InputMaybe<Scalars['String']['input']>;
  minimumKarma?: InputMaybe<Scalars['Int']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type CommentsSunshineNewUsersCommentsInput = {
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  commentIds?: InputMaybe<Array<Scalars['String']['input']>>;
  minimumKarma?: InputMaybe<Scalars['Int']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type CommentsTagDiscussionCommentsInput = {
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  commentIds?: InputMaybe<Array<Scalars['String']['input']>>;
  minimumKarma?: InputMaybe<Scalars['Int']['input']>;
  tagId?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type CommentsTagSubforumCommentsInput = {
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  commentIds?: InputMaybe<Array<Scalars['String']['input']>>;
  minimumKarma?: InputMaybe<Scalars['Int']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type CommentsTopShortformInput = {
  after?: InputMaybe<Scalars['String']['input']>;
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  commentIds?: InputMaybe<Array<Scalars['String']['input']>>;
  minimumKarma?: InputMaybe<Scalars['Int']['input']>;
  shortformFrontpage?: InputMaybe<Scalars['Boolean']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export enum ContentCollectionName {
  Comments = 'Comments',
  Posts = 'Posts'
}

export type ContentTypeInput = {
  data: Scalars['ContentTypeData']['input'];
  type: Scalars['String']['input'];
};

export type ConversationSelector = {
  default?: InputMaybe<EmptyViewInput>;
  moderatorConversations?: InputMaybe<ConversationsModeratorConversationsInput>;
  userConversations?: InputMaybe<ConversationsUserConversationsInput>;
  userConversationsAll?: InputMaybe<ConversationsUserConversationsAllInput>;
  userGroupUntitledConversations?: InputMaybe<ConversationsUserGroupUntitledConversationsInput>;
};

export type ConversationsModeratorConversationsInput = {
  showArchive?: InputMaybe<Scalars['Boolean']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type ConversationsUserConversationsAllInput = {
  showArchive?: InputMaybe<Scalars['Boolean']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type ConversationsUserConversationsInput = {
  showArchive?: InputMaybe<Scalars['Boolean']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type ConversationsUserGroupUntitledConversationsInput = {
  moderator?: InputMaybe<Scalars['String']['input']>;
  participantIds?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type CreateAdvisorRequestDataInput = {
  interestedInMetaculus?: InputMaybe<Scalars['Boolean']['input']>;
  jobAds?: InputMaybe<Scalars['JSON']['input']>;
  legacyData?: InputMaybe<Scalars['JSON']['input']>;
  userId: Scalars['String']['input'];
};

export type CreateAdvisorRequestInput = {
  data: CreateAdvisorRequestDataInput;
};

export type CreateBookDataInput = {
  collectionId: Scalars['String']['input'];
  contents?: InputMaybe<CreateRevisionDataInput>;
  displaySequencesAsGrid?: InputMaybe<Scalars['Boolean']['input']>;
  hideProgressBar?: InputMaybe<Scalars['Boolean']['input']>;
  legacyData?: InputMaybe<Scalars['JSON']['input']>;
  number?: InputMaybe<Scalars['Float']['input']>;
  postIds?: InputMaybe<Array<Scalars['String']['input']>>;
  sequenceIds?: InputMaybe<Array<Scalars['String']['input']>>;
  showChapters?: InputMaybe<Scalars['Boolean']['input']>;
  subtitle?: InputMaybe<Scalars['String']['input']>;
  title?: InputMaybe<Scalars['String']['input']>;
  tocTitle?: InputMaybe<Scalars['String']['input']>;
};

export type CreateBookInput = {
  data: CreateBookDataInput;
};

export type CreateChapterDataInput = {
  contents?: InputMaybe<CreateRevisionDataInput>;
  legacyData?: InputMaybe<Scalars['JSON']['input']>;
  number?: InputMaybe<Scalars['Float']['input']>;
  postIds: Array<Scalars['String']['input']>;
  sequenceId?: InputMaybe<Scalars['String']['input']>;
  subtitle?: InputMaybe<Scalars['String']['input']>;
  title?: InputMaybe<Scalars['String']['input']>;
};

export type CreateChapterInput = {
  data: CreateChapterDataInput;
};

export type CreateCollectionDataInput = {
  contents?: InputMaybe<CreateRevisionDataInput>;
  createdAt: Scalars['Date']['input'];
  firstPageLink?: InputMaybe<Scalars['String']['input']>;
  gridImageId?: InputMaybe<Scalars['String']['input']>;
  hideStartReadingButton?: InputMaybe<Scalars['Boolean']['input']>;
  legacyData?: InputMaybe<Scalars['JSON']['input']>;
  noindex?: InputMaybe<Scalars['Boolean']['input']>;
  slug: Scalars['String']['input'];
  title: Scalars['String']['input'];
};

export type CreateCollectionInput = {
  data: CreateCollectionDataInput;
};

export type CreateCommentDataInput = {
  af?: InputMaybe<Scalars['Boolean']['input']>;
  afDate?: InputMaybe<Scalars['Date']['input']>;
  agentFoundationsId?: InputMaybe<Scalars['String']['input']>;
  answer?: InputMaybe<Scalars['Boolean']['input']>;
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  contents?: InputMaybe<CreateRevisionDataInput>;
  debateResponse?: InputMaybe<Scalars['Boolean']['input']>;
  deleted?: InputMaybe<Scalars['Boolean']['input']>;
  deletedByUserId?: InputMaybe<Scalars['String']['input']>;
  deletedDate?: InputMaybe<Scalars['Date']['input']>;
  deletedPublic?: InputMaybe<Scalars['Boolean']['input']>;
  deletedReason?: InputMaybe<Scalars['String']['input']>;
  draft?: InputMaybe<Scalars['Boolean']['input']>;
  forumEventId?: InputMaybe<Scalars['String']['input']>;
  forumEventMetadata?: InputMaybe<Scalars['JSON']['input']>;
  hideKarma?: InputMaybe<Scalars['Boolean']['input']>;
  hideModeratorHat?: InputMaybe<Scalars['Boolean']['input']>;
  isPinnedOnProfile?: InputMaybe<Scalars['Boolean']['input']>;
  legacy?: InputMaybe<Scalars['Boolean']['input']>;
  legacyData?: InputMaybe<Scalars['JSON']['input']>;
  legacyId?: InputMaybe<Scalars['String']['input']>;
  legacyParentId?: InputMaybe<Scalars['String']['input']>;
  legacyPoll?: InputMaybe<Scalars['Boolean']['input']>;
  modGPTAnalysis?: InputMaybe<Scalars['String']['input']>;
  modGPTRecommendation?: InputMaybe<Scalars['String']['input']>;
  moderatorHat?: InputMaybe<Scalars['Boolean']['input']>;
  needsReview?: InputMaybe<Scalars['Boolean']['input']>;
  nominatedForReview?: InputMaybe<Scalars['String']['input']>;
  originalDialogueId?: InputMaybe<Scalars['String']['input']>;
  parentAnswerId?: InputMaybe<Scalars['String']['input']>;
  parentCommentId?: InputMaybe<Scalars['String']['input']>;
  postId?: InputMaybe<Scalars['String']['input']>;
  promotedByUserId?: InputMaybe<Scalars['String']['input']>;
  rejected?: InputMaybe<Scalars['Boolean']['input']>;
  rejectedByUserId?: InputMaybe<Scalars['String']['input']>;
  rejectedReason?: InputMaybe<Scalars['String']['input']>;
  relevantTagIds?: InputMaybe<Array<Scalars['String']['input']>>;
  retracted?: InputMaybe<Scalars['Boolean']['input']>;
  reviewedByUserId?: InputMaybe<Scalars['String']['input']>;
  reviewingForReview?: InputMaybe<Scalars['String']['input']>;
  shortform?: InputMaybe<Scalars['Boolean']['input']>;
  shortformFrontpage?: InputMaybe<Scalars['Boolean']['input']>;
  spam?: InputMaybe<Scalars['Boolean']['input']>;
  subforumStickyPriority?: InputMaybe<Scalars['Float']['input']>;
  tagCommentType?: InputMaybe<TagCommentType>;
  tagId?: InputMaybe<Scalars['String']['input']>;
  title?: InputMaybe<Scalars['String']['input']>;
  topLevelCommentId?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type CreateCommentInput = {
  data: CreateCommentDataInput;
};

export type CreateCommentModeratorActionDataInput = {
  commentId?: InputMaybe<Scalars['String']['input']>;
  endedAt?: InputMaybe<Scalars['Date']['input']>;
  legacyData?: InputMaybe<Scalars['JSON']['input']>;
  type: Scalars['String']['input'];
};

export type CreateCommentModeratorActionInput = {
  data: CreateCommentModeratorActionDataInput;
};

export type CreateConversationDataInput = {
  af?: InputMaybe<Scalars['Boolean']['input']>;
  archivedByIds?: InputMaybe<Array<Scalars['String']['input']>>;
  legacyData?: InputMaybe<Scalars['JSON']['input']>;
  moderator?: InputMaybe<Scalars['Boolean']['input']>;
  participantIds?: InputMaybe<Array<Scalars['String']['input']>>;
  title?: InputMaybe<Scalars['String']['input']>;
};

export type CreateConversationInput = {
  data: CreateConversationDataInput;
};

export type CreateCurationNoticeDataInput = {
  commentId?: InputMaybe<Scalars['String']['input']>;
  contents?: InputMaybe<CreateRevisionDataInput>;
  legacyData?: InputMaybe<Scalars['JSON']['input']>;
  postId: Scalars['String']['input'];
  userId: Scalars['String']['input'];
};

export type CreateCurationNoticeInput = {
  data: CreateCurationNoticeDataInput;
};

export type CreateDigestDataInput = {
  endDate?: InputMaybe<Scalars['Date']['input']>;
  legacyData?: InputMaybe<Scalars['JSON']['input']>;
  num: Scalars['Float']['input'];
  onsiteImageId?: InputMaybe<Scalars['String']['input']>;
  onsitePrimaryColor?: InputMaybe<Scalars['String']['input']>;
  publishedDate?: InputMaybe<Scalars['Date']['input']>;
  startDate: Scalars['Date']['input'];
};

export type CreateDigestInput = {
  data: CreateDigestDataInput;
};

export type CreateDigestPostDataInput = {
  digestId: Scalars['String']['input'];
  emailDigestStatus?: InputMaybe<Scalars['String']['input']>;
  legacyData?: InputMaybe<Scalars['JSON']['input']>;
  onsiteDigestStatus?: InputMaybe<Scalars['String']['input']>;
  postId: Scalars['String']['input'];
};

export type CreateDigestPostInput = {
  data: CreateDigestPostDataInput;
};

export type CreateElectionCandidateDataInput = {
  amountRaised?: InputMaybe<Scalars['Float']['input']>;
  description: Scalars['String']['input'];
  electionName: Scalars['String']['input'];
  fundraiserLink?: InputMaybe<Scalars['String']['input']>;
  gwwcId?: InputMaybe<Scalars['String']['input']>;
  gwwcLink?: InputMaybe<Scalars['String']['input']>;
  href: Scalars['String']['input'];
  isElectionFundraiser?: InputMaybe<Scalars['Boolean']['input']>;
  legacyData?: InputMaybe<Scalars['JSON']['input']>;
  logoSrc: Scalars['String']['input'];
  name: Scalars['String']['input'];
  tagId: Scalars['String']['input'];
  targetAmount?: InputMaybe<Scalars['Float']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type CreateElectionCandidateInput = {
  data: CreateElectionCandidateDataInput;
};

export type CreateElectionVoteDataInput = {
  compareState?: InputMaybe<Scalars['JSON']['input']>;
  electionName: Scalars['String']['input'];
  legacyData?: InputMaybe<Scalars['JSON']['input']>;
  submissionComments?: InputMaybe<Scalars['JSON']['input']>;
  submittedAt?: InputMaybe<Scalars['Date']['input']>;
  userExplanation?: InputMaybe<Scalars['String']['input']>;
  userId: Scalars['String']['input'];
  userOtherComments?: InputMaybe<Scalars['String']['input']>;
  vote?: InputMaybe<Scalars['JSON']['input']>;
};

export type CreateElectionVoteInput = {
  data: CreateElectionVoteDataInput;
};

export type CreateElicitQuestionDataInput = {
  legacyData?: InputMaybe<Scalars['JSON']['input']>;
  notes?: InputMaybe<Scalars['String']['input']>;
  resolution?: InputMaybe<Scalars['String']['input']>;
  resolvesBy?: InputMaybe<Scalars['Date']['input']>;
  title: Scalars['String']['input'];
};

export type CreateElicitQuestionInput = {
  data: CreateElicitQuestionDataInput;
};

export type CreateForumEventDataInput = {
  bannerImageId?: InputMaybe<Scalars['String']['input']>;
  bannerTextColor?: InputMaybe<Scalars['String']['input']>;
  commentId?: InputMaybe<Scalars['String']['input']>;
  commentPrompt?: InputMaybe<Scalars['String']['input']>;
  contrastColor?: InputMaybe<Scalars['String']['input']>;
  customComponent?: InputMaybe<ForumEventCustomComponent>;
  darkColor?: InputMaybe<Scalars['String']['input']>;
  endDate?: InputMaybe<Scalars['Date']['input']>;
  eventFormat?: InputMaybe<ForumEventFormat>;
  frontpageDescription?: InputMaybe<CreateRevisionDataInput>;
  frontpageDescriptionMobile?: InputMaybe<CreateRevisionDataInput>;
  includesPoll?: InputMaybe<Scalars['Boolean']['input']>;
  isGlobal?: InputMaybe<Scalars['Boolean']['input']>;
  legacyData?: InputMaybe<Scalars['JSON']['input']>;
  lightColor?: InputMaybe<Scalars['String']['input']>;
  maxStickersPerUser?: InputMaybe<Scalars['Float']['input']>;
  pollAgreeWording?: InputMaybe<Scalars['String']['input']>;
  pollDisagreeWording?: InputMaybe<Scalars['String']['input']>;
  pollQuestion?: InputMaybe<CreateRevisionDataInput>;
  postId?: InputMaybe<Scalars['String']['input']>;
  postPageDescription?: InputMaybe<CreateRevisionDataInput>;
  publicData?: InputMaybe<Scalars['JSON']['input']>;
  startDate: Scalars['Date']['input'];
  tagId?: InputMaybe<Scalars['String']['input']>;
  title: Scalars['String']['input'];
};

export type CreateForumEventInput = {
  data: CreateForumEventDataInput;
};

export type CreateJargonTermDataInput = {
  altTerms: Array<Scalars['String']['input']>;
  approved?: InputMaybe<Scalars['Boolean']['input']>;
  contents?: InputMaybe<CreateRevisionDataInput>;
  deleted?: InputMaybe<Scalars['Boolean']['input']>;
  legacyData?: InputMaybe<Scalars['JSON']['input']>;
  postId: Scalars['String']['input'];
  term: Scalars['String']['input'];
};

export type CreateJargonTermInput = {
  data: CreateJargonTermDataInput;
};

export type CreateLwEventDataInput = {
  documentId?: InputMaybe<Scalars['String']['input']>;
  important?: InputMaybe<Scalars['Boolean']['input']>;
  intercom?: InputMaybe<Scalars['Boolean']['input']>;
  legacyData?: InputMaybe<Scalars['JSON']['input']>;
  name: Scalars['String']['input'];
  properties?: InputMaybe<Scalars['JSON']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type CreateLwEventInput = {
  data: CreateLwEventDataInput;
};

export type CreateLocalgroupDataInput = {
  bannerImageId?: InputMaybe<Scalars['String']['input']>;
  categories?: InputMaybe<Array<Scalars['String']['input']>>;
  contactInfo?: InputMaybe<Scalars['String']['input']>;
  contents?: InputMaybe<CreateRevisionDataInput>;
  deleted?: InputMaybe<Scalars['Boolean']['input']>;
  facebookLink?: InputMaybe<Scalars['String']['input']>;
  facebookPageLink?: InputMaybe<Scalars['String']['input']>;
  googleLocation?: InputMaybe<Scalars['JSON']['input']>;
  inactive?: InputMaybe<Scalars['Boolean']['input']>;
  isOnline?: InputMaybe<Scalars['Boolean']['input']>;
  lastActivity?: InputMaybe<Scalars['Date']['input']>;
  legacyData?: InputMaybe<Scalars['JSON']['input']>;
  location?: InputMaybe<Scalars['String']['input']>;
  meetupLink?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  nameInAnotherLanguage?: InputMaybe<Scalars['String']['input']>;
  organizerIds: Array<Scalars['String']['input']>;
  slackLink?: InputMaybe<Scalars['String']['input']>;
  types: Array<Scalars['String']['input']>;
  website?: InputMaybe<Scalars['String']['input']>;
};

export type CreateLocalgroupInput = {
  data: CreateLocalgroupDataInput;
};

export type CreateMessageDataInput = {
  contents?: InputMaybe<CreateRevisionDataInput>;
  conversationId: Scalars['String']['input'];
  legacyData?: InputMaybe<Scalars['JSON']['input']>;
  noEmail?: InputMaybe<Scalars['Boolean']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type CreateMessageInput = {
  data: CreateMessageDataInput;
};

export type CreateModerationTemplateDataInput = {
  collectionName: ModerationTemplateType;
  contents?: InputMaybe<CreateRevisionDataInput>;
  groupLabel?: InputMaybe<Scalars['String']['input']>;
  legacyData?: InputMaybe<Scalars['JSON']['input']>;
  name: Scalars['String']['input'];
  order?: InputMaybe<Scalars['Float']['input']>;
};

export type CreateModerationTemplateInput = {
  data: CreateModerationTemplateDataInput;
};

export type CreateModeratorActionDataInput = {
  endedAt?: InputMaybe<Scalars['Date']['input']>;
  legacyData?: InputMaybe<Scalars['JSON']['input']>;
  type: ModeratorActionType;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type CreateModeratorActionInput = {
  data: CreateModeratorActionDataInput;
};

export type CreateMultiDocumentDataInput = {
  collectionName: MultiDocumentCollectionName;
  contents?: InputMaybe<CreateRevisionDataInput>;
  fieldName: MultiDocumentFieldName;
  legacyData?: InputMaybe<Scalars['JSON']['input']>;
  parentDocumentId: Scalars['String']['input'];
  slug?: InputMaybe<Scalars['String']['input']>;
  tabSubtitle?: InputMaybe<Scalars['String']['input']>;
  tabTitle: Scalars['String']['input'];
  title?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type CreateMultiDocumentInput = {
  data: CreateMultiDocumentDataInput;
};

export type CreatePetrovDayActionDataInput = {
  actionType: Scalars['String']['input'];
  data?: InputMaybe<Scalars['JSON']['input']>;
  legacyData?: InputMaybe<Scalars['JSON']['input']>;
  userId: Scalars['String']['input'];
};

export type CreatePetrovDayActionInput = {
  data: CreatePetrovDayActionDataInput;
};

export type CreatePodcastEpisodeDataInput = {
  episodeLink: Scalars['String']['input'];
  externalEpisodeId: Scalars['String']['input'];
  legacyData?: InputMaybe<Scalars['JSON']['input']>;
  podcastId?: InputMaybe<Scalars['String']['input']>;
  title: Scalars['String']['input'];
};

export type CreatePodcastEpisodeInput = {
  data: CreatePodcastEpisodeDataInput;
};

export type CreatePostDataInput = {
  activateRSVPs?: InputMaybe<Scalars['Boolean']['input']>;
  af?: InputMaybe<Scalars['Boolean']['input']>;
  afDate?: InputMaybe<Scalars['Date']['input']>;
  afSticky?: InputMaybe<Scalars['Boolean']['input']>;
  agentFoundationsId?: InputMaybe<Scalars['String']['input']>;
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  autoFrontpage?: InputMaybe<Scalars['String']['input']>;
  bannedUserIds?: InputMaybe<Array<Scalars['String']['input']>>;
  canonicalBookId?: InputMaybe<Scalars['String']['input']>;
  canonicalCollectionSlug?: InputMaybe<Scalars['String']['input']>;
  canonicalNextPostSlug?: InputMaybe<Scalars['String']['input']>;
  canonicalPrevPostSlug?: InputMaybe<Scalars['String']['input']>;
  canonicalSequenceId?: InputMaybe<Scalars['String']['input']>;
  canonicalSource?: InputMaybe<Scalars['String']['input']>;
  coauthorStatuses?: InputMaybe<Array<CoauthorStatusInput>>;
  coauthorUserIds?: InputMaybe<Array<Scalars['String']['input']>>;
  collabEditorDialogue?: InputMaybe<Scalars['Boolean']['input']>;
  collectionTitle?: InputMaybe<Scalars['String']['input']>;
  commentSortOrder?: InputMaybe<Scalars['String']['input']>;
  commentsLocked?: InputMaybe<Scalars['Boolean']['input']>;
  commentsLockedToAccountsCreatedAfter?: InputMaybe<Scalars['Date']['input']>;
  contactInfo?: InputMaybe<Scalars['String']['input']>;
  contents?: InputMaybe<CreateRevisionDataInput>;
  curatedDate?: InputMaybe<Scalars['Date']['input']>;
  customHighlight?: InputMaybe<CreateRevisionDataInput>;
  defaultRecommendation?: InputMaybe<Scalars['Boolean']['input']>;
  disableRecommendation?: InputMaybe<Scalars['Boolean']['input']>;
  disableSidenotes?: InputMaybe<Scalars['Boolean']['input']>;
  draft?: InputMaybe<Scalars['Boolean']['input']>;
  endTime?: InputMaybe<Scalars['Date']['input']>;
  eventImageId?: InputMaybe<Scalars['String']['input']>;
  eventRegistrationLink?: InputMaybe<Scalars['String']['input']>;
  eventType?: InputMaybe<Scalars['String']['input']>;
  facebookLink?: InputMaybe<Scalars['String']['input']>;
  feedId?: InputMaybe<Scalars['String']['input']>;
  feedLink?: InputMaybe<Scalars['String']['input']>;
  fmCrosspost?: InputMaybe<CrosspostInput>;
  forceAllowType3Audio?: InputMaybe<Scalars['Boolean']['input']>;
  frontpageDate?: InputMaybe<Scalars['Date']['input']>;
  generateDraftJargon?: InputMaybe<Scalars['Boolean']['input']>;
  globalEvent?: InputMaybe<Scalars['Boolean']['input']>;
  googleLocation?: InputMaybe<Scalars['JSON']['input']>;
  groupId?: InputMaybe<Scalars['String']['input']>;
  hasCoauthorPermission?: InputMaybe<Scalars['Boolean']['input']>;
  hiddenRelatedQuestion?: InputMaybe<Scalars['Boolean']['input']>;
  hideAuthor?: InputMaybe<Scalars['Boolean']['input']>;
  hideCommentKarma?: InputMaybe<Scalars['Boolean']['input']>;
  hideFromPopularComments?: InputMaybe<Scalars['Boolean']['input']>;
  hideFromRecentDiscussions?: InputMaybe<Scalars['Boolean']['input']>;
  hideFrontpageComments?: InputMaybe<Scalars['Boolean']['input']>;
  ignoreRateLimits?: InputMaybe<Scalars['Boolean']['input']>;
  isEvent?: InputMaybe<Scalars['Boolean']['input']>;
  joinEventLink?: InputMaybe<Scalars['String']['input']>;
  legacy?: InputMaybe<Scalars['Boolean']['input']>;
  legacyData?: InputMaybe<Scalars['JSON']['input']>;
  legacyId?: InputMaybe<Scalars['String']['input']>;
  legacySpam?: InputMaybe<Scalars['Boolean']['input']>;
  location?: InputMaybe<Scalars['String']['input']>;
  manifoldReviewMarketId?: InputMaybe<Scalars['String']['input']>;
  meetupLink?: InputMaybe<Scalars['String']['input']>;
  meta?: InputMaybe<Scalars['Boolean']['input']>;
  metaDate?: InputMaybe<Scalars['Date']['input']>;
  metaSticky?: InputMaybe<Scalars['Boolean']['input']>;
  moderationGuidelines?: InputMaybe<CreateRevisionDataInput>;
  moderationStyle?: InputMaybe<Scalars['String']['input']>;
  nextDayReminderSent?: InputMaybe<Scalars['Boolean']['input']>;
  noIndex?: InputMaybe<Scalars['Boolean']['input']>;
  onlineEvent?: InputMaybe<Scalars['Boolean']['input']>;
  onlyVisibleToEstablishedAccounts?: InputMaybe<Scalars['Boolean']['input']>;
  onlyVisibleToLoggedIn?: InputMaybe<Scalars['Boolean']['input']>;
  organizerIds?: InputMaybe<Array<Scalars['String']['input']>>;
  originalPostRelationSourceId?: InputMaybe<Scalars['String']['input']>;
  podcastEpisodeId?: InputMaybe<Scalars['String']['input']>;
  postCategory?: InputMaybe<PostCategory>;
  postedAt?: InputMaybe<Scalars['Date']['input']>;
  question?: InputMaybe<Scalars['Boolean']['input']>;
  readTimeMinutesOverride?: InputMaybe<Scalars['Float']['input']>;
  rejected?: InputMaybe<Scalars['Boolean']['input']>;
  rejectedByUserId?: InputMaybe<Scalars['String']['input']>;
  rejectedReason?: InputMaybe<Scalars['String']['input']>;
  reviewForAlignmentUserId?: InputMaybe<Scalars['String']['input']>;
  reviewForCuratedUserId?: InputMaybe<Scalars['String']['input']>;
  reviewedByUserId?: InputMaybe<Scalars['String']['input']>;
  shareWithUsers?: InputMaybe<Array<Scalars['String']['input']>>;
  sharingSettings?: InputMaybe<Scalars['JSON']['input']>;
  shortform?: InputMaybe<Scalars['Boolean']['input']>;
  sideCommentVisibility?: InputMaybe<Scalars['String']['input']>;
  slug?: InputMaybe<Scalars['String']['input']>;
  socialPreview?: InputMaybe<SocialPreviewInput>;
  socialPreviewImageAutoUrl?: InputMaybe<Scalars['String']['input']>;
  socialPreviewImageId?: InputMaybe<Scalars['String']['input']>;
  startTime?: InputMaybe<Scalars['Date']['input']>;
  status?: InputMaybe<Scalars['Float']['input']>;
  sticky?: InputMaybe<Scalars['Boolean']['input']>;
  stickyPriority?: InputMaybe<Scalars['Int']['input']>;
  subforumTagId?: InputMaybe<Scalars['String']['input']>;
  submitToFrontpage?: InputMaybe<Scalars['Boolean']['input']>;
  suggestForAlignmentUserIds?: InputMaybe<Array<Scalars['String']['input']>>;
  suggestForCuratedUserIds?: InputMaybe<Array<Scalars['String']['input']>>;
  swrCachingEnabled?: InputMaybe<Scalars['Boolean']['input']>;
  tagRelevance?: InputMaybe<Scalars['JSON']['input']>;
  title: Scalars['String']['input'];
  types?: InputMaybe<Array<Scalars['String']['input']>>;
  unlisted?: InputMaybe<Scalars['Boolean']['input']>;
  url?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
  wasEverUndrafted?: InputMaybe<Scalars['Boolean']['input']>;
  website?: InputMaybe<Scalars['String']['input']>;
};

export type CreatePostInput = {
  data: CreatePostDataInput;
};

export type CreateRssFeedDataInput = {
  displayFullContent?: InputMaybe<Scalars['Boolean']['input']>;
  importAsDraft?: InputMaybe<Scalars['Boolean']['input']>;
  legacyData?: InputMaybe<Scalars['JSON']['input']>;
  nickname: Scalars['String']['input'];
  ownedByUser?: InputMaybe<Scalars['Boolean']['input']>;
  rawFeed?: InputMaybe<Scalars['JSON']['input']>;
  setCanonicalUrl?: InputMaybe<Scalars['Boolean']['input']>;
  url: Scalars['String']['input'];
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type CreateRssFeedInput = {
  data: CreateRssFeedDataInput;
};

export type CreateReportDataInput = {
  claimedUserId?: InputMaybe<Scalars['String']['input']>;
  commentId?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  legacyData?: InputMaybe<Scalars['JSON']['input']>;
  link: Scalars['String']['input'];
  postId?: InputMaybe<Scalars['String']['input']>;
  reportedAsSpam?: InputMaybe<Scalars['Boolean']['input']>;
  reportedUserId?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type CreateReportInput = {
  data: CreateReportDataInput;
};

export type CreateRevisionDataInput = {
  commitMessage?: InputMaybe<Scalars['String']['input']>;
  dataWithDiscardedSuggestions?: InputMaybe<Scalars['JSON']['input']>;
  googleDocMetadata?: InputMaybe<Scalars['JSON']['input']>;
  originalContents: ContentTypeInput;
  updateType?: InputMaybe<Scalars['String']['input']>;
};

export type CreateSequenceDataInput = {
  af?: InputMaybe<Scalars['Boolean']['input']>;
  bannerImageId?: InputMaybe<Scalars['String']['input']>;
  canonicalCollectionSlug?: InputMaybe<Scalars['String']['input']>;
  contents?: InputMaybe<CreateRevisionDataInput>;
  curatedOrder?: InputMaybe<Scalars['Float']['input']>;
  draft?: InputMaybe<Scalars['Boolean']['input']>;
  gridImageId?: InputMaybe<Scalars['String']['input']>;
  hidden?: InputMaybe<Scalars['Boolean']['input']>;
  hideFromAuthorPage?: InputMaybe<Scalars['Boolean']['input']>;
  isDeleted?: InputMaybe<Scalars['Boolean']['input']>;
  lastUpdated?: InputMaybe<Scalars['Date']['input']>;
  legacyData?: InputMaybe<Scalars['JSON']['input']>;
  noindex?: InputMaybe<Scalars['Boolean']['input']>;
  title: Scalars['String']['input'];
  userId?: InputMaybe<Scalars['String']['input']>;
  userProfileOrder?: InputMaybe<Scalars['Float']['input']>;
};

export type CreateSequenceInput = {
  data: CreateSequenceDataInput;
};

export type CreateSplashArtCoordinateDataInput = {
  leftFlipped?: InputMaybe<Scalars['Boolean']['input']>;
  leftHeightPct: Scalars['Float']['input'];
  leftWidthPct: Scalars['Float']['input'];
  leftXPct: Scalars['Float']['input'];
  leftYPct: Scalars['Float']['input'];
  legacyData?: InputMaybe<Scalars['JSON']['input']>;
  middleFlipped?: InputMaybe<Scalars['Boolean']['input']>;
  middleHeightPct: Scalars['Float']['input'];
  middleWidthPct: Scalars['Float']['input'];
  middleXPct: Scalars['Float']['input'];
  middleYPct: Scalars['Float']['input'];
  reviewWinnerArtId: Scalars['String']['input'];
  rightFlipped: Scalars['Boolean']['input'];
  rightHeightPct: Scalars['Float']['input'];
  rightWidthPct: Scalars['Float']['input'];
  rightXPct: Scalars['Float']['input'];
  rightYPct: Scalars['Float']['input'];
};

export type CreateSplashArtCoordinateInput = {
  data: CreateSplashArtCoordinateDataInput;
};

export type CreateSpotlightDataInput = {
  customSubtitle?: InputMaybe<Scalars['String']['input']>;
  customTitle?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<CreateRevisionDataInput>;
  documentId: Scalars['String']['input'];
  documentType: SpotlightDocumentType;
  draft?: InputMaybe<Scalars['Boolean']['input']>;
  duration: Scalars['Float']['input'];
  headerTitle?: InputMaybe<Scalars['String']['input']>;
  headerTitleLeftColor?: InputMaybe<Scalars['String']['input']>;
  headerTitleRightColor?: InputMaybe<Scalars['String']['input']>;
  imageFade?: InputMaybe<Scalars['Boolean']['input']>;
  imageFadeColor?: InputMaybe<Scalars['String']['input']>;
  lastPromotedAt: Scalars['Date']['input'];
  legacyData?: InputMaybe<Scalars['JSON']['input']>;
  position?: InputMaybe<Scalars['Float']['input']>;
  showAuthor?: InputMaybe<Scalars['Boolean']['input']>;
  spotlightDarkImageId?: InputMaybe<Scalars['String']['input']>;
  spotlightImageId?: InputMaybe<Scalars['String']['input']>;
  spotlightSplashImageUrl?: InputMaybe<Scalars['String']['input']>;
  subtitleUrl?: InputMaybe<Scalars['String']['input']>;
};

export type CreateSpotlightInput = {
  data: CreateSpotlightDataInput;
};

export type CreateSubscriptionDataInput = {
  collectionName: Scalars['String']['input'];
  documentId: Scalars['String']['input'];
  legacyData?: InputMaybe<Scalars['JSON']['input']>;
  state: Scalars['String']['input'];
  type: Scalars['String']['input'];
};

export type CreateSubscriptionInput = {
  data: CreateSubscriptionDataInput;
};

export type CreateSurveyDataInput = {
  legacyData?: InputMaybe<Scalars['JSON']['input']>;
  name: Scalars['String']['input'];
};

export type CreateSurveyInput = {
  data: CreateSurveyDataInput;
};

export type CreateSurveyQuestionDataInput = {
  format: SurveyQuestionFormat;
  legacyData?: InputMaybe<Scalars['JSON']['input']>;
  order: Scalars['Float']['input'];
  question: Scalars['String']['input'];
  surveyId: Scalars['String']['input'];
};

export type CreateSurveyQuestionInput = {
  data: CreateSurveyQuestionDataInput;
};

export type CreateSurveyResponseDataInput = {
  clientId: Scalars['String']['input'];
  legacyData?: InputMaybe<Scalars['JSON']['input']>;
  response: Scalars['JSON']['input'];
  surveyId: Scalars['String']['input'];
  surveyScheduleId: Scalars['String']['input'];
  userId: Scalars['String']['input'];
};

export type CreateSurveyResponseInput = {
  data: CreateSurveyResponseDataInput;
};

export type CreateSurveyScheduleDataInput = {
  clientIds?: InputMaybe<Array<Scalars['String']['input']>>;
  deactivated?: InputMaybe<Scalars['Boolean']['input']>;
  endDate?: InputMaybe<Scalars['Date']['input']>;
  impressionsLimit?: InputMaybe<Scalars['Float']['input']>;
  legacyData?: InputMaybe<Scalars['JSON']['input']>;
  maxKarma?: InputMaybe<Scalars['Float']['input']>;
  maxVisitorPercentage?: InputMaybe<Scalars['Float']['input']>;
  minKarma?: InputMaybe<Scalars['Float']['input']>;
  name: Scalars['String']['input'];
  startDate?: InputMaybe<Scalars['Date']['input']>;
  surveyId: Scalars['String']['input'];
  target: SurveyScheduleTarget;
};

export type CreateSurveyScheduleInput = {
  data: CreateSurveyScheduleDataInput;
};

export type CreateTagDataInput = {
  adminOnly?: InputMaybe<Scalars['Boolean']['input']>;
  autoTagModel?: InputMaybe<Scalars['String']['input']>;
  autoTagPrompt?: InputMaybe<Scalars['String']['input']>;
  bannerImageId?: InputMaybe<Scalars['String']['input']>;
  canEditUserIds?: InputMaybe<Array<Scalars['String']['input']>>;
  canVoteOnRels?: InputMaybe<Array<TagRelVoteGroup>>;
  core?: InputMaybe<Scalars['Boolean']['input']>;
  coreTagId?: InputMaybe<Scalars['String']['input']>;
  defaultOrder?: InputMaybe<Scalars['Float']['input']>;
  description?: InputMaybe<CreateRevisionDataInput>;
  descriptionTruncationCount?: InputMaybe<Scalars['Float']['input']>;
  forceAllowType3Audio?: InputMaybe<Scalars['Boolean']['input']>;
  introSequenceId?: InputMaybe<Scalars['String']['input']>;
  isPostType?: InputMaybe<Scalars['Boolean']['input']>;
  isSubforum?: InputMaybe<Scalars['Boolean']['input']>;
  legacyData?: InputMaybe<Scalars['JSON']['input']>;
  moderationGuidelines?: InputMaybe<CreateRevisionDataInput>;
  name: Scalars['String']['input'];
  parentTagId?: InputMaybe<Scalars['String']['input']>;
  postsDefaultSortOrder?: InputMaybe<Scalars['String']['input']>;
  reviewedByUserId?: InputMaybe<Scalars['String']['input']>;
  shortName?: InputMaybe<Scalars['String']['input']>;
  slug?: InputMaybe<Scalars['String']['input']>;
  squareImageId?: InputMaybe<Scalars['String']['input']>;
  subTagIds?: InputMaybe<Array<Scalars['String']['input']>>;
  subforumIntroPostId?: InputMaybe<Scalars['String']['input']>;
  subforumModeratorIds?: InputMaybe<Array<Scalars['String']['input']>>;
  subforumWelcomeText?: InputMaybe<CreateRevisionDataInput>;
  subtitle?: InputMaybe<Scalars['String']['input']>;
  suggestedAsFilter?: InputMaybe<Scalars['Boolean']['input']>;
  tagFlagsIds?: InputMaybe<Array<Scalars['String']['input']>>;
  wikiGrade?: InputMaybe<Scalars['Int']['input']>;
  wikiOnly?: InputMaybe<Scalars['Boolean']['input']>;
};

export type CreateTagFlagDataInput = {
  contents?: InputMaybe<CreateRevisionDataInput>;
  deleted?: InputMaybe<Scalars['Boolean']['input']>;
  legacyData?: InputMaybe<Scalars['JSON']['input']>;
  name: Scalars['String']['input'];
  order?: InputMaybe<Scalars['Float']['input']>;
  slug?: InputMaybe<Scalars['String']['input']>;
};

export type CreateTagFlagInput = {
  data: CreateTagFlagDataInput;
};

export type CreateTagInput = {
  data: CreateTagDataInput;
};

export type CreateUltraFeedEventDataInput = {
  collectionName: UltraFeedEventCollectionName;
  documentId: Scalars['String']['input'];
  event: Scalars['JSON']['input'];
  eventType: UltraFeedEventEventType;
  feedItemId?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type CreateUltraFeedEventInput = {
  data: CreateUltraFeedEventDataInput;
};

export type CreateUserDataInput = {
  acceptedTos?: InputMaybe<Scalars['Boolean']['input']>;
  acknowledgedNewUserGuidelines?: InputMaybe<Scalars['Boolean']['input']>;
  afSubmittedApplication?: InputMaybe<Scalars['Boolean']['input']>;
  allCommentingDisabled?: InputMaybe<Scalars['Boolean']['input']>;
  allPostsFilter?: InputMaybe<Scalars['String']['input']>;
  allPostsHideCommunity?: InputMaybe<Scalars['Boolean']['input']>;
  allPostsIncludeEvents?: InputMaybe<Scalars['Boolean']['input']>;
  allPostsOpenSettings?: InputMaybe<Scalars['Boolean']['input']>;
  allPostsShowLowKarma?: InputMaybe<Scalars['Boolean']['input']>;
  allPostsSorting?: InputMaybe<Scalars['String']['input']>;
  allPostsTimeframe?: InputMaybe<Scalars['String']['input']>;
  allowDatadogSessionReplay?: InputMaybe<Scalars['Boolean']['input']>;
  autoSubscribeAsOrganizer?: InputMaybe<Scalars['Boolean']['input']>;
  auto_subscribe_to_my_comments?: InputMaybe<Scalars['Boolean']['input']>;
  auto_subscribe_to_my_posts?: InputMaybe<Scalars['Boolean']['input']>;
  banned?: InputMaybe<Scalars['Date']['input']>;
  bannedPersonalUserIds?: InputMaybe<Array<Scalars['String']['input']>>;
  bannedUserIds?: InputMaybe<Array<Scalars['String']['input']>>;
  biography?: InputMaybe<CreateRevisionDataInput>;
  blueskyProfileURL?: InputMaybe<Scalars['String']['input']>;
  careerStage?: InputMaybe<Array<Scalars['String']['input']>>;
  collapseModerationGuidelines?: InputMaybe<Scalars['Boolean']['input']>;
  commentSorting?: InputMaybe<Scalars['String']['input']>;
  commentingOnOtherUsersDisabled?: InputMaybe<Scalars['Boolean']['input']>;
  conversationsDisabled?: InputMaybe<Scalars['Boolean']['input']>;
  criticismTipsDismissed?: InputMaybe<Scalars['Boolean']['input']>;
  currentFrontpageFilter?: InputMaybe<Scalars['String']['input']>;
  deleteContent?: InputMaybe<Scalars['Boolean']['input']>;
  displayName: Scalars['String']['input'];
  draftsListShowArchived?: InputMaybe<Scalars['Boolean']['input']>;
  draftsListShowShared?: InputMaybe<Scalars['Boolean']['input']>;
  draftsListSorting?: InputMaybe<Scalars['String']['input']>;
  email?: InputMaybe<Scalars['String']['input']>;
  emailSubscribedToCurated?: InputMaybe<Scalars['Boolean']['input']>;
  expandedFrontpageSections?: InputMaybe<ExpandedFrontpageSectionsSettingsInput>;
  facebookProfileURL?: InputMaybe<Scalars['String']['input']>;
  fmCrosspostUserId?: InputMaybe<Scalars['String']['input']>;
  frontpageFilterSettings?: InputMaybe<Scalars['JSON']['input']>;
  frontpageSelectedTab?: InputMaybe<Scalars['String']['input']>;
  githubProfileURL?: InputMaybe<Scalars['String']['input']>;
  googleLocation?: InputMaybe<Scalars['JSON']['input']>;
  groups?: InputMaybe<Array<Scalars['String']['input']>>;
  hideActiveDialogueUsers?: InputMaybe<Scalars['Boolean']['input']>;
  hideCommunitySection?: InputMaybe<Scalars['Boolean']['input']>;
  hideDialogueFacilitation?: InputMaybe<Scalars['Boolean']['input']>;
  hideFromPeopleDirectory?: InputMaybe<Scalars['Boolean']['input']>;
  hideFrontpageBook2019Ad?: InputMaybe<Scalars['Boolean']['input']>;
  hideFrontpageBook2020Ad?: InputMaybe<Scalars['Boolean']['input']>;
  hideFrontpageBookAd?: InputMaybe<Scalars['Boolean']['input']>;
  hideFrontpageFilterSettingsDesktop?: InputMaybe<Scalars['Boolean']['input']>;
  hideFrontpageMap?: InputMaybe<Scalars['Boolean']['input']>;
  hideHomeRHS?: InputMaybe<Scalars['Boolean']['input']>;
  hideIntercom?: InputMaybe<Scalars['Boolean']['input']>;
  hideJobAdUntil?: InputMaybe<Scalars['Date']['input']>;
  hideMeetupsPoke?: InputMaybe<Scalars['Boolean']['input']>;
  hideNavigationSidebar?: InputMaybe<Scalars['Boolean']['input']>;
  hidePostsRecommendations?: InputMaybe<Scalars['Boolean']['input']>;
  hideSubscribePoke?: InputMaybe<Scalars['Boolean']['input']>;
  hideSunshineSidebar?: InputMaybe<Scalars['Boolean']['input']>;
  hideTaggingProgressBar?: InputMaybe<Scalars['Boolean']['input']>;
  howICanHelpOthers?: InputMaybe<CreateRevisionDataInput>;
  howOthersCanHelpMe?: InputMaybe<CreateRevisionDataInput>;
  inactiveSurveyEmailSentAt?: InputMaybe<Scalars['Date']['input']>;
  isAdmin?: InputMaybe<Scalars['Boolean']['input']>;
  jobTitle?: InputMaybe<Scalars['String']['input']>;
  karmaChangeBatchStart?: InputMaybe<Scalars['Date']['input']>;
  karmaChangeLastOpened?: InputMaybe<Scalars['Date']['input']>;
  karmaChangeNotifierSettings?: InputMaybe<Scalars['JSON']['input']>;
  lastNotificationsCheck?: InputMaybe<Scalars['Date']['input']>;
  lastUsedTimezone?: InputMaybe<Scalars['String']['input']>;
  legacy?: InputMaybe<Scalars['Boolean']['input']>;
  legacyData?: InputMaybe<Scalars['JSON']['input']>;
  legacyId?: InputMaybe<Scalars['String']['input']>;
  linkedinProfileURL?: InputMaybe<Scalars['String']['input']>;
  location?: InputMaybe<Scalars['String']['input']>;
  mapLocation?: InputMaybe<Scalars['JSON']['input']>;
  mapMarkerText?: InputMaybe<Scalars['String']['input']>;
  moderationGuidelines?: InputMaybe<CreateRevisionDataInput>;
  moderationStyle?: InputMaybe<Scalars['String']['input']>;
  moderatorAssistance?: InputMaybe<Scalars['Boolean']['input']>;
  nearbyEventsNotifications?: InputMaybe<Scalars['Boolean']['input']>;
  nearbyEventsNotificationsLocation?: InputMaybe<Scalars['JSON']['input']>;
  nearbyEventsNotificationsRadius?: InputMaybe<Scalars['Float']['input']>;
  nearbyPeopleNotificationThreshold?: InputMaybe<Scalars['Float']['input']>;
  noCollapseCommentsFrontpage?: InputMaybe<Scalars['Boolean']['input']>;
  noCollapseCommentsPosts?: InputMaybe<Scalars['Boolean']['input']>;
  noExpandUnreadCommentsReview?: InputMaybe<Scalars['Boolean']['input']>;
  noKibitz?: InputMaybe<Scalars['Boolean']['input']>;
  noSingleLineComments?: InputMaybe<Scalars['Boolean']['input']>;
  notificationAddedAsCoauthor?: InputMaybe<Scalars['JSON']['input']>;
  notificationAlignmentSubmissionApproved?: InputMaybe<Scalars['JSON']['input']>;
  notificationCommentsOnDraft?: InputMaybe<Scalars['JSON']['input']>;
  notificationCommentsOnSubscribedPost?: InputMaybe<Scalars['JSON']['input']>;
  notificationDebateCommentsOnSubscribedPost?: InputMaybe<Scalars['JSON']['input']>;
  notificationDebateReplies?: InputMaybe<Scalars['JSON']['input']>;
  notificationDialogueMatch?: InputMaybe<Scalars['JSON']['input']>;
  notificationDialogueMessages?: InputMaybe<Scalars['JSON']['input']>;
  notificationEventInRadius?: InputMaybe<Scalars['JSON']['input']>;
  notificationGroupAdministration?: InputMaybe<Scalars['JSON']['input']>;
  notificationKarmaPowersGained?: InputMaybe<Scalars['JSON']['input']>;
  notificationNewDialogueChecks?: InputMaybe<Scalars['JSON']['input']>;
  notificationNewMention?: InputMaybe<Scalars['JSON']['input']>;
  notificationPostsInGroups?: InputMaybe<Scalars['JSON']['input']>;
  notificationPostsNominatedReview?: InputMaybe<Scalars['JSON']['input']>;
  notificationPrivateMessage?: InputMaybe<Scalars['JSON']['input']>;
  notificationPublishedDialogueMessages?: InputMaybe<Scalars['JSON']['input']>;
  notificationRSVPs?: InputMaybe<Scalars['JSON']['input']>;
  notificationRepliesToMyComments?: InputMaybe<Scalars['JSON']['input']>;
  notificationRepliesToSubscribedComments?: InputMaybe<Scalars['JSON']['input']>;
  notificationSharedWithMe?: InputMaybe<Scalars['JSON']['input']>;
  notificationShortformContent?: InputMaybe<Scalars['JSON']['input']>;
  notificationSubforumUnread?: InputMaybe<Scalars['JSON']['input']>;
  notificationSubscribedSequencePost?: InputMaybe<Scalars['JSON']['input']>;
  notificationSubscribedTagPost?: InputMaybe<Scalars['JSON']['input']>;
  notificationSubscribedUserComment?: InputMaybe<Scalars['JSON']['input']>;
  notificationSubscribedUserPost?: InputMaybe<Scalars['JSON']['input']>;
  notificationYourTurnMatchForm?: InputMaybe<Scalars['JSON']['input']>;
  nullifyVotes?: InputMaybe<Scalars['Boolean']['input']>;
  optedInToDialogueFacilitation?: InputMaybe<Scalars['Boolean']['input']>;
  optedOutOfSurveys?: InputMaybe<Scalars['Boolean']['input']>;
  organization?: InputMaybe<Scalars['String']['input']>;
  organizerOfGroupIds?: InputMaybe<Array<Scalars['String']['input']>>;
  petrovOptOut?: InputMaybe<Scalars['Boolean']['input']>;
  postGlossariesPinned?: InputMaybe<Scalars['Boolean']['input']>;
  postingDisabled?: InputMaybe<Scalars['Boolean']['input']>;
  previousDisplayName?: InputMaybe<Scalars['String']['input']>;
  profileTagIds?: InputMaybe<Array<Scalars['String']['input']>>;
  profileUpdatedAt?: InputMaybe<Scalars['Date']['input']>;
  programParticipation?: InputMaybe<Array<Scalars['String']['input']>>;
  revealChecksToAdmins?: InputMaybe<Scalars['Boolean']['input']>;
  reviewForAlignmentForumUserId?: InputMaybe<Scalars['String']['input']>;
  reviewedByUserId?: InputMaybe<Scalars['String']['input']>;
  shortformFeedId?: InputMaybe<Scalars['String']['input']>;
  showCommunityInRecentDiscussion?: InputMaybe<Scalars['Boolean']['input']>;
  showDialoguesList?: InputMaybe<Scalars['Boolean']['input']>;
  showHideKarmaOption?: InputMaybe<Scalars['Boolean']['input']>;
  showMatches?: InputMaybe<Scalars['Boolean']['input']>;
  showMyDialogues?: InputMaybe<Scalars['Boolean']['input']>;
  showPostAuthorCard?: InputMaybe<Scalars['Boolean']['input']>;
  showRecommendedPartners?: InputMaybe<Scalars['Boolean']['input']>;
  slug?: InputMaybe<Scalars['String']['input']>;
  subforumPreferredLayout?: InputMaybe<SubforumPreferredLayout>;
  subscribedToDigest?: InputMaybe<Scalars['Boolean']['input']>;
  subscribedToNewsletter?: InputMaybe<Scalars['Boolean']['input']>;
  theme?: InputMaybe<Scalars['JSON']['input']>;
  twitterProfileURL?: InputMaybe<Scalars['String']['input']>;
  twitterProfileURLAdmin?: InputMaybe<Scalars['String']['input']>;
  unsubscribeFromAll?: InputMaybe<Scalars['Boolean']['input']>;
  userSurveyEmailSentAt?: InputMaybe<Scalars['Date']['input']>;
  username?: InputMaybe<Scalars['String']['input']>;
  viewUnreviewedComments?: InputMaybe<Scalars['Boolean']['input']>;
  voteBanned?: InputMaybe<Scalars['Boolean']['input']>;
  website?: InputMaybe<Scalars['String']['input']>;
  whenConfirmationEmailSent?: InputMaybe<Scalars['Date']['input']>;
};

export type CreateUserEagDetailDataInput = {
  lastUpdated?: InputMaybe<Scalars['Date']['input']>;
  legacyData?: InputMaybe<Scalars['JSON']['input']>;
};

export type CreateUserEagDetailInput = {
  data: CreateUserEagDetailDataInput;
};

export type CreateUserInput = {
  data: CreateUserDataInput;
};

export type CreateUserJobAdDataInput = {
  adState: Scalars['String']['input'];
  jobName: Scalars['String']['input'];
  lastUpdated?: InputMaybe<Scalars['Date']['input']>;
  legacyData?: InputMaybe<Scalars['JSON']['input']>;
  reminderSetAt?: InputMaybe<Scalars['Date']['input']>;
  userId: Scalars['String']['input'];
};

export type CreateUserJobAdInput = {
  data: CreateUserJobAdDataInput;
};

export type CreateUserMostValuablePostDataInput = {
  deleted?: InputMaybe<Scalars['Boolean']['input']>;
  legacyData?: InputMaybe<Scalars['JSON']['input']>;
  postId: Scalars['String']['input'];
  userId: Scalars['String']['input'];
};

export type CreateUserMostValuablePostInput = {
  data: CreateUserMostValuablePostDataInput;
};

export type CreateUserRateLimitDataInput = {
  actionsPerInterval: Scalars['Float']['input'];
  endedAt: Scalars['Date']['input'];
  intervalLength: Scalars['Float']['input'];
  intervalUnit: UserRateLimitIntervalUnit;
  legacyData?: InputMaybe<Scalars['JSON']['input']>;
  type: UserRateLimitType;
  userId: Scalars['String']['input'];
};

export type CreateUserRateLimitInput = {
  data: CreateUserRateLimitDataInput;
};

export type CreateUserTagRelDataInput = {
  legacyData?: InputMaybe<Scalars['JSON']['input']>;
  subforumEmailNotifications?: InputMaybe<Scalars['Boolean']['input']>;
  subforumHideIntroPost?: InputMaybe<Scalars['Boolean']['input']>;
  subforumShowUnreadInSidebar?: InputMaybe<Scalars['Boolean']['input']>;
  tagId: Scalars['String']['input'];
  userId: Scalars['String']['input'];
};

export type CreateUserTagRelInput = {
  data: CreateUserTagRelDataInput;
};

export type CrosspostInput = {
  foreignPostId?: InputMaybe<Scalars['String']['input']>;
  hostedHere?: InputMaybe<Scalars['Boolean']['input']>;
  isCrosspost: Scalars['Boolean']['input'];
};

export type CurationNoticeSelector = {
  curationNoticesPage?: InputMaybe<EmptyViewInput>;
  default?: InputMaybe<EmptyViewInput>;
};

export type DialogueCheckSelector = {
  default?: InputMaybe<EmptyViewInput>;
  userDialogueChecks?: InputMaybe<DialogueChecksUserDialogueChecksInput>;
  userTargetDialogueChecks?: InputMaybe<DialogueChecksUserTargetDialogueChecksInput>;
};

export type DialogueChecksUserDialogueChecksInput = {
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type DialogueChecksUserTargetDialogueChecksInput = {
  targetUserIds?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type DialogueMatchPreferenceSelector = {
  default?: InputMaybe<EmptyViewInput>;
  dialogueMatchPreferences?: InputMaybe<DialogueMatchPreferencesDialogueMatchPreferencesInput>;
};

export type DialogueMatchPreferencesDialogueMatchPreferencesInput = {
  dialogueCheckId?: InputMaybe<Scalars['String']['input']>;
};

export type DigestPostSelector = {
  default?: InputMaybe<EmptyViewInput>;
};

export type DigestSelector = {
  all?: InputMaybe<EmptyViewInput>;
  default?: InputMaybe<EmptyViewInput>;
  findByNum?: InputMaybe<DigestsFindByNumInput>;
};

export type DigestsFindByNumInput = {
  num?: InputMaybe<Scalars['Int']['input']>;
};

export enum DocumentDeletionNetChange {
  Deleted = 'deleted',
  Restored = 'restored'
}

export type ElectionCandidateDefaultViewInput = {
  electionName?: InputMaybe<Scalars['String']['input']>;
  sortBy?: InputMaybe<Scalars['String']['input']>;
};

export type ElectionCandidateSelector = {
  default?: InputMaybe<ElectionCandidateDefaultViewInput>;
};

export type ElectionVoteDefaultViewInput = {
  electionName?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type ElectionVoteSelector = {
  allSubmittedVotes?: InputMaybe<ElectionVotesAllSubmittedVotesInput>;
  default?: InputMaybe<ElectionVoteDefaultViewInput>;
};

export type ElectionVotesAllSubmittedVotesInput = {
  electionName?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type ElicitQuestionPredictionSelector = {
  default?: InputMaybe<EmptyViewInput>;
};

export type ElicitQuestionSelector = {
  default?: InputMaybe<EmptyViewInput>;
};

export type EmptyViewInput = {
  /** Unused field to satisfy GraphQL-JS */
  _unused?: InputMaybe<Scalars['Boolean']['input']>;
};

export type ExpandedFrontpageSectionsSettingsInput = {
  community?: InputMaybe<Scalars['Boolean']['input']>;
  popularComments?: InputMaybe<Scalars['Boolean']['input']>;
  quickTakes?: InputMaybe<Scalars['Boolean']['input']>;
  quickTakesCommunity?: InputMaybe<Scalars['Boolean']['input']>;
  recommendations?: InputMaybe<Scalars['Boolean']['input']>;
};

export type FeaturedResourceSelector = {
  activeResources?: InputMaybe<EmptyViewInput>;
  default?: InputMaybe<EmptyViewInput>;
};

export type FieldChangeSelector = {
  default?: InputMaybe<EmptyViewInput>;
};

export enum ForumEventCustomComponent {
  GivingSeason2024Banner = 'GivingSeason2024Banner'
}

export enum ForumEventFormat {
  Basic = 'BASIC',
  Poll = 'POLL',
  Stickers = 'STICKERS'
}

export type ForumEventSelector = {
  currentAndRecentForumEvents?: InputMaybe<ForumEventsCurrentAndRecentForumEventsInput>;
  currentForumEvent?: InputMaybe<EmptyViewInput>;
  default?: InputMaybe<EmptyViewInput>;
  pastForumEvents?: InputMaybe<ForumEventsPastForumEventsInput>;
  upcomingForumEvents?: InputMaybe<ForumEventsUpcomingForumEventsInput>;
};

export type ForumEventsCurrentAndRecentForumEventsInput = {
  limit?: InputMaybe<Scalars['String']['input']>;
};

export type ForumEventsPastForumEventsInput = {
  limit?: InputMaybe<Scalars['String']['input']>;
};

export type ForumEventsUpcomingForumEventsInput = {
  limit?: InputMaybe<Scalars['String']['input']>;
};

export type GardenCodeDefaultViewInput = {
  code?: InputMaybe<Scalars['String']['input']>;
  types?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type GardenCodeSelector = {
  default?: InputMaybe<GardenCodeDefaultViewInput>;
  gardenCodeByCode?: InputMaybe<GardenCodesGardenCodeByCodeInput>;
  publicGardenCodes?: InputMaybe<GardenCodesPublicGardenCodesInput>;
  usersPrivateGardenCodes?: InputMaybe<GardenCodesUsersPrivateGardenCodesInput>;
};

export type GardenCodesGardenCodeByCodeInput = {
  code?: InputMaybe<Scalars['String']['input']>;
  types?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type GardenCodesPublicGardenCodesInput = {
  code?: InputMaybe<Scalars['String']['input']>;
  types?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type GardenCodesUsersPrivateGardenCodesInput = {
  code?: InputMaybe<Scalars['String']['input']>;
  types?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type GoogleServiceAccountSessionSelector = {
  default?: InputMaybe<EmptyViewInput>;
};

export type JargonTermSelector = {
  default?: InputMaybe<EmptyViewInput>;
  glossaryEditAll?: InputMaybe<EmptyViewInput>;
  postEditorJargonTerms?: InputMaybe<JargonTermsPostEditorJargonTermsInput>;
  postsApprovedJargon?: InputMaybe<JargonTermsPostsApprovedJargonInput>;
};

export type JargonTermsPostEditorJargonTermsInput = {
  postId?: InputMaybe<Scalars['String']['input']>;
};

export type JargonTermsPostsApprovedJargonInput = {
  postIds?: InputMaybe<Scalars['String']['input']>;
};

export type LwEventSelector = {
  adminView?: InputMaybe<LwEventsAdminViewInput>;
  default?: InputMaybe<EmptyViewInput>;
  emailHistory?: InputMaybe<LwEventsEmailHistoryInput>;
  gatherTownUsers?: InputMaybe<EmptyViewInput>;
  postVisits?: InputMaybe<LwEventsPostVisitsInput>;
};

export type LwEventsAdminViewInput = {
  name?: InputMaybe<Scalars['String']['input']>;
};

export type LwEventsEmailHistoryInput = {
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type LwEventsPostVisitsInput = {
  limit?: InputMaybe<Scalars['String']['input']>;
  postId?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type LlmConversationSelector = {
  default?: InputMaybe<EmptyViewInput>;
  llmConversationsAll?: InputMaybe<LlmConversationsLlmConversationsAllInput>;
  llmConversationsWithUser?: InputMaybe<LlmConversationsLlmConversationsWithUserInput>;
};

export type LlmConversationsLlmConversationsAllInput = {
  showDeleted?: InputMaybe<Scalars['Boolean']['input']>;
};

export type LlmConversationsLlmConversationsWithUserInput = {
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type LocalgroupDefaultViewInput = {
  filters?: InputMaybe<Array<Scalars['String']['input']>>;
  includeInactive?: InputMaybe<Scalars['Boolean']['input']>;
};

export type LocalgroupSelector = {
  all?: InputMaybe<LocalgroupsAllInput>;
  default?: InputMaybe<LocalgroupDefaultViewInput>;
  local?: InputMaybe<LocalgroupsLocalInput>;
  nearby?: InputMaybe<LocalgroupsNearbyInput>;
  online?: InputMaybe<LocalgroupsOnlineInput>;
  single?: InputMaybe<LocalgroupsSingleInput>;
  userActiveGroups?: InputMaybe<LocalgroupsUserActiveGroupsInput>;
  userInactiveGroups?: InputMaybe<LocalgroupsUserInactiveGroupsInput>;
  userOrganizesGroups?: InputMaybe<LocalgroupsUserOrganizesGroupsInput>;
};

export type LocalgroupsAllInput = {
  filters?: InputMaybe<Array<Scalars['String']['input']>>;
  includeInactive?: InputMaybe<Scalars['Boolean']['input']>;
};

export type LocalgroupsLocalInput = {
  filters?: InputMaybe<Array<Scalars['String']['input']>>;
  includeInactive?: InputMaybe<Scalars['Boolean']['input']>;
};

export type LocalgroupsNearbyInput = {
  filters?: InputMaybe<Array<Scalars['String']['input']>>;
  includeInactive?: InputMaybe<Scalars['Boolean']['input']>;
  lat?: InputMaybe<Scalars['Float']['input']>;
  lng?: InputMaybe<Scalars['Float']['input']>;
};

export type LocalgroupsOnlineInput = {
  filters?: InputMaybe<Array<Scalars['String']['input']>>;
  includeInactive?: InputMaybe<Scalars['Boolean']['input']>;
};

export type LocalgroupsSingleInput = {
  filters?: InputMaybe<Array<Scalars['String']['input']>>;
  groupId?: InputMaybe<Scalars['String']['input']>;
  includeInactive?: InputMaybe<Scalars['Boolean']['input']>;
};

export type LocalgroupsUserActiveGroupsInput = {
  filters?: InputMaybe<Array<Scalars['String']['input']>>;
  includeInactive?: InputMaybe<Scalars['Boolean']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type LocalgroupsUserInactiveGroupsInput = {
  filters?: InputMaybe<Array<Scalars['String']['input']>>;
  includeInactive?: InputMaybe<Scalars['Boolean']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type LocalgroupsUserOrganizesGroupsInput = {
  filters?: InputMaybe<Array<Scalars['String']['input']>>;
  includeInactive?: InputMaybe<Scalars['Boolean']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export enum MailgunRiskLevel {
  High = 'high',
  Low = 'low',
  Medium = 'medium'
}

export type MessageSelector = {
  conversationPreview?: InputMaybe<MessagesConversationPreviewInput>;
  default?: InputMaybe<EmptyViewInput>;
  messagesConversation?: InputMaybe<MessagesMessagesConversationInput>;
};

export type MessagesConversationPreviewInput = {
  conversationId?: InputMaybe<Scalars['String']['input']>;
};

export type MessagesMessagesConversationInput = {
  conversationId?: InputMaybe<Scalars['String']['input']>;
};

export type ModerationTemplateSelector = {
  default?: InputMaybe<EmptyViewInput>;
  moderationTemplatesList?: InputMaybe<ModerationTemplatesModerationTemplatesListInput>;
  moderationTemplatesPage?: InputMaybe<EmptyViewInput>;
};

export enum ModerationTemplateType {
  Comments = 'Comments',
  Messages = 'Messages',
  Rejections = 'Rejections'
}

export type ModerationTemplatesModerationTemplatesListInput = {
  collectionName?: InputMaybe<Scalars['String']['input']>;
};

export type ModeratorActionSelector = {
  default?: InputMaybe<EmptyViewInput>;
  restrictionModerationActions?: InputMaybe<EmptyViewInput>;
  userModeratorActions?: InputMaybe<ModeratorActionsUserModeratorActionsInput>;
};

export enum ModeratorActionType {
  AutoBlockedFromSendingDMs = 'autoBlockedFromSendingDMs',
  ExemptFromRateLimits = 'exemptFromRateLimits',
  FlaggedForNdMs = 'flaggedForNDMs',
  LowAverageKarmaCommentAlert = 'lowAverageKarmaCommentAlert',
  LowAverageKarmaPostAlert = 'lowAverageKarmaPostAlert',
  ManualFlag = 'manualFlag',
  ManualNeedsReview = 'manualNeedsReview',
  ManualRateLimitExpired = 'manualRateLimitExpired',
  MovedPostToDraft = 'movedPostToDraft',
  NegativeUserKarmaAlert = 'negativeUserKarmaAlert',
  PotentialTargetedDownvoting = 'potentialTargetedDownvoting',
  RateLimitOnePerDay = 'rateLimitOnePerDay',
  RateLimitOnePerFortnight = 'rateLimitOnePerFortnight',
  RateLimitOnePerMonth = 'rateLimitOnePerMonth',
  RateLimitOnePerThreeDays = 'rateLimitOnePerThreeDays',
  RateLimitOnePerWeek = 'rateLimitOnePerWeek',
  RateLimitThreeCommentsPerPost = 'rateLimitThreeCommentsPerPost',
  ReceivedSeniorDownvotesAlert = 'receivedSeniorDownvotesAlert',
  RecentlyDownvotedContentAlert = 'recentlyDownvotedContentAlert',
  RejectedComment = 'rejectedComment',
  RejectedPost = 'rejectedPost',
  SentModeratorMessage = 'sentModeratorMessage',
  SnoozeExpired = 'snoozeExpired',
  StricterCommentAutomodRateLimit = 'stricterCommentAutomodRateLimit',
  StricterPostAutomodRateLimit = 'stricterPostAutomodRateLimit',
  UnreviewedBioUpdate = 'unreviewedBioUpdate',
  UnreviewedComment = 'unreviewedComment',
  UnreviewedFirstComment = 'unreviewedFirstComment',
  UnreviewedFirstPost = 'unreviewedFirstPost',
  UnreviewedMapLocationUpdate = 'unreviewedMapLocationUpdate',
  UnreviewedPost = 'unreviewedPost',
  UnreviewedProfileImageUpdate = 'unreviewedProfileImageUpdate',
  VotingDisabled = 'votingDisabled',
  VotingPatternWarningDelivered = 'votingPatternWarningDelivered'
}

export type ModeratorActionsUserModeratorActionsInput = {
  userIds?: InputMaybe<Array<Scalars['String']['input']>>;
};

export type MultiAdvisorRequestInput = {
  enableCache?: InputMaybe<Scalars['Boolean']['input']>;
  enableTotal?: InputMaybe<Scalars['Boolean']['input']>;
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  terms?: InputMaybe<Scalars['JSON']['input']>;
};

export type MultiArbitalTagContentRelInput = {
  enableCache?: InputMaybe<Scalars['Boolean']['input']>;
  enableTotal?: InputMaybe<Scalars['Boolean']['input']>;
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  terms?: InputMaybe<Scalars['JSON']['input']>;
};

export type MultiBanInput = {
  enableCache?: InputMaybe<Scalars['Boolean']['input']>;
  enableTotal?: InputMaybe<Scalars['Boolean']['input']>;
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  terms?: InputMaybe<Scalars['JSON']['input']>;
};

export type MultiBookInput = {
  enableCache?: InputMaybe<Scalars['Boolean']['input']>;
  enableTotal?: InputMaybe<Scalars['Boolean']['input']>;
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  terms?: InputMaybe<Scalars['JSON']['input']>;
};

export type MultiBookmarkInput = {
  enableCache?: InputMaybe<Scalars['Boolean']['input']>;
  enableTotal?: InputMaybe<Scalars['Boolean']['input']>;
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  terms?: InputMaybe<Scalars['JSON']['input']>;
};

export type MultiChapterInput = {
  enableCache?: InputMaybe<Scalars['Boolean']['input']>;
  enableTotal?: InputMaybe<Scalars['Boolean']['input']>;
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  terms?: InputMaybe<Scalars['JSON']['input']>;
};

export type MultiCkEditorUserSessionInput = {
  enableCache?: InputMaybe<Scalars['Boolean']['input']>;
  enableTotal?: InputMaybe<Scalars['Boolean']['input']>;
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  terms?: InputMaybe<Scalars['JSON']['input']>;
};

export type MultiClientIdInput = {
  enableCache?: InputMaybe<Scalars['Boolean']['input']>;
  enableTotal?: InputMaybe<Scalars['Boolean']['input']>;
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  terms?: InputMaybe<Scalars['JSON']['input']>;
};

export type MultiCollectionInput = {
  enableCache?: InputMaybe<Scalars['Boolean']['input']>;
  enableTotal?: InputMaybe<Scalars['Boolean']['input']>;
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  terms?: InputMaybe<Scalars['JSON']['input']>;
};

export type MultiCommentInput = {
  enableCache?: InputMaybe<Scalars['Boolean']['input']>;
  enableTotal?: InputMaybe<Scalars['Boolean']['input']>;
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  terms?: InputMaybe<Scalars['JSON']['input']>;
};

export type MultiCommentModeratorActionInput = {
  enableCache?: InputMaybe<Scalars['Boolean']['input']>;
  enableTotal?: InputMaybe<Scalars['Boolean']['input']>;
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  terms?: InputMaybe<Scalars['JSON']['input']>;
};

export type MultiConversationInput = {
  enableCache?: InputMaybe<Scalars['Boolean']['input']>;
  enableTotal?: InputMaybe<Scalars['Boolean']['input']>;
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  terms?: InputMaybe<Scalars['JSON']['input']>;
};

export type MultiCurationNoticeInput = {
  enableCache?: InputMaybe<Scalars['Boolean']['input']>;
  enableTotal?: InputMaybe<Scalars['Boolean']['input']>;
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  terms?: InputMaybe<Scalars['JSON']['input']>;
};

export type MultiDialogueCheckInput = {
  enableCache?: InputMaybe<Scalars['Boolean']['input']>;
  enableTotal?: InputMaybe<Scalars['Boolean']['input']>;
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  terms?: InputMaybe<Scalars['JSON']['input']>;
};

export type MultiDialogueMatchPreferenceInput = {
  enableCache?: InputMaybe<Scalars['Boolean']['input']>;
  enableTotal?: InputMaybe<Scalars['Boolean']['input']>;
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  terms?: InputMaybe<Scalars['JSON']['input']>;
};

export type MultiDigestInput = {
  enableCache?: InputMaybe<Scalars['Boolean']['input']>;
  enableTotal?: InputMaybe<Scalars['Boolean']['input']>;
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  terms?: InputMaybe<Scalars['JSON']['input']>;
};

export type MultiDigestPostInput = {
  enableCache?: InputMaybe<Scalars['Boolean']['input']>;
  enableTotal?: InputMaybe<Scalars['Boolean']['input']>;
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  terms?: InputMaybe<Scalars['JSON']['input']>;
};

export enum MultiDocumentCollectionName {
  MultiDocuments = 'MultiDocuments',
  Tags = 'Tags'
}

export type MultiDocumentDefaultViewInput = {
  excludedDocumentIds?: InputMaybe<Array<Scalars['String']['input']>>;
};

export enum MultiDocumentFieldName {
  Description = 'description',
  Summary = 'summary'
}

export type MultiDocumentSelector = {
  default?: InputMaybe<MultiDocumentDefaultViewInput>;
  lensBySlug?: InputMaybe<MultiDocumentsLensBySlugInput>;
  pingbackLensPages?: InputMaybe<MultiDocumentsPingbackLensPagesInput>;
  summariesByParentId?: InputMaybe<MultiDocumentsSummariesByParentIdInput>;
};

export enum MultiDocumentType {
  Lens = 'lens',
  Summary = 'summary'
}

export type MultiDocumentsLensBySlugInput = {
  excludedDocumentIds?: InputMaybe<Array<Scalars['String']['input']>>;
  slug?: InputMaybe<Scalars['String']['input']>;
};

export type MultiDocumentsPingbackLensPagesInput = {
  documentId?: InputMaybe<Scalars['String']['input']>;
  excludedDocumentIds?: InputMaybe<Array<Scalars['String']['input']>>;
};

export type MultiDocumentsSummariesByParentIdInput = {
  excludedDocumentIds?: InputMaybe<Array<Scalars['String']['input']>>;
  parentDocumentId?: InputMaybe<Scalars['String']['input']>;
};

export type MultiElectionCandidateInput = {
  enableCache?: InputMaybe<Scalars['Boolean']['input']>;
  enableTotal?: InputMaybe<Scalars['Boolean']['input']>;
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  terms?: InputMaybe<Scalars['JSON']['input']>;
};

export type MultiElectionVoteInput = {
  enableCache?: InputMaybe<Scalars['Boolean']['input']>;
  enableTotal?: InputMaybe<Scalars['Boolean']['input']>;
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  terms?: InputMaybe<Scalars['JSON']['input']>;
};

export type MultiElicitQuestionInput = {
  enableCache?: InputMaybe<Scalars['Boolean']['input']>;
  enableTotal?: InputMaybe<Scalars['Boolean']['input']>;
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  terms?: InputMaybe<Scalars['JSON']['input']>;
};

export type MultiElicitQuestionPredictionInput = {
  enableCache?: InputMaybe<Scalars['Boolean']['input']>;
  enableTotal?: InputMaybe<Scalars['Boolean']['input']>;
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  terms?: InputMaybe<Scalars['JSON']['input']>;
};

export type MultiFeaturedResourceInput = {
  enableCache?: InputMaybe<Scalars['Boolean']['input']>;
  enableTotal?: InputMaybe<Scalars['Boolean']['input']>;
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  terms?: InputMaybe<Scalars['JSON']['input']>;
};

export type MultiFieldChangeInput = {
  enableTotal?: InputMaybe<Scalars['Boolean']['input']>;
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  terms?: InputMaybe<Scalars['JSON']['input']>;
};

export type MultiForumEventInput = {
  enableCache?: InputMaybe<Scalars['Boolean']['input']>;
  enableTotal?: InputMaybe<Scalars['Boolean']['input']>;
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  terms?: InputMaybe<Scalars['JSON']['input']>;
};

export type MultiGardenCodeInput = {
  enableCache?: InputMaybe<Scalars['Boolean']['input']>;
  enableTotal?: InputMaybe<Scalars['Boolean']['input']>;
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  terms?: InputMaybe<Scalars['JSON']['input']>;
};

export type MultiGoogleServiceAccountSessionInput = {
  enableCache?: InputMaybe<Scalars['Boolean']['input']>;
  enableTotal?: InputMaybe<Scalars['Boolean']['input']>;
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  terms?: InputMaybe<Scalars['JSON']['input']>;
};

export type MultiJargonTermInput = {
  enableCache?: InputMaybe<Scalars['Boolean']['input']>;
  enableTotal?: InputMaybe<Scalars['Boolean']['input']>;
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  terms?: InputMaybe<Scalars['JSON']['input']>;
};

export type MultiLwEventInput = {
  enableCache?: InputMaybe<Scalars['Boolean']['input']>;
  enableTotal?: InputMaybe<Scalars['Boolean']['input']>;
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  terms?: InputMaybe<Scalars['JSON']['input']>;
};

export type MultiLlmConversationInput = {
  enableCache?: InputMaybe<Scalars['Boolean']['input']>;
  enableTotal?: InputMaybe<Scalars['Boolean']['input']>;
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  terms?: InputMaybe<Scalars['JSON']['input']>;
};

export type MultiLocalgroupInput = {
  enableCache?: InputMaybe<Scalars['Boolean']['input']>;
  enableTotal?: InputMaybe<Scalars['Boolean']['input']>;
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  terms?: InputMaybe<Scalars['JSON']['input']>;
};

export type MultiMessageInput = {
  enableCache?: InputMaybe<Scalars['Boolean']['input']>;
  enableTotal?: InputMaybe<Scalars['Boolean']['input']>;
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  terms?: InputMaybe<Scalars['JSON']['input']>;
};

export type MultiModerationTemplateInput = {
  enableCache?: InputMaybe<Scalars['Boolean']['input']>;
  enableTotal?: InputMaybe<Scalars['Boolean']['input']>;
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  terms?: InputMaybe<Scalars['JSON']['input']>;
};

export type MultiModeratorActionInput = {
  enableCache?: InputMaybe<Scalars['Boolean']['input']>;
  enableTotal?: InputMaybe<Scalars['Boolean']['input']>;
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  terms?: InputMaybe<Scalars['JSON']['input']>;
};

export type MultiMultiDocumentInput = {
  enableCache?: InputMaybe<Scalars['Boolean']['input']>;
  enableTotal?: InputMaybe<Scalars['Boolean']['input']>;
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  terms?: InputMaybe<Scalars['JSON']['input']>;
};

export type MultiNotificationInput = {
  enableCache?: InputMaybe<Scalars['Boolean']['input']>;
  enableTotal?: InputMaybe<Scalars['Boolean']['input']>;
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  terms?: InputMaybe<Scalars['JSON']['input']>;
};

export type MultiPetrovDayActionInput = {
  enableCache?: InputMaybe<Scalars['Boolean']['input']>;
  enableTotal?: InputMaybe<Scalars['Boolean']['input']>;
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  terms?: InputMaybe<Scalars['JSON']['input']>;
};

export type MultiPodcastEpisodeInput = {
  enableCache?: InputMaybe<Scalars['Boolean']['input']>;
  enableTotal?: InputMaybe<Scalars['Boolean']['input']>;
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  terms?: InputMaybe<Scalars['JSON']['input']>;
};

export type MultiPodcastInput = {
  enableCache?: InputMaybe<Scalars['Boolean']['input']>;
  enableTotal?: InputMaybe<Scalars['Boolean']['input']>;
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  terms?: InputMaybe<Scalars['JSON']['input']>;
};

export type MultiPostInput = {
  enableCache?: InputMaybe<Scalars['Boolean']['input']>;
  enableTotal?: InputMaybe<Scalars['Boolean']['input']>;
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  terms?: InputMaybe<Scalars['JSON']['input']>;
};

export type MultiPostRelationInput = {
  enableCache?: InputMaybe<Scalars['Boolean']['input']>;
  enableTotal?: InputMaybe<Scalars['Boolean']['input']>;
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  terms?: InputMaybe<Scalars['JSON']['input']>;
};

export type MultiRssFeedInput = {
  enableCache?: InputMaybe<Scalars['Boolean']['input']>;
  enableTotal?: InputMaybe<Scalars['Boolean']['input']>;
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  terms?: InputMaybe<Scalars['JSON']['input']>;
};

export type MultiReportInput = {
  enableCache?: InputMaybe<Scalars['Boolean']['input']>;
  enableTotal?: InputMaybe<Scalars['Boolean']['input']>;
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  terms?: InputMaybe<Scalars['JSON']['input']>;
};

export type MultiReviewVoteInput = {
  enableCache?: InputMaybe<Scalars['Boolean']['input']>;
  enableTotal?: InputMaybe<Scalars['Boolean']['input']>;
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  terms?: InputMaybe<Scalars['JSON']['input']>;
};

export type MultiReviewWinnerArtInput = {
  enableCache?: InputMaybe<Scalars['Boolean']['input']>;
  enableTotal?: InputMaybe<Scalars['Boolean']['input']>;
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  terms?: InputMaybe<Scalars['JSON']['input']>;
};

export type MultiReviewWinnerInput = {
  enableCache?: InputMaybe<Scalars['Boolean']['input']>;
  enableTotal?: InputMaybe<Scalars['Boolean']['input']>;
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  terms?: InputMaybe<Scalars['JSON']['input']>;
};

export type MultiRevisionInput = {
  enableCache?: InputMaybe<Scalars['Boolean']['input']>;
  enableTotal?: InputMaybe<Scalars['Boolean']['input']>;
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  terms?: InputMaybe<Scalars['JSON']['input']>;
};

export type MultiSequenceInput = {
  enableCache?: InputMaybe<Scalars['Boolean']['input']>;
  enableTotal?: InputMaybe<Scalars['Boolean']['input']>;
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  terms?: InputMaybe<Scalars['JSON']['input']>;
};

export type MultiSplashArtCoordinateInput = {
  enableCache?: InputMaybe<Scalars['Boolean']['input']>;
  enableTotal?: InputMaybe<Scalars['Boolean']['input']>;
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  terms?: InputMaybe<Scalars['JSON']['input']>;
};

export type MultiSpotlightInput = {
  enableCache?: InputMaybe<Scalars['Boolean']['input']>;
  enableTotal?: InputMaybe<Scalars['Boolean']['input']>;
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  terms?: InputMaybe<Scalars['JSON']['input']>;
};

export type MultiSubscriptionInput = {
  enableCache?: InputMaybe<Scalars['Boolean']['input']>;
  enableTotal?: InputMaybe<Scalars['Boolean']['input']>;
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  terms?: InputMaybe<Scalars['JSON']['input']>;
};

export type MultiSurveyInput = {
  enableCache?: InputMaybe<Scalars['Boolean']['input']>;
  enableTotal?: InputMaybe<Scalars['Boolean']['input']>;
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  terms?: InputMaybe<Scalars['JSON']['input']>;
};

export type MultiSurveyQuestionInput = {
  enableCache?: InputMaybe<Scalars['Boolean']['input']>;
  enableTotal?: InputMaybe<Scalars['Boolean']['input']>;
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  terms?: InputMaybe<Scalars['JSON']['input']>;
};

export type MultiSurveyResponseInput = {
  enableCache?: InputMaybe<Scalars['Boolean']['input']>;
  enableTotal?: InputMaybe<Scalars['Boolean']['input']>;
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  terms?: InputMaybe<Scalars['JSON']['input']>;
};

export type MultiSurveyScheduleInput = {
  enableCache?: InputMaybe<Scalars['Boolean']['input']>;
  enableTotal?: InputMaybe<Scalars['Boolean']['input']>;
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  terms?: InputMaybe<Scalars['JSON']['input']>;
};

export type MultiTagFlagInput = {
  enableCache?: InputMaybe<Scalars['Boolean']['input']>;
  enableTotal?: InputMaybe<Scalars['Boolean']['input']>;
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  terms?: InputMaybe<Scalars['JSON']['input']>;
};

export type MultiTagInput = {
  enableCache?: InputMaybe<Scalars['Boolean']['input']>;
  enableTotal?: InputMaybe<Scalars['Boolean']['input']>;
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  terms?: InputMaybe<Scalars['JSON']['input']>;
};

export type MultiTagRelInput = {
  enableCache?: InputMaybe<Scalars['Boolean']['input']>;
  enableTotal?: InputMaybe<Scalars['Boolean']['input']>;
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  terms?: InputMaybe<Scalars['JSON']['input']>;
};

export type MultiTypingIndicatorInput = {
  enableCache?: InputMaybe<Scalars['Boolean']['input']>;
  enableTotal?: InputMaybe<Scalars['Boolean']['input']>;
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  terms?: InputMaybe<Scalars['JSON']['input']>;
};

export type MultiUltraFeedEventInput = {
  enableTotal?: InputMaybe<Scalars['Boolean']['input']>;
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  terms?: InputMaybe<Scalars['JSON']['input']>;
};

export type MultiUserEagDetailInput = {
  enableCache?: InputMaybe<Scalars['Boolean']['input']>;
  enableTotal?: InputMaybe<Scalars['Boolean']['input']>;
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  terms?: InputMaybe<Scalars['JSON']['input']>;
};

export type MultiUserInput = {
  enableCache?: InputMaybe<Scalars['Boolean']['input']>;
  enableTotal?: InputMaybe<Scalars['Boolean']['input']>;
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  terms?: InputMaybe<Scalars['JSON']['input']>;
};

export type MultiUserJobAdInput = {
  enableCache?: InputMaybe<Scalars['Boolean']['input']>;
  enableTotal?: InputMaybe<Scalars['Boolean']['input']>;
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  terms?: InputMaybe<Scalars['JSON']['input']>;
};

export type MultiUserMostValuablePostInput = {
  enableCache?: InputMaybe<Scalars['Boolean']['input']>;
  enableTotal?: InputMaybe<Scalars['Boolean']['input']>;
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  terms?: InputMaybe<Scalars['JSON']['input']>;
};

export type MultiUserRateLimitInput = {
  enableCache?: InputMaybe<Scalars['Boolean']['input']>;
  enableTotal?: InputMaybe<Scalars['Boolean']['input']>;
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  terms?: InputMaybe<Scalars['JSON']['input']>;
};

export type MultiUserTagRelInput = {
  enableCache?: InputMaybe<Scalars['Boolean']['input']>;
  enableTotal?: InputMaybe<Scalars['Boolean']['input']>;
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  terms?: InputMaybe<Scalars['JSON']['input']>;
};

export type MultiVoteInput = {
  enableCache?: InputMaybe<Scalars['Boolean']['input']>;
  enableTotal?: InputMaybe<Scalars['Boolean']['input']>;
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  terms?: InputMaybe<Scalars['JSON']['input']>;
};

export type NotificationSelector = {
  adminAlertNotifications?: InputMaybe<NotificationsAdminAlertNotificationsInput>;
  default?: InputMaybe<EmptyViewInput>;
  unreadUserNotifications?: InputMaybe<NotificationsUnreadUserNotificationsInput>;
  userNotifications?: InputMaybe<NotificationsUserNotificationsInput>;
};

export type NotificationsAdminAlertNotificationsInput = {
  type?: InputMaybe<Scalars['String']['input']>;
};

export type NotificationsUnreadUserNotificationsInput = {
  lastViewedDate?: InputMaybe<Scalars['String']['input']>;
  type?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type NotificationsUserNotificationsInput = {
  type?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
  viewed?: InputMaybe<Scalars['String']['input']>;
};

export type PartiallyReadSequenceItemInput = {
  collectionId?: InputMaybe<Scalars['String']['input']>;
  lastReadPostId: Scalars['String']['input'];
  lastReadTime?: InputMaybe<Scalars['Date']['input']>;
  nextPostId: Scalars['String']['input'];
  numRead: Scalars['Int']['input'];
  numTotal: Scalars['Int']['input'];
  sequenceId?: InputMaybe<Scalars['String']['input']>;
};

export type PetrovDayActionSelector = {
  adminConsole?: InputMaybe<EmptyViewInput>;
  default?: InputMaybe<EmptyViewInput>;
  getAction?: InputMaybe<PetrovDayActionsGetActionInput>;
  launchDashboard?: InputMaybe<PetrovDayActionsLaunchDashboardInput>;
  warningConsole?: InputMaybe<PetrovDayActionsWarningConsoleInput>;
};

export type PetrovDayActionsGetActionInput = {
  actionType?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type PetrovDayActionsLaunchDashboardInput = {
  side?: InputMaybe<Scalars['String']['input']>;
};

export type PetrovDayActionsWarningConsoleInput = {
  side?: InputMaybe<Scalars['String']['input']>;
};

export type PodcastEpisodeByExternalIdInput = {
  _id?: InputMaybe<Scalars['String']['input']>;
  externalEpisodeId?: InputMaybe<Scalars['String']['input']>;
};

export type PodcastEpisodeSelector = {
  default?: InputMaybe<EmptyViewInput>;
  episodeByExternalId?: InputMaybe<PodcastEpisodeByExternalIdInput>;
};

export type PodcastSelector = {
  default?: InputMaybe<EmptyViewInput>;
};

export enum PostCategory {
  Linkpost = 'linkpost',
  Post = 'post',
  Question = 'question'
}

export type PostDefaultViewInput = {
  af?: InputMaybe<Scalars['Boolean']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  curatedAfter?: InputMaybe<Scalars['String']['input']>;
  exactPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  excludeEvents?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Scalars['String']['input']>;
  filterSettings?: InputMaybe<Scalars['JSON']['input']>;
  groupId?: InputMaybe<Scalars['String']['input']>;
  hideCommunity?: InputMaybe<Scalars['Boolean']['input']>;
  includeRelatedQuestions?: InputMaybe<Scalars['String']['input']>;
  karmaThreshold?: InputMaybe<Scalars['Int']['input']>;
  notPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  postIds?: InputMaybe<Array<Scalars['String']['input']>>;
  question?: InputMaybe<Scalars['Boolean']['input']>;
  requiredFrontpage?: InputMaybe<Scalars['Boolean']['input']>;
  requiredUnnominated?: InputMaybe<Scalars['Boolean']['input']>;
  sortedBy?: InputMaybe<Scalars['String']['input']>;
  timeField?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
  view?: InputMaybe<Scalars['String']['input']>;
};

export type PostMetadataInput = {
  postId: Scalars['String']['input'];
};

export type PostRelationSelector = {
  allPostRelations?: InputMaybe<PostRelationsAllPostRelationsInput>;
  default?: InputMaybe<EmptyViewInput>;
};

export type PostRelationsAllPostRelationsInput = {
  postId?: InputMaybe<Scalars['String']['input']>;
};

export type PostReviewFilter = {
  endDate?: InputMaybe<Scalars['Date']['input']>;
  minKarma?: InputMaybe<Scalars['Int']['input']>;
  showEvents?: InputMaybe<Scalars['Boolean']['input']>;
  startDate?: InputMaybe<Scalars['Date']['input']>;
};

export type PostReviewSort = {
  karma?: InputMaybe<Scalars['Boolean']['input']>;
};

export type PostSelector = {
  afRecentDiscussionThreadsList?: InputMaybe<PostsAfRecentDiscussionThreadsListInput>;
  alignmentSuggestedPosts?: InputMaybe<PostsAlignmentSuggestedPostsInput>;
  all_drafts?: InputMaybe<PostsAll_DraftsInput>;
  community?: InputMaybe<PostsCommunityInput>;
  communityResourcePosts?: InputMaybe<PostsCommunityResourcePostsInput>;
  communityRss?: InputMaybe<PostsCommunityRssInput>;
  curated?: InputMaybe<PostsCuratedInput>;
  curatedRss?: InputMaybe<PostsCuratedRssInput>;
  currentOpenThread?: InputMaybe<PostsCurrentOpenThreadInput>;
  daily?: InputMaybe<PostsDailyInput>;
  default?: InputMaybe<PostDefaultViewInput>;
  drafts?: InputMaybe<PostsDraftsInput>;
  events?: InputMaybe<PostsEventsInput>;
  eventsInTimeRange?: InputMaybe<PostsEventsInTimeRangeInput>;
  frontpage?: InputMaybe<PostsFrontpageInput>;
  frontpageReviewWidget?: InputMaybe<PostsFrontpageReviewWidgetInput>;
  frontpageRss?: InputMaybe<PostsFrontpageRssInput>;
  globalEvents?: InputMaybe<PostsGlobalEventsInput>;
  hasEverDialogued?: InputMaybe<PostsHasEverDialoguedInput>;
  legacyIdPost?: InputMaybe<PostsLegacyIdPostInput>;
  magic?: InputMaybe<PostsMagicInput>;
  metaRss?: InputMaybe<PostsMetaRssInput>;
  myBookmarkedPosts?: InputMaybe<PostsMyBookmarkedPostsInput>;
  nearbyEvents?: InputMaybe<PostsNearbyEventsInput>;
  new?: InputMaybe<PostsNewInput>;
  nominatablePostsByVote?: InputMaybe<PostsNominatablePostsByVoteInput>;
  nominations2018?: InputMaybe<PostsNominations2018Input>;
  nominations2019?: InputMaybe<PostsNominations2019Input>;
  nonEventGroupPosts?: InputMaybe<PostsNonEventGroupPostsInput>;
  old?: InputMaybe<PostsOldInput>;
  pastEvents?: InputMaybe<PostsPastEventsInput>;
  pingbackPosts?: InputMaybe<PostsPingbackPostsInput>;
  postsWithBannedUsers?: InputMaybe<PostsPostsWithBannedUsersInput>;
  recentComments?: InputMaybe<PostsRecentCommentsInput>;
  recentDiscussionThreadsList?: InputMaybe<PostsRecentDiscussionThreadsListInput>;
  recentQuestionActivity?: InputMaybe<PostsRecentQuestionActivityInput>;
  rejected?: InputMaybe<PostsRejectedInput>;
  reviewFinalVoting?: InputMaybe<PostsReviewFinalVotingInput>;
  reviewQuickPage?: InputMaybe<PostsReviewQuickPageInput>;
  reviewRecentDiscussionThreadsList2018?: InputMaybe<PostsReviewRecentDiscussionThreadsList2018Input>;
  reviewRecentDiscussionThreadsList2019?: InputMaybe<PostsReviewRecentDiscussionThreadsList2019Input>;
  reviewVoting?: InputMaybe<PostsReviewVotingInput>;
  reviews2018?: InputMaybe<PostsReviews2018Input>;
  reviews2019?: InputMaybe<PostsReviews2019Input>;
  rss?: InputMaybe<PostsRssInput>;
  scheduled?: InputMaybe<PostsScheduledInput>;
  slugPost?: InputMaybe<PostsSlugPostInput>;
  stickied?: InputMaybe<PostsStickiedInput>;
  sunshineAutoClassifiedPosts?: InputMaybe<PostsSunshineAutoClassifiedPostsInput>;
  sunshineCuratedSuggestions?: InputMaybe<PostsSunshineCuratedSuggestionsInput>;
  sunshineNewPosts?: InputMaybe<PostsSunshineNewPostsInput>;
  sunshineNewUsersPosts?: InputMaybe<PostsSunshineNewUsersPostsInput>;
  tagRelevance?: InputMaybe<PostsTagRelevanceInput>;
  tbdEvents?: InputMaybe<PostsTbdEventsInput>;
  timeframe?: InputMaybe<PostsTimeframeInput>;
  top?: InputMaybe<PostsTopInput>;
  topQuestions?: InputMaybe<PostsTopQuestionsInput>;
  unlisted?: InputMaybe<PostsUnlistedInput>;
  upcomingEvents?: InputMaybe<PostsUpcomingEventsInput>;
  userAFSubmissions?: InputMaybe<PostsUserAfSubmissionsInput>;
  userPosts?: InputMaybe<PostsUserPostsInput>;
  voting2019?: InputMaybe<PostsVoting2019Input>;
};

export type PostsAfRecentDiscussionThreadsListInput = {
  af?: InputMaybe<Scalars['Boolean']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  curatedAfter?: InputMaybe<Scalars['String']['input']>;
  exactPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  excludeEvents?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Scalars['String']['input']>;
  filterSettings?: InputMaybe<Scalars['JSON']['input']>;
  groupId?: InputMaybe<Scalars['String']['input']>;
  hideCommunity?: InputMaybe<Scalars['Boolean']['input']>;
  includeRelatedQuestions?: InputMaybe<Scalars['String']['input']>;
  karmaThreshold?: InputMaybe<Scalars['Int']['input']>;
  limit?: InputMaybe<Scalars['String']['input']>;
  notPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  postIds?: InputMaybe<Array<Scalars['String']['input']>>;
  question?: InputMaybe<Scalars['Boolean']['input']>;
  sortedBy?: InputMaybe<Scalars['String']['input']>;
  timeField?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
  view?: InputMaybe<Scalars['String']['input']>;
};

export type PostsAlignmentSuggestedPostsInput = {
  af?: InputMaybe<Scalars['Boolean']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  curatedAfter?: InputMaybe<Scalars['String']['input']>;
  exactPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  excludeEvents?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Scalars['String']['input']>;
  filterSettings?: InputMaybe<Scalars['JSON']['input']>;
  groupId?: InputMaybe<Scalars['String']['input']>;
  hideCommunity?: InputMaybe<Scalars['Boolean']['input']>;
  includeRelatedQuestions?: InputMaybe<Scalars['String']['input']>;
  karmaThreshold?: InputMaybe<Scalars['Int']['input']>;
  notPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  postIds?: InputMaybe<Array<Scalars['String']['input']>>;
  question?: InputMaybe<Scalars['Boolean']['input']>;
  sortedBy?: InputMaybe<Scalars['String']['input']>;
  timeField?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
  view?: InputMaybe<Scalars['String']['input']>;
};

export type PostsAll_DraftsInput = {
  af?: InputMaybe<Scalars['Boolean']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  curatedAfter?: InputMaybe<Scalars['String']['input']>;
  exactPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  excludeEvents?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Scalars['String']['input']>;
  filterSettings?: InputMaybe<Scalars['JSON']['input']>;
  groupId?: InputMaybe<Scalars['String']['input']>;
  hideCommunity?: InputMaybe<Scalars['Boolean']['input']>;
  includeRelatedQuestions?: InputMaybe<Scalars['String']['input']>;
  karmaThreshold?: InputMaybe<Scalars['Int']['input']>;
  notPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  postIds?: InputMaybe<Array<Scalars['String']['input']>>;
  question?: InputMaybe<Scalars['Boolean']['input']>;
  sortedBy?: InputMaybe<Scalars['String']['input']>;
  timeField?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
  view?: InputMaybe<Scalars['String']['input']>;
};

export type PostsCommunityInput = {
  af?: InputMaybe<Scalars['Boolean']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  curatedAfter?: InputMaybe<Scalars['String']['input']>;
  exactPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  excludeEvents?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Scalars['String']['input']>;
  filterSettings?: InputMaybe<Scalars['JSON']['input']>;
  groupId?: InputMaybe<Scalars['String']['input']>;
  hideCommunity?: InputMaybe<Scalars['Boolean']['input']>;
  includeRelatedQuestions?: InputMaybe<Scalars['String']['input']>;
  karmaThreshold?: InputMaybe<Scalars['Int']['input']>;
  notPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  postIds?: InputMaybe<Array<Scalars['String']['input']>>;
  question?: InputMaybe<Scalars['Boolean']['input']>;
  sortedBy?: InputMaybe<Scalars['String']['input']>;
  timeField?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
  view?: InputMaybe<Scalars['String']['input']>;
};

export type PostsCommunityResourcePostsInput = {
  af?: InputMaybe<Scalars['Boolean']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  curatedAfter?: InputMaybe<Scalars['String']['input']>;
  exactPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  excludeEvents?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Scalars['String']['input']>;
  filterSettings?: InputMaybe<Scalars['JSON']['input']>;
  groupId?: InputMaybe<Scalars['String']['input']>;
  hideCommunity?: InputMaybe<Scalars['Boolean']['input']>;
  includeRelatedQuestions?: InputMaybe<Scalars['String']['input']>;
  karmaThreshold?: InputMaybe<Scalars['Int']['input']>;
  notPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  postIds?: InputMaybe<Array<Scalars['String']['input']>>;
  question?: InputMaybe<Scalars['Boolean']['input']>;
  sortedBy?: InputMaybe<Scalars['String']['input']>;
  timeField?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
  view?: InputMaybe<Scalars['String']['input']>;
};

export type PostsCommunityRssInput = {
  af?: InputMaybe<Scalars['Boolean']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  curatedAfter?: InputMaybe<Scalars['String']['input']>;
  exactPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  excludeEvents?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Scalars['String']['input']>;
  filterSettings?: InputMaybe<Scalars['JSON']['input']>;
  groupId?: InputMaybe<Scalars['String']['input']>;
  hideCommunity?: InputMaybe<Scalars['Boolean']['input']>;
  includeRelatedQuestions?: InputMaybe<Scalars['String']['input']>;
  karmaThreshold?: InputMaybe<Scalars['Int']['input']>;
  notPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  postIds?: InputMaybe<Array<Scalars['String']['input']>>;
  question?: InputMaybe<Scalars['Boolean']['input']>;
  sortedBy?: InputMaybe<Scalars['String']['input']>;
  timeField?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
  view?: InputMaybe<Scalars['String']['input']>;
};

export type PostsCuratedInput = {
  af?: InputMaybe<Scalars['Boolean']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  curatedAfter?: InputMaybe<Scalars['String']['input']>;
  exactPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  excludeEvents?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Scalars['String']['input']>;
  filterSettings?: InputMaybe<Scalars['JSON']['input']>;
  groupId?: InputMaybe<Scalars['String']['input']>;
  hideCommunity?: InputMaybe<Scalars['Boolean']['input']>;
  includeRelatedQuestions?: InputMaybe<Scalars['String']['input']>;
  karmaThreshold?: InputMaybe<Scalars['Int']['input']>;
  notPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  postIds?: InputMaybe<Array<Scalars['String']['input']>>;
  question?: InputMaybe<Scalars['Boolean']['input']>;
  sortedBy?: InputMaybe<Scalars['String']['input']>;
  timeField?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
  view?: InputMaybe<Scalars['String']['input']>;
};

export type PostsCuratedRssInput = {
  af?: InputMaybe<Scalars['Boolean']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  curatedAfter?: InputMaybe<Scalars['String']['input']>;
  exactPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  excludeEvents?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Scalars['String']['input']>;
  filterSettings?: InputMaybe<Scalars['JSON']['input']>;
  groupId?: InputMaybe<Scalars['String']['input']>;
  hideCommunity?: InputMaybe<Scalars['Boolean']['input']>;
  includeRelatedQuestions?: InputMaybe<Scalars['String']['input']>;
  karmaThreshold?: InputMaybe<Scalars['Int']['input']>;
  notPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  postIds?: InputMaybe<Array<Scalars['String']['input']>>;
  question?: InputMaybe<Scalars['Boolean']['input']>;
  sortedBy?: InputMaybe<Scalars['String']['input']>;
  timeField?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
  view?: InputMaybe<Scalars['String']['input']>;
};

export type PostsCurrentOpenThreadInput = {
  af?: InputMaybe<Scalars['Boolean']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  curatedAfter?: InputMaybe<Scalars['String']['input']>;
  exactPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  excludeEvents?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Scalars['String']['input']>;
  filterSettings?: InputMaybe<Scalars['JSON']['input']>;
  groupId?: InputMaybe<Scalars['String']['input']>;
  hideCommunity?: InputMaybe<Scalars['Boolean']['input']>;
  includeRelatedQuestions?: InputMaybe<Scalars['String']['input']>;
  karmaThreshold?: InputMaybe<Scalars['Int']['input']>;
  notPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  postIds?: InputMaybe<Array<Scalars['String']['input']>>;
  question?: InputMaybe<Scalars['Boolean']['input']>;
  sortedBy?: InputMaybe<Scalars['String']['input']>;
  timeField?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
  view?: InputMaybe<Scalars['String']['input']>;
};

export type PostsDailyInput = {
  af?: InputMaybe<Scalars['Boolean']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  curatedAfter?: InputMaybe<Scalars['String']['input']>;
  exactPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  excludeEvents?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Scalars['String']['input']>;
  filterSettings?: InputMaybe<Scalars['JSON']['input']>;
  groupId?: InputMaybe<Scalars['String']['input']>;
  hideCommunity?: InputMaybe<Scalars['Boolean']['input']>;
  includeRelatedQuestions?: InputMaybe<Scalars['String']['input']>;
  karmaThreshold?: InputMaybe<Scalars['Int']['input']>;
  notPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  postIds?: InputMaybe<Array<Scalars['String']['input']>>;
  question?: InputMaybe<Scalars['Boolean']['input']>;
  sortedBy?: InputMaybe<Scalars['String']['input']>;
  timeField?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
  view?: InputMaybe<Scalars['String']['input']>;
};

export type PostsDraftsInput = {
  af?: InputMaybe<Scalars['Boolean']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  curatedAfter?: InputMaybe<Scalars['String']['input']>;
  exactPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  excludeEvents?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Scalars['String']['input']>;
  filterSettings?: InputMaybe<Scalars['JSON']['input']>;
  groupId?: InputMaybe<Scalars['String']['input']>;
  hideCommunity?: InputMaybe<Scalars['Boolean']['input']>;
  includeArchived?: InputMaybe<Scalars['Boolean']['input']>;
  includeDraftEvents?: InputMaybe<Scalars['Boolean']['input']>;
  includeRelatedQuestions?: InputMaybe<Scalars['String']['input']>;
  includeShared?: InputMaybe<Scalars['Boolean']['input']>;
  karmaThreshold?: InputMaybe<Scalars['Int']['input']>;
  notPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  postIds?: InputMaybe<Array<Scalars['String']['input']>>;
  question?: InputMaybe<Scalars['Boolean']['input']>;
  sortDraftsBy?: InputMaybe<Scalars['String']['input']>;
  sortedBy?: InputMaybe<Scalars['String']['input']>;
  timeField?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
  view?: InputMaybe<Scalars['String']['input']>;
};

export type PostsEventsInTimeRangeInput = {
  af?: InputMaybe<Scalars['Boolean']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  curatedAfter?: InputMaybe<Scalars['String']['input']>;
  exactPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  excludeEvents?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Scalars['String']['input']>;
  filterSettings?: InputMaybe<Scalars['JSON']['input']>;
  groupId?: InputMaybe<Scalars['String']['input']>;
  hideCommunity?: InputMaybe<Scalars['Boolean']['input']>;
  includeRelatedQuestions?: InputMaybe<Scalars['String']['input']>;
  karmaThreshold?: InputMaybe<Scalars['Int']['input']>;
  notPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  postIds?: InputMaybe<Array<Scalars['String']['input']>>;
  question?: InputMaybe<Scalars['Boolean']['input']>;
  sortedBy?: InputMaybe<Scalars['String']['input']>;
  timeField?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
  view?: InputMaybe<Scalars['String']['input']>;
};

export type PostsEventsInput = {
  af?: InputMaybe<Scalars['Boolean']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  curatedAfter?: InputMaybe<Scalars['String']['input']>;
  exactPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  excludeEvents?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Scalars['String']['input']>;
  filterSettings?: InputMaybe<Scalars['JSON']['input']>;
  filters?: InputMaybe<Array<Scalars['String']['input']>>;
  globalEvent?: InputMaybe<Scalars['Boolean']['input']>;
  groupId?: InputMaybe<Scalars['String']['input']>;
  hideCommunity?: InputMaybe<Scalars['Boolean']['input']>;
  includeRelatedQuestions?: InputMaybe<Scalars['String']['input']>;
  karmaThreshold?: InputMaybe<Scalars['Int']['input']>;
  notPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  onlineEvent?: InputMaybe<Scalars['Boolean']['input']>;
  postIds?: InputMaybe<Array<Scalars['String']['input']>>;
  question?: InputMaybe<Scalars['Boolean']['input']>;
  sortedBy?: InputMaybe<Scalars['String']['input']>;
  timeField?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
  view?: InputMaybe<Scalars['String']['input']>;
};

export type PostsFrontpageInput = {
  af?: InputMaybe<Scalars['Boolean']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  curatedAfter?: InputMaybe<Scalars['String']['input']>;
  exactPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  excludeEvents?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Scalars['String']['input']>;
  filterSettings?: InputMaybe<Scalars['JSON']['input']>;
  groupId?: InputMaybe<Scalars['String']['input']>;
  hideCommunity?: InputMaybe<Scalars['Boolean']['input']>;
  includeRelatedQuestions?: InputMaybe<Scalars['String']['input']>;
  karmaThreshold?: InputMaybe<Scalars['Int']['input']>;
  notPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  postIds?: InputMaybe<Array<Scalars['String']['input']>>;
  question?: InputMaybe<Scalars['Boolean']['input']>;
  sortedBy?: InputMaybe<Scalars['String']['input']>;
  timeField?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
  view?: InputMaybe<Scalars['String']['input']>;
};

export type PostsFrontpageReviewWidgetInput = {
  af?: InputMaybe<Scalars['Boolean']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  curatedAfter?: InputMaybe<Scalars['String']['input']>;
  exactPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  excludeEvents?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Scalars['String']['input']>;
  filterSettings?: InputMaybe<Scalars['JSON']['input']>;
  groupId?: InputMaybe<Scalars['String']['input']>;
  hideCommunity?: InputMaybe<Scalars['Boolean']['input']>;
  includeRelatedQuestions?: InputMaybe<Scalars['String']['input']>;
  karmaThreshold?: InputMaybe<Scalars['Int']['input']>;
  notPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  postIds?: InputMaybe<Array<Scalars['String']['input']>>;
  question?: InputMaybe<Scalars['Boolean']['input']>;
  reviewPhase?: InputMaybe<Scalars['String']['input']>;
  reviewYear?: InputMaybe<Scalars['Int']['input']>;
  sortedBy?: InputMaybe<Scalars['String']['input']>;
  timeField?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
  view?: InputMaybe<Scalars['String']['input']>;
};

export type PostsFrontpageRssInput = {
  af?: InputMaybe<Scalars['Boolean']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  curatedAfter?: InputMaybe<Scalars['String']['input']>;
  exactPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  excludeEvents?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Scalars['String']['input']>;
  filterSettings?: InputMaybe<Scalars['JSON']['input']>;
  groupId?: InputMaybe<Scalars['String']['input']>;
  hideCommunity?: InputMaybe<Scalars['Boolean']['input']>;
  includeRelatedQuestions?: InputMaybe<Scalars['String']['input']>;
  karmaThreshold?: InputMaybe<Scalars['Int']['input']>;
  notPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  postIds?: InputMaybe<Array<Scalars['String']['input']>>;
  question?: InputMaybe<Scalars['Boolean']['input']>;
  sortedBy?: InputMaybe<Scalars['String']['input']>;
  timeField?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
  view?: InputMaybe<Scalars['String']['input']>;
};

export type PostsGlobalEventsInput = {
  af?: InputMaybe<Scalars['Boolean']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  curatedAfter?: InputMaybe<Scalars['String']['input']>;
  eventType?: InputMaybe<Array<Scalars['String']['input']>>;
  exactPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  excludeEvents?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Scalars['String']['input']>;
  filterSettings?: InputMaybe<Scalars['JSON']['input']>;
  filters?: InputMaybe<Array<Scalars['String']['input']>>;
  groupId?: InputMaybe<Scalars['String']['input']>;
  hideCommunity?: InputMaybe<Scalars['Boolean']['input']>;
  includeRelatedQuestions?: InputMaybe<Scalars['String']['input']>;
  karmaThreshold?: InputMaybe<Scalars['Int']['input']>;
  notPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  onlineEvent?: InputMaybe<Scalars['Boolean']['input']>;
  postIds?: InputMaybe<Array<Scalars['String']['input']>>;
  question?: InputMaybe<Scalars['Boolean']['input']>;
  sortedBy?: InputMaybe<Scalars['String']['input']>;
  timeField?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
  view?: InputMaybe<Scalars['String']['input']>;
};

export type PostsHasEverDialoguedInput = {
  af?: InputMaybe<Scalars['Boolean']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  curatedAfter?: InputMaybe<Scalars['String']['input']>;
  exactPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  excludeEvents?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Scalars['String']['input']>;
  filterSettings?: InputMaybe<Scalars['JSON']['input']>;
  groupId?: InputMaybe<Scalars['String']['input']>;
  hideCommunity?: InputMaybe<Scalars['Boolean']['input']>;
  includeRelatedQuestions?: InputMaybe<Scalars['String']['input']>;
  karmaThreshold?: InputMaybe<Scalars['Int']['input']>;
  notPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  postIds?: InputMaybe<Array<Scalars['String']['input']>>;
  question?: InputMaybe<Scalars['Boolean']['input']>;
  sortedBy?: InputMaybe<Scalars['String']['input']>;
  timeField?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
  view?: InputMaybe<Scalars['String']['input']>;
};

export type PostsLegacyIdPostInput = {
  af?: InputMaybe<Scalars['Boolean']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  curatedAfter?: InputMaybe<Scalars['String']['input']>;
  exactPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  excludeEvents?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Scalars['String']['input']>;
  filterSettings?: InputMaybe<Scalars['JSON']['input']>;
  groupId?: InputMaybe<Scalars['String']['input']>;
  hideCommunity?: InputMaybe<Scalars['Boolean']['input']>;
  includeRelatedQuestions?: InputMaybe<Scalars['String']['input']>;
  karmaThreshold?: InputMaybe<Scalars['Int']['input']>;
  legacyId?: InputMaybe<Scalars['String']['input']>;
  notPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  postIds?: InputMaybe<Array<Scalars['String']['input']>>;
  question?: InputMaybe<Scalars['Boolean']['input']>;
  sortedBy?: InputMaybe<Scalars['String']['input']>;
  timeField?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
  view?: InputMaybe<Scalars['String']['input']>;
};

export type PostsMagicInput = {
  af?: InputMaybe<Scalars['Boolean']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  curatedAfter?: InputMaybe<Scalars['String']['input']>;
  exactPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  excludeEvents?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Scalars['String']['input']>;
  filterSettings?: InputMaybe<Scalars['JSON']['input']>;
  forum?: InputMaybe<Scalars['Boolean']['input']>;
  groupId?: InputMaybe<Scalars['String']['input']>;
  hideCommunity?: InputMaybe<Scalars['Boolean']['input']>;
  includeRelatedQuestions?: InputMaybe<Scalars['String']['input']>;
  karmaThreshold?: InputMaybe<Scalars['Int']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  meta?: InputMaybe<Scalars['Boolean']['input']>;
  notPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  postIds?: InputMaybe<Array<Scalars['String']['input']>>;
  question?: InputMaybe<Scalars['Boolean']['input']>;
  sortedBy?: InputMaybe<Scalars['String']['input']>;
  timeField?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
  view?: InputMaybe<Scalars['String']['input']>;
};

export type PostsMetaRssInput = {
  af?: InputMaybe<Scalars['Boolean']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  curatedAfter?: InputMaybe<Scalars['String']['input']>;
  exactPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  excludeEvents?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Scalars['String']['input']>;
  filterSettings?: InputMaybe<Scalars['JSON']['input']>;
  groupId?: InputMaybe<Scalars['String']['input']>;
  hideCommunity?: InputMaybe<Scalars['Boolean']['input']>;
  includeRelatedQuestions?: InputMaybe<Scalars['String']['input']>;
  karmaThreshold?: InputMaybe<Scalars['Int']['input']>;
  notPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  postIds?: InputMaybe<Array<Scalars['String']['input']>>;
  question?: InputMaybe<Scalars['Boolean']['input']>;
  sortedBy?: InputMaybe<Scalars['String']['input']>;
  timeField?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
  view?: InputMaybe<Scalars['String']['input']>;
};

export type PostsMyBookmarkedPostsInput = {
  af?: InputMaybe<Scalars['Boolean']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  curatedAfter?: InputMaybe<Scalars['String']['input']>;
  exactPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  excludeEvents?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Scalars['String']['input']>;
  filterSettings?: InputMaybe<Scalars['JSON']['input']>;
  groupId?: InputMaybe<Scalars['String']['input']>;
  hideCommunity?: InputMaybe<Scalars['Boolean']['input']>;
  includeRelatedQuestions?: InputMaybe<Scalars['String']['input']>;
  karmaThreshold?: InputMaybe<Scalars['Int']['input']>;
  limit?: InputMaybe<Scalars['String']['input']>;
  notPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  postIds?: InputMaybe<Array<Scalars['String']['input']>>;
  question?: InputMaybe<Scalars['Boolean']['input']>;
  sortedBy?: InputMaybe<Scalars['String']['input']>;
  timeField?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
  view?: InputMaybe<Scalars['String']['input']>;
};

export type PostsNearbyEventsInput = {
  af?: InputMaybe<Scalars['Boolean']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  curatedAfter?: InputMaybe<Scalars['String']['input']>;
  distance?: InputMaybe<Scalars['Float']['input']>;
  eventType?: InputMaybe<Array<Scalars['String']['input']>>;
  exactPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  excludeEvents?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Scalars['String']['input']>;
  filterSettings?: InputMaybe<Scalars['JSON']['input']>;
  filters?: InputMaybe<Array<Scalars['String']['input']>>;
  groupId?: InputMaybe<Scalars['String']['input']>;
  hideCommunity?: InputMaybe<Scalars['Boolean']['input']>;
  includeRelatedQuestions?: InputMaybe<Scalars['String']['input']>;
  karmaThreshold?: InputMaybe<Scalars['Int']['input']>;
  lat?: InputMaybe<Scalars['Float']['input']>;
  lng?: InputMaybe<Scalars['Float']['input']>;
  notPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  onlineEvent?: InputMaybe<Scalars['Boolean']['input']>;
  postIds?: InputMaybe<Array<Scalars['String']['input']>>;
  question?: InputMaybe<Scalars['Boolean']['input']>;
  sortedBy?: InputMaybe<Scalars['String']['input']>;
  timeField?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
  view?: InputMaybe<Scalars['String']['input']>;
};

export type PostsNewInput = {
  af?: InputMaybe<Scalars['Boolean']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  curatedAfter?: InputMaybe<Scalars['String']['input']>;
  exactPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  excludeEvents?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Scalars['String']['input']>;
  filterSettings?: InputMaybe<Scalars['JSON']['input']>;
  forum?: InputMaybe<Scalars['Boolean']['input']>;
  groupId?: InputMaybe<Scalars['String']['input']>;
  hideCommunity?: InputMaybe<Scalars['Boolean']['input']>;
  includeRelatedQuestions?: InputMaybe<Scalars['String']['input']>;
  karmaThreshold?: InputMaybe<Scalars['Int']['input']>;
  meta?: InputMaybe<Scalars['Boolean']['input']>;
  notPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  postIds?: InputMaybe<Array<Scalars['String']['input']>>;
  question?: InputMaybe<Scalars['Boolean']['input']>;
  sortedBy?: InputMaybe<Scalars['String']['input']>;
  timeField?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
  view?: InputMaybe<Scalars['String']['input']>;
};

export type PostsNominatablePostsByVoteInput = {
  af?: InputMaybe<Scalars['Boolean']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  curatedAfter?: InputMaybe<Scalars['String']['input']>;
  exactPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  excludeEvents?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Scalars['String']['input']>;
  filterSettings?: InputMaybe<Scalars['JSON']['input']>;
  groupId?: InputMaybe<Scalars['String']['input']>;
  hideCommunity?: InputMaybe<Scalars['Boolean']['input']>;
  includeRelatedQuestions?: InputMaybe<Scalars['String']['input']>;
  karmaThreshold?: InputMaybe<Scalars['Int']['input']>;
  notPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  postIds?: InputMaybe<Array<Scalars['String']['input']>>;
  question?: InputMaybe<Scalars['Boolean']['input']>;
  requiredFrontpage?: InputMaybe<Scalars['Boolean']['input']>;
  requiredUnnominated?: InputMaybe<Scalars['Boolean']['input']>;
  sortedBy?: InputMaybe<Scalars['String']['input']>;
  timeField?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
  view?: InputMaybe<Scalars['String']['input']>;
};

export type PostsNominations2018Input = {
  af?: InputMaybe<Scalars['Boolean']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  curatedAfter?: InputMaybe<Scalars['String']['input']>;
  exactPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  excludeEvents?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Scalars['String']['input']>;
  filterSettings?: InputMaybe<Scalars['JSON']['input']>;
  groupId?: InputMaybe<Scalars['String']['input']>;
  hideCommunity?: InputMaybe<Scalars['Boolean']['input']>;
  includeRelatedQuestions?: InputMaybe<Scalars['String']['input']>;
  karmaThreshold?: InputMaybe<Scalars['Int']['input']>;
  notPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  postIds?: InputMaybe<Array<Scalars['String']['input']>>;
  question?: InputMaybe<Scalars['Boolean']['input']>;
  sortByMost?: InputMaybe<Scalars['Boolean']['input']>;
  sortedBy?: InputMaybe<Scalars['String']['input']>;
  timeField?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
  view?: InputMaybe<Scalars['String']['input']>;
};

export type PostsNominations2019Input = {
  af?: InputMaybe<Scalars['Boolean']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  curatedAfter?: InputMaybe<Scalars['String']['input']>;
  exactPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  excludeEvents?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Scalars['String']['input']>;
  filterSettings?: InputMaybe<Scalars['JSON']['input']>;
  groupId?: InputMaybe<Scalars['String']['input']>;
  hideCommunity?: InputMaybe<Scalars['Boolean']['input']>;
  includeRelatedQuestions?: InputMaybe<Scalars['String']['input']>;
  karmaThreshold?: InputMaybe<Scalars['Int']['input']>;
  notPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  postIds?: InputMaybe<Array<Scalars['String']['input']>>;
  question?: InputMaybe<Scalars['Boolean']['input']>;
  sortByMost?: InputMaybe<Scalars['Boolean']['input']>;
  sortedBy?: InputMaybe<Scalars['String']['input']>;
  timeField?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
  view?: InputMaybe<Scalars['String']['input']>;
};

export type PostsNonEventGroupPostsInput = {
  af?: InputMaybe<Scalars['Boolean']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  curatedAfter?: InputMaybe<Scalars['String']['input']>;
  exactPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  excludeEvents?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Scalars['String']['input']>;
  filterSettings?: InputMaybe<Scalars['JSON']['input']>;
  groupId?: InputMaybe<Scalars['String']['input']>;
  hideCommunity?: InputMaybe<Scalars['Boolean']['input']>;
  includeRelatedQuestions?: InputMaybe<Scalars['String']['input']>;
  karmaThreshold?: InputMaybe<Scalars['Int']['input']>;
  notPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  postIds?: InputMaybe<Array<Scalars['String']['input']>>;
  question?: InputMaybe<Scalars['Boolean']['input']>;
  sortedBy?: InputMaybe<Scalars['String']['input']>;
  timeField?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
  view?: InputMaybe<Scalars['String']['input']>;
};

export type PostsOldInput = {
  af?: InputMaybe<Scalars['Boolean']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  curatedAfter?: InputMaybe<Scalars['String']['input']>;
  exactPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  excludeEvents?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Scalars['String']['input']>;
  filterSettings?: InputMaybe<Scalars['JSON']['input']>;
  groupId?: InputMaybe<Scalars['String']['input']>;
  hideCommunity?: InputMaybe<Scalars['Boolean']['input']>;
  includeRelatedQuestions?: InputMaybe<Scalars['String']['input']>;
  karmaThreshold?: InputMaybe<Scalars['Int']['input']>;
  notPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  postIds?: InputMaybe<Array<Scalars['String']['input']>>;
  question?: InputMaybe<Scalars['Boolean']['input']>;
  sortedBy?: InputMaybe<Scalars['String']['input']>;
  timeField?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
  view?: InputMaybe<Scalars['String']['input']>;
};

export type PostsPastEventsInput = {
  af?: InputMaybe<Scalars['Boolean']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  curatedAfter?: InputMaybe<Scalars['String']['input']>;
  exactPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  excludeEvents?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Scalars['String']['input']>;
  filterSettings?: InputMaybe<Scalars['JSON']['input']>;
  groupId?: InputMaybe<Scalars['String']['input']>;
  hideCommunity?: InputMaybe<Scalars['Boolean']['input']>;
  includeRelatedQuestions?: InputMaybe<Scalars['String']['input']>;
  karmaThreshold?: InputMaybe<Scalars['Int']['input']>;
  notPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  postIds?: InputMaybe<Array<Scalars['String']['input']>>;
  question?: InputMaybe<Scalars['Boolean']['input']>;
  sortedBy?: InputMaybe<Scalars['String']['input']>;
  timeField?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
  view?: InputMaybe<Scalars['String']['input']>;
};

export type PostsPingbackPostsInput = {
  af?: InputMaybe<Scalars['Boolean']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  curatedAfter?: InputMaybe<Scalars['String']['input']>;
  exactPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  excludeEvents?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Scalars['String']['input']>;
  filterSettings?: InputMaybe<Scalars['JSON']['input']>;
  groupId?: InputMaybe<Scalars['String']['input']>;
  hideCommunity?: InputMaybe<Scalars['Boolean']['input']>;
  includeRelatedQuestions?: InputMaybe<Scalars['String']['input']>;
  karmaThreshold?: InputMaybe<Scalars['Int']['input']>;
  notPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  postId?: InputMaybe<Scalars['String']['input']>;
  postIds?: InputMaybe<Array<Scalars['String']['input']>>;
  question?: InputMaybe<Scalars['Boolean']['input']>;
  sortedBy?: InputMaybe<Scalars['String']['input']>;
  timeField?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
  view?: InputMaybe<Scalars['String']['input']>;
};

export type PostsPostsWithBannedUsersInput = {
  af?: InputMaybe<Scalars['Boolean']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  curatedAfter?: InputMaybe<Scalars['String']['input']>;
  exactPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  excludeEvents?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Scalars['String']['input']>;
  filterSettings?: InputMaybe<Scalars['JSON']['input']>;
  groupId?: InputMaybe<Scalars['String']['input']>;
  hideCommunity?: InputMaybe<Scalars['Boolean']['input']>;
  includeRelatedQuestions?: InputMaybe<Scalars['String']['input']>;
  karmaThreshold?: InputMaybe<Scalars['Int']['input']>;
  notPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  postIds?: InputMaybe<Array<Scalars['String']['input']>>;
  question?: InputMaybe<Scalars['Boolean']['input']>;
  sortedBy?: InputMaybe<Scalars['String']['input']>;
  timeField?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
  view?: InputMaybe<Scalars['String']['input']>;
};

export type PostsRecentCommentsInput = {
  af?: InputMaybe<Scalars['Boolean']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  curatedAfter?: InputMaybe<Scalars['String']['input']>;
  exactPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  excludeEvents?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Scalars['String']['input']>;
  filterSettings?: InputMaybe<Scalars['JSON']['input']>;
  groupId?: InputMaybe<Scalars['String']['input']>;
  hideCommunity?: InputMaybe<Scalars['Boolean']['input']>;
  includeRelatedQuestions?: InputMaybe<Scalars['String']['input']>;
  karmaThreshold?: InputMaybe<Scalars['Int']['input']>;
  notPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  postIds?: InputMaybe<Array<Scalars['String']['input']>>;
  question?: InputMaybe<Scalars['Boolean']['input']>;
  sortedBy?: InputMaybe<Scalars['String']['input']>;
  timeField?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
  view?: InputMaybe<Scalars['String']['input']>;
};

export type PostsRecentDiscussionThreadsListInput = {
  af?: InputMaybe<Scalars['Boolean']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  curatedAfter?: InputMaybe<Scalars['String']['input']>;
  exactPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  excludeEvents?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Scalars['String']['input']>;
  filterSettings?: InputMaybe<Scalars['JSON']['input']>;
  groupId?: InputMaybe<Scalars['String']['input']>;
  hideCommunity?: InputMaybe<Scalars['Boolean']['input']>;
  includeRelatedQuestions?: InputMaybe<Scalars['String']['input']>;
  karmaThreshold?: InputMaybe<Scalars['Int']['input']>;
  limit?: InputMaybe<Scalars['String']['input']>;
  notPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  postIds?: InputMaybe<Array<Scalars['String']['input']>>;
  question?: InputMaybe<Scalars['Boolean']['input']>;
  sortedBy?: InputMaybe<Scalars['String']['input']>;
  timeField?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
  view?: InputMaybe<Scalars['String']['input']>;
};

export type PostsRecentQuestionActivityInput = {
  af?: InputMaybe<Scalars['Boolean']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  curatedAfter?: InputMaybe<Scalars['String']['input']>;
  exactPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  excludeEvents?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Scalars['String']['input']>;
  filterSettings?: InputMaybe<Scalars['JSON']['input']>;
  groupId?: InputMaybe<Scalars['String']['input']>;
  hideCommunity?: InputMaybe<Scalars['Boolean']['input']>;
  includeRelatedQuestions?: InputMaybe<Scalars['String']['input']>;
  karmaThreshold?: InputMaybe<Scalars['Int']['input']>;
  notPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  postIds?: InputMaybe<Array<Scalars['String']['input']>>;
  question?: InputMaybe<Scalars['Boolean']['input']>;
  sortedBy?: InputMaybe<Scalars['String']['input']>;
  timeField?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
  view?: InputMaybe<Scalars['String']['input']>;
};

export type PostsRejectedInput = {
  af?: InputMaybe<Scalars['Boolean']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  curatedAfter?: InputMaybe<Scalars['String']['input']>;
  exactPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  excludeEvents?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Scalars['String']['input']>;
  filterSettings?: InputMaybe<Scalars['JSON']['input']>;
  groupId?: InputMaybe<Scalars['String']['input']>;
  hideCommunity?: InputMaybe<Scalars['Boolean']['input']>;
  includeRelatedQuestions?: InputMaybe<Scalars['String']['input']>;
  karmaThreshold?: InputMaybe<Scalars['Int']['input']>;
  notPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  postIds?: InputMaybe<Array<Scalars['String']['input']>>;
  question?: InputMaybe<Scalars['Boolean']['input']>;
  sortedBy?: InputMaybe<Scalars['String']['input']>;
  timeField?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
  view?: InputMaybe<Scalars['String']['input']>;
};

export type PostsReviewFinalVotingInput = {
  af?: InputMaybe<Scalars['Boolean']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  curatedAfter?: InputMaybe<Scalars['String']['input']>;
  exactPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  excludeEvents?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Scalars['String']['input']>;
  filterSettings?: InputMaybe<Scalars['JSON']['input']>;
  groupId?: InputMaybe<Scalars['String']['input']>;
  hideCommunity?: InputMaybe<Scalars['Boolean']['input']>;
  includeRelatedQuestions?: InputMaybe<Scalars['String']['input']>;
  karmaThreshold?: InputMaybe<Scalars['Int']['input']>;
  notPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  postIds?: InputMaybe<Array<Scalars['String']['input']>>;
  question?: InputMaybe<Scalars['Boolean']['input']>;
  sortedBy?: InputMaybe<Scalars['String']['input']>;
  timeField?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
  view?: InputMaybe<Scalars['String']['input']>;
};

export type PostsReviewQuickPageInput = {
  af?: InputMaybe<Scalars['Boolean']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  curatedAfter?: InputMaybe<Scalars['String']['input']>;
  exactPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  excludeEvents?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Scalars['String']['input']>;
  filterSettings?: InputMaybe<Scalars['JSON']['input']>;
  groupId?: InputMaybe<Scalars['String']['input']>;
  hideCommunity?: InputMaybe<Scalars['Boolean']['input']>;
  includeRelatedQuestions?: InputMaybe<Scalars['String']['input']>;
  karmaThreshold?: InputMaybe<Scalars['Int']['input']>;
  notPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  postIds?: InputMaybe<Array<Scalars['String']['input']>>;
  question?: InputMaybe<Scalars['Boolean']['input']>;
  sortedBy?: InputMaybe<Scalars['String']['input']>;
  timeField?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
  view?: InputMaybe<Scalars['String']['input']>;
};

export type PostsReviewRecentDiscussionThreadsList2018Input = {
  af?: InputMaybe<Scalars['Boolean']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  curatedAfter?: InputMaybe<Scalars['String']['input']>;
  exactPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  excludeEvents?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Scalars['String']['input']>;
  filterSettings?: InputMaybe<Scalars['JSON']['input']>;
  groupId?: InputMaybe<Scalars['String']['input']>;
  hideCommunity?: InputMaybe<Scalars['Boolean']['input']>;
  includeRelatedQuestions?: InputMaybe<Scalars['String']['input']>;
  karmaThreshold?: InputMaybe<Scalars['Int']['input']>;
  limit?: InputMaybe<Scalars['String']['input']>;
  notPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  postIds?: InputMaybe<Array<Scalars['String']['input']>>;
  question?: InputMaybe<Scalars['Boolean']['input']>;
  sortedBy?: InputMaybe<Scalars['String']['input']>;
  timeField?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
  view?: InputMaybe<Scalars['String']['input']>;
};

export type PostsReviewRecentDiscussionThreadsList2019Input = {
  af?: InputMaybe<Scalars['Boolean']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  curatedAfter?: InputMaybe<Scalars['String']['input']>;
  exactPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  excludeEvents?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Scalars['String']['input']>;
  filterSettings?: InputMaybe<Scalars['JSON']['input']>;
  groupId?: InputMaybe<Scalars['String']['input']>;
  hideCommunity?: InputMaybe<Scalars['Boolean']['input']>;
  includeRelatedQuestions?: InputMaybe<Scalars['String']['input']>;
  karmaThreshold?: InputMaybe<Scalars['Int']['input']>;
  limit?: InputMaybe<Scalars['String']['input']>;
  notPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  postIds?: InputMaybe<Array<Scalars['String']['input']>>;
  question?: InputMaybe<Scalars['Boolean']['input']>;
  sortedBy?: InputMaybe<Scalars['String']['input']>;
  timeField?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
  view?: InputMaybe<Scalars['String']['input']>;
};

export type PostsReviewVotingInput = {
  af?: InputMaybe<Scalars['Boolean']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  curatedAfter?: InputMaybe<Scalars['String']['input']>;
  exactPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  excludeEvents?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Scalars['String']['input']>;
  filterSettings?: InputMaybe<Scalars['JSON']['input']>;
  groupId?: InputMaybe<Scalars['String']['input']>;
  hideCommunity?: InputMaybe<Scalars['Boolean']['input']>;
  includeRelatedQuestions?: InputMaybe<Scalars['String']['input']>;
  karmaThreshold?: InputMaybe<Scalars['Int']['input']>;
  notPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  postIds?: InputMaybe<Array<Scalars['String']['input']>>;
  question?: InputMaybe<Scalars['Boolean']['input']>;
  reviewPhase?: InputMaybe<Scalars['String']['input']>;
  sortedBy?: InputMaybe<Scalars['String']['input']>;
  timeField?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
  view?: InputMaybe<Scalars['String']['input']>;
};

export type PostsReviews2018Input = {
  af?: InputMaybe<Scalars['Boolean']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  curatedAfter?: InputMaybe<Scalars['String']['input']>;
  exactPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  excludeEvents?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Scalars['String']['input']>;
  filterSettings?: InputMaybe<Scalars['JSON']['input']>;
  groupId?: InputMaybe<Scalars['String']['input']>;
  hideCommunity?: InputMaybe<Scalars['Boolean']['input']>;
  includeRelatedQuestions?: InputMaybe<Scalars['String']['input']>;
  karmaThreshold?: InputMaybe<Scalars['Int']['input']>;
  notPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  postIds?: InputMaybe<Array<Scalars['String']['input']>>;
  question?: InputMaybe<Scalars['Boolean']['input']>;
  sortBy?: InputMaybe<Scalars['String']['input']>;
  sortedBy?: InputMaybe<Scalars['String']['input']>;
  timeField?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
  view?: InputMaybe<Scalars['String']['input']>;
};

export type PostsReviews2019Input = {
  af?: InputMaybe<Scalars['Boolean']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  curatedAfter?: InputMaybe<Scalars['String']['input']>;
  exactPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  excludeEvents?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Scalars['String']['input']>;
  filterSettings?: InputMaybe<Scalars['JSON']['input']>;
  groupId?: InputMaybe<Scalars['String']['input']>;
  hideCommunity?: InputMaybe<Scalars['Boolean']['input']>;
  includeRelatedQuestions?: InputMaybe<Scalars['String']['input']>;
  karmaThreshold?: InputMaybe<Scalars['Int']['input']>;
  notPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  postIds?: InputMaybe<Array<Scalars['String']['input']>>;
  question?: InputMaybe<Scalars['Boolean']['input']>;
  sortBy?: InputMaybe<Scalars['String']['input']>;
  sortedBy?: InputMaybe<Scalars['String']['input']>;
  timeField?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
  view?: InputMaybe<Scalars['String']['input']>;
};

export type PostsRssInput = {
  af?: InputMaybe<Scalars['Boolean']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  curatedAfter?: InputMaybe<Scalars['String']['input']>;
  exactPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  excludeEvents?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Scalars['String']['input']>;
  filterSettings?: InputMaybe<Scalars['JSON']['input']>;
  forum?: InputMaybe<Scalars['Boolean']['input']>;
  groupId?: InputMaybe<Scalars['String']['input']>;
  hideCommunity?: InputMaybe<Scalars['Boolean']['input']>;
  includeRelatedQuestions?: InputMaybe<Scalars['String']['input']>;
  karmaThreshold?: InputMaybe<Scalars['Int']['input']>;
  meta?: InputMaybe<Scalars['Boolean']['input']>;
  notPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  postIds?: InputMaybe<Array<Scalars['String']['input']>>;
  question?: InputMaybe<Scalars['Boolean']['input']>;
  sortedBy?: InputMaybe<Scalars['String']['input']>;
  timeField?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
  view?: InputMaybe<Scalars['String']['input']>;
};

export type PostsScheduledInput = {
  af?: InputMaybe<Scalars['Boolean']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  curatedAfter?: InputMaybe<Scalars['String']['input']>;
  exactPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  excludeEvents?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Scalars['String']['input']>;
  filterSettings?: InputMaybe<Scalars['JSON']['input']>;
  groupId?: InputMaybe<Scalars['String']['input']>;
  hideCommunity?: InputMaybe<Scalars['Boolean']['input']>;
  includeRelatedQuestions?: InputMaybe<Scalars['String']['input']>;
  karmaThreshold?: InputMaybe<Scalars['Int']['input']>;
  notPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  postIds?: InputMaybe<Array<Scalars['String']['input']>>;
  question?: InputMaybe<Scalars['Boolean']['input']>;
  sortedBy?: InputMaybe<Scalars['String']['input']>;
  timeField?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
  view?: InputMaybe<Scalars['String']['input']>;
};

export type PostsSlugPostInput = {
  af?: InputMaybe<Scalars['Boolean']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  curatedAfter?: InputMaybe<Scalars['String']['input']>;
  exactPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  excludeEvents?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Scalars['String']['input']>;
  filterSettings?: InputMaybe<Scalars['JSON']['input']>;
  groupId?: InputMaybe<Scalars['String']['input']>;
  hideCommunity?: InputMaybe<Scalars['Boolean']['input']>;
  includeRelatedQuestions?: InputMaybe<Scalars['String']['input']>;
  karmaThreshold?: InputMaybe<Scalars['Int']['input']>;
  notPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  postIds?: InputMaybe<Array<Scalars['String']['input']>>;
  question?: InputMaybe<Scalars['Boolean']['input']>;
  slug?: InputMaybe<Scalars['String']['input']>;
  sortedBy?: InputMaybe<Scalars['String']['input']>;
  timeField?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
  view?: InputMaybe<Scalars['String']['input']>;
};

export type PostsStickiedInput = {
  af?: InputMaybe<Scalars['Boolean']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  curatedAfter?: InputMaybe<Scalars['String']['input']>;
  exactPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  excludeEvents?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Scalars['String']['input']>;
  filterSettings?: InputMaybe<Scalars['JSON']['input']>;
  forum?: InputMaybe<Scalars['Boolean']['input']>;
  groupId?: InputMaybe<Scalars['String']['input']>;
  hideCommunity?: InputMaybe<Scalars['Boolean']['input']>;
  includeRelatedQuestions?: InputMaybe<Scalars['String']['input']>;
  karmaThreshold?: InputMaybe<Scalars['Int']['input']>;
  notPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  postIds?: InputMaybe<Array<Scalars['String']['input']>>;
  question?: InputMaybe<Scalars['Boolean']['input']>;
  sortedBy?: InputMaybe<Scalars['String']['input']>;
  timeField?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
  view?: InputMaybe<Scalars['String']['input']>;
};

export type PostsSunshineAutoClassifiedPostsInput = {
  af?: InputMaybe<Scalars['Boolean']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  curatedAfter?: InputMaybe<Scalars['String']['input']>;
  exactPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  excludeEvents?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Scalars['String']['input']>;
  filterSettings?: InputMaybe<Scalars['JSON']['input']>;
  groupId?: InputMaybe<Scalars['String']['input']>;
  hideCommunity?: InputMaybe<Scalars['Boolean']['input']>;
  includeRelatedQuestions?: InputMaybe<Scalars['String']['input']>;
  karmaThreshold?: InputMaybe<Scalars['Int']['input']>;
  notPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  postIds?: InputMaybe<Array<Scalars['String']['input']>>;
  question?: InputMaybe<Scalars['Boolean']['input']>;
  sortedBy?: InputMaybe<Scalars['String']['input']>;
  timeField?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
  view?: InputMaybe<Scalars['String']['input']>;
};

export type PostsSunshineCuratedSuggestionsInput = {
  af?: InputMaybe<Scalars['Boolean']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
  audioOnly?: InputMaybe<Scalars['Boolean']['input']>;
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  curatedAfter?: InputMaybe<Scalars['String']['input']>;
  exactPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  excludeEvents?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Scalars['String']['input']>;
  filterSettings?: InputMaybe<Scalars['JSON']['input']>;
  groupId?: InputMaybe<Scalars['String']['input']>;
  hideCommunity?: InputMaybe<Scalars['Boolean']['input']>;
  includeRelatedQuestions?: InputMaybe<Scalars['String']['input']>;
  karmaThreshold?: InputMaybe<Scalars['Int']['input']>;
  notPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  postIds?: InputMaybe<Array<Scalars['String']['input']>>;
  question?: InputMaybe<Scalars['Boolean']['input']>;
  sortedBy?: InputMaybe<Scalars['String']['input']>;
  timeField?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
  view?: InputMaybe<Scalars['String']['input']>;
};

export type PostsSunshineNewPostsInput = {
  af?: InputMaybe<Scalars['Boolean']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  curatedAfter?: InputMaybe<Scalars['String']['input']>;
  exactPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  excludeEvents?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Scalars['String']['input']>;
  filterSettings?: InputMaybe<Scalars['JSON']['input']>;
  groupId?: InputMaybe<Scalars['String']['input']>;
  hideCommunity?: InputMaybe<Scalars['Boolean']['input']>;
  includeRelatedQuestions?: InputMaybe<Scalars['String']['input']>;
  karmaThreshold?: InputMaybe<Scalars['Int']['input']>;
  notPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  postIds?: InputMaybe<Array<Scalars['String']['input']>>;
  question?: InputMaybe<Scalars['Boolean']['input']>;
  sortedBy?: InputMaybe<Scalars['String']['input']>;
  timeField?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
  view?: InputMaybe<Scalars['String']['input']>;
};

export type PostsSunshineNewUsersPostsInput = {
  af?: InputMaybe<Scalars['Boolean']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  curatedAfter?: InputMaybe<Scalars['String']['input']>;
  exactPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  excludeEvents?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Scalars['String']['input']>;
  filterSettings?: InputMaybe<Scalars['JSON']['input']>;
  groupId?: InputMaybe<Scalars['String']['input']>;
  hideCommunity?: InputMaybe<Scalars['Boolean']['input']>;
  includeRelatedQuestions?: InputMaybe<Scalars['String']['input']>;
  karmaThreshold?: InputMaybe<Scalars['Int']['input']>;
  notPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  postIds?: InputMaybe<Array<Scalars['String']['input']>>;
  question?: InputMaybe<Scalars['Boolean']['input']>;
  sortedBy?: InputMaybe<Scalars['String']['input']>;
  timeField?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
  view?: InputMaybe<Scalars['String']['input']>;
};

export type PostsTagRelevanceInput = {
  af?: InputMaybe<Scalars['Boolean']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  curatedAfter?: InputMaybe<Scalars['String']['input']>;
  exactPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  excludeEvents?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Scalars['String']['input']>;
  filterSettings?: InputMaybe<Scalars['JSON']['input']>;
  groupId?: InputMaybe<Scalars['String']['input']>;
  hideCommunity?: InputMaybe<Scalars['Boolean']['input']>;
  includeRelatedQuestions?: InputMaybe<Scalars['String']['input']>;
  karmaThreshold?: InputMaybe<Scalars['Int']['input']>;
  notPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  postIds?: InputMaybe<Array<Scalars['String']['input']>>;
  question?: InputMaybe<Scalars['Boolean']['input']>;
  sortedBy?: InputMaybe<Scalars['String']['input']>;
  tagId?: InputMaybe<Scalars['String']['input']>;
  timeField?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
  view?: InputMaybe<Scalars['String']['input']>;
};

export type PostsTbdEventsInput = {
  af?: InputMaybe<Scalars['Boolean']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  curatedAfter?: InputMaybe<Scalars['String']['input']>;
  exactPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  excludeEvents?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Scalars['String']['input']>;
  filterSettings?: InputMaybe<Scalars['JSON']['input']>;
  groupId?: InputMaybe<Scalars['String']['input']>;
  hideCommunity?: InputMaybe<Scalars['Boolean']['input']>;
  includeRelatedQuestions?: InputMaybe<Scalars['String']['input']>;
  karmaThreshold?: InputMaybe<Scalars['Int']['input']>;
  notPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  postIds?: InputMaybe<Array<Scalars['String']['input']>>;
  question?: InputMaybe<Scalars['Boolean']['input']>;
  sortedBy?: InputMaybe<Scalars['String']['input']>;
  timeField?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
  view?: InputMaybe<Scalars['String']['input']>;
};

export type PostsTimeframeInput = {
  af?: InputMaybe<Scalars['Boolean']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  curatedAfter?: InputMaybe<Scalars['String']['input']>;
  exactPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  excludeEvents?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Scalars['String']['input']>;
  filterSettings?: InputMaybe<Scalars['JSON']['input']>;
  groupId?: InputMaybe<Scalars['String']['input']>;
  hideCommunity?: InputMaybe<Scalars['Boolean']['input']>;
  includeRelatedQuestions?: InputMaybe<Scalars['String']['input']>;
  karmaThreshold?: InputMaybe<Scalars['Int']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  notPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  postIds?: InputMaybe<Array<Scalars['String']['input']>>;
  question?: InputMaybe<Scalars['Boolean']['input']>;
  requiredFrontpage?: InputMaybe<Scalars['Boolean']['input']>;
  requiredUnnominated?: InputMaybe<Scalars['Boolean']['input']>;
  sortedBy?: InputMaybe<Scalars['String']['input']>;
  timeField?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
  view?: InputMaybe<Scalars['String']['input']>;
};

export type PostsTopInput = {
  af?: InputMaybe<Scalars['Boolean']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  curatedAfter?: InputMaybe<Scalars['String']['input']>;
  exactPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  excludeEvents?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Scalars['String']['input']>;
  filterSettings?: InputMaybe<Scalars['JSON']['input']>;
  forum?: InputMaybe<Scalars['Boolean']['input']>;
  groupId?: InputMaybe<Scalars['String']['input']>;
  hideCommunity?: InputMaybe<Scalars['Boolean']['input']>;
  includeRelatedQuestions?: InputMaybe<Scalars['String']['input']>;
  karmaThreshold?: InputMaybe<Scalars['Int']['input']>;
  meta?: InputMaybe<Scalars['Boolean']['input']>;
  notPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  postIds?: InputMaybe<Array<Scalars['String']['input']>>;
  question?: InputMaybe<Scalars['Boolean']['input']>;
  sortedBy?: InputMaybe<Scalars['String']['input']>;
  timeField?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
  view?: InputMaybe<Scalars['String']['input']>;
};

export type PostsTopQuestionsInput = {
  af?: InputMaybe<Scalars['Boolean']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  curatedAfter?: InputMaybe<Scalars['String']['input']>;
  exactPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  excludeEvents?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Scalars['String']['input']>;
  filterSettings?: InputMaybe<Scalars['JSON']['input']>;
  groupId?: InputMaybe<Scalars['String']['input']>;
  hideCommunity?: InputMaybe<Scalars['Boolean']['input']>;
  includeRelatedQuestions?: InputMaybe<Scalars['String']['input']>;
  karmaThreshold?: InputMaybe<Scalars['Int']['input']>;
  notPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  postIds?: InputMaybe<Array<Scalars['String']['input']>>;
  question?: InputMaybe<Scalars['Boolean']['input']>;
  sortedBy?: InputMaybe<Scalars['String']['input']>;
  timeField?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
  view?: InputMaybe<Scalars['String']['input']>;
};

export type PostsUnlistedInput = {
  af?: InputMaybe<Scalars['Boolean']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  curatedAfter?: InputMaybe<Scalars['String']['input']>;
  exactPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  excludeEvents?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Scalars['String']['input']>;
  filterSettings?: InputMaybe<Scalars['JSON']['input']>;
  groupId?: InputMaybe<Scalars['String']['input']>;
  hideCommunity?: InputMaybe<Scalars['Boolean']['input']>;
  includeRelatedQuestions?: InputMaybe<Scalars['String']['input']>;
  karmaThreshold?: InputMaybe<Scalars['Int']['input']>;
  notPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  postIds?: InputMaybe<Array<Scalars['String']['input']>>;
  question?: InputMaybe<Scalars['Boolean']['input']>;
  sortedBy?: InputMaybe<Scalars['String']['input']>;
  timeField?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
  view?: InputMaybe<Scalars['String']['input']>;
};

export type PostsUpcomingEventsInput = {
  af?: InputMaybe<Scalars['Boolean']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  curatedAfter?: InputMaybe<Scalars['String']['input']>;
  exactPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  excludeEvents?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Scalars['String']['input']>;
  filterSettings?: InputMaybe<Scalars['JSON']['input']>;
  groupId?: InputMaybe<Scalars['String']['input']>;
  hideCommunity?: InputMaybe<Scalars['Boolean']['input']>;
  includeRelatedQuestions?: InputMaybe<Scalars['String']['input']>;
  karmaThreshold?: InputMaybe<Scalars['Int']['input']>;
  notPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  postIds?: InputMaybe<Array<Scalars['String']['input']>>;
  question?: InputMaybe<Scalars['Boolean']['input']>;
  sortedBy?: InputMaybe<Scalars['String']['input']>;
  timeField?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
  view?: InputMaybe<Scalars['String']['input']>;
};

export type PostsUserAfSubmissionsInput = {
  af?: InputMaybe<Scalars['Boolean']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  curatedAfter?: InputMaybe<Scalars['String']['input']>;
  exactPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  excludeEvents?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Scalars['String']['input']>;
  filterSettings?: InputMaybe<Scalars['JSON']['input']>;
  groupId?: InputMaybe<Scalars['String']['input']>;
  hideCommunity?: InputMaybe<Scalars['Boolean']['input']>;
  includeRelatedQuestions?: InputMaybe<Scalars['String']['input']>;
  karmaThreshold?: InputMaybe<Scalars['Int']['input']>;
  notPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  postIds?: InputMaybe<Array<Scalars['String']['input']>>;
  question?: InputMaybe<Scalars['Boolean']['input']>;
  sortedBy?: InputMaybe<Scalars['String']['input']>;
  timeField?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
  view?: InputMaybe<Scalars['String']['input']>;
};

export type PostsUserPostsInput = {
  af?: InputMaybe<Scalars['Boolean']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  curatedAfter?: InputMaybe<Scalars['String']['input']>;
  exactPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  excludeEvents?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Scalars['String']['input']>;
  filterSettings?: InputMaybe<Scalars['JSON']['input']>;
  groupId?: InputMaybe<Scalars['String']['input']>;
  hideCommunity?: InputMaybe<Scalars['Boolean']['input']>;
  includeRelatedQuestions?: InputMaybe<Scalars['String']['input']>;
  karmaThreshold?: InputMaybe<Scalars['Int']['input']>;
  notPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  postIds?: InputMaybe<Array<Scalars['String']['input']>>;
  question?: InputMaybe<Scalars['Boolean']['input']>;
  sortedBy?: InputMaybe<Scalars['String']['input']>;
  timeField?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
  view?: InputMaybe<Scalars['String']['input']>;
};

export type PostsVoting2019Input = {
  af?: InputMaybe<Scalars['Boolean']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  curatedAfter?: InputMaybe<Scalars['String']['input']>;
  exactPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  excludeEvents?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Scalars['String']['input']>;
  filterSettings?: InputMaybe<Scalars['JSON']['input']>;
  groupId?: InputMaybe<Scalars['String']['input']>;
  hideCommunity?: InputMaybe<Scalars['Boolean']['input']>;
  includeRelatedQuestions?: InputMaybe<Scalars['String']['input']>;
  karmaThreshold?: InputMaybe<Scalars['Int']['input']>;
  notPostIds?: InputMaybe<Array<Scalars['String']['input']>>;
  postIds?: InputMaybe<Array<Scalars['String']['input']>>;
  question?: InputMaybe<Scalars['Boolean']['input']>;
  sortBy?: InputMaybe<Scalars['String']['input']>;
  sortedBy?: InputMaybe<Scalars['String']['input']>;
  timeField?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
  view?: InputMaybe<Scalars['String']['input']>;
};

export type RssFeedSelector = {
  default?: InputMaybe<EmptyViewInput>;
  usersFeed?: InputMaybe<RssFeedsUsersFeedInput>;
};

export type RssFeedsUsersFeedInput = {
  userId?: InputMaybe<Scalars['String']['input']>;
};

export enum ReactPaletteStyle {
  GridView = 'gridView',
  ListView = 'listView'
}

export enum RecentDiscussionFeedEntryType {
  MeetupsPoke = 'meetupsPoke',
  PostCommented = 'postCommented',
  ShortformCommented = 'shortformCommented',
  SubscribeReminder = 'subscribeReminder',
  TagDiscussed = 'tagDiscussed',
  TagRevised = 'tagRevised'
}

export type RecommendationAlgorithmSettingsInput = {
  count: Scalars['Int']['input'];
  curatedModifier: Scalars['Float']['input'];
  frontpageModifier: Scalars['Float']['input'];
  method: Scalars['String']['input'];
  onlyUnread: Scalars['Boolean']['input'];
  personalBlogpostModifier: Scalars['Float']['input'];
  scoreExponent: Scalars['Float']['input'];
  scoreOffset: Scalars['Float']['input'];
};

export type RecommendationSettingsInput = {
  frontpage: RecommendationAlgorithmSettingsInput;
  frontpageEA: RecommendationAlgorithmSettingsInput;
  recommendationspage: RecommendationAlgorithmSettingsInput;
};

export type ReportSelector = {
  adminClaimedReports?: InputMaybe<ReportsAdminClaimedReportsInput>;
  allReports?: InputMaybe<EmptyViewInput>;
  claimedReports?: InputMaybe<EmptyViewInput>;
  closedReports?: InputMaybe<EmptyViewInput>;
  default?: InputMaybe<EmptyViewInput>;
  sunshineSidebarReports?: InputMaybe<EmptyViewInput>;
  unclaimedReports?: InputMaybe<EmptyViewInput>;
};

export type ReportsAdminClaimedReportsInput = {
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type ReviewVoteSelector = {
  default?: InputMaybe<EmptyViewInput>;
  reviewVotesAdminDashboard?: InputMaybe<ReviewVotesReviewVotesAdminDashboardInput>;
  reviewVotesForPost?: InputMaybe<EmptyViewInput>;
  reviewVotesForPostAndUser?: InputMaybe<ReviewVotesReviewVotesForPostAndUserInput>;
  reviewVotesFromUser?: InputMaybe<ReviewVotesReviewVotesFromUserInput>;
};

export type ReviewVotesReviewVotesAdminDashboardInput = {
  year?: InputMaybe<Scalars['String']['input']>;
};

export type ReviewVotesReviewVotesForPostAndUserInput = {
  postId?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type ReviewVotesReviewVotesFromUserInput = {
  userId?: InputMaybe<Scalars['String']['input']>;
  year?: InputMaybe<Scalars['String']['input']>;
};

export type ReviewWinnerArtSelector = {
  allForYear?: InputMaybe<ReviewWinnerArtsAllForYearInput>;
  default?: InputMaybe<EmptyViewInput>;
  postArt?: InputMaybe<ReviewWinnerArtsPostArtInput>;
};

export type ReviewWinnerArtsAllForYearInput = {
  year?: InputMaybe<Scalars['Int']['input']>;
};

export type ReviewWinnerArtsPostArtInput = {
  postId?: InputMaybe<Scalars['String']['input']>;
};

export type ReviewWinnerSelector = {
  bestOfLessWrongAnnouncement?: InputMaybe<EmptyViewInput>;
  default?: InputMaybe<EmptyViewInput>;
  reviewWinnerSingle?: InputMaybe<ReviewWinnersReviewWinnerSingleInput>;
};

export type ReviewWinnersReviewWinnerSingleInput = {
  category?: InputMaybe<Scalars['String']['input']>;
  reviewRanking?: InputMaybe<Scalars['String']['input']>;
  reviewYear?: InputMaybe<Scalars['String']['input']>;
};

export type RevisionSelector = {
  default?: InputMaybe<EmptyViewInput>;
  revisionByVersionNumber?: InputMaybe<RevisionsRevisionByVersionNumberInput>;
  revisionsByUser?: InputMaybe<RevisionsRevisionsByUserInput>;
  revisionsOnDocument?: InputMaybe<RevisionsRevisionsOnDocumentInput>;
};

export type RevisionsRevisionByVersionNumberInput = {
  documentId?: InputMaybe<Scalars['String']['input']>;
  fieldName?: InputMaybe<Scalars['String']['input']>;
  version?: InputMaybe<Scalars['String']['input']>;
};

export type RevisionsRevisionsByUserInput = {
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type RevisionsRevisionsOnDocumentInput = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  documentId?: InputMaybe<Scalars['String']['input']>;
  fieldName?: InputMaybe<Scalars['String']['input']>;
};

export type SelectorInput = {
  _id?: InputMaybe<Scalars['String']['input']>;
  documentId?: InputMaybe<Scalars['String']['input']>;
};

export type SequenceDefaultViewInput = {
  sequenceIds?: InputMaybe<Array<Scalars['String']['input']>>;
};

export type SequenceSelector = {
  communitySequences?: InputMaybe<SequencesCommunitySequencesInput>;
  curatedSequences?: InputMaybe<SequencesCuratedSequencesInput>;
  default?: InputMaybe<SequenceDefaultViewInput>;
  userProfile?: InputMaybe<SequencesUserProfileInput>;
  userProfileAll?: InputMaybe<SequencesUserProfileAllInput>;
  userProfilePrivate?: InputMaybe<SequencesUserProfilePrivateInput>;
};

export type SequencesCommunitySequencesInput = {
  sequenceIds?: InputMaybe<Array<Scalars['String']['input']>>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type SequencesCuratedSequencesInput = {
  sequenceIds?: InputMaybe<Array<Scalars['String']['input']>>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type SequencesUserProfileAllInput = {
  sequenceIds?: InputMaybe<Array<Scalars['String']['input']>>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type SequencesUserProfileInput = {
  sequenceIds?: InputMaybe<Array<Scalars['String']['input']>>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type SequencesUserProfilePrivateInput = {
  sequenceIds?: InputMaybe<Array<Scalars['String']['input']>>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type SetIsBookmarkedInput = {
  collectionName: Scalars['String']['input'];
  documentId: Scalars['String']['input'];
  isBookmarked: Scalars['Boolean']['input'];
};

export type SingleAdvisorRequestInput = {
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  selector?: InputMaybe<SelectorInput>;
};

export type SingleArbitalTagContentRelInput = {
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  selector?: InputMaybe<SelectorInput>;
};

export type SingleBanInput = {
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  selector?: InputMaybe<SelectorInput>;
};

export type SingleBookInput = {
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  selector?: InputMaybe<SelectorInput>;
};

export type SingleBookmarkInput = {
  allowNull?: InputMaybe<Scalars['Boolean']['input']>;
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  selector?: InputMaybe<SelectorInput>;
};

export type SingleChapterInput = {
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  selector?: InputMaybe<SelectorInput>;
};

export type SingleCkEditorUserSessionInput = {
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  selector?: InputMaybe<SelectorInput>;
};

export type SingleClientIdInput = {
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  selector?: InputMaybe<SelectorInput>;
};

export type SingleCollectionInput = {
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  selector?: InputMaybe<SelectorInput>;
};

export type SingleCommentInput = {
  allowNull?: InputMaybe<Scalars['Boolean']['input']>;
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  selector?: InputMaybe<SelectorInput>;
};

export type SingleCommentModeratorActionInput = {
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  selector?: InputMaybe<SelectorInput>;
};

export type SingleConversationInput = {
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  selector?: InputMaybe<SelectorInput>;
};

export type SingleCurationNoticeInput = {
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  selector?: InputMaybe<SelectorInput>;
};

export type SingleDialogueCheckInput = {
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  selector?: InputMaybe<SelectorInput>;
};

export type SingleDialogueMatchPreferenceInput = {
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  selector?: InputMaybe<SelectorInput>;
};

export type SingleDigestInput = {
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  selector?: InputMaybe<SelectorInput>;
};

export type SingleDigestPostInput = {
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  selector?: InputMaybe<SelectorInput>;
};

export type SingleElectionCandidateInput = {
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  selector?: InputMaybe<SelectorInput>;
};

export type SingleElectionVoteInput = {
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  selector?: InputMaybe<SelectorInput>;
};

export type SingleElicitQuestionInput = {
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  selector?: InputMaybe<SelectorInput>;
};

export type SingleElicitQuestionPredictionInput = {
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  selector?: InputMaybe<SelectorInput>;
};

export type SingleFeaturedResourceInput = {
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  selector?: InputMaybe<SelectorInput>;
};

export type SingleFieldChangeInput = {
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  selector?: InputMaybe<SelectorInput>;
};

export type SingleForumEventInput = {
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  selector?: InputMaybe<SelectorInput>;
};

export type SingleGardenCodeInput = {
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  selector?: InputMaybe<SelectorInput>;
};

export type SingleGoogleServiceAccountSessionInput = {
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  selector?: InputMaybe<SelectorInput>;
};

export type SingleJargonTermInput = {
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  selector?: InputMaybe<SelectorInput>;
};

export type SingleLwEventInput = {
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  selector?: InputMaybe<SelectorInput>;
};

export type SingleLlmConversationInput = {
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  selector?: InputMaybe<SelectorInput>;
};

export type SingleLocalgroupInput = {
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  selector?: InputMaybe<SelectorInput>;
};

export type SingleMessageInput = {
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  selector?: InputMaybe<SelectorInput>;
};

export type SingleModerationTemplateInput = {
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  selector?: InputMaybe<SelectorInput>;
};

export type SingleModeratorActionInput = {
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  selector?: InputMaybe<SelectorInput>;
};

export type SingleMultiDocumentInput = {
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  selector?: InputMaybe<SelectorInput>;
};

export type SingleNotificationInput = {
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  selector?: InputMaybe<SelectorInput>;
};

export type SinglePetrovDayActionInput = {
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  selector?: InputMaybe<SelectorInput>;
};

export type SinglePodcastEpisodeInput = {
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  selector?: InputMaybe<SelectorInput>;
};

export type SinglePodcastInput = {
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  selector?: InputMaybe<SelectorInput>;
};

export type SinglePostInput = {
  allowNull?: InputMaybe<Scalars['Boolean']['input']>;
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  selector?: InputMaybe<SelectorInput>;
};

export type SinglePostRelationInput = {
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  selector?: InputMaybe<SelectorInput>;
};

export type SingleRssFeedInput = {
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  selector?: InputMaybe<SelectorInput>;
};

export type SingleReportInput = {
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  selector?: InputMaybe<SelectorInput>;
};

export type SingleReviewVoteInput = {
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  selector?: InputMaybe<SelectorInput>;
};

export type SingleReviewWinnerArtInput = {
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  selector?: InputMaybe<SelectorInput>;
};

export type SingleReviewWinnerInput = {
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  selector?: InputMaybe<SelectorInput>;
};

export type SingleRevisionInput = {
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  selector?: InputMaybe<SelectorInput>;
};

export type SingleSequenceInput = {
  allowNull?: InputMaybe<Scalars['Boolean']['input']>;
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  selector?: InputMaybe<SelectorInput>;
};

export type SingleSplashArtCoordinateInput = {
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  selector?: InputMaybe<SelectorInput>;
};

export type SingleSpotlightInput = {
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  selector?: InputMaybe<SelectorInput>;
};

export type SingleSubscriptionInput = {
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  selector?: InputMaybe<SelectorInput>;
};

export type SingleSurveyInput = {
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  selector?: InputMaybe<SelectorInput>;
};

export type SingleSurveyQuestionInput = {
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  selector?: InputMaybe<SelectorInput>;
};

export type SingleSurveyResponseInput = {
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  selector?: InputMaybe<SelectorInput>;
};

export type SingleSurveyScheduleInput = {
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  selector?: InputMaybe<SelectorInput>;
};

export type SingleTagFlagInput = {
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  selector?: InputMaybe<SelectorInput>;
};

export type SingleTagInput = {
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  selector?: InputMaybe<SelectorInput>;
};

export type SingleTagRelInput = {
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  selector?: InputMaybe<SelectorInput>;
};

export type SingleTypingIndicatorInput = {
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  selector?: InputMaybe<SelectorInput>;
};

export type SingleUltraFeedEventInput = {
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  selector?: InputMaybe<SelectorInput>;
};

export type SingleUserEagDetailInput = {
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  selector?: InputMaybe<SelectorInput>;
};

export type SingleUserInput = {
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  selector?: InputMaybe<UserSelectorUniqueInput>;
};

export type SingleUserJobAdInput = {
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  selector?: InputMaybe<SelectorInput>;
};

export type SingleUserMostValuablePostInput = {
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  selector?: InputMaybe<SelectorInput>;
};

export type SingleUserRateLimitInput = {
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  selector?: InputMaybe<SelectorInput>;
};

export type SingleUserTagRelInput = {
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  selector?: InputMaybe<SelectorInput>;
};

export type SingleVoteInput = {
  resolverArgs?: InputMaybe<Scalars['JSON']['input']>;
  selector?: InputMaybe<SelectorInput>;
};

export type SocialPreviewInput = {
  imageId?: InputMaybe<Scalars['String']['input']>;
  text?: InputMaybe<Scalars['String']['input']>;
};

export type SplashArtCoordinateSelector = {
  default?: InputMaybe<EmptyViewInput>;
};

export enum SpotlightDocumentType {
  Post = 'Post',
  Sequence = 'Sequence',
  Tag = 'Tag'
}

export type SpotlightSelector = {
  default?: InputMaybe<EmptyViewInput>;
  mostRecentlyPromotedSpotlights?: InputMaybe<SpotlightsMostRecentlyPromotedSpotlightsInput>;
  spotlightsByDocumentIds?: InputMaybe<SpotlightsSpotlightsByDocumentIdsInput>;
  spotlightsById?: InputMaybe<SpotlightsSpotlightsByIdInput>;
  spotlightsPage?: InputMaybe<SpotlightsSpotlightsPageInput>;
  spotlightsPageDraft?: InputMaybe<SpotlightsSpotlightsPageDraftInput>;
};

export type SpotlightsMostRecentlyPromotedSpotlightsInput = {
  limit?: InputMaybe<Scalars['Int']['input']>;
};

export type SpotlightsSpotlightsByDocumentIdsInput = {
  documentIds?: InputMaybe<Scalars['String']['input']>;
};

export type SpotlightsSpotlightsByIdInput = {
  spotlightIds?: InputMaybe<Scalars['String']['input']>;
};

export type SpotlightsSpotlightsPageDraftInput = {
  limit?: InputMaybe<Scalars['Int']['input']>;
};

export type SpotlightsSpotlightsPageInput = {
  limit?: InputMaybe<Scalars['Int']['input']>;
};

export enum SubforumMagicFeedEntryType {
  TagSubforumComments = 'tagSubforumComments',
  TagSubforumPosts = 'tagSubforumPosts',
  TagSubforumStickyComments = 'tagSubforumStickyComments'
}

export enum SubforumNewFeedEntryType {
  TagSubforumComments = 'tagSubforumComments',
  TagSubforumPosts = 'tagSubforumPosts',
  TagSubforumStickyComments = 'tagSubforumStickyComments'
}

export enum SubforumOldFeedEntryType {
  TagSubforumComments = 'tagSubforumComments',
  TagSubforumPosts = 'tagSubforumPosts',
  TagSubforumStickyComments = 'tagSubforumStickyComments'
}

export enum SubforumPreferredLayout {
  Card = 'card',
  List = 'list'
}

export enum SubforumRecentCommentsFeedEntryType {
  TagSubforumComments = 'tagSubforumComments',
  TagSubforumPosts = 'tagSubforumPosts',
  TagSubforumStickyComments = 'tagSubforumStickyComments'
}

export enum SubforumTopFeedEntryType {
  TagSubforumComments = 'tagSubforumComments',
  TagSubforumPosts = 'tagSubforumPosts',
  TagSubforumStickyComments = 'tagSubforumStickyComments'
}

export type SubscriptionSelector = {
  default?: InputMaybe<EmptyViewInput>;
  membersOfGroup?: InputMaybe<SubscriptionsMembersOfGroupInput>;
  subscriptionState?: InputMaybe<SubscriptionsSubscriptionStateInput>;
  subscriptionsOfType?: InputMaybe<SubscriptionsSubscriptionsOfTypeInput>;
};

export type SubscriptionsMembersOfGroupInput = {
  documentId?: InputMaybe<Scalars['String']['input']>;
};

export type SubscriptionsSubscriptionStateInput = {
  collectionName?: InputMaybe<Scalars['String']['input']>;
  documentId?: InputMaybe<Scalars['String']['input']>;
  type?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type SubscriptionsSubscriptionsOfTypeInput = {
  collectionName?: InputMaybe<Scalars['String']['input']>;
  subscriptionType?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export enum SurveyQuestionFormat {
  MultilineText = 'multilineText',
  Rank0To10 = 'rank0To10',
  Text = 'text'
}

export type SurveyQuestionInfo = {
  _id?: InputMaybe<Scalars['String']['input']>;
  format: Scalars['String']['input'];
  question: Scalars['String']['input'];
};

export type SurveyQuestionSelector = {
  default?: InputMaybe<EmptyViewInput>;
};

export type SurveyResponseSelector = {
  default?: InputMaybe<EmptyViewInput>;
};

export type SurveyScheduleSelector = {
  default?: InputMaybe<EmptyViewInput>;
  surveySchedulesByCreatedAt?: InputMaybe<EmptyViewInput>;
};

export enum SurveyScheduleTarget {
  AllUsers = 'allUsers',
  LoggedInOnly = 'loggedInOnly',
  LoggedOutOnly = 'loggedOutOnly'
}

export type SurveySelector = {
  default?: InputMaybe<EmptyViewInput>;
  surveysByCreatedAt?: InputMaybe<EmptyViewInput>;
};

export enum TagCommentType {
  Discussion = 'DISCUSSION',
  Subforum = 'SUBFORUM'
}

export type TagDefaultViewInput = {
  excludedTagIds?: InputMaybe<Array<Scalars['String']['input']>>;
};

export type TagFlagSelector = {
  allTagFlags?: InputMaybe<EmptyViewInput>;
  default?: InputMaybe<EmptyViewInput>;
};

export enum TagHistoryFeedEntryType {
  LensOrSummaryMetadataChanged = 'lensOrSummaryMetadataChanged',
  LensRevision = 'lensRevision',
  SummaryRevision = 'summaryRevision',
  TagApplied = 'tagApplied',
  TagCreated = 'tagCreated',
  TagDiscussionComment = 'tagDiscussionComment',
  TagRevision = 'tagRevision',
  WikiMetadataChanged = 'wikiMetadataChanged'
}

export type TagRelSelector = {
  default?: InputMaybe<EmptyViewInput>;
  postsWithTag?: InputMaybe<TagRelsPostsWithTagInput>;
  tagsOnPost?: InputMaybe<TagRelsTagsOnPostInput>;
};

export enum TagRelVoteGroup {
  Admins = 'admins',
  AlignmentForum = 'alignmentForum',
  AlignmentForumAdmins = 'alignmentForumAdmins',
  AlignmentVoters = 'alignmentVoters',
  CanBypassPostRateLimit = 'canBypassPostRateLimit',
  CanModeratePersonal = 'canModeratePersonal',
  CanSuggestCuration = 'canSuggestCuration',
  Debaters = 'debaters',
  Guests = 'guests',
  Members = 'members',
  Podcasters = 'podcasters',
  RealAdmins = 'realAdmins',
  SunshineRegiment = 'sunshineRegiment',
  TrustLevel1 = 'trustLevel1',
  UserOwns = 'userOwns',
  UserOwnsOnlyUpvote = 'userOwnsOnlyUpvote'
}

export type TagRelsPostsWithTagInput = {
  tagId?: InputMaybe<Scalars['String']['input']>;
};

export type TagRelsTagsOnPostInput = {
  postId?: InputMaybe<Scalars['String']['input']>;
};

export type TagSelector = {
  allArbitalTags?: InputMaybe<TagsAllArbitalTagsInput>;
  allLWWikiTags?: InputMaybe<TagsAllLwWikiTagsInput>;
  allPagesByNewest?: InputMaybe<TagsAllPagesByNewestInput>;
  allPublicTags?: InputMaybe<TagsAllPublicTagsInput>;
  allTagsAlphabetical?: InputMaybe<TagsAllTagsAlphabeticalInput>;
  allTagsHierarchical?: InputMaybe<TagsAllTagsHierarchicalInput>;
  coreAndSubforumTags?: InputMaybe<TagsCoreAndSubforumTagsInput>;
  coreTags?: InputMaybe<TagsCoreTagsInput>;
  currentUserSubforums?: InputMaybe<TagsCurrentUserSubforumsInput>;
  default?: InputMaybe<TagDefaultViewInput>;
  newTags?: InputMaybe<TagsNewTagsInput>;
  pingbackWikiPages?: InputMaybe<TagsPingbackWikiPagesInput>;
  postTypeTags?: InputMaybe<TagsPostTypeTagsInput>;
  suggestedFilterTags?: InputMaybe<TagsSuggestedFilterTagsInput>;
  tagBySlug?: InputMaybe<TagsTagBySlugInput>;
  tagsBySlugs?: InputMaybe<TagsTagsBySlugsInput>;
  tagsByTagFlag?: InputMaybe<TagsTagsByTagFlagInput>;
  tagsByTagIds?: InputMaybe<TagsTagsByTagIdsInput>;
  unprocessedLWWikiTags?: InputMaybe<TagsUnprocessedLwWikiTagsInput>;
  unreviewedTags?: InputMaybe<TagsUnreviewedTagsInput>;
  userTags?: InputMaybe<TagsUserTagsInput>;
};

export type TagsAllArbitalTagsInput = {
  excludedTagIds?: InputMaybe<Array<Scalars['String']['input']>>;
};

export type TagsAllLwWikiTagsInput = {
  excludedTagIds?: InputMaybe<Array<Scalars['String']['input']>>;
};

export type TagsAllPagesByNewestInput = {
  excludedTagIds?: InputMaybe<Array<Scalars['String']['input']>>;
};

export type TagsAllPublicTagsInput = {
  excludedTagIds?: InputMaybe<Array<Scalars['String']['input']>>;
};

export type TagsAllTagsAlphabeticalInput = {
  excludedTagIds?: InputMaybe<Array<Scalars['String']['input']>>;
};

export type TagsAllTagsHierarchicalInput = {
  excludedTagIds?: InputMaybe<Array<Scalars['String']['input']>>;
  wikiGrade?: InputMaybe<Scalars['String']['input']>;
};

export type TagsCoreAndSubforumTagsInput = {
  excludedTagIds?: InputMaybe<Array<Scalars['String']['input']>>;
};

export type TagsCoreTagsInput = {
  excludedTagIds?: InputMaybe<Array<Scalars['String']['input']>>;
};

export type TagsCurrentUserSubforumsInput = {
  excludedTagIds?: InputMaybe<Array<Scalars['String']['input']>>;
};

export type TagsNewTagsInput = {
  excludedTagIds?: InputMaybe<Array<Scalars['String']['input']>>;
};

export type TagsPingbackWikiPagesInput = {
  excludedTagIds?: InputMaybe<Array<Scalars['String']['input']>>;
  tagId?: InputMaybe<Scalars['String']['input']>;
};

export type TagsPostTypeTagsInput = {
  excludedTagIds?: InputMaybe<Array<Scalars['String']['input']>>;
};

export type TagsSuggestedFilterTagsInput = {
  excludedTagIds?: InputMaybe<Array<Scalars['String']['input']>>;
};

export type TagsTagBySlugInput = {
  excludedTagIds?: InputMaybe<Array<Scalars['String']['input']>>;
  slug?: InputMaybe<Scalars['String']['input']>;
};

export type TagsTagsBySlugsInput = {
  excludedTagIds?: InputMaybe<Array<Scalars['String']['input']>>;
  slugs: Array<Scalars['String']['input']>;
};

export type TagsTagsByTagFlagInput = {
  excludedTagIds?: InputMaybe<Array<Scalars['String']['input']>>;
  tagFlagId?: InputMaybe<Scalars['String']['input']>;
};

export type TagsTagsByTagIdsInput = {
  excludedTagIds?: InputMaybe<Array<Scalars['String']['input']>>;
  tagIds: Array<Scalars['String']['input']>;
};

export type TagsUnprocessedLwWikiTagsInput = {
  excludedTagIds?: InputMaybe<Array<Scalars['String']['input']>>;
};

export type TagsUnreviewedTagsInput = {
  excludedTagIds?: InputMaybe<Array<Scalars['String']['input']>>;
};

export type TagsUserTagsInput = {
  excludedTagIds?: InputMaybe<Array<Scalars['String']['input']>>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type ToggleBookmarkInput = {
  collectionName: Scalars['String']['input'];
  documentId: Scalars['String']['input'];
};

export type TypingIndicatorSelector = {
  default?: InputMaybe<EmptyViewInput>;
};

export enum UltraFeedEntryType {
  FeedCommentThread = 'feedCommentThread',
  FeedMarker = 'feedMarker',
  FeedPost = 'feedPost',
  FeedSpotlight = 'feedSpotlight',
  FeedSubscriptionSuggestions = 'feedSubscriptionSuggestions'
}

export enum UltraFeedEventCollectionName {
  Comments = 'Comments',
  Posts = 'Posts',
  Spotlights = 'Spotlights'
}

export enum UltraFeedEventEventType {
  Expanded = 'expanded',
  Interacted = 'interacted',
  SeeLess = 'seeLess',
  Served = 'served',
  Viewed = 'viewed'
}

export type UltraFeedEventSelector = {
  default?: InputMaybe<EmptyViewInput>;
};

export type UpdateAdvisorRequestDataInput = {
  interestedInMetaculus?: InputMaybe<Scalars['Boolean']['input']>;
  jobAds?: InputMaybe<Scalars['JSON']['input']>;
  legacyData?: InputMaybe<Scalars['JSON']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateAdvisorRequestInput = {
  data: UpdateAdvisorRequestDataInput;
  selector: SelectorInput;
};

export type UpdateBookDataInput = {
  collectionId?: InputMaybe<Scalars['String']['input']>;
  contents?: InputMaybe<CreateRevisionDataInput>;
  displaySequencesAsGrid?: InputMaybe<Scalars['Boolean']['input']>;
  hideProgressBar?: InputMaybe<Scalars['Boolean']['input']>;
  legacyData?: InputMaybe<Scalars['JSON']['input']>;
  number?: InputMaybe<Scalars['Float']['input']>;
  postIds?: InputMaybe<Array<Scalars['String']['input']>>;
  sequenceIds?: InputMaybe<Array<Scalars['String']['input']>>;
  showChapters?: InputMaybe<Scalars['Boolean']['input']>;
  subtitle?: InputMaybe<Scalars['String']['input']>;
  title?: InputMaybe<Scalars['String']['input']>;
  tocTitle?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateBookInput = {
  data: UpdateBookDataInput;
  selector: SelectorInput;
};

export type UpdateChapterDataInput = {
  contents?: InputMaybe<CreateRevisionDataInput>;
  legacyData?: InputMaybe<Scalars['JSON']['input']>;
  number?: InputMaybe<Scalars['Float']['input']>;
  postIds?: InputMaybe<Array<Scalars['String']['input']>>;
  sequenceId?: InputMaybe<Scalars['String']['input']>;
  subtitle?: InputMaybe<Scalars['String']['input']>;
  title?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateChapterInput = {
  data: UpdateChapterDataInput;
  selector: SelectorInput;
};

export type UpdateCollectionDataInput = {
  contents?: InputMaybe<CreateRevisionDataInput>;
  createdAt?: InputMaybe<Scalars['Date']['input']>;
  firstPageLink?: InputMaybe<Scalars['String']['input']>;
  gridImageId?: InputMaybe<Scalars['String']['input']>;
  hideStartReadingButton?: InputMaybe<Scalars['Boolean']['input']>;
  legacyData?: InputMaybe<Scalars['JSON']['input']>;
  noindex?: InputMaybe<Scalars['Boolean']['input']>;
  slug?: InputMaybe<Scalars['String']['input']>;
  title?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateCollectionInput = {
  data: UpdateCollectionDataInput;
  selector: SelectorInput;
};

export type UpdateCommentDataInput = {
  af?: InputMaybe<Scalars['Boolean']['input']>;
  afDate?: InputMaybe<Scalars['Date']['input']>;
  agentFoundationsId?: InputMaybe<Scalars['String']['input']>;
  answer?: InputMaybe<Scalars['Boolean']['input']>;
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  contents?: InputMaybe<CreateRevisionDataInput>;
  debateResponse?: InputMaybe<Scalars['Boolean']['input']>;
  deleted?: InputMaybe<Scalars['Boolean']['input']>;
  deletedByUserId?: InputMaybe<Scalars['String']['input']>;
  deletedDate?: InputMaybe<Scalars['Date']['input']>;
  deletedPublic?: InputMaybe<Scalars['Boolean']['input']>;
  deletedReason?: InputMaybe<Scalars['String']['input']>;
  draft?: InputMaybe<Scalars['Boolean']['input']>;
  hideAuthor?: InputMaybe<Scalars['Boolean']['input']>;
  hideKarma?: InputMaybe<Scalars['Boolean']['input']>;
  hideModeratorHat?: InputMaybe<Scalars['Boolean']['input']>;
  isPinnedOnProfile?: InputMaybe<Scalars['Boolean']['input']>;
  legacy?: InputMaybe<Scalars['Boolean']['input']>;
  legacyData?: InputMaybe<Scalars['JSON']['input']>;
  legacyId?: InputMaybe<Scalars['String']['input']>;
  legacyParentId?: InputMaybe<Scalars['String']['input']>;
  legacyPoll?: InputMaybe<Scalars['Boolean']['input']>;
  modGPTAnalysis?: InputMaybe<Scalars['String']['input']>;
  modGPTRecommendation?: InputMaybe<Scalars['String']['input']>;
  moderatorHat?: InputMaybe<Scalars['Boolean']['input']>;
  moveToAlignmentUserId?: InputMaybe<Scalars['String']['input']>;
  needsReview?: InputMaybe<Scalars['Boolean']['input']>;
  nominatedForReview?: InputMaybe<Scalars['String']['input']>;
  originalDialogueId?: InputMaybe<Scalars['String']['input']>;
  postId?: InputMaybe<Scalars['String']['input']>;
  postedAt?: InputMaybe<Scalars['Date']['input']>;
  promoted?: InputMaybe<Scalars['Boolean']['input']>;
  promotedByUserId?: InputMaybe<Scalars['String']['input']>;
  rejected?: InputMaybe<Scalars['Boolean']['input']>;
  rejectedByUserId?: InputMaybe<Scalars['String']['input']>;
  rejectedReason?: InputMaybe<Scalars['String']['input']>;
  relevantTagIds?: InputMaybe<Array<Scalars['String']['input']>>;
  repliesBlockedUntil?: InputMaybe<Scalars['Date']['input']>;
  retracted?: InputMaybe<Scalars['Boolean']['input']>;
  reviewForAlignmentUserId?: InputMaybe<Scalars['String']['input']>;
  reviewedByUserId?: InputMaybe<Scalars['String']['input']>;
  reviewingForReview?: InputMaybe<Scalars['String']['input']>;
  shortform?: InputMaybe<Scalars['Boolean']['input']>;
  shortformFrontpage?: InputMaybe<Scalars['Boolean']['input']>;
  spam?: InputMaybe<Scalars['Boolean']['input']>;
  subforumStickyPriority?: InputMaybe<Scalars['Float']['input']>;
  suggestForAlignmentUserIds?: InputMaybe<Array<Scalars['String']['input']>>;
  tagId?: InputMaybe<Scalars['String']['input']>;
  title?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateCommentInput = {
  data: UpdateCommentDataInput;
  selector: SelectorInput;
};

export type UpdateCommentModeratorActionDataInput = {
  commentId?: InputMaybe<Scalars['String']['input']>;
  endedAt?: InputMaybe<Scalars['Date']['input']>;
  legacyData?: InputMaybe<Scalars['JSON']['input']>;
  type?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateCommentModeratorActionInput = {
  data: UpdateCommentModeratorActionDataInput;
  selector: SelectorInput;
};

export type UpdateConversationDataInput = {
  af?: InputMaybe<Scalars['Boolean']['input']>;
  archivedByIds?: InputMaybe<Array<Scalars['String']['input']>>;
  legacyData?: InputMaybe<Scalars['JSON']['input']>;
  moderator?: InputMaybe<Scalars['Boolean']['input']>;
  participantIds?: InputMaybe<Array<Scalars['String']['input']>>;
  title?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateConversationInput = {
  data: UpdateConversationDataInput;
  selector: SelectorInput;
};

export type UpdateCurationNoticeDataInput = {
  commentId?: InputMaybe<Scalars['String']['input']>;
  contents?: InputMaybe<CreateRevisionDataInput>;
  deleted?: InputMaybe<Scalars['Boolean']['input']>;
  legacyData?: InputMaybe<Scalars['JSON']['input']>;
};

export type UpdateCurationNoticeInput = {
  data: UpdateCurationNoticeDataInput;
  selector: SelectorInput;
};

export type UpdateDigestDataInput = {
  endDate?: InputMaybe<Scalars['Date']['input']>;
  legacyData?: InputMaybe<Scalars['JSON']['input']>;
  num?: InputMaybe<Scalars['Float']['input']>;
  onsiteImageId?: InputMaybe<Scalars['String']['input']>;
  onsitePrimaryColor?: InputMaybe<Scalars['String']['input']>;
  publishedDate?: InputMaybe<Scalars['Date']['input']>;
  startDate?: InputMaybe<Scalars['Date']['input']>;
};

export type UpdateDigestInput = {
  data: UpdateDigestDataInput;
  selector: SelectorInput;
};

export type UpdateDigestPostDataInput = {
  digestId?: InputMaybe<Scalars['String']['input']>;
  emailDigestStatus?: InputMaybe<Scalars['String']['input']>;
  legacyData?: InputMaybe<Scalars['JSON']['input']>;
  onsiteDigestStatus?: InputMaybe<Scalars['String']['input']>;
  postId?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateDigestPostInput = {
  data: UpdateDigestPostDataInput;
  selector: SelectorInput;
};

export type UpdateElectionCandidateDataInput = {
  amountRaised?: InputMaybe<Scalars['Float']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  electionName?: InputMaybe<Scalars['String']['input']>;
  fundraiserLink?: InputMaybe<Scalars['String']['input']>;
  gwwcId?: InputMaybe<Scalars['String']['input']>;
  gwwcLink?: InputMaybe<Scalars['String']['input']>;
  href?: InputMaybe<Scalars['String']['input']>;
  isElectionFundraiser?: InputMaybe<Scalars['Boolean']['input']>;
  legacyData?: InputMaybe<Scalars['JSON']['input']>;
  logoSrc?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  tagId?: InputMaybe<Scalars['String']['input']>;
  targetAmount?: InputMaybe<Scalars['Float']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateElectionCandidateInput = {
  data: UpdateElectionCandidateDataInput;
  selector: SelectorInput;
};

export type UpdateElectionVoteDataInput = {
  compareState?: InputMaybe<Scalars['JSON']['input']>;
  electionName?: InputMaybe<Scalars['String']['input']>;
  legacyData?: InputMaybe<Scalars['JSON']['input']>;
  submissionComments?: InputMaybe<Scalars['JSON']['input']>;
  submittedAt?: InputMaybe<Scalars['Date']['input']>;
  userExplanation?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
  userOtherComments?: InputMaybe<Scalars['String']['input']>;
  vote?: InputMaybe<Scalars['JSON']['input']>;
};

export type UpdateElectionVoteInput = {
  data: UpdateElectionVoteDataInput;
  selector: SelectorInput;
};

export type UpdateElicitQuestionDataInput = {
  legacyData?: InputMaybe<Scalars['JSON']['input']>;
  notes?: InputMaybe<Scalars['String']['input']>;
  resolution?: InputMaybe<Scalars['String']['input']>;
  resolvesBy?: InputMaybe<Scalars['Date']['input']>;
  title?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateElicitQuestionInput = {
  data: UpdateElicitQuestionDataInput;
  selector: SelectorInput;
};

export type UpdateForumEventDataInput = {
  bannerImageId?: InputMaybe<Scalars['String']['input']>;
  bannerTextColor?: InputMaybe<Scalars['String']['input']>;
  commentId?: InputMaybe<Scalars['String']['input']>;
  commentPrompt?: InputMaybe<Scalars['String']['input']>;
  contrastColor?: InputMaybe<Scalars['String']['input']>;
  customComponent?: InputMaybe<ForumEventCustomComponent>;
  darkColor?: InputMaybe<Scalars['String']['input']>;
  endDate?: InputMaybe<Scalars['Date']['input']>;
  eventFormat?: InputMaybe<ForumEventFormat>;
  frontpageDescription?: InputMaybe<CreateRevisionDataInput>;
  frontpageDescriptionMobile?: InputMaybe<CreateRevisionDataInput>;
  includesPoll?: InputMaybe<Scalars['Boolean']['input']>;
  isGlobal?: InputMaybe<Scalars['Boolean']['input']>;
  legacyData?: InputMaybe<Scalars['JSON']['input']>;
  lightColor?: InputMaybe<Scalars['String']['input']>;
  maxStickersPerUser?: InputMaybe<Scalars['Float']['input']>;
  pollAgreeWording?: InputMaybe<Scalars['String']['input']>;
  pollDisagreeWording?: InputMaybe<Scalars['String']['input']>;
  pollQuestion?: InputMaybe<CreateRevisionDataInput>;
  postId?: InputMaybe<Scalars['String']['input']>;
  postPageDescription?: InputMaybe<CreateRevisionDataInput>;
  publicData?: InputMaybe<Scalars['JSON']['input']>;
  startDate?: InputMaybe<Scalars['Date']['input']>;
  tagId?: InputMaybe<Scalars['String']['input']>;
  title?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateForumEventInput = {
  data: UpdateForumEventDataInput;
  selector: SelectorInput;
};

export type UpdateJargonTermDataInput = {
  altTerms?: InputMaybe<Array<Scalars['String']['input']>>;
  approved?: InputMaybe<Scalars['Boolean']['input']>;
  contents?: InputMaybe<CreateRevisionDataInput>;
  deleted?: InputMaybe<Scalars['Boolean']['input']>;
  legacyData?: InputMaybe<Scalars['JSON']['input']>;
  term?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateJargonTermInput = {
  data: UpdateJargonTermDataInput;
  selector: SelectorInput;
};

export type UpdateLlmConversationDataInput = {
  deleted?: InputMaybe<Scalars['Boolean']['input']>;
  legacyData?: InputMaybe<Scalars['JSON']['input']>;
  model?: InputMaybe<Scalars['String']['input']>;
  systemPrompt?: InputMaybe<Scalars['String']['input']>;
  title?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateLlmConversationInput = {
  data: UpdateLlmConversationDataInput;
  selector: SelectorInput;
};

export type UpdateLocalgroupDataInput = {
  bannerImageId?: InputMaybe<Scalars['String']['input']>;
  categories?: InputMaybe<Array<Scalars['String']['input']>>;
  contactInfo?: InputMaybe<Scalars['String']['input']>;
  contents?: InputMaybe<CreateRevisionDataInput>;
  deleted?: InputMaybe<Scalars['Boolean']['input']>;
  facebookLink?: InputMaybe<Scalars['String']['input']>;
  facebookPageLink?: InputMaybe<Scalars['String']['input']>;
  googleLocation?: InputMaybe<Scalars['JSON']['input']>;
  inactive?: InputMaybe<Scalars['Boolean']['input']>;
  isOnline?: InputMaybe<Scalars['Boolean']['input']>;
  lastActivity?: InputMaybe<Scalars['Date']['input']>;
  legacyData?: InputMaybe<Scalars['JSON']['input']>;
  location?: InputMaybe<Scalars['String']['input']>;
  meetupLink?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  nameInAnotherLanguage?: InputMaybe<Scalars['String']['input']>;
  organizerIds?: InputMaybe<Array<Scalars['String']['input']>>;
  slackLink?: InputMaybe<Scalars['String']['input']>;
  types?: InputMaybe<Array<Scalars['String']['input']>>;
  website?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateLocalgroupInput = {
  data: UpdateLocalgroupDataInput;
  selector: SelectorInput;
};

export type UpdateMessageDataInput = {
  contents?: InputMaybe<CreateRevisionDataInput>;
  legacyData?: InputMaybe<Scalars['JSON']['input']>;
};

export type UpdateMessageInput = {
  data: UpdateMessageDataInput;
  selector: SelectorInput;
};

export type UpdateModerationTemplateDataInput = {
  collectionName?: InputMaybe<ModerationTemplateType>;
  contents?: InputMaybe<CreateRevisionDataInput>;
  deleted?: InputMaybe<Scalars['Boolean']['input']>;
  groupLabel?: InputMaybe<Scalars['String']['input']>;
  legacyData?: InputMaybe<Scalars['JSON']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  order?: InputMaybe<Scalars['Float']['input']>;
};

export type UpdateModerationTemplateInput = {
  data: UpdateModerationTemplateDataInput;
  selector: SelectorInput;
};

export type UpdateModeratorActionDataInput = {
  endedAt?: InputMaybe<Scalars['Date']['input']>;
  legacyData?: InputMaybe<Scalars['JSON']['input']>;
  type?: InputMaybe<ModeratorActionType>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateModeratorActionInput = {
  data: UpdateModeratorActionDataInput;
  selector: SelectorInput;
};

export type UpdateMultiDocumentDataInput = {
  contents?: InputMaybe<CreateRevisionDataInput>;
  deleted?: InputMaybe<Scalars['Boolean']['input']>;
  index?: InputMaybe<Scalars['Float']['input']>;
  legacyData?: InputMaybe<Scalars['JSON']['input']>;
  slug?: InputMaybe<Scalars['String']['input']>;
  tabSubtitle?: InputMaybe<Scalars['String']['input']>;
  tabTitle?: InputMaybe<Scalars['String']['input']>;
  title?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateMultiDocumentInput = {
  data: UpdateMultiDocumentDataInput;
  selector: SelectorInput;
};

export type UpdateNotificationDataInput = {
  legacyData?: InputMaybe<Scalars['JSON']['input']>;
  viewed?: InputMaybe<Scalars['Boolean']['input']>;
};

export type UpdateNotificationInput = {
  data: UpdateNotificationDataInput;
  selector: SelectorInput;
};

export type UpdatePostDataInput = {
  activateRSVPs?: InputMaybe<Scalars['Boolean']['input']>;
  af?: InputMaybe<Scalars['Boolean']['input']>;
  afDate?: InputMaybe<Scalars['Date']['input']>;
  afSticky?: InputMaybe<Scalars['Boolean']['input']>;
  agentFoundationsId?: InputMaybe<Scalars['String']['input']>;
  authorIsUnreviewed?: InputMaybe<Scalars['Boolean']['input']>;
  autoFrontpage?: InputMaybe<Scalars['String']['input']>;
  bannedUserIds?: InputMaybe<Array<Scalars['String']['input']>>;
  canonicalBookId?: InputMaybe<Scalars['String']['input']>;
  canonicalCollectionSlug?: InputMaybe<Scalars['String']['input']>;
  canonicalNextPostSlug?: InputMaybe<Scalars['String']['input']>;
  canonicalPrevPostSlug?: InputMaybe<Scalars['String']['input']>;
  canonicalSequenceId?: InputMaybe<Scalars['String']['input']>;
  canonicalSource?: InputMaybe<Scalars['String']['input']>;
  coauthorStatuses?: InputMaybe<Array<CoauthorStatusInput>>;
  coauthorUserIds?: InputMaybe<Array<Scalars['String']['input']>>;
  collabEditorDialogue?: InputMaybe<Scalars['Boolean']['input']>;
  collectionTitle?: InputMaybe<Scalars['String']['input']>;
  commentSortOrder?: InputMaybe<Scalars['String']['input']>;
  commentsLocked?: InputMaybe<Scalars['Boolean']['input']>;
  commentsLockedToAccountsCreatedAfter?: InputMaybe<Scalars['Date']['input']>;
  contactInfo?: InputMaybe<Scalars['String']['input']>;
  contents?: InputMaybe<CreateRevisionDataInput>;
  curatedDate?: InputMaybe<Scalars['Date']['input']>;
  customHighlight?: InputMaybe<CreateRevisionDataInput>;
  defaultRecommendation?: InputMaybe<Scalars['Boolean']['input']>;
  deletedDraft?: InputMaybe<Scalars['Boolean']['input']>;
  disableRecommendation?: InputMaybe<Scalars['Boolean']['input']>;
  disableSidenotes?: InputMaybe<Scalars['Boolean']['input']>;
  draft?: InputMaybe<Scalars['Boolean']['input']>;
  endTime?: InputMaybe<Scalars['Date']['input']>;
  eventImageId?: InputMaybe<Scalars['String']['input']>;
  eventRegistrationLink?: InputMaybe<Scalars['String']['input']>;
  eventType?: InputMaybe<Scalars['String']['input']>;
  facebookLink?: InputMaybe<Scalars['String']['input']>;
  feedId?: InputMaybe<Scalars['String']['input']>;
  feedLink?: InputMaybe<Scalars['String']['input']>;
  fmCrosspost?: InputMaybe<CrosspostInput>;
  forceAllowType3Audio?: InputMaybe<Scalars['Boolean']['input']>;
  frontpageDate?: InputMaybe<Scalars['Date']['input']>;
  generateDraftJargon?: InputMaybe<Scalars['Boolean']['input']>;
  globalEvent?: InputMaybe<Scalars['Boolean']['input']>;
  googleLocation?: InputMaybe<Scalars['JSON']['input']>;
  groupId?: InputMaybe<Scalars['String']['input']>;
  hasCoauthorPermission?: InputMaybe<Scalars['Boolean']['input']>;
  hiddenRelatedQuestion?: InputMaybe<Scalars['Boolean']['input']>;
  hideAuthor?: InputMaybe<Scalars['Boolean']['input']>;
  hideCommentKarma?: InputMaybe<Scalars['Boolean']['input']>;
  hideFromPopularComments?: InputMaybe<Scalars['Boolean']['input']>;
  hideFromRecentDiscussions?: InputMaybe<Scalars['Boolean']['input']>;
  hideFrontpageComments?: InputMaybe<Scalars['Boolean']['input']>;
  ignoreRateLimits?: InputMaybe<Scalars['Boolean']['input']>;
  isEvent?: InputMaybe<Scalars['Boolean']['input']>;
  joinEventLink?: InputMaybe<Scalars['String']['input']>;
  legacy?: InputMaybe<Scalars['Boolean']['input']>;
  legacyData?: InputMaybe<Scalars['JSON']['input']>;
  legacyId?: InputMaybe<Scalars['String']['input']>;
  legacySpam?: InputMaybe<Scalars['Boolean']['input']>;
  linkSharingKey?: InputMaybe<Scalars['String']['input']>;
  location?: InputMaybe<Scalars['String']['input']>;
  manifoldReviewMarketId?: InputMaybe<Scalars['String']['input']>;
  meetupLink?: InputMaybe<Scalars['String']['input']>;
  meta?: InputMaybe<Scalars['Boolean']['input']>;
  metaDate?: InputMaybe<Scalars['Date']['input']>;
  metaSticky?: InputMaybe<Scalars['Boolean']['input']>;
  moderationGuidelines?: InputMaybe<CreateRevisionDataInput>;
  moderationStyle?: InputMaybe<Scalars['String']['input']>;
  nextDayReminderSent?: InputMaybe<Scalars['Boolean']['input']>;
  noIndex?: InputMaybe<Scalars['Boolean']['input']>;
  onlineEvent?: InputMaybe<Scalars['Boolean']['input']>;
  onlyVisibleToEstablishedAccounts?: InputMaybe<Scalars['Boolean']['input']>;
  onlyVisibleToLoggedIn?: InputMaybe<Scalars['Boolean']['input']>;
  organizerIds?: InputMaybe<Array<Scalars['String']['input']>>;
  podcastEpisodeId?: InputMaybe<Scalars['String']['input']>;
  postCategory?: InputMaybe<PostCategory>;
  postedAt?: InputMaybe<Scalars['Date']['input']>;
  question?: InputMaybe<Scalars['Boolean']['input']>;
  readTimeMinutesOverride?: InputMaybe<Scalars['Float']['input']>;
  rejected?: InputMaybe<Scalars['Boolean']['input']>;
  rejectedByUserId?: InputMaybe<Scalars['String']['input']>;
  rejectedReason?: InputMaybe<Scalars['String']['input']>;
  reviewForAlignmentUserId?: InputMaybe<Scalars['String']['input']>;
  reviewForCuratedUserId?: InputMaybe<Scalars['String']['input']>;
  reviewedByUserId?: InputMaybe<Scalars['String']['input']>;
  shareWithUsers?: InputMaybe<Array<Scalars['String']['input']>>;
  sharingSettings?: InputMaybe<Scalars['JSON']['input']>;
  shortform?: InputMaybe<Scalars['Boolean']['input']>;
  sideCommentVisibility?: InputMaybe<Scalars['String']['input']>;
  slug?: InputMaybe<Scalars['String']['input']>;
  socialPreview?: InputMaybe<SocialPreviewInput>;
  socialPreviewImageAutoUrl?: InputMaybe<Scalars['String']['input']>;
  socialPreviewImageId?: InputMaybe<Scalars['String']['input']>;
  startTime?: InputMaybe<Scalars['Date']['input']>;
  status?: InputMaybe<Scalars['Float']['input']>;
  sticky?: InputMaybe<Scalars['Boolean']['input']>;
  stickyPriority?: InputMaybe<Scalars['Int']['input']>;
  subforumTagId?: InputMaybe<Scalars['String']['input']>;
  submitToFrontpage?: InputMaybe<Scalars['Boolean']['input']>;
  suggestForAlignmentUserIds?: InputMaybe<Array<Scalars['String']['input']>>;
  suggestForCuratedUserIds?: InputMaybe<Array<Scalars['String']['input']>>;
  swrCachingEnabled?: InputMaybe<Scalars['Boolean']['input']>;
  tagRelevance?: InputMaybe<Scalars['JSON']['input']>;
  title?: InputMaybe<Scalars['String']['input']>;
  types?: InputMaybe<Array<Scalars['String']['input']>>;
  unlisted?: InputMaybe<Scalars['Boolean']['input']>;
  url?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
  votingSystem?: InputMaybe<Scalars['String']['input']>;
  wasEverUndrafted?: InputMaybe<Scalars['Boolean']['input']>;
  website?: InputMaybe<Scalars['String']['input']>;
};

export type UpdatePostInput = {
  data: UpdatePostDataInput;
  selector: SelectorInput;
};

export type UpdateRssFeedDataInput = {
  displayFullContent?: InputMaybe<Scalars['Boolean']['input']>;
  importAsDraft?: InputMaybe<Scalars['Boolean']['input']>;
  legacyData?: InputMaybe<Scalars['JSON']['input']>;
  nickname?: InputMaybe<Scalars['String']['input']>;
  ownedByUser?: InputMaybe<Scalars['Boolean']['input']>;
  rawFeed?: InputMaybe<Scalars['JSON']['input']>;
  setCanonicalUrl?: InputMaybe<Scalars['Boolean']['input']>;
  status?: InputMaybe<Scalars['String']['input']>;
  url?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateRssFeedInput = {
  data: UpdateRssFeedDataInput;
  selector: SelectorInput;
};

export type UpdateReportDataInput = {
  claimedUserId?: InputMaybe<Scalars['String']['input']>;
  closedAt?: InputMaybe<Scalars['Date']['input']>;
  createdAt?: InputMaybe<Scalars['Date']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  legacyData?: InputMaybe<Scalars['JSON']['input']>;
  markedAsSpam?: InputMaybe<Scalars['Boolean']['input']>;
  reportedAsSpam?: InputMaybe<Scalars['Boolean']['input']>;
};

export type UpdateReportInput = {
  data: UpdateReportDataInput;
  selector: SelectorInput;
};

export type UpdateRevisionDataInput = {
  legacyData?: InputMaybe<Scalars['JSON']['input']>;
  skipAttributions?: InputMaybe<Scalars['Boolean']['input']>;
};

export type UpdateRevisionInput = {
  data: UpdateRevisionDataInput;
  selector: SelectorInput;
};

export type UpdateSequenceDataInput = {
  af?: InputMaybe<Scalars['Boolean']['input']>;
  bannerImageId?: InputMaybe<Scalars['String']['input']>;
  canonicalCollectionSlug?: InputMaybe<Scalars['String']['input']>;
  contents?: InputMaybe<CreateRevisionDataInput>;
  curatedOrder?: InputMaybe<Scalars['Float']['input']>;
  draft?: InputMaybe<Scalars['Boolean']['input']>;
  gridImageId?: InputMaybe<Scalars['String']['input']>;
  hidden?: InputMaybe<Scalars['Boolean']['input']>;
  hideFromAuthorPage?: InputMaybe<Scalars['Boolean']['input']>;
  isDeleted?: InputMaybe<Scalars['Boolean']['input']>;
  lastUpdated?: InputMaybe<Scalars['Date']['input']>;
  legacyData?: InputMaybe<Scalars['JSON']['input']>;
  noindex?: InputMaybe<Scalars['Boolean']['input']>;
  title?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
  userProfileOrder?: InputMaybe<Scalars['Float']['input']>;
};

export type UpdateSequenceInput = {
  data: UpdateSequenceDataInput;
  selector: SelectorInput;
};

export type UpdateSpotlightDataInput = {
  customSubtitle?: InputMaybe<Scalars['String']['input']>;
  customTitle?: InputMaybe<Scalars['String']['input']>;
  deletedDraft?: InputMaybe<Scalars['Boolean']['input']>;
  description?: InputMaybe<CreateRevisionDataInput>;
  documentId?: InputMaybe<Scalars['String']['input']>;
  documentType?: InputMaybe<SpotlightDocumentType>;
  draft?: InputMaybe<Scalars['Boolean']['input']>;
  duration?: InputMaybe<Scalars['Float']['input']>;
  headerTitle?: InputMaybe<Scalars['String']['input']>;
  headerTitleLeftColor?: InputMaybe<Scalars['String']['input']>;
  headerTitleRightColor?: InputMaybe<Scalars['String']['input']>;
  imageFade?: InputMaybe<Scalars['Boolean']['input']>;
  imageFadeColor?: InputMaybe<Scalars['String']['input']>;
  lastPromotedAt?: InputMaybe<Scalars['Date']['input']>;
  legacyData?: InputMaybe<Scalars['JSON']['input']>;
  position?: InputMaybe<Scalars['Float']['input']>;
  showAuthor?: InputMaybe<Scalars['Boolean']['input']>;
  spotlightDarkImageId?: InputMaybe<Scalars['String']['input']>;
  spotlightImageId?: InputMaybe<Scalars['String']['input']>;
  spotlightSplashImageUrl?: InputMaybe<Scalars['String']['input']>;
  subtitleUrl?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateSpotlightInput = {
  data: UpdateSpotlightDataInput;
  selector: SelectorInput;
};

export type UpdateSurveyDataInput = {
  legacyData?: InputMaybe<Scalars['JSON']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateSurveyInput = {
  data: UpdateSurveyDataInput;
  selector: SelectorInput;
};

export type UpdateSurveyQuestionDataInput = {
  format?: InputMaybe<SurveyQuestionFormat>;
  legacyData?: InputMaybe<Scalars['JSON']['input']>;
  order?: InputMaybe<Scalars['Float']['input']>;
  question?: InputMaybe<Scalars['String']['input']>;
  surveyId?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateSurveyQuestionInput = {
  data: UpdateSurveyQuestionDataInput;
  selector: SelectorInput;
};

export type UpdateSurveyResponseDataInput = {
  clientId?: InputMaybe<Scalars['String']['input']>;
  legacyData?: InputMaybe<Scalars['JSON']['input']>;
  response?: InputMaybe<Scalars['JSON']['input']>;
  surveyId?: InputMaybe<Scalars['String']['input']>;
  surveyScheduleId?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateSurveyResponseInput = {
  data: UpdateSurveyResponseDataInput;
  selector: SelectorInput;
};

export type UpdateSurveyScheduleDataInput = {
  clientIds?: InputMaybe<Array<Scalars['String']['input']>>;
  deactivated?: InputMaybe<Scalars['Boolean']['input']>;
  endDate?: InputMaybe<Scalars['Date']['input']>;
  impressionsLimit?: InputMaybe<Scalars['Float']['input']>;
  legacyData?: InputMaybe<Scalars['JSON']['input']>;
  maxKarma?: InputMaybe<Scalars['Float']['input']>;
  maxVisitorPercentage?: InputMaybe<Scalars['Float']['input']>;
  minKarma?: InputMaybe<Scalars['Float']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  startDate?: InputMaybe<Scalars['Date']['input']>;
  surveyId?: InputMaybe<Scalars['String']['input']>;
  target?: InputMaybe<SurveyScheduleTarget>;
};

export type UpdateSurveyScheduleInput = {
  data: UpdateSurveyScheduleDataInput;
  selector: SelectorInput;
};

export type UpdateTagDataInput = {
  adminOnly?: InputMaybe<Scalars['Boolean']['input']>;
  autoTagModel?: InputMaybe<Scalars['String']['input']>;
  autoTagPrompt?: InputMaybe<Scalars['String']['input']>;
  bannerImageId?: InputMaybe<Scalars['String']['input']>;
  canEditUserIds?: InputMaybe<Array<Scalars['String']['input']>>;
  canVoteOnRels?: InputMaybe<Array<TagRelVoteGroup>>;
  core?: InputMaybe<Scalars['Boolean']['input']>;
  coreTagId?: InputMaybe<Scalars['String']['input']>;
  defaultOrder?: InputMaybe<Scalars['Float']['input']>;
  deleted?: InputMaybe<Scalars['Boolean']['input']>;
  description?: InputMaybe<CreateRevisionDataInput>;
  descriptionTruncationCount?: InputMaybe<Scalars['Float']['input']>;
  forceAllowType3Audio?: InputMaybe<Scalars['Boolean']['input']>;
  introSequenceId?: InputMaybe<Scalars['String']['input']>;
  isPlaceholderPage?: InputMaybe<Scalars['Boolean']['input']>;
  isPostType?: InputMaybe<Scalars['Boolean']['input']>;
  isSubforum?: InputMaybe<Scalars['Boolean']['input']>;
  legacyData?: InputMaybe<Scalars['JSON']['input']>;
  moderationGuidelines?: InputMaybe<CreateRevisionDataInput>;
  name?: InputMaybe<Scalars['String']['input']>;
  needsReview?: InputMaybe<Scalars['Boolean']['input']>;
  noindex?: InputMaybe<Scalars['Boolean']['input']>;
  parentTagId?: InputMaybe<Scalars['String']['input']>;
  postsDefaultSortOrder?: InputMaybe<Scalars['String']['input']>;
  reviewedByUserId?: InputMaybe<Scalars['String']['input']>;
  shortName?: InputMaybe<Scalars['String']['input']>;
  slug?: InputMaybe<Scalars['String']['input']>;
  squareImageId?: InputMaybe<Scalars['String']['input']>;
  subTagIds?: InputMaybe<Array<Scalars['String']['input']>>;
  subforumIntroPostId?: InputMaybe<Scalars['String']['input']>;
  subforumModeratorIds?: InputMaybe<Array<Scalars['String']['input']>>;
  subforumWelcomeText?: InputMaybe<CreateRevisionDataInput>;
  subtitle?: InputMaybe<Scalars['String']['input']>;
  suggestedAsFilter?: InputMaybe<Scalars['Boolean']['input']>;
  tagFlagsIds?: InputMaybe<Array<Scalars['String']['input']>>;
  wikiGrade?: InputMaybe<Scalars['Int']['input']>;
  wikiOnly?: InputMaybe<Scalars['Boolean']['input']>;
};

export type UpdateTagFlagDataInput = {
  contents?: InputMaybe<CreateRevisionDataInput>;
  deleted?: InputMaybe<Scalars['Boolean']['input']>;
  legacyData?: InputMaybe<Scalars['JSON']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  order?: InputMaybe<Scalars['Float']['input']>;
  slug?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateTagFlagInput = {
  data: UpdateTagFlagDataInput;
  selector: SelectorInput;
};

export type UpdateTagInput = {
  data: UpdateTagDataInput;
  selector: SelectorInput;
};

export type UpdateUltraFeedEventDataInput = {
  event?: InputMaybe<Scalars['JSON']['input']>;
};

export type UpdateUserDataInput = {
  abTestKey?: InputMaybe<Scalars['String']['input']>;
  abTestOverrides?: InputMaybe<Scalars['JSON']['input']>;
  acceptedTos?: InputMaybe<Scalars['Boolean']['input']>;
  acknowledgedNewUserGuidelines?: InputMaybe<Scalars['Boolean']['input']>;
  afApplicationText?: InputMaybe<Scalars['String']['input']>;
  afSubmittedApplication?: InputMaybe<Scalars['Boolean']['input']>;
  allCommentingDisabled?: InputMaybe<Scalars['Boolean']['input']>;
  allPostsFilter?: InputMaybe<Scalars['String']['input']>;
  allPostsHideCommunity?: InputMaybe<Scalars['Boolean']['input']>;
  allPostsIncludeEvents?: InputMaybe<Scalars['Boolean']['input']>;
  allPostsOpenSettings?: InputMaybe<Scalars['Boolean']['input']>;
  allPostsShowLowKarma?: InputMaybe<Scalars['Boolean']['input']>;
  allPostsSorting?: InputMaybe<Scalars['String']['input']>;
  allPostsTimeframe?: InputMaybe<Scalars['String']['input']>;
  allowDatadogSessionReplay?: InputMaybe<Scalars['Boolean']['input']>;
  autoSubscribeAsOrganizer?: InputMaybe<Scalars['Boolean']['input']>;
  auto_subscribe_to_my_comments?: InputMaybe<Scalars['Boolean']['input']>;
  auto_subscribe_to_my_posts?: InputMaybe<Scalars['Boolean']['input']>;
  banned?: InputMaybe<Scalars['Date']['input']>;
  bannedPersonalUserIds?: InputMaybe<Array<Scalars['String']['input']>>;
  bannedUserIds?: InputMaybe<Array<Scalars['String']['input']>>;
  beta?: InputMaybe<Scalars['Boolean']['input']>;
  biography?: InputMaybe<CreateRevisionDataInput>;
  blueskyProfileURL?: InputMaybe<Scalars['String']['input']>;
  careerStage?: InputMaybe<Array<Scalars['String']['input']>>;
  collapseModerationGuidelines?: InputMaybe<Scalars['Boolean']['input']>;
  commentSorting?: InputMaybe<Scalars['String']['input']>;
  commentingOnOtherUsersDisabled?: InputMaybe<Scalars['Boolean']['input']>;
  conversationsDisabled?: InputMaybe<Scalars['Boolean']['input']>;
  criticismTipsDismissed?: InputMaybe<Scalars['Boolean']['input']>;
  currentFrontpageFilter?: InputMaybe<Scalars['String']['input']>;
  defaultToCKEditor?: InputMaybe<Scalars['Boolean']['input']>;
  deleteContent?: InputMaybe<Scalars['Boolean']['input']>;
  deleted?: InputMaybe<Scalars['Boolean']['input']>;
  displayName?: InputMaybe<Scalars['String']['input']>;
  draftsListShowArchived?: InputMaybe<Scalars['Boolean']['input']>;
  draftsListShowShared?: InputMaybe<Scalars['Boolean']['input']>;
  draftsListSorting?: InputMaybe<Scalars['String']['input']>;
  email?: InputMaybe<Scalars['String']['input']>;
  emailSubscribedToCurated?: InputMaybe<Scalars['Boolean']['input']>;
  expandedFrontpageSections?: InputMaybe<ExpandedFrontpageSectionsSettingsInput>;
  facebookProfileURL?: InputMaybe<Scalars['String']['input']>;
  fmCrosspostUserId?: InputMaybe<Scalars['String']['input']>;
  frontpageFilterSettings?: InputMaybe<Scalars['JSON']['input']>;
  frontpageSelectedTab?: InputMaybe<Scalars['String']['input']>;
  fullName?: InputMaybe<Scalars['String']['input']>;
  generateJargonForDrafts?: InputMaybe<Scalars['Boolean']['input']>;
  generateJargonForPublishedPosts?: InputMaybe<Scalars['Boolean']['input']>;
  githubProfileURL?: InputMaybe<Scalars['String']['input']>;
  googleLocation?: InputMaybe<Scalars['JSON']['input']>;
  groups?: InputMaybe<Array<Scalars['String']['input']>>;
  hiddenPostsMetadata?: InputMaybe<Array<PostMetadataInput>>;
  hideAFNonMemberInitialWarning?: InputMaybe<Scalars['Boolean']['input']>;
  hideActiveDialogueUsers?: InputMaybe<Scalars['Boolean']['input']>;
  hideCommunitySection?: InputMaybe<Scalars['Boolean']['input']>;
  hideDialogueFacilitation?: InputMaybe<Scalars['Boolean']['input']>;
  hideElicitPredictions?: InputMaybe<Scalars['Boolean']['input']>;
  hideFromPeopleDirectory?: InputMaybe<Scalars['Boolean']['input']>;
  hideFrontpageBook2019Ad?: InputMaybe<Scalars['Boolean']['input']>;
  hideFrontpageBook2020Ad?: InputMaybe<Scalars['Boolean']['input']>;
  hideFrontpageBookAd?: InputMaybe<Scalars['Boolean']['input']>;
  hideFrontpageFilterSettingsDesktop?: InputMaybe<Scalars['Boolean']['input']>;
  hideFrontpageMap?: InputMaybe<Scalars['Boolean']['input']>;
  hideHomeRHS?: InputMaybe<Scalars['Boolean']['input']>;
  hideIntercom?: InputMaybe<Scalars['Boolean']['input']>;
  hideJobAdUntil?: InputMaybe<Scalars['Date']['input']>;
  hideMeetupsPoke?: InputMaybe<Scalars['Boolean']['input']>;
  hideNavigationSidebar?: InputMaybe<Scalars['Boolean']['input']>;
  hidePostsRecommendations?: InputMaybe<Scalars['Boolean']['input']>;
  hideSubscribePoke?: InputMaybe<Scalars['Boolean']['input']>;
  hideSunshineSidebar?: InputMaybe<Scalars['Boolean']['input']>;
  hideTaggingProgressBar?: InputMaybe<Scalars['Boolean']['input']>;
  howICanHelpOthers?: InputMaybe<CreateRevisionDataInput>;
  howOthersCanHelpMe?: InputMaybe<CreateRevisionDataInput>;
  inactiveSurveyEmailSentAt?: InputMaybe<Scalars['Date']['input']>;
  isAdmin?: InputMaybe<Scalars['Boolean']['input']>;
  jobTitle?: InputMaybe<Scalars['String']['input']>;
  karmaChangeBatchStart?: InputMaybe<Scalars['Date']['input']>;
  karmaChangeLastOpened?: InputMaybe<Scalars['Date']['input']>;
  karmaChangeNotifierSettings?: InputMaybe<Scalars['JSON']['input']>;
  lastNotificationsCheck?: InputMaybe<Scalars['Date']['input']>;
  lastUsedTimezone?: InputMaybe<Scalars['String']['input']>;
  legacy?: InputMaybe<Scalars['Boolean']['input']>;
  legacyData?: InputMaybe<Scalars['JSON']['input']>;
  legacyId?: InputMaybe<Scalars['String']['input']>;
  linkedinProfileURL?: InputMaybe<Scalars['String']['input']>;
  location?: InputMaybe<Scalars['String']['input']>;
  mapLocation?: InputMaybe<Scalars['JSON']['input']>;
  mapMarkerText?: InputMaybe<Scalars['String']['input']>;
  markDownPostEditor?: InputMaybe<Scalars['Boolean']['input']>;
  moderationGuidelines?: InputMaybe<CreateRevisionDataInput>;
  moderationStyle?: InputMaybe<Scalars['String']['input']>;
  moderatorAssistance?: InputMaybe<Scalars['Boolean']['input']>;
  nearbyEventsNotifications?: InputMaybe<Scalars['Boolean']['input']>;
  nearbyEventsNotificationsLocation?: InputMaybe<Scalars['JSON']['input']>;
  nearbyEventsNotificationsRadius?: InputMaybe<Scalars['Float']['input']>;
  nearbyPeopleNotificationThreshold?: InputMaybe<Scalars['Float']['input']>;
  needsReview?: InputMaybe<Scalars['Boolean']['input']>;
  noCollapseCommentsFrontpage?: InputMaybe<Scalars['Boolean']['input']>;
  noCollapseCommentsPosts?: InputMaybe<Scalars['Boolean']['input']>;
  noExpandUnreadCommentsReview?: InputMaybe<Scalars['Boolean']['input']>;
  noKibitz?: InputMaybe<Scalars['Boolean']['input']>;
  noSingleLineComments?: InputMaybe<Scalars['Boolean']['input']>;
  noindex?: InputMaybe<Scalars['Boolean']['input']>;
  notificationAddedAsCoauthor?: InputMaybe<Scalars['JSON']['input']>;
  notificationAlignmentSubmissionApproved?: InputMaybe<Scalars['JSON']['input']>;
  notificationCommentsOnDraft?: InputMaybe<Scalars['JSON']['input']>;
  notificationCommentsOnSubscribedPost?: InputMaybe<Scalars['JSON']['input']>;
  notificationDebateCommentsOnSubscribedPost?: InputMaybe<Scalars['JSON']['input']>;
  notificationDebateReplies?: InputMaybe<Scalars['JSON']['input']>;
  notificationDialogueMatch?: InputMaybe<Scalars['JSON']['input']>;
  notificationDialogueMessages?: InputMaybe<Scalars['JSON']['input']>;
  notificationEventInRadius?: InputMaybe<Scalars['JSON']['input']>;
  notificationGroupAdministration?: InputMaybe<Scalars['JSON']['input']>;
  notificationKarmaPowersGained?: InputMaybe<Scalars['JSON']['input']>;
  notificationNewDialogueChecks?: InputMaybe<Scalars['JSON']['input']>;
  notificationNewMention?: InputMaybe<Scalars['JSON']['input']>;
  notificationPostsInGroups?: InputMaybe<Scalars['JSON']['input']>;
  notificationPostsNominatedReview?: InputMaybe<Scalars['JSON']['input']>;
  notificationPrivateMessage?: InputMaybe<Scalars['JSON']['input']>;
  notificationPublishedDialogueMessages?: InputMaybe<Scalars['JSON']['input']>;
  notificationRSVPs?: InputMaybe<Scalars['JSON']['input']>;
  notificationRepliesToMyComments?: InputMaybe<Scalars['JSON']['input']>;
  notificationRepliesToSubscribedComments?: InputMaybe<Scalars['JSON']['input']>;
  notificationSharedWithMe?: InputMaybe<Scalars['JSON']['input']>;
  notificationShortformContent?: InputMaybe<Scalars['JSON']['input']>;
  notificationSubforumUnread?: InputMaybe<Scalars['JSON']['input']>;
  notificationSubscribedSequencePost?: InputMaybe<Scalars['JSON']['input']>;
  notificationSubscribedTagPost?: InputMaybe<Scalars['JSON']['input']>;
  notificationSubscribedUserComment?: InputMaybe<Scalars['JSON']['input']>;
  notificationSubscribedUserPost?: InputMaybe<Scalars['JSON']['input']>;
  notificationYourTurnMatchForm?: InputMaybe<Scalars['JSON']['input']>;
  nullifyVotes?: InputMaybe<Scalars['Boolean']['input']>;
  optedInToDialogueFacilitation?: InputMaybe<Scalars['Boolean']['input']>;
  optedOutOfSurveys?: InputMaybe<Scalars['Boolean']['input']>;
  organization?: InputMaybe<Scalars['String']['input']>;
  organizerOfGroupIds?: InputMaybe<Array<Scalars['String']['input']>>;
  partiallyReadSequences?: InputMaybe<Array<PartiallyReadSequenceItemInput>>;
  paymentEmail?: InputMaybe<Scalars['String']['input']>;
  paymentInfo?: InputMaybe<Scalars['String']['input']>;
  permanentDeletionRequestedAt?: InputMaybe<Scalars['Date']['input']>;
  petrovLaunchCodeDate?: InputMaybe<Scalars['Date']['input']>;
  petrovOptOut?: InputMaybe<Scalars['Boolean']['input']>;
  petrovPressedButtonDate?: InputMaybe<Scalars['Date']['input']>;
  postGlossariesPinned?: InputMaybe<Scalars['Boolean']['input']>;
  postingDisabled?: InputMaybe<Scalars['Boolean']['input']>;
  previousDisplayName?: InputMaybe<Scalars['String']['input']>;
  profileImageId?: InputMaybe<Scalars['String']['input']>;
  profileTagIds?: InputMaybe<Array<Scalars['String']['input']>>;
  profileUpdatedAt?: InputMaybe<Scalars['Date']['input']>;
  programParticipation?: InputMaybe<Array<Scalars['String']['input']>>;
  reactPaletteStyle?: InputMaybe<ReactPaletteStyle>;
  recommendationSettings?: InputMaybe<RecommendationSettingsInput>;
  revealChecksToAdmins?: InputMaybe<Scalars['Boolean']['input']>;
  reviewForAlignmentForumUserId?: InputMaybe<Scalars['String']['input']>;
  reviewVotesQuadratic?: InputMaybe<Scalars['Boolean']['input']>;
  reviewVotesQuadratic2019?: InputMaybe<Scalars['Boolean']['input']>;
  reviewVotesQuadratic2020?: InputMaybe<Scalars['Boolean']['input']>;
  reviewedAt?: InputMaybe<Scalars['Date']['input']>;
  reviewedByUserId?: InputMaybe<Scalars['String']['input']>;
  shortformFeedId?: InputMaybe<Scalars['String']['input']>;
  showCommunityInRecentDiscussion?: InputMaybe<Scalars['Boolean']['input']>;
  showDialoguesList?: InputMaybe<Scalars['Boolean']['input']>;
  showHideKarmaOption?: InputMaybe<Scalars['Boolean']['input']>;
  showMatches?: InputMaybe<Scalars['Boolean']['input']>;
  showMyDialogues?: InputMaybe<Scalars['Boolean']['input']>;
  showPostAuthorCard?: InputMaybe<Scalars['Boolean']['input']>;
  showRecommendedPartners?: InputMaybe<Scalars['Boolean']['input']>;
  signUpReCaptchaRating?: InputMaybe<Scalars['Float']['input']>;
  slug?: InputMaybe<Scalars['String']['input']>;
  snoozedUntilContentCount?: InputMaybe<Scalars['Float']['input']>;
  sortDraftsBy?: InputMaybe<Scalars['String']['input']>;
  subforumPreferredLayout?: InputMaybe<SubforumPreferredLayout>;
  subscribedToDigest?: InputMaybe<Scalars['Boolean']['input']>;
  subscribedToNewsletter?: InputMaybe<Scalars['Boolean']['input']>;
  sunshineFlagged?: InputMaybe<Scalars['Boolean']['input']>;
  sunshineNotes?: InputMaybe<Scalars['String']['input']>;
  sunshineSnoozed?: InputMaybe<Scalars['Boolean']['input']>;
  taggingDashboardCollapsed?: InputMaybe<Scalars['Boolean']['input']>;
  theme?: InputMaybe<Scalars['JSON']['input']>;
  twitterProfileURL?: InputMaybe<Scalars['String']['input']>;
  twitterProfileURLAdmin?: InputMaybe<Scalars['String']['input']>;
  unsubscribeFromAll?: InputMaybe<Scalars['Boolean']['input']>;
  userSurveyEmailSentAt?: InputMaybe<Scalars['Date']['input']>;
  username?: InputMaybe<Scalars['String']['input']>;
  usernameUnset?: InputMaybe<Scalars['Boolean']['input']>;
  viewUnreviewedComments?: InputMaybe<Scalars['Boolean']['input']>;
  voteBanned?: InputMaybe<Scalars['Boolean']['input']>;
  walledGardenInvite?: InputMaybe<Scalars['Boolean']['input']>;
  walledGardenPortalOnboarded?: InputMaybe<Scalars['Boolean']['input']>;
  website?: InputMaybe<Scalars['String']['input']>;
  whenConfirmationEmailSent?: InputMaybe<Scalars['Date']['input']>;
};

export type UpdateUserEagDetailDataInput = {
  careerStage?: InputMaybe<Array<Scalars['String']['input']>>;
  countryOrRegion?: InputMaybe<Scalars['String']['input']>;
  experiencedIn?: InputMaybe<Array<Scalars['String']['input']>>;
  interestedIn?: InputMaybe<Array<Scalars['String']['input']>>;
  lastUpdated?: InputMaybe<Scalars['Date']['input']>;
  legacyData?: InputMaybe<Scalars['JSON']['input']>;
  nearestCity?: InputMaybe<Scalars['String']['input']>;
  willingnessToRelocate?: InputMaybe<Scalars['JSON']['input']>;
};

export type UpdateUserEagDetailInput = {
  data: UpdateUserEagDetailDataInput;
  selector: SelectorInput;
};

export type UpdateUserInput = {
  data: UpdateUserDataInput;
  selector: SelectorInput;
};

export type UpdateUserJobAdDataInput = {
  adState?: InputMaybe<Scalars['String']['input']>;
  lastUpdated?: InputMaybe<Scalars['Date']['input']>;
  legacyData?: InputMaybe<Scalars['JSON']['input']>;
  reminderSetAt?: InputMaybe<Scalars['Date']['input']>;
};

export type UpdateUserJobAdInput = {
  data: UpdateUserJobAdDataInput;
  selector: SelectorInput;
};

export type UpdateUserMostValuablePostDataInput = {
  deleted?: InputMaybe<Scalars['Boolean']['input']>;
  legacyData?: InputMaybe<Scalars['JSON']['input']>;
  postId?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateUserMostValuablePostInput = {
  data: UpdateUserMostValuablePostDataInput;
  selector: SelectorInput;
};

export type UpdateUserRateLimitDataInput = {
  actionsPerInterval?: InputMaybe<Scalars['Float']['input']>;
  endedAt?: InputMaybe<Scalars['Date']['input']>;
  intervalLength?: InputMaybe<Scalars['Float']['input']>;
  intervalUnit?: InputMaybe<UserRateLimitIntervalUnit>;
  legacyData?: InputMaybe<Scalars['JSON']['input']>;
  type?: InputMaybe<UserRateLimitType>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateUserRateLimitInput = {
  data: UpdateUserRateLimitDataInput;
  selector: SelectorInput;
};

export type UpdateUserTagRelDataInput = {
  legacyData?: InputMaybe<Scalars['JSON']['input']>;
  subforumEmailNotifications?: InputMaybe<Scalars['Boolean']['input']>;
  subforumHideIntroPost?: InputMaybe<Scalars['Boolean']['input']>;
  subforumShowUnreadInSidebar?: InputMaybe<Scalars['Boolean']['input']>;
};

export type UpdateUserTagRelInput = {
  data: UpdateUserTagRelDataInput;
  selector: SelectorInput;
};

export type UserEagDetailSelector = {
  dataByUser?: InputMaybe<UserEagDetailsDataByUserInput>;
  default?: InputMaybe<EmptyViewInput>;
};

export type UserEagDetailsDataByUserInput = {
  userId?: InputMaybe<Scalars['String']['input']>;
};

export enum UserGroup {
  Admins = 'admins',
  AlignmentForum = 'alignmentForum',
  AlignmentForumAdmins = 'alignmentForumAdmins',
  AlignmentVoters = 'alignmentVoters',
  CanBypassPostRateLimit = 'canBypassPostRateLimit',
  CanModeratePersonal = 'canModeratePersonal',
  CanSuggestCuration = 'canSuggestCuration',
  Debaters = 'debaters',
  Guests = 'guests',
  Members = 'members',
  Podcasters = 'podcasters',
  RealAdmins = 'realAdmins',
  SunshineRegiment = 'sunshineRegiment',
  TrustLevel1 = 'trustLevel1'
}

export type UserJobAdSelector = {
  adsByUser?: InputMaybe<UserJobAdsAdsByUserInput>;
  default?: InputMaybe<EmptyViewInput>;
};

export type UserJobAdsAdsByUserInput = {
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type UserMostValuablePostSelector = {
  currentUserMostValuablePosts?: InputMaybe<EmptyViewInput>;
  currentUserPost?: InputMaybe<UserMostValuablePostsCurrentUserPostInput>;
  default?: InputMaybe<EmptyViewInput>;
};

export type UserMostValuablePostsCurrentUserPostInput = {
  postId?: InputMaybe<Scalars['String']['input']>;
};

export enum UserRateLimitIntervalUnit {
  Days = 'days',
  Hours = 'hours',
  Minutes = 'minutes',
  Weeks = 'weeks'
}

export type UserRateLimitSelector = {
  activeUserRateLimits?: InputMaybe<EmptyViewInput>;
  default?: InputMaybe<EmptyViewInput>;
  userRateLimits?: InputMaybe<UserRateLimitsUserRateLimitsInput>;
};

export enum UserRateLimitType {
  AllComments = 'allComments',
  AllPosts = 'allPosts'
}

export type UserRateLimitsUserRateLimitsInput = {
  active?: InputMaybe<Scalars['Boolean']['input']>;
  userIds?: InputMaybe<Array<Scalars['String']['input']>>;
};

export type UserSelector = {
  LWSunshinesList?: InputMaybe<EmptyViewInput>;
  LWTrustLevel1List?: InputMaybe<EmptyViewInput>;
  LWUsersAdmin?: InputMaybe<EmptyViewInput>;
  alignmentSuggestedUsers?: InputMaybe<EmptyViewInput>;
  allUsers?: InputMaybe<EmptyViewInput>;
  default?: InputMaybe<EmptyViewInput>;
  recentlyActive?: InputMaybe<EmptyViewInput>;
  reviewAdminUsers?: InputMaybe<EmptyViewInput>;
  sunshineNewUsers?: InputMaybe<EmptyViewInput>;
  tagCommunityMembers?: InputMaybe<UsersTagCommunityMembersInput>;
  usersByUserIds?: InputMaybe<UsersUsersByUserIdsInput>;
  usersMapLocations?: InputMaybe<EmptyViewInput>;
  usersProfile?: InputMaybe<UsersUsersProfileInput>;
  usersTopKarma?: InputMaybe<EmptyViewInput>;
  usersWithBannedUsers?: InputMaybe<EmptyViewInput>;
  usersWithOptedInToDialogueFacilitation?: InputMaybe<EmptyViewInput>;
  usersWithPaymentInfo?: InputMaybe<EmptyViewInput>;
};

export type UserSelectorUniqueInput = {
  _id?: InputMaybe<Scalars['String']['input']>;
  documentId?: InputMaybe<Scalars['String']['input']>;
  slug?: InputMaybe<Scalars['String']['input']>;
};

export type UserTagRelSelector = {
  default?: InputMaybe<EmptyViewInput>;
  single?: InputMaybe<UserTagRelsSingleInput>;
};

export type UserTagRelsSingleInput = {
  tagId?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type UsersTagCommunityMembersInput = {
  hasBio?: InputMaybe<Scalars['Boolean']['input']>;
  profileTagId?: InputMaybe<Scalars['String']['input']>;
};

export type UsersUsersByUserIdsInput = {
  userIds?: InputMaybe<Array<Scalars['String']['input']>>;
};

export type UsersUsersProfileInput = {
  slug?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type VoteSelector = {
  default?: InputMaybe<EmptyViewInput>;
  tagVotes?: InputMaybe<EmptyViewInput>;
  userPostVotes?: InputMaybe<VotesUserPostVotesInput>;
  userVotes?: InputMaybe<VotesUserVotesInput>;
};

export enum VoteType {
  BigDownvote = 'bigDownvote',
  BigUpvote = 'bigUpvote',
  Neutral = 'neutral',
  SmallDownvote = 'smallDownvote',
  SmallUpvote = 'smallUpvote'
}

export type VotesUserPostVotesInput = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  collectionName?: InputMaybe<Scalars['String']['input']>;
  voteType?: InputMaybe<VoteType>;
};

export type VotesUserVotesInput = {
  collectionNames: Array<Scalars['String']['input']>;
};

export type GetCurrentUserQueryVariables = Exact<{ [key: string]: never; }>;


export type GetCurrentUserQuery = { __typename?: 'Query', currentUser?: { __typename?: 'User', _id: string, username?: string | null, slug: string, karma: number, reactPaletteStyle?: ReactPaletteStyle | null } | null };

export type GetSubscriptionsQueryVariables = Exact<{
  userId: Scalars['String']['input'];
}>;


export type GetSubscriptionsQuery = { __typename?: 'Query', subscriptions?: { __typename?: 'MultiSubscriptionOutput', results: Array<{ __typename?: 'Subscription', documentId?: string | null }> } | null };

export type PostFieldsLiteFragment = { __typename?: 'Post', _id: string, title: string, slug: string, pageUrl: string, postedAt: any, baseScore: number, voteCount: number, commentCount: number, wordCount?: number | null, extendedScore?: any | null, afExtendedScore?: any | null, currentUserVote?: string | null, currentUserExtendedVote?: any | null, user?: { __typename?: 'User', _id: string, username?: string | null, displayName: string, slug: string, karma: number } | null };

export type PostFieldsFullFragment = { __typename?: 'Post', htmlBody?: string | null, _id: string, title: string, slug: string, pageUrl: string, postedAt: any, baseScore: number, voteCount: number, commentCount: number, wordCount?: number | null, extendedScore?: any | null, afExtendedScore?: any | null, currentUserVote?: string | null, currentUserExtendedVote?: any | null, contents?: { __typename?: 'Revision', markdown?: string | null } | null, user?: { __typename?: 'User', _id: string, username?: string | null, displayName: string, slug: string, karma: number } | null };

export type CommentFieldsCoreFragment = { __typename?: 'Comment', _id: string, postedAt: any, htmlBody?: string | null, baseScore?: number | null, voteCount: number, descendentCount: number, directChildrenCount: number, pageUrl?: string | null, author?: string | null, rejected: boolean, topLevelCommentId?: string | null, postId?: string | null, parentCommentId?: string | null, extendedScore?: any | null, afExtendedScore?: any | null, currentUserVote?: string | null, currentUserExtendedVote?: any | null, user?: { __typename?: 'User', _id: string, username?: string | null, displayName: string, slug: string, karma: number, htmlBio: string } | null, parentComment?: { __typename?: 'Comment', _id: string, parentCommentId?: string | null, parentComment?: { __typename?: 'Comment', _id: string, parentCommentId?: string | null, parentComment?: { __typename?: 'Comment', _id: string, parentCommentId?: string | null, parentComment?: { __typename?: 'Comment', _id: string, parentCommentId?: string | null, parentComment?: { __typename?: 'Comment', _id: string, parentCommentId?: string | null } | null } | null } | null } | null, user?: { __typename?: 'User', _id: string, username?: string | null, displayName: string } | null } | null };

export type CommentFieldsLiteFragment = { __typename?: 'Comment', _id: string, postedAt: any, htmlBody?: string | null, baseScore?: number | null, voteCount: number, descendentCount: number, directChildrenCount: number, pageUrl?: string | null, author?: string | null, rejected: boolean, topLevelCommentId?: string | null, postId?: string | null, parentCommentId?: string | null, extendedScore?: any | null, afExtendedScore?: any | null, currentUserVote?: string | null, currentUserExtendedVote?: any | null, post?: { __typename?: 'Post', _id: string, title: string, slug: string, pageUrl: string, postedAt: any, baseScore: number, voteCount: number, commentCount: number, wordCount?: number | null, extendedScore?: any | null, afExtendedScore?: any | null, currentUserVote?: string | null, currentUserExtendedVote?: any | null, user?: { __typename?: 'User', _id: string, username?: string | null, displayName: string, slug: string, karma: number } | null } | null, user?: { __typename?: 'User', _id: string, username?: string | null, displayName: string, slug: string, karma: number, htmlBio: string } | null, parentComment?: { __typename?: 'Comment', _id: string, parentCommentId?: string | null, parentComment?: { __typename?: 'Comment', _id: string, parentCommentId?: string | null, parentComment?: { __typename?: 'Comment', _id: string, parentCommentId?: string | null, parentComment?: { __typename?: 'Comment', _id: string, parentCommentId?: string | null, parentComment?: { __typename?: 'Comment', _id: string, parentCommentId?: string | null } | null } | null } | null } | null, user?: { __typename?: 'User', _id: string, username?: string | null, displayName: string } | null } | null };

export type CommentFieldsFullFragment = { __typename?: 'Comment', _id: string, postedAt: any, htmlBody?: string | null, baseScore?: number | null, voteCount: number, descendentCount: number, directChildrenCount: number, pageUrl?: string | null, author?: string | null, rejected: boolean, topLevelCommentId?: string | null, postId?: string | null, parentCommentId?: string | null, extendedScore?: any | null, afExtendedScore?: any | null, currentUserVote?: string | null, currentUserExtendedVote?: any | null, contents?: { __typename?: 'Revision', markdown?: string | null } | null, post?: { __typename?: 'Post', htmlBody?: string | null, _id: string, title: string, slug: string, pageUrl: string, postedAt: any, baseScore: number, voteCount: number, commentCount: number, wordCount?: number | null, extendedScore?: any | null, afExtendedScore?: any | null, currentUserVote?: string | null, currentUserExtendedVote?: any | null, contents?: { __typename?: 'Revision', markdown?: string | null } | null, user?: { __typename?: 'User', _id: string, username?: string | null, displayName: string, slug: string, karma: number } | null } | null, latestChildren: Array<{ __typename?: 'Comment', _id: string, postedAt: any, htmlBody?: string | null, baseScore?: number | null, voteCount: number, descendentCount: number, directChildrenCount: number, pageUrl?: string | null, author?: string | null, rejected: boolean, topLevelCommentId?: string | null, postId?: string | null, parentCommentId?: string | null }>, user?: { __typename?: 'User', _id: string, username?: string | null, displayName: string, slug: string, karma: number, htmlBio: string } | null, parentComment?: { __typename?: 'Comment', _id: string, parentCommentId?: string | null, parentComment?: { __typename?: 'Comment', _id: string, parentCommentId?: string | null, parentComment?: { __typename?: 'Comment', _id: string, parentCommentId?: string | null, parentComment?: { __typename?: 'Comment', _id: string, parentCommentId?: string | null, parentComment?: { __typename?: 'Comment', _id: string, parentCommentId?: string | null } | null } | null } | null } | null, user?: { __typename?: 'User', _id: string, username?: string | null, displayName: string } | null } | null };

export type GetAllRecentCommentsLiteQueryVariables = Exact<{
  limit?: InputMaybe<Scalars['Int']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  sortBy?: InputMaybe<Scalars['String']['input']>;
}>;


export type GetAllRecentCommentsLiteQuery = { __typename?: 'Query', comments?: { __typename?: 'MultiCommentOutput', results: Array<{ __typename?: 'Comment', _id: string, postedAt: any, htmlBody?: string | null, baseScore?: number | null, voteCount: number, descendentCount: number, directChildrenCount: number, pageUrl?: string | null, author?: string | null, rejected: boolean, topLevelCommentId?: string | null, postId?: string | null, parentCommentId?: string | null, extendedScore?: any | null, afExtendedScore?: any | null, currentUserVote?: string | null, currentUserExtendedVote?: any | null, post?: { __typename?: 'Post', _id: string, title: string, slug: string, pageUrl: string, postedAt: any, baseScore: number, voteCount: number, commentCount: number, wordCount?: number | null, extendedScore?: any | null, afExtendedScore?: any | null, currentUserVote?: string | null, currentUserExtendedVote?: any | null, user?: { __typename?: 'User', _id: string, username?: string | null, displayName: string, slug: string, karma: number } | null } | null, user?: { __typename?: 'User', _id: string, username?: string | null, displayName: string, slug: string, karma: number, htmlBio: string } | null, parentComment?: { __typename?: 'Comment', _id: string, parentCommentId?: string | null, parentComment?: { __typename?: 'Comment', _id: string, parentCommentId?: string | null, parentComment?: { __typename?: 'Comment', _id: string, parentCommentId?: string | null, parentComment?: { __typename?: 'Comment', _id: string, parentCommentId?: string | null, parentComment?: { __typename?: 'Comment', _id: string, parentCommentId?: string | null } | null } | null } | null } | null, user?: { __typename?: 'User', _id: string, username?: string | null, displayName: string } | null } | null }> } | null };

export type GetAllRecentCommentsQueryVariables = Exact<{
  limit?: InputMaybe<Scalars['Int']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  sortBy?: InputMaybe<Scalars['String']['input']>;
}>;


export type GetAllRecentCommentsQuery = { __typename?: 'Query', comments?: { __typename?: 'MultiCommentOutput', results: Array<{ __typename?: 'Comment', _id: string, postedAt: any, htmlBody?: string | null, baseScore?: number | null, voteCount: number, descendentCount: number, directChildrenCount: number, pageUrl?: string | null, author?: string | null, rejected: boolean, topLevelCommentId?: string | null, postId?: string | null, parentCommentId?: string | null, extendedScore?: any | null, afExtendedScore?: any | null, currentUserVote?: string | null, currentUserExtendedVote?: any | null, contents?: { __typename?: 'Revision', markdown?: string | null } | null, post?: { __typename?: 'Post', htmlBody?: string | null, _id: string, title: string, slug: string, pageUrl: string, postedAt: any, baseScore: number, voteCount: number, commentCount: number, wordCount?: number | null, extendedScore?: any | null, afExtendedScore?: any | null, currentUserVote?: string | null, currentUserExtendedVote?: any | null, contents?: { __typename?: 'Revision', markdown?: string | null } | null, user?: { __typename?: 'User', _id: string, username?: string | null, displayName: string, slug: string, karma: number } | null } | null, latestChildren: Array<{ __typename?: 'Comment', _id: string, postedAt: any, htmlBody?: string | null, baseScore?: number | null, voteCount: number, descendentCount: number, directChildrenCount: number, pageUrl?: string | null, author?: string | null, rejected: boolean, topLevelCommentId?: string | null, postId?: string | null, parentCommentId?: string | null }>, user?: { __typename?: 'User', _id: string, username?: string | null, displayName: string, slug: string, karma: number, htmlBio: string } | null, parentComment?: { __typename?: 'Comment', _id: string, parentCommentId?: string | null, parentComment?: { __typename?: 'Comment', _id: string, parentCommentId?: string | null, parentComment?: { __typename?: 'Comment', _id: string, parentCommentId?: string | null, parentComment?: { __typename?: 'Comment', _id: string, parentCommentId?: string | null, parentComment?: { __typename?: 'Comment', _id: string, parentCommentId?: string | null } | null } | null } | null } | null, user?: { __typename?: 'User', _id: string, username?: string | null, displayName: string } | null } | null }> } | null };

export type GetCommentsByIdsQueryVariables = Exact<{
  commentIds?: InputMaybe<Array<Scalars['String']['input']> | Scalars['String']['input']>;
}>;


export type GetCommentsByIdsQuery = { __typename?: 'Query', comments?: { __typename?: 'MultiCommentOutput', results: Array<{ __typename?: 'Comment', _id: string, postedAt: any, htmlBody?: string | null, baseScore?: number | null, voteCount: number, descendentCount: number, directChildrenCount: number, pageUrl?: string | null, author?: string | null, rejected: boolean, topLevelCommentId?: string | null, postId?: string | null, parentCommentId?: string | null, extendedScore?: any | null, afExtendedScore?: any | null, currentUserVote?: string | null, currentUserExtendedVote?: any | null, contents?: { __typename?: 'Revision', markdown?: string | null } | null, post?: { __typename?: 'Post', htmlBody?: string | null, _id: string, title: string, slug: string, pageUrl: string, postedAt: any, baseScore: number, voteCount: number, commentCount: number, wordCount?: number | null, extendedScore?: any | null, afExtendedScore?: any | null, currentUserVote?: string | null, currentUserExtendedVote?: any | null, contents?: { __typename?: 'Revision', markdown?: string | null } | null, user?: { __typename?: 'User', _id: string, username?: string | null, displayName: string, slug: string, karma: number } | null } | null, latestChildren: Array<{ __typename?: 'Comment', _id: string, postedAt: any, htmlBody?: string | null, baseScore?: number | null, voteCount: number, descendentCount: number, directChildrenCount: number, pageUrl?: string | null, author?: string | null, rejected: boolean, topLevelCommentId?: string | null, postId?: string | null, parentCommentId?: string | null }>, user?: { __typename?: 'User', _id: string, username?: string | null, displayName: string, slug: string, karma: number, htmlBio: string } | null, parentComment?: { __typename?: 'Comment', _id: string, parentCommentId?: string | null, parentComment?: { __typename?: 'Comment', _id: string, parentCommentId?: string | null, parentComment?: { __typename?: 'Comment', _id: string, parentCommentId?: string | null, parentComment?: { __typename?: 'Comment', _id: string, parentCommentId?: string | null, parentComment?: { __typename?: 'Comment', _id: string, parentCommentId?: string | null } | null } | null } | null } | null, user?: { __typename?: 'User', _id: string, username?: string | null, displayName: string } | null } | null }> } | null };

export type VoteMutationVariables = Exact<{
  documentId: Scalars['String']['input'];
  voteType: Scalars['String']['input'];
  extendedVote?: InputMaybe<Scalars['JSON']['input']>;
}>;


export type VoteMutation = { __typename?: 'Mutation', performVoteComment?: { __typename?: 'VoteResultComment', document: { __typename?: 'Comment', _id: string, baseScore?: number | null, voteCount: number, extendedScore?: any | null, afExtendedScore?: any | null, currentUserVote?: string | null, currentUserExtendedVote?: any | null, contents?: { __typename?: 'Revision', markdown?: string | null } | null } } | null };

export type GetPostQueryVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type GetPostQuery = { __typename?: 'Query', post?: { __typename?: 'SinglePostOutput', result?: { __typename?: 'Post', htmlBody?: string | null, _id: string, title: string, slug: string, pageUrl: string, postedAt: any, baseScore: number, voteCount: number, commentCount: number, wordCount?: number | null, extendedScore?: any | null, afExtendedScore?: any | null, currentUserVote?: string | null, currentUserExtendedVote?: any | null, contents?: { __typename?: 'Revision', markdown?: string | null } | null, user?: { __typename?: 'User', _id: string, username?: string | null, displayName: string, slug: string, karma: number } | null } | null } | null };

export type GetNewPostsLiteQueryVariables = Exact<{
  limit?: InputMaybe<Scalars['Int']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
}>;


export type GetNewPostsLiteQuery = { __typename?: 'Query', posts?: { __typename?: 'MultiPostOutput', results: Array<{ __typename?: 'Post', _id: string, title: string, slug: string, pageUrl: string, postedAt: any, baseScore: number, voteCount: number, commentCount: number, wordCount?: number | null, extendedScore?: any | null, afExtendedScore?: any | null, currentUserVote?: string | null, currentUserExtendedVote?: any | null, user?: { __typename?: 'User', _id: string, username?: string | null, displayName: string, slug: string, karma: number } | null }> } | null };

export type GetNewPostsFullQueryVariables = Exact<{
  limit?: InputMaybe<Scalars['Int']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
}>;


export type GetNewPostsFullQuery = { __typename?: 'Query', posts?: { __typename?: 'MultiPostOutput', results: Array<{ __typename?: 'Post', htmlBody?: string | null, _id: string, title: string, slug: string, pageUrl: string, postedAt: any, baseScore: number, voteCount: number, commentCount: number, wordCount?: number | null, extendedScore?: any | null, afExtendedScore?: any | null, currentUserVote?: string | null, currentUserExtendedVote?: any | null, contents?: { __typename?: 'Revision', markdown?: string | null } | null, user?: { __typename?: 'User', _id: string, username?: string | null, displayName: string, slug: string, karma: number } | null }> } | null };

export type GetPostCommentsQueryVariables = Exact<{
  postId: Scalars['String']['input'];
  limit?: InputMaybe<Scalars['Int']['input']>;
}>;


export type GetPostCommentsQuery = { __typename?: 'Query', comments?: { __typename?: 'MultiCommentOutput', results: Array<{ __typename?: 'Comment', _id: string, postedAt: any, htmlBody?: string | null, baseScore?: number | null, voteCount: number, descendentCount: number, directChildrenCount: number, pageUrl?: string | null, author?: string | null, rejected: boolean, topLevelCommentId?: string | null, postId?: string | null, parentCommentId?: string | null, extendedScore?: any | null, afExtendedScore?: any | null, currentUserVote?: string | null, currentUserExtendedVote?: any | null, contents?: { __typename?: 'Revision', markdown?: string | null } | null, post?: { __typename?: 'Post', htmlBody?: string | null, _id: string, title: string, slug: string, pageUrl: string, postedAt: any, baseScore: number, voteCount: number, commentCount: number, wordCount?: number | null, extendedScore?: any | null, afExtendedScore?: any | null, currentUserVote?: string | null, currentUserExtendedVote?: any | null, contents?: { __typename?: 'Revision', markdown?: string | null } | null, user?: { __typename?: 'User', _id: string, username?: string | null, displayName: string, slug: string, karma: number } | null } | null, latestChildren: Array<{ __typename?: 'Comment', _id: string, postedAt: any, htmlBody?: string | null, baseScore?: number | null, voteCount: number, descendentCount: number, directChildrenCount: number, pageUrl?: string | null, author?: string | null, rejected: boolean, topLevelCommentId?: string | null, postId?: string | null, parentCommentId?: string | null }>, user?: { __typename?: 'User', _id: string, username?: string | null, displayName: string, slug: string, karma: number, htmlBio: string } | null, parentComment?: { __typename?: 'Comment', _id: string, parentCommentId?: string | null, parentComment?: { __typename?: 'Comment', _id: string, parentCommentId?: string | null, parentComment?: { __typename?: 'Comment', _id: string, parentCommentId?: string | null, parentComment?: { __typename?: 'Comment', _id: string, parentCommentId?: string | null, parentComment?: { __typename?: 'Comment', _id: string, parentCommentId?: string | null } | null } | null } | null } | null, user?: { __typename?: 'User', _id: string, username?: string | null, displayName: string } | null } | null }> } | null };

export type GetThreadCommentsQueryVariables = Exact<{
  topLevelCommentId: Scalars['String']['input'];
  limit?: InputMaybe<Scalars['Int']['input']>;
}>;


export type GetThreadCommentsQuery = { __typename?: 'Query', comments?: { __typename?: 'MultiCommentOutput', results: Array<{ __typename?: 'Comment', _id: string, postedAt: any, htmlBody?: string | null, baseScore?: number | null, voteCount: number, descendentCount: number, directChildrenCount: number, pageUrl?: string | null, author?: string | null, rejected: boolean, topLevelCommentId?: string | null, postId?: string | null, parentCommentId?: string | null, extendedScore?: any | null, afExtendedScore?: any | null, currentUserVote?: string | null, currentUserExtendedVote?: any | null, contents?: { __typename?: 'Revision', markdown?: string | null } | null, post?: { __typename?: 'Post', htmlBody?: string | null, _id: string, title: string, slug: string, pageUrl: string, postedAt: any, baseScore: number, voteCount: number, commentCount: number, wordCount?: number | null, extendedScore?: any | null, afExtendedScore?: any | null, currentUserVote?: string | null, currentUserExtendedVote?: any | null, contents?: { __typename?: 'Revision', markdown?: string | null } | null, user?: { __typename?: 'User', _id: string, username?: string | null, displayName: string, slug: string, karma: number } | null } | null, latestChildren: Array<{ __typename?: 'Comment', _id: string, postedAt: any, htmlBody?: string | null, baseScore?: number | null, voteCount: number, descendentCount: number, directChildrenCount: number, pageUrl?: string | null, author?: string | null, rejected: boolean, topLevelCommentId?: string | null, postId?: string | null, parentCommentId?: string | null }>, user?: { __typename?: 'User', _id: string, username?: string | null, displayName: string, slug: string, karma: number, htmlBio: string } | null, parentComment?: { __typename?: 'Comment', _id: string, parentCommentId?: string | null, parentComment?: { __typename?: 'Comment', _id: string, parentCommentId?: string | null, parentComment?: { __typename?: 'Comment', _id: string, parentCommentId?: string | null, parentComment?: { __typename?: 'Comment', _id: string, parentCommentId?: string | null, parentComment?: { __typename?: 'Comment', _id: string, parentCommentId?: string | null } | null } | null } | null } | null, user?: { __typename?: 'User', _id: string, username?: string | null, displayName: string } | null } | null }> } | null };

export type GetCommentRepliesQueryVariables = Exact<{
  parentCommentId: Scalars['String']['input'];
}>;


export type GetCommentRepliesQuery = { __typename?: 'Query', comments?: { __typename?: 'MultiCommentOutput', results: Array<{ __typename?: 'Comment', _id: string, postedAt: any, htmlBody?: string | null, baseScore?: number | null, voteCount: number, descendentCount: number, directChildrenCount: number, pageUrl?: string | null, author?: string | null, rejected: boolean, topLevelCommentId?: string | null, postId?: string | null, parentCommentId?: string | null, extendedScore?: any | null, afExtendedScore?: any | null, currentUserVote?: string | null, currentUserExtendedVote?: any | null, contents?: { __typename?: 'Revision', markdown?: string | null } | null, post?: { __typename?: 'Post', htmlBody?: string | null, _id: string, title: string, slug: string, pageUrl: string, postedAt: any, baseScore: number, voteCount: number, commentCount: number, wordCount?: number | null, extendedScore?: any | null, afExtendedScore?: any | null, currentUserVote?: string | null, currentUserExtendedVote?: any | null, contents?: { __typename?: 'Revision', markdown?: string | null } | null, user?: { __typename?: 'User', _id: string, username?: string | null, displayName: string, slug: string, karma: number } | null } | null, latestChildren: Array<{ __typename?: 'Comment', _id: string, postedAt: any, htmlBody?: string | null, baseScore?: number | null, voteCount: number, descendentCount: number, directChildrenCount: number, pageUrl?: string | null, author?: string | null, rejected: boolean, topLevelCommentId?: string | null, postId?: string | null, parentCommentId?: string | null }>, user?: { __typename?: 'User', _id: string, username?: string | null, displayName: string, slug: string, karma: number, htmlBio: string } | null, parentComment?: { __typename?: 'Comment', _id: string, parentCommentId?: string | null, parentComment?: { __typename?: 'Comment', _id: string, parentCommentId?: string | null, parentComment?: { __typename?: 'Comment', _id: string, parentCommentId?: string | null, parentComment?: { __typename?: 'Comment', _id: string, parentCommentId?: string | null, parentComment?: { __typename?: 'Comment', _id: string, parentCommentId?: string | null } | null } | null } | null } | null, user?: { __typename?: 'User', _id: string, username?: string | null, displayName: string } | null } | null }> } | null };

export type GetUserQueryVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type GetUserQuery = { __typename?: 'Query', user?: { __typename?: 'SingleUserOutput', result?: { __typename?: 'User', _id: string, username?: string | null, displayName: string, slug: string, karma: number, htmlBio: string } | null } | null };

export type GetUserBySlugQueryVariables = Exact<{
  slug: Scalars['String']['input'];
}>;


export type GetUserBySlugQuery = { __typename?: 'Query', user?: { __typename?: 'User', _id: string, username?: string | null, displayName: string, slug: string, karma: number, htmlBio: string } | null };

export type GetCommentQueryVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type GetCommentQuery = { __typename?: 'Query', comment?: { __typename?: 'SingleCommentOutput', result?: { __typename?: 'Comment', _id: string, postedAt: any, htmlBody?: string | null, baseScore?: number | null, voteCount: number, descendentCount: number, directChildrenCount: number, pageUrl?: string | null, author?: string | null, rejected: boolean, topLevelCommentId?: string | null, postId?: string | null, parentCommentId?: string | null, extendedScore?: any | null, afExtendedScore?: any | null, currentUserVote?: string | null, currentUserExtendedVote?: any | null, contents?: { __typename?: 'Revision', markdown?: string | null } | null, post?: { __typename?: 'Post', htmlBody?: string | null, _id: string, title: string, slug: string, pageUrl: string, postedAt: any, baseScore: number, voteCount: number, commentCount: number, wordCount?: number | null, extendedScore?: any | null, afExtendedScore?: any | null, currentUserVote?: string | null, currentUserExtendedVote?: any | null, contents?: { __typename?: 'Revision', markdown?: string | null } | null, user?: { __typename?: 'User', _id: string, username?: string | null, displayName: string, slug: string, karma: number } | null } | null, latestChildren: Array<{ __typename?: 'Comment', _id: string, postedAt: any, htmlBody?: string | null, baseScore?: number | null, voteCount: number, descendentCount: number, directChildrenCount: number, pageUrl?: string | null, author?: string | null, rejected: boolean, topLevelCommentId?: string | null, postId?: string | null, parentCommentId?: string | null }>, user?: { __typename?: 'User', _id: string, username?: string | null, displayName: string, slug: string, karma: number, htmlBio: string } | null, parentComment?: { __typename?: 'Comment', _id: string, parentCommentId?: string | null, parentComment?: { __typename?: 'Comment', _id: string, parentCommentId?: string | null, parentComment?: { __typename?: 'Comment', _id: string, parentCommentId?: string | null, parentComment?: { __typename?: 'Comment', _id: string, parentCommentId?: string | null, parentComment?: { __typename?: 'Comment', _id: string, parentCommentId?: string | null } | null } | null } | null } | null, user?: { __typename?: 'User', _id: string, username?: string | null, displayName: string } | null } | null } | null } | null };
