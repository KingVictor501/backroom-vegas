/*
  FILE: lib/auth/loginAttempt.ts
  WHAT IT'S FOR: The ONE place that decides whether a login attempt succeeds. It
  is used by BOTH the login form (the Server Action in app/actions/auth.ts) and
  the JSON login route (app/api/auth/login/route.ts), so the lockout rules can
  never differ between them. In order, it:
  1. TAKES A TRY from two counters: one for the email typed and one for the
     visitor's address (see lib/security/attempts.ts). This happens BEFORE the
     password is checked, so a flood of simultaneous guesses can't slip past.
  2. If either counter is over its limit: stops. "locked". The password is not
     even looked at, so a right password gets no hint it was right.
  3. Checks the password against the saved hash (or a dummy hash if there is no
     such account, so a wrong email takes as long as a wrong password).
  4. Wrong → "invalid". Right → resets that email's count, gives back this
     attempt's try on the address counter, and returns the user.
  The email counter counts by whatever email was typed, whether or not it has an
  account, so being locked out reveals nothing about which emails are real.
  The rules: 5 wrong passwords per email, 20 per address, 15 minutes.
  WHO USES IT: app/actions/auth.ts and app/api/auth/login/route.ts.
  WHY THIS NAME: It's one login attempt. It lives in lib/auth with the other login
  code. It ends in .ts because it shows nothing on screen.
*/

import "server-only";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/db/mongodb";
import { toUser, UserModel } from "@/lib/db/models/User";
import {
  clearAttempts,
  LOGIN_EMAIL_RULE,
  LOGIN_IP_RULE,
  refundAttempt,
  reserveAttempt,
} from "@/lib/security/attempts";
import { getClientKey } from "@/lib/security/clientIp";
import { scrambledKey } from "@/lib/security/keys";
import type { User } from "@/types";

/*
  DUMMY_HASH: the hash of a random password nobody knows. When someone tries to log
  in with an email that DOESN'T exist, we still check their password against
  this. That way a wrong email takes just as long as a wrong password, so an
  attacker can't time the answers to find out which emails have accounts.
  It's not a secret. It's the hash of throwaway random text.
*/
const DUMMY_HASH = "$2b$12$Y2ap8NfuhLOkQzJV4VVZ0uNRBomosG3GEF7SEEthGUcqEurTgDlzK";

/*
  LoginResult: the three things that can happen.
  - ok: true → the password was right; `user` is the safe User (no password hash)
  - reason "invalid" → wrong email or password (the caller shows ONE vague message)
  - reason "locked" → too many tries; `retryAfterSeconds` is how long until the time-out ends
*/
export type LoginResult =
  | { ok: true; user: User }
  | { ok: false; reason: "invalid" }
  | { ok: false; reason: "locked"; retryAfterSeconds: number };

/*
  attemptLogin: runs one login attempt (see the steps at the top of this file).
  `email` must already be tidied (trimmed, lowercase) by the login schema in
  lib/auth/validation.ts, so "Me@X.com" and "me@x.com" share one counter.
*/
export async function attemptLogin(email: string, password: string): Promise<LoginResult> {
  await connectToDatabase();

  const emailKey = scrambledKey("login-email", email);
  const addressKey = await getClientKey("login-address");

  // 1. Take a try from each counter, at the same time.
  const [byEmail, byAddress] = await Promise.all([
    reserveAttempt(emailKey, LOGIN_EMAIL_RULE),
    reserveAttempt(addressKey, LOGIN_IP_RULE),
  ]);

  // 2. Over a limit? Stop before looking at the password.
  if (!byEmail.allowed || !byAddress.allowed) {
    return { ok: false, reason: "locked", retryAfterSeconds: Math.max(byEmail.retryAfterSeconds, byAddress.retryAfterSeconds) };
  }

  // 3. Check the password. .select("+passwordHash"): the hash is hidden by default
  // (see the User model). This is the ONE place that asks for it.
  const record = await UserModel.findOne({ email }).select("+passwordHash").lean();
  const passwordMatches = await bcrypt.compare(password, record?.passwordHash ?? DUMMY_HASH);
  if (!record || !passwordMatches) return { ok: false, reason: "invalid" };

  // 4. A good login: this email's wrong guesses are forgotten, and this attempt
  // doesn't count against the address (but its OTHER failures still do).
  await Promise.all([clearAttempts(emailKey), refundAttempt(addressKey)]);
  // toUser copies only the safe fields, so the password hash is left behind.
  return { ok: true, user: toUser(record) };
}
