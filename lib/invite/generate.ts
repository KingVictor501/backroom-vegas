/*
  FILE: lib/invite/generate.ts
  WHAT IT'S FOR: Makes brand-new invite codes. generateInviteCode() picks 8
  random characters, and newInviteCodeFields() builds everything a new code
  record needs (the code, how many sign ups it allows, an optional expiry, a note)
  and refuses nonsense, like 0 uses or a 5,000-character note.
  The random picking uses Node's secure random number tool (crypto.randomInt),
  not Math.random(), because codes must be impossible to predict.
  WHO USES IT: scripts/create-invite-code.ts (the terminal script that creates
  codes) and the tests. The website itself never makes codes.
  WHY THIS NAME: It generates codes. It's separate from format.ts because it
  needs Node's crypto tool, which browser code can't use. It ends in .ts because
  it shows nothing on screen.
  NOTE ON "./format.ts": the terminal script runs under Node directly, and Node
  needs the full file name with the .ts ending on imports between files.
*/

// randomInt: a secure, unbiased random whole number from Node's built-in crypto tools.
import { randomInt } from "node:crypto";
import { INVITE_CODE_ALPHABET, INVITE_MAX_USES_LIMIT, INVITE_NOTE_MAX_LENGTH } from "./format.ts";

/** Picks `length` random characters from the code alphabet. */
function randomGroup(length: number): string {
  let group = "";
  for (let i = 0; i < length; i += 1) {
    group += INVITE_CODE_ALPHABET[randomInt(INVITE_CODE_ALPHABET.length)];
  }
  return group;
}

/** generateInviteCode: a fresh random code like BRV-7K2M-Q9XD. */
export function generateInviteCode(): string {
  return `BRV-${randomGroup(4)}-${randomGroup(4)}`;
}

/*
  NewInviteCodeOptions: what the person creating a code chooses.
  - maxUses: how many accounts the code may create (1 to INVITE_MAX_USES_LIMIT)
  - expiresAt: the moment it stops working, or null for never (null is missing on purpose: no expiry)
  - note: a short reminder of who it's for, like "graders"
*/
export type NewInviteCodeOptions = {
  maxUses: number;
  expiresAt: Date | null;
  note: string;
};

/*
  NewInviteCodeFields: the fields of a brand-new invite code record. The
  database model (lib/db/models/InviteCode.ts) accepts exactly these.
*/
export type NewInviteCodeFields = {
  code: string;
  maxUses: number;
  usedCount: number;
  expiresAt: Date | null;
  active: boolean;
  note: string;
};

/*
  newInviteCodeFields: checks the choices and builds the record's fields.
  Throws a plain-English Error if a choice is out of range. A new code has been
  used 0 times and is turned on.
*/
export function newInviteCodeFields(options: NewInviteCodeOptions, now: Date = new Date()): NewInviteCodeFields {
  if (!Number.isInteger(options.maxUses) || options.maxUses < 1 || options.maxUses > INVITE_MAX_USES_LIMIT) {
    throw new Error(`Uses must be a whole number from 1 to ${INVITE_MAX_USES_LIMIT}.`);
  }
  if (options.expiresAt !== null && !(options.expiresAt.getTime() > now.getTime())) {
    throw new Error("The expiration date must be in the future.");
  }
  const note = options.note.trim();
  if (note.length > INVITE_NOTE_MAX_LENGTH) {
    throw new Error(`The note can be at most ${INVITE_NOTE_MAX_LENGTH} characters.`);
  }
  return {
    code: generateInviteCode(),
    maxUses: options.maxUses,
    usedCount: 0,
    expiresAt: options.expiresAt,
    active: true,
    note,
  };
}
