/*
  FILE: lib/security/attempts.ts
  WHAT IT'S FOR: A small "too many tries" guard that any form can use. Two styles:
  A) CHECK, THEN COUNT (the invite page):
     - getBlockedSeconds(key, rule): 0 if the key may try, or the seconds left on its time-out
     - recordFailedAttempt(key, rule): count one more failure
  B) COUNT FIRST, THEN CHECK (login): reserveAttempt(key, rule)
     Takes one of the key's tries BEFORE the password is checked, in one atomic
     database step. Why: checking a password takes about a quarter of a second,
     so an attacker could fire 100 guesses at once and all 100 would pass a
     "has this key failed 5 times yet?" check before any failure was written
     down. Counting first means only the first 5 get through, however fast they
     arrive. After the password check, a good login calls clearAttempts() and
     refundAttempt() to take the count back.
  A "rule" says how many failures are allowed and how long the time-out lasts.
  The invite page uses INVITE_ATTEMPT_RULE: 5 wrong codes, then a 15-minute wait.
  Login uses LOGIN_EMAIL_RULE and LOGIN_IP_RULE (below).
  The counts live in MongoDB (see lib/db/models/AttemptCounter.ts).

  THE TIME-OUT STARTS AT THE LAST ALLOWED FAILURE: failures are counted from the
  first one. When the count reaches the limit, the 15 minutes start over from
  that moment, so the wait is always the full 15 minutes.

  WHO USES IT: app/actions/invite.ts (style A) and lib/auth/loginAttempt.ts (style B).
  WHY THIS NAME: It's about (failed) attempts. It lives in lib/security. It ends
  in .ts because it shows nothing on screen.
*/

import "server-only";
import { connectToDatabase } from "@/lib/db/mongodb";
import { AttemptCounterModel } from "@/lib/db/models/AttemptCounter";
import { isDuplicateKeyError } from "@/lib/db/errors";

/*
  AttemptRule: how strict a guard is.
  - maxFailures: this many failures in a row triggers the time-out
  - windowMs: the time-out length (and also how long a failure is remembered), in milliseconds
*/
export type AttemptRule = { maxFailures: number; windowMs: number };

/** The invite page's rule: 5 wrong codes, then 15 minutes. (15 × 60 seconds × 1000 milliseconds.) */
export const INVITE_ATTEMPT_RULE: AttemptRule = { maxFailures: 5, windowMs: 15 * 60 * 1000 };

/*
  LOGIN_EMAIL_RULE: 5 wrong passwords for ONE email, then 15 minutes. It counts
  by the email typed, whether or not that email has an account, so the lockout
  never reveals which emails are real.
*/
export const LOGIN_EMAIL_RULE: AttemptRule = { maxFailures: 5, windowMs: 15 * 60 * 1000 };

/*
  LOGIN_IP_RULE: 20 tries from ONE address across ALL emails, then 15 minutes.
  This stops one attacker working through many emails. It is higher than the
  email limit on purpose: a classroom or office shares one address, and five
  people mistyping shouldn't lock everyone out.
*/
export const LOGIN_IP_RULE: AttemptRule = { maxFailures: 20, windowMs: 15 * 60 * 1000 };

/** The message shown during a time-out. It never says how long, or which part failed. */
export const TOO_MANY_ATTEMPTS_MESSAGE = "Too many attempts. Try again in a few minutes.";

/*
  getBlockedSeconds: 0 means "go ahead". More than 0 means "wait this many seconds".
  A record only counts if its time hasn't passed yet, because MongoDB deletes
  old ones only about once a minute.
*/
export async function getBlockedSeconds(key: string, rule: AttemptRule, now: Date = new Date()): Promise<number> {
  await connectToDatabase();
  const record = await AttemptCounterModel.findOne({
    key,
    count: { $gte: rule.maxFailures },
    expiresAt: { $gt: now },
  }).lean();
  return record ? Math.ceil((record.expiresAt.getTime() - now.getTime()) / 1000) : 0;
}

/*
  recordFailedAttempt: counts one more failure for this key.
  1. A leftover record whose time has passed is deleted first, so counting starts fresh.
  2. The count goes up by one in a single database command (so two failures at
     the same instant are both counted). "upsert" means: create the record if
     there isn't one yet. $setOnInsert sets the expiry only when it is created.
  3. If that failure reached the limit, the time-out clock restarts from now.
  If two first-ever failures race to create the record, one gets a duplicate-key
  error and simply tries again once.
*/
export async function recordFailedAttempt(key: string, rule: AttemptRule, now: Date = new Date()): Promise<void> {
  await connectToDatabase();
  await AttemptCounterModel.deleteOne({ key, expiresAt: { $lte: now } });

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const record = await AttemptCounterModel.findOneAndUpdate(
        { key },
        { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(now.getTime() + rule.windowMs) } },
        { upsert: true, returnDocument: "after" },
      ).lean();
      if (record && record.count === rule.maxFailures) {
        await AttemptCounterModel.updateOne({ key }, { $set: { expiresAt: new Date(now.getTime() + rule.windowMs) } });
      }
      return;
    } catch (error) {
      if (!isDuplicateKeyError(error) || attempt === 2) throw error;
    }
  }
}

/*
  Reservation: the answer from reserveAttempt.
  - allowed: true = go ahead and check the password; false = locked out, don't
  - retryAfterSeconds: when locked out, how long until the time-out ends (0 when allowed)
*/
export type Reservation = { allowed: boolean; retryAfterSeconds: number };

/*
  reserveAttempt: takes one try for this key, in one atomic step (style B above).
  - Tries 1 up to maxFailures are allowed. The try that reaches maxFailures is
    still allowed (it is the 5th password the person gets), and the time-out
    clock restarts from that moment, so the wait is the full 15 minutes.
  - Every try after that is refused until the clock runs out.
  The caller undoes the count on a good login with clearAttempts / refundAttempt.
*/
export async function reserveAttempt(key: string, rule: AttemptRule, now: Date = new Date()): Promise<Reservation> {
  await connectToDatabase();
  // A leftover record whose time has passed is deleted first, so counting starts fresh.
  await AttemptCounterModel.deleteOne({ key, expiresAt: { $lte: now } });

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const record = await AttemptCounterModel.findOneAndUpdate(
        { key },
        { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(now.getTime() + rule.windowMs) } },
        { upsert: true, returnDocument: "after" },
      ).lean();
      // With upsert there is always a record; this only reassures TypeScript.
      if (!record) throw new Error("The attempt counter was not saved.");

      if (record.count > rule.maxFailures) {
        return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((record.expiresAt.getTime() - now.getTime()) / 1000)) };
      }
      if (record.count === rule.maxFailures) {
        // The last allowed try: the time-out starts counting from now.
        await AttemptCounterModel.updateOne({ key }, { $set: { expiresAt: new Date(now.getTime() + rule.windowMs) } });
      }
      return { allowed: true, retryAfterSeconds: 0 };
    } catch (error) {
      if (!isDuplicateKeyError(error) || attempt === 2) throw error;
    }
  }
  // Unreachable: the loop above always returns or throws. Here only to satisfy TypeScript.
  throw new Error("The attempt counter could not be updated.");
}

/* clearAttempts: forget this key's failures completely (a good login resets the email's count). */
export async function clearAttempts(key: string): Promise<void> {
  await connectToDatabase();
  await AttemptCounterModel.deleteOne({ key });
}

/*
  refundAttempt: give back exactly ONE try (never below zero). A good login
  refunds its own try on the IP's counter, so normal logins from a shared
  address don't use up its allowance. It does NOT reset the whole count, so
  someone can't wipe their wrong guesses by logging into their own account in between.
*/
export async function refundAttempt(key: string): Promise<void> {
  await connectToDatabase();
  await AttemptCounterModel.updateOne({ key, count: { $gt: 0 } }, { $inc: { count: -1 } });
}
