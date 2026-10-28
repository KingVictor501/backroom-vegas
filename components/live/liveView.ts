/*
  FILE: components/live/liveView.ts
  WHAT IT'S FOR: Decides what to SHOW for a game: the freshest live information if the browser has
  fetched some, otherwise the score the server loaded with the page. Putting this in one place means
  the game card, the matchup page, and the slip page always agree.
  WHO USES IT: components/live/LiveScoreLine.tsx, components/matchup/MatchupHeader.tsx,
  components/betslips/SlipDetail.tsx.
  WHY THIS NAME: It's the "view" (what's shown) of a game's live state. It ends in .ts because it draws nothing.
*/

import type { Game, GameStatus, LiveGame } from "@/types";

/* LiveView: what to show. Scores are null before a game starts (missing on purpose). */
export type LiveView = {
  status: GameStatus;
  label: string;
  awayScore: number | null;
  homeScore: number | null;
};

/* WORDS: the label to show when only the server's older copy is available. */
const FALLBACK_LABEL: Record<GameStatus, string> = {
  scheduled: "Scheduled",
  "in-progress": "Live",
  final: "Final",
  postponed: "Postponed",
  canceled: "Canceled",
};

/* liveView: the fresh live information wins; otherwise fall back to the server's copy of the game. */
export function liveView(game: Pick<Game, "status" | "awayScore" | "homeScore">, live: LiveGame | undefined): LiveView {
  if (live) return { status: live.status, label: live.label, awayScore: live.awayScore, homeScore: live.homeScore };
  return { status: game.status, label: FALLBACK_LABEL[game.status], awayScore: game.awayScore, homeScore: game.homeScore };
}
