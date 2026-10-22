/*
  FILE: lib/services/cache.ts
  WHAT IT'S FOR: How long the app saves ("caches") each kind of outside-API
  result before asking again. Caching makes pages fast and, most importantly,
  saves your limited Odds API credits: if 50 people open the Feed in an hour,
  The Odds API is asked once, not 50 times.
  WHO USES IT: Every file in lib/services/espn and lib/services/odds.
  WHY THIS NAME: It's about caching. It ends in .ts because it shows nothing on screen.
*/

// Keeps this on the server only.
import "server-only";
// unstable_cache: Next.js's tool for saving a function's result for a while. (The
// name says "unstable", but it's the documented way to cache when Cache
// Components is turned off, which it is in this project. See Section 1.)
import { unstable_cache } from "next/cache";

/*
  CACHE_SECONDS: how long each kind of data is saved, in seconds.
  Odds are saved the longest compared with how often they change, because every
  Odds API call costs credits from your free monthly 500.
*/
export const CACHE_SECONDS = {
  /** Game lines (spread, total, winner) for all games: 3 credits per refresh. 60 minutes. */
  oddsGameLines: 60 * 60,
  /** Props or halves for ONE game and ONE category: 1-5 credits per refresh. 60 minutes. */
  oddsEventMarkets: 60 * 60,
  /** ESPN games and scores. These change on game day, so 5 minutes. */
  espnScoreboard: 5 * 60,
  /** ESPN one game's details (win chance, venue, box score). 10 minutes. */
  espnGameSummary: 10 * 60,
  /** ESPN team list and logos. These barely change. 24 hours. */
  espnTeams: 24 * 60 * 60,
  /** ESPN one team's record, standing, schedule, stats, roster. 1 hour. */
  espnTeam: 60 * 60,
  /** ESPN injuries. 30 minutes (they update during the week). */
  espnInjuries: 30 * 60,
  /** ESPN news. 15 minutes. */
  espnNews: 15 * 60,
  /** ESPN one player's details, stats, and game log. 1 hour. */
  espnPlayer: 60 * 60,
} as const;

/*
  cached: wraps an async function so its result is saved for "seconds".
  - name: a unique label for this kind of data (part of the cache's key).
  The function's arguments are automatically part of the key too, so
  getTeam("12") and getTeam("26") are saved separately.
  Only plain data (text, numbers, arrays, objects) can be saved, which is all our functions return.
*/
export function cached<Args extends unknown[], Result>(
  name: string,
  seconds: number,
  fn: (...args: Args) => Promise<Result>,
): (...args: Args) => Promise<Result> {
  return unstable_cache(fn, [name], { revalidate: seconds, tags: [name] });
}
