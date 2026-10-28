/*
  FILE: components/betslip/SlipPanel.tsx
  WHAT IT'S FOR: The right-side panel on desktop (1280px and wider) showing
  your active slip in full: every pick with a × to remove it, the slip type,
  the combined odds, and a wager box with the estimated payout. In Build your own SGP mode it says the odds are
  Estimated (and why) and has a Done button.
  On smaller screens, components/betslip/SlipBar.tsx is shown instead.
  WHO USES IT: components/betslip/BetSlipProvider.tsx.
  WHY THIS NAME: It's the panel for your slip. It ends in .tsx because it shows
  something on screen.
*/

"use client";

import Link from "next/link";
// The wager box and payout, shared with the slip page and the slip bar.
import PayoutBox from "./PayoutBox";
// The odds format, "3 picks" text, and slip type words from lib/betting/picks.ts.
import { formatOdds, pickCount, SLIP_TYPE_LABELS } from "@/lib/betting/picks";
// useBetSlip from the provider next to this file: the active slip, remove, and Done.
import { useBetSlip } from "./BetSlipProvider";

/*
  SlipPanel: "hidden xl:flex" means it only appears at 1280px and wider.
  It's fixed to the right edge, full height. app/(main)/layout.tsx leaves room for it.
*/
export default function SlipPanel() {
  const { slip, removePick, finishSgp, setWager } = useBetSlip();
  const isSgp = slip !== null && slip.sgpGameId !== null;

  return (
    <aside
      aria-label="Your active bet slip"
      className="fixed inset-y-0 right-0 z-30 hidden w-80 flex-col border-l border-line bg-card xl:flex"
    >
      <div className="border-b border-line px-5 pb-4 pt-8">
        <h2 className="text-xl text-gold">Your slip</h2>
        {slip && (
          <p className="mt-1 truncate text-sm text-muted">
            {slip.name}
            {slip.picks.length > 0 && ` · ${SLIP_TYPE_LABELS[slip.type]}`}
          </p>
        )}
      </div>

      {/* The picks. This part scrolls if the list is long. */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {!slip && <p className="text-sm text-muted">Tap any odds to start a slip.</p>}
        {slip && slip.picks.length === 0 && (
          <p className="text-sm text-muted">
            {isSgp ? "Building your SGP. Tap odds from this game to add picks." : "No picks yet. Tap any odds to add one."}
          </p>
        )}
        {slip && slip.picks.length > 0 && (
          <ul className="space-y-3">
            {slip.picks.map((pick) => (
              <li key={pick.id} className="flex items-start gap-3 rounded-xl border border-line bg-card-raised p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text">{pick.label}</p>
                  <p className="truncate text-xs text-muted">
                    {pick.marketLabel} · {pick.gameLabel}
                  </p>
                </div>
                <p className="text-sm font-semibold tabular-nums text-gold">{formatOdds(pick.odds)}</p>
                <button
                  type="button"
                  onClick={() => removePick(pick.id)}
                  aria-label={`Remove ${pick.label}`}
                  className="-m-1 rounded p-1 text-muted hover:text-danger"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {slip && (
        <div className="space-y-3 border-t border-line px-5 py-4">
          <div className="flex items-baseline justify-between">
            <p className="text-sm text-muted">
              {pickCount(slip.picks.length)} · {slip.oddsAreEstimated ? "Estimated odds" : "Combined odds"}
            </p>
            <p className="text-xl font-semibold tabular-nums text-gold">{formatOdds(slip.combinedOdds)}</p>
          </div>
          {slip.id && <PayoutBox picks={slip.picks} type={slip.type} wager={slip.wager} onSave={setWager} />}
          {isSgp && (
            <p className="text-xs leading-relaxed text-muted">
              Estimated: the sportsbook&apos;s real SGP price is usually lower, because picks from the same game are related.
              {slip.picks.length < 2 && " An SGP needs at least 2 picks. With 1 pick it's a straight bet."}
            </p>
          )}
          {isSgp ? (
            <button
              type="button"
              onClick={finishSgp}
              className="min-h-11 w-full rounded-xl bg-gold text-sm font-semibold text-bg hover:bg-gold-bright"
            >
              Done
            </button>
          ) : (
            slip.id && (
              <Link
                href={`/betslips/${slip.id}`}
                className="flex min-h-11 w-full items-center justify-center rounded-xl border border-gold text-sm font-semibold text-gold hover:bg-gold hover:text-bg"
              >
                Open slip
              </Link>
            )
          )}
        </div>
      )}
    </aside>
  );
}
