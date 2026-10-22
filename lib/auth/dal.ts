/*
  FILE: lib/auth/dal.ts
  WHAT IT'S FOR: The "Data Access Layer" (DAL), the one place that answers "who
  is the logged-in user?" by checking the cookie AND the database. The Next.js
  docs recommend this: every page, Server Action, and API route that needs the
  user asks here, so no one can forget the login check.
  WHO USES IT: app/(main)/settings/page.tsx now. Later: the bet slip API
  (Section 7), the Bet Slips pages (Section 12), and Settings (Section 13).
  WHY THIS NAME: "dal" = Data Access Layer, the name the Next.js docs use. It
  ends in .ts because it shows nothing on screen.
*/

// Keeps this on the server only. It reads the database and the login cookie.
import "server-only";
// cache: within ONE page load, if several parts ask "who's logged in?", only check once.
import { cache } from "react";
// redirect: sends the visitor to another page.
import { redirect } from "next/navigation";
// getSession from lib/auth/session.ts reads and checks the login cookie.
import { getSession } from "./session";
// The shared database connection and the User model + safe converter from Section 3.
import { connectToDatabase } from "@/lib/db/mongodb";
import { toUser, UserModel } from "@/lib/db/models/User";
// The shared User type (no password field) from the types folder.
import type { User } from "@/types";

/*
  getCurrentUser: the logged-in user, or null if nobody is logged in (null is
  missing on purpose). It also checks the user still exists in the database, so
  a valid cookie for a deleted account doesn't count.
  The passwordHash is never loaded (the User model hides it), and toUser()
  copies only safe fields.
*/
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const session = await getSession();
  if (!session) return null;

  await connectToDatabase();
  const record = await UserModel.findById(session.userId).lean();
  return record ? toUser(record) : null;
});

/*
  requireUser: like getCurrentUser, but for pages that MUST have a logged-in user.
  - Not logged in at all → go to /login.
  - Has a cookie, but the account no longer exists → go to /logout, which
    deletes the stale cookie and then goes to /login. (Going straight to /login
    would loop forever, because proxy.ts sends anyone with a cookie away from /login.)
*/
export const requireUser = cache(async (): Promise<User> => {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await getCurrentUser();
  if (!user) redirect("/logout");

  return user;
});
