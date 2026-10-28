/*
  FILE: tests/support/cookies.ts
  WHAT IT'S FOR: A pretend cookie jar for tests. In the real app, Next.js gives
  our code the visitor's cookies through `cookies()` from "next/headers". There
  is no visitor in a test, so tests/support/setup.ts swaps in this jar. A test
  can then "log in" by putting a bv_session cookie in it, or "log out" by emptying it.
  WHO USES IT: tests/support/setup.ts (to replace next/headers) and
  tests/support/db.ts (to log test users in and out).
  WHY THIS NAME: It's the cookie helper for tests. It ends in .ts because it shows nothing on screen.
*/

/* One cookie, in the shape the app's code reads: { name, value }. */
type CookieEntry = { name: string; value: string };

/* The cookies currently "in the browser", by name. */
const cookies = new Map<string, string>();

/*
  cookieJar: has the same methods the app calls on the real cookie store
  (get, set, delete, toString), plus clear() so each test can start empty.
*/
export const cookieJar = {
  /* get: one cookie by name, or undefined if it isn't there. */
  get(name: string): CookieEntry | undefined {
    const value = cookies.get(name);
    return value === undefined ? undefined : { name, value };
  },
  /* getAll: every cookie. */
  getAll(): CookieEntry[] {
    return [...cookies].map(([name, value]) => ({ name, value }));
  },
  /* set: saves a cookie. The app also passes options (httpOnly and so on); a test jar ignores them. */
  set(name: string, value: string): void {
    cookies.set(name, value);
  },
  /* delete: removes a cookie, like logging out. */
  delete(name: string): void {
    cookies.delete(name);
  },
  /* toString: all cookies as one "name=value; name=value" line (what lib/api/ownApi.ts forwards). */
  toString(): string {
    return [...cookies].map(([name, value]) => `${name}=${value}`).join("; ");
  },
  /* clear: empties the jar, so the next test starts logged out. */
  clear(): void {
    cookies.clear();
  },
};
