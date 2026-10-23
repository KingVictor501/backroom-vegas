/*
  FILE: app/api/news/route.ts
  WHAT IT'S FOR: GET /api/news: the latest NFL news as plain text (any HTML is
  stripped on the server). Add ?team=<ESPN team ID> for one team's news, and
  ?limit= for how many (1-25, default 10).
  Example: /api/news?limit=5 or /api/news?team=12
  WHO USES IT: Postman tests now. Later: the NFL news widget on the Feed (Section 14).
  WHY THIS NAME: The folders app/api/news become /api/news, the address the
  spec's news widget calls. Route files must be named "route", and it ends in
  .ts because it sends back data, not a screen.
*/

import { z } from "zod";
import { apiError, parseQuery, withUser } from "@/lib/api/respond";
import { leagueParam, limitParam, optionalTeamParam } from "@/lib/api/params";
import { getNews } from "@/lib/services/espn/news";
import { getTeams } from "@/lib/services/espn/teams";

const querySchema = z.object({ league: leagueParam, team: optionalTeamParam, limit: limitParam });

/* GET: logged-in users only. Returns [] (an empty list) when there's no news right now. */
export async function GET(request: Request) {
  return withUser(async () => {
    const query = parseQuery(request, querySchema);
    if (!query.ok) return query.response;
    const { league, team, limit } = query.data;

    if (team) {
      const teams = await getTeams(league);
      if (!teams.some((t) => t.id === team)) return apiError("not-found", "We couldn't find that team.", 404);
    }
    return Response.json(await getNews(league, team ?? null, limit));
  });
}
