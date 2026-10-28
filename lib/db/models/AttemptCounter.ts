/*
  FILE: lib/db/models/AttemptCounter.ts
  WHAT IT'S FOR: The database "model" for counting failed tries. One record =
  one "who" (a key like "invite:<scrambled visitor address>") and how many times
  they've failed recently. MongoDB deletes each record by itself once its
  expiresAt time passes, so old failures clean themselves up.
  WHY IN THE DATABASE and not in the app's memory: Vercel may run the app on
  many servers at once, and each server has its own memory. A counter kept in
  memory would reset whenever a different server answered. The database is the
  one place all servers share.
  WHO USES IT: lib/security/attempts.ts. The invite page uses it now; the login
  lockout (Section 4) will use it too.
  WHY THIS NAME: It counts attempts. It lives in lib/db/models with the other
  models, and ends in .ts because it shows nothing on screen.
*/

import "server-only";
import { model, models, Schema, type Model, type Types } from "mongoose";

/* AttemptCounterRecord: what a counter looks like inside the database. */
export type AttemptCounterRecord = {
  _id: Types.ObjectId;
  /** Who is being counted, like "invite:9f2c...". Never a raw address or an email. */
  key: string;
  /** How many failed tries so far in this window. */
  count: number;
  /** When this record stops mattering (and MongoDB deletes it). */
  expiresAt: Date;
};

const attemptCounterSchema = new Schema<AttemptCounterRecord>({
  key: { type: String, required: true, unique: true, maxlength: 200 },
  count: { type: Number, required: true, default: 0, min: 0 },
  // expireAfterSeconds: 0 is MongoDB's "time to live" (TTL) feature: delete the
  // record once expiresAt is in the past. (MongoDB checks about once a minute,
  // so lib/security/attempts.ts also ignores records whose time has passed.)
  expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
});

/* AttemptCounterModel: what the rest of the code uses. ("models.AttemptCounter ??" avoids creating it twice while coding.) */
export const AttemptCounterModel: Model<AttemptCounterRecord> =
  (models.AttemptCounter as Model<AttemptCounterRecord> | undefined) ??
  model<AttemptCounterRecord>("AttemptCounter", attemptCounterSchema);
