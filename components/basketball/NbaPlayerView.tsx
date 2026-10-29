/*
  FILE: components/basketball/NbaPlayerView.tsx
  WHAT IT'S FOR: The whole NBA player page: photo, number, position, team, and injury status; this season's
  per-game averages; the last 10 games with a "last 5 average" row; the latest news; and a link to the team's
  next game. (There are no NBA player props yet, so there is no props section; the matchup link shows the game's odds.)
  Football's version is components/player/PlayerHeader.tsx + the football game table. Basketball is separate
  because the numbers are different.
  WHO USES IT: app/(main)/player/[playerId]/page.tsx, when the address says ?league=nba.
  WHY THIS NAME: "Nba" + "Player" + "View". It ends in .tsx because it shows something on screen.
*/

import Image from "next/image";
import Link from "next/link";
import NewsList from "@/components/NewsList";
import { num, TableBox, td, th } from "@/components/stats/StatTable";
import { shortDate } from "@/lib/format/gameTime";
import { matchupHref, teamHref } from "@/lib/leagues/links";
import type { NbaPlayerAverages, NbaPlayerDetails } from "@/types";

/* pct: a shooting percentage like "40.0%", or a dash. */
function pct(value: number | null): string {
  return value === null ? "–" : `${value.toLocaleString("en-US", { maximumFractionDigits: 1 })}%`;
}

/* AverageCells: the same columns as the game table, for an average row. */
function AverageCells({ averages }: { averages: NbaPlayerAverages }) {
  return (
    <>
      <td className={td}>{num(averages.minutes)}</td>
      <td className={td}>{num(averages.points)}</td>
      <td className={td}>{num(averages.rebounds)}</td>
      <td className={td}>{num(averages.assists)}</td>
      <td className={td}>{num(averages.steals)}</td>
      <td className={td}>{num(averages.blocks)}</td>
      <td className={td}>{num(averages.turnovers)}</td>
      <td className={td}>{pct(averages.fieldGoalPct)}</td>
      <td className={td}>{pct(averages.threePointPct)}</td>
    </>
  );
}

/* NbaPlayerView */
export default function NbaPlayerView({ details }: { details: NbaPlayerDetails }) {
  const { player, seasonAverages, recentGames, last5Average, nextGameId, news } = details;
  const teamLink = player.team ? teamHref("nba", player.team.id) : null;
  const season: { label: string; value: string }[] = [
    { label: "Games", value: num(seasonAverages.games) },
    { label: "Minutes", value: num(seasonAverages.minutes) },
    { label: "Points", value: num(seasonAverages.points) },
    { label: "Rebounds", value: num(seasonAverages.rebounds) },
    { label: "Assists", value: num(seasonAverages.assists) },
    { label: "Steals", value: num(seasonAverages.steals) },
    { label: "Blocks", value: num(seasonAverages.blocks) },
    { label: "FG %", value: pct(seasonAverages.fieldGoalPct) },
    { label: "3P %", value: pct(seasonAverages.threePointPct) },
    { label: "FT %", value: pct(seasonAverages.freeThrowPct) },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header className="flex items-center gap-4 rounded-2xl border border-line bg-card p-5">
        {player.photoUrl ? (
          <Image
            src={player.photoUrl}
            alt={`Photo of ${player.name}`}
            width={112}
            height={112}
            className="size-24 shrink-0 rounded-full bg-card-raised object-cover sm:size-28"
            priority
          />
        ) : (
          <span aria-hidden className="size-24 shrink-0 rounded-full bg-card-raised" />
        )}
        <div className="min-w-0">
          <h1 className="text-3xl leading-tight text-gold">{player.name}</h1>
          <p className="mt-1 text-sm text-text">{[player.jersey && `#${player.jersey}`, player.position].filter(Boolean).join(" · ")}</p>
          {player.team ? (
            teamLink ? (
              <Link href={teamLink} className="mt-1 flex items-center gap-2 text-sm text-muted hover:text-gold">
                {player.team.logoUrl && <Image src={player.team.logoUrl} alt="" width={20} height={20} className="size-5" />}
                {player.team.displayName}
              </Link>
            ) : (
              <p className="mt-1 text-sm text-muted">{player.team.displayName}</p>
            )
          ) : (
            <p className="mt-1 text-sm text-muted">Free agent</p>
          )}
          <p className="mt-2">
            {player.injuryStatus ? (
              <span className="rounded-full border border-danger/50 px-2.5 py-0.5 text-xs font-medium text-danger">{player.injuryStatus}</span>
            ) : (
              <span className="rounded-full border border-line px-2.5 py-0.5 text-xs text-muted">No injury listed</span>
            )}
          </p>
        </div>
      </header>

      <section aria-labelledby="nba-season-averages" className="rounded-2xl border border-line bg-card p-5">
        <h2 id="nba-season-averages" className="text-xl text-text">
          Season averages
        </h2>
        {seasonAverages.games === null ? (
          <p className="mt-4 text-sm text-muted">No games played yet this season.</p>
        ) : (
          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {season.map((cell) => (
              <div key={cell.label} className="min-w-0 rounded-xl bg-card-raised p-3">
                <dt className="text-xs text-muted">{cell.label}</dt>
                <dd className="mt-1 text-xl font-semibold tabular-nums text-text">{cell.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      <section aria-labelledby="nba-last-games" className="rounded-2xl border border-line bg-card p-5">
        <h2 id="nba-last-games" className="text-xl text-text">
          Last {recentGames.length === 1 ? "game" : `${recentGames.length} games`}
        </h2>
        <div className="mt-4">
          {recentGames.length === 0 ? (
            <p className="text-sm text-muted">No games played yet this season.</p>
          ) : (
            <TableBox label={`${player.name}, last ${recentGames.length} games`}>
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className={th}>Date</th>
                  <th scope="col" className={th}>Opp</th>
                  <th scope="col" className={th}>Result</th>
                  <th scope="col" className={th}>MIN</th>
                  <th scope="col" className={th}>PTS</th>
                  <th scope="col" className={th}>REB</th>
                  <th scope="col" className={th}>AST</th>
                  <th scope="col" className={th}>STL</th>
                  <th scope="col" className={th}>BLK</th>
                  <th scope="col" className={th}>TO</th>
                  <th scope="col" className={th}>FG</th>
                  <th scope="col" className={th}>3PT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {recentGames.map((game) => (
                  <tr key={game.gameId}>
                    <td className={`${td} text-muted`}>{shortDate(game.playedAt)}</td>
                    <td className={td}>
                      <span className="text-muted">{game.isHome ? "vs" : "@"}</span> {game.opponentAbbreviation}
                    </td>
                    <td className={td}>
                      <Link href={matchupHref(game.gameId, "nba")} className="hover:text-gold">
                        <span className={`font-semibold ${game.result === "W" ? "text-gold" : game.result === "L" ? "text-danger" : "text-text"}`}>
                          {game.result ?? "–"}
                        </span>{" "}
                        {game.score ?? ""}
                      </Link>
                    </td>
                    <td className={td}>{num(game.minutes)}</td>
                    <td className={td}>{num(game.points)}</td>
                    <td className={td}>{num(game.rebounds)}</td>
                    <td className={td}>{num(game.assists)}</td>
                    <td className={td}>{num(game.steals)}</td>
                    <td className={td}>{num(game.blocks)}</td>
                    <td className={td}>{num(game.turnovers)}</td>
                    <td className={td}>{game.fieldGoals ?? "–"}</td>
                    <td className={td}>{game.threePointers ?? "–"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-line font-semibold">
                  <td className={`${td} text-gold`} colSpan={3}>
                    Last {Math.min(5, recentGames.length)} avg
                  </td>
                  <AverageCells averages={last5Average} />
                </tr>
              </tfoot>
            </TableBox>
          )}
        </div>
      </section>

      <section aria-labelledby="nba-player-news" className="rounded-2xl border border-line bg-card p-5">
        <h2 id="nba-player-news" className="text-xl text-text">
          Latest news
        </h2>
        <div className="mt-2">
          <NewsList articles={news} />
        </div>
      </section>

      <section aria-labelledby="nba-next-game" className="rounded-2xl border border-line bg-card p-5">
        <h2 id="nba-next-game" className="text-xl text-text">
          Next game
        </h2>
        {nextGameId ? (
          <Link
            href={matchupHref(nextGameId, "nba")}
            className="mt-3 inline-flex min-h-11 items-center rounded-xl border border-gold px-4 text-sm font-semibold text-gold hover:bg-gold hover:text-bg"
          >
            See the game and its odds
          </Link>
        ) : (
          <p className="mt-3 text-sm text-muted">No upcoming game is scheduled for {player.name}.</p>
        )}
        <p className="mt-3 text-xs text-muted">NBA player props aren&apos;t available yet.</p>
      </section>
    </div>
  );
}
