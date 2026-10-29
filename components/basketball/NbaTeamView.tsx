/*
  FILE: components/basketball/NbaTeamView.tsx
  WHAT IT'S FOR: The whole NBA team page: the header with the team's record and standing, per-game season
  numbers (points, shooting %, rebounds, assists), the last 5 games, the key players (top scorers), and the
  injury report and news. Each lower part loads on its own, so one slow or broken ESPN answer never
  blanks the page (every part has its own loading, error, empty, and data look).
  Football's version is components/team/TeamHeader.tsx + TeamSections.tsx. Basketball is separate because
  the numbers are different.
  WHO USES IT: app/(main)/team/[teamId]/page.tsx, when the address says ?league=nba.
  WHY THIS NAME: "Nba" + "Team" + "View". It ends in .tsx because it shows something on screen.
*/

import Image from "next/image";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import InjuryList from "@/components/InjuryList";
import NewsList from "@/components/NewsList";
import { num, TableBox, td, th } from "@/components/stats/StatTable";
// SectionSkeleton + UpcomingSchedule (the closed "Remaining schedule" box), shared with the NFL team page.
import { SectionSkeleton, UpcomingSchedule } from "@/components/team/TeamSections";
import { shortDate } from "@/lib/format/gameTime";
import { matchupHref, playerHref, teamHref } from "@/lib/leagues/links";
import { getNbaKeyPlayers, getNbaTeamResults } from "@/lib/services/espn/basketball";
import { getTeamInjuries } from "@/lib/services/espn/injuries";
import { getNews } from "@/lib/services/espn/news";
import type { NbaTeamOverview } from "@/types";

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
  return (
    <p role="status" className="text-sm text-muted">
      {what} aren&apos;t available right now. Please try again in a few minutes.
    </p>
  );
}

/* show: a number with up to 1 decimal, or a dash when it's missing. */
function show(value: number | string | null, suffix = ""): string {
  if (value === null) return "–";
  return typeof value === "string" ? value : `${value.toLocaleString("en-US", { maximumFractionDigits: 1 })}${suffix}`;
}

/* NbaTeamHeader: logo, name, record, standing, and the season numbers. */
function NbaTeamHeader({ overview }: { overview: NbaTeamOverview }) {
  const { team, standing, stats } = overview;
  const cells: { label: string; value: string }[] = [
    { label: "Points / game", value: show(stats.pointsFor) },
    { label: "Allowed / game", value: show(stats.pointsAgainst) },
    { label: "FG %", value: show(stats.fieldGoalPct, "%") },
    { label: "3P %", value: show(stats.threePointPct, "%") },
    { label: "Rebounds / game", value: show(stats.reboundsPerGame) },
    { label: "Assists / game", value: show(stats.assistsPerGame) },
    { label: "Turnovers / game", value: show(stats.turnoversPerGame) },
    { label: "Home / away", value: `${stats.homeRecord ?? "–"} / ${stats.awayRecord ?? "–"}` },
  ];
  return (
    <>
      <header className="flex items-center gap-4 rounded-2xl border border-line bg-card p-5">
        {team.logoUrl ? (
          <Image src={team.logoUrl} alt="" width={96} height={96} className="size-20 shrink-0 sm:size-24" priority />
        ) : (
          <span aria-hidden className="size-20 shrink-0 rounded-full bg-card-raised" />
        )}
        <div className="min-w-0">
          <h1 className="text-3xl leading-tight text-gold">{team.displayName}</h1>
          <p className="mt-1 text-lg font-semibold tabular-nums text-text">{team.record ?? "Record unavailable"}</p>
          {standing && <p className="text-sm text-muted">{standing}</p>}
        </div>
      </header>

      <section aria-labelledby="nba-season-stats" className="rounded-2xl border border-line bg-card p-5">
        <h2 id="nba-season-stats" className="text-xl text-text">
          Season stats
        </h2>
        {/* dl = a list of label/value pairs, so screen readers read "Points / game: 109". */}
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {cells.map((cell) => (
            <div key={cell.label} className="min-w-0 rounded-xl bg-card-raised p-3">
              <dt className="text-xs text-muted">{cell.label}</dt>
              <dd className="mt-1 text-xl font-semibold tabular-nums text-text">{cell.value}</dd>
            </div>
          ))}
        </dl>
      </section>
    </>
  );
}

/* RecentResults: the last 5 finished games. */
async function RecentResults({ teamId }: { teamId: string }) {
  const games = await getNbaTeamResults(teamId).catch(() => null);
  return (
    <Card id="nba-recent" title="Last 5 games">
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
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {games.map((game) => {
              const opponentHref = teamHref("nba", game.opponent.id);
              return (
                <tr key={game.gameId}>
                  <td className={`${td} text-muted`}>{shortDate(game.playedAt)}</td>
                  <td className={td}>
                    <span className="flex items-center gap-2">
                      <span className="text-muted">{game.isHome ? "vs" : "@"}</span>
                      {game.opponent.logoUrl && <Image src={game.opponent.logoUrl} alt="" width={20} height={20} className="size-5" />}
                      {opponentHref ? (
                        <Link href={opponentHref} className="font-medium hover:text-gold">
                          {game.opponent.abbreviation}
                        </Link>
                      ) : (
                        <span className="font-medium">{game.opponent.abbreviation}</span>
                      )}
                    </span>
                  </td>
                  <td className={td}>
                    <Link href={matchupHref(game.gameId, "nba")} className="hover:text-gold">
                      <span className={`font-semibold ${game.result === "W" ? "text-gold" : "text-danger"}`}>{game.result}</span> {game.teamScore}–{game.opponentScore}
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </TableBox>
      )}
    </Card>
  );
}

/* KeyPlayers: the team's top scorers with points, rebounds, and assists per game. */
async function KeyPlayers({ teamId }: { teamId: string }) {
  const players = await getNbaKeyPlayers(teamId).catch(() => null);
  return (
    <Card id="nba-key-players" title="Key players">
      {players === null ? (
        <Unavailable what="Key players" />
      ) : players.length === 0 ? (
        <p className="text-sm text-muted">No player stats yet this season.</p>
      ) : (
        <TableBox label="Key players, per game">
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className={th}>Player</th>
              <th scope="col" className={th}>PTS</th>
              <th scope="col" className={th}>REB</th>
              <th scope="col" className={th}>AST</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {players.map((player) => {
              const href = playerHref("nba", player.id);
              const label = [player.jersey && `#${player.jersey}`, player.position].filter(Boolean).join(" · ");
              return (
                <tr key={player.id}>
                  <td className={td}>
                    {href ? (
                      <Link href={href} className="font-medium hover:text-gold">
                        {player.name}
                      </Link>
                    ) : (
                      <span className="font-medium">{player.name}</span>
                    )}
                    {label && <span className="ml-2 text-xs text-muted">{label}</span>}
                  </td>
                  <td className={td}>{num(player.pointsPerGame)}</td>
                  <td className={td}>{num(player.reboundsPerGame)}</td>
                  <td className={td}>{num(player.assistsPerGame)}</td>
                </tr>
              );
            })}
          </tbody>
        </TableBox>
      )}
    </Card>
  );
}

/* InjuriesAndNews: the injury report and the latest team news, side by side on wide screens. */
async function InjuriesAndNews({ teamId }: { teamId: string }) {
  const [injuries, news] = await Promise.all([getTeamInjuries("nba", teamId).catch(() => null), getNews("nba", teamId, 6).catch(() => null)]);
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <Card id="nba-injuries" title="Injury report">
        {injuries === null ? <Unavailable what="Injuries" /> : <InjuryList injuries={injuries} league="nba" />}
      </Card>
      <Card id="nba-news" title="Team news">
        {news === null ? <Unavailable what="News stories" /> : <NewsList articles={news} />}
      </Card>
    </div>
  );
}

/* NbaTeamView: the top shows right away; the rest streams in as each part is ready. */
export default function NbaTeamView({ overview }: { overview: NbaTeamOverview }) {
  const teamId = overview.team.id;
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <NbaTeamHeader overview={overview} />
      <Suspense fallback={<SectionSkeleton title="Last 5 games" />}>
        <RecentResults teamId={teamId} />
      </Suspense>
      {/* Under the last 5 games, closed until tapped (same box as the NFL team page). */}
      <Suspense fallback={<SectionSkeleton title="Remaining schedule" />}>
        <UpcomingSchedule league="nba" teamId={teamId} />
      </Suspense>
      <Suspense fallback={<SectionSkeleton title="Key players" />}>
        <KeyPlayers teamId={teamId} />
      </Suspense>
      <Suspense fallback={<SectionSkeleton title="Injuries and news" />}>
        <InjuriesAndNews teamId={teamId} />
      </Suspense>
    </div>
  );
}
