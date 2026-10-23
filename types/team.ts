/*
  FILE: types/team.ts
  WHAT IT'S FOR: What a team looks like: the short version shown on game cards,
  and the full version for the team page (season stats, recent games, injuries).
  Stats only. There are no betting lines or past odds here, on purpose.
  WHO USES IT: types/game.ts, types/player.ts, and types/search.ts. Later: the team
  page (Section 11) and the ESPN code (Section 5).
  WHY THIS NAME: It describes teams, in the types folder. It ends in .ts because it
  shows nothing on screen.
*/

// Injuries and news use their own shared definitions, so the team page and the
// player page show them the same way.
import type { Injury, PlayerGameLog, PlayerStats, PlayerSummary, PositionGroup } from "./player";
import type { NewsArticle } from "./news";

/*
  TeamSummary: the short version of a team, used anywhere a team appears
  (game cards, the matchup page header, search results).
*/
export type TeamSummary = {
  /** ESPN's ID for the team (like "12" for the Chiefs). Used in the address: /team/12. */
  id: string;
  /** The short code, like "KC". Used in names like "KC @ LV". */
  abbreviation: string;
  /** The city or school, like "Kansas City". */
  location: string;
  /** The nickname, like "Chiefs". */
  name: string;
  /** The full name, like "Kansas City Chiefs". */
  displayName: string;
  /** Web address of the team logo (from ESPN), or null if there isn't one. */
  logoUrl: string | null;
  /** Wins and losses this season, like "5-2" (or "5-2-1" with a tie). null if unknown. */
  record: string | null;
};

/*
  TeamSeasonStats: season totals for the team page. Each number is null when the
  API doesn't have it, and the page shows a dash.
*/
export type TeamSeasonStats = {
  /** Total points the team has scored this season. */
  pointsFor: number | null;
  /** Total points opponents have scored against them. */
  pointsAgainst: number | null;
  /** Average total yards gained per game. */
  totalYardsPerGame: number | null;
  /** Average passing yards per game. */
  passingYardsPerGame: number | null;
  /** Average rushing yards per game. */
  rushingYardsPerGame: number | null;
  /** Times the team lost the ball (interceptions thrown plus fumbles lost). */
  turnovers: number | null;
  /** Record in home games, like "3-1". */
  homeRecord: string | null;
  /** Record in away games, like "2-1". */
  awayRecord: string | null;
};

/*
  TeamGameResult: one finished game in the "last 5 games" list on the team page.
*/
export type TeamGameResult = {
  /** The game's ID, so the row can link to that game. */
  gameId: string;
  /** When the game was played, as date-time text (ISO format). */
  playedAt: string;
  /** Who they played. */
  opponent: TeamSummary;
  /** true if this team was at home. */
  isHome: boolean;
  /** This team's final score. */
  teamScore: number;
  /** The opponent's final score. */
  opponentScore: number;
  /** "W" for win, "L" for loss, "T" for tie. */
  result: "W" | "L" | "T";
  /** This team's stats in that game, as label/value pairs, like { label: "Total Yards", value: 412 }. */
  stats: StatValue[];
};

/*
  StatValue: one stat with its label, like "Passing Yards: 287".
  Used for lists of stats where the exact set depends on what the API gives us.
*/
export type StatValue = {
  /** What the number means, like "Passing Yards". */
  label: string;
  /** The number itself, or null if it's missing. */
  value: number | null;
};

/*
  TeamDetails: everything on the team page.
*/
export type TeamDetails = {
  /** The team's name, logo, and record. */
  team: TeamSummary;
  /** The division, like "AFC West". null if unknown. */
  division: string | null;
  /** Place in the division, like "2nd in AFC West". null if unknown. */
  divisionStanding: string | null;
  /** Season totals. */
  seasonStats: TeamSeasonStats;
  /** The last 5 finished games, newest first. */
  recentGames: TeamGameResult[];
  /** Current injuries on the team. */
  injuries: Injury[];
  /** Latest team news. */
  news: NewsArticle[];
};

/*
  TeamKeyPlayer: one key player on the team page (the starting QB, a top
  running back, or a top receiver) with their last 5 games and the average.
*/
export type TeamKeyPlayer = {
  /** The player (their name links to the player page), with photo and jersey number. */
  player: PlayerSummary & { jersey: string | null; photoUrl: string | null };
  /** Which stats to show: QB = passing, RB = rushing, WR-TE = receiving. */
  role: Exclude<PositionGroup, "OTHER">;
  /** Their last 5 games, newest first (fewer early in the season). */
  games: PlayerGameLog[];
  /** The average of those games, for the bottom row. */
  average: PlayerStats;
};
