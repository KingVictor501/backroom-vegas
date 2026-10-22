/*
  FILE: config/sportsbooks.ts
  WHAT IT'S FOR: Everything about each sportsbook in one place: the name to show,
  which book is the default (Hard Rock Bet), and what each outside odds API
  calls that book.
  WHO USES IT: lib/db/models/User.ts (the default book for new users). Later: the
  Settings page cards (Section 13), the "Odds from ___" label on the Feed
  (Section 9), and the odds code (Section 5), which uses the provider names below.
  WHY THIS NAME: It's settings about sportsbooks, kept next to config/leagues.ts.
  It ends in .ts because it's plain data, not something on screen.
*/

// SportsbookId comes from types/sportsbook.ts, so this file and the rest of the
// app agree on exactly which three books exist.
import type { SportsbookId } from "@/types/sportsbook";

/*
  SportsbookConfig: what we know about one sportsbook.
*/
type SportsbookConfig = {
  /** The name to show on screen, like "Hard Rock Bet". */
  readonly name: string;
  /**
   * What each odds provider calls this book. The odds code (Section 5) uses these
   * to ask a provider for a book's odds and to turn the provider's name back into our ID.
   * These come from each provider's docs. We'll confirm them in Postman before Section 5.
   */
  readonly providerKeys: {
    /** The Odds API's name for this book (the-odds-api.com). */
    readonly theOddsApi: string;
    /** Parlay API's name for this book (parlay-api.com). */
    readonly parlayApi: string;
  };
};

/*
  SPORTSBOOKS: the details for each sportsbook ID.
  "Record<SportsbookId, ...>" means TypeScript makes us fill in all three books,
  so adding a fourth book later without its details would be an error.
*/
export const SPORTSBOOKS: Record<SportsbookId, SportsbookConfig> = {
  hardrock: {
    name: "Hard Rock Bet",
    providerKeys: { theOddsApi: "hardrockbet", parlayApi: "hardrock" },
  },
  betmgm: {
    name: "BetMGM",
    providerKeys: { theOddsApi: "betmgm", parlayApi: "betmgm" },
  },
  caesars: {
    name: "Caesars",
    // The Odds API still uses William Hill's old name, because Caesars bought William Hill.
    providerKeys: { theOddsApi: "williamhill_us", parlayApi: "caesars" },
  },
};

/** The sportsbook a new user starts with, until they pick another in Settings. */
export const DEFAULT_SPORTSBOOK: SportsbookId = "hardrock";
