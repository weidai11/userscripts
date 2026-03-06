import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const scriptPath = path.resolve(__dirname, '../dist/power-reader.user.js');
const scriptContent = fs.readFileSync(scriptPath, 'utf8');

test.describe('Power Reader Architecture', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/*', route => {
      const url = route.request().url();
      if (url.includes('lesswrong.com') || url.includes('effectivealtruism.org')) {
        if (url.endsWith('/reader')) return route.continue();
        return route.abort();
      }
      return route.continue();
    });
  });

  test('[PR-ARCH-01][PR-ARCH-02][PR-ARCH-03] takeover halts native app and mounts power reader root', async ({ page }) => {
    await page.route('https://www.lesswrong.com/reader', route => {
      route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<html><body><div id="app">Native app</div><script>window.siteLoaded = true;</script></body></html>',
      });
    });

    await page.addInitScript(() => {
      (window as any).GM_getValue = () => '__LOAD_RECENT__';
      (window as any).GM_xmlhttpRequest = (o: any) => o.onload({ responseText: JSON.stringify({ data: {} }) });
    });

    await page.goto('https://www.lesswrong.com/reader');
    await page.evaluate(scriptContent);

    await expect(page.locator('#power-reader-root')).toBeVisible();
    await expect(page.locator('#app')).not.toBeAttached();
  });

  test('[PR-ARCH-04] takeover blocks dynamically injected scripts', async ({ page }) => {
    await page.route('https://www.lesswrong.com/reader', route => {
      route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body></body></html>' });
    });

    await page.addInitScript(() => {
      (window as any).GM_getValue = () => '__LOAD_RECENT__';
      (window as any).GM_xmlhttpRequest = (o: any) => o.onload({ responseText: JSON.stringify({ data: {} }) });
    });

    await page.goto('https://www.lesswrong.com/reader');
    await page.evaluate(scriptContent);

    const scriptExecutionAttempted = await page.evaluate(() => {
      const s = document.createElement('script');
      s.textContent = 'window.__INJECTED_SCRIPT_RAN__ = true;';
      document.body.appendChild(s);
      return (window as any).__INJECTED_SCRIPT_RAN__ === true;
    });

    expect(scriptExecutionAttempted).toBe(false);
    await expect(page.locator('script')).toHaveCount(0);
  });

  test('[PR-ARCH-06] protection observer re-injects power reader root if cleared', async ({ page }) => {
    await page.route('https://www.lesswrong.com/reader', route => {
      route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body></body></html>' });
    });

    await page.addInitScript(() => {
      (window as any).GM_getValue = () => '__LOAD_RECENT__';
      (window as any).GM_xmlhttpRequest = (o: any) => o.onload({ responseText: JSON.stringify({ data: {} }) });
    });

    await page.goto('https://www.lesswrong.com/reader');
    await page.evaluate(scriptContent);
    await page.waitForSelector('#power-reader-root');

    await page.evaluate(() => {
      document.body.innerHTML = '<div id="native-content">Native restored</div>';
    });

    await expect(page.locator('#power-reader-root')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#native-content')).not.toBeAttached();
  });

  test('[PR-TECH-01][PR-SYNC-03][PR-PERSIST-80] built userscript contains required metadata block', () => {
    expect(scriptContent).toContain('// ==UserScript==');
    expect(scriptContent).toMatch(/\/\/ @name\s+LW Power Reader/);
    expect(scriptContent).toMatch(/\/\/ @grant\s+GM_xmlhttpRequest/);
    expect(scriptContent).toMatch(/\/\/ @connect\s+lesswrong\.com/);
    expect(scriptContent).toMatch(/\/\/ @connect\s+firestore\.googleapis\.com/);
    expect(scriptContent).toContain('// ==/UserScript==');

    const headerIndex = scriptContent.indexOf('// ==UserScript==');
    expect(headerIndex).toBeGreaterThanOrEqual(0);
    expect(headerIndex).toBeLessThan(500);
  });

  test('[PR-DEV-01] automated codegen utility exists', () => {
    const codegenPath = path.resolve(__dirname, '../tooling/maybe-codegen.js');
    expect(fs.existsSync(codegenPath)).toBe(true);
  });

  test('Firestore deployment artifacts exist for sync rules/index overrides', () => {
    expect(fs.existsSync(path.resolve(__dirname, '../firestore.rules'))).toBe(true);
    expect(fs.existsSync(path.resolve(__dirname, '../firestore.indexes.json'))).toBe(true);
    expect(fs.existsSync(path.resolve(__dirname, '../firebase.json'))).toBe(true);
  });

});
