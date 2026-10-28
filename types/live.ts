/*
  FILE: types/live.ts
  WHAT IT'S FOR: What live score information looks like, and how a pick is graded against it.
  - LiveGame: one game's score, quarter, and clock right now (or "Final"). It is
    league-neutral: screens show its ready-made `label` ("Q3 7:32", "Halftime", "Final/OT"),
    so they never assume a sport has quarters. That keeps NBA, WNBA, and others easy to add.
  - LivePlayerStats: one player's box score numbers, used to grade player props.
  - PickGrade: where a pick stands: not started, in play (winning/losing/push), or finished.
  WHO USES IT: lib/services/espn/live.ts (builds it), app/api/live/route.ts (sends it),
  lib/betting/grading.ts (grades picks), and the live score components.
  WHY THIS NAME: It describes live scores, in the types folder. It ends in .ts because it shows
  nothing on screen.
*/

import type { GameStatus } from "./game";
import type { LeagueSlug } from "./league";

/*
  LivePlayerStats: one player's numbers in this game.
  stats is keyed like "passing.passingYards" or "receiving.receptions" (the box score group,
  a dot, then ESPN's own stat name). A stat a player has not recorded is simply missing.
*/
export type LivePlayerStats = {
  /** The player's name, used to match a pick when we don't have the player's ID. */
  name: string;
  stats: Record<string, number>;
};

/*
  LiveGame: one game's live state.
  Times and clocks are ESPN's own text. Scores are null before the game starts (missing on purpose).
*/
export type LiveGame = {
  /** Our game ID (ESPN's event ID), the same one used in /matchup/<id>. */
  gameId: string;
  league: LeagueSlug;
  /** scheduled, in-progress, final, postponed, or canceled. */
  status: GameStatus;
  /** Ready-to-show words: "Q3 7:32", "Halftime", "End of Q1", "Final", "Final/OT", "Scheduled". */
  label: string;
  /** The current period number (1 to 4, then 5+ for overtime). null before the game starts. */
  period: number | null;
  /** The clock within the period, like "7:32". null before the game starts. */
  clock: string | null;
  /** true while the game is at halftime, so first-half bets are already decided. */
  halftime: boolean;
  awayTeamId: string;
  homeTeamId: string;
  awayScore: number | null;
  homeScore: number | null;
  /** Points scored in each period so far, in order, like [7, 3, 0]. Empty when ESPN has none. */
  awayPeriods: number[];
  homePeriods: number[];
  /**
   * Each player's box score, keyed by ESPN player ID. null when the box score wasn't asked for
   * or isn't available (missing on purpose: player props then just say "Live").
   */
  players: Record<string, LivePlayerStats> | null;
  /** When this information was fetched (ISO date-time text). */
  updatedAt: string;
};

/*
  PickGrade: where one pick stands.
  - phase "pending": the game hasn't started
  - phase "live": being played. outcome says who is ahead right now, or null if we can't tell
    (a prop with no box score yet, for example) so the screen just says "Live"
  - phase "final": decided. outcome is win, lose, or push; null if we can't grade this kind of bet
  outcome is null whenever there is nothing to say (missing on purpose).
*/
export type PickOutcome = "win" | "lose" | "push";
export type PickGrade = { phase: "pending" | "live" | "final"; outcome: PickOutcome | null };

/* What the live scores route sends back. `delayed` is not part of it: the browser adds that itself when a refresh fails. */
export type LiveScoresResponse = { games: LiveGame[] };
