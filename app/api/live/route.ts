/*
  FILE: app/api/live/route.ts
  WHAT IT'S FOR: GET /api/live: live scores for the games you ask about.
  Example: /api/live?league=nfl&games=401873022,401873023&stats=true
  - league: which league (default nfl)
  - games: 1 to 25 ESPN game IDs, separated by commas (digits only; anything else is a 400)
  - stats: "true" also sends the live box score, so player props can be graded. Default false.
  Answer: { "games": [ { gameId, status, label: "Q3 7:32", awayScore, homeScore, ... } ] }
  Games ESPN doesn't know are simply left out.
  SAFE BY DESIGN: only logged-in users can use it (so strangers can't make our server fetch ESPN), the
  ids are checked before anything is fetched, and the answer holds only public ESPN scores, nothing
  about the user. It never uses the Odds API, so it costs no credits.
  WHO USES IT: the browser's live score refresh (components/live/useLiveScores.ts).
  WHY THIS NAME: The folder app/api/live becomes the address /api/live. Next.js requires the file name
  "route", and it ends in .ts because it sends back data, not a screen.
*/

import { z } from "zod";
import { parseQuery, withUser } from "@/lib/api/respond";
import { espnIdRule, leagueParam } from "@/lib/api/params";
// getLiveGames from lib/services/espn/live.ts: the ESPN live scores (cached for 15 seconds).
import { getLiveGames } from "@/lib/services/espn/live";
import type { LiveScoresResponse } from "@/types";

/** The most games one request may ask about (a slip holds at most 25 picks). */
const MAX_GAMES = 25;

/*
  querySchema: the allowed ?settings.
  "games" arrives as one text like "1,2,3"; it is split and every id is checked with espnIdRule.
*/
const querySchema = z.object({
  league: leagueParam,
  games: z
    .string({ error: "Send the game IDs, like games=401873022,401873023." })
    .max(400, { error: "Too many game IDs." })
    .transform((value) => value.split(","))
    .pipe(z.array(espnIdRule).min(1, { error: "Send at least one game ID." }).max(MAX_GAMES, { error: `Ask about at most ${MAX_GAMES} games at a time.` })),
  stats: z.enum(["true", "false"], { error: "stats must be true or false." }).default("false"),
});

/* GET: logged-in users only. */
export async function GET(request: Request) {
  return withUser(async () => {
    const query = parseQuery(request, querySchema);
    if (!query.ok) return query.response;
    const games = await getLiveGames(query.data.league, query.data.games, query.data.stats === "true");
    const body: LiveScoresResponse = { games };
    return Response.json(body);
  });
}
