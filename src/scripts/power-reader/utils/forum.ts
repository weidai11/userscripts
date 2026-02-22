/**
 * Forum-specific metadata and utilities
 */

const normalizeHost = (hostname: string): string => hostname.trim().toLowerCase();

export const isEAForumHostname = (hostname: string): boolean => {
  const host = normalizeHost(hostname);
  return host === 'effectivealtruism.org' || host.endsWith('.effectivealtruism.org');
};

export const isLocalhostHostname = (hostname: string): boolean =>
  normalizeHost(hostname) === 'localhost';

export const isEAForumHost = (): boolean =>
  isEAForumHostname(window.location.hostname);

// Development mode may run on localhost while targeting EA behavior.
export const isEAForumLikeHost = (): boolean =>
  isEAForumHost() || isLocalhostHostname(window.location.hostname);

export const getForumMeta = (): { forumLabel: string; forumHomeUrl: string } => (
  isEAForumHost()
    ? { forumLabel: 'EA Forum', forumHomeUrl: 'https://forum.effectivealtruism.org/' }
    : { forumLabel: 'Less Wrong', forumHomeUrl: 'https://www.lesswrong.com/' }
);
