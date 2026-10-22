/*
  FILE: lib/services/odds/markets.ts
  WHAT IT'S FOR: The "dictionary" of Odds API markets we support, and the
  translator from an Odds API market into our shared Market type (types/odds.ts).
  The market names come from your Postman samples (B4 lists every market each
  book offers for Chiefs @ Seahawks).
  Each market name has a base plus an optional period on the end:
    "spreads" = full game, "spreads_h1" = 1st half, "spreads_q3" = 3rd quarter.
  WHO USES IT: lib/services/odds/lines.ts and lib/services/odds/props.ts. Later:
  the matchup page's Halves, Quarters, Team Props, D/ST, and Specials tabs (Section 10).
  WHY THIS NAME: It's about betting markets. It ends in .ts because it shows nothing on screen.
*/

import "server-only";
import { normalizeName } from "@/lib/services/text";
import type { OddsEvent, OddsMarket } from "./schemas";
import type {
  GamePeriod,
  Market,
  MarketCategory,
  MarketOutcome,
  ParticipantKind,
  PickSide,
  SportsbookId,
} from "@/types";

/*
  MarketInfo: what we know about one base market.
  - label: the name to show ("Spread", "Passing Yards")
  - category: which tab it appears under on the matchup page
  - about: whether outcomes are about the whole game, a team, or a player
*/
type MarketInfo = { label: string; category: MarketCategory; about: ParticipantKind };

/*
  BASE_MARKETS: every base market we show. Anything NOT listed (3-way winners
  that include a tie, "odd/even", "correct score", ...) is ignored, because it
  doesn't fit our pick types.
*/
const BASE_MARKETS: Record<string, MarketInfo> = {
  // Game lines (with their halves and quarters versions)
  h2h: { label: "Winner", category: "game-lines", about: "team" },
  spreads: { label: "Spread", category: "game-lines", about: "team" },
  totals: { label: "Total", category: "game-lines", about: "game" },
  alternate_spreads: { label: "Alternate Spread", category: "game-lines", about: "team" },
  alternate_totals: { label: "Alternate Total", category: "game-lines", about: "game" },
  // Team props
  team_totals: { label: "Team Total Points", category: "team-props", about: "team" },
  alternate_team_totals: { label: "Alternate Team Total", category: "team-props", about: "team" },
  // Touchdowns
  player_anytime_td: { label: "Anytime TD Scorer", category: "player-props", about: "player" },
  player_1st_td: { label: "First TD Scorer", category: "player-props", about: "player" },
  player_last_td: { label: "Last TD Scorer", category: "player-props", about: "player" },
  player_tds_over: { label: "Touchdowns", category: "player-props", about: "player" },
  // Passing
  player_pass_yds: { label: "Passing Yards", category: "player-props", about: "player" },
  player_pass_tds: { label: "Passing TDs", category: "player-props", about: "player" },
  player_pass_completions: { label: "Pass Completions", category: "player-props", about: "player" },
  player_pass_attempts: { label: "Pass Attempts", category: "player-props", about: "player" },
  player_pass_interceptions: { label: "Interceptions Thrown", category: "player-props", about: "player" },
  // Rushing
  player_rush_yds: { label: "Rushing Yards", category: "player-props", about: "player" },
  player_rush_attempts: { label: "Rush Attempts", category: "player-props", about: "player" },
  player_rush_longest: { label: "Longest Rush", category: "player-props", about: "player" },
  // Receiving and receptions
  player_reception_yds: { label: "Receiving Yards", category: "player-props", about: "player" },
  player_reception_longest: { label: "Longest Reception", category: "player-props", about: "player" },
  player_receptions: { label: "Receptions", category: "player-props", about: "player" },
  // D/ST (defense and special teams): kicking props
  player_field_goals: { label: "Field Goals Made", category: "dst", about: "player" },
  player_kicking_points: { label: "Kicking Points", category: "dst", about: "player" },
  player_pats: { label: "Extra Points Made", category: "dst", about: "player" },
  // Game specials
  overtime: { label: "Overtime?", category: "specials", about: "game" },
};

/*
  PERIOD_SUFFIXES: the endings The Odds API adds for part of a game.
*/
const PERIOD_SUFFIXES: Record<string, GamePeriod> = {
  h1: "first-half",
  h2: "second-half",
  q1: "q1",
  q2: "q2",
  q3: "q3",
  q4: "q4",
};

/* PERIOD_LABELS: words added to a market's label, like "Spread (1st Half)". */
const PERIOD_LABELS: Record<GamePeriod, string> = {
  "full-game": "",
  "first-half": "1st Half",
  "second-half": "2nd Half",
  q1: "1st Quarter",
  q2: "2nd Quarter",
  q3: "3rd Quarter",
  q4: "4th Quarter",
};

/*
  describeMarket: splits an Odds API market name into its base and period, and
  looks up the base. Returns null for markets we don't support (missing on purpose).
  Game lines for a half or quarter go under the Halves or Quarters tab.
  Examples: "spreads_h1" → Spread (1st Half), halves. "player_pass_yds" → Passing Yards, full game.
*/
export function describeMarket(
  key: string,
): (MarketInfo & { period: GamePeriod; fullLabel: string }) | null {
  const match = key.match(/^(.*)_(h1|h2|q1|q2|q3|q4)$/);
  const base = match ? match[1] : key;
  const period = match ? PERIOD_SUFFIXES[match[2]] : "full-game";
  const info = BASE_MARKETS[base];
  if (!info) return null;

  let category = info.category;
  if (info.category === "game-lines" && period !== "full-game") {
    category = period === "first-half" || period === "second-half" ? "halves" : "quarters";
  }
  const periodLabel = PERIOD_LABELS[period];
  return {
    ...info,
    category,
    period,
    fullLabel: periodLabel ? `${info.label} (${periodLabel})` : info.label,
  };
}

/*
  NameLookup: turns a team or player name into our ESPN ID, or null if we can't
  match it (missing on purpose: the name still shows, just without a link).
*/
export type NameLookup = (name: string) => string | null;

/*
  toSide: an outcome's name → our PickSide.
  Team names become "home"/"away" by comparing with the game's home and away teams.
  Returns null for anything else (like "Draw"), and that outcome is skipped.
*/
function toSide(name: string, event: OddsEvent): PickSide | null {
  const n = normalizeName(name);
  if (n === normalizeName(event.home_team)) return "home";
  if (n === normalizeName(event.away_team)) return "away";
  if (n === "over") return "over";
  if (n === "under") return "under";
  if (n === "yes") return "yes";
  if (n === "no") return "no";
  return null;
}

/*
  toMarket: one Odds API market from one book → our Market.
  - teamIds / playerIds: look up our ESPN IDs from names, so team and player names can link to their pages.
  Returns null for unsupported markets, or if no outcome could be understood.
*/
export function toMarket(
  market: OddsMarket,
  event: OddsEvent,
  sportsbook: SportsbookId,
  teamIds: NameLookup,
  playerIds: NameLookup,
): Market | null {
  const info = describeMarket(market.key);
  if (!info) return null;

  const outcomes: MarketOutcome[] = [];
  for (const outcome of market.outcomes) {
    const side = toSide(outcome.name, event);
    if (!side) continue;

    // Who the outcome is about. For player props and team totals, the name is in
    // "description". For spreads and winner bets, the team name IS the outcome's name.
    let participantName: string;
    let participantId: string | null;
    if (info.about === "player") {
      participantName = outcome.description ?? outcome.name;
      participantId = playerIds(participantName);
    } else if (info.about === "team") {
      participantName =
        outcome.description ?? (side === "home" ? event.home_team : side === "away" ? event.away_team : outcome.name);
      participantId = teamIds(participantName);
    } else {
      participantName = "Game";
      participantId = null;
    }

    outcomes.push({
      side,
      participant: { kind: info.about, id: participantId, name: participantName },
      line: outcome.point ?? null,
      odds: outcome.price,
    });
  }
  if (outcomes.length === 0) return null;

  return {
    key: market.key,
    category: info.category,
    label: info.fullLabel,
    period: info.period,
    sportsbook,
    outcomes,
    lastUpdated: market.last_update ?? new Date().toISOString(),
  };
}
