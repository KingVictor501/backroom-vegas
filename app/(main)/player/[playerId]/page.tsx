/*
  FILE: app/(main)/player/[playerId]/page.tsx
  WHAT IT'S FOR: A player's page, e.g. /player/3139477 (Patrick Mahomes),
  built on the server, as described in PAGES:
  - photo, name, number, position, team, and injury status
  - season stats that fit the position (QB passing, RB rushing, WR/TE receiving)
  - the last 10 games in a table, with last-5 and last-10 averages at the bottom
  - the player's latest news
  - LAST: the next game (links to the matchup page) with this player's LIVE
    props as odds buttons. The props load in after the rest of the page (inside <Suspense>).
  Stats only for past games: no old betting lines. A fake player ID shows "Player not found".
  WHO USES IT: Next.js shows it for any address that starts with /player/.
  Player names on the team page, in prop tables, and in search results link here.
  WHY THIS NAME: "[playerId]" in square brackets is a dynamic folder: the ID in the
  address is handed to the page as "playerId". It ends in .tsx because it shows something on screen.
*/

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
// The shared news list and stat table, from components.
import NewsList from "@/components/NewsList";
import { PlayerGamesTable } from "@/components/stats/StatTable";
// The player page pieces, from components/player.
import NextGameCard, { NextGameSkeleton } from "@/components/player/NextGameCard";
import PlayerHeader from "@/components/player/PlayerHeader";
// NbaPlayerView: the basketball version of this page. parseStatsLeague reads ?league=; isBasketball picks the view.
import NbaPlayerView from "@/components/basketball/NbaPlayerView";
import { isBasketball, parseStatsLeague } from "@/lib/leagues/links";
import { getNbaPlayerDetails } from "@/lib/services/espn/basketball";
// requireUser from lib/auth/dal.ts: the logged-in user (for their sportsbook).
import { requireUser } from "@/lib/auth/dal";
// Everything about the player except props, from lib/services/espn/players.ts.
import { getPlayer, getPlayerDetails } from "@/lib/services/espn/players";

/* The league comes from the address's ?league= setting. No setting means the NFL, so older addresses still work. */

/* isPlayerId: ESPN player IDs are only digits. Anything else can't be a real player. */
function isPlayerId(id: string): boolean {
  return /^\d{1,12}$/.test(id);
}

/* generateMetadata: the browser tab title, like "Patrick Mahomes | The Vegas Backroom". */
export async function generateMetadata(props: PageProps<"/player/[playerId]">): Promise<Metadata> {
  const [{ playerId }, search] = await Promise.all([props.params, props.searchParams]);
  const league = parseStatsLeague(search.league);
  if (!league || !isPlayerId(playerId)) return { title: "Player" };
  const name = isBasketball(league)
    ? (await getNbaPlayerDetails(playerId).catch(() => null))?.player.name
    : (await getPlayer(league, playerId).catch(() => null))?.name;
  return { title: name ?? "Player" };
}

/* PlayerPage: runs on the server. */
export default async function PlayerPage(props: PageProps<"/player/[playerId]">) {
  const [{ playerId }, search] = await Promise.all([props.params, props.searchParams]);
  // A league that doesn't exist, is off, or has no player pages is "not found" (null = not a valid league).
  const league = parseStatsLeague(search.league);
  if (!league || !isPlayerId(playerId)) notFound();

  if (isBasketball(league)) {
    const [, nbaDetails] = await Promise.all([requireUser(), getNbaPlayerDetails(playerId)]);
    if (!nbaDetails) notFound();
    return <NbaPlayerView details={nbaDetails} />;
  }

  const [user, details] = await Promise.all([requireUser(), getPlayerDetails(league, playerId)]);
  if (!details) notFound();
  const { player, seasonStats, recentGames, last5Average, last10Average, nextGameId, news } = details;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PlayerHeader player={player} seasonStats={seasonStats} />

      <section aria-labelledby="last-10" className="rounded-2xl border border-line bg-card p-5">
        <h2 id="last-10" className="text-xl text-text">
          Last {recentGames.length === 10 ? "10" : recentGames.length} games
        </h2>
        <div className="mt-4">
          {recentGames.length === 0 ? (
            <p className="text-sm text-muted">No games played yet this season.</p>
          ) : player.positionGroup === "OTHER" ? (
            <p className="text-sm text-muted">Game-by-game stats are shown for quarterbacks, running backs, wide receivers, and tight ends.</p>
          ) : (
            <PlayerGamesTable
              role={player.positionGroup}
              games={recentGames}
              showResult
              label={`${player.name}, last ${recentGames.length} games`}
              averages={[
                { label: "Last 5 avg", stats: last5Average },
                { label: `Last ${recentGames.length} avg`, stats: last10Average },
              ]}
            />
          )}
        </div>
      </section>

      <section aria-labelledby="player-news" className="rounded-2xl border border-line bg-card p-5">
        <h2 id="player-news" className="text-xl text-text">
          Latest news
        </h2>
        <div className="mt-2">
          <NewsList articles={news} />
        </div>
      </section>

      {/* The next game and its live props go last on the page. */}
      <Suspense fallback={<NextGameSkeleton />}>
        <NextGameCard league={league} player={player} nextGameId={nextGameId} sportsbook={user.preferredSportsbook} />
      </Suspense>
    </div>
  );
}
