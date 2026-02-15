
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Profile Injection [PR-INJECT-02]', () => {
    test.use({ viewport: { width: 375, height: 667 } }); // Use mobile viewport to ensure mobileProfileActions class is rendered normally (though it's also used on desktop)

    test('should inject ARCHIVE button into user profile page', async ({ page }) => {
        const username = 'wei-dai';

        // Mock the target profile page
        await page.route(`https://www.lesswrong.com/users/${username}`, async route => {
            await route.fulfill({
                contentType: 'text/html',
                body: `
                    <html>
                        <head></head>
                        <body>
                            <div class="ProfilePage-profileHeader">
                                <div class="ProfilePage-profileNameLink" href="/users/${username}">${username}</div>
                            </div>
                            <div class="ProfilePage-mobileProfileActions">
                                <button class="MuiButtonBase-root">Subscribe</button>
                                <button class="MuiButtonBase-root">Message</button>
                            </div>
                        </body>
                    </html>
                `
            });
        });

        // Mock the subsequent archive page navigation to verify link target without full reload
        // We aren't testing the archive itself, just the link click.

        const scriptPath = path.join(__dirname, '../dist/power-reader.user.js');
        const scriptContent = fs.readFileSync(scriptPath, 'utf8');

        // Go to profile page
        await page.goto(`https://www.lesswrong.com/users/${username}`);

        // Mock GM APIs
        await page.evaluate(() => {
            (window as any).GM_addStyle = (css: string) => {
                const style = document.createElement('style');
                style.textContent = css;
                document.head.appendChild(style);
            };
            (window as any).GM_getValue = () => null;
            (window as any).GM_setValue = () => { };
            (window as any).GM_log = () => { };
        });

        // Evaluate userscript
        await page.evaluate(scriptContent);

        // Verify button injection
        const button = page.locator('#pr-profile-archive-button');
        await expect(button).toBeVisible({ timeout: 5000 });
        await expect(button).toHaveText(/ARCHIVE/);
        await expect(button).toHaveAttribute('href', `/reader?view=archive&username=${username}`);

        // Verify style injection
        const styles = page.locator('#pr-profile-injection-styles');
        await expect(styles).toBeAttached();
    });

    test('should update button href when navigating between profiles (SPA simulation)', async ({ page }) => {
        const user1 = 'alice';
        const user2 = 'bob';

        // Mock routes for both users to ensure we can "navigate" effectively
        await page.route('**/users/*', async route => {
            const u = route.request().url().split('/').pop();
            await route.fulfill({
                contentType: 'text/html',
                body: `<html><body><div class="ProfilePage-mobileProfileActions"></div></body></html>`
            });
        });

        // Start at user 1
        await page.goto(`https://www.lesswrong.com/users/${user1}`);

        // Mock GM APIs
        await page.evaluate(() => {
            (window as any).GM_addStyle = () => { };
            (window as any).GM_getValue = () => null;
            (window as any).GM_setValue = () => { };
            (window as any).GM_log = () => { };
        });

        const scriptPath = path.join(__dirname, '../dist/power-reader.user.js');
        const scriptContent = fs.readFileSync(scriptPath, 'utf8');
        await page.evaluate(scriptContent);

        // Verify User 1 button
        const button = page.locator('#pr-profile-archive-button');
        await expect(button).toHaveAttribute('href', new RegExp(`username=${user1}`));

        // Simulate SPA navigation to User 2
        // We use pushState + a simulated DOM render which is how react apps work
        await page.evaluate((u) => {
            window.history.pushState({}, '', `/users/${u}`);
            // Force a re-render of the container to trigger the MutationObserver
            // We must replace the container to simulate React unmounting/mounting
            const oldContainer = document.querySelector('.ProfilePage-mobileProfileActions');
            if (oldContainer) oldContainer.remove();

            const newContainer = document.createElement('div');
            newContainer.className = 'ProfilePage-mobileProfileActions';
            document.body.appendChild(newContainer);
        }, user2);

        // Usage of new RegExp to be safe about encoding
        await expect(button).toHaveAttribute('href', new RegExp(`username=${user2}`), { timeout: 5000 });
    });

    test('supports /users/id/slug URL format [PR-INJECT-02]', async ({ page }) => {
        const userId = 'user-id-12345';
        const slug = 'john-doe';

        // Mock the profile page with /users/id/slug format
        await page.route(`https://www.lesswrong.com/users/${userId}/${slug}`, async route => {
            await route.fulfill({
                contentType: 'text/html',
                body: `
                    <html>
                        <head></head>
                        <body>
                            <div class="ProfilePage-profileHeader">
                                <div class="ProfilePage-profileNameLink">John Doe</div>
                            </div>
                            <div class="ProfilePage-mobileProfileActions">
                                <button class="MuiButtonBase-root">Subscribe</button>
                            </div>
                        </body>
                    </html>
                `
            });
        });

        const scriptPath = path.join(__dirname, '../dist/power-reader.user.js');
        const scriptContent = fs.readFileSync(scriptPath, 'utf8');

        // Navigate to /users/id/slug URL
        await page.goto(`https://www.lesswrong.com/users/${userId}/${slug}`);

        // Mock GM APIs
        await page.evaluate(() => {
            (window as any).GM_addStyle = (css: string) => {
                const style = document.createElement('style');
                style.textContent = css;
                document.head.appendChild(style);
            };
            (window as any).GM_getValue = () => null;
            (window as any).GM_setValue = () => { };
            (window as any).GM_log = () => { };
        });

        await page.evaluate(scriptContent);

        // Verify button is injected with slug as username
        const button = page.locator('#pr-profile-archive-button');
        await expect(button).toBeVisible({ timeout: 5000 });
        await expect(button).toHaveAttribute('href', `/reader?view=archive&username=${slug}`);
    });

    test('updates href without container remount on SPA navigation [PR-INJECT-03]', async ({ page }) => {
        const user1 = 'alice-spa';
        const user2 = 'bob-spa';

        // Mock routes for both users
        await page.route('**/users/*', async route => {
            await route.fulfill({
                contentType: 'text/html',
                body: `
                    <html>
                        <body>
                            <div class="ProfilePage-mobileProfileActions">
                                <button class="MuiButtonBase-root">Subscribe</button>
                            </div>
                        </body>
                    </html>
                `
            });
        });

        // Start at user 1
        await page.goto(`https://www.lesswrong.com/users/${user1}`);

        // Mock GM APIs
        await page.evaluate(() => {
            (window as any).GM_addStyle = () => { };
            (window as any).GM_getValue = () => null;
            (window as any).GM_setValue = () => { };
            (window as any).GM_log = () => { };
        });

        const scriptPath = path.join(__dirname, '../dist/power-reader.user.js');
        const scriptContent = fs.readFileSync(scriptPath, 'utf8');
        await page.evaluate(scriptContent);

        // Verify User 1 button
        const button = page.locator('#pr-profile-archive-button');
        await expect(button).toHaveAttribute('href', new RegExp(`username=${user1}`));

        // Simulate SPA navigation - URL change plus DOM mutation to trigger observer
        await page.evaluate((u) => {
            window.history.pushState({}, '', `/users/${u}`);
            // Add a mutation to trigger the observer (append and remove a dummy element)
            const container = document.querySelector('.ProfilePage-mobileProfileActions');
            if (container) {
                const dummy = document.createElement('span');
                dummy.id = 'spa-nav-trigger';
                container.appendChild(dummy);
                dummy.remove();
            }
        }, user2);

        // Wait for MutationObserver to detect the change using polling
        await expect(async () => {
            const href = await button.getAttribute('href');
            expect(href).toMatch(new RegExp(`username=${user2}`));
        }).toPass({ timeout: 5000 });
    });

    test('re-injects button after node removal on same profile [PR-INJECT-03]', async ({ page }) => {
        const username = 'persistent-user';

        // Mock the profile page
        await page.route(`https://www.lesswrong.com/users/${username}`, async route => {
            await route.fulfill({
                contentType: 'text/html',
                body: `
                    <html>
                        <head></head>
                        <body>
                            <div class="ProfilePage-profileHeader">
                                <div class="ProfilePage-profileNameLink">Persistent User</div>
                            </div>
                            <div class="ProfilePage-mobileProfileActions" id="action-container">
                                <button class="MuiButtonBase-root">Subscribe</button>
                            </div>
                        </body>
                    </html>
                `
            });
        });

        const scriptPath = path.join(__dirname, '../dist/power-reader.user.js');
        const scriptContent = fs.readFileSync(scriptPath, 'utf8');

        await page.goto(`https://www.lesswrong.com/users/${username}`);

        // Mock GM APIs
        await page.evaluate(() => {
            (window as any).GM_addStyle = (css: string) => {
                const style = document.createElement('style');
                style.textContent = css;
                document.head.appendChild(style);
            };
            (window as any).GM_getValue = () => null;
            (window as any).GM_setValue = () => { };
            (window as any).GM_log = () => { };
        });

        await page.evaluate(scriptContent);

        // Verify button is initially injected
        const button = page.locator('#pr-profile-archive-button');
        await expect(button).toBeVisible({ timeout: 5000 });
        await expect(button).toHaveAttribute('href', `/reader?view=archive&username=${username}`);

        // Simulate React re-render by removing and re-adding the entire container content
        // This mimics what happens when React re-renders the profile actions
        await page.evaluate(() => {
            const container = document.querySelector('.ProfilePage-mobileProfileActions');
            if (container) {
                // Clear the container (removes button and other elements)
                container.innerHTML = '<button class="MuiButtonBase-root">Subscribe</button>';
            }
        });

        // Wait for MutationObserver to detect the change and re-inject button
        await expect(page.locator('#pr-profile-archive-button')).toBeVisible({ timeout: 5000 });
        await expect(page.locator('#pr-profile-archive-button')).toHaveAttribute('href', `/reader?view=archive&username=${username}`);
    });
});
