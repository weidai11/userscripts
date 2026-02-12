import { test, expect } from '@playwright/test';
import { initPowerReader } from './helpers/setup';

test.describe('Power Reader External Links', () => {

    test.beforeEach(async ({ page }) => {
        await initPowerReader(page, {
            testMode: true,
            comments: [
                {
                    _id: 'c1',
                    postId: 'p1',
                    pageUrl: 'https://www.lesswrong.com/posts/p1/slug?commentId=c1',
                    htmlBody: `
                        <p>
                            External: <a href="https://google.com" id="ext-link">Google</a>
                            Internal Anchor: <a href="#target" id="anchor-link">Anchor</a>
                            Site Link: <a href="/posts/p2/other" id="site-link">Other Post</a>
                            Reader Link: <a href="/reader" id="reader-link">Reader</a>
                        </p>
                        <div id="target" style="margin-top: 1000px;">Target</div>
                    `,
                    postedAt: new Date().toISOString(),
                    baseScore: 50,
                    parentCommentId: null,
                    user: { _id: 'u1', username: 'Author' },
                    post: { _id: 'p1', title: 'Post 1', pageUrl: 'https://www.lesswrong.com/posts/p1/slug' }
                }
            ]
        });
    });

    test('[PR-LINK-01] External links open in new tab', async ({ page }) => {
        const extLink = page.locator('#ext-link').first();

        // Trigger click to let the listener run
        await extLink.dispatchEvent('click');

        await expect(extLink).toHaveAttribute('target', '_blank');
        await expect(extLink).toHaveAttribute('rel', 'noopener noreferrer');
    });

    test('[PR-LINK-01] Site links (not reader) open in new tab', async ({ page }) => {
        const siteLink = page.locator('#site-link').first();
        await siteLink.dispatchEvent('click');

        await expect(siteLink).toHaveAttribute('target', '_blank');
        await expect(siteLink).toHaveAttribute('rel', 'noopener noreferrer');
    });

    test('[PR-LINK-03] Reader links stay in same tab', async ({ page }) => {
        const targetAttr = await page.evaluate(() => {
            const link = document.getElementById('reader-link');
            if (!link) return 'LINK_NOT_FOUND';
            link.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            return link.getAttribute('target');
        });

        expect(targetAttr).toBeNull();
    });

    test('[PR-LINK-02] Internal anchors stay in same tab', async ({ page }) => {
        const anchorLink = page.locator('#anchor-link').first();
        await anchorLink.dispatchEvent('click');

        const target = await anchorLink.getAttribute('target');
        expect(target).toBeNull();
    });

    test('[PR-DATE-02] Timestamps link to original permalink in new tab', async ({ page }) => {
        // Specifically target the timestamp inside a comment to avoid post header timestamps
        const timestampLink = page.locator('.pr-comment .pr-timestamp a').first();
        await expect(timestampLink).toHaveAttribute('href', /commentId=c1/);

        // Ensure the link is clicked to trigger the external link handler
        await timestampLink.dispatchEvent('click');

        await expect(timestampLink).toHaveAttribute('target', '_blank');
    });
});
