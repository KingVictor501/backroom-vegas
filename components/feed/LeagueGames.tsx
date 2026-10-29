/*
  FILE: components/feed/LeagueGames.tsx
  WHAT IT'S FOR: Loads a league's upcoming games and odds ON THE SERVER, then
  hands them to GameBrowser to show. Because the loading happens here, the
  games are already inside the page when it arrives (they're in "View Source"
  even with JavaScript turned off).
  If ESPN is down, it shows a friendly message instead of a broken page.
  WHO USES IT: the Feed (app/(main)/page.tsx) and the league page (app/(main)/league/[league]/page.tsx).
  WHY THIS NAME: It's a league's games. It has no "use client", so it only runs
  on the server. It ends in .tsx because it shows something on screen.
*/

import "server-only";
// The league settings type from config/leagues.ts, and the sportsbook names from config/sportsbooks.ts.
import type { LeagueConfig } from "@/config/leagues";
import { SPORTSBOOKS } from "@/config/sportsbooks";
// getUpcomingGamesWithLines from lib/services/games.ts: ESPN games + The Odds API prices.
import { getUpcomingGamesWithLines, type UpcomingGamesResult } from "@/lib/services/games";
// UpstreamError from lib/services/http.ts: thrown when ESPN doesn't answer.
import { UpstreamError } from "@/lib/services/http";
import type { LeagueSlug, User } from "@/types";
// The browser part that filters and shows the games.
import PracticeOddsNotice from "@/components/PracticeOddsNotice";
import GameBrowser from "./GameBrowser";

/*
  LeagueGames
  - league: which league (must be turned on)
  - user: the logged-in user, for their sportsbook
*/
export default async function LeagueGames({ league, user }: { league: LeagueConfig; user: User }) {
  let data: UpcomingGamesResult;
  try {
    data = await getUpcomingGamesWithLines(league.slug as LeagueSlug, user.preferredSportsbook);
  } catch (error) {
    if (!(error instanceof UpstreamError)) throw error;
    console.error(error.message);
    return (
      <p role="alert" className="rounded-2xl border border-danger/50 bg-card p-6 text-sm text-danger">
        We couldn&apos;t load {league.label} games right now. ESPN isn&apos;t responding. Please try again in a minute.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {league.bettingEnabled && <PracticeOddsNotice />}
      <GameBrowser
        leagueSlug={league.slug}
        leagueLabel={league.label}
        betTypes={league.betTypes}
        games={data.games}
        thisWeekGameIds={data.thisWeekGameIds}
        sportsbook={user.preferredSportsbook}
        sportsbookName={SPORTSBOOKS[user.preferredSportsbook].name}
        oddsUnavailable={data.oddsUnavailable}
        scoresOnly={!league.bettingEnabled}
      />
    </div>
  );
}
