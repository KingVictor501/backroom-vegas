/*
  FILE: lib/auth/session.ts
  WHAT IT'S FOR: Puts the login token into a cookie, reads it back, and deletes
  it. A "cookie" is a small note the browser stores and sends back with every
  request, which is how the app remembers you're logged in for 7 days.
  WHO USES IT: app/actions/auth.ts (log in, sign up, log out),
  app/logout/route.ts, and lib/auth/dal.ts (to find out who's logged in).
  WHY THIS NAME: A "session" is the time between logging in and logging out. It
  ends in .ts because it shows nothing on screen.
*/

// Keeps this file on the server only. Cookies with login info are never touched by browser code.
import "server-only";
// cookies(): Next.js's way to read and write cookies on the server.
import { cookies } from "next/headers";
// The token helpers and the cookie settings from lib/auth/token.ts.
import {
  createSessionToken,
  readSessionToken,
  SESSION_COOKIE_NAME,
  SESSION_DURATION_SECONDS,
} from "./token";

/*
  createSession: logs a user in by saving a signed token in a secure cookie.
  The cookie settings are the security part:
  - httpOnly: JavaScript in the browser can't read the cookie, so even if a bad
    script got onto a page (XSS), it couldn't steal the login.
  - secure: the cookie is only sent over https (encrypted). It's turned off on
    localhost, which uses plain http, or logging in wouldn't work while building.
  - sameSite "lax": other websites can't make your browser send this cookie with
    their form submissions. This blocks "CSRF" tricks.
  - maxAge: the browser deletes it after 7 days.
  - path "/": the cookie works on every page of the app.
*/
export async function createSession(userId: string): Promise<void> {
  const token = await createSessionToken(userId);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_DURATION_SECONDS,
    path: "/",
  });
}

/*
  getSession: who is logged in? Gives back { userId } or null if nobody (or the
  cookie is fake or expired). null is missing on purpose: it means "logged out".
*/
export async function getSession(): Promise<{ userId: string } | null> {
  const cookieStore = await cookies();
  return readSessionToken(cookieStore.get(SESSION_COOKIE_NAME)?.value);
}

/*
  deleteSession: logs out by deleting the cookie.
  Only works inside a Server Action or a route (Next.js doesn't allow changing
  cookies while a page is being drawn).
*/
export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}
