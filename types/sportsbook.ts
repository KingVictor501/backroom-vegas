/*
  FILE: types/sportsbook.ts
  WHAT IT'S FOR: The one definition of "which sportsbook" the app supports:
  Hard Rock Bet, BetMGM, and Caesars.
  WHO USES IT: config/sportsbooks.ts (names, the default book, and each odds
  provider's name for it), types/odds.ts, types/betslip.ts, types/user.ts, and
  the database models. Later: the Settings page, the odds code, and the bet slip API.
  WHY THIS NAME: It's in the types folder because it describes the shape of data.
  It ends in .ts because it shows nothing on screen.
*/

/*
  SPORTSBOOK_IDS: OUR OWN ID for each sportsbook.
  These are deliberately NOT the names an outside odds API uses. Each provider
  spells them differently (The Odds API says "hardrockbet" and "williamhill_us",
  Parlay API says "hardrock" and "caesars"). config/sportsbooks.ts maps our IDs
  to each provider's names, so switching providers only changes that mapping and
  the Section 5 code, never the pages, the database, or saved bet slips.
  This is a real list (not just a type) so the server can check that a request
  names one of these three books and nothing else.
*/
export const SPORTSBOOK_IDS = ["hardrock", "betmgm", "caesars"] as const;

/*
  SportsbookId: exactly one of the three IDs above. TypeScript turns the list into
  "hardrock" | "betmgm" | "caesars", so a typo like "betmgn" is an error.
*/
export type SportsbookId = (typeof SPORTSBOOK_IDS)[number];

/*
  isSportsbookId: checks whether some text is one of our three sportsbook IDs.
  Useful when the text comes from a form or a request, where it could be anything.
*/
export function isSportsbookId(value: string): value is SportsbookId {
  return (SPORTSBOOK_IDS as readonly string[]).includes(value);
}
