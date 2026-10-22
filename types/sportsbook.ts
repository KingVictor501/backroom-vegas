/*
  FILE: types/sportsbook.ts
  WHAT IT'S FOR: The one definition of "which sportsbook" the app supports:
  Hard Rock Bet, BetMGM, and Caesars.
  WHO USES IT: config/sportsbooks.ts (names and the default book), types/odds.ts,
  types/betslip.ts, and types/user.ts. Later: the Settings page, the odds code,
  and the bet slip API.
  WHY THIS NAME: It's in the types folder because it describes the shape of data.
  It ends in .ts because it shows nothing on screen.
*/

/*
  SPORTSBOOK_IDS: the ID for each sportsbook, using the exact names The Odds API
  uses for them (we'll confirm these in Postman in Section 5).
  Caesars shows up as "williamhill_us" because Caesars bought William Hill and
  The Odds API kept the old name.
  This is a real list (not just a type) so the server can check that a request
  names one of these three books and nothing else.
*/
export const SPORTSBOOK_IDS = ["hardrockbet", "betmgm", "williamhill_us"] as const;

/*
  SportsbookId: exactly one of the three IDs above. TypeScript turns the list into
  "hardrockbet" | "betmgm" | "williamhill_us", so a typo like "betmgn" is an error.
*/
export type SportsbookId = (typeof SPORTSBOOK_IDS)[number];

/*
  isSportsbookId: checks whether some text is one of our three sportsbook IDs.
  Useful when the text comes from a form or a request, where it could be anything.
*/
export function isSportsbookId(value: string): value is SportsbookId {
  return (SPORTSBOOK_IDS as readonly string[]).includes(value);
}
