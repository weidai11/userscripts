/**
 * Router - Determines which mode to run based on host/path
 */

import { Logger } from './utils/logger';
import { handleAIStudio } from './utils/ai-studio-handler';

export type RouteResult = 
  | { type: 'reader'; path: 'main' | 'reset' }
  | { type: 'ai-studio' }
  | { type: 'skip' };

/**
 * Determine the appropriate route based on current URL
 */
export const getRoute = (): RouteResult => {
  const host = window.location.hostname;
  const pathname = window.location.pathname;

  // AI Studio domain
  if (host === 'aistudio.google.com') {
    // Only run on the main prompt page, skip frames like /app/_/bscframe
    if (!pathname.startsWith('/prompts')) {
      Logger.debug(`AI Studio Router: Skipping non-prompt path: ${pathname}`);
      return { type: 'skip' };
    }
    if (window.self !== window.top) {
      Logger.debug('AI Studio Router: Skipping iframe');
      return { type: 'skip' };
    }
    return { type: 'ai-studio' };
  }

  // LessWrong / EA Forum / GreaterWrong
  const isForumDomain = 
    host.includes('lesswrong.com') || 
    host.includes('forum.effectivealtruism.org') || 
    host.includes('greaterwrong.com');

  if (!isForumDomain) {
    return { type: 'skip' };
  }

  if (!pathname.startsWith('/reader')) {
    return { type: 'skip' };
  }

  // /reader/reset - clear state and show setup
  if (pathname === '/reader/reset') {
    return { type: 'reader', path: 'reset' };
  }

  // /reader - main reader
  return { type: 'reader', path: 'main' };
};

/**
 * Execute AI Studio mode
 */
export const runAIStudioMode = async (): Promise<void> => {
  Logger.info('AI Studio: Main domain detected, initializing automation...');
  await handleAIStudio();
};
