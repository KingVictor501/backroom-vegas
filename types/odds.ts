/*
  FILE: types/odds.ts
  WHAT IT'S FOR: What odds look like everywhere in the app: a single price, a
  betting market (like "Spread"), and the three game lines (Spread, Total, Winner)
  shown on every game card.
  WHO USES IT: types/game.ts, types/props.ts, and types/betslip.ts. Later: the odds
  code (Section 5), the odds buttons (Section 8), and the game pages.
  WHY THIS NAME: It's all about odds, in the types folder. It ends in .ts because
  it shows nothing on screen.
*/

// Each market remembers which sportsbook its prices came from.
import type { SportsbookId } from "./sportsbook";

/*
  AmericanOdds: a price written the American way, as a whole number.
  - Negative (like -110): the favorite. You'd risk $110 to win $100.
  - Positive (like +150): the underdog. A $100 bet would win $150.
  It's stored as a number (-110 or 150). The "+" sign is only added on screen.
*/
export type AmericanOdds = number;

/*
  A note on the lists below (MARKET_CATEGORIES, GAME_PERIODS, ...): each one is a
  real list the database and the server can check against, so they can reject
  bad data like side: "sideways". The type right under each list is built from
  it, so the list and the type can never disagree.
*/

/*
  MARKET_CATEGORIES / MarketCategory: which group of bets a market belongs to.
  These match the row of links on the matchup page.
*/
export const MARKET_CATEGORIES = [
  "game-lines", // Spread, Total, Winner (moneyline)
  "player-props", // One player's stats: passing yards, touchdowns, and so on
  "team-props", // One team's stats, like team total points
  "halves", // Game lines for the 1st or 2nd half only
  "quarters", // Game lines for one quarter only
  "dst", // Defense and special teams
  "specials", // Anything else the sportsbook offers for the game
] as const;
export type MarketCategory = (typeof MARKET_CATEGORIES)[number];

/*
  GAME_PERIODS / GamePeriod: which part of the game a bet covers.
  Most bets are "full-game". Halves and quarters bets only count that part.
*/
export const GAME_PERIODS = [
  "full-game",
  "first-half",
  "second-half",
  "q1",
  "q2",
  "q3",
  "q4",
] as const;
export type GamePeriod = (typeof GAME_PERIODS)[number];

/*
  PICK_SIDES / PickSide: which side of a bet a pick is on.
  - "home" / "away": a team (spread or winner).
  - "over" / "under": a total (game points, or a player's passing yards).
  - "yes" / "no": something happens or not (like "scores a touchdown").
*/
export const PICK_SIDES = ["home", "away", "over", "under", "yes", "no"] as const;
export type PickSide = (typeof PICK_SIDES)[number];

/*
  PARTICIPANT_KINDS / ParticipantKind: what a bet is about.
  - "game": the whole game (like the game's total points).
  - "team": one team (spread, winner, team total).
  - "player": one player (player props).
*/
export const PARTICIPANT_KINDS = ["game", "team", "player"] as const;
export type ParticipantKind = (typeof PARTICIPANT_KINDS)[number];

/*
  Participant: who or what a bet is about.
*/
export type Participant = {
  /** Whether the bet is about the whole game, one team, or one player. */
  kind: ParticipantKind;
  /** Our ID for the team or player (from ESPN), or null for the whole game or if we couldn't match the name. */
  id: string | null;
  /** The name to show, like "Kansas City Chiefs", "Patrick Mahomes", or "Game". */
  name: string;
};

/*
  MarketOutcome: one choice inside a market, meaning one odds button.
  Example: in the Spread market, "Chiefs -3 at -110" is one outcome.
*/
export type MarketOutcome = {
  /** Which side this outcome is (home, away, over, under, yes, no). */
  side: PickSide;
  /** Who it's about (the team, the player, or the whole game). */
  participant: Participant;
  /**
   * The number the bet is measured against, if there is one:
   * -3 for a spread, 47.5 for a total, 249.5 for passing yards.
   * null for bets with no line, like the Winner (moneyline) or "anytime touchdown".
   */
  line: number | null;
  /** The price, like -110 or 150. */
  odds: AmericanOdds;
};

/*
  Market: one bet type for one game, from one sportsbook, with all its outcomes.
  Example: "Spread, full game, Hard Rock Bet" with two outcomes (Chiefs -3, Raiders +3).
*/
export type Market = {
  /**
   * The market's name in The Odds API, like "spreads", "totals", "h2h" (winner),
   * or "player_pass_yds". We'll confirm the real names from your Postman samples in Section 5.
   */
  key: string;
  /** The group it belongs to (game lines, player props, ...). */
  category: MarketCategory;
  /** The label to show, like "Spread" or "Passing Yards". */
  label: string;
  /** Which part of the game it covers. */
  period: GamePeriod;
  /** The sportsbook these prices came from. */
  sportsbook: SportsbookId;
  /** Every choice in this market (each one is an odds button). */
  outcomes: MarketOutcome[];
  /** When the sportsbook last changed these prices, as date-time text (ISO format). */
  lastUpdated: string;
};

/*
  GameLines: the three-column odds table on each game card, with Spread, Total, and Winner.
  Any value can be null when the sportsbook isn't offering that bet right now.
  The page then shows a dash instead of crashing.
*/
export type GameLines = {
  /** The sportsbook these lines came from, shown on the card as "Odds from Hard Rock Bet". */
  sportsbook: SportsbookId;
  /** Spread: one outcome for each team, like Chiefs -3 and Raiders +3. */
  spread: { away: MarketOutcome | null; home: MarketOutcome | null };
  /** Total: over and under the same number of combined points, like 47.5. */
  total: { over: MarketOutcome | null; under: MarketOutcome | null };
  /** Winner (moneyline): who wins outright, with no line. */
  moneyline: { away: MarketOutcome | null; home: MarketOutcome | null };
};

/*
  MarketSectionRow: one row inside a collapsible section on the matchup page.
  The name is on the left and the odds buttons on the right, like
  "Patrick Mahomes   [O 274.5 -115] [U 274.5 -105]" or "Chiefs   [-1.5 -110]".
*/
export type MarketSectionRow = {
  /** A unique key for the row (the team or player ID, or their name). */
  key: string;
  /** The words on the left: a team nickname, a player name, or "Game". */
  label: string;
  /** Where the name links to (a player or team page), or null when there's no page (missing on purpose). */
  href: string | null;
  /** The odds buttons for this row. */
  outcomes: MarketOutcome[];
};

/*
  MarketSection: one collapsible section on the matchup page, like "TD Scorers"
  or "Spread (1st Half)". Every tab (Player Props, Team Props, Halves, Quarters,
  D/ST, Game Specials) is a list of these, so they all look and work the same.
*/
export type MarketSection = {
  /** The heading, like "TD Scorers". */
  title: string;
  /** Which market it is, so each odds button can become a bet slip pick. */
  market: Pick<Market, "key" | "category" | "label" | "period">;
  /** One row per team, player, or the whole game. */
  rows: MarketSectionRow[];
};
