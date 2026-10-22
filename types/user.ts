/*
  FILE: types/user.ts
  WHAT IT'S FOR: What a user looks like when the app sends it to a page or an API response.
  WHO USES IT: Later: sign up and login (Section 4), Settings (Section 13), and any
  page that needs to know who's logged in.
  WHY THIS NAME: It describes users, in the types folder. It ends in .ts because it
  shows nothing on screen.
*/

// The user's chosen sportsbook is one of the three IDs from types/sportsbook.ts.
import type { SportsbookId } from "./sportsbook";

/*
  User: a logged-in user, safe to send to the browser.
  SECURITY: this type has NO password field on purpose. The hashed password only
  exists in the database model (Section 3). In Section 3 we'll write one helper
  that builds a User by copying ONLY the fields below out of the database record,
  so the password hash gets left behind. Pages and API responses will only ever
  send that User. This protects against safety-check problem #1.
*/
export type User = {
  /** The user's ID (from MongoDB). */
  id: string;
  /** The email they signed up with, saved in lowercase so "Me@X.com" and "me@x.com" count as the same person. */
  email: string;
  /** The sportsbook they picked in Settings. New users start with Hard Rock Bet. */
  preferredSportsbook: SportsbookId;
  /**
   * The slip the user is adding picks to right now (shown in the slip bar), or
   * null if they don't have one. Tapping the first odds button creates one.
   */
  activeBetSlipId: string | null;
  /** When the account was created (ISO date-time text). */
  createdAt: string;
};
