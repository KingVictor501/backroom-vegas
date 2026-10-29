/*
  FILE: types/gameStats.ts
  WHAT IT'S FOR: The shared shapes for the "Live stats" / "Final stats" section of the matchup page:
  each team's game numbers side by side, and the players' box score tables.
  WHO USES IT: lib/services/espn/gameStats.ts and components/matchup/GameStats.tsx.
  WHY THIS NAME: It's the types for a game's stats. It ends in .ts because it shows nothing on screen.
*/

import type { GameStatus } from "./game";

/** GameStatsTable: one box score table (like "Passing" or "Players") for one team. */
export type GameStatsTable = {
  title: string;
  /** Column headings after the player's name, like ["MIN", "PTS"]. */
  columns: string[];
  rows: { playerId: string; name: string; values: string[] }[];
};

/** GameStatsTeam: one team's numbers for this game. */
export type GameStatsTeam = {
  teamId: string;
  /** Team-level numbers like { label: "Total Yards", value: "312" }, already trimmed to the useful ones. */
  stats: { label: string; value: string }[];
  tables: GameStatsTable[];
};

/** GameStats: everything the matchup page shows for a game that has started. */
export type GameStats = {
  status: GameStatus;
  startsAt: string;
  /** Away team first, then home team. */
  teams: [GameStatsTeam, GameStatsTeam];
};
