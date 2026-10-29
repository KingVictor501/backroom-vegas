/*
  FILE: components/matchup/GameStats.tsx
  WHAT IT'S FOR: The "Live stats" (game is on) or "Final stats" (game is over) collapsible section of the matchup page, for
  both football and basketball: the two teams' numbers side by side, then each team's player tables.
  It has all four states: loading (the skeleton the page shows while it loads), error ("stats aren't available
  right now"), empty (a game with no numbers yet), and data. A game that hasn't started shows nothing here.
  While the game is on, AutoRefresh reloads it about every 30 seconds.
  WHO USES IT: app/(main)/matchup/[gameId]/page.tsx.
  WHY THIS NAME: It shows a game's stats. It ends in .tsx because it shows something on screen.
*/

import Link from "next/link";
import AutoRefresh from "@/components/matchup/AutoRefresh";
import { TableBox, td, th } from "@/components/stats/StatTable";
import { playerHref } from "@/lib/leagues/links";
import { getGameStats } from "@/lib/services/espn/gameStats";
import type { Game } from "@/types";
// logServerError (lib/logging/safeLog.ts): logs a short cleaned-up line, never connection strings or whole error objects.
import { logServerError } from "@/lib/logging/safeLog";

/*
  StatsShell: the box and heading around the section. It is a collapsible box (the browser's built-in <details>),
  closed at first; tap the heading to open or close it. It works with a keyboard (Tab, then Enter or Space) and
  with JavaScript off. The 30-second refresh keeps whatever you chose.
*/
function StatsShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="group rounded-2xl border border-line bg-card">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <h2 className="font-display text-lg text-text">{title}</h2>
        <svg aria-hidden viewBox="0 0 20 20" className="size-4 shrink-0 text-muted transition-transform group-open:rotate-180" fill="currentColor">
          <path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4Z" />
        </svg>
      </summary>
      <div className="space-y-5 px-4 pb-4">{children}</div>
    </details>
  );
}

/* GameStatsSkeleton: gray bars shown while the stats load. */
export function GameStatsSkeleton() {
  return (
    <section aria-busy="true" className="rounded-2xl border border-line bg-card p-4">
      <h2 className="font-display text-lg text-text">Game stats</h2>
      <p className="sr-only" role="status">
        Loading game stats…
      </p>
      <div className="mt-3 space-y-2">
        {[0, 1, 2].map((row) => (
          <div key={row} className="h-8 animate-pulse rounded-lg bg-card-raised" />
        ))}
      </div>
    </section>
  );
}

/* GameStats: runs on the server. */
export default async function GameStats({ game }: { game: Game }) {
  const stats = await getGameStats(game.league, game.id).catch((error: unknown) => {
    logServerError("Game stats unavailable:", error);
    return null;
  });

  if (stats === null) {
    // A game that hasn't started has nothing to show, so no complaint.
    if (game.status === "scheduled") return null;
    return (
      <StatsShell title="Game stats">
        <p role="status" className="text-sm text-danger">
          Game stats aren&apos;t available right now. Please try again in a few minutes.
        </p>
      </StatsShell>
    );
  }

  // The refresher is included for every state; it does nothing unless the game is on.
  const refresher = <AutoRefresh gameId={game.id} league={game.league} startsAt={stats.startsAt} status={stats.status} />;
  if (stats.status === "scheduled") return refresher;
  if (stats.status !== "in-progress" && stats.status !== "final") return null;

  const [away, home] = stats.teams;
  const teams = [
    { team: game.awayTeam, data: away },
    { team: game.homeTeam, data: home },
  ];
  const title = stats.status === "final" ? "Final stats" : "Live stats";
  const hasNumbers = away.stats.length > 0 || home.stats.length > 0 || away.tables.length > 0 || home.tables.length > 0;

  return (
    <StatsShell title={title}>
      {refresher}
      {!hasNumbers ? (
        <p className="text-sm text-muted">No stats have been recorded for this game yet.</p>
      ) : (
        <>
          {away.stats.length > 0 && (
            <table className="w-full text-sm tabular-nums">
              <caption className="sr-only">Team stats</caption>
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className="py-2 text-left text-xs font-medium uppercase tracking-wide text-gold">{game.awayTeam.abbreviation}</th>
                  <th scope="col" className="py-2 text-center text-xs font-medium uppercase tracking-wide text-muted">Team stats</th>
                  <th scope="col" className="py-2 text-right text-xs font-medium uppercase tracking-wide text-gold">{game.homeTeam.abbreviation}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {away.stats.map((stat) => (
                  <tr key={stat.label}>
                    <td className="py-2 text-left font-semibold text-text">{stat.value}</td>
                    <td className="py-2 text-center text-muted">{stat.label}</td>
                    <td className="py-2 text-right font-semibold text-text">{home.stats.find((s) => s.label === stat.label)?.value ?? "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {teams.flatMap(({ team, data }) =>
            data.tables.map((table) => (
              <div key={`${team.id}-${table.title}`}>
                <h3 className="font-sans text-sm font-semibold text-text">
                  {team.abbreviation} · {table.title}
                </h3>
                <div className="mt-2">
                  <TableBox label={`${team.displayName} ${table.title.toLowerCase()}`} bleed="-mx-4 px-4">
                    <thead>
                      <tr className="border-b border-line">
                        <th scope="col" className={th}>Player</th>
                        {table.columns.map((column) => (
                          <th key={column} scope="col" className={th}>{column}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {table.rows.map((row) => {
                        const href = playerHref(game.league, row.playerId);
                        return (
                          <tr key={row.playerId}>
                            <td className={td}>
                              {href ? (
                                <Link href={href} className="font-medium hover:text-gold">{row.name}</Link>
                              ) : (
                                <span className="font-medium">{row.name}</span>
                              )}
                            </td>
                            {row.values.map((value, index) => (
                              <td key={`${row.playerId}-${index}`} className={td}>{value}</td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </TableBox>
                </div>
              </div>
            )),
          )}
        </>
      )}
    </StatsShell>
  );
}
