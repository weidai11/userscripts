import { test, expect } from '@playwright/test';
import { initPowerReader } from './helpers/setup';

async function waitAtLeast(ms: number): Promise<void> {
    const start = Date.now();
    await expect.poll(() => Date.now() - start, { timeout: ms + 1000 }).toBeGreaterThanOrEqual(ms);
}

test.describe('Power Reader Parent Navigation', () => {

    test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: 1200, height: 800 });
    });

    test('[PR-NAV-01][PR-NAV-06][PR-NAV-07] Top-level comment navigates to Post Header', async ({ page }) => {
        const post = { _id: 'p1', title: 'Target Post', htmlBody: '<p>Body</p>', user: { username: 'Author' } };
        const comment = {
            _id: 'c1', postId: 'p1', htmlBody: '<p>Top Level</p>',
            postedAt: new Date().toISOString(), baseScore: 1,
            user: { _id: 'u1', username: 'User' },
            post: { _id: 'p1', title: 'Target Post' }, parentComment: null
        };

        await initPowerReader(page, {
            testMode: true,
            comments: [comment],
            posts: [post]
        });

        // Scroll down so post header is likely off screen or at least we can scroll back to it
        await page.evaluate(() => {
            const spacer = document.createElement('div');
            spacer.style.height = '2000px';
            document.body.appendChild(spacer);
            window.scrollTo(0, 500);
        });

        // Click [^]
        const btn = page.locator('.pr-find-parent').first();
        await btn.scrollIntoViewIfNeeded();
        await btn.click();

        // Expect Post Header to have highlight class
        const header = page.locator('.pr-post-header').first();
        await expect(header).toHaveClass(/pr-highlight-parent/);
    });

    test('[PR-NAV-03] Hover highlights fully visible parent (Post)', async ({ page }) => {
        const post = { _id: 'p1', title: 'Target Post', htmlBody: '<p>Short Body</p>', user: { username: 'Author' } };
        const comment = {
            _id: 'c1', postId: 'p1', htmlBody: '<p>Comment</p>',
            postedAt: new Date().toISOString(), baseScore: 1,
            user: { _id: 'u1', username: 'User' },
            post: { _id: 'p1', title: 'Target Post', htmlBody: '<p>Short Body</p>' }, parentComment: null
        };

        await initPowerReader(page, {
            testMode: true,
            storage: { 'helpCollapsed': true },
            comments: [comment],
            posts: [post]
        });

        const btn = page.locator('.pr-find-parent').first();
        const header = page.locator('.pr-post-header').first();

        // Ensure header is visible
        await expect(header).toBeVisible();

        // Trigger hover robustly
        const box = await btn.boundingBox();
        if (!box) throw new Error('No bounding box');
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await btn.dispatchEvent('mouseenter');

        // Should highlight
        await expect(header).toHaveClass(/pr-parent-hover/);

        // Wait for hover delay to ensure no preview appears
        await waitAtLeast(500);

        // Should NOT show preview popup
        const preview = page.locator('.pr-preview-overlay');
        await expect(preview).not.toBeVisible();
    });

    test('[PR-NAV-09] Parent comment is present and correctly linked', async ({ page }) => {
        const post = { _id: 'p1', title: 'Post', htmlBody: '<p>Body</p>', user: { username: 'Author' } };
        const parentComment = {
            _id: 'c1', postId: 'p1', htmlBody: '<div style="height: 2000px;">Huge Parent Comment</div>',
            postedAt: new Date().toISOString(), baseScore: 5,
            user: { _id: 'u1', username: 'ParentUser' },
            post: { _id: 'p1', title: 'Post' }, parentComment: null
        };
        const childComment = {
            _id: 'c2', postId: 'p1', htmlBody: '<p>Child Comment</p>',
            postedAt: new Date().toISOString(), baseScore: 1,
            user: { _id: 'u2', username: 'ChildUser' },
            post: { _id: 'p1', title: 'Post' }, parentComment: { _id: 'c1' },
            parentCommentId: 'c1'
        };

        await initPowerReader(page, {
            testMode: true,
            comments: [parentComment, childComment],
            posts: [post]
        });

        const btn = page.locator('.pr-comment[data-id="c2"] .pr-find-parent').first();
        await expect(btn).toBeVisible();

        const parentEl = page.locator('.pr-comment[data-id="c1"]').first();
        await expect(parentEl).toBeVisible();
        await expect(parentEl).toContainText('Huge Parent Comment');
    });

    test('[PR-NAV-06] Find-parent should not scroll when parent body is visible but descendants extend off-screen', async ({ page }) => {
        await page.setViewportSize({ width: 1200, height: 900 });

        const post = { _id: 'p1', title: 'Post', htmlBody: '<p>Body</p>', user: { username: 'Author' } };
        const parentComment = {
            _id: 'c1', postId: 'p1', htmlBody: '<p>Parent body is short and should stay in place</p>',
            postedAt: new Date(Date.now() - 60_000).toISOString(), baseScore: 10,
            user: { _id: 'u1', username: 'ParentUser' },
            post: { _id: 'p1', title: 'Post' }, parentComment: null
        };
        const focalChild = {
            _id: 'c2', postId: 'p1', htmlBody: '<p>Focal child</p>',
            postedAt: new Date(Date.now() - 30_000).toISOString(), baseScore: 100,
            user: { _id: 'u2', username: 'ChildUser' },
            post: { _id: 'p1', title: 'Post' }, parentComment: { _id: 'c1' }, parentCommentId: 'c1'
        };
        const tallSiblingBody = `<div>${Array.from({ length: 260 }, (_, i) => `Tall sibling line ${i + 1}`).join('<br>')}</div>`;
        const tallSibling = {
            _id: 'c3', postId: 'p1', htmlBody: tallSiblingBody,
            postedAt: new Date(Date.now() - 120_000).toISOString(), baseScore: 10,
            user: { _id: 'u3', username: 'SiblingUser' },
            post: { _id: 'p1', title: 'Post' }, parentComment: { _id: 'c1' }, parentCommentId: 'c1'
        };

        await initPowerReader(page, {
            testMode: true,
            comments: [parentComment, focalChild, tallSibling],
            posts: [post]
        });

        const setup = await page.evaluate(() => {
            const parent = document.querySelector('.pr-comment[data-id="c1"]') as HTMLElement | null;
            const parentBody = document.querySelector('.pr-comment[data-id="c1"] > .pr-comment-body') as HTMLElement | null;
            if (!parent || !parentBody) return null;
            const targetTop = 120;
            window.scrollBy(0, parentBody.getBoundingClientRect().top - targetTop);
            const parentRect = parent.getBoundingClientRect();
            const parentBodyRect = parentBody.getBoundingClientRect();
            return {
                scrollY: window.scrollY,
                parentBottom: parentRect.bottom,
                parentBodyTop: parentBodyRect.top,
                parentBodyBottom: parentBodyRect.bottom,
                innerHeight: window.innerHeight
            };
        });

        expect(setup).not.toBeNull();
        expect((setup as any).parentBottom).toBeGreaterThan((setup as any).innerHeight);
        expect((setup as any).parentBodyTop).toBeGreaterThanOrEqual(0);
        expect((setup as any).parentBodyBottom).toBeLessThanOrEqual((setup as any).innerHeight);

        const beforeScroll = await page.evaluate(() => window.scrollY);

        await page.locator('.pr-comment[data-id="c2"] [data-action="find-parent"]').click();

        const afterScroll = await page.evaluate(() => window.scrollY);
        expect(Math.abs(afterScroll - beforeScroll)).toBeLessThanOrEqual(2);
    });

    test('[PR-NAV-05] Hover highlights sticky post header even if scrolled', async ({ page }) => {
        const post = { _id: 'p1', title: 'Sticky Post', htmlBody: '<div style="height: 2000px;">Body</div>', user: { username: 'Author' } };
        const longBody = '<div style="height: 2000px;">Body</div>';
        const comment = {
            _id: 'c1', postId: 'p1', htmlBody: '<p>Child content</p>',
            postedAt: new Date().toISOString(), baseScore: 1,
            user: { _id: 'u1', username: 'User' },
            post: { _id: 'p1', title: 'Sticky Post', htmlBody: longBody }, parentComment: null
        };

        await initPowerReader(page, {
            testMode: true,
            comments: [comment],
            posts: [post]
        });

        const headerOrig = page.locator('.pr-post[data-id="p1"] .pr-post-header').first();
        await expect(headerOrig).toBeVisible();

        // Scroll so post header is just off-screen
        await page.evaluate(async () => {
            const body = document.querySelector('.pr-post-body-container') as HTMLElement;
            if (body) {
                body.style.height = '2000px';
                body.style.maxHeight = 'none';
            }
            const footer = document.createElement('div');
            footer.style.height = '5000px';
            document.body.appendChild(footer);

            window.scrollTo(0, 800); // Increased scroll to ensure header is definitely gone
            window.dispatchEvent(new Event('scroll'));
            await new Promise(r => setTimeout(r, 100));
            window.dispatchEvent(new Event('scroll'));
        });

        // Wait for scroll cooldown (300ms) in isIntentionalHover
        await waitAtLeast(400);

        // Debug info from browser
        const debugInfo = await page.evaluate(() => {
            const post = document.querySelector('.pr-post');
            const header = post?.querySelector('.pr-post-header');
            const postRect = post?.getBoundingClientRect();
            const headerRect = header?.getBoundingClientRect();
            const vh = window.innerHeight;
            return {
                postTop: postRect?.top,
                postBottom: postRect?.bottom,
                headerTop: headerRect?.top,
                scrollY: window.scrollY,
                vh
            };
        });
        if (process.env.PW_SINGLE_FILE_RUN === 'true') {
            console.log('DEBUG STICKY:', JSON.stringify(debugInfo, null, 2));
        }

        const sticky = page.locator('#pr-sticky-header');
        // Wait specifically for it to be visible and have the visible class
        await expect(sticky).toHaveClass(/visible/, { timeout: 15000 });

        const btn = page.locator('.pr-find-parent').first();
        const btnBox = await btn.boundingBox();
        if (btnBox) {
            await page.mouse.move(0, 0);
            await page.mouse.move(btnBox.x + btnBox.width / 2, btnBox.y + btnBox.height / 2);
            await btn.dispatchEvent('mouseenter');
        } else {
            await btn.hover();
        }

        const headerInSticky = sticky.locator('.pr-post-header').first();
        await expect(headerInSticky).toHaveClass(/pr-parent-hover/);

        await expect(page.locator('.pr-preview-overlay')).not.toBeVisible();
    });

    test('[PR-NAV-09] Hover shows preview for Post that is completely scrolled off-screen', async ({ page }) => {
        const longBody = '<div style="height: 1500px;">Long Content</div>';
        const post = { _id: 'p1', title: 'Target Post', htmlBody: longBody, user: { username: 'Author' } };
        const comment = {
            _id: 'c1', postId: 'p1', htmlBody: '<div style="margin-top: 3000px;">Bottom Comment</div>',
            postedAt: new Date().toISOString(), baseScore: 1,
            user: { _id: 'u1', username: 'User' },
            post: { _id: 'p1', title: 'Target Post', htmlBody: '<p>Body</p>' }, parentComment: null
        };

        await initPowerReader(page, {
            testMode: true,
            comments: [comment],
            posts: [post]
        });

        const btn = page.locator('.pr-find-parent').first();
        const header = page.locator('.pr-post[data-id="p1"] .pr-post-header').first();

        await btn.scrollIntoViewIfNeeded();
        await waitAtLeast(500);

        await expect.poll(async () => {
            const headerBox = await header.boundingBox();
            return headerBox ? headerBox.y + headerBox.height : Number.POSITIVE_INFINITY;
        }).toBeLessThan(0);

        // Hover
        await btn.hover();

        const preview = page.locator('.pr-preview-overlay');
        await expect(preview).toBeVisible();
        await expect(preview).toContainText('Target Post');
    });

    test('[PR-NAV-06][PR-NAV-06.1] Deep-loaded parent keeps focal comment stable when parent already fits viewport', async ({ page }) => {
        await page.setViewportSize({ width: 1200, height: 1400 });

        const childId = 'child-keep-position';
        const parentId = 'parent-keep-position';

        await initPowerReader(page, {
            testMode: true,
            comments: [
                {
                    _id: childId,
                    postId: 'p1',
                    htmlBody: '<p>Child comment that triggers deep parent load</p>',
                    postedAt: new Date().toISOString(),
                    baseScore: 5,
                    parentCommentId: parentId,
                    user: { _id: 'u2', username: 'ChildAuthor' },
                    post: { _id: 'p1', title: 'Post 1' }
                }
            ],
            onGraphQL: `
                if (query.includes('query GetComment')) {
                    return {
                        data: {
                            comment: {
                                result: {
                                    _id: '${parentId}',
                                    postId: 'p1',
                                    pageUrl: 'https://example.com/p-parent',
                                    htmlBody: '<p>Short parent content for viewport-fit test</p>',
                                    postedAt: new Date(Date.now() - 100000).toISOString(),
                                    baseScore: 20,
                                    parentCommentId: null,
                                    user: { _id: 'u1', username: 'ParentAuthor' },
                                    post: { _id: 'p1', title: 'Post 1' }
                                }
                            }
                        }
                    };
                }
            `
        });

        const childComment = page.locator(`.pr-comment[data-id="${childId}"]`);
        await expect(childComment).toBeVisible();

        await page.evaluate((id) => {
            const post = document.querySelector('.pr-post');
            if (post && !document.getElementById('pr-test-spacer')) {
                const spacer = document.createElement('div');
                spacer.id = 'pr-test-spacer';
                spacer.style.height = '700px';
                post.parentElement?.insertBefore(spacer, post);
            }

            const childEl = document.querySelector(`.pr-comment[data-id="${id}"]`) as HTMLElement | null;
            if (!childEl) return;
            const targetTop = Math.round(window.innerHeight * 0.8);
            const delta = childEl.getBoundingClientRect().top - targetTop;
            window.scrollBy(0, delta);
        }, childId);

        const before = await page.evaluate((id) => {
            const childEl = document.querySelector(`.pr-comment[data-id="${id}"]`) as HTMLElement | null;
            return {
                childTop: childEl ? childEl.getBoundingClientRect().top : null,
                scrollY: window.scrollY
            };
        }, childId);

        await childComment.locator('[data-action="find-parent"]').click();

        const parentComment = page.locator(`.pr-comment[data-id="${parentId}"]`);
        await expect(parentComment).toBeAttached();

        const after = await page.evaluate(({ childId, parentId }) => {
            const childEl = document.querySelector(`.pr-comment[data-id="${childId}"]`) as HTMLElement | null;
            const parentEl = document.querySelector(`.pr-comment[data-id="${parentId}"]`) as HTMLElement | null;
            const parentRect = parentEl?.getBoundingClientRect();
            const parentFullyVisible = !!parentRect && parentRect.top >= 0 && parentRect.bottom <= window.innerHeight;
            return {
                childTop: childEl ? childEl.getBoundingClientRect().top : null,
                scrollY: window.scrollY,
                parentFullyVisible
            };
        }, { childId, parentId });

        expect(before.childTop).not.toBeNull();
        expect(after.childTop).not.toBeNull();
        expect(after.parentFullyVisible).toBe(true);
        expect(Math.abs((after.childTop ?? 0) - (before.childTop ?? 0))).toBeLessThanOrEqual(100);
    });
});
