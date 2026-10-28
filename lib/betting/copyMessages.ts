/*
  FILE: lib/betting/copyMessages.ts
  WHAT IT'S FOR: The plain-English sentences shown after a slip is copied, in one place so the
  slip page, the slip list, and the pop-up message all say the same thing:
  - copyAnnouncement(): the short message in the pop-up, like
    'Copied to "Copy of Sunday Parlay". 2 picks were skipped because their games already started or finished.'
  - refreshSummary(): the line of counts, like "2 odds updated · 1 unchanged · 1 with no odds"
  - pickRefreshText(): what to say under one pick, like "Odds changed: was -110, now -115"
  WHO USES IT: components/betslips/SlipDetail.tsx and components/betslips/SlipList.tsx.
  WHY THIS NAME: It holds the wording for copying. It's in lib/betting with the other slip code.
  It ends in .ts because it shows nothing on screen. It has no secrets, so the browser can use it.
*/

import { SPORTSBOOKS } from "@/config/sportsbooks";
import { formatLine, formatOdds, pickCount } from "@/lib/betting/picks";
import type { BetPick, BetSlip, PickRefreshStatus } from "@/types";

/* copyAnnouncement: the pop-up message right after copying. */
export function copyAnnouncement(copy: BetSlip): string {
  const skipped = copy.copiedFrom?.skipped.length ?? 0;
  const base = `Copied to "${copy.name}".`;
  if (skipped === 0) return base;
  return `${base} ${skipped} ${skipped === 1 ? "pick was" : "picks were"} skipped because ${skipped === 1 ? "its game" : "their games"} already started or finished.`;
}

/* WORDS: how each price-check result reads in the summary line. */
const WORDS: Record<PickRefreshStatus, (count: number) => string> = {
  updated: (n) => `${n} ${n === 1 ? "price" : "prices"} updated`,
  unchanged: (n) => `${n} unchanged`,
  "no-odds": (n) => `${n} with no odds from your sportsbook`,
  "not-checked": (n) => `${n} couldn't be checked`,
};

/*
  refreshSummary: counts of each result across the copy's picks, in a fixed order,
  leaving out the zeros. Empty text when no pick has a note.
*/
export function refreshSummary(picks: readonly BetPick[]): string {
  const counts: Record<PickRefreshStatus, number> = { updated: 0, unchanged: 0, "no-odds": 0, "not-checked": 0 };
  for (const pick of picks) if (pick.refresh) counts[pick.refresh.status] += 1;
  return (["updated", "unchanged", "no-odds", "not-checked"] as const)
    .filter((status) => counts[status] > 0)
    .map((status) => WORDS[status](counts[status]))
    .join(" · ");
}

/*
  pickRefreshText: what to say under one pick of a copied slip, or null when there's nothing to say
  (a pick added by hand has no note: null is missing on purpose).
  The line is shown with the bet's own style: spreads as "-3", totals and props as "47.5".
*/
export function pickRefreshText(pick: BetPick): { tone: "changed" | "same" | "warning"; text: string } | null {
  const refresh = pick.refresh;
  if (!refresh) return null;
  const line = (value: number) => (pick.side === "over" || pick.side === "under" ? String(value) : formatLine(value));

  switch (refresh.status) {
    case "updated": {
      const parts: string[] = [];
      if (refresh.previousOdds !== pick.odds) parts.push(`Odds changed: was ${formatOdds(refresh.previousOdds)}, now ${formatOdds(pick.odds)}`);
      if (refresh.previousLine !== pick.line && refresh.previousLine !== null && pick.line !== null) {
        parts.push(`Line moved: was ${line(refresh.previousLine)}, now ${line(pick.line)}`);
      }
      return { tone: "changed", text: parts.join(". ") };
    }
    case "unchanged":
      return { tone: "same", text: "Odds unchanged" };
    case "no-odds":
      return {
        tone: "warning",
        text: `${SPORTSBOOKS[pick.sportsbook].name} has no odds for this bet right now, so it kept its old price.`,
      };
    case "not-checked":
      return { tone: "warning", text: "We couldn't check current odds, so it kept its old price." };
  }
}

/* skippedHeading: "2 picks were not copied" (used above the list of skipped picks). */
export function skippedHeading(count: number): string {
  return `${pickCount(count)} ${count === 1 ? "was" : "were"} not copied`;
}
