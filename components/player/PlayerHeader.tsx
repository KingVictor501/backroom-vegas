/*
  FILE: components/player/PlayerHeader.tsx
  WHAT IT'S FOR: The top of the player page: photo, name, jersey number,
  position, team (linking to the team page), and injury status. Then the
  season stats, which depend on the position: QBs get passing, RBs rushing,
  WRs and TEs receiving.
  WHO USES IT: app/(main)/player/[playerId]/page.tsx.
  WHY THIS NAME: It's the player page's header. It ends in .tsx because it shows something on screen.
*/

import Image from "next/image";
import Link from "next/link";
// num() from the shared stat table pieces: numbers with commas, or a dash.
import { num } from "@/components/stats/StatTable";
import type { Player, PlayerStats } from "@/types";

/*
  SEASON_STATS: which season totals each kind of player shows.
  Kickers and defenders ("OTHER") aren't tracked here, so they get a short note instead.
*/
const SEASON_STATS: Record<Exclude<Player["positionGroup"], "OTHER">, [string, keyof PlayerStats][]> = {
  QB: [
    ["Completions", "passCompletions"],
    ["Attempts", "passAttempts"],
    ["Passing yards", "passYards"],
    ["Passing TDs", "passTouchdowns"],
    ["Interceptions", "interceptions"],
    ["Rushing yards", "rushYards"],
  ],
  RB: [
    ["Carries", "rushAttempts"],
    ["Rushing yards", "rushYards"],
    ["Rushing TDs", "rushTouchdowns"],
    ["Receptions", "receptions"],
    ["Receiving yards", "receivingYards"],
    ["Receiving TDs", "receivingTouchdowns"],
  ],
  "WR-TE": [
    ["Receptions", "receptions"],
    ["Targets", "targets"],
    ["Receiving yards", "receivingYards"],
    ["Receiving TDs", "receivingTouchdowns"],
  ],
};

/* PlayerHeader */
export default function PlayerHeader({ player, seasonStats }: { player: Player; seasonStats: PlayerStats }) {
  return (
    <>
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
          <p className="mt-1 text-sm text-text">
            {[player.jersey && `#${player.jersey}`, player.position].filter(Boolean).join(" · ")}
          </p>
          {player.team ? (
            <Link href={`/team/${player.team.id}`} className="mt-1 flex items-center gap-2 text-sm text-muted hover:text-gold">
              {player.team.logoUrl && <Image src={player.team.logoUrl} alt="" width={20} height={20} className="size-5" />}
              {player.team.displayName}
            </Link>
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

      <section aria-labelledby="season-stats" className="rounded-2xl border border-line bg-card p-5">
        <h2 id="season-stats" className="text-xl text-text">
          Season stats
        </h2>
        {player.positionGroup === "OTHER" ? (
          <p className="mt-3 text-sm text-muted">Season stats are shown for quarterbacks, running backs, wide receivers, and tight ends.</p>
        ) : (
          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {SEASON_STATS[player.positionGroup].map(([label, key]) => (
              <div key={key} className="rounded-xl bg-card-raised p-3">
                <dt className="text-xs text-muted">{label}</dt>
                <dd className="mt-1 text-xl font-semibold tabular-nums text-text">{num(seasonStats[key])}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>
    </>
  );
}
