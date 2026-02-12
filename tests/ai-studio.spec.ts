import { test, expect } from '@playwright/test';
import { initPowerReader } from './helpers/setup';

test.describe('Power Reader AI Studio Integration', () => {

    test('[PR-AI-01][PR-AI-02][PR-AI-03][PR-AI-05][PR-AI-06][PR-AI-07] Pressing "g" over a comment triggers AI Studio prompt generation', async ({ page }) => {
        const comments = [
            {
                _id: 'c1', postId: 'p1', postedAt: new Date().toISOString(),
                htmlBody: '<p>AI Target Comment</p>', baseScore: 10,
                user: { _id: 'u1', username: 'Author', karma: 100 },
                post: { _id: 'p1', title: 'Post 1', baseScore: 10, user: { karma: 100 } },
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
                if (key === 'ai_studio_prompt_payload') {
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
        await page.waitForFunction(() => (window as any).__GM_CALLS?.ai_studio_prompt_payload !== undefined);
        const payload = await page.evaluate(() => (window as any).__GM_CALLS?.ai_studio_prompt_payload);
        expect(payload).toContain(customPrefix);
    });
});
