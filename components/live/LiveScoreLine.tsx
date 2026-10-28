/*
  FILE: components/live/LiveScoreLine.tsx
  WHAT IT'S FOR: The one-line live status for a game, like "● Q3 7:32  KC 24 – SEA 20" while it is
  on, "Final  KC 24 – SEA 20" when it's over, or "Postponed". Used on game cards and the matchup page.
  It shows nothing for a game that hasn't started (the caller shows the start time instead).
  It uses the freshest live information if there is any, and otherwise the score the server loaded.
  For screen readers it reads out in words ("Live, third quarter...") because the dot and dash are just decoration.
  WHO USES IT: components/feed/GameCard.tsx and components/matchup/MatchupHeader.tsx.
  WHY THIS NAME: It's the line that shows a game's live score. It ends in .tsx because it shows something on screen.
*/

import { liveView } from "./liveView";
import type { Game, LiveGame } from "@/types";

/*
  LiveScoreLine
  - game: the game as the server loaded it
  - live: the latest live information, if the browser has fetched any (undefined if not yet)
*/
export default function LiveScoreLine({ game, live }: { game: Game; live: LiveGame | undefined }) {
  const view = liveView(game, live);
  if (view.status === "scheduled") return null;

  const score =
    view.awayScore !== null && view.homeScore !== null ? (
      <span className="ml-2 font-semibold tabular-nums text-text">
        {game.awayTeam.abbreviation} {view.awayScore} – {game.homeTeam.abbreviation} {view.homeScore}
      </span>
    ) : null;

  switch (view.status) {
    case "in-progress":
      return (
        <>
          <span className="font-semibold text-danger">
            <span aria-hidden>● </span>
            {view.label}
          </span>
          {score}
        </>
      );
    case "final":
      return (
        <>
          <span className="font-semibold text-text">{view.label}</span>
          {score}
        </>
      );
    default:
      // Postponed or canceled.
      return <span className="font-semibold text-danger">{view.label}</span>;
  }
}
