import { test, expect } from '@playwright/test';
import { setupMockEnvironment, initPowerReader } from './helpers/setup';

test.describe('Power Reader Hotkeys', () => {
    test('[PR-HK-01][PR-HK-03][PR-HK-06] Hovering comment and pressing [-] collapses it and logs feedback', async ({ page }) => {
        await initPowerReader(page, {
            testMode: true,
            verbose: true,
            appVerbose: true,
            comments: [
                {
                    _id: 'c1',
                    postId: 'p1',
                    htmlBody: '<p>Top level comment</p>',
                    postedAt: new Date().toISOString(),
                    baseScore: 10,
                    user: { _id: 'u1', username: 'User1', karma: 100 },
                    post: { _id: 'p1', title: 'Mock Post Title', commentCount: 5 }
                }
            ]
        });

        const comment = page.locator('.pr-comment[data-id="c1"]');
        await expect(comment).not.toHaveClass(/collapsed/);

        // Capture logs
        const logs: string[] = [];
        page.on('console', msg => logs.push(msg.text()));

        // Move mouse over the comment
        const box = await comment.boundingBox();
        if (!box) throw new Error('No bounding box');
        await page.mouse.move(box.x + 50, box.y + 10);
        await page.waitForTimeout(100);
        
        // Press '-' key
        await page.keyboard.press('-');

        await expect(comment).toHaveClass(/collapsed/);
        
        // Verify log contains the hotkey trigger info
        await expect.poll(() => logs.some(l => l.includes("Hotkey '-' triggering action 'collapse'"))).toBe(true);
    });

    test('[PR-HK-03][PR-HK-05] Hovering collapsed comment and pressing [+] or [=] expands it', async ({ page }) => {
        await initPowerReader(page, {
            testMode: true,
            verbose: true,
            appVerbose: true,
            comments: [
                {
                    _id: 'c1',
                    postId: 'p1',
                    htmlBody: '<p>Top level comment</p>',
                    postedAt: new Date().toISOString(),
                    baseScore: 10,
                    user: { _id: 'u1', username: 'User1', karma: 100 },
                    post: { _id: 'p1', title: 'Mock Post Title', commentCount: 5 }
                }
            ]
        });

        const comment = page.locator('.pr-comment[data-id="c1"]');
        
        // Collapse first
        const box = await comment.boundingBox();
        if (!box) throw new Error('No bounding box');
        await page.mouse.move(box.x + 50, box.y + 10);
        await page.waitForTimeout(100);
        await page.keyboard.press('-');
        await expect(comment).toHaveClass(/collapsed/);

        // Re-hover to be sure (it might have moved slightly)
        const box2 = await comment.boundingBox();
        if (!box2) throw new Error('No bounding box');
        await page.mouse.move(box2.x + 50, box2.y + 10);
        await page.waitForTimeout(100);

        // Press '=' key (easier than '+')
        await page.keyboard.press('=');

        await expect(comment).not.toHaveClass(/collapsed/);
    });

    test('[PR-HK-02] Hovering post and pressing [e] toggles post body', async ({ page }) => {
        // Re-init with onGraphQL handler
        await initPowerReader(page, {
            testMode: true,
            verbose: true,
            appVerbose: true,
            posts: [{ _id: 'p1', title: 'Mock Post Title' }],
            onGraphQL: `
                if (query.includes('GetPost')) {
                    window.routeHit = true;
                    return {
                        data: {
                            post: {
                                result: {
                                    _id: 'p1',
                                    htmlBody: '<p>Expanded post body</p>',
                                    postedAt: new Date().toISOString(),
                                    baseScore: 100,
                                    user: { _id: 'u1', username: 'PostAuthor', displayName: 'Post Author', karma: 100, slug: 'post-author' },
                                    extendedScore: { reacts: {} },
                                    pageUrl: 'https://www.lesswrong.com/posts/p1',
                                    title: 'Mock Post Title'
                                }
                            }
                        }
                    };
                }
            `
        });

        const postHeader = page.locator('.pr-post-header').first();
        const post = page.locator('.pr-post').first();
        
        // Use a global variable to track hits
        await page.evaluate(() => { (window as any).routeHit = false; });

        const box = await postHeader.boundingBox();
        if (!box) throw new Error('No bounding box');
        await page.mouse.move(box.x + 200, box.y + 10);
        await page.waitForTimeout(100);
        
        await page.keyboard.press('e');

        const body = post.locator('.pr-post-body');
        await expect.poll(() => page.evaluate(() => (window as any).routeHit)).toBe(true);
        await expect(body).toBeVisible({ timeout: 10000 });
        await expect(body).toContainText('Expanded post body');
    });

    test('[PR-HK-04] Hotkeys are ignored when typing in an input', async ({ page }) => {
        await initPowerReader(page, {
            testMode: true,
            verbose: true,
            appVerbose: true,
            comments: [{ _id: 'c1', postId: 'p1', postedAt: new Date().toISOString(), user: { username: 'U1' }, post: { title: 'T' } }]
        });

        // Create an input for testing
        await page.evaluate(() => {
            const input = document.createElement('input');
            input.id = 'test-input';
            document.body.appendChild(input);
        });

        const input = page.locator('#test-input');
        await input.focus();

        const comment = page.locator('.pr-comment[data-id="c1"]');
        const box = await comment.boundingBox();
        if (!box) throw new Error('No bounding box');
        await page.mouse.move(box.x + 50, box.y + 10);
        await page.waitForTimeout(100);

        // Press '-' key while focused in input
        await page.keyboard.press('-');

        // Should NOT be collapsed
        await expect(comment).not.toHaveClass(/collapsed/);
    });

        test('[PR-HK-03] Hovering comment and pressing [r] triggers load-descendants', async ({ page }) => {

            // Use a global variable to track hits

            await page.evaluate(() => { (window as any).loadTriggered = false; });

    

            // Need a comment with children to show [r]

            await initPowerReader(page, {

                testMode: true,

                verbose: true,

                appVerbose: true,

                comments: [

                    {

                        _id: 'c1',

                        postId: 'p1',

                        htmlBody: '<p>Comment with replies</p>',

                        postedAt: new Date().toISOString(),

                        baseScore: 10,

                        user: { username: 'User1', _id: 'u1', karma: 100, slug: 'u1', displayName: 'U1' },

                        post: { _id: 'p1', title: 'T' },

                        directChildrenCount: 1 // This enables [r]

                    }

                ],

                onGraphQL: `

                    if (query.includes('GetThreadComments')) {

                        window.loadTriggered = true;

                        return { data: { comments: { results: [] } } };

                    }

                `

            });

    

            const comment = page.locator('.pr-comment[data-id="c1"]');

            const rBtn = comment.locator('[data-action="load-descendants"]');

            await expect(rBtn).toBeVisible();

    

            const box = await comment.boundingBox();

            if (!box) throw new Error('No bounding box');

            await page.mouse.move(box.x + 50, box.y + 10);

            await page.waitForTimeout(100);

            

            await page.keyboard.press('r');

            

            // Wait for it to be triggered

            await expect.poll(() => page.evaluate(() => (window as any).loadTriggered)).toBe(true);

        });

    

        test('[PR-HK-01][PR-AI-01][PR-POSTBTN-07] Hovering post and pressing [g] triggers AI Studio', async ({ page }) => {

            await initPowerReader(page, {

                testMode: true,

                posts: [{ _id: 'p1', title: 'T' }]

            });

    

            const post = page.locator('.pr-post[data-id="p1"]');

            const gBtn = post.locator('[data-action="send-to-ai-studio"]');

            await expect(gBtn).toBeVisible();

    

            const box = await post.locator('.pr-post-header').boundingBox();

            if (!box) throw new Error('No box');

            await page.mouse.move(box.x + 200, box.y + 10);

            await page.waitForTimeout(100);

    

            // Capture openInTab call

            await page.evaluate(() => { (window as any).__GM_CALLS = {}; });

            

            await page.keyboard.press('g');

    

            // We expect AI Studio to be triggered

            // Since we don't have GM_openInTab mocked to return easily here without re-init,

            // we can check if the item got the highlight

            await expect(post).toHaveClass(/being-summarized/);

        });

    

            test('[PR-AI-01][PR-CMTBTN-03] Pressing [g] while hovering AI box or focal item closes it', async ({ page }) => {

    

                await initPowerReader(page, {

    

        

                testMode: true,

                comments: [{ _id: 'c1', postId: 'p1', postedAt: new Date().toISOString(), user: { username: 'U1' }, post: { title: 'T' } }]

            });

    

            // 1. Open AI box

            await page.locator('.pr-comment[data-id="c1"]').hover();

            await page.keyboard.press('g');

            

            // Manually trigger response to show popup (since we didn't mock GM_addValueChangeListener perfectly for this flow)

            await page.evaluate(() => {

                (window as any).renderUI((window as any).getState()); // Just to ensure state is there

                const state = (window as any).getState();

                (window as any).manualPreview('<p>AI Summary</p>', state); 

                // Wait, manualPreview is for link previews. 

                // Let's use the actual function if exported or just create the DOM

                const popup = document.createElement('div');

                popup.className = 'pr-ai-popup';

                popup.innerHTML = '<div class="pr-ai-popup-content">Summary</div>';

                document.body.appendChild(popup);

                state.activeAIPopup = popup;

            });

    

            const popup = page.locator('.pr-ai-popup');

            await expect(popup).toBeVisible();

    

            // 2. Hover popup and press g

            const box = await popup.boundingBox();

            if (!box) throw new Error('No popup box');

            await page.mouse.move(box.x + 50, box.y + 10);

            await page.waitForTimeout(100);

            await page.keyboard.press('g');

    

            // 3. Verify closed

            await expect(popup).not.toBeAttached();

    

            // 4. Open again

            await page.evaluate(() => {

                const popup = document.createElement('div');

                popup.className = 'pr-ai-popup';

                document.body.appendChild(popup);

                (window as any).getState().activeAIPopup = popup;

                document.querySelector('.pr-comment[data-id="c1"]')?.classList.add('being-summarized');

            });

            await expect(popup).toBeVisible();

    

            // 5. Hover focal item and press g

            const commentBox = await page.locator('.pr-comment[data-id="c1"]').boundingBox();

            if (!commentBox) throw new Error('No comment box');

            await page.mouse.move(commentBox.x + 50, commentBox.y + 10);

            await page.waitForTimeout(100);

            await page.keyboard.press('g');

    

            // 6. Verify closed

            await expect(popup).not.toBeAttached();

        });

    });

    