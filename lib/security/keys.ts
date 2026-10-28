/*
  FILE: lib/security/keys.ts
  WHAT IT'S FOR: Turns something private (an IP address, an email) into a safe
  database key for the too-many-tries guard. It uses HMAC-SHA256: a one-way
  scramble that needs our AUTH_SECRET. The same input always gives the same key,
  so we can count a visitor's failures, but nobody who reads the database (or a
  backup of it) can turn a key back into the address or email. Emails are
  guessable names, so an unscrambled list of "emails that failed to log in"
  would be a privacy leak.
  WHO USES IT: lib/security/clientIp.ts (visitor addresses) and lib/auth/loginAttempt.ts (emails).
  WHY THIS NAME: They're database keys. It lives in lib/security. It ends in .ts
  because it shows nothing on screen.
*/

import "server-only";
import { createHmac } from "node:crypto";

/*
  scrambledKey: "purpose:<scrambled value>". The purpose (like "login-email")
  is part of what gets scrambled, so the same email gives a different key for
  different guards and failing in one place never counts against another.
  Stops with a clear message if AUTH_SECRET is missing or too short.
*/
export function scrambledKey(purpose: string, value: string): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET is missing or shorter than 32 characters.");
  }
  const scrambled = createHmac("sha256", secret).update(`${purpose}|${value}`).digest("hex");
  return `${purpose}:${scrambled}`;
}
