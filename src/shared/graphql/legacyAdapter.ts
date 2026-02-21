// ---------------------------------------------------------------------------
// Legacy GraphQL adapter for EA Forum
//
// LessWrong uses the modern selector/top-level-args query syntax:
//   comments(selector: { viewName: { ... } }, limit: $limit, offset: $offset)
//   post(selector: { _id: $id })
//
// EA Forum still uses the legacy input/terms syntax:
//   comments(input: { terms: { view: "viewName", ..., limit, offset } })
//   post(input: { selector: { _id: $id } })
//
// Both syntaxes work on LW (which still accepts the deprecated `input` arg),
// but EAF only supports the legacy form. This adapter rewrites queries and
// variables at request time when running on EAF, so all query definitions and
// call sites can use the modern syntax unconditionally.
// ---------------------------------------------------------------------------

interface MultiAdapter {
    type: 'multi';
    collection: string;
    inputType: string;
    view?: string;
    inlineTerms?: Record<string, any>;
}

interface SingleAdapter {
    type: 'single';
    collection: string;
    inputType: string;
    idVar: string;
}

type LegacyAdapter = MultiAdapter | SingleAdapter;

export const LEGACY_ADAPTERS: Record<string, LegacyAdapter> = {
    GetAllRecentCommentsLite: { type: 'multi', collection: 'comments', inputType: 'MultiCommentInput', view: 'allRecentComments' },
    GetAllRecentComments: { type: 'multi', collection: 'comments', inputType: 'MultiCommentInput', view: 'allRecentComments' },
    GetCommentsByIds: { type: 'multi', collection: 'comments', inputType: 'MultiCommentInput' },
    GetPostComments: { type: 'multi', collection: 'comments', inputType: 'MultiCommentInput', view: 'postCommentsNew' },
    GetThreadComments: { type: 'multi', collection: 'comments', inputType: 'MultiCommentInput', view: 'repliesToCommentThreadIncludingRoot' },
    GetUserComments: { type: 'multi', collection: 'comments', inputType: 'MultiCommentInput', view: 'allRecentComments', inlineTerms: { sortBy: 'oldest' } },
    GetCommentReplies: { type: 'multi', collection: 'comments', inputType: 'MultiCommentInput', view: 'commentReplies' },
    GetNewPostsLite: { type: 'multi', collection: 'posts', inputType: 'MultiPostInput', view: 'new' },
    GetNewPostsFull: { type: 'multi', collection: 'posts', inputType: 'MultiPostInput', view: 'new' },
    GetUserPosts: { type: 'multi', collection: 'posts', inputType: 'MultiPostInput', view: 'userPosts', inlineTerms: { sortedBy: 'oldest' } },
    GetSubscriptions: { type: 'multi', collection: 'subscriptions', inputType: 'MultiSubscriptionInput', view: 'subscriptionState', inlineTerms: { collectionName: 'Users' } },
    GetPost: { type: 'single', collection: 'post', inputType: 'SinglePostInput', idVar: 'id' },
    GetComment: { type: 'single', collection: 'comment', inputType: 'SingleCommentInput', idVar: 'id' },
    GetUser: { type: 'single', collection: 'user', inputType: 'SingleUserInput', idVar: 'id' },
};

const legacyQueryCache = new Map<string, string>();

export function buildLegacyQuery(query: string, adapter: LegacyAdapter): string {
    const cached = legacyQueryCache.get(query);
    if (cached) return cached;

    // Replace variable declarations: query OpName(...) → query OpName($input: InputType)
    let result = query.replace(
        /query\s+(\w+)\([^)]*\)/,
        `query $1($input: ${adapter.inputType})`
    );

    // Replace field arguments: collection(selector: { ... }, limit: $x, ...) { → collection(input: $input) {
    const escaped = adapter.collection.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(
        new RegExp(escaped + '\\([\\s\\S]*?\\)\\s*\\{'),
        `${adapter.collection}(input: $input) {`
    );

    legacyQueryCache.set(query, result);
    return result;
}

export function buildLegacyVariables(variables: any, adapter: LegacyAdapter): any {
    if (adapter.type === 'single') {
        return { input: { selector: { _id: variables[adapter.idVar] } } };
    }
    const terms: Record<string, any> = { ...variables };
    if (adapter.view) {
        terms.view = adapter.view;
    }
    if (adapter.inlineTerms) {
        Object.assign(terms, adapter.inlineTerms);
    }
    return { input: { terms } };
}

export function adaptForLegacy(query: string, variables: any): { query: string; variables: any } {
    const opMatch = query.match(/(?:query|mutation)\s+(\w+)/);
    if (!opMatch) return { query, variables };

    const adapter = LEGACY_ADAPTERS[opMatch[1]];
    if (!adapter) return { query, variables };

    return {
        query: buildLegacyQuery(query, adapter),
        variables: buildLegacyVariables(variables, adapter),
    };
}
