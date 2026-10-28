/*
  FILE: lib/auth/currentPassword.ts
  WHAT IT'S FOR: Asks "is this really the logged-in person's password?" before the
  Profile page changes the email, changes the password, or deletes the account.
  This stops someone who only has a logged-in phone or a stolen cookie. Wrong
  answers are counted (5 wrong, then 15 minutes, see PROFILE_PASSWORD_RULE in
  lib/security/attempts.ts) so the check can't be used to guess the password.
  The try is counted BEFORE the password is compared, the same way login does it,
  so a flood of parallel guesses can't slip past. A right answer wipes the count.
  WHO USES IT: app/actions/profile.ts.
  WHY THIS NAME: It checks the current password. It lives in lib/auth with the other
  login code. It ends in .ts because it shows nothing on screen.
*/

import "server-only";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/db/mongodb";
import { UserModel } from "@/lib/db/models/User";
import { clearAttempts, PROFILE_PASSWORD_RULE, reserveAttempt } from "@/lib/security/attempts";
// scrambledKey from lib/security/keys.ts: the database key is a one-way scramble of the user's ID.
import { scrambledKey } from "@/lib/security/keys";

/* "ok" = right password; "wrong" = not the password; "locked" = too many wrong answers, wait. */
export type PasswordCheck = "ok" | "wrong" | "locked";

/* passwordCheckKey: this user's counter key. Exported so tests can look at the counter. */
export function passwordCheckKey(userId: string): string {
  return scrambledKey("profile-password", userId);
}

/*
  checkCurrentPassword: see the top of this file. `userId` always comes from the
  login cookie (never from a form), so a person can only ever check their own password.
  .select("+passwordHash"): the hash is hidden by default (see the User model); this is
  one of the few places that asks for it.
*/
export async function checkCurrentPassword(userId: string, typedPassword: string): Promise<PasswordCheck> {
  await connectToDatabase();
  const key = passwordCheckKey(userId);

  const reservation = await reserveAttempt(key, PROFILE_PASSWORD_RULE);
  if (!reservation.allowed) return "locked";

  const record = await UserModel.findById(userId).select("+passwordHash").lean();
  if (!record) return "wrong"; // The account vanished between the page loading and now.

  const matches = await bcrypt.compare(typedPassword, record.passwordHash);
  if (!matches) return "wrong";

  await clearAttempts(key);
  return "ok";
}
