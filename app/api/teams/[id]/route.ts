/*
  FILE: app/api/teams/[id]/route.ts
  WHAT IT'S FOR: GET /api/teams/<ESPN team ID>: one team's name, logo, record,
  division standing, season stats, last 5 results, and roster. Stats only: no
  betting lines. A fake ID gets "404 not found".
  Example: /api/teams/12 (Kansas City Chiefs)
  WHO USES IT: Postman tests now. Later: the team page (Section 11).
  WHY THIS NAME: "[id]" is a dynamic folder (the team ID from the address).
  Route files must be named "route", and it ends in .ts because it sends back data, not a screen.
*/

import { z } from "zod";
import { apiError, parseQuery, withUser } from "@/lib/api/respond";
import { espnIdRule, leagueParam } from "@/lib/api/params";
// The team services from lib/services/espn/teams.ts (Section 5).
import { getTeamOverview, getTeamRecentResults, getTeamRoster } from "@/lib/services/espn/teams";

const querySchema = z.object({ league: leagueParam });

/* GET: logged-in users only. The three ESPN lookups run at the same time to keep it fast. */
export async function GET(request: Request, context: RouteContext<"/api/teams/[id]">) {
  return withUser(async () => {
    const { id } = await context.params;
    const query = parseQuery(request, querySchema);
    if (!query.ok) return query.response;
    if (!espnIdRule.safeParse(id).success) return apiError("not-found", "We couldn't find that team.", 404);

    const overview = await getTeamOverview(query.data.league, id);
    if (!overview) return apiError("not-found", "We couldn't find that team.", 404);

    const [recentResults, roster] = await Promise.all([
      getTeamRecentResults(query.data.league, id),
      getTeamRoster(query.data.league, id),
    ]);
    return Response.json({ ...overview, recentResults, roster });
  });
}
