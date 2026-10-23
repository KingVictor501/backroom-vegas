/*
  FILE: lib/services/espn/search.ts
  WHAT IT'S FOR: "Find a team or player". Teams are matched from the saved team
  list (no extra request). Players come from ESPN's own player search.
  WHO USES IT: app/api/search/route.ts. Later: the search bar on the Feed (Section 9).
  WHY THIS NAME: It's the ESPN code for searching. It ends in .ts because it shows nothing on screen.
*/

import "server-only";
import { cached, CACHE_SECONDS } from "@/lib/services/cache";
import { normalizeName } from "@/lib/services/text";
import { espnGet, requireLeague } from "./client";
import { playerSearchSchema } from "./schemas";
import { getTeams } from "./teams";
import type { LeagueSlug, SearchResult } from "@/types";

/* The ESPN search address (a different "common" API from the others). */
const SEARCH_URL = "https://site.web.api.espn.com/apis/common/v3/search";

/*
  searchPlayers: up to 8 active players whose names match the search text, from ESPN.
  Saved for an hour per search text.
*/
const searchPlayers = cached(
  "espn-player-search",
  CACHE_SECONDS.espnPlayer,
  async (leagueSlug: LeagueSlug, query: string): Promise<SearchResult[]> => {
    const league = requireLeague(leagueSlug);
    const params = new URLSearchParams({
      query,
      limit: "8",
      type: "player",
      sport: league.espn.sport,
      league: league.espn.league,
    });
    const data = await espnGet(`${SEARCH_URL}?${params}`, playerSearchSchema, "player search");
    return data.items
      .filter((item) => item.isActive !== false)
      .map((item) => ({
        kind: "player" as const,
        player: {
          id: item.id,
          name: item.displayName,
          position: item.position?.abbreviation ?? null,
          teamAbbreviation: item.teamRelationships?.[0]?.core?.abbreviation ?? null,
        },
      }));
  },
);

/*
  search: teams first, then players.
  A team matches if the text is in its full name, city, nickname, or short code:
  "chiefs", "kansas", and "kc" all find the Chiefs.
  If ESPN's player search fails, the team results are still returned.
*/
export async function search(leagueSlug: LeagueSlug, query: string): Promise<SearchResult[]> {
  const text = normalizeName(query);
  const teams = await getTeams(leagueSlug);
  const teamResults: SearchResult[] = teams
    .filter((team) =>
      [team.displayName, team.location, team.name, team.abbreviation].some((field) =>
        normalizeName(field).includes(text),
      ),
    )
    .map((team) => ({ kind: "team", team }));

  let playerResults: SearchResult[] = [];
  try {
    playerResults = await searchPlayers(leagueSlug, text);
  } catch (error) {
    console.error("Player search unavailable:", error);
  }
  return [...teamResults, ...playerResults];
}
