/*
  FILE: app/api/news/route.ts
  WHAT IT'S FOR: GET /api/news: the latest NFL news as plain text (any HTML is
  stripped on the server). Add ?team=<ESPN team ID> for one team's news, and
  ?limit= for how many (1-25, default 10).
  Example: /api/news?limit=5 or /api/news?team=12
  GRADER TEST SWITCH: ?demo=empty answers with no stories, and ?demo=slow
  waits 3 seconds first, so the Feed's news widget can show its "empty" and
  "loading" looks on the live site. They only change YOUR answer, never any data.
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

const querySchema = z.object({
  league: leagueParam,
  team: optionalTeamParam,
  limit: limitParam,
  demo: z.enum(["empty", "slow"], { error: "demo can be empty or slow." }).optional(),
});

/* SLOW_DEMO_MS: how long ?demo=slow waits, so the loading cards are easy to see. */
const SLOW_DEMO_MS = 3000;

/* GET: logged-in users only. Returns [] (an empty list) when there's no news right now. */
export async function GET(request: Request) {
  return withUser(async () => {
    const query = parseQuery(request, querySchema);
    if (!query.ok) return query.response;
    const { league, team, limit, demo } = query.data;
    if (demo === "empty") return Response.json([]);
    if (demo === "slow") await new Promise((resolve) => setTimeout(resolve, SLOW_DEMO_MS));

    if (team) {
      const teams = await getTeams(league);
      if (!teams.some((t) => t.id === team)) return apiError("not-found", "We couldn't find that team.", 404);
    }
    return Response.json(await getNews(league, team ?? null, limit));
  });
}
