import { test, expect } from '@playwright/test';
import { initPowerReader } from './helpers/setup';

test.describe('Power Reader AI Studio Integration', () => {

    test('[PR-CMTBTN-03][PR-AI-01][PR-AI-02][PR-AI-05][PR-AI-06][PR-AI-07][PR-AI-10] Pressing "g" over a comment triggers AI Studio prompt generation', async ({ page }) => {
        const postedAt = '2026-01-02T03:04:05.000Z';
        const comments = [
            {
                _id: 'c1', postId: 'p1', postedAt,
                htmlBody: '<p>AI Target Comment</p>', baseScore: 10,
                voteCount: 21,
                extendedScore: {
                    agreement: 5,
                    agreementVoteCount: 3,
                    approvalVoteCount: 44,
                    agree: 7,
                    disagree: 2
                },
                currentUserVote: 'smallUpvote',
                currentUserExtendedVote: { agreement: 'smallDownvote', agree: true, disagree: false },
                user: { _id: 'u1', username: 'Author', displayName: 'Author Full Name', karma: 100 },
                post: {
                    _id: 'p1',
                    title: 'Post 1',
                    postedAt,
                    baseScore: 10,
                    voteCount: 8,
                    extendedScore: { approvalVoteCount: 8, agree: 1, disagree: 0 },
                    user: { karma: 100 }
                },
                contents: { markdown: 'AI Target Comment Markdown' }
            }
        ];

        await initPowerReader(page, {
            testMode: true,
            comments,
            // We need GM_openInTab to be mocked and tracked
            onInit: `
                window.GM_openInTab = (url) => {
                    ${process.env.PW_SINGLE_FILE_RUN === 'true' ? "console.log('GM_openInTab: ' + url);" : ""}
                    window.__LAST_TAB_URL = url;
                };
            `
        });

        const comment = page.locator('.pr-comment').first();
        // Collapse help section
        await page.evaluate(() => {
            const help = document.getElementById('pr-help-section') as HTMLDetailsElement;
            if (help) help.open = false;
        });
        await comment.scrollIntoViewIfNeeded();

        const box = await comment.boundingBox();
        const centerX = box!.x + box!.width / 2;
        const centerY = box!.y + box!.height / 2;
        await page.mouse.move(centerX, centerY);

        // Update state manually to be sure (it's how the script tracks hover)
        await page.evaluate(({ x, y }) => {
            const state = (window as any).getState();
            state.lastMousePos = { x, y: y - window.scrollY };
        }, { x: centerX, y: centerY });

        // Setup expectation for GM_setValue
        await page.evaluate(() => {
            const originalSetValue = (window as any).GM_setValue;
            (window as any).GM_setValue = (key: string, value: any) => {
                originalSetValue(key, value);
                if (key.startsWith('ai_studio_prompt_payload:')) {
                    (window as any)._lastAiPayload = value;
                }
            };
        });

        // Press 'g'
        await page.keyboard.press('g');

        // Verify outcomes
        await expect.poll(async () => await page.evaluate(() => (window as any).__LAST_TAB_URL)).toContain('aistudio.google.com');

        const payload = await page.evaluate(() => (window as any)._lastAiPayload);
        expect(payload).toContain('AI Target Comment');
        expect(payload).toContain('author="Author Full Name"');
        expect(payload).toContain(`<posted_at>${postedAt}</posted_at>`);
        expect(payload).toContain('<karma score="10" vote_count="44" current_user_vote="smallUpvote" />');
        expect(payload).toContain('<agreement_lw score="5" vote_count="3" current_user_vote="smallDownvote" />');
        expect(payload).toContain('<agreement_eaf agree_count="7" disagree_count="2" current_user_agree="true" current_user_disagree="false" />');

        // Verify highlight
        await expect(comment).toHaveClass(/being-summarized/);
    });

    test('Uses custom AI Studio prompt prefix if set in GM storage', async ({ page }) => {
        const customPrefix = 'CUSTOM_AI_PREFIX: ';

        await initPowerReader(page, {
            testMode: true,
            storage: {
                'power-reader-ai-studio-prefix': customPrefix
            }
        });

        const comment = page.locator('.pr-comment').first();
        await page.evaluate(() => {
            const help = document.getElementById('pr-help-section') as HTMLDetailsElement;
            if (help) help.open = false;
        });

        const box = await comment.boundingBox();
        const centerX = box!.x + box!.width / 2;
        const centerY = box!.y + box!.height / 2;
        await page.mouse.move(centerX, centerY);

        await page.evaluate(({ x, y }) => {
            const state = (window as any).getState();
            state.lastMousePos = { x, y: y - window.scrollY };
        }, { x: centerX, y: centerY });

        // Press 'g'
        await page.keyboard.press('g');

        // Verify outcome via __GM_CALLS
        await page.waitForFunction(() => {
            const calls = (window as any).__GM_CALLS || {};
            return Object.keys(calls).some((key) => key.startsWith('ai_studio_prompt_payload:'));
        });
        const payload = await page.evaluate(() => {
            const calls = (window as any).__GM_CALLS || {};
            const payloadKey = Object.keys(calls).find((key) => key.startsWith('ai_studio_prompt_payload:'));
            return payloadKey ? calls[payloadKey] : undefined;
        });
        expect(payload).toContain(customPrefix);
    });
});
