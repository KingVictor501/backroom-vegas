/*
  FILE: lib/betting/picks.ts
  WHAT IT'S FOR: Small helpers for picks and prices:
  - makePickId(): the ID that tells two picks apart
  - formatOdds(): shows odds the American way, like -110 or +150
  - formatLine(): shows a spread line, like -3, +3, or PK
  - pickCount(): "1 pick" or "3 picks"
  - SLIP_TYPE_LABELS: the words shown for each slip type
  WHO USES IT: components/betslip (odds buttons, slip bar, slip panel). Later:
  the Feed, matchup, and player pages (Sections 9 to 11B) when they turn odds into picks.
  WHY THIS NAME: It's about picks, next to the other betting code. It ends in
  .ts because it shows nothing on screen. It's safe to use in the browser.
*/

// The shared pick type, from the types folder.
import type { AmericanOdds, BetSlipType, NewBetPick } from "@/types";

/*
  makePickId: one ID per exact pick, built from the game, market (which already
  includes the part of the game, like "_h1"), who it's about, the side, and the line.
  Example: "401873022|spreads|12|away|-3".
  Tapping the same odds button always makes the same ID, which is how the slip
  knows to REMOVE the pick instead of adding it twice.
*/
export function makePickId(
  pick: Pick<NewBetPick, "gameId" | "marketKey" | "participant" | "side" | "line">,
): string {
  const who = pick.participant.id ?? pick.participant.name.toLowerCase();
  return [pick.gameId, pick.marketKey, who, pick.side, pick.line ?? ""].join("|");
}

/*
  formatOdds: American odds as text. Positive odds get a plus sign: 150 → "+150",
  -110 → "-110". null (no price yet, missing on purpose) shows a dash.
*/
export function formatOdds(odds: AmericanOdds | null): string {
  if (odds === null) return "–";
  return odds > 0 ? `+${odds}` : String(odds);
}

/*
  formatLine: a spread line as text. +3 → "+3", -3.5 → "-3.5", 0 → "PK"
  ("pick'em", the sportsbook word for no points given either way).
*/
export function formatLine(line: number): string {
  if (line === 0) return "PK";
  return line > 0 ? `+${line}` : String(line);
}

/* SLIP_TYPE_LABELS: how each slip type is written on screen. */
export const SLIP_TYPE_LABELS: Record<BetSlipType, string> = {
  straight: "Straight",
  parlay: "Parlay",
  sgp: "SGP",
};

/* pickCount: "1 pick" or "3 picks". */
export function pickCount(count: number): string {
  return `${count} ${count === 1 ? "pick" : "picks"}`;
}
