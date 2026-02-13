import { test, expect } from '@playwright/test';
import { initPowerReader } from './helpers/setup';

test.describe('Power Reader Threading', () => {

    test('[PR-THREAD-01] Comments are grouped under their parent Post', async ({ page }) => {
        const posts = [
            { _id: 'post1', title: 'Post 1', postedAt: new Date().toISOString(), user: { username: 'U' } },
            { _id: 'post2', title: 'Post 2', postedAt: new Date().toISOString(), user: { username: 'U' } }
        ];
        const comments = [
            { _id: 'c1', postId: 'post1', postedAt: new Date().toISOString(), user: { username: 'U' }, post: { _id: 'post1' } },
            { _id: 'c2', postId: 'post2', postedAt: new Date().toISOString(), user: { username: 'U' }, post: { _id: 'post2' } },
            { _id: 'c3', postId: 'post1', postedAt: new Date().toISOString(), user: { username: 'U' }, post: { _id: 'post1' } }
        ];

        await initPowerReader(page, {
            testMode: true,
            posts,
            comments
        });

        // Check grouping
        const post1 = page.locator('.pr-post[data-id="post1"]');
        const post2 = page.locator('.pr-post[data-id="post2"]');

        await expect(post1.locator('.pr-comment')).toHaveCount(2);
        await expect(post2.locator('.pr-comment')).toHaveCount(1);
    });

    test('[PR-NEST-04] Missing parent renders as empty read placeholder', async ({ page }) => {
        const comments = [
            {
                _id: 'child-1',
                postId: 'post1',
                postedAt: new Date().toISOString(),
                htmlBody: '<p>Child with missing parent</p>',
                parentCommentId: 'missing-parent',
                user: { username: 'U' },
                post: { _id: 'post1', title: 'Post 1' }
            }
        ];

        await initPowerReader(page, {
            testMode: true,
            comments
        });

        const placeholder = page.locator('.pr-comment[data-id="missing-parent"][data-placeholder="1"]');
        await expect(placeholder).toBeAttached();
        await expect(placeholder).toHaveClass(/read/);
        await expect(placeholder).toHaveClass(/pr-missing-parent/);
        // The placeholder itself should have no direct meta/body (only nested children within .pr-replies)
        await expect(placeholder.locator('> .pr-comment-meta')).toHaveCount(0);
        await expect(placeholder.locator('> .pr-comment-body')).toHaveCount(0);

        // Child should be nested inside the placeholder's .pr-replies
        const child = placeholder.locator('.pr-replies .pr-comment[data-id="child-1"]');
        await expect(child).toBeAttached();
    });

    test('[PR-NEST-04.1] Multi-level missing parent chain preserves descendants', async ({ page }) => {
        const now = new Date().toISOString();
        const comments = [
            {
                _id: 'child-chain',
                postId: 'post1',
                postedAt: now,
                htmlBody: '<p>Leaf comment</p>',
                parentCommentId: 'missing-2',
                parentComment: {
                    _id: 'missing-2',
                    parentCommentId: 'missing-1',
                    parentComment: {
                        _id: 'missing-1',
                        parentCommentId: null
                    }
                },
                user: { username: 'U' },
                post: { _id: 'post1', title: 'Post 1' }
            }
        ];

        await initPowerReader(page, {
            testMode: true,
            comments
        });

        const placeholder1 = page.locator('.pr-comment[data-id="missing-1"][data-placeholder="1"]');
        const placeholder2 = placeholder1.locator('> .pr-replies > .pr-comment[data-id="missing-2"][data-placeholder="1"]');
        const child = placeholder2.locator('> .pr-replies > .pr-comment[data-id="child-chain"]');

        await expect(placeholder1).toBeAttached();
        await expect(placeholder2).toBeAttached();
        await expect(child).toBeAttached();
        await expect(child).toContainText('Leaf comment');
    });

    test('[PR-NEST-05] Thread structure nests correctly with placeholders and mixed depths', async ({ page }) => {
        const basePost = { _id: 'post1', title: 'Post 1' };
        const now = new Date().toISOString();

        await initPowerReader(page, {
            testMode: true,
            comments: [
                // Case A: fully loaded tree (parent -> children -> grandchild)
                { _id: 'parent-a', postId: 'post1', postedAt: now, user: { username: 'U' }, post: basePost },
                { _id: 'child-a1', postId: 'post1', postedAt: now, user: { username: 'U' }, post: basePost, parentCommentId: 'parent-a' },
                { _id: 'child-a2', postId: 'post1', postedAt: now, user: { username: 'U' }, post: basePost, parentCommentId: 'parent-a' },
                { _id: 'grand-a1', postId: 'post1', postedAt: now, user: { username: 'U' }, post: basePost, parentCommentId: 'child-a1' },

                // Case B: missing parent with multiple children + grandchild
                { _id: 'child-b1', postId: 'post1', postedAt: now, user: { username: 'U' }, post: basePost, parentCommentId: 'missing-b' },
                { _id: 'child-b2', postId: 'post1', postedAt: now, user: { username: 'U' }, post: basePost, parentCommentId: 'missing-b' },
                { _id: 'grand-b1', postId: 'post1', postedAt: now, user: { username: 'U' }, post: basePost, parentCommentId: 'child-b1' },

                // Case C: loaded parent with missing parent above it
                { _id: 'parent-c', postId: 'post1', postedAt: now, user: { username: 'U' }, post: basePost, parentCommentId: 'missing-c' },
                { _id: 'child-c1', postId: 'post1', postedAt: now, user: { username: 'U' }, post: basePost, parentCommentId: 'parent-c' }
            ]
        });

        // Case A assertions
        const parentAReplies = page.locator('.pr-comment[data-id="parent-a"] .pr-replies');
        await expect(parentAReplies.locator('.pr-comment[data-id="child-a1"]')).toBeAttached();
        await expect(parentAReplies.locator('.pr-comment[data-id="child-a2"]')).toBeAttached();

        const childA1Replies = parentAReplies.locator('.pr-comment[data-id="child-a1"] .pr-replies');
        await expect(childA1Replies.locator('.pr-comment[data-id="grand-a1"]')).toBeAttached();

        // Case B assertions
        const placeholderB = page.locator('.pr-comment[data-id="missing-b"][data-placeholder="1"]');
        await expect(placeholderB).toBeAttached();
        await expect(page.locator('.pr-comment[data-id="missing-b"][data-placeholder="1"]')).toHaveCount(1);

        const placeholderBReplies = placeholderB.locator('.pr-replies');
        await expect(placeholderBReplies.locator('.pr-comment[data-id="child-b1"]')).toBeAttached();
        await expect(placeholderBReplies.locator('.pr-comment[data-id="child-b2"]')).toBeAttached();

        const childB1Replies = placeholderBReplies.locator('.pr-comment[data-id="child-b1"] .pr-replies');
        await expect(childB1Replies.locator('.pr-comment[data-id="grand-b1"]')).toBeAttached();

        // Case C assertions
        const placeholderC = page.locator('.pr-comment[data-id="missing-c"][data-placeholder="1"]');
        await expect(placeholderC).toBeAttached();

        const placeholderCReplies = placeholderC.locator('.pr-replies');
        await expect(placeholderCReplies.locator('.pr-comment[data-id="parent-c"]')).toBeAttached();

        const parentCReplies = placeholderCReplies.locator('.pr-comment[data-id="parent-c"] .pr-replies');
        await expect(parentCReplies.locator('.pr-comment[data-id="child-c1"]')).toBeAttached();
    });
});
