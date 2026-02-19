import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import ts from 'typescript';
import { buildHighlightRegex, extractHighlightTerms } from '../src/scripts/power-reader/archive/search/highlight';

type ExtractSnippetFn = (text: string, maxLen: number, snippetTerms: readonly string[]) => string;
type RenderIndexItemFn = (item: any, options?: { snippetTerms?: readonly string[] }) => string;

let extractSnippet: ExtractSnippetFn;
let renderIndexItem: RenderIndexItemFn;
let browserHighlightModuleUrl: string;

test.describe('Archive Search Highlight Utilities', () => {
  test.beforeAll(async () => {
    (globalThis as any).window = (globalThis as any).window || {};
    const renderModule = await import('../src/scripts/power-reader/archive/render');
    extractSnippet = renderModule.extractSnippet;
    renderIndexItem = renderModule.renderIndexItem;

    const highlightPath = 'src/scripts/power-reader/archive/search/highlight.ts';
    const rawSource = await readFile(highlightPath, 'utf8');
    const sourceForBrowser = rawSource.replace(
      /^import\s+\{\s*parseStructuredQuery\s*\}\s+from\s+'\.\/parser';\r?\n/,
      'const parseStructuredQuery = () => ({ clauses: [] });\n'
    );
    const transpiled = ts.transpileModule(sourceForBrowser, {
      compilerOptions: {
        module: ts.ModuleKind.ES2020,
        target: ts.ScriptTarget.ES2020
      }
    });
    browserHighlightModuleUrl = `data:text/javascript;charset=utf-8,${encodeURIComponent(transpiled.outputText)}`;
  });

  test('extractHighlightTerms keeps positive text terms and phrases only', () => {
    const terms = extractHighlightTerms('alignment "alignment tax" -alignment type:post /align.*/i ab');

    expect(terms).toEqual(['alignment', 'alignment tax']);
  });

  test('extractHighlightTerms caps output term count', () => {
    const query = Array.from({ length: 30 }, (_, i) => `token${i}value`).join(' ');
    const terms = extractHighlightTerms(query);

    expect(terms).toHaveLength(20);
    expect(terms[0]).toBe('token0value');
  });

  test('extractSnippet centers around first matched term when available', () => {
    const text = `BEGINNING_SENTINEL ${'x '.repeat(80)}alignment tax ${'y '.repeat(80)}`;
    const snippet = extractSnippet(text, 90, ['alignment']);

    expect(snippet).toContain('alignment tax');
    expect(snippet).not.toContain('BEGINNING_SENTINEL');
    expect(snippet.startsWith('...')).toBeTruthy();
  });

  test('buildHighlightRegex matches punctuation-separated and apostrophe terms', () => {
    const regex = buildHighlightRegex(['ai safety', 'cant']);
    expect(regex).not.toBeNull();

    const text = "AI-safety is different from can't.";
    const matches = text.match(regex!);
    expect(matches).toEqual(['AI-safety', "can't"]);
  });

  test('extractSnippet falls back to head truncation when no match exists', () => {
    const snippet = extractSnippet('abcdefghij', 5, ['missing']);

    expect(snippet).toBe('abcde...');
  });

  test('extractSnippet centers around punctuation-separated term variants', () => {
    const terms = extractHighlightTerms('ai-safety');
    const text = `BEGINNING_SENTINEL ${'x '.repeat(80)}AI-safety is useful${'y '.repeat(80)}`;
    const snippet = extractSnippet(text, 90, terms);

    expect(snippet).toContain('AI-safety');
    expect(snippet).not.toContain('BEGINNING_SENTINEL');
  });

  test('extractSnippet centers around apostrophe variants', () => {
    const terms = extractHighlightTerms(`can't`);
    const text = `BEGINNING_SENTINEL ${'x '.repeat(80)}can't stop${'y '.repeat(80)}`;
    const snippet = extractSnippet(text, 90, terms);

    expect(snippet).toContain(`can't`);
    expect(snippet).not.toContain('BEGINNING_SENTINEL');
  });

  test('renderIndexItem uses snippet terms for comment body excerpts', () => {
    const body = `BEGINNING_SENTINEL ${'x '.repeat(80)}alignment tax ${'y '.repeat(80)}`;
    const comment = {
      _id: 'c-snippet',
      postedAt: '2025-01-01T00:00:00Z',
      baseScore: 3,
      htmlBody: `<p>${body}</p>`,
      parentComment: {
        _id: 'c-parent',
        user: { displayName: 'Parent User' }
      },
      post: null
    } as any;

    const html = renderIndexItem(comment, { snippetTerms: ['alignment'] });

    expect(html).toContain('alignment tax');
    expect(html).not.toContain('BEGINNING_SENTINEL');
  });

  test('highlightTermsInContainer inserts marks and removes them on clear', async ({ page }) => {
    await page.setContent(`
      <div id="root">
        Alpha and alpha appear here.
        <a href="#ignore">alpha inside link should not mark</a>
      </div>
    `);

    const markedCount = await page.evaluate(async ({ moduleUrl }) => {
      const module = await import(moduleUrl);
      const root = document.getElementById('root') as HTMLElement;
      module.highlightTermsInContainer(root, ['alpha']);
      return root.querySelectorAll('mark.pr-search-highlight').length;
    }, { moduleUrl: browserHighlightModuleUrl });

    expect(markedCount).toBe(2);
    await expect(page.locator('#root a mark.pr-search-highlight')).toHaveCount(0);

    const countsAfterRepeatAndClear = await page.evaluate(async ({ moduleUrl }) => {
      const module = await import(moduleUrl);
      const root = document.getElementById('root') as HTMLElement;

      module.highlightTermsInContainer(root, ['alpha']);
      const afterRepeat = root.querySelectorAll('mark.pr-search-highlight').length;

      module.highlightTermsInContainer(root, []);
      const afterClear = root.querySelectorAll('mark.pr-search-highlight').length;
      const signature = root.getAttribute('data-pr-highlighted-terms');

      return { afterRepeat, afterClear, signature };
    }, { moduleUrl: browserHighlightModuleUrl });

    expect(countsAfterRepeatAndClear.afterRepeat).toBe(2);
    expect(countsAfterRepeatAndClear.afterClear).toBe(0);
    expect(countsAfterRepeatAndClear.signature).toBe('');
  });
});
