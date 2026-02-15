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
        await expect(archiveLink).toHaveAttribute('href', '/reader?view=archive&username=john-doe');
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
        await expect(archiveLink).toHaveAttribute('href', '/reader?view=archive&username=noslug_user');
    });
});
