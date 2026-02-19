declare const GM_xmlhttpRequest: any;

const LOG_PREFIX = '[GraphQL Client]';

export interface GraphQLQueryOptions {
    allowPartialData?: boolean;
    toleratedErrorPatterns?: Array<string | RegExp>;
    operationName?: string;
    timeout?: number;
}

function isToleratedGraphQLError(err: any, patterns: Array<string | RegExp>): boolean {
    const message = typeof err?.message === 'string' ? err.message : '';
    const pathText = Array.isArray(err?.path) ? err.path.join('.') : '';

    return patterns.some(pattern => {
        if (typeof pattern === 'string') {
            return message.includes(pattern) || pathText.includes(pattern);
        }
        return pattern.test(message) || pattern.test(pathText);
    });
}

function getGraphQLEndpoint(): string {
    const hostname = window.location.hostname;
    if (hostname === 'forum.effectivealtruism.org') {
        return 'https://forum.effectivealtruism.org/graphql';
    }
    return 'https://www.lesswrong.com/graphql';
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function makeRequest(url: string, data: string, timeout: number = 30000): Promise<{ status: number; responseText: string }> {
    return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
            method: 'POST',
            url,
            headers: { 'Content-Type': 'application/json' },
            data,
            timeout,
            onload: (response: any) => resolve(response),
            onerror: (err: any) => reject(err),
            ontimeout: () => reject(new Error('Request timed out')),
        });
    });
}

export async function queryGraphQL<TData = any, TVariables = any>(
    query: string,
    variables: TVariables = {} as TVariables,
    options: GraphQLQueryOptions = {}
): Promise<TData> {
    const url = getGraphQLEndpoint();
    const data = JSON.stringify({ query, variables });
    const maxAttempts = 3;
    const delays = [1000, 2000];

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            const response = await makeRequest(url, data, options.timeout);

            if (response.status === 429 || response.status >= 500) {
                if (attempt < maxAttempts - 1) {
                    await sleep(delays[attempt]);
                    continue;
                }
                throw new Error(`HTTP ${response.status} after ${maxAttempts} attempts`);
            }

            let res: any;
            try {
                res = JSON.parse(response.responseText);
            } catch (parseError) {
                const error = parseError instanceof Error ? parseError : new Error('Failed to parse response JSON');
                console.error(LOG_PREFIX, 'GraphQL response parse failed:', response.responseText);
                throw error;
            }
            if (res.errors) {
                const errors = Array.isArray(res.errors) ? res.errors : [res.errors];
                const label = options.operationName ? ` (${options.operationName})` : '';

                if (options.allowPartialData && res.data) {
                    const patterns = options.toleratedErrorPatterns || [];
                    const untolerated = errors.filter((err: any) => !isToleratedGraphQLError(err, patterns));

                    if (untolerated.length === 0) {
                        console.warn(LOG_PREFIX, `GraphQL partial data accepted${label}:`, errors);
                        return res.data;
                    }

                    console.error(LOG_PREFIX, `GraphQL errors (partial data rejected)${label}:`, untolerated);
                    throw new Error(untolerated[0]?.message || 'GraphQL error');
                }

                console.error(LOG_PREFIX, `GraphQL errors${label}:`, errors);
                throw new Error(errors[0]?.message || 'GraphQL error');
            }
            return res.data;
        } catch (err) {
            const isRetryable = err instanceof Error && (
                err.message === 'Request timed out' ||
                err.message.startsWith('HTTP ')
            );

            if (isRetryable && attempt < maxAttempts - 1) {
                await sleep(delays[attempt]);
                continue;
            }

            if (err instanceof Error && err.message.startsWith('HTTP ')) {
                throw err;
            }

            if (attempt < maxAttempts - 1 && !(err instanceof Error)) {
                await sleep(delays[attempt]);
                continue;
            }

            throw err;
        }
    }
    throw new Error('Failed to execute GraphQL query');
}
