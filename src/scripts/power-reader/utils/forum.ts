/**
 * Forum-specific metadata and utilities
 */

const normalizeHost = (hostname: string): string => hostname.trim().toLowerCase();
const EA_FORUM_HOST = 'forum.effectivealtruism.org';
const GREATER_WRONG_HOST = 'greaterwrong.com';

export const isEAForumHostname = (hostname: string): boolean => {
  const host = normalizeHost(hostname);
  return host === EA_FORUM_HOST
    || host.endsWith(`.${EA_FORUM_HOST}`)
    // GreaterWrong's EA Forum viewer serves EA content (legacy EAF API, EA storage namespace).
    || host === 'ea.greaterwrong.com'
    || host.endsWith('.ea.greaterwrong.com');
};

export const isGreaterWrongHostname = (hostname: string): boolean => {
  const host = normalizeHost(hostname);
  return host === GREATER_WRONG_HOST || host.endsWith(`.${GREATER_WRONG_HOST}`);
};

export const isLocalhostHostname = (hostname: string): boolean =>
  normalizeHost(hostname) === 'localhost';

export const isEAForumHost = (): boolean =>
  isEAForumHostname(window.location.hostname);

export const isGreaterWrongHost = (): boolean =>
  isGreaterWrongHostname(window.location.hostname);

// Development mode may run on localhost while targeting EA behavior.
export const isEAForumLikeHost = (): boolean =>
  isEAForumHost() || isLocalhostHostname(window.location.hostname);

export const getForumMeta = (): { forumLabel: string; forumHomeUrl: string } => {
  if (isGreaterWrongHost()) {
    return isEAForumHostname(window.location.hostname)
      ? { forumLabel: 'EA Forum', forumHomeUrl: 'https://ea.greaterwrong.com/' }
      : { forumLabel: 'Greater Wrong', forumHomeUrl: 'https://www.greaterwrong.com/' };
  }
  if (isEAForumHost()) {
    return { forumLabel: 'EA Forum', forumHomeUrl: 'https://forum.effectivealtruism.org/' };
  }
  return { forumLabel: 'Less Wrong', forumHomeUrl: 'https://www.lesswrong.com/' };
};
