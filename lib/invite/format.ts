/*
  FILE: lib/invite/format.ts
  WHAT IT'S FOR: What an invite code looks like, and the messages and form
  state around entering one. An invite code looks like BRV-7K2M-Q9XD:
  "BRV" (backroom vegas), then two groups of four letters and numbers.
  The letters and numbers come from a list with the easy-to-mix-up ones left out
  (no 0 or O, no 1, I, or L), so a code read aloud or typed from a screenshot
  isn't misread. 31 choices for each of 8 spots is about 850 billion possible codes.
  WHO USES IT: app/actions/invite.ts (checks what a visitor typed),
  components/auth/InviteForm.tsx (the form's starting state),
  lib/db/models/InviteCode.ts (the database's format rule), and
  lib/invite/generate.ts (makes new codes).
  WHY THIS NAME: It's about the "format" of an invite code. It lives in lib/invite
  with the other invite helpers, and ends in .ts because it shows nothing on screen.
  It imports nothing and has no secrets, so the browser can use it too.
*/

/** The characters a code may use. No 0, O, 1, I, or L, because they look alike. */
export const INVITE_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** A valid code: BRV, a dash, 4 characters, a dash, 4 characters (all capitals). */
export const INVITE_CODE_PATTERN = new RegExp(
  `^BRV-[${INVITE_CODE_ALPHABET}]{4}-[${INVITE_CODE_ALPHABET}]{4}$`,
);

/** The most sign ups one code may allow. A sanity limit, so a typo like 100000 is refused. */
export const INVITE_MAX_USES_LIMIT = 1000;

/** The longest note ("graders", "for Sam") we keep with a code. */
export const INVITE_NOTE_MAX_LENGTH = 100;

/*
  The ONE message for every kind of bad code (wrong, used up, expired, turned
  off). It never says which, so nobody can learn anything by guessing.
*/
export const INVALID_INVITE_MESSAGE = "That invite code isn't valid.";

/*
  normalizeInviteCode: tidies what a visitor typed, then checks its shape.
  Spaces around it are removed and letters are made capital, so "brv-7k2m-q9xd "
  works. Returns the clean code, or null if it isn't shaped like a code (null is
  missing on purpose: "that's not a code"). Anything that isn't text (a number,
  an object, a list) is also null. This only checks the SHAPE; the database
  decides if the code is real.
*/
export function normalizeInviteCode(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const code = input.trim().toUpperCase();
  return INVITE_CODE_PATTERN.test(code) ? code : null;
}

/*
  InviteFormState: what the invite Server Action sends back to the form after a
  failed try.
  - message: one red message for the whole form, or null if there isn't one (missing on purpose).
  - code: what the visitor typed, so they can fix a typo instead of retyping everything.
*/
export type InviteFormState = {
  message: string | null;
  code: string;
};

/** The form's starting state: no message, empty box. */
export const EMPTY_INVITE_FORM_STATE: InviteFormState = { message: null, code: "" };
