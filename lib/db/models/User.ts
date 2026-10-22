/*
  FILE: lib/db/models/User.ts
  WHAT IT'S FOR: The database "model" for users. A model tells Mongoose what a user
  record looks like in MongoDB (email, hashed password, chosen sportsbook) and
  checks every record before saving it. It also has toUser(), which turns a
  database record into the safe User type that pages and APIs are allowed to send.
  WHO USES IT: Later: sign up and login (Section 4), Settings (Section 13), and the
  slip API (Section 7, to remember the user's active slip).
  WHY THIS NAME: Models are named after the thing they store, starting with a
  capital letter (User), which is the usual style for models. It lives in
  lib/db/models with the other database code. It ends in .ts because it shows nothing on screen.
*/

// Makes the build fail if browser code ever imports this file, so database code and password hashes stay on the server.
import "server-only";
import { model, models, Schema, type Model, type Types } from "mongoose";
// DEFAULT_SPORTSBOOK (Hard Rock Bet) comes from config/sportsbooks.ts, so new users start on the same book everywhere.
import { DEFAULT_SPORTSBOOK } from "@/config/sportsbooks";
// The shared User type (what's safe to send out) and the list of valid sportsbook IDs, both from the types folder.
import { SPORTSBOOK_IDS, type SportsbookId, type User } from "@/types";

/*
  UserRecord: what a user looks like INSIDE the database.
  This is different from the shared User type on purpose: it has passwordHash,
  which must never leave the server.
*/
export type UserRecord = {
  /** MongoDB's ID for this user. MongoDB creates it automatically. */
  _id: Types.ObjectId;
  /** The user's email, saved in lowercase. */
  email: string;
  /**
   * The password after it's been "hashed" (scrambled one way, in Section 4).
   * A hash can check a password but can't be turned back into it. We NEVER store the real password.
   */
  passwordHash: string;
  /** Their chosen sportsbook. */
  preferredSportsbook: SportsbookId;
  /** The slip they're adding picks to right now, or null if none (missing on purpose). */
  activeBetSlipId: Types.ObjectId | null;
  /** When the account was created. Mongoose fills this in automatically. */
  createdAt: Date;
  /** When the account was last changed. Mongoose fills this in automatically. */
  updatedAt: Date;
};

/*
  userSchema: the rules for each field. Mongoose checks these before saving and
  refuses to save anything that breaks them.
*/
const userSchema = new Schema<UserRecord>(
  {
    email: {
      type: String,
      required: true,
      // unique: MongoDB won't allow two accounts with the same email.
      unique: true,
      // lowercase + trim: " Me@X.com " is saved as "me@x.com", so the same person can't sign up twice.
      lowercase: true,
      trim: true,
      // 254 characters is the longest a real email address can be.
      maxlength: 254,
      // A simple shape check: something@something.something
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    passwordHash: {
      type: String,
      required: true,
      // SECURITY: select: false means the hash is LEFT OUT of every database read
      // unless code asks for it by name with .select("+passwordHash"). Only the
      // login check (Section 4) will do that, so the hash can't end up in a page or an API answer by accident.
      select: false,
    },
    preferredSportsbook: {
      type: String,
      // enum: only these three values are allowed.
      enum: SPORTSBOOK_IDS,
      default: DEFAULT_SPORTSBOOK,
    },
    activeBetSlipId: {
      type: Schema.Types.ObjectId,
      // ref: this ID points to a record in the BetSlip collection.
      ref: "BetSlip",
      default: null,
    },
  },
  // timestamps: Mongoose adds and updates createdAt and updatedAt automatically.
  { timestamps: true },
);

/*
  UserModel: what the rest of the code uses to find, create, and update users.
  "models.User ??" reuses the model if it already exists. While you're coding,
  Next.js reloads files on every save, and creating the same model twice would
  crash with an "OverwriteModelError".
*/
export const UserModel: Model<UserRecord> =
  (models.User as Model<UserRecord> | undefined) ??
  model<UserRecord>("User", userSchema);

/*
  toUser: turns a database record into the shared User type.
  SECURITY: it copies ONLY the safe fields one by one. passwordHash isn't copied,
  so even if a record had it, the hash can't leak out through a page or API
  response. Always send users through this.
*/
export function toUser(record: Omit<UserRecord, "passwordHash">): User {
  return {
    id: record._id.toString(),
    email: record.email,
    preferredSportsbook: record.preferredSportsbook,
    activeBetSlipId: record.activeBetSlipId?.toString() ?? null,
    createdAt: record.createdAt.toISOString(),
  };
}
