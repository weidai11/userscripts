import { test, expect } from '@playwright/test';
import { PowerReaderPage } from './pages/PowerReaderPage';
import { setupMockEnvironment, getScriptContent, initPowerReader } from './helpers/setup';

test.describe('Author Info Features', () => {
    let scriptContent: string;

    test.beforeAll(() => {
        scriptContent = getScriptContent();
    });

    test('[PR-AUTH-03][PR-AUTH-04] Author should show full name and link to profile', async ({ page }) => {
        const comments = [
            {
                _id: 'c1',
                postId: 'p1',
                htmlBody: '<p>Test Comment</p>',
                postedAt: new Date().toISOString(),
                baseScore: 10,
                user: {
                    _id: 'u1',
                    username: 'shortname',
                    displayName: 'Full Author Name',
                    slug: 'full-author-name',
                    karma: 500
                },
                post: { _id: 'p1', title: 'Post 1' }
            }
        ];

        await initPowerReader(page, { comments });

        const authorLink = page.locator('.pr-comment[data-id="c1"] .pr-author');
        await expect(authorLink).toBeVisible();
        await expect(authorLink).toHaveText('Full Author Name');
        await expect(authorLink).toHaveAttribute('href', '/users/full-author-name');
        await expect(authorLink).toHaveAttribute('target', '_blank');
    });

    test('[PR-AUTH-04] Username fallback normalizes to slug-style profile URL when slug is missing', async ({ page }) => {
        const comments = [
            {
                _id: 'c-normalize-1',
                postId: 'p1',
                htmlBody: '<p>Test Comment</p>',
                postedAt: new Date().toISOString(),
                baseScore: 10,
                user: {
                    _id: 'u-wei',
                    username: 'Wei_Dai',
                    displayName: 'Wei Dai',
                    karma: 500
                },
                post: { _id: 'p1', title: 'Post 1' }
            }
        ];

        await initPowerReader(page, { comments });

        const authorLink = page.locator('.pr-comment[data-id="c-normalize-1"] .pr-author');
        await expect(authorLink).toBeVisible();
        await expect(authorLink).toHaveAttribute('href', '/users/wei-dai');
    });

    test('[PR-AUTH-10] Post metadata renders all coauthors for multi-author posts', async ({ page }) => {
        const posts = [
            {
                _id: 'p-multi-1',
                title: 'Multi-author test post',
                postedAt: new Date().toISOString(),
                user: {
                    _id: 'u-primary',
                    username: 'primary_author',
                    displayName: 'Primary Author',
                    slug: 'primary-author',
                    karma: 1000
                },
                coauthors: [
                    {
                        _id: 'u-co-1',
                        username: 'co_author_one',
                        displayName: 'Coauthor One',
                        slug: 'coauthor-one',
                        karma: 900
                    },
                    {
                        _id: 'u-co-2',
                        username: 'co_author_two',
                        displayName: 'Coauthor Two',
                        slug: 'coauthor-two',
                        karma: 800
                    }
                ]
            }
        ];

        await initPowerReader(page, { posts, comments: [] }, 'https://forum.effectivealtruism.org/reader');

        const postAuthors = page.locator('.pr-post[data-id="p-multi-1"] .pr-post-meta .pr-author');
        await expect(postAuthors).toHaveCount(3);
        await expect(postAuthors.nth(0)).toHaveText('Primary Author');
        await expect(postAuthors.nth(0)).toHaveAttribute('href', '/users/primary-author');
        await expect(postAuthors.nth(1)).toHaveText('Coauthor One');
        await expect(postAuthors.nth(1)).toHaveAttribute('href', '/users/coauthor-one');
        await expect(postAuthors.nth(2)).toHaveText('Coauthor Two');
        await expect(postAuthors.nth(2)).toHaveAttribute('href', '/users/coauthor-two');
    });

    test('[PR-AUTH-09] Author hover should show preview with bio', async ({ page }) => {
        const prPage = new PowerReaderPage(page);
        const comments = [
            {
                _id: 'c1',
                postId: 'p1',
                htmlBody: '<p>Test Comment</p>',
                postedAt: new Date().toISOString(),
                baseScore: 10,
                user: {
                    _id: 'u1',
                    username: 'testuser',
                    displayName: 'Test User Full',
                    slug: 'test-user',
                    karma: 1234,
                    htmlBio: '<p>This is my awesome bio.</p>'
                },
                post: { _id: 'p1', title: 'Post 1' }
            }
        ];

        await setupMockEnvironment(page, { comments });

        await page.addInitScript(() => {
            (window as any).__PR_TEST_MODE__ = true;
        });

        await page.goto('https://www.lesswrong.com/reader', { waitUntil: 'domcontentloaded' });
        await page.evaluate(scriptContent);
        await prPage.waitForReady();

        const authorLink = page.locator('.pr-comment[data-id="c1"] .pr-author');
        await expect(authorLink).toBeVisible();

        // Trigger hover
        await authorLink.hover();
        await authorLink.dispatchEvent('mouseenter');

        const preview = page.locator('.pr-preview-overlay.author-preview');
        await expect(preview).toBeVisible({ timeout: 10000 });
        await expect(preview).toContainText('Test User Full');
        await expect(preview).toContainText('1234 karma');
        await expect(preview).toContainText('This is my awesome bio.');
    });

    test('[PR-UARCH-13] Author hover preview includes archive link with slug/username', async ({ page }) => {
        const prPage = new PowerReaderPage(page);
        
        // Test with user that has a slug
        const commentsWithSlug = [
            {
                _id: 'c-slug-1',
                postId: 'p1',
                htmlBody: '<p>Test Comment</p>',
                postedAt: new Date().toISOString(),
                baseScore: 10,
                user: {
                    _id: 'u-slug-user',
                    username: 'johndoe123',
                    displayName: 'John Doe',
                    slug: 'john-doe',  // Has slug
                    karma: 999
                },
                post: { _id: 'p1', title: 'Post 1' }
            }
        ];

        await setupMockEnvironment(page, { comments: commentsWithSlug });

        await page.addInitScript(() => {
            (window as any).__PR_TEST_MODE__ = true;
        });

        await page.goto('https://www.lesswrong.com/reader', { waitUntil: 'domcontentloaded' });
        await page.evaluate(scriptContent);
        await prPage.waitForReady();

        // Hover over author to trigger preview
        const authorLink = page.locator('.pr-comment[data-id="c-slug-1"] .pr-author');
        await expect(authorLink).toBeVisible();
        await authorLink.hover();
        await authorLink.dispatchEvent('mouseenter');

        // Wait for preview and check archive link
        const preview = page.locator('.pr-preview-overlay.author-preview');
        await expect(preview).toBeVisible({ timeout: 10000 });
        
        // Archive link should use slug when available
        const archiveLink = preview.locator('.pr-archive-link');
        await expect(archiveLink).toBeVisible();
        await expect(archiveLink).toHaveAttribute('href', '/archive?username=john-doe');
        await expect(archiveLink).toContainText('Archive');
    });

    test('[PR-UARCH-13] Author preview archive link falls back to username when slug missing', async ({ page }) => {
        const prPage = new PowerReaderPage(page);
        
        // Test with user that has NO slug (fallback to username)
        const commentsWithoutSlug = [
            {
                _id: 'c-noslug-1',
                postId: 'p1',
                htmlBody: '<p>Test Comment</p>',
                postedAt: new Date().toISOString(),
                baseScore: 10,
                user: {
                    _id: 'u-noslug-user',
                    username: 'noslug_user',  // Only has username, no slug
                    displayName: 'No Slug User',
                    // No slug field
                    karma: 500
                },
                post: { _id: 'p1', title: 'Post 1' }
            }
        ];

        await setupMockEnvironment(page, { comments: commentsWithoutSlug });

        await page.addInitScript(() => {
            (window as any).__PR_TEST_MODE__ = true;
        });

        await page.goto('https://www.lesswrong.com/reader', { waitUntil: 'domcontentloaded' });
        await page.evaluate(scriptContent);
        await prPage.waitForReady();

        // Hover over author to trigger preview
        const authorLink = page.locator('.pr-comment[data-id="c-noslug-1"] .pr-author');
        await expect(authorLink).toBeVisible();
        await authorLink.hover();
        await authorLink.dispatchEvent('mouseenter');

        // Wait for preview and check archive link uses username as fallback
        const preview = page.locator('.pr-preview-overlay.author-preview');
        await expect(preview).toBeVisible({ timeout: 10000 });
        
        const archiveLink = preview.locator('.pr-archive-link');
        await expect(archiveLink).toBeVisible();
        await expect(archiveLink).toHaveAttribute('href', '/archive?username=noslug_user');
    });
});

