/*
  FILE: lib/auth/inviteCookie.ts
  WHAT IT'S FOR: Saves, reads, and deletes the invite cookie (bv_invite): the
  browser's note that says "this visitor already entered a valid invite code".
  It works like the login cookie in session.ts, with the same safety settings.
  WHO USES IT: app/actions/invite.ts (saves it after a good code) and
  app/actions/auth.ts (reads it at sign up, deletes it if the code stopped being good).
  proxy.ts reads the cookie too, but straight from the request.
  WHY THIS NAME: It's the cookie code for the invite. It sits next to session.ts in
  lib/auth. It ends in .ts because it shows nothing on screen.
*/

import "server-only";
// cookies(): reads and writes cookies. Only allowed inside Server Actions and route handlers.
import { cookies } from "next/headers";
import { createInviteToken, INVITE_COOKIE_NAME, INVITE_DURATION_SECONDS, readInviteToken } from "./token";

/*
  setInviteCookie: remembers the invite code for 30 days. The settings:
  - httpOnly: JavaScript in the browser can't read it
  - secure: only sent over https (off on localhost, which uses plain http)
  - sameSite "lax": other websites can't make the browser send it with their forms
  - maxAge: the browser deletes it after 30 days
*/
export async function setInviteCookie(inviteCodeId: string): Promise<void> {
  const token = await createInviteToken(inviteCodeId);
  const cookieStore = await cookies();
  cookieStore.set(INVITE_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: INVITE_DURATION_SECONDS,
    path: "/",
  });
}

/*
  getInviteCodeId: the invite code record ID inside the cookie, or null if there
  is no cookie or it's fake or expired (null is missing on purpose: "no valid invite").
*/
export async function getInviteCodeId(): Promise<string | null> {
  const cookieStore = await cookies();
  const invite = await readInviteToken(cookieStore.get(INVITE_COOKIE_NAME)?.value);
  return invite ? invite.inviteCodeId : null;
}

/* deleteInviteCookie: forgets the invite code, so the visitor has to enter one again. */
export async function deleteInviteCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(INVITE_COOKIE_NAME);
}
