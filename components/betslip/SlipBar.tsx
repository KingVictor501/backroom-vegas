/*
  FILE: components/betslip/SlipBar.tsx
  WHAT IT'S FOR: The small bar just above the bottom menu showing your active
  slip: its name, type, number of picks, and combined odds.
  - Normal slip: a "View" link opens the slip's page.
  - Build your own SGP: it shows the game, the "Estimated" label, and a Done button.
  It only shows on phones, tablets, and small laptops. At 1280px and wider,
  components/betslip/SlipPanel.tsx shows the slip on the right instead.
  WHO USES IT: components/betslip/BetSlipProvider.tsx.
  WHY THIS NAME: It's the bar for your slip. It ends in .tsx because it shows
  something on screen.
*/

"use client";

import Link from "next/link";
// The odds format, "3 picks" text, and slip type words from lib/betting/picks.ts.
import { formatOdds, pickCount, SLIP_TYPE_LABELS } from "@/lib/betting/picks";
// useBetSlip from the provider next to this file: the active slip and the Done button.
import { useBetSlip } from "./BetSlipProvider";

/*
  SlipBar: hidden when there's no active slip.
  Placement: 96px up on phones (above the floating menu), at the bottom on
  1024px+ (where the menu becomes a sidebar), and hidden at 1280px+ ("xl:hidden").
*/
export default function SlipBar() {
  const { slip, finishSgp } = useBetSlip();
  if (!slip) return null;

  const isSgp = slip.sgpGameId !== null;
  // The game's label comes from the first pick, or from the name ("KC @ SEA SGP") before any picks.
  const sgpGame = slip.picks[0]?.gameLabel ?? slip.name.replace(/ SGP( \(\d+\))?$/, "");

  return (
    <aside
      aria-label="Your active bet slip"
      className="fixed inset-x-4 bottom-24 z-30 rounded-2xl border border-gold/60 bg-card-raised/95 px-4 py-3 shadow-lg shadow-black/50 backdrop-blur
                 lg:bottom-4 lg:left-64 xl:hidden"
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-text">
            {isSgp ? `SGP · ${sgpGame}` : slip.name}
          </p>
          <p className="text-xs text-muted">
            {pickCount(slip.picks.length)}
            {!isSgp && slip.picks.length > 0 && ` · ${SLIP_TYPE_LABELS[slip.type]}`}
            {isSgp && " · Real SGP prices are usually lower"}
          </p>
        </div>

        <div className="text-right">
          <p className="text-lg font-semibold tabular-nums text-gold">{formatOdds(slip.combinedOdds)}</p>
          {slip.oddsAreEstimated && <p className="text-[11px] uppercase tracking-wide text-muted">Estimated</p>}
        </div>

        {isSgp ? (
          <button
            type="button"
            onClick={finishSgp}
            className="min-h-11 rounded-xl bg-gold px-4 text-sm font-semibold text-bg hover:bg-gold-bright"
          >
            Done
          </button>
        ) : (
          // The ID is empty for a split second while a brand-new slip is saving, so the link waits for it.
          slip.id && (
            <Link
              href={`/betslips/${slip.id}`}
              className="flex min-h-11 items-center rounded-xl border border-gold px-4 text-sm font-semibold text-gold hover:bg-gold hover:text-bg"
            >
              View
            </Link>
          )
        )}
      </div>
    </aside>
  );
}
