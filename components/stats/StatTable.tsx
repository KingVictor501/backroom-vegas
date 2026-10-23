/*
  FILE: components/stats/StatTable.tsx
  WHAT IT'S FOR: The shared pieces for stat tables:
  - TableBox: lets a wide table scroll sideways INSIDE its card on phones, so
    the page itself never gets wider than the screen
  - num(): a number for a table cell (or a dash if it's missing)
  - th / td: the header and body cell looks
  - PlayerGamesTable: a player's game-by-game stats with average rows at the
    bottom. QBs get passing columns, RBs rushing, WRs and TEs receiving.
  WHO USES IT: components/team/TeamSections.tsx (key players' last 5 games)
  and the player page (last 10 games with last-5 and last-10 averages).
  WHY THIS NAME: Shared stat table parts. It ends in .tsx because it shows something on screen.
*/

import Link from "next/link";
import type { ReactNode } from "react";
// shortDate ("Oct 18") from lib/format/gameTime.ts.
import { shortDate } from "@/lib/format/gameTime";
import type { PlayerGameLog, PlayerStats, PositionGroup } from "@/types";

/* num: a stat for a table cell, with up to 1 decimal, or a dash if it's missing. */
export function num(value: number | null | undefined): string {
  return value === null || value === undefined ? "–" : value.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

/* Header cells and body cells share these looks. */
export const th = "whitespace-nowrap px-2 py-2 text-xs font-medium uppercase tracking-wide text-muted first:pl-0";
export const td = "whitespace-nowrap px-2 py-2.5 text-text first:pl-0";

/*
  TableBox: a sideways-scrolling box for a wide table. (scroll-row is in app/globals.css.)
  - label: what screen readers call the box, like "Last 10 games"
  - bleed: how far the box stretches into its card's padding, so the table can use the full card width
*/
export function TableBox({ label, bleed = "-mx-5 px-5", children }: { label: string; bleed?: string; children: ReactNode }) {
  return (
    // tabIndex: lets keyboard users focus the box and scroll it with the arrow keys.
    <div className={`scroll-row ${bleed}`} role="region" aria-label={label} tabIndex={0}>
      <table className="w-full min-w-max text-left text-sm tabular-nums">{children}</table>
    </div>
  );
}

/* StatRole: the three kinds of players with game stat tables. */
export type StatRole = Exclude<PositionGroup, "OTHER">;

/*
  ROLE_COLUMNS: which stats each kind of player shows, as [heading, how to show it].
*/
export const ROLE_COLUMNS: Record<StatRole, [string, (s: PlayerStats) => string][]> = {
  QB: [
    ["C/Att", (s) => `${num(s.passCompletions)}/${num(s.passAttempts)}`],
    ["Pass yds", (s) => num(s.passYards)],
    ["TD", (s) => num(s.passTouchdowns)],
    ["INT", (s) => num(s.interceptions)],
    ["Rush yds", (s) => num(s.rushYards)],
  ],
  RB: [
    ["Car", (s) => num(s.rushAttempts)],
    ["Rush yds", (s) => num(s.rushYards)],
    ["TD", (s) => num(s.rushTouchdowns)],
    ["Rec", (s) => num(s.receptions)],
    ["Rec yds", (s) => num(s.receivingYards)],
  ],
  "WR-TE": [
    ["Rec", (s) => num(s.receptions)],
    ["Tgt", (s) => num(s.targets)],
    ["Rec yds", (s) => num(s.receivingYards)],
    ["TD", (s) => num(s.receivingTouchdowns)],
  ],
};

/*
  PlayerGamesTable
  - role: which columns to show
  - games: newest first
  - averages: the gold rows at the bottom, like [{ label: "Last 5 avg", stats }]
  - label: what screen readers call the table
  - showResult: adds a W/L column (the player page has room for it)
*/
export function PlayerGamesTable({
  role,
  games,
  averages,
  label,
  showResult = false,
  bleed,
}: {
  role: StatRole;
  games: PlayerGameLog[];
  averages: { label: string; stats: PlayerStats }[];
  label: string;
  showResult?: boolean;
  bleed?: string;
}) {
  const columns = ROLE_COLUMNS[role];
  return (
    <TableBox label={label} bleed={bleed}>
      <thead>
        <tr className="border-b border-line">
          <th scope="col" className={th}>Game</th>
          {showResult && <th scope="col" className={th}>Result</th>}
          {columns.map(([heading]) => (
            <th key={heading} scope="col" className={th}>{heading}</th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {games.map((game) => (
          <tr key={game.gameId}>
            <td className={`${td} text-muted`}>
              <Link href={`/matchup/${game.gameId}`} className="hover:text-gold">
                {shortDate(game.playedAt)} {game.isHome ? "vs" : "@"} {game.opponentAbbreviation}
              </Link>
            </td>
            {showResult && (
              <td className={`${td} font-semibold ${game.result === "W" ? "text-gold" : game.result === "L" ? "text-danger" : "text-text"}`}>
                {game.result ?? "–"}
              </td>
            )}
            {columns.map(([heading, value]) => (
              <td key={heading} className={td}>{value(game.stats)}</td>
            ))}
          </tr>
        ))}
      </tbody>
      <tfoot>
        {averages.map((average, index) => (
          <tr key={average.label} className={index === 0 ? "border-t-2 border-gold/40" : ""}>
            <th scope="row" className={`${td} font-semibold text-gold`}>
              {average.label}
            </th>
            {showResult && <td className={td} />}
            {columns.map(([heading, value]) => (
              <td key={heading} className={`${td} font-semibold text-gold`}>{value(average.stats)}</td>
            ))}
          </tr>
        ))}
      </tfoot>
    </TableBox>
  );
}
