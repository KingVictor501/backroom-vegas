/*
  FILE: app/api/games/[id]/props/route.ts
  WHAT IT'S FOR: GET /api/games/<ESPN game ID>/props?category=touchdowns: one
  game's player props for one category, from the user's sportsbook, arranged
  into sections (TD Scorers, First TD Scorer, 2+ TDs, 1st Half TDs, ...).
  Costs about 1 Odds API credit per section the first time in an hour, then 0 (cached).
  WHO USES IT: Postman tests now. Later: the Player Props tab (Section 10).
  WHY THIS NAME: It sits inside games/[id], so the address is /api/games/<id>/props.
  Route files must be named "route", and it ends in .ts because it sends back data, not a screen.
*/

import { z } from "zod";
import { apiError, parseQuery, withUser } from "@/lib/api/respond";
import { categoryParam, espnIdRule, leagueParam } from "@/lib/api/params";
import { getGameWithLines } from "@/lib/services/games";
// getGameProps from lib/services/odds/props.ts: loads props ONLY for this one game (Section 5).
import { getGameProps } from "@/lib/services/odds/props";

/* Allowed ?settings: league (optional) and category (required). */
const querySchema = z.object({ league: leagueParam, category: categoryParam });

/*
  GET: logged-in users only.
  sections: [] means the user's sportsbook doesn't offer these props for this
  game (or odds aren't posted yet). The page then suggests another book.
*/
export async function GET(request: Request, context: RouteContext<"/api/games/[id]/props">) {
  return withUser(async (user) => {
    const { id } = await context.params;
    const query = parseQuery(request, querySchema);
    if (!query.ok) return query.response;
    if (!espnIdRule.safeParse(id).success) return apiError("not-found", "We couldn't find that game.", 404);

    // Look the game up first: this finds its Odds API ID, and a fake ID stops here (no credits spent).
    const match = await getGameWithLines(query.data.league, id, user.preferredSportsbook);
    if (!match) return apiError("not-found", "We couldn't find that game.", 404);

    const props = await getGameProps(match.game, query.data.category, user.preferredSportsbook);
    return Response.json(props);
  });
}
