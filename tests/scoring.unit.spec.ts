import { test, expect } from '@playwright/test';
import { getExpectedPoints, getFontSizePercent } from '../src/scripts/power-reader/utils/scoring';

test.describe('Scoring Logic', () => {
  test('getExpectedPoints follows smooth curve for comments', () => {
    // 5 + 2 * sqrt(age)
    expect(getExpectedPoints(0, false)).toBe(5);
    expect(getExpectedPoints(1, false)).toBe(7); // 5 + 2*1
    expect(getExpectedPoints(4, false)).toBe(9); // 5 + 2*2
    expect(getExpectedPoints(25, false)).toBe(15); // 5 + 2*5
  });

  test('getExpectedPoints applies multiplier for posts', () => {
    const baseComments = getExpectedPoints(4, false); // 9
    const expectedPost = 9 * 6.7; // ~60.3
    expect(getExpectedPoints(4, true)).toBe(expectedPost);

    // Check 24h target ~100
    // sqrt(24) = ~4.9. Base = 5 + 9.8 = 14.8. Post = 14.8 * 6.7 = 99.16
    const val = getExpectedPoints(24, true);
    expect(val).toBeGreaterThan(99);
    expect(val).toBeLessThan(100);
  });

  test('getFontSizePercent scales correctly for posts', () => {
    // 0 points -> 100%
    expect(getFontSizePercent(0, true)).toBe(100);
    // 100 points -> 150%
    expect(getFontSizePercent(100, true)).toBe(150);
    // 200 points -> 200%
    expect(getFontSizePercent(200, true)).toBe(200);
    // >200 points -> capped at 200%
    expect(getFontSizePercent(500, true)).toBe(200);
  });

  test('getFontSizePercent scales correctly for comments', () => {
    // 0 points -> 100%
    expect(getFontSizePercent(0, false)).toBe(100);
    // 20 points -> 150%
    expect(getFontSizePercent(20, false)).toBe(150);
    // >20 points -> capped at 150%
    expect(getFontSizePercent(50, false)).toBe(150);
  });
});
