
import { test, expect } from '@playwright/test';
import { initPowerReader } from './helpers/setup';

test.describe('Bug: Read Inheritance', () => {
    test('read parent comment should not color unread child comments', async ({ page }) => {
        const timestamp = new Date().toISOString();
        const posts = [
            { _id: 'p1', title: 'Post 1', htmlBody: 'Content 1', postedAt: timestamp }
        ];
        // p1 -> c1 -> c2
        // We need c2 to be a child of c1.
        // And we need to ensure the app loads them as such.
        // The mock environment mocks GraphQL responses using these arrays.
        const comments = [
            {
                _id: 'c1',
                postId: 'p1',
                htmlBody: 'Parent Body',
                postedAt: timestamp,
                baseScore: 10,
                user: { _id: 'u1', username: 'Author1' },
                post: { _id: 'p1', title: 'Post 1' },
                children: ['c2', 'c3'] // Some implementations might check this
            },
            {
                _id: 'c2',
                postId: 'p1',
                parentCommentId: 'c1',
                htmlBody: 'Child Body DO NOT COLOR',
                postedAt: timestamp,
                baseScore: 5,
                user: { _id: 'u2', username: 'Author2' },
                post: { _id: 'p1', title: 'Post 1' }
            },
            {
                _id: 'c3',
                postId: 'p1',
                parentCommentId: 'c1',
                htmlBody: 'Other Child Body',
                postedAt: timestamp,
                baseScore: 5,
                user: { _id: 'u3', username: 'Author3' },
                post: { _id: 'p1', title: 'Post 1' }
            }
        ];

        // Mark c1 as read in storage
        const readState = { 'c1': 1 };

        await initPowerReader(page, {
            testMode: true,
            posts,
            comments,
            storage: {
                'power-reader-read': JSON.stringify(readState)
            }
        });

        const parent = page.locator('.pr-comment[data-id="c1"]');
        const child = page.locator('.pr-comment[data-id="c2"]');

        // Parent should have class 'read'
        await expect(parent).toHaveClass(/read/);

        // Child should NOT have class 'read'
        await expect(child).not.toHaveClass(/read/);

        // Check computed style color
        // The read color is #707070 or rgb(112, 112, 112)

        // Wait for parent to appear
        await parent.waitFor({ state: 'attached', timeout: 5000 });

        const parentBody = page.locator('.pr-comment[data-id="c1"] > .pr-comment-body');

        // Wait for body to be visible
        await parentBody.waitFor({ state: 'visible', timeout: 5000 });

        const parentColor = await parentBody.evaluate((el) => {
            return window.getComputedStyle(el).color;
        });

        const childBody = page.locator('.pr-comment[data-id="c2"] > .pr-comment-body');

        // Wait for body to be visible
        await childBody.waitFor({ state: 'visible', timeout: 5000 });

        const childColor = await childBody.evaluate((el) => {
            return window.getComputedStyle(el).color;
        });

        console.log(`Parent Color: ${parentColor}`);
        console.log(`Child Color: ${childColor}`);

        // Parent should be gray (rgb(112, 112, 112))
        expect(parentColor).toBe('rgb(112, 112, 112)');

        // Child should NOT be gray. It should be black or default.
        // Default text color is likely #000 or near black.
        expect(childColor).not.toBe('rgb(112, 112, 112)');
    });
});
