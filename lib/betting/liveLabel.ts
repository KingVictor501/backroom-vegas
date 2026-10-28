/*
  FILE: lib/betting/liveLabel.ts
  WHAT IT'S FOR: Turns ESPN's game status into the short words shown on screen:
  "Q3 7:32", "Halftime", "End of Q1", "OT 4:10", "Final", "Final/OT", "Scheduled".
  It uses the league's period words from config/leagues.ts (Q for quarters, P for periods, and
  so on), so the same code works for basketball and hockey later. When ESPN's words are
  missing or odd, it falls back to ESPN's own short text instead of guessing.
  WHO USES IT: lib/services/espn/live.ts.
  WHY THIS NAME: It makes the live label. It lives in lib/betting with the other game/pick logic.
  It ends in .ts because it shows nothing on screen, and it has no secrets, so the browser could use it too.
*/

import type { GameStatus } from "@/types";

/*
  LabelInput: what the label is built from.
  - typeName: ESPN's status name, like "STATUS_IN_PROGRESS" or "STATUS_HALFTIME"
  - shortDetail: ESPN's own short text, like "7:32 - 3rd" or "Final/OT" (null if missing: missing on purpose)
  - periods: the league's period words (see config/leagues.ts), or null for leagues without timed periods
*/
export type LabelInput = {
  status: GameStatus;
  typeName: string;
  shortDetail: string | null;
  period: number | null;
  clock: string | null;
  periods: { short: string; regulation: number } | null;
};

/*
  periodWord: "Q3" for the third quarter, "OT" for the first overtime, "2OT" for the second.
*/
function periodWord(period: number, periods: { short: string; regulation: number }): string {
  if (period <= periods.regulation) return `${periods.short}${period}`;
  const overtime = period - periods.regulation;
  return overtime === 1 ? "OT" : `${overtime}OT`;
}

/* liveGameLabel: the words to show for a game right now. */
export function liveGameLabel(input: LabelInput): string {
  switch (input.status) {
    case "scheduled":
      return "Scheduled";
    case "postponed":
      return "Postponed";
    case "canceled":
      return "Canceled";
    case "final":
      // ESPN writes "Final/OT" for an overtime game. Keep that, but never show odd text for a plain final.
      return input.shortDetail?.startsWith("Final") ? input.shortDetail : "Final";
    case "in-progress":
      break;
  }

  const type = input.typeName.toUpperCase();
  if (type.includes("HALFTIME")) return "Halftime";
  if (type.includes("DELAY")) return "Delayed";
  if (input.period === null || input.periods === null) return input.shortDetail ?? "Live";

  const word = periodWord(input.period, input.periods);
  if (type.includes("END_PERIOD")) return `End of ${word}`;
  return input.clock ? `${word} ${input.clock}` : word;
}
