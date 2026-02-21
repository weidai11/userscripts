import { test, expect } from '@playwright/test';
import { setupMockEnvironment, getScriptContent, initPowerReader } from './helpers/setup';

test.describe('Post Action Buttons', () => {
    let scriptContent: string;

    test.beforeAll(() => {
        scriptContent = getScriptContent();
    });

    test('[PR-POSTBTN-01] Toggle Post Body should expand and collapse post body', async ({ page }) => {
        const posts = [{
            _id: 'p1',
            title: 'Test Post',
            htmlBody: '<div style="height: 2000px">Long Body</div>',
            postedAt: new Date().toISOString(),
            user: { _id: 'u1', username: 'Author1' }
        }];

        await initPowerReader(page, {
            posts,
            testMode: true,
            scrapedReactions: [],
        });

        const post = page.locator('.pr-post[data-post-id="p1"]').first();
        const container = post.locator('.pr-post-body-container');
        const toggleBtn = page.locator('.pr-post[data-post-id="p1"] [data-action="toggle-post-body"]');

        // Post has htmlBody, so body container starts rendered and truncated
        await expect(container).toHaveCount(1);
        await expect(container).toHaveClass(/truncated/);
        await expect(toggleBtn).toHaveText('[e]');

        // Click [e] to expand
        await toggleBtn.click();
        await expect(container).not.toHaveClass(/truncated/);
        await expect(container).toBeVisible();

        // Click [e] to collapse
        await toggleBtn.click();
        await expect(container).toHaveClass(/truncated/);
    });

    test('[PR-POSTBTN-01] Collapsing with [e] keeps body bottom at visible viewport top when scrolled deep', async ({ page }) => {
        const posts = [{
            _id: 'p1',
            title: 'Deep Scroll Post',
            htmlBody: '<div style="height: 3000px">Very Long Body</div>',
            postedAt: new Date().toISOString(),
            user: { _id: 'u1', username: 'Author1' }
        }];
        const comments = Array.from({ length: 50 }, (_, i) => ({
            _id: `c-${i + 1}`,
            postId: 'p1',
            htmlBody: `<div style="height: 120px">Comment ${i + 1}</div>`,
            postedAt: new Date(Date.now() - i * 1000).toISOString(),
            user: { _id: `u${i + 2}`, username: `User${i + 2}` }
        }));

        await initPowerReader(page, {
            posts,
            comments,
            testMode: true,
            scrapedReactions: [],
        });

        const post = page.locator('.pr-post[data-post-id="p1"]').first();
        const container = post.locator('.pr-post-body-container');
        const toggleBtn = page.locator('.pr-post[data-post-id="p1"] [data-action="toggle-post-body"]');

        // Expand first.
        await toggleBtn.click();
        await expect(container).not.toHaveClass(/truncated/);

        // Scroll deep into the expanded body so collapsing would otherwise jump it above viewport.
        await page.evaluate(() => {
            const body = document.querySelector('.pr-post[data-id="p1"] .pr-post-body-container') as HTMLElement;
            const bodyTop = body.getBoundingClientRect().top + window.scrollY;
            window.scrollTo(0, bodyTop + 3600);
            window.dispatchEvent(new Event('scroll'));
        });

        const scrollBeforeCollapse = await page.evaluate(() => window.scrollY);
        expect(scrollBeforeCollapse).toBeGreaterThan(1000);

        // Trigger [e] through hotkey while pointer is over the post body.
        await page.mouse.move(220, 260);
        await page.keyboard.press('e');
        await expect(container).toHaveClass(/truncated/);

        const metrics = await page.evaluate(() => {
            const body = document.querySelector('.pr-post[data-id="p1"] .pr-post-body-container') as HTMLElement;
            const sticky = document.getElementById('pr-sticky-header');
            const visibleTop = sticky && sticky.classList.contains('visible')
                ? Math.max(0, sticky.getBoundingClientRect().bottom)
                : 0;
            const bottom = body.getBoundingClientRect().bottom;
            return {
                scrollY: window.scrollY,
                delta: Math.abs(bottom - visibleTop),
            };
        });

        expect(metrics.scrollY).toBeLessThan(scrollBeforeCollapse);
        expect(metrics.delta).toBeLessThan(8);
    });

    test('[PR-POSTBTN-02] Load All Comments should fetch and inject comments', async ({ page }) => {
        const posts = [{ _id: 'p1', title: 'Post 1', htmlBody: 'Body', commentCount: 10 }];
        const initialComments = [{ _id: 'c1', postId: 'p1', htmlBody: 'C1', user: { username: 'A' }, postedAt: new Date().toISOString() }];
        const extraComments = [
            { _id: 'c1', postId: 'p1', htmlBody: 'C1', user: { username: 'A' }, postedAt: new Date().toISOString() }, // duplicate
            { _id: 'c2', postId: 'p1', htmlBody: 'C2', user: { username: 'B' }, postedAt: new Date().toISOString() }
        ];

        await setupMockEnvironment(page, {
            posts,
            comments: initialComments,
            testMode: true,
            onGraphQL: `
                if (query.includes('query GetPostComments')) {
                    return { data: { comments: { results: ${JSON.stringify(extraComments)} } } };
                }
            `
        });

        await page.goto('https://www.lesswrong.com/reader', { waitUntil: 'domcontentloaded' });
        await page.evaluate(scriptContent);
        await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached' });

        await expect(page.locator('.pr-comment[data-id="c1"]')).toBeVisible();
        await expect(page.locator('.pr-comment[data-id="c2"]')).not.toBeVisible();

        const btn = page.locator('.pr-post[data-id="p1"] [data-action="load-all-comments"]');
        await btn.click();

        // Wait for loading to finish (text changes from [...] back to [a])
        await expect(btn).toHaveText('[a]', { timeout: 10000 });

        await expect(page.locator('.pr-comment[data-id="c2"]')).toBeVisible();
    });

    test('[PR-POSTBTN-02] Load All Comments request limit scales to post.commentCount when above loadMax', async ({ page }) => {
        const expectedLimit = 1200;
        const posts = [{ _id: 'p1', title: 'Post 1', htmlBody: 'Body', commentCount: expectedLimit }];
        const comments = [{
            _id: 'c-seed',
            postId: 'p1',
            htmlBody: 'Seed',
            postedAt: new Date().toISOString(),
            user: { username: 'A' }
        }];

        await initPowerReader(page, {
            posts,
            comments,
            testMode: true,
            onGraphQL: `
                if (query.includes('query GetPostComments')) {
                    window.__LAST_LOAD_ALL_LIMIT = variables.limit;
                    return { data: { comments: { results: [] } } };
                }
            `
        });

        const btn = page.locator('.pr-post[data-id="p1"] [data-action="load-all-comments"]');
        await btn.click();
        await page.getByRole('button', { name: 'Load all descendants' }).click();
        await expect(btn).toHaveText('[a]', { timeout: 10000 });

        const actualLimit = await page.evaluate(() => (window as any).__LAST_LOAD_ALL_LIMIT);
        expect(actualLimit).toBe(expectedLimit);
    });

    test('[PR-POSTBTN-03][PR-POSTBTN-04] Scroll actions', async ({ page }) => {
        const now = Date.now();
        const posts = [
            { _id: 'p1', title: 'P1', htmlBody: '<div style="height: 1000px">B1</div>', commentCount: 1, postedAt: new Date(now).toISOString() },
            { _id: 'p2', title: 'P2', htmlBody: 'B2', commentCount: 1, postedAt: new Date(now - 10000).toISOString() }
        ];
        const comments = [
            { _id: 'c1', postId: 'p1', htmlBody: 'C1', user: { username: 'A' }, postedAt: new Date(now).toISOString() },
            { _id: 'c2', postId: 'p2', htmlBody: 'C2', user: { username: 'B' }, postedAt: new Date(now - 10000).toISOString() }
        ];

        await initPowerReader(page, { posts, comments, testMode: true });

        // Scroll to comments
        const commentsBtn = page.locator('.pr-post[data-id="p1"] [data-action="scroll-to-comments"]');
        await expect(commentsBtn).toHaveText('[c]');
        await commentsBtn.click();
        await expect.poll(async () => {
            const top = await page.evaluate(() => document.querySelector('.pr-comment[data-id="c1"]')?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY);
            return top;
        }).toBeLessThan(500);

        // Scroll to next post
        const nextBtn = page.locator('.pr-post[data-id="p1"] [data-action="scroll-to-next-post"]');
        await expect(nextBtn).toHaveText('[n]');
        await nextBtn.click();
        await expect.poll(async () => {
            const top = await page.evaluate(() => document.querySelector('.pr-post[data-post-id="p2"]')?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY);
            return top;
        }).toBeLessThan(600);
    });

    test('[PR-NEST-01] Recursive collapse should hide siblings in nested structure', async ({ page }) => {
        const posts = [{ _id: 'p1', title: 'P1', postedAt: new Date().toISOString() }];
        const comments = [
            { _id: 'c1', postId: 'p1', htmlBody: 'C1', user: { username: 'A' }, postedAt: new Date().toISOString() },
            { _id: 'c2', postId: 'p1', parentCommentId: 'c1', htmlBody: 'C2', user: { username: 'B' }, postedAt: new Date().toISOString() }
        ];

        await initPowerReader(page, { posts, comments, testMode: true });

        const c1 = page.locator('.pr-comment[data-id="c1"]');
        const c2 = page.locator('.pr-comment[data-id="c2"]');
        // Use direct child selector to get the parent's own collapse button
        const collapseBtn = c1.locator('> .pr-comment-meta [data-action="collapse"]');

        await expect(c2).toBeVisible();

        // Click collapse on parent
        await collapseBtn.click();

        await expect(c1).toHaveClass(/collapsed/);
        // c2 is inside c1, so it should be hidden
        await expect(c2).not.toBeVisible();
    });
});

test.describe('Comment Action Buttons', () => {
    let scriptContent: string;

    test.beforeAll(() => {
        scriptContent = getScriptContent();
    });

    test('[PR-CMTBTN-01] [r] action should fetch descendants and preserve viewport', async ({ page }) => {
        const posts = [{ _id: 'p1', title: 'P1', postedAt: new Date().toISOString() }];
        const comments = [
            { _id: 'c2', postId: 'p1', parentCommentId: 'c1', htmlBody: 'C2', user: { username: 'U2' }, directChildrenCount: 1, postedAt: new Date().toISOString() }
        ];
        const thread = [
            { _id: 'c1', postId: 'p1', htmlBody: 'C1', user: { username: 'U1' }, postedAt: new Date().toISOString() },
            { _id: 'c2', postId: 'p1', parentCommentId: 'c1', htmlBody: 'C2', user: { username: 'U2' }, postedAt: new Date().toISOString() },
            { _id: 'c3', postId: 'p1', parentCommentId: 'c2', htmlBody: 'C3', user: { username: 'U3' }, postedAt: new Date().toISOString() }
        ];

        await setupMockEnvironment(page, {
            posts,
            comments,
            testMode: true,
            verbose: true,
            onGraphQL: `
                if (query.includes('query GetComment')) {
                    return { data: { comment: { result: ${JSON.stringify(thread[0])} } } };
                }
                if (query.includes('query GetThreadComments')) {
                    return { data: { comments: { results: ${JSON.stringify(thread)} } } };
                }
            `
        });

        await page.goto('https://www.lesswrong.com/reader', { waitUntil: 'domcontentloaded' });
        await page.evaluate(scriptContent);
        await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached' });

        // Spacer to allow scrolling
        await page.evaluate(() => {
            const div = document.createElement('div');
            div.id = 'test-spacer';
            div.style.height = '5000px';
            document.body.prepend(div);
            window.scrollTo(0, 3000); // Scroll down so c2 is visible
        });

        // Ensure we wait for scroll to be applied
        await page.waitForFunction(() => window.scrollY >= 3000);

        const c2Comment = page.locator('.pr-comment[data-id="c2"]');
        await c2Comment.scrollIntoViewIfNeeded();
        await expect(c2Comment).toBeVisible();

        const initialTop = await c2Comment.evaluate(el => el.getBoundingClientRect().top);
        const initialScrollY = await page.evaluate(() => window.scrollY);
        if (process.env.PW_SINGLE_FILE_RUN === 'true') {
            console.log('BEFORE LOAD: initialTop:', initialTop, 'initialScrollY:', initialScrollY);
        }

        const btn = page.locator('.pr-comment[data-id="c2"] > .pr-comment-meta [data-action="load-descendants"]');
        await btn.click();

        // Wait for loading to finish - button should be disabled because all descendants are now loaded
        await expect(btn).toHaveClass(/disabled/, { timeout: 10000 });

        await expect(page.locator('.pr-comment[data-id="c1"]')).toBeVisible();
        await expect(page.locator('.pr-comment[data-id="c3"]')).toBeVisible();

        const finalTop = await c2Comment.evaluate(el => el.getBoundingClientRect().top);
        const finalScrollY = await page.evaluate(() => window.scrollY);
        if (process.env.PW_SINGLE_FILE_RUN === 'true') {
            console.log('AFTER LOAD: finalTop:', finalTop, 'finalScrollY:', finalScrollY);
        }

        await expect(page.locator('.pr-comment[data-id="c2"]')).toBeVisible();
        expect(Math.abs(finalTop - initialTop)).toBeLessThan(200);
    });

    test('[PR-CMTBTN-02] Scroll to Root', async ({ page }) => {
        const posts = [{ _id: 'p1', title: 'P1', postedAt: new Date().toISOString() }];
        const comments = [
            { _id: 'c1', postId: 'p1', htmlBody: 'C1', user: { username: 'U1' }, postedAt: new Date().toISOString() },
            { _id: 'c2', postId: 'p1', parentCommentId: 'c1', htmlBody: 'C2', user: { username: 'U2' }, postedAt: new Date().toISOString() },
            { _id: 'c3', postId: 'p1', parentCommentId: 'c2', htmlBody: 'C3', user: { username: 'U3' }, postedAt: new Date().toISOString() }
        ];

        await initPowerReader(page, { posts, comments, testMode: true });

        // Add spacer to allow scrolling
        await page.evaluate(() => {
            document.body.style.height = '10000px';
            window.scrollTo(0, 5000);
        });

        const btn = page.locator('.pr-comment[data-id="c3"] [data-action="load-parents-and-scroll"]');
        await expect(btn).toHaveText('[t]');
        await btn.click();

        const c1 = page.locator('.pr-comment[data-id="c1"]');
        await expect.poll(async () => {
            return c1.evaluate(el => {
                const stickyHeader = document.getElementById('pr-sticky-header');
                const stickyRect = stickyHeader?.getBoundingClientRect();
                const stickyStyles = stickyHeader ? window.getComputedStyle(stickyHeader) : null;
                const stickyTop = stickyHeader && stickyRect && stickyStyles &&
                    (stickyHeader.classList.contains('visible') || (stickyStyles.display !== 'none' && stickyRect.height > 0))
                    ? Math.max(0, stickyRect.bottom)
                    : 0;

                const ownBody = el.querySelector(':scope > .pr-comment-body') as HTMLElement | null;
                const ownMeta = el.querySelector(':scope > .pr-comment-meta-wrapper') as HTMLElement | null;
                const target = ownBody || ownMeta || el;
                const rect = target.getBoundingClientRect();

                return rect.top >= stickyTop && rect.bottom <= window.innerHeight;
            });
        }).toBe(true);
        await expect(c1).toHaveClass(/pr-highlight-parent/);
    });

    test('[PR-CMTBTN-01] [r] should resolve missing ancestors before thread fetch', async ({ page }) => {
        const posts = [{ _id: 'p1', title: 'P1', postedAt: new Date().toISOString() }];
        const initialComments = [
            {
                _id: 'c3',
                postId: 'p1',
                parentCommentId: 'c2',
                topLevelCommentId: 'c1',
                htmlBody: 'C3',
                user: { username: 'U3' },
                directChildrenCount: 1,
                postedAt: new Date().toISOString()
            }
        ];

        const c1 = {
            _id: 'c1',
            postId: 'p1',
            parentCommentId: null,
            topLevelCommentId: 'c1',
            htmlBody: 'C1',
            user: { username: 'U1' },
            postedAt: new Date().toISOString()
        };
        const c2 = {
            _id: 'c2',
            postId: 'p1',
            parentCommentId: 'c1',
            topLevelCommentId: 'c1',
            htmlBody: 'C2',
            user: { username: 'U2' },
            postedAt: new Date().toISOString()
        };
        const c3 = initialComments[0];
        const c4 = {
            _id: 'c4',
            postId: 'p1',
            parentCommentId: 'c3',
            topLevelCommentId: 'c1',
            htmlBody: 'C4',
            user: { username: 'U4' },
            postedAt: new Date().toISOString()
        };

        await setupMockEnvironment(page, {
            posts,
            comments: initialComments,
            testMode: true,
            onGraphQL: `
                if (query.includes('query GetComment')) {
                    if (variables.id === 'c2') return { data: { comment: { result: ${JSON.stringify(c2)} } } };
                    if (variables.id === 'c1') return { data: { comment: { result: ${JSON.stringify(c1)} } } };
                }
                if (query.includes('query GetThreadComments')) {
                    if (variables.topLevelCommentId === 'c1') {
                        return { data: { comments: { results: ${JSON.stringify([c1, c2, c3, c4])} } } };
                    }
                    return { data: { comments: { results: ${JSON.stringify([c3, c4])} } } };
                }
            `
        });

        await page.goto('https://www.lesswrong.com/reader', { waitUntil: 'domcontentloaded' });
        await page.evaluate(scriptContent);
        await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached' });

        const btn = page.locator('.pr-comment[data-id="c3"] [data-action="load-descendants"]');
        await expect(btn).toBeVisible();
        await btn.click();

        await expect(page.locator('.pr-comment[data-id="c1"] .pr-comment-body').first()).toContainText('C1');
        await expect(page.locator('.pr-comment[data-id="c2"] .pr-comment-body').first()).toContainText('C2');
        await expect(page.locator('.pr-comment[data-id="c4"] .pr-comment-body').first()).toContainText('C4');
        await expect(page.locator('.pr-comment[data-id="c2"][data-placeholder="1"]')).toHaveCount(0);
    });
});
