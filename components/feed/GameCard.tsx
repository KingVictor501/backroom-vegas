/*
  FILE: components/feed/GameCard.tsx
  WHAT IT'S FOR: One game card on the Feed and league page, like a real
  sportsbook: the day and time (or "Live" with the score), both teams with
  their logos and records, and a three-column odds table (Spread, Total,
  Winner) where each price is a tappable odds button. A missing price shows a
  dash instead of crashing (the table is components/feed/GameLinesTable.tsx).
  The small "SGP" link starts Build your own SGP.
  When a bet type like Passing is chosen, the card adds a "See Passing props"
  link to the game's page (props aren't loaded on the Feed, to save Odds API requests).
  WHO USES IT: components/feed/GameBrowser.tsx.
  WHY THIS NAME: It's a card for one game. It ends in .tsx because it shows something on screen.
*/

import Link from "next/link";
// The SGP link from Section 8 (components/betslip).
import StartSgpButton from "@/components/betslip/StartSgpButton";
// gameLabel from lib/betting/gameLinePicks.ts: "KC @ SEA".
import { gameLabel } from "@/lib/betting/gameLinePicks";
// The "Today · 4:25 PM ET" words, from lib/format/gameTime.ts.
import { gameDayLabel, gameTimeLabel } from "@/lib/format/gameTime";
// The shared types for a game with odds and a sportsbook.
import type { GameWithLines, SportsbookId } from "@/types";
// The Spread / Total / Winner table, from the file next to this one.
import GameLinesTable from "./GameLinesTable";

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
}: {
  game: GameWithLines;
  sportsbook: SportsbookId;
  propsLink: PropsLink | null;
}) {
  const label = gameLabel(game);
  const headingId = `game-${game.id}`;

  return (
    <article aria-labelledby={headingId} className="rounded-2xl border border-line bg-card p-4">
      <header className="flex items-center justify-between gap-2">
        {/* The day label depends on today's date, which can differ by a second between server and browser, so React is told not to worry about it. */}
        <h3 id={headingId} className="font-sans text-xs font-medium text-gold" suppressHydrationWarning>
          <span className="sr-only">{game.awayTeam.displayName} at {game.homeTeam.displayName}, </span>
          {game.status === "in-progress" && <span className="font-semibold text-danger">● Live</span>}
          {game.status === "postponed" && <span className="font-semibold text-danger">Postponed</span>}
          {game.status === "scheduled" && `${gameDayLabel(game.startsAt)} · ${gameTimeLabel(game.startsAt)}`}
        </h3>
        <StartSgpButton gameId={game.id} gameLabel={label} look="link" />
      </header>

      {/* The odds table. On the Feed, team names open the matchup page. */}
      <div className="mt-2">
        <GameLinesTable game={game} sportsbook={sportsbook} teamHref={() => `/matchup/${game.id}`} />
      </div>

      <footer className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
        {propsLink ? (
          <Link
            href={`/matchup/${game.id}?props=${propsLink.slug}`}
            className="inline-flex min-h-11 items-center rounded-xl border border-gold px-3 font-semibold text-gold hover:bg-gold hover:text-bg"
          >
            See {propsLink.label} props
            <span className="sr-only"> for {label}</span>
          </Link>
        ) : (
          <Link href={`/matchup/${game.id}`} className="inline-flex min-h-11 items-center text-money underline-offset-4 hover:underline">
            More bets ›<span className="sr-only"> for {label}</span>
          </Link>
        )}
        {!game.lines && <p className="text-xs text-muted">No odds from this book yet</p>}
      </footer>
    </article>
  );
}
