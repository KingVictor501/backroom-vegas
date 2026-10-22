/*
  FILE: types/league.ts
  WHAT IT'S FOR: The type for "which league" (nfl, nba, ...), built straight from
  the list in config/leagues.ts. Adding a league there automatically updates this type.
  WHO USES IT: types/game.ts and types/betslip.ts. Later: the league page and the API code.
  WHY THIS NAME: It describes league data, so it's in the types folder. It ends in
  .ts because it shows nothing on screen.
*/

// LEAGUES is the one list of leagues in config/leagues.ts. We build the type from it
// instead of typing the names a second time, so the two can never disagree.
import type { LEAGUES } from "@/config/leagues";

/*
  LeagueSlug: one of the league IDs from config/leagues.ts:
  "nfl" | "nba" | "nhl" | "mlb" | "ncaaf" | "ncaabb" | "wnba".
*/
export type LeagueSlug = (typeof LEAGUES)[number]["slug"];

// The full description of a league (label, icon, whether it's turned on, ...).
// It lives in config/leagues.ts. We re-share it here so every type can be imported from "@/types".
export type { LeagueConfig } from "@/config/leagues";
