/*
  FILE: components/team/TeamSections.tsx
  WHAT IT'S FOR: The parts of the team page that load IN AFTER the top:
  - RecentGames: the last 5 games (date, opponent, final score, win or loss)
    with the team's stats from each game
  - KeyPlayers: the starting QB, top running backs, and top receivers, each
    with their last 5 games and an average row at the bottom
  - InjuriesAndNews: the injury report and the team's latest news, at the bottom
  - SectionSkeleton: the gray placeholder shown while a part is loading
  Each part loads its own data on the server. The page wraps each one in
  <Suspense>, so the top of the page shows right away and these fill in as they're ready.
  If one part can't load, it shows a short message and the rest of the page still works.
  Stats only: no betting lines anywhere on this page.
  WHO USES IT: app/(main)/team/[teamId]/page.tsx.
  WHY THIS NAME: Sections of the team page. It ends in .tsx because it shows something on screen.
*/

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
// shortDate ("Oct 18") from lib/format/gameTime.ts.
import { shortDate } from "@/lib/format/gameTime";
// The team's injuries and news, from lib/services/espn.
import { getTeamInjuries } from "@/lib/services/espn/injuries";
import { getNews } from "@/lib/services/espn/news";
// The last 5 games with stats and the key players, from lib/services/teamPage.ts.
import { GAME_STATS, getTeamKeyPlayers, getTeamRecentGames } from "@/lib/services/teamPage";
// The shared injury report from components/InjuryList.tsx.
import InjuryList from "@/components/InjuryList";
// The shared news list from components/NewsList.tsx.
import NewsList from "@/components/NewsList";
// The shared stat table pieces from components/stats/StatTable.tsx.
import { num, PlayerGamesTable, TableBox, td, th } from "@/components/stats/StatTable";
import type { LeagueSlug, TeamKeyPlayer } from "@/types";

/* TeamSectionProps: every section needs the league and the team. */
type TeamSectionProps = { league: LeagueSlug; teamId: string };

/* Card: the box around each section, with its heading. */
function Card({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="rounded-2xl border border-line bg-card p-5">
      <h2 id={id} className="text-xl text-text">
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/* Unavailable: the short note when one section can't load. */
function Unavailable({ what }: { what: string }) {
  return <p className="text-sm text-muted">{what} aren&apos;t available right now. Please try again in a few minutes.</p>;
}

/* SectionSkeleton: gray bars shown while a section loads. */
export function SectionSkeleton({ title }: { title: string }) {
  return (
    <section aria-busy="true" className="rounded-2xl border border-line bg-card p-5">
      <h2 className="text-xl text-text">{title}</h2>
      <p className="sr-only" role="status">
        Loading {title.toLowerCase()}…
      </p>
      <div className="mt-4 space-y-2">
        {[0, 1, 2, 3].map((row) => (
          <div key={row} className="h-8 animate-pulse rounded-lg bg-card-raised" />
        ))}
      </div>
    </section>
  );
}

/* RecentGames: the last 5 games with the team's stats from each. */
export async function RecentGames({ league, teamId }: TeamSectionProps) {
  const games = await getTeamRecentGames(league, teamId).catch(() => null);
  return (
    <Card id="recent-games" title="Last 5 games">
      {games === null ? (
        <Unavailable what="Recent games" />
      ) : games.length === 0 ? (
        <p className="text-sm text-muted">No finished games yet this season.</p>
      ) : (
        <TableBox label="Last 5 games">
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className={th}>Date</th>
              <th scope="col" className={th}>Opponent</th>
              <th scope="col" className={th}>Result</th>
              {GAME_STATS.map((label) => (
                <th key={label} scope="col" className={th}>
                  {label === "Passing" || label === "Rushing" ? `${label} yds` : label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {games.map((game) => (
              <tr key={game.gameId}>
                <td className={`${td} text-muted`}>{shortDate(game.playedAt)}</td>
                <td className={td}>
                  <span className="flex items-center gap-2">
                    <span className="text-muted">{game.isHome ? "vs" : "@"}</span>
                    {game.opponent.logoUrl && <Image src={game.opponent.logoUrl} alt="" width={20} height={20} className="size-5" />}
                    <Link href={`/team/${game.opponent.id}`} className="font-medium hover:text-gold">
                      {game.opponent.abbreviation}
                    </Link>
                  </span>
                </td>
                <td className={td}>
                  <Link href={`/matchup/${game.gameId}`} className="hover:text-gold">
                    <span className={`font-semibold ${game.result === "W" ? "text-gold" : game.result === "L" ? "text-danger" : "text-text"}`}>
                      {game.result}
                    </span>{" "}
                    {game.teamScore}–{game.opponentScore}
                  </Link>
                </td>
                {game.stats.map((stat) => (
                  <td key={stat.label} className={td}>
                    {num(stat.value)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </TableBox>
      )}
    </Card>
  );
}

/* ROLE_TITLES: the small heading over each group of players. */
const ROLE_TITLES: Record<TeamKeyPlayer["role"], string> = { QB: "Quarterback", RB: "Running backs", "WR-TE": "Receivers" };

/* KeyPlayerCard: one player's photo and name (linking to their page) with their last 5 games and average. */
function KeyPlayerCard({ keyPlayer }: { keyPlayer: TeamKeyPlayer }) {
  const { player, role, games, average } = keyPlayer;
  return (
    <article aria-labelledby={`kp-${player.id}`} className="min-w-0 rounded-xl border border-line bg-card-raised p-4">
      <div className="flex items-center gap-3">
        {player.photoUrl ? (
          <Image src={player.photoUrl} alt="" width={48} height={48} className="size-12 rounded-full bg-card object-cover" />
        ) : (
          <span aria-hidden className="size-12 rounded-full bg-card" />
        )}
        <div className="min-w-0">
          <h4 id={`kp-${player.id}`}>
            <Link href={`/player/${player.id}`} className="block truncate font-semibold text-text hover:text-gold">
              {player.name}
            </Link>
          </h4>
          <p className="text-xs text-muted">
            {player.position}
            {player.jersey && ` · #${player.jersey}`}
          </p>
        </div>
      </div>

      {games.length === 0 ? (
        <p className="mt-3 text-sm text-muted">No games played yet this season.</p>
      ) : (
        <div className="mt-3">
          <PlayerGamesTable
            role={role}
            games={games}
            averages={[{ label: "Average", stats: average }]}
            label={`${player.name}, last ${games.length} games`}
            bleed="-mx-4 px-4"
          />
        </div>
      )}
    </article>
  );
}

/* KeyPlayers: the QB, RBs, and receivers, grouped under small headings. */
export async function KeyPlayers({ league, teamId }: TeamSectionProps) {
  const players = await getTeamKeyPlayers(league, teamId).catch(() => null);
  return (
    <Card id="key-players" title="Key players: last 5 games">
      {players === null ? (
        <Unavailable what="Player stats" />
      ) : players.length === 0 ? (
        <p className="text-sm text-muted">No player stats yet this season.</p>
      ) : (
        <div className="space-y-5">
          {(["QB", "RB", "WR-TE"] as const).map((role) => {
            const group = players.filter((p) => p.role === role);
            if (group.length === 0) return null;
            return (
              <div key={role}>
                <h3 className="mb-2 font-sans text-xs font-semibold uppercase tracking-wide text-muted">{ROLE_TITLES[role]}</h3>
                {/* grid-cols-1 + min-w-0: a column may shrink to the screen, so wide tables scroll inside their card instead of stretching the page. */}
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {group.map((keyPlayer) => (
                    <KeyPlayerCard key={keyPlayer.player.id} keyPlayer={keyPlayer} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

/* InjuriesAndNews: the injury report and the latest team news, side by side on wide screens. */
export async function InjuriesAndNews({ league, teamId }: TeamSectionProps) {
  const [injuries, news] = await Promise.all([
    getTeamInjuries(league, teamId).catch(() => null),
    getNews(league, teamId, 6).catch(() => null),
  ]);
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <Card id="injuries" title="Injury report">
        {injuries === null ? (
          <Unavailable what="Injuries" />
        ) : (
          <InjuryList injuries={injuries} />
        )}
      </Card>

      <Card id="team-news" title="Team news">
        {news === null ? (
          <Unavailable what="News stories" />
        ) : (
          <NewsList articles={news} />
        )}
      </Card>
    </div>
  );
}
