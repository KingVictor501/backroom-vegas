/*
  FILE: components/betslip/OddsButton.tsx
  WHAT IT'S FOR: THE reusable odds button. Tap it to add the pick to your
  active slip, and tap it again to remove it. It turns gold the moment the
  pick is on your slip. If the pick clashes with your slip, the conflict popup opens instead.
  WHO USES IT: game cards on the Feed and league page (components/feed/GameCard.tsx).
  Later: the matchup page (Section 10) and player pages (Section 11B).
  WHY THIS NAME: It's a button showing odds. It ends in .tsx because it shows
  something on screen.
*/

"use client";

// formatOdds from lib/betting/picks.ts: shows odds like -110 or +150.
import { formatOdds } from "@/lib/betting/picks";
// The shared NewBetPick type: everything the slip needs to save this pick.
import type { NewBetPick } from "@/types";
// useBetSlip from components/betslip/BetSlipProvider.tsx: knows what's on your slip.
import { useBetSlip } from "./BetSlipProvider";

/*
  OddsButton
  - pick: the full pick this button adds (built by the page from the odds data)
  - lineText: optional small text above the price, like "-3" or "O 47.5"
  - lineTone: the small text's color: "muted" (gray, the default) or "gold" (used on game cards)
  aria-pressed tells screen readers whether the pick is on your slip ("selected").
  The button is at least 48px tall, so it's easy to tap on a phone. It fills
  the width it's given, so game cards can line buttons up in neat columns.
*/
export default function OddsButton({
  pick,
  lineText,
  lineTone = "muted",
}: {
  pick: NewBetPick;
  lineText?: string;
  lineTone?: "muted" | "gold";
}) {
  const { isOnSlip, togglePick } = useBetSlip();
  const selected = isOnSlip(pick.id);

  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={`${pick.label}, ${formatOdds(pick.odds)}`}
      onClick={() => togglePick(pick)}
      className={`flex min-h-12 w-full flex-col items-center justify-center rounded-xl border px-1 py-1 text-sm font-semibold tabular-nums transition-colors ${
        selected
          ? "border-gold bg-gold text-bg"
          : "border-line bg-card-raised text-text hover:border-gold hover:bg-gold/15"
      }`}
    >
      {/* On a gold (selected) button the small text turns dark, so it stays readable. */}
      {lineText && (
        <span className={`text-xs font-medium ${selected ? "text-bg/80" : lineTone === "gold" ? "text-gold" : "text-muted"}`}>
          {lineText}
        </span>
      )}
      <span>{formatOdds(pick.odds)}</span>
    </button>
  );
}
