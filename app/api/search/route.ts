/*
  FILE: app/api/search/route.ts
  WHAT IT'S FOR: GET /api/search?q=<text>: "Find a team or player". Teams come
  first, then players. Each result says whether it's a team or a player, so the
  page knows where to link.
  Example: /api/search?q=chiefs or /api/search?q=mahomes
  WHO USES IT: Postman tests now. Later: the search bar on the Feed (Section 9).
  WHY THIS NAME: The folders app/api/search become /api/search. Route files must
  be named "route", and it ends in .ts because it sends back data, not a screen.
*/

import { z } from "zod";
import { parseQuery, withUser } from "@/lib/api/respond";
import { leagueParam } from "@/lib/api/params";
import { search } from "@/lib/services/espn/search";

/* q must be 2-50 characters, so one-letter searches don't flood ESPN with requests. */
const querySchema = z.object({
  league: leagueParam,
  q: z
    .string({ error: "Type a team or player name to search." })
    .trim()
    .min(2, { error: "Type at least 2 letters." })
    .max(50, { error: "Searches can be up to 50 characters." }),
});

/* GET: logged-in users only. Returns [] when nothing matches. */
export async function GET(request: Request) {
  return withUser(async () => {
    const query = parseQuery(request, querySchema);
    if (!query.ok) return query.response;
    return Response.json(await search(query.data.league, query.data.q));
  });
}
