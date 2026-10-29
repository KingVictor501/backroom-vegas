/*
  FILE: lib/services/odds/lines.ts
  WHAT IT'S FOR: Gets odds from The Odds API:
  - game lines (spread, total, winner) for EVERY game, in one call (3 credits),
    for the Feed and league page
  - any other markets for ONE game (halves, quarters, team props, ...), only
    when someone opens that game, to save credits
  WHO USES IT: lib/services/games.ts and lib/services/odds/props.ts. Later: the matchup page (Section 10).
  WHY THIS NAME: It's about betting lines. It ends in .ts because it shows nothing on screen.
*/

import "server-only";
import { cached, CACHE_SECONDS } from "@/lib/services/cache";
import { requireLeague } from "@/lib/services/espn/client";
// Practice odds for the Preview site (no credits), from lib/services/odds/dummyOdds.ts; the ESPN schedule they are built on.
import { getUpcomingGames } from "@/lib/services/espn/games";
import { dummyGameLines, dummyOddsEnabled } from "./dummyOdds";
import { UpstreamError } from "@/lib/services/http";
import { oddsGet, toSportsbookId } from "./client";
import { toMarket, type NameLookup } from "./markets";
import { oddsEventListSchema, oddsEventSchema, type OddsEvent } from "./schemas";
import type { GameLines, LeagueSlug, Market, MarketOutcome, SportsbookId } from "@/types";

/*
  getLeagueGameLines: spread, total, and winner for every upcoming game, from all
  three books at once. Costs 3 credits, and is saved for 6 hours, so at most
  about 12 credits a day per league even if the Feed is busy all day.
*/
export const getLeagueGameLines = cached(
  "odds-league-game-lines",
  CACHE_SECONDS.oddsGameLines,
  async (leagueSlug: LeagueSlug): Promise<OddsEvent[]> => {
    const league = requireLeague(leagueSlug);
    // Preview site with DUMMY_ODDS=true: made-up odds for ESPN's real games, so no credits are used.
    if (dummyOddsEnabled()) {
      const upcoming = await getUpcomingGames(leagueSlug);
      return dummyGameLines([...upcoming.thisWeek, ...upcoming.nextWeek]);
    }
    return oddsGet(
      `/sports/${league.oddsApiSportKey}/odds`,
      { markets: "h2h,spreads,totals" },
      oddsEventListSchema,
      "game lines",
    );
  },
);

/*
  getEventOdds: chosen markets for ONE game, from all three books, or null if
  The Odds API doesn't know that game (missing on purpose).
  Costs 1 credit per market that comes back. Saved for 60 minutes.
  - marketKeys: like ["spreads_h1", "totals_h1"]
*/
export const getEventOdds = cached(
  "odds-event-markets",
  CACHE_SECONDS.oddsEventMarkets,
  async (leagueSlug: LeagueSlug, oddsEventId: string, marketKeys: string[]): Promise<OddsEvent | null> => {
    const league = requireLeague(leagueSlug);
    // Practice odds don't include props or halves: null means "the book doesn't offer this" (missing on purpose).
    if (dummyOddsEnabled()) return null;
    try {
      return await oddsGet(
        `/sports/${league.oddsApiSportKey}/events/${encodeURIComponent(oddsEventId)}/odds`,
        { markets: marketKeys.join(",") },
        oddsEventSchema,
        `event markets (${marketKeys.join(",")})`,
      );
    } catch (error) {
      if (error instanceof UpstreamError && (error.status === 404 || error.status === 422)) return null;
      throw error;
    }
  },
);

/*
  marketsForBook: every supported market one sportsbook has for a game, as our
  Market type. Returns [] if that book has nothing for the game. That's the
  signal for the page to say "your sportsbook doesn't offer this, try another
  book in Settings".
*/
export function marketsForBook(
  event: OddsEvent,
  sportsbook: SportsbookId,
  teamIds: NameLookup,
  playerIds: NameLookup,
): Market[] {
  const bookmaker = event.bookmakers?.find((b) => toSportsbookId(b.key) === sportsbook);
  if (!bookmaker) return [];
  return bookmaker.markets
    .map((market) => toMarket(market, event, sportsbook, teamIds, playerIds))
    .filter((market): market is Market => market !== null);
}

/*
  toGameLines: the three-column odds table for one game card, from one book.
  Returns null if that book has no lines for the game yet (the card shows dashes).
*/
export function toGameLines(
  event: OddsEvent,
  sportsbook: SportsbookId,
  teamIds: NameLookup,
): GameLines | null {
  const markets = marketsForBook(event, sportsbook, teamIds, () => null);
  if (markets.length === 0) return null;

  const pick = (key: string, side: MarketOutcome["side"]): MarketOutcome | null =>
    markets.find((m) => m.key === key)?.outcomes.find((o) => o.side === side) ?? null;

  return {
    sportsbook,
    spread: { away: pick("spreads", "away"), home: pick("spreads", "home") },
    total: { over: pick("totals", "over"), under: pick("totals", "under") },
    moneyline: { away: pick("h2h", "away"), home: pick("h2h", "home") },
  };
}
