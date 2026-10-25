/** Guest page gates run before layouts so nested destinations survive sign-in. */
export function isProtectedAccountPage(pathname: string) {
  return ["/post", "/dashboard", "/profile", "/settings", "/messages", "/admin", "/viewings"]
    .some(prefix => pathname === prefix || pathname.startsWith(prefix + "/")) ||
    ["/saved", "/applications", "/purchases", "/organization/invite", "/policy-acceptance", "/account-suspended"]
      .includes(pathname);
}
