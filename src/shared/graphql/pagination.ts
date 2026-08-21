/**
 * Maximum offset allowed by the LessWrong API.
 * The server throws "Exceeded maximum value for skip" if offset > 2000.
 * @see packages/lesswrong/lib/instanceSettings.ts - maxAllowedApiSkip
 */
export const MAX_API_SKIP = 2000;
