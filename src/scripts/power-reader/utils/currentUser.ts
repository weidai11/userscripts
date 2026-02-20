export interface CurrentUserIdentity {
  id: string | null;
  username: string | null;
}

export const getCurrentUserFromGlobals = (): CurrentUserIdentity => {
  const win = window as any;
  const user =
    win.LessWrong?.params?.currentUser
    || win.LessWrong?.currentUser
    || win.currentUser
    || win.__CURRENT_USER__
    || null;

  return {
    id: user?._id ?? null,
    username: user?.username ?? null,
  };
};
