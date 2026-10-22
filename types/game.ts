/*
  FILE: types/game.ts
  WHAT IT'S FOR: What a game (matchup) looks like: the two teams, the start time,
  its status, and its odds.
  WHO USES IT: types/betslip.ts. Later: the Feed and league pages (Section 9), the
  matchup page (Section 10), and the code that matches games between the NFL API
  and The Odds API (Section 5).
  WHY THIS NAME: It describes games, in the types folder. It ends in .ts because it
  shows nothing on screen.
*/

// The league a game belongs to, built from config/leagues.ts.
import type { LeagueSlug } from "./league";
// The Spread / Total / Winner odds table, from types/odds.ts.
import type { GameLines } from "./odds";
// Each game has two teams, described in types/team.ts.
import type { TeamSummary } from "./team";

/*
  GameStatus: where the game is right now.
  Picks for games that are "in-progress" or "final" get marked "Started" on bet slips.
*/
export type GameStatus =
  | "scheduled" // Hasn't started yet
  | "in-progress" // Being played right now
  | "final" // Finished
  | "postponed" // Moved to a later date
  | "canceled"; // Won't be played

/*
  Game: one matchup.
  Times are stored as text in ISO format, like "2026-10-25T20:25:00Z" ("Z" means
  UTC, the world's standard time). Each page turns it into the user's own time zone.
  We use text instead of a JavaScript Date because text can be sent as JSON
  from the API and into browser components without changing.
*/
export type Game = {
  /** Our ID for the game (ESPN's event ID). Used in the address: /matchup/<id>. */
  id: string;
  /** Which league, like "nfl". */
  league: LeagueSlug;
  /** Kickoff time, as ISO date-time text in UTC. */
  startsAt: string;
  /** Where the game is right now. */
  status: GameStatus;
  /** The visiting team (listed first, as in "KC @ LV"). */
  awayTeam: TeamSummary;
  /** The home team. */
  homeTeam: TeamSummary;
  /** Away team's score. null before the game starts. */
  awayScore: number | null;
  /** Home team's score. null before the game starts. */
  homeScore: number | null;
  /** The stadium name, or null if unknown. */
  venue: string | null;
  /**
   * The Odds API's ID for this same game. The two APIs use different IDs, so we
   * match games by team names and date (Section 5) and save the match here.
   * null if we couldn't find the game in The Odds API.
   */
  oddsEventId: string | null;
  /**
   * Each team's chance of winning, from 0 to 100, if the NFL API provides it.
   * null when it's not available. Only the matchup page shows this.
   */
  winProbability: { away: number; home: number } | null;
};

/*
  GameWithLines: a game plus its Spread / Total / Winner odds, for game cards.
  lines is null when the sportsbook has no odds for the game yet (cards show dashes).
*/
export type GameWithLines = Game & {
  lines: GameLines | null;
};
