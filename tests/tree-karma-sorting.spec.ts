import { test, expect } from '@playwright/test';
import { PowerReaderPage } from './pages/PowerReaderPage';
import { initPowerReader } from './helpers/setup';

test.describe('Tree-Karma Sorting [PR-SORT-01][PR-SORT-02][PR-SORT-03]', () => {
    test('should sort posts by Tree-Karma descending', async ({ page }) => {
        const now = new Date();
        const hourAgo = new Date(now.getTime() - 3600000).toISOString();
        const twoHoursAgo = new Date(now.getTime() - 7200000).toISOString();

        const posts = [
            {
                _id: 'p1',
                title: 'Newer Low Karma',
                postedAt: hourAgo,
                baseScore: 10,
                user: { _id: 'u1', username: 'User1' }
            },
            {
                _id: 'p2',
                title: 'Older High Karma',
                postedAt: twoHoursAgo,
                baseScore: 100,
                user: { _id: 'u2', username: 'User2' }
            }
        ];

        const comments = [
            {
                _id: 'c1',
                postId: 'p1',
                baseScore: 5,
                postedAt: hourAgo,
                parentCommentId: null,
                user: { _id: 'u1', username: 'User1' },
                post: posts[0]
            },
            {
                _id: 'c2',
                postId: 'p2',
                baseScore: 50,
                postedAt: twoHoursAgo,
                parentCommentId: null,
                user: { _id: 'u2', username: 'User2' },
                post: posts[1]
            }
        ];

        await initPowerReader(page, {
            testMode: true,
            posts,
            comments
        });

        const prPage = new PowerReaderPage(page);
        await expect(prPage.posts.nth(0)).toContainText('Older High Karma');
        await expect(prPage.posts.nth(1)).toContainText('Newer Low Karma');
    });

    test('should prioritize posts with high-karma unread comments (Comment Surprise)', async ({ page }) => {
        const now = new Date();
        const hourAgo = new Date(now.getTime() - 3600000).toISOString();
        const twoHoursAgo = new Date(now.getTime() - 7200000).toISOString();

        const posts = [
            {
                _id: 'p1',
                title: 'High Karma Post',
                postedAt: hourAgo,
                baseScore: 50,
                user: { _id: 'u1', username: 'User1' }
            },
            {
                _id: 'p2',
                title: 'Low Karma Post with High Karma Comment',
                postedAt: twoHoursAgo,
                baseScore: 10,
                user: { _id: 'u2', username: 'User2' }
            }
        ];

        const comments = [
            {
                _id: 'c1',
                postId: 'p1',
                baseScore: 5,
                postedAt: hourAgo,
                parentCommentId: null,
                user: { _id: 'u1', username: 'User1' },
                post: posts[0]
            },
            {
                _id: 'c2',
                postId: 'p2',
                baseScore: 100, // This should pull p2 to the top
                postedAt: twoHoursAgo,
                parentCommentId: null,
                user: { _id: 'u2', username: 'User2' },
                post: posts[1]
            }
        ];

        await initPowerReader(page, {
            testMode: true,
            posts,
            comments
        });

        const prPage = new PowerReaderPage(page);
        await expect(prPage.posts.nth(0)).toContainText('Low Karma Post with High Karma Comment');
        await expect(prPage.posts.nth(1)).toContainText('High Karma Post');
    });

    test('should sort comments hierarchically by Tree-Karma', async ({ page }) => {
        const posts = [{ _id: 'p1', title: 'Post 1', baseScore: 10, postedAt: new Date().toISOString(), user: { username: 'U1' } }];
        const comments = [
            {
                _id: 'root-low',
                postId: 'p1',
                baseScore: 5,
                postedAt: new Date().toISOString(),
                parentCommentId: null,
                user: { username: 'U1' },
                post: posts[0]
            },
            {
                _id: 'root-high',
                postId: 'p1',
                baseScore: 50,
                postedAt: new Date(Date.now() - 1000).toISOString(), // Older
                parentCommentId: null,
                user: { username: 'U2' },
                post: posts[0]
            }
        ];

        await initPowerReader(page, {
            testMode: true,
            posts,
            comments
        });

        const prPage = new PowerReaderPage(page);
        const post = prPage.posts.first();
        const firstComment = post.locator('.pr-comment').first();
        const secondComment = post.locator('.pr-comment').nth(1);

        // root-high has 50 karma, root-low has 5 karma. root-high should be first.
        await expect(firstComment.locator('.pr-author')).toContainText('U2');
        await expect(secondComment.locator('.pr-author')).toContainText('U1');
    });

    test('should treat read items as -Infinity (lowest priority)', async ({ page }) => {
        const now = Date.now();
        const posts = [
            { _id: 'p-read', title: 'Read High Karma', baseScore: 1000, postedAt: new Date(now).toISOString(), user: { username: 'U1' } },
            { _id: 'p-unread', title: 'Unread Low Karma', baseScore: 10, postedAt: new Date(now).toISOString(), user: { username: 'U2' } }
        ];

        await initPowerReader(page, {
            testMode: true,
            posts,
            comments: [
                {
                    _id: 'c-low',
                    postId: 'p-read',
                    baseScore: -100, // Very low
                    postedAt: new Date(now - 10000).toISOString(),
                    parentCommentId: null,
                    user: { username: 'U1' },
                    post: posts[0]
                }
            ],
            storage: {
                'power-reader-read': JSON.stringify({ 'p-read': 1 })
            }
        });

        const prPage = new PowerReaderPage(page);
        await expect(prPage.posts).toHaveCount(2);
        await expect(prPage.posts.nth(0)).toContainText('Unread Low Karma');
        await expect(prPage.posts.nth(1)).toContainText('Read High Karma');
    });
    test('[PR-SORT-04] Stability Policy: voting does not cause immediate re-sort', async ({ page }) => {
        const posts = [
            { _id: 'p1', title: 'Post 1', htmlBody: 'P1 content', postedAt: new Date(Date.now() - 1000).toISOString() },
            { _id: 'p2', title: 'Post 2', htmlBody: 'P2 content', postedAt: new Date(Date.now() - 2000).toISOString() }
        ];
        // p1 is newer, so it should be first initially (both have same TK=0)

        await initPowerReader(page, {
            testMode: true,
            posts,
            comments: []
        });

        // Verify initial order
        let titles = await page.locator('.pr-post .pr-post-title').allTextContents();
        expect(titles[0]).toBe('Post 1');
        expect(titles[1]).toBe('Post 2');

        // Upvote p2 to give it higher karma
        // In theory, if we re-sorted, p2 would move to top.
        const p2VoteBtn = page.locator('.pr-post[data-id="p2"] [data-action="karma-up"]');
        await p2VoteBtn.click();

        // Ensure order remains stable for a short window after voting.
        const stableSince = Date.now();
        await expect.poll(async () => {
            const orderedTitles = await page.locator('.pr-post .pr-post-title').allTextContents();
            if (orderedTitles[0] !== 'Post 1' || orderedTitles[1] !== 'Post 2') return -1;
            return Date.now() - stableSince;
        }, { timeout: 1500 }).toBeGreaterThanOrEqual(500);

        // Verify order is UNCHANGED
        titles = await page.locator('.pr-post .pr-post-title').allTextContents();
        expect(titles[0]).toBe('Post 1');
        expect(titles[1]).toBe('Post 2');
    });
});
