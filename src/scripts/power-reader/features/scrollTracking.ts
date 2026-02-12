/**
 * Scroll tracking feature for Power Reader
 * Handles marking items as read when scrolled past
 */

import type { Comment } from '../../../shared/graphql/queries';
import { ReadTracker } from '../services/ReadTracker';
import { CONFIG } from '../config';

let readTracker: ReadTracker | null = null;

/**
 * Setup scroll tracking for read state
 */
export const setupScrollTracking = (
  commentsGetter: () => Comment[],
  postsGetter: () => { postedAt?: string, _id: string }[],
  initialBatchNewestDateGetter: () => string | null = () => null,
): void => {
  if (readTracker) {
    readTracker = null;
  }
  readTracker = new ReadTracker(CONFIG.scrollMarkDelay, commentsGetter, postsGetter, initialBatchNewestDateGetter);
  readTracker.init();
};

/**
 * Get the current read tracker instance
 */
export const getReadTracker = (): ReadTracker | null => readTracker;
