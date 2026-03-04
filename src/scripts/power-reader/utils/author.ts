export type AuthorLike = {
  user?: { username?: string | null } | null;
  author?: string | null;
};

export const getAuthorHandle = (
  item: AuthorLike,
  fallback: string = 'Unknown Author'
): string => {
  const username = item.user?.username;
  if (typeof username === 'string' && username.trim().length > 0) return username;
  const author = item.author;
  if (typeof author === 'string' && author.trim().length > 0) return author;
  return fallback;
};
