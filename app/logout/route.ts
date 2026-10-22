/*
  FILE: app/logout/route.ts
  WHAT IT'S FOR: A backup way out, at /logout. It deletes the login cookie and
  goes to /login. lib/auth/dal.ts sends people here if their cookie is valid but
  their account no longer exists, so they don't get stuck bouncing between pages.
  (The normal "Log out" button uses the logout Server Action instead.)
  WHO USES IT: lib/auth/dal.ts (requireUser). You can also visit /logout directly.
  WHY THIS NAME: The folder "logout" becomes the address /logout. Next.js
  requires the file name "route" for a route that isn't a page. It ends in .ts
  because it doesn't show a screen, it just redirects.
*/

import { NextResponse } from "next/server";
// deleteSession from lib/auth/session.ts removes the login cookie.
import { deleteSession } from "@/lib/auth/session";

/*
  GET: runs when someone visits /logout. Deletes the cookie, then redirects to /login.
  It changes nothing in the database. Bet slips stay saved.
*/
export async function GET(request: Request) {
  await deleteSession();
  return NextResponse.redirect(new URL("/login", request.url));
}
