/*
  FILE: lib/db/betslips.ts
  WHAT IT'S FOR: Every way the app reads or changes bet slips in MongoDB: list,
  get one, create, update, and delete. Two rules hold for all of them:
  1. OWNERSHIP: every database search includes the logged-in user's ID, so a
     user can only ever see, change, or delete their OWN slips. Someone else's
     slip ID acts exactly like a fake ID ("not found"), so it doesn't even
     reveal that the slip exists.
  2. THE SERVER DOES THE MATH: the slip type (Straight, Parlay, SGP) and the
     combined odds are always worked out here with getSlipPricing(), never
     taken from the browser.
  3. THE SERVER CHECKS THE RULES: picks that can't go together (and picks from
     another game on an SGP slip) are refused here too, not just by the popup.
  It also keeps track of your ACTIVE slip, the one shown in the slip bar.
  WHO USES IT: app/api/betslips/route.ts and app/api/betslips/[id]/route.ts.
  Later: the Bet Slips pages (Section 12) and the slip bar (Section 8).
  WHY THIS NAME: It's the database code for bet slips, in lib/db. It ends in .ts
  because it shows nothing on screen.
*/

// Keeps database code on the server only. The build fails if browser code imports it.
import "server-only";
// The shared database connection from Section 1.
import { connectToDatabase } from "@/lib/db/mongodb";
// The bet slip model and toBetSlip() (database record → shared BetSlip) from Section 3.
import { BetSlipModel, toBetSlip, type BetSlipRecord } from "@/lib/db/models/BetSlip";
// The User model, so deleting your active slip also clears it from your account.
import { UserModel } from "@/lib/db/models/User";
// isDuplicateKeyError from lib/db/errors.ts: spots "you already have a slip with that name".
import { isDuplicateKeyError } from "@/lib/db/errors";
// getSlipPricing from lib/betting/parlay.ts: the server's own type and odds math.
import { getSlipPricing } from "@/lib/betting/parlay";
// The "picks that can't go together" rules from lib/betting/conflicts.ts (the same ones the popup uses).
import { findConflictInList } from "@/lib/betting/conflicts";
// THE shared bet slip definitions from the types folder.
import type { BetPick, BetSlip, User } from "@/types";

/*
  SlipNameTakenError: thrown when the user already has a slip with that name.
  The API turns it into a friendly "409 conflict" answer.
*/
export class SlipNameTakenError extends Error {
  constructor(public readonly slipName: string) {
    super(`You already have a slip named "${slipName}". Pick another name.`);
    this.name = "SlipNameTakenError";
  }
}

/*
  SlipConflictError: thrown when the picks break a BET SLIP RULE (like both
  sides of the same bet). The API turns it into a "409 conflict" answer with
  the same message the popup would show.
*/
export class SlipConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SlipConflictError";
  }
}

/* checkPicks: throws SlipConflictError if any picks clash. */
function checkPicks(picks: readonly BetPick[], sgpGameId: string | null): void {
  const conflict = findConflictInList(picks, sgpGameId);
  if (conflict) throw new SlipConflictError(conflict.message);
}

/*
  SLIP_NAME_TIME_ZONE: which time zone "today" means for default slip names.
  The server on Vercel runs on UTC (London time, no daylight saving), so without
  this a slip made at 9 PM in New York would get TOMORROW's date. NFL schedules
  use Eastern time, so we do too.
*/
const SLIP_NAME_TIME_ZONE = "America/New_York";

/** MongoDB IDs are 24 letters and numbers (0-9, a-f). Anything else can't be a real slip. */
const SLIP_ID_PATTERN = /^[a-f\d]{24}$/i;

/* isSlipId: true if the text looks like a real MongoDB ID. */
export function isSlipId(id: string): boolean {
  return SLIP_ID_PATTERN.test(id);
}

/*
  todaysSlipName: today's date the way slip names use it, like "10-23-2026".
*/
function todaysSlipName(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SLIP_NAME_TIME_ZONE,
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("month")}-${part("day")}-${part("year")}`;
}

/* escapeRegex: makes text safe to search for exactly (so "KC @ SEA (2)" is matched as plain text). */
function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/*
  nextFreeName: the name itself, or the first free "name (2)", "name (3)", ...
  if the user already has slips with that name. The base is today's date
  ("10-23-2026") unless another is given (like "KC @ SEA SGP").
*/
async function nextFreeName(userId: string, base: string = todaysSlipName()): Promise<string> {
  // Finds this user's slips named "<base>" or "<base> (any number)".
  const existing = await BetSlipModel.find(
    { userId, name: { $regex: `^${escapeRegex(base)}( \\(\\d+\\))?$` } },
    { name: 1 },
  ).lean();
  const taken = new Set(existing.map((slip) => slip.name));
  if (!taken.has(base)) return base;
  let number = 2;
  while (taken.has(`${base} (${number})`)) number += 1;
  return `${base} (${number})`;
}

/*
  listBetSlips: all of the user's slips, most recently changed first.
*/
export async function listBetSlips(userId: string): Promise<BetSlip[]> {
  await connectToDatabase();
  const records = await BetSlipModel.find({ userId }).sort({ updatedAt: -1 }).lean<BetSlipRecord[]>();
  return records.map(toBetSlip);
}

/*
  getBetSlip: one slip, ONLY if it belongs to this user. null means "not found"
  (missing on purpose): it doesn't exist, or it's someone else's.
*/
export async function getBetSlip(userId: string, slipId: string): Promise<BetSlip | null> {
  if (!isSlipId(slipId)) return null;
  await connectToDatabase();
  const record = await BetSlipModel.findOne({ _id: slipId, userId }).lean<BetSlipRecord>();
  return record ? toBetSlip(record) : null;
}

/*
  CreateSlipInput: what createBetSlip needs (already checked by lib/betting/validation.ts).
*/
type CreateSlipInput = {
  name?: string;
  picks: BetPick[];
  sgpGameId: string | null;
  setActive: boolean;
  numberIfTaken: boolean;
};

/*
  createBetSlip: saves a new slip for this user and returns it.
  - No name: today's date ("10-23-2026", then "10-23-2026 (2)", ...).
  - numberIfTaken: the given name gets (2), (3), ... if it's taken (for "KC @ SEA SGP").
  - Otherwise, a name the user typed that's already taken throws SlipNameTakenError.
  - Picks that clash throw SlipConflictError.
  - setActive: also makes it the user's active slip (the slip bar shows it).
  If two slips are created at the exact same moment, the database's
  unique-name rule refuses one, and automatic names simply try the next number (up to 5 tries).
*/
export async function createBetSlip(userId: string, input: CreateSlipInput): Promise<BetSlip> {
  checkPicks(input.picks, input.sgpGameId);
  await connectToDatabase();
  const pricing = getSlipPricing(input.picks);
  const autoNumber = input.name === undefined || input.numberIfTaken;

  for (let attempt = 1; ; attempt += 1) {
    const name = autoNumber ? await nextFreeName(userId, input.name) : (input.name ?? "");
    try {
      const created = await BetSlipModel.create({
        userId,
        name,
        sgpGameId: input.sgpGameId,
        picks: input.picks,
        ...pricing,
      });
      if (input.setActive) {
        await UserModel.updateOne({ _id: userId }, { $set: { activeBetSlipId: created._id } });
      }
      return toBetSlip(created.toObject<BetSlipRecord>());
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
      if (!autoNumber || attempt >= 5) throw new SlipNameTakenError(name);
    }
  }
}

/*
  updateBetSlip: renames a slip and/or replaces its picks, ONLY if it belongs to
  this user. Changing the picks recalculates the type and combined odds, and
  checks the new picks against the conflict rules (and the SGP's game).
  Returns the updated slip, or null if it's not found (missing on purpose).
  A taken name throws SlipNameTakenError. Clashing picks throw SlipConflictError.
*/
export async function updateBetSlip(
  userId: string,
  slipId: string,
  changes: { name?: string; picks?: BetPick[] },
): Promise<BetSlip | null> {
  if (!isSlipId(slipId)) return null;
  await connectToDatabase();

  if (changes.picks !== undefined) {
    // We need the slip's SGP game (if any) to check the new picks against it.
    const current = await BetSlipModel.findOne({ _id: slipId, userId }, { sgpGameId: 1 }).lean<Pick<BetSlipRecord, "sgpGameId">>();
    if (!current) return null;
    checkPicks(changes.picks, current.sgpGameId);
  }

  try {
    const record = await BetSlipModel.findOneAndUpdate(
      { _id: slipId, userId },
      {
        $set: {
          ...(changes.name !== undefined && { name: changes.name }),
          ...(changes.picks !== undefined && { picks: changes.picks, ...getSlipPricing(changes.picks) }),
        },
      },
      // returnDocument "after": give back the slip AFTER the change. runValidators: apply the model's rules too.
      { returnDocument: "after", runValidators: true },
    ).lean<BetSlipRecord>();
    return record ? toBetSlip(record) : null;
  } catch (error) {
    if (isDuplicateKeyError(error) && changes.name !== undefined) throw new SlipNameTakenError(changes.name);
    throw error;
  }
}

/*
  deleteBetSlip: deletes a slip, ONLY if it belongs to this user. If it was the
  user's active slip (the one in the slip bar), that's cleared too, so the bar
  doesn't point at a slip that's gone. Returns false if it's not found.
*/
export async function deleteBetSlip(userId: string, slipId: string): Promise<boolean> {
  if (!isSlipId(slipId)) return false;
  await connectToDatabase();
  const deleted = await BetSlipModel.findOneAndDelete({ _id: slipId, userId }).lean<BetSlipRecord>();
  if (!deleted) return false;
  await UserModel.updateOne({ _id: userId, activeBetSlipId: deleted._id }, { $set: { activeBetSlipId: null } });
  return true;
}

/*
  getActiveBetSlip: the slip the user is adding picks to right now, or null if
  they don't have one (missing on purpose: the slip bar is hidden).
*/
export async function getActiveBetSlip(user: User): Promise<BetSlip | null> {
  if (user.activeBetSlipId === null) return null;
  return getBetSlip(user.id, user.activeBetSlipId);
}

/*
  setActiveBetSlip: makes one of the user's slips their active slip, and
  returns it. null if that slip isn't theirs or doesn't exist (missing on purpose).
*/
export async function setActiveBetSlip(userId: string, slipId: string): Promise<BetSlip | null> {
  const slip = await getBetSlip(userId, slipId);
  if (!slip) return null;
  await UserModel.updateOne({ _id: userId }, { $set: { activeBetSlipId: slip.id } });
  return slip;
}

/*
  clearActiveBetSlip: the user has no active slip anymore. Their slips stay
  saved; the next odds they tap start a new one. This is what "Done" does in SGP mode.
*/
export async function clearActiveBetSlip(userId: string): Promise<void> {
  await connectToDatabase();
  await UserModel.updateOne({ _id: userId }, { $set: { activeBetSlipId: null } });
}
