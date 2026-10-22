/*
  FILE: app/api/dev/services-test/route.ts
  WHAT IT'S FOR: A TEMPORARY Section 5 test. Visiting /api/dev/services-test
  calls each new service once (ESPN games, teams, injuries, news, a player, and
  The Odds API's game lines and touchdown props) and shows a short summary, so
  we can see real data flowing. It costs about 7 Odds API credits the first
  time, then 0 for the next hour (results are cached).
  It only works on your computer. On the live site it answers "not found".
  We'll delete it once you've seen it work.
  WHO USES IT: Only you, in the browser. No page uses it.
  WHY THIS NAME: /api/dev/... = development only. API route files must be named
  "route", and it ends in .ts because it sends back data, not a screen.
*/

import { getGamesWithLines, getGameWithLines } from "@/lib/services/games";
import { getGameProps } from "@/lib/services/odds/props";
import { getTeamOverview, getTeamRecentResults } from "@/lib/services/espn/teams";
import { getTeamInjuries } from "@/lib/services/espn/injuries";
import { getNews } from "@/lib/services/espn/news";
import { getPlayerDetails } from "@/lib/services/espn/players";
import { getGameSummary } from "@/lib/services/espn/games";

/*
  GET: runs every service and returns a short summary of what came back.
  Read-only: it saves nothing, and it ignores anything sent to it.
*/
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return Response.json({ error: { code: "not-found", message: "Not found." } }, { status: 404 });
  }

  try {
    // 1. This week's games with Hard Rock odds (3 credits the first time).
    const { games, oddsUnavailable } = await getGamesWithLines("nfl", "hardrock");
    const kcGame = games.find((g) => g.awayTeam.abbreviation === "KC" || g.homeTeam.abbreviation === "KC");

    // 2. The Chiefs game's details + touchdown props (about 4 credits the first time).
    const matchup = kcGame ? await getGameWithLines("nfl", kcGame.id, "hardrock") : null;
    const tdProps = matchup ? await getGameProps(matchup.game, "touchdowns", "hardrock") : null;

    // 3. ESPN team, injuries, news, and player data (free).
    const [team, results, injuries, news, player, fakeGame, fakeTeam, fakePlayer] = await Promise.all([
      getTeamOverview("nfl", "12"),
      getTeamRecentResults("nfl", "12"),
      getTeamInjuries("nfl", "12"),
      getNews("nfl"),
      getPlayerDetails("nfl", "3139477"),
      getGameSummary("nfl", "999999999"),
      getTeamOverview("nfl", "999"),
      getPlayerDetails("nfl", "999999999"),
    ]);

    return Response.json({
      games: {
        count: games.length,
        withHardRockLines: games.filter((g) => g.lines !== null).length,
        oddsUnavailable,
        first: games[0] && {
          matchup: `${games[0].awayTeam.abbreviation} @ ${games[0].homeTeam.abbreviation}`,
          startsAt: games[0].startsAt,
          lines: games[0].lines,
        },
      },
      chiefsGame: matchup && {
        espnId: matchup.game.id,
        oddsEventId: matchup.game.oddsEventId,
        winProbability: matchup.game.winProbability,
        records: `${matchup.game.awayTeam.record} vs ${matchup.game.homeTeam.record}`,
      },
      touchdownProps: tdProps?.sections.map((s) => ({
        title: s.title,
        players: s.rows.length,
        firstThree: s.rows.slice(0, 3).map((r) => `${r.player.name} (${r.player.id ?? "no ESPN match"}) ${r.outcomes.map((o) => o.odds).join("/")}`),
      })),
      chiefs: team && {
        record: team.team.record,
        standing: team.divisionStanding,
        seasonStats: team.seasonStats,
        lastResults: results.map((r) => `${r.result} ${r.teamScore}-${r.opponentScore} vs ${r.opponent.abbreviation}`),
        injuries: injuries.slice(0, 3).map((i) => `${i.player.name}: ${i.status} (${i.detail})`),
      },
      news: news.slice(0, 2).map((n) => n.headline),
      mahomes: player && {
        name: player.player.name,
        jersey: player.player.jersey,
        injuryStatus: player.player.injuryStatus,
        seasonStats: player.seasonStats,
        gamesInLog: player.recentGames.length,
        last5Average: player.last5Average,
        nextGameId: player.nextGameId,
      },
      notFoundChecks: { fakeGame, fakeTeam, fakePlayer },
    });
  } catch (error) {
    console.error("Services test failed:", error);
    return Response.json(
      { error: { code: "upstream-error", message: "A service failed. Check the terminal for details." } },
      { status: 502 },
    );
  }
}
