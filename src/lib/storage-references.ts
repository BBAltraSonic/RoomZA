/** Storage object references must stay inside the account's literal namespace. */
export function isOwnedStoragePath(path: unknown, ownerId: string): path is string {
  if (typeof path !== "string" || !ownerId) return false;
  const segments = path.split("/");
  return segments.length > 1 && segments[0] === ownerId
    && segments.every(segment => segment !== "" && segment !== "." && segment !== "..")
    && !/[%\\?#\u0000-\u001f\u007f]/.test(path);
}
