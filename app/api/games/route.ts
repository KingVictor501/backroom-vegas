/*
  FILE: app/api/games/route.ts
  WHAT IT'S FOR: GET /api/games: this week's games, soonest first, each with
  Spread / Total / Winner odds from the logged-in user's sportsbook.
  Example: /api/games?league=nfl
  WHO USES IT: Postman tests now. Later: the Feed and league pages can use the same service code directly.
  WHY THIS NAME: The folders app/api/games become the address /api/games.
  Next.js requires API route files to be named "route", and it ends in .ts
  because it sends back data, not a screen.
*/

import { z } from "zod";
// Shared API helpers (login check, friendly errors, address checks) from lib/api.
import { parseQuery, withUser } from "@/lib/api/respond";
import { leagueParam } from "@/lib/api/params";
// getGamesWithLines from lib/services/games.ts: ESPN games + matched Odds API lines (Section 5).
import { getGamesWithLines } from "@/lib/services/games";

/* The allowed ?settings: just an optional league (default "nfl"). */
const querySchema = z.object({ league: leagueParam });

/*
  GET: logged-in users only. Odds come from the user's own sportsbook choice
  (Hard Rock Bet unless they changed it in Settings).
  oddsUnavailable: true means The Odds API is down, so the games come back with lines: null.
*/
export async function GET(request: Request) {
  return withUser(async (user) => {
    const query = parseQuery(request, querySchema);
    if (!query.ok) return query.response;

    const result = await getGamesWithLines(query.data.league, user.preferredSportsbook);
    return Response.json({ sportsbook: user.preferredSportsbook, ...result });
  });
}
