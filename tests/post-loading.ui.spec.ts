import { test, expect } from '@playwright/test';
import { initPowerReader } from './helpers/setup';
import { PowerReaderPage } from './pages/PowerReaderPage';

test.describe('Power Reader Post Loading', () => {

    test('[PR-POST-04] should fetch and display posts with truncation and read-more', async ({ page }) => {
        const prPage = new PowerReaderPage(page);

        await initPowerReader(page, {
            testMode: true,
            comments: [{
                _id: 'comment-1',
                postId: 'post-1',
                htmlBody: '<p>Comment on post 1</p>',
                postedAt: '2024-01-01T01:00:00.000Z',
                baseScore: 5,
                user: { _id: 'u2', username: 'UserB', karma: 50 },
                post: {
                    _id: 'post-1',
                    title: 'Long Post Title',
                    slug: 'long-post',
                    pageUrl: 'https://www.lesswrong.com/posts/post-1',
                    postedAt: '2024-01-01T00:00:00.000Z',
                    baseScore: 100,
                    user: { _id: 'a1', username: 'AuthorA', karma: 1000 }
                }
            }],
            onGraphQL: `
                if (query.includes('GetNewPosts')) {
                    return {
                        data: {
                            posts: {
                                results: [{
                                    _id: 'post-1',
                                    title: 'Long Post Title',
                                    slug: 'long-post',
                                    pageUrl: 'https://www.lesswrong.com/posts/post-1',
                                    postedAt: '2024-01-01T00:00:00.000Z',
                                    baseScore: 100,
                                    htmlBody: '<div style="height: 2000px;">Very long post content...</div>',
                                    user: { _id: 'a1', username: 'AuthorA', karma: 1000 }
                                }]
                            }
                        }
                    };
                }
            `
        });

        const postHeader = page.locator('.pr-post-header');
        await expect(postHeader).toBeVisible();
        await expect(postHeader).toContainText('Long Post Title');

        const bodyContainer = page.locator('.pr-post-body-container');
        await expect(bodyContainer).toHaveClass(/truncated/);

        const readMoreBtn = page.locator('[data-action="read-more"]');
        await expect(readMoreBtn).toBeVisible();

        await readMoreBtn.click();
        await expect(bodyContainer).not.toHaveClass(/truncated/);
        await expect(readMoreBtn).not.toBeVisible();
    });

    test('[PR-POST-06][PR-POST-07][PR-POST-08] should mark posts as read on scroll', async ({ page }) => {
        const prPage = new PowerReaderPage(page);

        await initPowerReader(page, {
            testMode: true,
            onGraphQL: `
                if (query.includes('GetNewPosts')) {
                    return {
                        data: {
                            posts: {
                                results: [{
                                    _id: 'post-read-test',
                                    title: 'Read Test Post',
                                    slug: 'read-test',
                                    pageUrl: 'https://www.lesswrong.com/posts/post-read-test',
                                    postedAt: '${new Date().toISOString()}',
                                    htmlBody: '<p>Short content</p>',
                                    user: { _id: 'a1', username: 'A', karma: 100 }
                                }]
                            }
                        }
                    };
                }
            `
        });

        const post = page.locator('.pr-post.pr-item[data-id="post-read-test"]');
        await expect(post).toBeVisible();
        await expect(post).not.toHaveClass(/read/);

        // Scroll past the post
        await page.evaluate(() => window.scrollTo(0, 2000));

        // Wait for ReadTracker delay (500ms in testMode)
        await expect(post).toHaveClass(/read/, { timeout: 7000 });

        const body = post.locator('.pr-post-body-container');
        await expect(body).toHaveCSS('opacity', '0.8');
    });

    test('[PR-GQL-03] should use range-bound fetching on initial load', async ({ page }) => {
        const calls: string[] = [];
        page.on('console', msg => {
            if (msg.text().includes('GetNewPosts')) calls.push(msg.text());
        });

        await initPowerReader(page, {
            testMode: true,
            verbose: true,
            comments: [
                { _id: 'c1', postedAt: '2024-01-05T00:00:00.000Z', htmlBody: '', user: { _id: 'u1' }, post: { _id: 'p1', title: 'T', user: { username: 'A' }, baseScore: 0, pageUrl: 'u', postedAt: '2024-01-01T00:00:00.000Z' } },
                { _id: 'c2', postedAt: '2024-01-01T00:00:00.000Z', htmlBody: '', user: { _id: 'u1' }, post: { _id: 'p1', title: 'T', user: { username: 'A' }, baseScore: 0, pageUrl: 'u', postedAt: '2024-01-01T00:00:00.000Z' } }
            ]
        });

        expect(calls.length).toBeGreaterThan(0);
        // Should use oldest comment date (2024-01-01T00:00:00.000Z) as after
        expect(calls[0]).toContain('"after":"2024-01-01T00:00:00.000Z"');
    });

    test('[PR-POST-01][PR-POST-02][PR-POST-06] should show unified metadata with score but NO buttons for header-only posts', async ({ page }) => {
        await initPowerReader(page, {
            testMode: true,
            comments: [{
                _id: 'c1',
                postId: 'p1',
                htmlBody: 'comment',
                postedAt: '2024-01-01T00:00:00.000Z',
                post: {
                    _id: 'p1',
                    title: 'Header Only Post',
                    user: { username: 'AuthorH', karma: 50 },
                    baseScore: 123,
                    pageUrl: 'https://www.lesswrong.com/posts/p1',
                    postedAt: '2024-01-01T00:00:00.000Z'
                }
            }]
        });

        const postMeta = page.locator('.pr-post-meta');
        await expect(postMeta).toBeVisible();
        await expect(postMeta).toContainText('AuthorH');

        // Score should be visible
        const karmaScore = postMeta.locator('.pr-karma-score');
        await expect(karmaScore).toBeVisible();
        await expect(karmaScore).toHaveText('123');

        // Upvote/Downvote buttons should NOT be present (conditional logic in renderVoteButtons)
        await expect(postMeta.locator('[data-action="karma-up"]')).toHaveCount(0);
        await expect(postMeta.locator('[data-action="karma-down"]')).toHaveCount(0);

        // Title is now a span, not a link
        const titleSpan = page.locator('.pr-post-header .pr-post-title');
        await expect(titleSpan).toBeVisible();
        await expect(titleSpan).toContainText('Header Only Post');

        // [e] button should be visible
        const expandBtn = page.locator('[data-action="toggle-post-body"]');
        await expect(expandBtn).toHaveText('[e]');
    });

    test('[PR-POST-03] clicking header scrolls to post top (not load)', async ({ page }) => {
        await initPowerReader(page, {
            testMode: true,
            comments: [{
                _id: 'c1', postId: 'p1', htmlBody: '<div style="height:2000px">c</div>', postedAt: '2024-01-01T00:00:00.000Z',
                post: { _id: 'p1', title: 'Scroll Test Post', user: { username: 'A' }, pageUrl: 'url', postedAt: '2024-01-01T00:00:00.000Z' }
            }]
        });

        // Ensure page is tall enough to scroll
        await page.evaluate(() => document.body.style.minHeight = '3000px');

        // Scroll away from the post header
        await page.evaluate(() => window.scrollTo(0, 500));
        await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThanOrEqual(500);

        const postHeader = page.locator('.pr-post-header').first();
        await postHeader.click();

        // Should scroll to the post header (near top)
        await expect.poll(async () => {
            const headerTop = await page.evaluate(() =>
                document.querySelector('.pr-post-header')?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY
            );
            return headerTop;
        }).toBeLessThan(100);
    });

    test('[PR-POSTBTN-01] [e] button loads post body when missing and expands it', async ({ page }) => {
        await initPowerReader(page, {
            testMode: true,
            comments: [{
                _id: 'c1', postId: 'p1', htmlBody: 'comment text', postedAt: '2024-01-01T00:00:00.000Z',
                post: { _id: 'p1', title: 'Load Test Post', user: { username: 'A' }, pageUrl: 'url', postedAt: '2024-01-01T00:00:00.000Z' }
            }],
            onGraphQL: `
                if (query.includes('GetPost')) {
                    if (!variables.id) throw new Error('GetPost called without id variable');
                    return { data: { post: { result: {
                        _id: 'p1', title: 'Load Test Post', htmlBody: '<p>Dynamically Loaded Post Body</p>',
                        user: { username: 'A', karma: 10 }, baseScore: 5, pageUrl: 'url',
                        postedAt: '2024-01-01T00:00:00.000Z'
                    } } } };
                }
            `
        });

        // Verify post body is not visible yet
        const postBody = page.locator('.pr-post-body-container');
        await expect(postBody).not.toBeVisible();

        // Click the [e] button
        const expandBtn = page.locator('[data-action="toggle-post-body"]');
        await expandBtn.click();

        // Post body should now be visible with loaded content
        await expect(postBody).toBeVisible({ timeout: 10000 });
        await expect(postBody).toContainText('Dynamically Loaded Post Body');
    });
});
