/*
  FILE: components/matchup/MatchupHeader.tsx
  WHAT IT'S FOR: The top of the matchup page, as described in PAGES: both team
  logos, the team name under each logo, each team's record under that in
  smaller text, and the date and time centered under both. Logos (and names)
  link to the team page. During a game it shows the score and "Live".
  WHO USES IT: app/(main)/matchup/[gameId]/page.tsx.
  WHY THIS NAME: It's the matchup page's header. It ends in .tsx because it shows something on screen.
*/

import Image from "next/image";
import Link from "next/link";
// The "Sunday · 4:25 PM ET" words, from lib/format/gameTime.ts.
import { gameDayLabel, gameTimeLabel } from "@/lib/format/gameTime";
import type { Game, TeamSummary } from "@/types";

/* TeamBlock: one team's logo, name, and record (or score), linking to its team page. */
function TeamBlock({ team, score }: { team: TeamSummary; score: number | null }) {
  return (
    <Link href={`/team/${team.id}`} className="group flex min-w-0 flex-1 flex-col items-center gap-2 rounded-2xl p-2 text-center">
      {team.logoUrl ? (
        <Image src={team.logoUrl} alt="" width={80} height={80} className="size-16 sm:size-20" priority />
      ) : (
        <span aria-hidden className="size-16 rounded-full bg-card-raised sm:size-20" />
      )}
      <span className="font-display text-lg leading-tight text-text group-hover:text-gold sm:text-xl">{team.displayName}</span>
      <span className="text-xs tabular-nums text-muted">{team.record ?? "Record unavailable"}</span>
      {score !== null && <span className="text-3xl font-semibold tabular-nums text-text">{score}</span>}
    </Link>
  );
}

/* MatchupHeader: away team on the left, home team on the right (like "KC @ SEA"). */
export default function MatchupHeader({ game }: { game: Game }) {
  return (
    <header className="rounded-2xl border border-line bg-card px-2 py-5">
      <h1 className="sr-only">
        {game.awayTeam.displayName} at {game.homeTeam.displayName}
      </h1>
      <div className="flex items-start justify-between gap-2">
        <TeamBlock team={game.awayTeam} score={game.awayScore} />
        <span aria-hidden className="mt-7 font-display text-xl text-muted sm:mt-9">
          @
        </span>
        <TeamBlock team={game.homeTeam} score={game.homeScore} />
      </div>
      {/* suppressHydrationWarning: "Today"/"Tomorrow" depends on the exact moment, which can differ by a second between server and browser. */}
      <p className="mt-3 text-center text-sm text-muted" suppressHydrationWarning>
        {game.status === "in-progress" && <span className="font-semibold text-danger">● Live</span>}
        {game.status === "final" && <span className="font-semibold text-text">Final</span>}
        {game.status === "postponed" && <span className="font-semibold text-danger">Postponed</span>}
        {game.status === "canceled" && <span className="font-semibold text-danger">Canceled</span>}
        {game.status === "scheduled" && `${gameDayLabel(game.startsAt)} · ${gameTimeLabel(game.startsAt)}`}
        {game.venue && <span className="block text-xs">{game.venue}</span>}
      </p>
    </header>
  );
}
