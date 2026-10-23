/*
  FILE: app/api/injuries/route.ts
  WHAT IT'S FOR: GET /api/injuries?team=<ESPN team ID>: one team's injury
  report. Without ?team, it returns every team's injuries, grouped by team ID.
  A team ID that doesn't exist gets "404 not found".
  Example: /api/injuries?team=12
  WHO USES IT: Postman tests now. Later: the team and player pages (Sections 11 and 11B).
  WHY THIS NAME: The folders app/api/injuries become /api/injuries. Route files
  must be named "route", and it ends in .ts because it sends back data, not a screen.
*/

import { z } from "zod";
import { apiError, parseQuery, withUser } from "@/lib/api/respond";
import { leagueParam, optionalTeamParam } from "@/lib/api/params";
import { getInjuriesByTeam } from "@/lib/services/espn/injuries";
import { getTeams } from "@/lib/services/espn/teams";

const querySchema = z.object({ league: leagueParam, team: optionalTeamParam });

/* GET: logged-in users only. */
export async function GET(request: Request) {
  return withUser(async () => {
    const query = parseQuery(request, querySchema);
    if (!query.ok) return query.response;
    const { league, team } = query.data;

    const byTeam = await getInjuriesByTeam(league);
    if (!team) return Response.json(byTeam);

    // Check the team is real, so a typo gets "not found" instead of an empty list that looks like "no injuries".
    const teams = await getTeams(league);
    if (!teams.some((t) => t.id === team)) return apiError("not-found", "We couldn't find that team.", 404);
    return Response.json(byTeam[team] ?? []);
  });
}
