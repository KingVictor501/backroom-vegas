/*
  FILE: app/api/players/[id]/route.ts
  WHAT IT'S FOR: GET /api/players/<ESPN player ID>: everything on the player
  page except the live props: name, photo, number, position, team, injury
  status, season stats, last 10 games with last-5 and last-10 averages, next
  game ID, and latest news. Stats only, no betting lines. A fake ID gets
  "404 not found". (Props aren't included, so testing this costs no Odds API credits.)
  Example: /api/players/3139477 (Patrick Mahomes)
  WHO USES IT: Postman tests (the spec asks for this route). The player page
  loads the same data directly on the server.
  WHY THIS NAME: The folders app/api/players/[id] become /api/players/<id>.
  Route files must be named "route", and it ends in .ts because it sends back data, not a screen.
*/

import { z } from "zod";
import { apiError, parseQuery, withUser } from "@/lib/api/respond";
import { espnIdRule, leagueParam } from "@/lib/api/params";
// getPlayerDetails from lib/services/espn/players.ts (Section 5).
import { getPlayerDetails } from "@/lib/services/espn/players";

const querySchema = z.object({ league: leagueParam });

/* GET: logged-in users only. */
export async function GET(request: Request, context: RouteContext<"/api/players/[id]">) {
  return withUser(async () => {
    const { id } = await context.params;
    const query = parseQuery(request, querySchema);
    if (!query.ok) return query.response;
    if (!espnIdRule.safeParse(id).success) return apiError("not-found", "We couldn't find that player.", 404);

    const details = await getPlayerDetails(query.data.league, id);
    return details ? Response.json(details) : apiError("not-found", "We couldn't find that player.", 404);
  });
}
