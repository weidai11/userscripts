import { expect, test } from '@playwright/test';
import { parseArchiveUrlState, writeArchiveUrlState } from '../src/scripts/power-reader/archive/search/urlState';

type WindowLike = {
  location: { search: string; pathname: string };
  history: { replaceState: (_state: object, _title: string, url: string) => void };
};

test.describe('archive url state', () => {
  test('write keeps sort=date explicit while omitting authored scope', () => {
    const globalRef = globalThis as typeof globalThis & { window?: WindowLike };
    const previousWindow = globalRef.window;
    let replacedUrl = '';
    const mockWindow: WindowLike = {
      location: { search: '?username=test-user', pathname: '/archive' },
      history: {
        replaceState: (_state, _title, url) => {
          replacedUrl = url;
        }
      }
    };
    globalRef.window = mockWindow;

    try {
      writeArchiveUrlState({
        query: 'alignment',
        scope: 'authored',
        sort: 'date'
      });
    } finally {
      if (previousWindow) {
        globalRef.window = previousWindow;
      } else {
        delete globalRef.window;
      }
    }

    expect(replacedUrl).toContain('q=alignment');
    expect(replacedUrl).toContain('sort=date');
    expect(replacedUrl).not.toContain('scope=');
  });

  test('parse defaults to date sort when URL has no sort parameter', () => {
    const globalRef = globalThis as typeof globalThis & { window?: WindowLike };
    const previousWindow = globalRef.window;
    const mockWindow: WindowLike = {
      location: { search: '?username=test-user&q=foo', pathname: '/archive' },
      history: {
        replaceState: () => { }
      }
    };
    globalRef.window = mockWindow;

    try {
      const state = parseArchiveUrlState();
      expect(state.query).toBe('foo');
      expect(state.scope).toBe('authored');
      expect(state.sort).toBe('date');
      expect(state.scopeFromUrl).toBe(false);
    } finally {
      if (previousWindow) {
        globalRef.window = previousWindow;
      } else {
        delete globalRef.window;
      }
    }
  });
});

