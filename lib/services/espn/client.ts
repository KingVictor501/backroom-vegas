/*
  FILE: lib/services/espn/client.ts
  WHAT IT'S FOR: Builds ESPN web addresses for a league and fetches them. ESPN's
  API is free, needs no key, and is unofficial, so it can change without warning.
  That's why every answer is checked against a schema.
  WHO USES IT: The other files in lib/services/espn.
  WHY THIS NAME: A "client" is the code that talks to a service. It ends in .ts
  because it shows nothing on screen.
*/

import "server-only";
// assertSafePath from lib/services/safePath.ts: refuses traversal tricks like ".." in an address.
import { assertSafePath } from "@/lib/services/safePath";
import type { z } from "zod";
// fetchJson and UpstreamError from lib/services/http.ts: the shared fetch-with-timeout-and-checks helper.
import { fetchJson, UpstreamError } from "@/lib/services/http";
// The league list from config/leagues.ts. Each league knows its ESPN sport and league names.
import { LEAGUES } from "@/config/leagues";
import type { LeagueConfig } from "@/types";

/* KnownLeague: one entry from LEAGUES, with its exact slug ("nfl", not just any text). */
type KnownLeague = (typeof LEAGUES)[number];

/*
  requireLeague: looks up a league by slug (like "nfl"), or throws if it isn't
  in config/leagues.ts. Pages check the league exists BEFORE calling ESPN, so
  this only fires if there's a mistake in the code.
*/
export function requireLeague(slug: string): KnownLeague {
  const league = LEAGUES.find((l) => l.slug === slug.toLowerCase());
  if (!league) throw new Error(`Unknown league "${slug}". Add it to config/leagues.ts.`);
  return league;
}

/*
  currentSeasonYear: which season to ask ESPN for. An NFL season is named after
  the year it starts: games in January and February 2027 are still the 2026
  season. So before March we use last year.
*/
export function currentSeasonYear(now: Date = new Date()): number {
  return now.getUTCMonth() < 2 ? now.getUTCFullYear() - 1 : now.getUTCFullYear();
}

/*
  seasonYearFor: the season number ESPN uses in its season web addresses, for one league.
  - Football is named for the year it STARTS: the 2026 season runs September 2026 to February 2027
    (so January and February still count as the year before).
  - Basketball is named for the year it ENDS: the 2026-27 season is "2027". It starts in October, so
    October to December belong to the next year's number, and January to September to this year's.
*/
export function seasonYearFor(league: LeagueConfig, now: Date = new Date()): number {
  if (league.espn.sport === "basketball") {
    return now.getUTCMonth() >= 9 ? now.getUTCFullYear() + 1 : now.getUTCFullYear();
  }
  return currentSeasonYear(now);
}

/*
  isNotFound: true if ESPN said "404 not found", which happens for fake game or
  player IDs. Callers turn this into null (missing on purpose), so pages can show
  "not found" instead of an error.
*/
export function isNotFound(error: unknown): boolean {
  return error instanceof UpstreamError && (error.status === 404 || error.status === 400);
}

/*
  ESPN's web addresses (from the Public-ESPN-API guide):
  - SITE: games, teams, rosters, injuries, news, game summaries
  - WEB: one player's details, overview, game log, stats
  - CORE: a team's season stats
*/
const SITE = "https://site.api.espn.com/apis/site/v2/sports";
const WEB = "https://site.web.api.espn.com/apis/common/v3/sports";
const CORE = "https://sports.core.api.espn.com/v2/sports";

/*
  espnUrl: builds the full address for a league.
  Example: espnUrl("site", nfl, "teams/12") →
  https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/12
*/
export function espnUrl(
  host: "site" | "web" | "core",
  league: LeagueConfig,
  path: string,
): string {
  // Second lock against path traversal: refuse "..", ".", or hidden slashes in the path (lib/services/safePath.ts).
  assertSafePath(path);
  const { sport, league: leagueName } = league.espn;
  if (host === "site") return `${SITE}/${sport}/${leagueName}/${path}`;
  if (host === "web") return `${WEB}/${sport}/${leagueName}/${path}`;
  return `${CORE}/${sport}/leagues/${leagueName}/${path}`;
}

/*
  espnGet: fetches an ESPN address and checks it against a schema.
  - label: a short name for logs, like "scoreboard".
  Returns just the checked data (ESPN's headers aren't useful to us).
*/
export async function espnGet<Schema extends z.ZodType>(
  url: string,
  schema: Schema,
  label: string,
): Promise<z.infer<Schema>> {
  const { data } = await fetchJson(url, schema, { source: "ESPN", label });
  return data;
}
