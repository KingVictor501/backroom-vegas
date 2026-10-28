/*
  FILE: lib/db/inviteCodes.ts
  WHAT IT'S FOR: Every way the app checks and uses invite codes in MongoDB:
  1. findUsableInviteCode(): "is this typed code real and still good?" It does
     NOT use up a spot. Typing a code on the invite page costs nothing.
  2. claimInviteUse(): takes one spot, used only at the moment an account is created.
  3. releaseInviteUse(): gives the spot back if the account then couldn't be created.

  WHY claimInviteUse IS ONE STEP (this is the important part):
  Imagine a code with ONE spot left and two people signing up at the same
  instant. If the app first LOOKED ("1 spot left, fine") and then COUNTED, both
  could look before either counted, and both would get in. Instead, the check
  ("active, not expired, spots left") and the count (+1) are ONE database
  command that MongoDB runs without interruption. The second person's command
  runs after the first's, sees 0 spots left, and matches nothing.

  A code is "good" when ALL are true: it's turned on, it hasn't expired, and
  usedCount is less than maxUses.
  WHO USES IT: app/actions/invite.ts (the invite page) and app/actions/auth.ts (sign up).
  WHY THIS NAME: It's the database code for invite codes, in lib/db (like betslips.ts).
  It ends in .ts because it shows nothing on screen.
*/

import "server-only";
import { connectToDatabase } from "@/lib/db/mongodb";
import { InviteCodeModel, type InviteCodeRecord } from "@/lib/db/models/InviteCode";
import { normalizeInviteCode } from "@/lib/invite/format";

/** The same "is a MongoDB ID" shape check used for session tokens: 24 characters of 0-9 and a-f. */
const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;

/*
  isInviteCodeGood: the "good" rule above, as plain code, for a record we already loaded.
  `now` is a parameter so tests can pretend it's another day.
*/
export function isInviteCodeGood(record: InviteCodeRecord, now: Date = new Date()): boolean {
  return (
    record.active &&
    record.usedCount < record.maxUses &&
    (record.expiresAt === null || record.expiresAt.getTime() > now.getTime())
  );
}

/*
  findUsableInviteCode: looks up what a visitor typed. Gives back the record if the
  code is real and good, or null if it's the wrong shape, unknown, used up,
  expired, or turned off (null is missing on purpose: callers show ONE message
  for all of these and never say which). It does not change anything.
*/
export async function findUsableInviteCode(typed: unknown): Promise<InviteCodeRecord | null> {
  const code = normalizeInviteCode(typed);
  if (code === null) return null;
  await connectToDatabase();
  const record = await InviteCodeModel.findOne({ code }).lean<InviteCodeRecord>();
  return record && isInviteCodeGood(record) ? record : null;
}

/*
  claimInviteUse: takes ONE spot on a code, but only if it is still good, all in
  a single database command (see the big note at the top). Gives back the updated
  record, or null if the code isn't good anymore (or the ID isn't a real ID).
  `$expr` lets the command compare two fields of the same record: usedCount < maxUses.
  `$or` means "no expiry date, or an expiry date that's still in the future".
*/
export async function claimInviteUse(inviteCodeId: string, now: Date = new Date()): Promise<InviteCodeRecord | null> {
  if (!OBJECT_ID_PATTERN.test(inviteCodeId)) return null;
  await connectToDatabase();
  return InviteCodeModel.findOneAndUpdate(
    {
      _id: inviteCodeId,
      active: true,
      $expr: { $lt: ["$usedCount", "$maxUses"] },
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
    },
    { $inc: { usedCount: 1 } },
    { returnDocument: "after" },
  ).lean<InviteCodeRecord>();
}

/*
  releaseInviteUse: hands a spot back. Used only when claimInviteUse worked but
  creating the account then failed, so a failed sign up doesn't burn someone's
  spot. It never takes the count below zero.
*/
export async function releaseInviteUse(inviteCodeId: string): Promise<void> {
  if (!OBJECT_ID_PATTERN.test(inviteCodeId)) return;
  await connectToDatabase();
  await InviteCodeModel.updateOne({ _id: inviteCodeId, usedCount: { $gt: 0 } }, { $inc: { usedCount: -1 } });
}
