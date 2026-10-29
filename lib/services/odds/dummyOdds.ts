/*
  FILE: lib/services/odds/dummyOdds.ts
  WHAT IT'S FOR: "Practice odds" for the Vercel PREVIEW site, so testing there uses no Odds API credits.
  When DUMMY_ODDS=true is set in Vercel's Preview environment, the league game lines are made up here
  from ESPN's real schedule: every upcoming game gets a spread, a total, and a winner price from each of
  each book. The numbers are invented (but always the same for the same game), so they are NOT real
  prices, and the Feed and matchup page say so in a banner (components/PracticeOddsNotice.tsx).
  SAFETY: it can NEVER turn on for the live site. It needs DUMMY_ODDS to be exactly "true" AND either
  Vercel's environment to be "preview" or the app to not be a production build (your own computer).
  The live site's Vercel environment is "production", so it is always off there, even if someone adds
  the variable by mistake. Other odds (props, halves) are not made up: they simply say the book doesn't offer them.
  WHO USES IT: lib/services/odds/lines.ts, lib/services/odds/client.ts, and the pages that show the banner.
  WHY THIS NAME: It makes dummy (pretend) odds. It ends in .ts because it shows nothing on screen.
*/

import "server-only";
import { SPORTSBOOKS } from "@/config/sportsbooks";
import { SPORTSBOOK_IDS, type Game } from "@/types";
import type { OddsEvent } from "./schemas";

/* dummyOddsEnabled: true only for the Preview site (or your own computer) with DUMMY_ODDS=true. */
export function dummyOddsEnabled(): boolean {
  if (process.env.DUMMY_ODDS !== "true") return false;
  return process.env.VERCEL_ENV === "preview" || (process.env.VERCEL_ENV === undefined && process.env.NODE_ENV !== "production");
}

/* seedOf: turns a game ID into a steady number, so the same game always gets the same pretend odds. */
function seedOf(text: string): number {
  let hash = 0;
  for (const character of text) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return hash;
}

/* moneylineFor: a believable winner price for a team that is favored (or not) by this many points. */
function moneylineFor(spread: number): number {
  const size = Math.round(100 + Math.abs(spread) * 22);
  return spread < 0 ? -size : size;
}

/*
  dummyGameLines: pretend Odds API games for the given ESPN games.
  Football totals are around 36-52 and basketball totals around 205-235 (chosen by the league's scoring size).
*/
export function dummyGameLines(games: readonly Game[]): OddsEvent[] {
  return games.map((game) => {
    const seed = seedOf(game.id);
    const basketball = game.league === "nba";
    // The home team is favored when the seed is even. Spreads step by half points.
    const size = (basketball ? 1 + (seed % 14) : 1 + (seed % 10)) + 0.5;
    const homeSpread = seed % 2 === 0 ? -size : size;
    const total = (basketball ? 205 + (seed % 31) : 36 + (seed % 17)) + 0.5;

    const bookmakers = SPORTSBOOK_IDS.map((id, index) => {
      // Each book is a few points of price (or a half point of line) away from the others.
      const juice = -110 - ((seed + index) % 3) * 5;
      const homeLine = homeSpread;
      const awayLine = -homeSpread;
      return {
        key: SPORTSBOOKS[id].providerKeys.theOddsApi,
        markets: [
          {
            key: "h2h",
            outcomes: [
              { name: game.homeTeam.displayName, price: moneylineFor(homeLine) },
              { name: game.awayTeam.displayName, price: moneylineFor(awayLine) },
            ],
          },
          {
            key: "spreads",
            outcomes: [
              { name: game.homeTeam.displayName, price: juice, point: homeLine },
              { name: game.awayTeam.displayName, price: juice, point: awayLine },
            ],
          },
          {
            key: "totals",
            outcomes: [
              { name: "Over", price: juice, point: total },
              { name: "Under", price: juice, point: total },
            ],
          },
        ],
      };
    });

    return {
      id: `dummy-${game.id}`,
      commence_time: game.startsAt,
      home_team: game.homeTeam.displayName,
      away_team: game.awayTeam.displayName,
      bookmakers,
    };
  });
}
