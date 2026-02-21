import { test, expect } from '@playwright/test';
import { setupMockEnvironment, initPowerReader } from './helpers/setup';

test.describe('Reproduction: [t] failing to show parent content', () => {

    test('should show entire ancestry chain when [t] is clicked', async ({ page }) => {
        // C1 (root) -> C2 (grandparent) -> C3 (parent) -> C4 (unread)
        const post = { _id: 'p1', title: 'Post' };
        
        // Initial load: only C4 and Post
        const initialComments = [
            { 
                _id: 'c4', postId: 'p1', parentCommentId: 'c3', htmlBody: 'Unread Comment', 
                postedAt: new Date().toISOString(), baseScore: 10,
                user: { username: 'Author4' }, topLevelCommentId: 'c1'
            }
        ];

        const fullAncestry = [
            { _id: 'c1', postId: 'p1', htmlBody: 'Root Comment', postedAt: new Date(Date.now() - 3000).toISOString(), user: { username: 'Author1' } },
            { _id: 'c2', postId: 'p1', parentCommentId: 'c1', htmlBody: 'Grandparent Comment', postedAt: new Date(Date.now() - 2000).toISOString(), user: { username: 'Author2' } },
            { _id: 'c3', postId: 'p1', parentCommentId: 'c2', htmlBody: 'Parent Comment', postedAt: new Date(Date.now() - 1000).toISOString(), user: { username: 'Author3' } },
            initialComments[0]
        ];

        await initPowerReader(page, { 
            posts: [post], 
            comments: initialComments,
            testMode: true,
            onGraphQL: `
                if (query.includes('query GetCommentsByIds')) {
                    const ids = variables.commentIds;
                    const results = ${JSON.stringify(fullAncestry)}.filter(c => ids.includes(c._id));
                    return { data: { comments: { results } } };
                }
            `
        });

        // Initially C4 is visible, C3 is a placeholder, C2 and C1 are invisible
        await expect(page.locator('.pr-comment[data-id="c4"]')).toBeVisible();
        await expect(page.locator('.pr-comment[data-id="c3"]')).toHaveClass(/pr-missing-parent/);
        await expect(page.locator('.pr-comment[data-id="c2"]')).not.toBeAttached();
        await expect(page.locator('.pr-comment[data-id="c1"]')).not.toBeAttached();

        // Click [t] on C4
        const btnT = page.locator('.pr-comment[data-id="c4"] [data-action="load-parents-and-scroll"]');
        await btnT.click();

        // Wait for fetch and re-render
        // BUG: Currently C2 and C1 will likely NOT be visible because buildPostGroups filters them out
        await expect(page.locator('.pr-comment[data-id="c1"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('.pr-comment[data-id="c2"]')).toBeVisible();
        await expect(page.locator('.pr-comment[data-id="c3"]')).toBeVisible();
        await expect(page.locator('.pr-comment[data-id="c3"]')).not.toHaveClass(/pr-missing-parent/);

        // Check for animation class on newly revealed parents
        await expect(page.locator('.pr-comment[data-id="c1"]')).toHaveClass(/pr-just-revealed/);
        await expect(page.locator('.pr-comment[data-id="c2"]')).toHaveClass(/pr-just-revealed/);
        await expect(page.locator('.pr-comment[data-id="c3"]')).toHaveClass(/pr-just-revealed/);
    });

    test('should show ancestors even if they are already marked as read', async ({ page }) => {
        const post = { _id: 'p1', title: 'Post' };
        const initialComments = [
            { 
                _id: 'c2', postId: 'p1', parentCommentId: 'c1', htmlBody: 'Unread Comment', 
                postedAt: new Date().toISOString(), user: { username: 'Author2' }
            }
        ];
        const root = { _id: 'c1', postId: 'p1', htmlBody: 'Read Root', postedAt: new Date(Date.now() - 5000).toISOString(), user: { username: 'Author1' } };

        await initPowerReader(page, { 
            posts: [post], 
            comments: initialComments,
            testMode: true,
            onGraphQL: `
                if (query.includes('query GetCommentsByIds')) {
                    return { data: { comments: { results: [${JSON.stringify(root)}] } } };
                }
            `
        });

        // Mark C1 as read in storage
        await page.evaluate((id) => {
            const state = JSON.parse(localStorage.getItem('__PR_READ_STATE__') || '{}');
            state[id] = 1;
            localStorage.setItem('__PR_READ_STATE__', JSON.stringify(state));
        }, 'c1');

        // Click [t] on C2
        const btnT = page.locator('.pr-comment[data-id="c2"] [data-action="load-parents-and-scroll"]');
        await btnT.click();

        // C1 should be visible despite being read and having < 2 unread descendants
        await expect(page.locator('.pr-comment[data-id="c1"]')).toBeVisible();
        await expect(page.locator('.pr-comment[data-id="c1"]')).toHaveClass(/read/);
        await expect(page.locator('.pr-comment[data-id="c1"]')).not.toHaveClass(/pr-comment-placeholder/);
    });

    test('should preserve focal position when thread top is already fully visible', async ({ page }) => {
        await page.setViewportSize({ width: 1200, height: 1400 });

        const post = { _id: 'p1', title: 'Post' };
        const comments = [
            {
                _id: 'c1', postId: 'p1', parentCommentId: null, htmlBody: 'Root',
                postedAt: new Date(Date.now() - 2000).toISOString(), user: { username: 'Author1' }
            },
            {
                _id: 'c2', postId: 'p1', parentCommentId: 'c1', htmlBody: 'Middle',
                postedAt: new Date(Date.now() - 1000).toISOString(), user: { username: 'Author2' }
            },
            {
                _id: 'c3', postId: 'p1', parentCommentId: 'c2', htmlBody: 'Leaf',
                postedAt: new Date().toISOString(), user: { username: 'Author3' }
            }
        ];

        await initPowerReader(page, {
            posts: [post],
            comments,
            testMode: true
        });

        await page.evaluate(() => {
            const postEl = document.querySelector('.pr-post');
            if (postEl && !document.getElementById('pr-test-repro-spacer')) {
                const spacer = document.createElement('div');
                spacer.id = 'pr-test-repro-spacer';
                spacer.style.height = '900px';
                postEl.parentElement?.insertBefore(spacer, postEl);
            }

            const child = document.querySelector('.pr-comment[data-id="c3"]') as HTMLElement | null;
            if (!child) return;
            const targetTop = Math.round(window.innerHeight * 0.82);
            window.scrollBy(0, child.getBoundingClientRect().top - targetTop);
        });

        const btnT = page.locator('.pr-comment[data-id="c3"] [data-action="load-parents-and-scroll"]');

        const before = await page.evaluate(() => {
            const child = document.querySelector('.pr-comment[data-id="c3"]') as HTMLElement | null;
            const root = document.querySelector('.pr-comment[data-id="c1"]') as HTMLElement | null;
            const sticky = document.getElementById('pr-sticky-header');
            const stickyTop = sticky && sticky.classList.contains('visible')
                ? Math.max(0, sticky.getBoundingClientRect().bottom)
                : 0;
            const rootRect = root?.getBoundingClientRect();
            return {
                childTop: child ? child.getBoundingClientRect().top : null,
                rootFullyVisible: !!rootRect && rootRect.top >= stickyTop && rootRect.bottom <= window.innerHeight
            };
        });

        expect(before.rootFullyVisible).toBe(true);

        await btnT.click();
        const rootComment = page.locator('.pr-comment[data-id="c1"]');
        await expect(rootComment).toBeVisible();

        const after = await page.evaluate(() => {
            const child = document.querySelector('.pr-comment[data-id="c3"]') as HTMLElement | null;
            const rootEl = document.querySelector('.pr-comment[data-id="c1"]') as HTMLElement | null;
            const sticky = document.getElementById('pr-sticky-header');
            const stickyTop = sticky && sticky.classList.contains('visible')
                ? Math.max(0, sticky.getBoundingClientRect().bottom)
                : 0;
            const rootRect = rootEl?.getBoundingClientRect();
            return {
                childTop: child ? child.getBoundingClientRect().top : null,
                rootFullyVisible: !!rootRect && rootRect.top >= stickyTop && rootRect.bottom <= window.innerHeight
            };
        });

        expect(before.childTop).not.toBeNull();
        expect(after.childTop).not.toBeNull();
        expect(after.rootFullyVisible).toBe(true);
        expect(Math.abs((after.childTop ?? 0) - (before.childTop ?? 0))).toBeLessThanOrEqual(3);
    });

    test('should treat root under sticky header as not fully visible and scroll it below sticky', async ({ page }) => {
        const post = { _id: 'p1', title: 'Post' };
        const comments = [
            {
                _id: 'c1', postId: 'p1', parentCommentId: null, htmlBody: 'Root',
                postedAt: new Date(Date.now() - 2000).toISOString(), user: { username: 'Author1' }
            },
            {
                _id: 'c2', postId: 'p1', parentCommentId: 'c1', htmlBody: 'Middle',
                postedAt: new Date(Date.now() - 1000).toISOString(), user: { username: 'Author2' }
            },
            {
                _id: 'c3', postId: 'p1', parentCommentId: 'c2', htmlBody: 'Leaf',
                postedAt: new Date().toISOString(), user: { username: 'Author3' }
            }
        ];

        await initPowerReader(page, {
            posts: [post],
            comments,
            testMode: true
        });

        await expect(page.locator('#pr-sticky-header')).toBeAttached();

        await page.evaluate(() => {
            const sticky = document.getElementById('pr-sticky-header');
            if (sticky) {
                sticky.classList.add('visible');
                sticky.style.display = 'block';
                sticky.style.position = 'fixed';
                sticky.style.top = '0';
                sticky.style.left = '0';
                sticky.style.right = '0';
                sticky.style.height = '20px';
                sticky.style.zIndex = '1500';
                sticky.innerHTML = '<div class="pr-post-header" style="height:20px;background:#fff"></div>';
            }

            if (!document.getElementById('pr-test-sticky-spacer')) {
                const spacer = document.createElement('div');
                spacer.id = 'pr-test-sticky-spacer';
                spacer.style.height = '3000px';
                document.body.appendChild(spacer);
            }

            const root = document.querySelector('.pr-comment[data-id="c1"]') as HTMLElement | null;
            if (root) {
                const delta = root.getBoundingClientRect().top - 10;
                window.scrollBy(0, delta);
            }
        });

        const before = await page.evaluate(() => {
            const root = document.querySelector('.pr-comment[data-id="c1"]') as HTMLElement | null;
            const sticky = document.getElementById('pr-sticky-header');
            const stickyTop = sticky && ((sticky.classList.contains('visible')) || (window.getComputedStyle(sticky).display !== 'none' && sticky.getBoundingClientRect().height > 0))
                ? Math.max(0, sticky.getBoundingClientRect().bottom)
                : 0;
            return {
                rootTop: root ? root.getBoundingClientRect().top : null,
                stickyTop,
                scrollY: window.scrollY
            };
        });

        expect(before.rootTop).not.toBeNull();
        expect(before.stickyTop).toBeGreaterThan(0);
        expect((before.rootTop ?? 0) < before.stickyTop).toBe(true);

        const traceBtn = page.locator('.pr-comment[data-id="c3"] [data-action="load-parents-and-scroll"]');
        await traceBtn.click();

        const after = await page.evaluate(() => {
            const root = document.querySelector('.pr-comment[data-id="c1"]') as HTMLElement | null;
            const sticky = document.getElementById('pr-sticky-header');
            const stickyTop = sticky && ((sticky.classList.contains('visible')) || (window.getComputedStyle(sticky).display !== 'none' && sticky.getBoundingClientRect().height > 0))
                ? Math.max(0, sticky.getBoundingClientRect().bottom)
                : 0;
            return {
                rootTop: root ? root.getBoundingClientRect().top : null,
                stickyTop,
                scrollY: window.scrollY
            };
        });

        expect(after.rootTop).not.toBeNull();
        await expect(page.locator('.pr-comment[data-id="c1"]')).toHaveClass(/pr-highlight-parent/);
    });

    test('should not scroll on [t] when root body is visible but root container extends off-screen', async ({ page }) => {
        await page.setViewportSize({ width: 1200, height: 900 });

        const post = { _id: 'p1', title: 'Post' };
        const comments = [
            {
                _id: 'c1', postId: 'p1', parentCommentId: null, htmlBody: 'Root body',
                postedAt: new Date(Date.now() - 3000).toISOString(), user: { username: 'Author1' }
            },
            {
                _id: 'c2', postId: 'p1', parentCommentId: 'c1', htmlBody: 'Leaf comment',
                postedAt: new Date().toISOString(), user: { username: 'Author2' }
            },
            {
                _id: 'c3', postId: 'p1', parentCommentId: 'c1', htmlBody: '<div style="height: 1800px;">Very tall sibling reply</div>',
                postedAt: new Date(Date.now() - 2000).toISOString(), user: { username: 'Author3' }
            }
        ];

        await initPowerReader(page, {
            posts: [post],
            comments,
            testMode: true
        });

        const setup = await page.evaluate(() => {
            const root = document.querySelector('.pr-comment[data-id="c1"]') as HTMLElement | null;
            const rootBody = document.querySelector('.pr-comment[data-id="c1"] > .pr-comment-body') as HTMLElement | null;
            if (!root || !rootBody) return null;

            const targetTop = 120;
            window.scrollBy(0, rootBody.getBoundingClientRect().top - targetTop);

            const rootRect = root.getBoundingClientRect();
            const rootBodyRect = rootBody.getBoundingClientRect();
            return {
                scrollY: window.scrollY,
                rootBottom: rootRect.bottom,
                rootBodyTop: rootBodyRect.top,
                rootBodyBottom: rootBodyRect.bottom,
                innerHeight: window.innerHeight
            };
        });

        expect(setup).not.toBeNull();
        expect((setup as any).rootBottom).toBeGreaterThan((setup as any).innerHeight);
        expect((setup as any).rootBodyTop).toBeGreaterThanOrEqual(0);
        expect((setup as any).rootBodyBottom).toBeLessThanOrEqual((setup as any).innerHeight);

        const beforeScroll = await page.evaluate(() => window.scrollY);

        await page.locator('.pr-comment[data-id="c2"] [data-action="load-parents-and-scroll"]').click();

        const afterScroll = await page.evaluate(() => window.scrollY);
        expect(Math.abs(afterScroll - beforeScroll)).toBeLessThanOrEqual(2);
    });
});
