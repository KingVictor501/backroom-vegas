/*
  FILE: lib/betting/gameLinePicks.ts
  WHAT IT'S FOR: Turns one Spread, Total, or Winner price from a game card into
  a full pick that can go on a bet slip (everything the slip saves: the game,
  the market, the team, the line, the price, the sportsbook, and a label like
  "Chiefs -3").
  WHO USES IT: components/feed/GameCard.tsx. Later: the matchup page (Section 10).
  WHY THIS NAME: It makes picks from game lines. It ends in .ts because it
  shows nothing on screen. It's safe to use in the browser.
*/

// makePickId and formatLine from lib/betting/picks.ts.
import { formatLine, makePickId } from "@/lib/betting/picks";
// The shared types: a game with its odds, one price, and a pick.
import type { GameWithLines, MarketOutcome, NewBetPick, SportsbookId } from "@/types";

/* GameLineKind: the three columns on a game card. */
export type GameLineKind = "spread" | "total" | "moneyline";

/*
  MARKETS: for each column, The Odds API's market name (marketKey) and the label to show.
  These must match lib/services/odds/markets.ts, so conflict rules recognize them.
*/
const MARKETS: Record<GameLineKind, { key: string; label: string }> = {
  spread: { key: "spreads", label: "Spread" },
  total: { key: "totals", label: "Total" },
  moneyline: { key: "h2h", label: "Winner" },
};

/* gameLabel: the short game name, like "KC @ SEA". */
export function gameLabel(game: Pick<GameWithLines, "awayTeam" | "homeTeam">): string {
  return `${game.awayTeam.abbreviation} @ ${game.homeTeam.abbreviation}`;
}

/*
  pickLabel: the words for the pick, like "Chiefs -3", "Over 47.5", or "Chiefs to win".
*/
function pickLabel(game: GameWithLines, kind: GameLineKind, outcome: MarketOutcome): string {
  if (kind === "total") {
    return `${outcome.side === "over" ? "Over" : "Under"} ${outcome.line ?? ""}`.trim();
  }
  const team = outcome.side === "home" ? game.homeTeam.name : game.awayTeam.name;
  if (kind === "moneyline") return `${team} to win`;
  return outcome.line === null ? team : `${team} ${formatLine(outcome.line)}`;
}

/*
  gameLinePick: builds the pick for one price on a game card.
  - sportsbook: where the price came from (each pick remembers its book)
*/
export function gameLinePick(
  game: GameWithLines,
  kind: GameLineKind,
  outcome: MarketOutcome,
  sportsbook: SportsbookId,
): NewBetPick {
  const market = MARKETS[kind];
  const pick: Omit<NewBetPick, "id"> = {
    gameId: game.id,
    league: game.league,
    gameLabel: gameLabel(game),
    gameStartsAt: game.startsAt,
    marketKey: market.key,
    marketCategory: "game-lines",
    marketLabel: market.label,
    period: "full-game",
    participant: outcome.participant,
    side: outcome.side,
    line: outcome.line,
    odds: outcome.odds,
    sportsbook,
    label: pickLabel(game, kind, outcome),
  };
  return { ...pick, id: makePickId(pick) };
}
