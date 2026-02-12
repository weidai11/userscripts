import { test, expect } from '@playwright/test';
import { initPowerReader } from './helpers/setup';

test('sticky header displays metadata for posts discovered via comments', async ({ page }) => {
    await initPowerReader(page, {
        testMode: true,
        verbose: true,
        comments: [
            {
                _id: 'c1',
                postId: 'p1',
                pageUrl: 'https://www.lesswrong.com/posts/p1/post-1?commentId=c1',
                htmlBody: '<p>Comment 1</p>',
                postedAt: new Date().toISOString(),
                baseScore: 10,
                user: { _id: 'u1', username: 'User1', karma: 500 },
                post: {
                    _id: 'p1',
                    title: 'Post Title 1',
                    slug: 'post-1',
                    pageUrl: 'https://www.lesswrong.com/posts/p1/post-1',
                    postedAt: new Date().toISOString(),
                    baseScore: 123,
                    voteCount: 5,
                    user: { _id: 'u1', username: 'User1', karma: 500 }
                }
            }
        ]
    });

    // Forced height for post
    await page.addStyleTag({
        content: `
        .pr-post { height: 2000px !important; }
        #power-reader-root { min-height: 5000px !important; }
    `});

    await page.waitForSelector('.pr-post[data-id="p1"]');

    // Scroll to the post, then scroll 500px more to ensure header is hidden
    await page.evaluate(() => {
        const post = document.querySelector('.pr-post[data-id="p1"]') as HTMLElement;
        post.scrollIntoView({ block: 'start' });
        window.scrollBy(0, 500);
        window.dispatchEvent(new Event('scroll'));
    });

    // Debug in browser context
    const debugInfo = await page.evaluate(() => {
        const stickyHeader = document.getElementById('pr-sticky-header');
        const post = document.querySelector('.pr-post') as HTMLElement;
        const h = post?.querySelector('.pr-post-header') as HTMLElement;
        return {
            classes: stickyHeader?.className,
            postTop: post?.getBoundingClientRect().top,
            headerTop: h?.getBoundingClientRect().top,
            scrollY: window.scrollY
        };
    });

    if (process.env.PW_SINGLE_FILE_RUN === 'true') {
        console.log('DEBUG INFO:', JSON.stringify(debugInfo, null, 2));
    }

    const stickyHeader = page.locator('#pr-sticky-header');
    await expect(stickyHeader).toHaveClass(/visible/, { timeout: 10000 });

    const karmaScore = stickyHeader.locator('.pr-karma-score').first();
    await expect(karmaScore).toBeVisible();
    await expect(karmaScore).toHaveText('123');
});
