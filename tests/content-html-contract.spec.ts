import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const readRepoFile = (relativePath: string): string =>
  fs.readFileSync(path.resolve(__dirname, '..', relativePath), 'utf8');

test.describe('Content HTML Contracts', () => {
  test('[PR-DATA-06][PR-DATA-06.1] spec trust contract explicitly includes htmlBody/htmlBio/htmlHighlight', async () => {
    const spec = readRepoFile('src/scripts/power-reader/SPEC.md');
    expect(spec).toContain('htmlBody');
    expect(spec).toContain('htmlBio');
    expect(spec).toContain('htmlHighlight');
    expect(spec).toContain('Direct API HTML Rendering');
  });

  test('[PR-DATA-06.1] quote highlighter skips style/script-like nodes', async () => {
    const body = readRepoFile('src/scripts/power-reader/render/components/body.ts');
    expect(body).toContain("closest('style, script, noscript, template')");
  });

  test('[PR-PERSIST-13] debug summary cycle guard includes WeakSet tracking', async () => {
    const sync = readRepoFile('src/scripts/power-reader/persistence/persistenceSync.ts');
    expect(sync).toContain('new WeakSet<object>()');
    expect(sync).toContain("if (seenSet.has(objectValue)) return '[circular]';");
  });
});
