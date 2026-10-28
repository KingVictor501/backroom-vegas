/*
  FILE: lib/db/models/InviteCode.ts
  WHAT IT'S FOR: The database "model" for invite codes: what one code looks like
  in MongoDB, with rules that reject bad data (a code in the wrong shape, 0
  allowed sign ups, a note that's too long). Each code says how many accounts
  it may create, how many it has created so far, when it expires (if ever), and
  whether it's turned on.
  WHO USES IT: lib/db/inviteCodes.ts (looking codes up and counting uses),
  lib/db/models/User.ts (each new user points at the code they signed up with),
  and the tests. The terminal script scripts/create-invite-code.ts writes
  records of this same shape.
  WHY THIS NAME: Named after what it stores, with a capital letter like all
  models. It lives in lib/db/models with the other models. It ends in .ts
  because it shows nothing on screen.
*/

// Keeps this file on the server only. The build fails if browser code imports it.
import "server-only";
import { model, models, Schema, type Model, type Types } from "mongoose";
// The code's shape rule and size limits, from lib/invite/format.ts.
import { INVITE_CODE_PATTERN, INVITE_MAX_USES_LIMIT, INVITE_NOTE_MAX_LENGTH } from "@/lib/invite/format";

/*
  InviteCodeRecord: what an invite code looks like INSIDE the database.
  Only the server ever sees this. The browser is never sent a code record.
*/
export type InviteCodeRecord = {
  /** MongoDB's ID for this record. New users and the invite cookie point at it. */
  _id: Types.ObjectId;
  /** The code itself, like BRV-7K2M-Q9XD. Unique. */
  code: string;
  /** How many accounts this code may create in total. */
  maxUses: number;
  /** How many accounts it has created so far. It only goes up when someone SIGNS UP, never when the code is just entered. */
  usedCount: number;
  /** The moment it stops working, or null if it never expires (missing on purpose: no expiry). */
  expiresAt: Date | null;
  /** false = turned off by hand. A turned-off code is refused even if it has uses left. */
  active: boolean;
  /** A short reminder of who it's for, like "graders". */
  note: string;
  createdAt: Date;
  updatedAt: Date;
};

/* inviteCodeSchema: the rules for each field. Mongoose checks these before saving. */
const inviteCodeSchema = new Schema<InviteCodeRecord>(
  {
    code: {
      type: String,
      required: true,
      // unique: two records can never share a code.
      unique: true,
      // match: only codes shaped like BRV-XXXX-XXXX are saved.
      match: INVITE_CODE_PATTERN,
    },
    maxUses: {
      type: Number,
      required: true,
      min: 1,
      max: INVITE_MAX_USES_LIMIT,
      // Only whole numbers: 2.5 uses makes no sense.
      validate: { validator: Number.isInteger, message: "maxUses must be a whole number." },
    },
    usedCount: { type: Number, required: true, default: 0, min: 0 },
    expiresAt: { type: Date, default: null },
    active: { type: Boolean, required: true, default: true },
    note: { type: String, default: "", trim: true, maxlength: INVITE_NOTE_MAX_LENGTH },
  },
  // timestamps: Mongoose adds and updates createdAt and updatedAt automatically.
  { timestamps: true },
);

/*
  InviteCodeModel: what the rest of the code uses to find and change invite codes.
  "models.InviteCode ??" reuses the model if it already exists (Next.js reloads
  files on every save, and creating the same model twice would crash).
*/
export const InviteCodeModel: Model<InviteCodeRecord> =
  (models.InviteCode as Model<InviteCodeRecord> | undefined) ??
  model<InviteCodeRecord>("InviteCode", inviteCodeSchema);
