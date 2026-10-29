/*
  FILE: types/basketball.ts
  WHAT IT'S FOR: The shared shapes for the NBA team page and player page: season numbers per game,
  recent results, key players, and a player's game log. Basketball uses different numbers than football
  (points, rebounds, assists instead of passing yards), so these are separate from types/team.ts and types/player.ts.
  Any number ESPN doesn't have is null ("missing on purpose"), and the page shows a dash.
  WHO USES IT: lib/services/espn/basketball.ts and components/basketball/*.
  WHY THIS NAME: It's the types for basketball. It lives in types/ with the others and ends in .ts because it shows nothing on screen.
*/

import type { NewsArticle } from "./news";
import type { Player } from "./player";
import type { TeamSummary } from "./team";

/** NbaTeamStats: team averages per game this season. */
export type NbaTeamStats = {
  pointsFor: number | null;
  pointsAgainst: number | null;
  fieldGoalPct: number | null;
  threePointPct: number | null;
  reboundsPerGame: number | null;
  assistsPerGame: number | null;
  turnoversPerGame: number | null;
  homeRecord: string | null;
  awayRecord: string | null;
};

/** NbaTeamOverview: the top of the team page. */
export type NbaTeamOverview = {
  team: TeamSummary;
  /** Like "14th in Eastern Conference", or null if ESPN has none yet. */
  standing: string | null;
  stats: NbaTeamStats;
  /** The ESPN ID of the team's next game, or null if none is scheduled (missing on purpose). */
  nextGameId: string | null;
};

/** NbaTeamResult: one finished game in the team's "last 5 games" list. */
export type NbaTeamResult = {
  gameId: string;
  playedAt: string;
  opponent: TeamSummary;
  isHome: boolean;
  teamScore: number;
  opponentScore: number;
  result: "W" | "L";
};

/** NbaKeyPlayer: one of the team's top players this season, with per-game averages. */
export type NbaKeyPlayer = {
  id: string;
  name: string;
  position: string | null;
  jersey: string | null;
  photoUrl: string | null;
  pointsPerGame: number | null;
  reboundsPerGame: number | null;
  assistsPerGame: number | null;
};

/** NbaPlayerAverages: a player's per-game numbers (a season, or the average of some recent games). */
export type NbaPlayerAverages = {
  games: number | null;
  minutes: number | null;
  points: number | null;
  rebounds: number | null;
  assists: number | null;
  steals: number | null;
  blocks: number | null;
  turnovers: number | null;
  fieldGoalPct: number | null;
  threePointPct: number | null;
  freeThrowPct: number | null;
};

/** NbaPlayerGame: one row of a player's game log. */
export type NbaPlayerGame = {
  gameId: string;
  playedAt: string;
  opponentAbbreviation: string;
  isHome: boolean;
  result: "W" | "L" | null;
  /** The final score as "129-117" (away-home order from ESPN is NOT kept; this is team-opponent), or null. */
  score: string | null;
  minutes: number | null;
  points: number | null;
  rebounds: number | null;
  assists: number | null;
  steals: number | null;
  blocks: number | null;
  turnovers: number | null;
  /** Shots made-attempted as text, like "8-16". */
  fieldGoals: string | null;
  threePointers: string | null;
  freeThrows: string | null;
};

/** NbaPlayerDetails: everything on the NBA player page. */
export type NbaPlayerDetails = {
  player: Player;
  seasonAverages: NbaPlayerAverages;
  recentGames: NbaPlayerGame[];
  last5Average: NbaPlayerAverages;
  nextGameId: string | null;
  news: NewsArticle[];
};
