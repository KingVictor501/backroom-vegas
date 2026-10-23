/*
  FILE: components/feed/GameCard.tsx
  WHAT IT'S FOR: One game card on the Feed and league page, like a real
  sportsbook: the day and time (or "Live" with the score), both teams with
  their logos and records, and a three-column odds table (Spread, Total,
  Winner) where each price is a tappable odds button. A missing price shows a
  dash instead of crashing. The small "SGP" link starts Build your own SGP.
  When a bet type like Passing is chosen, the card adds a "See Passing props"
  link to the game's page (props aren't loaded on the Feed, to save Odds API requests).
  WHO USES IT: components/feed/GameBrowser.tsx.
  WHY THIS NAME: It's a card for one game. It ends in .tsx because it shows something on screen.
*/

import Image from "next/image";
import Link from "next/link";
// The odds button and SGP link from Section 8 (components/betslip).
import OddsButton from "@/components/betslip/OddsButton";
import StartSgpButton from "@/components/betslip/StartSgpButton";
// gameLinePick from lib/betting/gameLinePicks.ts turns a price into a full bet slip pick.
import { gameLabel, gameLinePick, type GameLineKind } from "@/lib/betting/gameLinePicks";
// formatLine from lib/betting/picks.ts: "-3", "+3", or "PK".
import { formatLine } from "@/lib/betting/picks";
// The "Today · 4:25 PM ET" words, from lib/format/gameTime.ts.
import { gameDayLabel, gameTimeLabel } from "@/lib/format/gameTime";
// The shared types for a game with odds, one price, a team, and a sportsbook.
import type { GameWithLines, MarketOutcome, SportsbookId, TeamSummary } from "@/types";

/*
  PropsLink: when a bet type other than Game Lines is picked, which one.
  label is the button's words ("Passing"), slug is the address part ("passing").
*/
export type PropsLink = { label: string; slug: string };

/*
  OddsCell: one price in the table. A real price becomes an odds button.
  No price (null, missing on purpose) becomes a dash, with "No odds" for screen readers.
*/
function OddsCell({
  game,
  kind,
  outcome,
  sportsbook,
}: {
  game: GameWithLines;
  kind: GameLineKind;
  outcome: MarketOutcome | null;
  sportsbook: SportsbookId;
}) {
  if (!outcome) {
    return (
      <div className="flex min-h-12 items-center justify-center rounded-xl border border-line/60 text-muted">
        <span aria-hidden>–</span>
        <span className="sr-only">No odds</span>
      </div>
    );
  }
  let lineText: string | undefined;
  if (kind === "spread" && outcome.line !== null) lineText = formatLine(outcome.line);
  if (kind === "total" && outcome.line !== null) lineText = `${outcome.side === "over" ? "O" : "U"} ${outcome.line}`;
  return <OddsButton pick={gameLinePick(game, kind, outcome, sportsbook)} lineText={lineText} />;
}

/*
  TeamCell: a team's logo, nickname, and record (or score once the game starts).
  The name links to the matchup page.
*/
function TeamCell({ game, team, score }: { game: GameWithLines; team: TeamSummary; score: number | null }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      {team.logoUrl ? (
        <Image src={team.logoUrl} alt="" width={28} height={28} className="size-7 shrink-0" />
      ) : (
        <span aria-hidden className="size-7 shrink-0 rounded-full bg-card-raised" />
      )}
      <div className="min-w-0">
        <Link href={`/matchup/${game.id}`} className="block truncate text-sm font-semibold text-text hover:text-gold">
          {team.name}
        </Link>
        <p className="text-xs tabular-nums text-muted">{score !== null ? `Score ${score}` : (team.record ?? "")}</p>
      </div>
    </div>
  );
}

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
  const lines = game.lines;
  const label = gameLabel(game);
  const headingId = `game-${game.id}`;

  return (
    <article aria-labelledby={headingId} className="rounded-2xl border border-line bg-card p-4">
      <header className="flex items-center justify-between gap-2">
        {/* The day label depends on today's date, which can differ by a second between server and browser, so React is told not to worry about it. */}
        <h3 id={headingId} className="font-sans text-xs font-medium text-muted" suppressHydrationWarning>
          <span className="sr-only">{game.awayTeam.displayName} at {game.homeTeam.displayName}, </span>
          {game.status === "in-progress" && <span className="font-semibold text-danger">● Live</span>}
          {game.status === "postponed" && <span className="font-semibold text-danger">Postponed</span>}
          {game.status === "scheduled" && `${gameDayLabel(game.startsAt)} · ${gameTimeLabel(game.startsAt)}`}
        </h3>
        <StartSgpButton gameId={game.id} gameLabel={label} look="link" />
      </header>

      {/* The odds table: a column for the teams, then Spread, Total, Winner. */}
      <div className="mt-2 grid grid-cols-[minmax(0,1fr)_repeat(3,3.75rem)] items-center gap-x-1.5 gap-y-2 sm:grid-cols-[minmax(0,1fr)_repeat(3,4.5rem)]">
        <span aria-hidden />
        {["Spread", "Total", "Winner"].map((heading) => (
          <span key={heading} aria-hidden className="text-center text-[11px] font-medium uppercase tracking-wide text-muted">
            {heading}
          </span>
        ))}

        <TeamCell game={game} team={game.awayTeam} score={game.awayScore} />
        <OddsCell game={game} kind="spread" outcome={lines?.spread.away ?? null} sportsbook={sportsbook} />
        <OddsCell game={game} kind="total" outcome={lines?.total.over ?? null} sportsbook={sportsbook} />
        <OddsCell game={game} kind="moneyline" outcome={lines?.moneyline.away ?? null} sportsbook={sportsbook} />

        <TeamCell game={game} team={game.homeTeam} score={game.homeScore} />
        <OddsCell game={game} kind="spread" outcome={lines?.spread.home ?? null} sportsbook={sportsbook} />
        <OddsCell game={game} kind="total" outcome={lines?.total.under ?? null} sportsbook={sportsbook} />
        <OddsCell game={game} kind="moneyline" outcome={lines?.moneyline.home ?? null} sportsbook={sportsbook} />
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
          <Link href={`/matchup/${game.id}`} className="inline-flex min-h-11 items-center text-muted hover:text-gold">
            More bets ›<span className="sr-only"> for {label}</span>
          </Link>
        )}
        {!lines && <p className="text-xs text-muted">No odds from this book yet</p>}
      </footer>
    </article>
  );
}
