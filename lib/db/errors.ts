/*
  FILE: lib/db/errors.ts
  WHAT IT'S FOR: Small helpers for recognizing database errors.
  WHO USES IT: app/actions/auth.ts (an email that's already used) and
  lib/db/betslips.ts (a slip name you already have).
  WHY THIS NAME: It's about database errors, in the db folder. It ends in .ts
  because it shows nothing on screen.
*/

/*
  isDuplicateKeyError: true if MongoDB refused to save because a value that must
  be unique is already used. MongoDB's error code 11000 means "duplicate".
*/
export function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 11000
  );
}
