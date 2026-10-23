/*
  FILE: app/api/teams/route.ts
  WHAT IT'S FOR: GET /api/teams: every team in the league, A to Z, with IDs and logos.
  Example: /api/teams?league=nfl
  WHO USES IT: Postman tests now. Later: anywhere that needs the team list.
  WHY THIS NAME: The folders app/api/teams become /api/teams. Route files must
  be named "route", and it ends in .ts because it sends back data, not a screen.
*/

import { z } from "zod";
import { parseQuery, withUser } from "@/lib/api/respond";
import { leagueParam } from "@/lib/api/params";
// getTeams from lib/services/espn/teams.ts (Section 5).
import { getTeams } from "@/lib/services/espn/teams";

const querySchema = z.object({ league: leagueParam });

/* GET: logged-in users only. */
export async function GET(request: Request) {
  return withUser(async () => {
    const query = parseQuery(request, querySchema);
    if (!query.ok) return query.response;
    return Response.json(await getTeams(query.data.league));
  });
}
