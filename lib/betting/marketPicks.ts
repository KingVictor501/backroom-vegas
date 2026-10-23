/*
  FILE: lib/betting/marketPicks.ts
  WHAT IT'S FOR: Turns any price on the matchup page (a player prop, a team
  total, a 1st-half spread, overtime, ...) into a full bet slip pick, with a
  clear label like "Patrick Mahomes Over 274.5 Passing Yards" or "Chiefs -1.5 (1st Half)".
  It also picks the small words shown on the button, like "O 274.5" or "Yes".
  WHO USES IT: components/matchup/MarketSections.tsx.
  WHY THIS NAME: It makes picks from markets. It ends in .ts because it shows
  nothing on screen. It's safe to use in the browser.
*/

// makePickId and formatLine from lib/betting/picks.ts.
import { formatLine, makePickId } from "@/lib/betting/picks";
import type { GamePeriod, LeagueSlug, MarketOutcome, MarketSection, NewBetPick, SportsbookId } from "@/types";

/* PERIOD_WORDS: added to labels for part-of-game bets, like "Chiefs to win (1st Half)". */
const PERIOD_WORDS: Record<GamePeriod, string> = {
  "full-game": "",
  "first-half": "1st Half",
  "second-half": "2nd Half",
  q1: "1st Quarter",
  q2: "2nd Quarter",
  q3: "3rd Quarter",
  q4: "4th Quarter",
};

/* PickGame: the few game details every pick saves. */
export type PickGame = { gameId: string; league: LeagueSlug; gameLabel: string; gameStartsAt: string };

/*
  pickLabel: the words for a pick.
  - rowLabel: the name on the row ("Chiefs", "Patrick Mahomes", or "Game")
*/
function pickLabel(market: MarketSection["market"], outcome: MarketOutcome, rowLabel: string): string {
  const who = outcome.participant.kind === "game" ? "" : `${rowLabel} `;
  const period = PERIOD_WORDS[market.period];
  const withPeriod = (text: string) => (period ? `${text} (${period})` : text);

  switch (outcome.side) {
    case "over":
    case "under":
      // "Patrick Mahomes Over 274.5 Passing Yards", "Over 44.5 Total (1st Half)"
      return `${who}${outcome.side === "over" ? "Over" : "Under"} ${outcome.line ?? ""} ${market.label}`.replace(/\s+/g, " ").trim();
    case "yes":
    case "no":
      // "Travis Kelce Anytime TD Scorer", "Overtime? Yes"
      if (outcome.participant.kind === "game") return `${market.label} ${outcome.side === "yes" ? "Yes" : "No"}`;
      return `${who}${market.label}${outcome.side === "no" ? " (No)" : ""}`;
    default:
      // home / away: "Chiefs -1.5 (1st Half)" or "Chiefs to win (1st Half)"
      return withPeriod(outcome.line === null ? `${rowLabel} to win` : `${rowLabel} ${formatLine(outcome.line)}`);
  }
}

/*
  marketPick: one price on the matchup page → a full pick for the bet slip.
*/
export function marketPick(
  game: PickGame,
  market: MarketSection["market"],
  outcome: MarketOutcome,
  rowLabel: string,
  sportsbook: SportsbookId,
): NewBetPick {
  const pick: Omit<NewBetPick, "id"> = {
    ...game,
    marketKey: market.key,
    marketCategory: market.category,
    marketLabel: market.label,
    period: market.period,
    participant: outcome.participant,
    side: outcome.side,
    line: outcome.line,
    odds: outcome.odds,
    sportsbook,
    label: pickLabel(market, outcome, rowLabel),
  };
  return { ...pick, id: makePickId(pick) };
}

/*
  buttonText: the small words above the price on an odds button.
  "O 274.5" / "U 274.5", "-1.5", "Yes" / "No", or nothing for a single price
  (like an anytime TD, or a team to win, where the row's name says it all).
*/
export function buttonText(outcome: MarketOutcome, rowHasChoices: boolean): string | undefined {
  if (outcome.side === "over" || outcome.side === "under") {
    return outcome.line === null ? (outcome.side === "over" ? "Over" : "Under") : `${outcome.side === "over" ? "O" : "U"} ${outcome.line}`;
  }
  if (outcome.side === "yes" || outcome.side === "no") return rowHasChoices ? (outcome.side === "yes" ? "Yes" : "No") : undefined;
  return outcome.line === null ? undefined : formatLine(outcome.line);
}
