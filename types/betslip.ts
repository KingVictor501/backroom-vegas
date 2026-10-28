/*
  FILE: types/betslip.ts
  WHAT IT'S FOR: THE one shared definition of a bet slip and of a pick on a slip.
  Every part of the app that touches bet slips uses these: the bet slip API
  (app/api/betslips), the database model, the Bet Slips list page, the detail
  page, the odds buttons, and the slip bar. That way they all agree on what a
  bet slip looks like. (The rubric checks for this.)
  WHO USES IT: types/user.ts now. Later: Sections 3, 7, 8, and 12.
  WHY THIS NAME: It describes bet slips, in the types folder. It ends in .ts
  because it shows nothing on screen.
*/

// The league a pick's game belongs to, built from config/leagues.ts.
import type { LeagueSlug } from "./league";
// The pieces of a pick (its price, side, part of the game, and who it's about), from types/odds.ts.
import type {
  AmericanOdds,
  GamePeriod,
  MarketCategory,
  Participant,
  PickSide,
} from "./odds";
// Each pick remembers which sportsbook its price came from.
import type { SportsbookId } from "./sportsbook";

/** The longest a slip name can be. Both the form and the server check it. */
export const BET_SLIP_NAME_MAX_LENGTH = 50;

/** The most picks one slip can hold. Real sportsbooks cap parlays around 20 to 25 picks. */
export const BET_SLIP_MAX_PICKS = 25;

/*
  BET_SLIP_TYPES: the three kinds of slip.
  - "straight": exactly 1 pick (or an empty slip that hasn't got picks yet).
  - "parlay": 2 or more picks from DIFFERENT games.
  - "sgp" (same game parlay): 2 or more picks from the SAME game.
  The SERVER works out the type from the picks. It never trusts a type sent by the browser.
*/
export const BET_SLIP_TYPES = ["straight", "parlay", "sgp"] as const;

/* BetSlipType: one of "straight" | "parlay" | "sgp". */
export type BetSlipType = (typeof BET_SLIP_TYPES)[number];

/*
  PICK_REFRESH_STATUSES / PickRefreshStatus: what happened to a pick when its slip was COPIED.
  - "updated": the sportsbook's current price (or line) is different from the old one
  - "unchanged": the current price and line are the same as before
  - "no-odds": the sportsbook has no odds for this bet right now (like Caesars, which has
    had none in The Odds API), so the pick kept its OLD price
  - "not-checked": we couldn't look up current odds (The Odds API was down or out of
    requests), so the pick kept its OLD price
*/
export const PICK_REFRESH_STATUSES = ["updated", "unchanged", "no-odds", "not-checked"] as const;
export type PickRefreshStatus = (typeof PICK_REFRESH_STATUSES)[number];

/*
  PickRefresh: the note a copied pick carries about its price check. It remembers
  the OLD price, line, and sportsbook, so the slip can say "was -110, now -115".
*/
export type PickRefresh = {
  status: PickRefreshStatus;
  /** The price on the slip that was copied. */
  previousOdds: AmericanOdds;
  /** The line on the slip that was copied. null for bets with no line (missing on purpose). */
  previousLine: number | null;
  /** The sportsbook the old price came from. */
  previousSportsbook: SportsbookId;
};

/*
  BetPick: one pick on a bet slip (also called a selection).
  We call it BetPick, not just "Pick", because TypeScript already has a built-in
  tool named "Pick". Reusing that name would cause confusing errors.

  A pick saves a copy of everything needed to show it (team names, game time,
  price), so a saved slip still makes sense days later, even after the game is
  over and the live odds are gone.
*/
export type BetPick = {
  /**
   * A unique ID for this exact pick, built from the game, market, part of the
   * game, who it's about, side, and line. Tapping the same odds button twice
   * produces the same ID, which is how we know to REMOVE it instead of adding a second copy.
   */
  id: string;
  /** The game this pick is from (our game ID). Picks from the same game make an SGP. */
  gameId: string;
  /** Which league the game is in, like "nfl". */
  league: LeagueSlug;
  /** A short name for the game, like "KC @ LV". */
  gameLabel: string;
  /** Kickoff time (ISO date-time text). Used to mark the pick "Started" once the game begins. */
  gameStartsAt: string;
  /** The market's name in The Odds API, like "spreads" or "player_pass_yds". */
  marketKey: string;
  /** The group it belongs to (game lines, player props, ...). */
  marketCategory: MarketCategory;
  /** The market label to show, like "Spread" or "Passing Yards". */
  marketLabel: string;
  /** Which part of the game it covers (full game, 1st half, ...). */
  period: GamePeriod;
  /** Who it's about: the whole game, a team, or a player. */
  participant: Participant;
  /** Which side (home, away, over, under, yes, no). */
  side: PickSide;
  /** The line, like -3 or 274.5. null for bets with no line (winner, anytime TD). */
  line: number | null;
  /** The price when the user added it, like -110. */
  odds: AmericanOdds;
  /** The sportsbook the price came from. Stays the same even if the user switches books in Settings. */
  sportsbook: SportsbookId;
  /** The full description to show, like "Chiefs -3" or "Mahomes Over 274.5 Passing Yards". */
  label: string;
  /** When the user added it (ISO date-time text). */
  addedAt: string;
  /**
   * Only on picks that came from COPYING a slip: how the price check went and what
   * the old price was. Left out (not null) on picks added by hand.
   */
  refresh?: PickRefresh;
};

/*
  NewBetPick: a pick that hasn't been added to a slip yet: everything except
  addedAt, which gets filled in the moment the user taps the odds button.
  Odds buttons are given one of these.
*/
export type NewBetPick = Omit<BetPick, "addedAt">;

/*
  SkippedPick: a pick that was NOT copied, and why. Only the words are kept (not the
  whole pick), because the pick isn't on the new slip.
*/
export type SkippedPick = {
  /** The pick's words, like "Chiefs -3". */
  label: string;
  /** The game, like "KC @ SEA". */
  gameLabel: string;
  /** Why it was skipped, like "That game already started." */
  reason: string;
};

/*
  SlipCopyInfo: the note on a slip that was made by COPYING another one.
*/
export type SlipCopyInfo = {
  /** The name of the slip it was copied from (the original may be renamed or deleted later). */
  fromName: string;
  /** The sportsbook the prices were refreshed from (the user's sportsbook at the time). */
  sportsbook: SportsbookId;
  /** The picks that were left out. */
  skipped: SkippedPick[];
  /** When the copy was made (ISO date-time text). */
  copiedAt: string;
};

/*
  BetSlip: one saved bet slip, as the API sends it and the pages show it.
*/
export type BetSlip = {
  /** The slip's ID (from MongoDB). Used in the address: /betslips/<id>. */
  id: string;
  /**
   * The ID of the user who owns it. The server only ever returns slips whose
   * userId matches the logged-in user, so nobody can see anyone else's slips.
   */
  userId: string;
  /** The slip's name, up to 50 characters. Defaults to today's date, like "10-23-2026" (or "10-23-2026 (2)"). */
  name: string;
  /** Straight, parlay, or SGP. Worked out by the server from the picks. */
  type: BetSlipType;
  /**
   * If this slip was started with "Build your own SGP", the one game it's locked
   * to. Picks from any other game are refused with the conflict popup.
   * null for normal slips.
   */
  sgpGameId: string | null;
  /** The picks on the slip, in the order they were added. */
  picks: BetPick[];
  /**
   * All the picks' odds combined into one price (American odds).
   * null when the slip has no picks yet (missing on purpose, since there's nothing
   * to combine). The page shows a dash. Worked out by the server.
   */
  combinedOdds: AmericanOdds | null;
  /**
   * true for SGPs. The combined price is only an ESTIMATE, because picks from the
   * same game are related, so the sportsbook's real SGP price is usually lower.
   * The page shows the word "Estimated" when this is true.
   */
  oddsAreEstimated: boolean;
  /**
   * Set only on a slip made with "Copy slip": where it came from and which picks were
   * left out. null for every other slip (missing on purpose).
   */
  copiedFrom: SlipCopyInfo | null;
  /** When the slip was created (ISO date-time text). */
  createdAt: string;
  /** When the slip was last changed (ISO date-time text). */
  updatedAt: string;
};

/*
  BetSlipCreateInput: what the browser may send to CREATE a slip (POST /api/betslips).
  Everything is optional:
  - no name → the server uses today's date
  - no picks → an empty slip
  - sgpGameId → starts a Build your own SGP slip locked to that game
  - setActive → also make it the active slip (the one in the slip bar)
  - numberIfTaken → add (2), (3), ... if the name is taken, instead of refusing
  Notice there's no type, combinedOdds, or userId: the server works those out
  itself, so a user can't fake them.
*/
export type BetSlipCreateInput = {
  name?: string;
  picks?: BetPick[];
  sgpGameId?: string | null;
  setActive?: boolean;
  numberIfTaken?: boolean;
};

/*
  BetSlipUpdateInput: what the browser may send to CHANGE a slip (PATCH /api/betslips/<id>).
  Send only what's changing: a new name, the new full list of picks, or both.
*/
export type BetSlipUpdateInput = {
  name?: string;
  picks?: BetPick[];
};
