/*
  FILE: lib/services/slipOdds.ts
  WHAT IT'S FOR: Looks up the CURRENT odds for the picks on a slip, from the user's
  sportsbook, so "Copy slip" can refresh them. It costs as few Odds API requests as it can:
  - Spread, Total, and Winner picks (the game lines) use the league-wide odds the Feed
    already saved for 60 minutes. FREE.
  - Other picks (player props, halves, quarters, team props, ...) need one request per game,
    for just the markets those picks use (about 1 credit per market that comes back), and
    that is also saved for 60 minutes, so copying the same slip twice costs nothing the second time.
  - Picks whose game already started are never looked up (they are skipped by the copy anyway).
  - At most MAX_GAMES_LOOKED_UP games get a per-game request per copy. Picks in any other
    game keep their old price and are marked "not checked".
  - If The Odds API or ESPN fails, nothing crashes: those picks are marked "not checked".
  Everything stays on the server. The browser never calls an outside API.
  WHO USES IT: lib/db/betslipCopy.ts. (Tests replace it with made-up odds.)
  WHY THIS NAME: It's the odds service for a slip's picks, in lib/services with the other
  outside-data code. It ends in .ts because it shows nothing on screen.
*/

import "server-only";
import { pickSkipReason, type PickOddsResult } from "@/lib/betting/copySlip";
import { logServerError } from "@/lib/logging/safeLog";
import { getUpcomingGamesWithLines } from "@/lib/services/games";
import { getEventOdds, marketsForBook } from "@/lib/services/odds/lines";
import { teamIdLookup } from "@/lib/services/odds/match";
import type { BetPick, GameLines, GameStatus, GameWithLines, LeagueSlug, MarketOutcome, SportsbookId } from "@/types";

/** The most games that get their own Odds API request during one copy (protects the free monthly requests). */
export const MAX_GAMES_LOOKED_UP = 4;

/*
  CurrentOdds: the answer.
  - odds: for each pick (by its ID), what the sportsbook offers now
  - gameStatuses: what ESPN says about each game that is still on its upcoming list
*/
export type CurrentOdds = {
  odds: Map<string, PickOddsResult>;
  gameStatuses: Map<string, GameStatus>;
};

/*
  gameLineOutcomes: the game card's prices for one kind of game line, as a plain list.
  Empty when the sportsbook isn't offering that bet (or the pick isn't one of the three game lines).
*/
function gameLineOutcomes(lines: GameLines, marketKey: string): MarketOutcome[] {
  const pairs: Record<string, (MarketOutcome | null)[]> = {
    spreads: [lines.spread.away, lines.spread.home],
    totals: [lines.total.over, lines.total.under],
    h2h: [lines.moneyline.away, lines.moneyline.home],
  };
  return (pairs[marketKey] ?? []).filter((outcome): outcome is MarketOutcome => outcome !== null);
}

/* isFullGameLine: Spread, Total, or Winner for the whole game (the three columns on a game card). */
function isFullGameLine(pick: BetPick): boolean {
  return pick.marketCategory === "game-lines" && pick.period === "full-game" && ["spreads", "totals", "h2h"].includes(pick.marketKey);
}

/*
  getCurrentOddsForPicks: see the top of this file. Never throws: any trouble turns
  into "not-checked" for the picks it affects.
*/
export async function getCurrentOddsForPicks(
  picks: readonly BetPick[],
  sportsbook: SportsbookId,
  now: Date = new Date(),
): Promise<CurrentOdds> {
  const odds = new Map<string, PickOddsResult>();
  const gameStatuses = new Map<string, GameStatus>();
  // Until we learn better, every pick is "not checked".
  for (const pick of picks) odds.set(pick.id, { state: "not-checked" });

  // The games ESPN lists as still to play, with this book's game lines, for each league in the slip.
  const games = new Map<string, GameWithLines>();
  let oddsUnavailable = false;
  for (const league of new Set(picks.map((pick) => pick.league))) {
    try {
      const result = await getUpcomingGamesWithLines(league as LeagueSlug, sportsbook);
      for (const game of result.games) {
        games.set(game.id, game);
        gameStatuses.set(game.id, game.status);
      }
      oddsUnavailable ||= result.oddsUnavailable;
    } catch (error) {
      logServerError("Copy slip: couldn't load the games:", error);
      oddsUnavailable = true;
    }
  }

  // Only picks that will really be copied are worth looking up.
  const live = picks.filter((pick) => pickSkipReason(pick, gameStatuses.get(pick.gameId), now.getTime()) === null);

  // Game lines: free, from the saved league-wide odds.
  const others: BetPick[] = [];
  for (const pick of live) {
    if (!isFullGameLine(pick)) {
      others.push(pick);
      continue;
    }
    const game = games.get(pick.gameId);
    if (!game || oddsUnavailable) continue; // stays "not-checked"
    const outcomes = game.lines ? gameLineOutcomes(game.lines, pick.marketKey) : [];
    odds.set(pick.id, outcomes.length > 0 ? { state: "outcomes", outcomes } : { state: "none" });
  }

  // Everything else: one request per game, for only the markets those picks use.
  const byGame = new Map<string, BetPick[]>();
  for (const pick of others) byGame.set(pick.gameId, [...(byGame.get(pick.gameId) ?? []), pick]);

  const lookups = [...byGame.entries()].slice(0, MAX_GAMES_LOOKED_UP).map(async ([gameId, gamePicks]) => {
    const game = games.get(gameId);
    if (!game || oddsUnavailable) return; // stays "not-checked"
    if (!game.oddsEventId) {
      for (const pick of gamePicks) odds.set(pick.id, { state: "none" });
      return;
    }
    try {
      const marketKeys = [...new Set(gamePicks.map((pick) => pick.marketKey))];
      const event = await getEventOdds(game.league, game.oddsEventId, marketKeys);
      // () => null: we match players by name, so we don't need their ESPN IDs (saves roster requests).
      const markets = event ? marketsForBook(event, sportsbook, teamIdLookup(game), () => null) : [];
      for (const pick of gamePicks) {
        const market = markets.find((m) => m.key === pick.marketKey);
        odds.set(pick.id, market && market.outcomes.length > 0 ? { state: "outcomes", outcomes: market.outcomes } : { state: "none" });
      }
    } catch (error) {
      logServerError("Copy slip: couldn't load odds for a game:", error);
      // The picks stay "not-checked".
    }
  });
  await Promise.all(lookups);

  return { odds, gameStatuses };
}
