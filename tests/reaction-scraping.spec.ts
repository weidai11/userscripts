import { test, expect } from '@playwright/test';
import { setupMockEnvironment, getScriptContent } from './helpers/setup';

test.describe('Power Reader Reaction Scraping & Caching', () => {

    test('[PR-REACT-02] Reactions are cached in GM storage after scrape', async ({ page }) => {
        const scriptContent = getScriptContent();

        // 1. Setup Mock Environment with script in head to be found by scraper
        // We set scrapedReactions: null to force a live scrape
        await setupMockEnvironment(page, {
            scrapedReactions: null,
            mockHtml: '<html><head><script src="https://www.lesswrong.com/_next/static/chunks/main-bundle.js"></script></head><body><div id="power-reader-root"></div><div id="lw-power-reader-ready-signal" style="display:none"></div></body></html>'
        });

        // 2. Mock the specific bundle for scraping with EXACT patterns expected by parser
        // Needs > 20 matches AND 'agree' AND 'insightful'
        await page.route('**/main-bundle.js', route => {
            let body = 'var r = [';
            body += '{name:"agree",label:"Agreed",svg:"/a.svg"},';
            body += '{name:"insightful",label:"Insightful",svg:"/i.svg"},';
            for (let i = 0; i < 25; i++) {
                body += `{name:"r${i}",label:"L${i}",svg:"/s.svg"},`;
            }
            body += '];';
            body += ' var s = { gridPrimary:["agree","insightful"], gridSectionB:["r1"], gridSectionC:["r2"] }; ';

            route.fulfill({
                status: 200,
                contentType: 'application/javascript',
                body: body
            });
        });

        await page.goto('https://www.lesswrong.com/reader', { waitUntil: 'domcontentloaded' });

        // Ensure GM_setValue is tracked
        await page.addInitScript(() => {
            (window as any).stop = () => { };
        });

        await page.evaluate(scriptContent);
        await page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached', timeout: 15000 });

        // Verify it's in GM storage
        const cached = await page.evaluate(() => (window as any).GM_getValue('power-reader-scraped-reactions', null));
        expect(cached).not.toBeNull();

        const data = JSON.parse(cached);
        expect(data.reactions).toBeDefined();
        const reactions = data.reactions;
        expect(reactions.find((r: any) => r.name === 'agree')).toBeDefined();
        expect(reactions.length).toBeGreaterThan(20);
    });
});