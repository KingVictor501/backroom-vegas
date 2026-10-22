/*
  FILE: types/props.ts
  WHAT IT'S FOR: What player props look like. A "prop" (short for proposition) is
  a bet on one player's stats, like "Mahomes over 274.5 passing yards" or
  "Kelce scores a touchdown".
  WHO USES IT: Later: the props code (Section 5), the Player Props tab on the
  matchup page (Section 10), and the player page (Section 11B).
  WHY THIS NAME: It describes props, in the types folder. It ends in .ts because
  it shows nothing on screen.
*/

// A prop is a kind of market, and each player row has outcomes (odds buttons), from types/odds.ts.
import type { GamePeriod, MarketOutcome } from "./odds";
// Each prop row is about one player.
import type { PlayerSummary } from "./player";
// Each group of props remembers which sportsbook it came from.
import type { SportsbookId } from "./sportsbook";

/*
  PropCategory: the buttons inside Player Props on the matchup page.
*/
export type PropCategory =
  | "touchdowns"
  | "passing"
  | "rushing"
  | "receiving"
  | "receptions";

/*
  PlayerPropRow: one row in a prop table, with the player on the left and their odds on the right.
  Example: "Patrick Mahomes, Over 274.5 (-115), Under 274.5 (-105)".
*/
export type PlayerPropRow = {
  /**
   * The player. The Odds API only gives a name, so we try to match it to an ESPN
   * player. If we can't, the name still shows but won't link to a player page.
   */
  player: PlayerSummary | { id: null; name: string };
  /** The odds buttons for this player: usually over and under, or just "yes" for touchdowns. */
  outcomes: MarketOutcome[];
};

/*
  PropSection: one collapsible section, like "TD Scorers" or "First TD Scorer".
*/
export type PropSection = {
  /** The market's name in The Odds API, like "player_anytime_td". Confirmed in Section 5. */
  marketKey: string;
  /** The section title to show, like "TD Scorers". */
  title: string;
  /** Which part of the game (for "1st Half TDs", this is "first-half"). */
  period: GamePeriod;
  /** One row per player. */
  rows: PlayerPropRow[];
};

/*
  GameProps: all props for one game and one prop category, from one sportsbook.
  Example: every Touchdowns section for KC @ LV at Hard Rock Bet.
  sections is empty when the sportsbook doesn't offer these props, and the page
  then suggests trying another book in Settings.
*/
export type GameProps = {
  /** The game these props are for. */
  gameId: string;
  /** Which button was tapped (touchdowns, passing, ...). */
  category: PropCategory;
  /** The sportsbook the odds came from. */
  sportsbook: SportsbookId;
  /** The collapsible sections, in the order to show them. */
  sections: PropSection[];
};
