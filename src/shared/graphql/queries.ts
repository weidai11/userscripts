import * as GQL from '../../generated/graphql';

export const GET_CURRENT_USER = /* GraphQL */ `
  query GetCurrentUser {
    currentUser {
      _id
      username
      slug
      karma
      reactPaletteStyle
    }
  }
`;

export const GET_SUBSCRIPTIONS = /* GraphQL */ `
  query GetSubscriptions($userId: String!) {
    subscriptions(selector: { subscriptionState: { userId: $userId, collectionName: "Users" } }) {
      results {
        documentId
      }
    }
  }
`;

export const POST_FIELDS_LITE = /* GraphQL */ `
  fragment PostFieldsLite on Post {
    _id
    title
    slug
    pageUrl
    postedAt
    baseScore
    voteCount
    commentCount
    wordCount
    user {
      _id
      username
      displayName
      slug
      karma
    }
    extendedScore
    afExtendedScore
    currentUserVote
    currentUserExtendedVote
  }
`;

export const POST_FIELDS_FULL = /* GraphQL */ `
  fragment PostFieldsFull on Post {
    ...PostFieldsLite
    htmlBody
    contents { markdown }
  }
  ${POST_FIELDS_LITE}
`;

export const COMMENT_FIELDS_CORE = /* GraphQL */ `
  fragment CommentFieldsCore on Comment {
    _id
    postedAt
    htmlBody
    baseScore
    voteCount
    descendentCount
    directChildrenCount
    pageUrl
    author
    rejected
    topLevelCommentId
    user {
      _id
      username
      displayName
      slug
      karma
      htmlBio
    }
    postId
    parentCommentId
    parentComment {
      _id
      parentCommentId
      parentComment {
        _id
        parentCommentId
        parentComment {
          _id
          parentCommentId
          parentComment {
            _id
            parentCommentId
            parentComment {
              _id
              parentCommentId
            }
          }
        }
      }
      user {
        _id
        username
        displayName
      }
    }
    extendedScore
    afExtendedScore
    currentUserVote
    currentUserExtendedVote
  }
`;

export const COMMENT_FIELDS_LITE = /* GraphQL */ `
  fragment CommentFieldsLite on Comment {
    ...CommentFieldsCore
    post {
      ...PostFieldsLite
    }
  }
  ${COMMENT_FIELDS_CORE}
  ${POST_FIELDS_LITE}
`;

export const COMMENT_FIELDS = /* GraphQL */ `
  fragment CommentFieldsFull on Comment {
    ...CommentFieldsCore
    contents { markdown }
    post {
      ...PostFieldsFull
    }
    latestChildren {
      _id
      postedAt
      htmlBody
      baseScore
      voteCount
      descendentCount
      directChildrenCount
      pageUrl
      author
      rejected
      topLevelCommentId
      postId
      parentCommentId
    }
  }
  ${COMMENT_FIELDS_CORE}
  ${POST_FIELDS_FULL}
`;

export const GET_ALL_RECENT_COMMENTS_LITE = /* GraphQL */ `
  query GetAllRecentCommentsLite($limit: Int, $after: String, $before: String, $offset: Int, $sortBy: String) {
    comments(
      selector: {
        allRecentComments: {
          after: $after,
          before: $before,
          sortBy: $sortBy
        }
      },
      limit: $limit,
      offset: $offset
    ) {
      results {
        ...CommentFieldsLite
      }
    }
  }
  ${COMMENT_FIELDS_LITE}
`;

export const GET_ALL_RECENT_COMMENTS = /* GraphQL */ `
  query GetAllRecentComments($limit: Int, $after: String, $before: String, $offset: Int, $sortBy: String) {
    comments(
      selector: {
        allRecentComments: {
          after: $after,
          before: $before,
          sortBy: $sortBy
        }
      },
      limit: $limit,
      offset: $offset
    ) {
      results {
        ...CommentFieldsFull
      }
    }
  }
  ${COMMENT_FIELDS}
`;

export const GET_COMMENTS_BY_IDS = /* GraphQL */ `
  query GetCommentsByIds($commentIds: [String!]) {
    comments(
      selector: {
        default: {
          commentIds: $commentIds
        }
      }
    ) {
      results {
        ...CommentFieldsFull
      }
    }
  }
  ${COMMENT_FIELDS}
`;

export const VOTE_COMMENT_MUTATION = /* GraphQL */ `
  mutation Vote($documentId: String!, $voteType: String!, $extendedVote: JSON) {
    performVoteComment(documentId: $documentId, voteType: $voteType, extendedVote: $extendedVote) {
      document {
        _id
        baseScore
        voteCount
        extendedScore
        afExtendedScore
        currentUserVote
        currentUserExtendedVote
        contents { markdown }
      }
    }
  }
`;

export const VOTE_POST_MUTATION = /* GraphQL */ `
  mutation VotePost($documentId: String!, $voteType: String!, $extendedVote: JSON) {
    performVotePost(documentId: $documentId, voteType: $voteType, extendedVote: $extendedVote) {
      document {
        _id
        baseScore
        voteCount
        extendedScore
        afExtendedScore
        currentUserVote
        currentUserExtendedVote
        contents { markdown }
      }
    }
  }
`;

export const GET_POST = /* GraphQL */ `
  query GetPost($id: String!) {
    post(selector: { _id: $id }) {
      result {
        ...PostFieldsFull
      }
    }
  }
  ${POST_FIELDS_FULL}
`;

export const GET_NEW_POSTS_LITE = /* GraphQL */ `
  query GetNewPostsLite($limit: Int, $after: String, $before: String) {
    posts(
      selector: {
        new: {
          after: $after,
          before: $before
        }
      },
      limit: $limit
    ) {
      results {
        ...PostFieldsLite
      }
    }
  }
  ${POST_FIELDS_LITE}
`;

export const GET_NEW_POSTS_FULL = /* GraphQL */ `
  query GetNewPostsFull($limit: Int, $after: String, $before: String) {
    posts(
      selector: {
        new: {
          after: $after,
          before: $before
        }
      },
      limit: $limit
    ) {
      results {
        ...PostFieldsFull
      }
    }
  }
  ${POST_FIELDS_FULL}
`;

export const GET_POST_COMMENTS = /* GraphQL */ `
  query GetPostComments($postId: String!, $limit: Int) {
    comments(
      selector: {
        postCommentsNew: {
          postId: $postId
        }
      },
      limit: $limit
    ) {
      results {
        ...CommentFieldsFull
      }
    }
  }
  ${COMMENT_FIELDS}
`;

export const GET_THREAD_COMMENTS = /* GraphQL */ `
  query GetThreadComments($topLevelCommentId: String!, $limit: Int) {
    comments(
      selector: {
        repliesToCommentThreadIncludingRoot: {
          topLevelCommentId: $topLevelCommentId
        }
      },
      limit: $limit
    ) {
      results {
        ...CommentFieldsFull
      }
    }
  }
  ${COMMENT_FIELDS}
`;

export const GET_USER_POSTS = /* GraphQL */ `
  query GetUserPosts($userId: String!, $limit: Int, $offset: Int) {
    posts(
      selector: {
        userPosts: {
          userId: $userId
          sortedBy: "newest"
        }
      },
      limit: $limit,
      offset: $offset
    ) {
      results {
        ...PostFieldsFull
      }
    }
  }
  ${POST_FIELDS_FULL}
`;

export const GET_USER_COMMENTS = /* GraphQL */ `
  query GetUserComments($userId: String!, $limit: Int, $offset: Int) {
    comments(
      selector: {
        profileComments: {
          userId: $userId
          sortBy: "newest"
        }
      },
      limit: $limit,
      offset: $offset
    ) {
      results {
        ...CommentFieldsFull
      }
    }
  }
  ${COMMENT_FIELDS}
`;


export const GET_COMMENT_REPLIES = /* GraphQL */ `
  query GetCommentReplies($parentCommentId: String!) {
    comments(
      selector: {
        commentReplies: {
          parentCommentId: $parentCommentId
        }
      }
    ) {
      results {
        ...CommentFieldsFull
      }
    }
  }
  ${COMMENT_FIELDS}
`;

export const GET_USER = /* GraphQL */ `
  query GetUser($id: String!) {
    user(selector: { _id: $id }) {
      result {
        _id
        username
        displayName
        slug
        karma
        htmlBio
      }
    }
  }
`;

export const GET_USER_BY_SLUG = /* GraphQL */ `
  query GetUserBySlug($slug: String!) {
    user: GetUserBySlug(slug: $slug) {
      _id
      username
      displayName
      slug
      karma
      htmlBio
    }
  }
`;

export const GET_POST_BY_ID = GET_POST;

export const GET_COMMENT = /* GraphQL */ `
  query GetComment($id: String!) {
    comment(selector: { _id: $id }) {
      result {
        ...CommentFieldsFull
      }
    }
  }
  ${COMMENT_FIELDS}
`;

export type Post = {
  _id: string;
  title: string;
  slug: string;
  pageUrl: string;
  postedAt: string;
  baseScore: number;
  voteCount: number;
  htmlBody?: string | null;
  user: {
    _id: string;
    username: string;
    displayName: string;
    slug: string;
    karma: number;
  };
  extendedScore: NamesAttachedReactionsScore | null;
  afExtendedScore: any;
  currentUserVote: string | number | null;
  currentUserExtendedVote: CurrentUserExtendedVote | null;
  contents: {
    markdown: string | null;
  };
  commentCount?: number | null;
  wordCount?: number | null;
};

export type ParentCommentRef = {
  _id: string;
  parentCommentId: string | null;
  parentComment?: ParentCommentRef | null;
  user?: {
    _id: string;
    username: string;
    displayName: string;
  } | null;
};

export type Comment = {
  _id: string;
  postedAt: string;
  htmlBody: string;
  contents: {
    markdown: string | null;
  };
  baseScore: number;
  voteCount: number;
  pageUrl: string;
  author: string;
  rejected: boolean;
  topLevelCommentId: string;
  user: {
    _id: string;
    username: string;
    displayName: string;
    slug: string;
    karma: number;
    htmlBio?: string;
  };
  postId: string;
  post: Post;
  parentCommentId: string;
  parentComment: ParentCommentRef | null;
  extendedScore: NamesAttachedReactionsScore | null;
  afExtendedScore: any;
  currentUserVote: string | number | null;
  currentUserExtendedVote: CurrentUserExtendedVote | null;
  isPlaceholder?: boolean;
  isContext?: boolean;
  descendentCount: number;
  directChildrenCount: number;
  latestChildren?: Comment[] | null;
};

export type NamesAttachedReactionsScore = {
  reacts: Record<string, Array<{ userId: string; reactType: string; quotes?: Array<{ quote: string }> }>>;
  agreement?: number;
};

export type CurrentUserExtendedVote = {
  reacts?: Array<{ userId: string; react: string; quotes?: string[] }>;
  agreement?: string | null;
};

export type UserVoteOnSingleReaction = {
  userId?: string;
  react: string;
  vote?: string;
  quotes?: string[];
};

export type VoteResponseDocument = {
  _id: string;
  baseScore?: number | null;
  voteCount: number;
  extendedScore?: NamesAttachedReactionsScore | null;
  afExtendedScore?: any;
  currentUserVote?: string | number | null;
  currentUserExtendedVote?: CurrentUserExtendedVote | null;
  contents?: { markdown?: string | null } | null;
};

export type VoteResponse = {
  performVoteComment?: {
    document: VoteResponseDocument;
  } | null;
  performVotePost?: {
    document: VoteResponseDocument;
  } | null;
};

export type CurrentUserResponse = GQL.GetCurrentUserQuery;
export type SubscriptionsResponse = GQL.GetSubscriptionsQuery;
export type AllRecentCommentsResponse = GQL.GetAllRecentCommentsQuery;
