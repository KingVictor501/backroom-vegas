/*
  FILE: components/feed/GameLinesTable.tsx
  WHAT IT'S FOR: The three-column odds table: a row for each team, with
  Spread, Total, and Winner odds buttons on the right. A missing price shows a
  dash (with "No odds" for screen readers) instead of crashing. Team names link
  to the team page. On the Feed the whole card is also a link to the matchup, so
  the names and odds buttons sit ON TOP of it ("relative z-10") and keep their own jobs.
  WHO USES IT: components/feed/GameCard.tsx (Feed and league page) and the
  matchup page's Game Lines view (components/matchup).
  WHY THIS NAME: It's the table of game lines. It ends in .tsx because it shows something on screen.
*/

import Image from "next/image";
import Link from "next/link";
// The odds button from Section 8 (components/betslip).
import OddsButton from "@/components/betslip/OddsButton";
// gameLinePick from lib/betting/gameLinePicks.ts turns a price into a full bet slip pick.
import { gameLinePick, type GameLineKind } from "@/lib/betting/gameLinePicks";
// formatLine from lib/betting/picks.ts: "-3", "+3", or "PK".
import { formatLine } from "@/lib/betting/picks";
import type { GameWithLines, MarketOutcome, SportsbookId, TeamSummary } from "@/types";

/*
  OddsCell: one price in the table. A real price becomes an odds button.
  No price (null, missing on purpose) becomes a dash.
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
  return (
    <div className="relative z-10">
      <OddsButton pick={gameLinePick(game, kind, outcome, sportsbook)} lineText={lineText} lineTone="gold" />
    </div>
  );
}

/*
  TeamCell: a team's logo, nickname (linking to the team page), and record (or score once the game starts).
*/
function TeamCell({ team, score }: { team: TeamSummary; score: number | null }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      {team.logoUrl ? (
        <Image src={team.logoUrl} alt="" width={28} height={28} className="size-7 shrink-0" />
      ) : (
        <span aria-hidden className="size-7 shrink-0 rounded-full bg-card-raised" />
      )}
      <div className="min-w-0">
        <Link href={`/team/${team.id}`} className="relative z-10 block truncate text-sm font-semibold text-text hover:text-gold">
          {team.name}
        </Link>
        <p className="text-xs tabular-nums text-gold">{score !== null ? `Score ${score}` : (team.record ?? "")}</p>
      </div>
    </div>
  );
}

/*
  GameLinesTable
  - game: the game and its odds (lines is null if the book has no odds yet → all dashes)
  - sportsbook: which book the odds came from (saved on each pick)
*/
export default function GameLinesTable({
  game,
  sportsbook,
}: {
  game: GameWithLines;
  sportsbook: SportsbookId;
}) {
  const lines = game.lines;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_repeat(3,3.75rem)] items-center gap-x-1.5 gap-y-2 sm:grid-cols-[minmax(0,1fr)_repeat(3,4.5rem)]">
      <span aria-hidden />
      {["Spread", "Total", "Winner"].map((heading) => (
        <span key={heading} aria-hidden className="text-center text-[11px] font-medium uppercase tracking-wide text-gold">
          {heading}
        </span>
      ))}

      <TeamCell team={game.awayTeam} score={game.awayScore} />
      <OddsCell game={game} kind="spread" outcome={lines?.spread.away ?? null} sportsbook={sportsbook} />
      <OddsCell game={game} kind="total" outcome={lines?.total.over ?? null} sportsbook={sportsbook} />
      <OddsCell game={game} kind="moneyline" outcome={lines?.moneyline.away ?? null} sportsbook={sportsbook} />

      <TeamCell team={game.homeTeam} score={game.homeScore} />
      <OddsCell game={game} kind="spread" outcome={lines?.spread.home ?? null} sportsbook={sportsbook} />
      <OddsCell game={game} kind="total" outcome={lines?.total.under ?? null} sportsbook={sportsbook} />
      <OddsCell game={game} kind="moneyline" outcome={lines?.moneyline.home ?? null} sportsbook={sportsbook} />
    </div>
  );
}
