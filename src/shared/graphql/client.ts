declare const GM_xmlhttpRequest: any;

const LOG_PREFIX = '[GraphQL Client]';

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

function makeRequest(url: string, data: string): Promise<{ status: number; responseText: string }> {
    return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
            method: 'POST',
            url,
            headers: { 'Content-Type': 'application/json' },
            data,
            timeout: 30000,
            onload: (response: any) => resolve(response),
            onerror: (err: any) => reject(err),
            ontimeout: () => reject(new Error('Request timed out')),
        });
    });
}

export async function queryGraphQL<TData = any, TVariables = any>(query: string, variables: TVariables = {} as TVariables): Promise<TData> {
    const url = getGraphQLEndpoint();
    const data = JSON.stringify({ query, variables });
    const maxAttempts = 3;
    const delays = [1000, 2000];

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            const response = await makeRequest(url, data);

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
                throw new Error(res.errors[0].message);
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
