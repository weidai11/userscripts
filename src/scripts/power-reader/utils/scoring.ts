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
  cutoffDate?: string
): number {
  let hasUnread = !isRead;
  const initialScore = Number(baseScore) || 0;
  let maxKarma = isRead ? -Infinity : initialScore;

  // Search queue for BFS traversal of the tree
  const queue = [...children];
  let queueIndex = 0;

  // Track visited to prevent infinite loops (shouldn't happen in a tree but safe)
  const visited = new Set<string>([id]);

  while (queueIndex < queue.length) {
    const current = queue[queueIndex++]!;
    if (visited.has(current._id)) continue;
    visited.add(current._id);

    // Is it read? (Explicitly or implicitly)
    let currentIsRead = readState[current._id] === 1;
    // Check cutoff (ignore if sentinel value)
    if (!currentIsRead && cutoffDate && cutoffDate !== '__LOAD_RECENT__' && current.postedAt < cutoffDate) {
      currentIsRead = true;
    }

    if (!currentIsRead) {
      hasUnread = true;
      const score = Number(current.baseScore) || 0;
      if (score > maxKarma) {
        maxKarma = score;
      }
    }

    // Add descendants
    const descendants = childrenByParentId.get(current._id);
    if (descendants) {
      for (const d of descendants) {
        queue.push(d);
      }
    }
  }

  if (!hasUnread) {
    return -Infinity;
  }

  return maxKarma;
}
