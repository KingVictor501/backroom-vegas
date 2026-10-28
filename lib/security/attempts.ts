/*
  FILE: lib/security/attempts.ts
  WHAT IT'S FOR: A small "too many tries" guard that any form can use.
  - getBlockedSeconds(key, rule): 0 if the key may try, or how many seconds are
    left on its time-out
  - recordFailedAttempt(key, rule): count one more failure for this key
  A "rule" says how many failures are allowed and how long the time-out lasts.
  The invite page uses INVITE_ATTEMPT_RULE: 5 wrong codes, then a 15-minute wait.
  The counts live in MongoDB (see lib/db/models/AttemptCounter.ts).

  THE TIME-OUT STARTS AT THE LAST ALLOWED FAILURE: failures are counted from the
  first one. When the count reaches the limit, the 15 minutes start over from
  that moment, so the wait is always the full 15 minutes.

  WHO USES IT: app/actions/invite.ts. The login lockout (Section 4) will use it too.
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
