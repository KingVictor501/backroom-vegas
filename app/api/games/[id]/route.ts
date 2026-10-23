/*
  FILE: app/api/games/[id]/route.ts
  WHAT IT'S FOR: GET /api/games/<ESPN game ID>: one game's details (teams,
  records, time, venue, win chance, box score once played) plus its odds from
  the user's sportsbook. A fake ID gets "404 not found".
  Example: /api/games/401873022
  WHO USES IT: Postman tests now. Later: the matchup page (Section 10) uses the same service code.
  WHY THIS NAME: "[id]" in square brackets is a dynamic folder: whatever is in
  that part of the address arrives as "id". Route files must be named "route",
  and it ends in .ts because it sends back data, not a screen.
*/

import { z } from "zod";
import { apiError, parseQuery, withUser } from "@/lib/api/respond";
import { espnIdRule, leagueParam } from "@/lib/api/params";
// getGameWithLines from lib/services/games.ts: one ESPN game + its matched odds (Section 5).
import { getGameWithLines } from "@/lib/services/games";

const querySchema = z.object({ league: leagueParam });

/*
  GET: logged-in users only.
  RouteContext<"/api/games/[id]"> is a Next.js-made type that knows this route has an "id".
*/
export async function GET(request: Request, context: RouteContext<"/api/games/[id]">) {
  return withUser(async (user) => {
    const { id } = await context.params;
    const query = parseQuery(request, querySchema);
    if (!query.ok) return query.response;
    // A badly formed ID can't be a real game, so answer "not found" without asking ESPN.
    if (!espnIdRule.safeParse(id).success) return apiError("not-found", "We couldn't find that game.", 404);

    const result = await getGameWithLines(query.data.league, id, user.preferredSportsbook);
    if (!result) return apiError("not-found", "We couldn't find that game.", 404);
    return Response.json({ sportsbook: user.preferredSportsbook, ...result });
  });
}
