/*
  FILE: types/player.ts
  WHAT IT'S FOR: What a player looks like: name, photo, position, injury status,
  season stats, and game-by-game stats. Stats only. No past betting lines, on purpose.
  WHO USES IT: types/team.ts (injuries) and types/search.ts. Later: the player page
  (Section 11B), the team page (Section 11), and the ESPN code (Section 5).
  WHY THIS NAME: It describes players, in the types folder. It ends in .ts because
  it shows nothing on screen.
*/

// A player's team is the same short team description used on game cards.
import type { TeamSummary } from "./team";
// The player's latest news uses the shared news definition.
import type { NewsArticle } from "./news";

/*
  PositionGroup: which kind of stats to show for a player.
  - "QB": quarterbacks get passing stats.
  - "RB": running backs get rushing stats.
  - "WR-TE": wide receivers and tight ends get receiving stats.
  - "OTHER": everyone else (kickers, defense) gets a basic stat list.
*/
export type PositionGroup = "QB" | "RB" | "WR-TE" | "OTHER";

/*
  PlayerStatKey: the name of each stat we track. Using a fixed list means a typo
  like "passYrds" is caught by TypeScript instead of quietly showing nothing.
*/
export type PlayerStatKey =
  | "passCompletions" // Passes caught
  | "passAttempts" // Passes thrown
  | "passYards" // Yards gained by passing
  | "passTouchdowns" // Touchdown passes
  | "interceptions" // Passes caught by the other team
  | "rushAttempts" // Times the player ran with the ball
  | "rushYards" // Yards gained running
  | "rushTouchdowns" // Touchdowns scored running
  | "receptions" // Passes the player caught
  | "targets" // Passes thrown to the player
  | "receivingYards" // Yards gained after catching passes
  | "receivingTouchdowns"; // Touchdowns scored catching passes

/*
  PlayerStats: a set of stats. "Partial" means not every stat has to be there.
  A running back usually has no passing stats, so those are left out.
*/
export type PlayerStats = Partial<Record<PlayerStatKey, number>>;

/*
  PlayerSummary: the short version of a player, used in lists, prop tables, and search results.
*/
export type PlayerSummary = {
  /** ESPN's ID for the player. Used in the address: /player/<id>. */
  id: string;
  /** Full name, like "Patrick Mahomes". */
  name: string;
  /** Position code, like "QB", "RB", "WR", "TE". null if unknown. */
  position: string | null;
  /** The team's short code, like "KC". null if the player isn't on a team. */
  teamAbbreviation: string | null;
};

/*
  Player: everything about a player for the top of the player page.
*/
export type Player = PlayerSummary & {
  /** Jersey number as text (some leagues use numbers like "00"). null if unknown. */
  jersey: string | null;
  /** Which kind of stats to show (see PositionGroup above). */
  positionGroup: PositionGroup;
  /** The player's team, or null for free agents. */
  team: TeamSummary | null;
  /** Web address of the player's photo, or null if there isn't one. */
  photoUrl: string | null;
  /** Injury status, like "Questionable" or "Out". null means healthy (no injury listed). */
  injuryStatus: string | null;
};

/*
  PlayerGameLog: one row in the "last 10 games" table on the player page.
*/
export type PlayerGameLog = {
  /** The game's ID. */
  gameId: string;
  /** When it was played, as ISO date-time text. */
  playedAt: string;
  /** The other team's short code, like "LV". */
  opponentAbbreviation: string;
  /** true if the player's team was at home ("vs LV"), false if away ("@ LV"). */
  isHome: boolean;
  /** "W", "L", or "T" for the player's team, or null if unknown. */
  result: "W" | "L" | "T" | null;
  /** The player's stats in that game. */
  stats: PlayerStats;
};

/*
  PlayerDetails: everything on the player page except the live props, which load
  separately to save Odds API requests.
*/
export type PlayerDetails = {
  /** Name, photo, number, position, team, and injury status. */
  player: Player;
  /** This season's totals. */
  seasonStats: PlayerStats;
  /** The last 10 games, newest first. */
  recentGames: PlayerGameLog[];
  /** Averages over the last 5 games. */
  last5Average: PlayerStats;
  /** Averages over the last 10 games. */
  last10Average: PlayerStats;
  /** The ID of the player's next game, so the page can link to it. null if none is scheduled. */
  nextGameId: string | null;
  /** Latest news about the player. */
  news: NewsArticle[];
};

/*
  Injury: one injured player, shown at the bottom of the team page.
*/
export type Injury = {
  /** The player, so their name can link to the player page. */
  player: PlayerSummary;
  /** Status, like "Out", "Doubtful", "Questionable", or "Injured Reserve". */
  status: string;
  /** What's wrong, like "Ankle". Plain text. Can be empty. */
  detail: string;
  /** When this injury report was last updated, as ISO date-time text. null if unknown. */
  updatedAt: string | null;
};
