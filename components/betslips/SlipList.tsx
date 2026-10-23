/*
  FILE: components/betslips/SlipList.tsx
  WHAT IT'S FOR: The list on the Bet Slips page, with a search box for slip
  names and a filter for All, Straight, Parlay, and SGP. The slips arrive
  already loaded by the server, so they're in the page even with JavaScript
  off. This part only hides the ones that don't match, which is why the
  search and filter update instantly, with no page reload.
  Each slip shows its name, its type (Straight, Parlay, or SGP), how many
  picks, the combined odds, and when it was last changed, and links to its page.
  WHO USES IT: app/(main)/betslips/page.tsx.
  WHY THIS NAME: It's the list of slips. It ends in .tsx because it shows something on screen.
*/

// "use client": the search box and filter react to typing and tapping.
"use client";

import Link from "next/link";
import { useId, useState } from "react";
// useBetSlip from the bet slip provider: which slip is active right now.
import { useBetSlip } from "@/components/betslip/BetSlipProvider";
// formatOdds, pickCount, and the type words, from lib/betting/picks.ts.
import { formatOdds, pickCount, SLIP_TYPE_LABELS } from "@/lib/betting/picks";
// shortDate ("Oct 23"), from lib/format/gameTime.ts.
import { shortDate } from "@/lib/format/gameTime";
// THE shared bet slip type, from the types folder.
import type { BetSlip, BetSlipType } from "@/types";

/* TypeFilter: the four filter buttons. */
type TypeFilter = "all" | BetSlipType;
const TYPE_FILTERS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "straight", label: "Straight" },
  { value: "parlay", label: "Parlay" },
  { value: "sgp", label: "SGP" },
];

/* SlipList: shows a friendly message when there are no slips at all. */
export default function SlipList({ slips }: { slips: BetSlip[] }) {
  const { slip: activeSlip } = useBetSlip();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const searchId = useId();

  if (slips.length === 0) {
    return (
      <div className="rounded-2xl border border-line bg-card p-8 text-center">
        <p className="font-display text-xl text-text">No bet slips yet</p>
        <p className="mt-2 text-sm text-muted">Tap any odds on the Feed to start one, or make an empty slip with New slip.</p>
        <Link
          href="/"
          className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-gold px-5 text-sm font-semibold text-bg hover:bg-gold-bright"
        >
          Go to the Feed
        </Link>
      </div>
    );
  }

  const words = search.trim().toLowerCase();
  const shown = slips.filter(
    (slip) => (typeFilter === "all" || slip.type === typeFilter) && (words === "" || slip.name.toLowerCase().includes(words)),
  );

  const chip = (picked: boolean) =>
    `min-h-10 shrink-0 whitespace-nowrap rounded-full border px-4 text-sm font-medium transition-colors ${
      picked ? "border-gold bg-gold/10 text-gold" : "border-line text-muted hover:border-muted hover:text-text"
    }`;

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor={searchId} className="sr-only">
          Search slip names
        </label>
        <input
          id={searchId}
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search slip names"
          maxLength={50}
          autoComplete="off"
          className="min-h-12 w-full rounded-full border border-line bg-card px-5 text-base text-text placeholder:text-muted focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/40"
        />
      </div>

      <div role="group" aria-label="Slip type" className="scroll-row -mx-4 flex flex-nowrap gap-2 px-4 sm:mx-0 sm:px-0">
        {TYPE_FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            aria-pressed={typeFilter === filter.value}
            onClick={() => setTypeFilter(filter.value)}
            className={chip(typeFilter === filter.value)}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* aria-live: screen readers hear how many slips match after each change. */}
      <p aria-live="polite" className="text-xs text-muted">
        {shown.length} of {slips.length} {slips.length === 1 ? "slip" : "slips"}
      </p>

      {shown.length === 0 ? (
        <p className="rounded-2xl border border-line bg-card p-6 text-center text-sm text-muted">
          No slips match{words ? ` "${search.trim()}"` : ""}
          {typeFilter !== "all" ? ` in ${SLIP_TYPE_LABELS[typeFilter]}` : ""}.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {shown.map((slip) => {
            const isActive = slip.id === activeSlip?.id;
            return (
              <li key={slip.id}>
                <Link
                  href={`/betslips/${slip.id}`}
                  className={`block rounded-2xl border bg-card p-4 transition-colors hover:border-gold/60 ${isActive ? "border-gold" : "border-line"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 truncate font-semibold text-text">{slip.name}</p>
                    <p className="shrink-0 text-lg font-semibold tabular-nums text-gold">{formatOdds(slip.combinedOdds)}</p>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full border border-gold/50 px-2 py-0.5 font-semibold text-gold">{SLIP_TYPE_LABELS[slip.type]}</span>
                    {isActive && <span className="rounded-full bg-gold px-2 py-0.5 font-semibold text-bg">Active</span>}
                    {slip.oddsAreEstimated && <span className="text-muted">Estimated</span>}
                    <span className="text-muted">{pickCount(slip.picks.length)}</span>
                    <span className="text-muted">· Updated {shortDate(slip.updatedAt)}</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
