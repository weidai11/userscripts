/**
 * Sticky header feature for Power Reader
 */

import { StickyHeader } from '../components/StickyHeader';

let stickyHeader: StickyHeader | null = null;

/**
 * Setup the sticky header
 */
export const setupStickyHeader = (): void => {
  if (stickyHeader) return;
  stickyHeader = new StickyHeader();
  stickyHeader.init();
};

/**
 * Get the current sticky header instance
 */
export const getStickyHeader = (): StickyHeader | null => stickyHeader;
