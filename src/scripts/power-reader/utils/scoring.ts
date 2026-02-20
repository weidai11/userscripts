/**
 * Scoring and normalization utilities for Power Reader
 * Implements the karma/age-based scoring from old implementation
 */

import { getAuthorPreferences } from './storage';

/**
 * Calculate the age of a comment in hours
 */
export function getAgeInHours(postedAt: string): number {
  const posted = new Date(postedAt).getTime();
  const now = Date.now();
  return (now - posted) / (1000 * 60 * 60);
}

/**
 * Get expected points threshold based on age
 * Newer items are held to lower standards
 * Uses a smooth function: Base = 5 + 2 * sqrt(age_hours)
 * Posts use a multiplier (6.7x) to target ~100 points at 24h
 */
export function getExpectedPoints(ageHours: number, isPost: boolean = false): number {
  const base = 5 + 2 * Math.sqrt(ageHours);
  return isPost ? base * 6.7 : base;
}

/**
 * Calculate author's voting power from karma (LW algorithm)
 * Used as baseline for normalization
 */
export function getAuthorVotingPower(karma: number): number {
  return karma >= 1000 ? 2 : 1;
}

/**
 * Calculate normalized score for a comment (0-1 range, can exceed)
 * Based on karma, age, and author preference
 * Baseline is author's voting power (no color), higher gets progressively more pink
 */
export function calculateNormalizedScore(
  points: number,
  ageHours: number,
  authorName: string,
  authorKarma: number = 0,
  isPost: boolean = false
): number {
  const pub = getExpectedPoints(ageHours, isPost);
  const plb = getAuthorVotingPower(authorKarma);
  const authorPrefs = getAuthorPreferences();

  // Baseline is author's voting power
  // (points - plb) / (pub - plb) gives 0 at baseline, 1 at expected
  let normalized = (points - plb) / (pub - plb);

  if (authorPrefs[authorName]) {
    normalized += authorPrefs[authorName] * 0.52;
  }

  return normalized;
}

/**
 * Check if a comment should be auto-hidden based on score
 */
export function shouldAutoHide(normalizedScore: number): boolean {
  return normalizedScore < -0.51;
}

/**
 * Calculate font size multiplier based on karma (100% to 150%)
 * Posts: points=0 → 100%, points=100+ → 150%
 * Comments: points=0 → 100%, points=20+ → 150%
 */
export function getFontSizePercent(points: number, isPost: boolean = false): number {
  if (isPost) {
    const cappedPoints = Math.min(points, 200);
    return Math.round((cappedPoints / 200 + 1) * 100);
  } else {
    const cappedPoints = Math.min(points, 20);
    return Math.round((cappedPoints / 40 + 1) * 100);
  }
}

/**
 * Clamp normalized score to 0-1 range for color interpolation
 */
export function clampScore(normalized: number): number {
  return Math.max(0, Math.min(1, normalized));
}

/**
 * Calculate the Tree-Karma for an item (Post or Comment)
 * Tree-Karma is the max baseScore of all UNREAD items in the tree rooted at this item.
 * 
 * [PR-SORT-01]
 */
export function calculateTreeKarma(
  id: string,
  baseScore: number,
  isRead: boolean,
  children: any[], // Can be Comment[] or root comments for a post
  readState: Record<string, number>,
  childrenByParentId: Map<string, any[]>,
  cutoffDate?: string,
  treeKarmaCache?: Map<string, number>
): number {
  const cache = treeKarmaCache;
  const cached = cache?.get(id);
  if (cached !== undefined) return cached;

  const visited = new Set<string>();

  const computeNodeTreeKarma = (
    nodeId: string,
    nodeBaseScore: number,
    nodeIsRead: boolean,
    nodeChildren: any[] | undefined
  ): number => {
    const cachedValue = cache?.get(nodeId);
    if (cachedValue !== undefined) return cachedValue;
    if (visited.has(nodeId)) return -Infinity;

    visited.add(nodeId);
    let maxKarma = nodeIsRead ? -Infinity : (Number(nodeBaseScore) || 0);

    const descendants = nodeChildren ?? childrenByParentId.get(nodeId) ?? [];
    for (const child of descendants) {
      let childIsRead = readState[child._id] === 1;
      if (!childIsRead && cutoffDate && cutoffDate !== '__LOAD_RECENT__' && child.postedAt < cutoffDate) {
        childIsRead = true;
      }

      const childKarma = computeNodeTreeKarma(
        child._id,
        Number(child.baseScore) || 0,
        childIsRead,
        childrenByParentId.get(child._id)
      );
      if (childKarma > maxKarma) {
        maxKarma = childKarma;
      }
    }

    visited.delete(nodeId);
    cache?.set(nodeId, maxKarma);
    return maxKarma;
  };

  return computeNodeTreeKarma(id, baseScore, isRead, children);
}
