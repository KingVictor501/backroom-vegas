/*
  FILE: components/feed/GameCard.tsx
  WHAT IT'S FOR: One game card on the Feed and league page, like a real
  sportsbook. Tapping anywhere on the card opens the matchup page, EXCEPT the
  parts with their own job: team names open the team page, odds buttons add to
  your slip, and SGP starts Build your own SGP. The card shows: the day and time (or the live score and quarter, or "Final"), both teams with
  their logos and records, and a three-column odds table (Spread, Total,
  Winner) where each price is a tappable odds button. A missing price shows a
  dash instead of crashing (the table is components/feed/GameLinesTable.tsx).
  The small "SGP" link starts Build your own SGP.
  When a bet type like Passing is chosen, the card adds a "See Passing props"
  link to the game's page (props aren't loaded on the Feed, to save Odds API requests).
  WHO USES IT: components/feed/GameBrowser.tsx.
  WHY THIS NAME: It's a card for one game. It ends in .tsx because it shows something on screen.
*/

import Image from "next/image";
import Link from "next/link";
// The SGP link from Section 8 (components/betslip).
import StartSgpButton from "@/components/betslip/StartSgpButton";
// gameLabel from lib/betting/gameLinePicks.ts: "KC @ SEA".
import { gameLabel } from "@/lib/betting/gameLinePicks";
// The "Today · 4:25 PM ET" words, from lib/format/gameTime.ts.
import { gameDayLabel, gameTimeLabel } from "@/lib/format/gameTime";
// The live status line ("● Q3 7:32  KC 24 – SEA 20") and how to decide what to show.
import LiveScoreLine from "@/components/live/LiveScoreLine";
import { liveView } from "@/components/live/liveView";
// The shared types for a game with odds and a sportsbook.
import type { GameWithLines, LiveGame, SportsbookId, TeamSummary } from "@/types";
// The Spread / Total / Winner table, from the file next to this one.
import GameLinesTable from "./GameLinesTable";

/*
  ScoreTeamRow: one team on a scores-only card (a league with no betting features yet): logo, name,
  record, and the score once the game has started. No links, because the team and matchup pages only
  know football so far.
*/
function ScoreTeamRow({ team, score }: { team: TeamSummary; score: number | null }) {
  return (
    <li className="flex items-center gap-3">
      {team.logoUrl ? (
        <Image src={team.logoUrl} alt="" width={40} height={40} className="size-10 shrink-0" />
      ) : (
        <span aria-hidden className="size-10 shrink-0 rounded-full bg-card-raised" />
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-text">{team.displayName}</span>
        <span className="block text-xs tabular-nums text-muted">{team.record ?? ""}</span>
      </span>
      {score !== null && <span className="text-2xl font-semibold tabular-nums text-text">{score}</span>}
    </li>
  );
}

/*
  PropsLink: when a bet type other than Game Lines is picked, which one.
  label is the button's words ("Passing"), slug is the address part ("passing").
*/
export type PropsLink = { label: string; slug: string };

/*
  GameCard
  - game: the game and its odds (lines is null if the book has no odds yet → all dashes)
  - sportsbook: which book the odds came from (saved on each pick)
  - propsLink: set when a bet type like Passing is chosen
*/
export default function GameCard({
  game,
  sportsbook,
  propsLink,
  live,
  scoresOnly = false,
}: {
  game: GameWithLines;
  sportsbook: SportsbookId;
  propsLink: PropsLink | null;
  /** The latest live information for this game, if the browser has fetched any. */
  live?: LiveGame;
  /** true for a league with schedules and live scores only (no betting pages yet): no links, no odds. */
  scoresOnly?: boolean;
}) {
  const label = gameLabel(game);
  const status = liveView(game, live).status;
  const headingId = `game-${game.id}`;

  if (scoresOnly) {
    const view = liveView(game, live);
    return (
      <article aria-labelledby={headingId} className="rounded-2xl border border-line bg-card p-4">
        <h3 id={headingId} className="font-sans text-xs font-medium text-gold" suppressHydrationWarning>
          <span className="sr-only">{game.awayTeam.displayName} at {game.homeTeam.displayName}, </span>
          {status === "scheduled" ? `${gameDayLabel(game.startsAt)} · ${gameTimeLabel(game.startsAt)}` : <LiveScoreLine game={game} live={live} />}
        </h3>
        <ul className="mt-3 space-y-3">
          <ScoreTeamRow team={game.awayTeam} score={view.awayScore} />
          <ScoreTeamRow team={game.homeTeam} score={view.homeScore} />
        </ul>
      </article>
    );
  }

  return (
    // relative: the matchup link below stretches over this whole card.
    <article aria-labelledby={headingId} className="relative rounded-2xl border border-line bg-card p-4 transition-colors hover:border-gold/50">
      <header className="flex items-center justify-between gap-2">
        {/* The day label depends on today's date, which can differ by a second between server and browser, so React is told not to worry about it. */}
        <h3 id={headingId} className="font-sans text-xs font-medium text-gold" suppressHydrationWarning>
          {/*
            The day and time is the card's link to the matchup page. Its invisible
            "after:" layer stretches over the WHOLE card (after:absolute after:inset-0),
            so tapping anywhere on the card opens the matchup. It's one link, so screen
            readers hear it once: "New England Patriots at Chicago Bears, Sunday 9:30 AM ET".
          */}
          <Link href={`/matchup/${game.id}`} className="after:absolute after:inset-0 after:rounded-2xl hover:underline">
            <span className="sr-only">{game.awayTeam.displayName} at {game.homeTeam.displayName}, </span>
            {status === "scheduled" ? `${gameDayLabel(game.startsAt)} · ${gameTimeLabel(game.startsAt)}` : <LiveScoreLine game={game} live={live} />}
          </Link>
        </h3>
        {/* relative z-10: sits on top of the card's link, so it starts an SGP instead of opening the matchup. */}
        <div className="relative z-10">
          <StartSgpButton gameId={game.id} gameLabel={label} look="link" />
        </div>
      </header>

      {/* The odds table. Team names open the team page; odds buttons add to your slip. */}
      <div className="mt-2">
        <GameLinesTable game={game} sportsbook={sportsbook} />
      </div>

      <footer className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
        {propsLink ? (
          <Link
            href={`/matchup/${game.id}?props=${propsLink.slug}`}
            className="relative z-10 inline-flex min-h-11 items-center rounded-xl border border-gold px-3 font-semibold text-gold hover:bg-gold hover:text-bg"
          >
            See {propsLink.label} props
            <span className="sr-only"> for {label}</span>
          </Link>
        ) : (
          <Link href={`/matchup/${game.id}`} className="relative z-10 inline-flex min-h-11 items-center text-money underline-offset-4 hover:underline">
            More bets ›<span className="sr-only"> for {label}</span>
          </Link>
        )}
        {!game.lines && <p className="text-xs text-muted">No odds from this book yet</p>}
      </footer>
    </article>
  );
}
