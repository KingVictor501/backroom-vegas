/*
  FILE: config/sportsbooks.ts
  WHAT IT'S FOR: The display names for each sportsbook and which one is the default
  (Hard Rock Bet). Kept in config so names live in one place.
  WHO USES IT: Later: the Settings page cards (Section 13), the "odds from ___"
  label on the Feed (Section 9), and new user accounts (Section 4).
  WHY THIS NAME: It's settings about sportsbooks, kept next to config/leagues.ts.
  It ends in .ts because it's plain data, not something on screen.
*/

// SportsbookId comes from types/sportsbook.ts, so this file and the rest of the
// app agree on exactly which three books exist.
import type { SportsbookId } from "@/types/sportsbook";

/*
  SPORTSBOOKS: the name to show for each sportsbook ID.
  "Record<SportsbookId, ...>" means TypeScript makes us list all three books,
  so adding a fourth book later without a name would be an error.
*/
export const SPORTSBOOKS: Record<SportsbookId, { readonly name: string }> = {
  hardrockbet: { name: "Hard Rock Bet" },
  betmgm: { name: "BetMGM" },
  williamhill_us: { name: "Caesars" },
};

/** The sportsbook a new user starts with, until they pick another in Settings. */
export const DEFAULT_SPORTSBOOK: SportsbookId = "hardrockbet";
