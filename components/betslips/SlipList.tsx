/*
  FILE: components/betslips/SlipList.tsx
  WHAT IT'S FOR: The list on the Bet Slips page, with a search box for slip
  names and a filter for All, Straight, Parlay, and SGP. The slips arrive
  already loaded by the server, so they're in the page even with JavaScript
  off. This part only hides the ones that don't match, which is why the
  search and filter update instantly, with no page reload.
  Each slip shows its name, its type (Straight, Parlay, or SGP), how many
  picks, the combined odds, and when it was last changed, and links to its page.
  Each also has a "Copy slip" button, and (unless it's already your active slip) a "Make Active"
  button on the right.
  WHO USES IT: app/(main)/betslips/page.tsx.
  WHY THIS NAME: It's the list of slips. It ends in .tsx because it shows something on screen.
*/

// "use client": the search box and filter react to typing and tapping.
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
// useBetSlip from the bet slip provider: which slip is active right now.
import { useBetSlip } from "@/components/betslip/BetSlipProvider";
// The red error box from components/ErrorMessage.tsx.
import ErrorMessage from "@/components/ErrorMessage";
// The sentence shown after a copy, from lib/betting/copyMessages.ts.
import { copyAnnouncement } from "@/lib/betting/copyMessages";
// copySlip: the browser's request to the copy route, from lib/betting/slipRequests.ts.
import { copySlip, setActiveSlip } from "@/lib/betting/slipRequests";
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
  const router = useRouter();
  const { slip: activeSlip, replaceActiveSlip, announce } = useBetSlip();
  // Which slip is being copied right now (its ID), and the red message if a copy fails.
  const [copyingId, setCopyingId] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  // Which slip is being made active right now (its ID). Null = none (missing on purpose).
  const [activatingId, setActivatingId] = useState<string | null>(null);
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

  /*
    onCopy: copies one slip on the server (it can take a few seconds), makes the copy your active
    slip, and opens it so you can see what was skipped and which odds changed.
  */
  async function onCopy(slip: BetSlip) {
    setCopyingId(slip.id);
    setCopyError(null);
    try {
      const copy = await copySlip(slip.id);
      replaceActiveSlip(copy);
      announce(copyAnnouncement(copy));
      router.push(`/betslips/${copy.id}`);
      router.refresh();
    } catch (error) {
      setCopyError(error instanceof Error ? error.message : "That didn't copy. Please try again.");
    } finally {
      setCopyingId(null);
    }
  }

  /*
    onMakeActive: the server makes this your active slip (the one your taps add to), then the
    slip bar and this list switch to it right away.
  */
  async function onMakeActive(slip: BetSlip) {
    setActivatingId(slip.id);
    setCopyError(null);
    try {
      const saved = await setActiveSlip(slip.id);
      replaceActiveSlip(saved);
      announce(`"${saved.name}" is now your active slip.`);
      router.refresh();
    } catch (error) {
      setCopyError(error instanceof Error ? error.message : "That didn't change your active slip. Please try again.");
    } finally {
      setActivatingId(null);
    }
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

      {copyError && <ErrorMessage>{copyError}</ErrorMessage>}
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
              <li
                key={slip.id}
                className={`rounded-2xl border bg-card transition-colors hover:border-gold/60 ${isActive ? "border-gold" : "border-line"}`}
              >
                {/* The card links to the slip. The Copy button sits below it, not inside the link (a button can't live inside a link). */}
                <Link href={`/betslips/${slip.id}`} className="block rounded-t-2xl p-4 hover:bg-card-raised">
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
                <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-2">
                  <button
                    type="button"
                    onClick={() => void onCopy(slip)}
                    disabled={copyingId !== null || activatingId !== null}
                    aria-label={`Copy slip ${slip.name}`}
                    className="min-h-11 rounded-lg px-1 text-sm font-semibold text-gold hover:text-gold-bright disabled:cursor-wait disabled:opacity-50"
                  >
                    {copyingId === slip.id ? "Copying…" : "Copy slip"}
                  </button>
                  {/* The active slip already shows the gold Active badge, so it has no button. */}
                  {!isActive && (
                    <button
                      type="button"
                      onClick={() => void onMakeActive(slip)}
                      disabled={copyingId !== null || activatingId !== null}
                      aria-label={`Make ${slip.name} your active slip`}
                      className="min-h-11 rounded-lg px-1 text-sm font-semibold text-gold hover:text-gold-bright disabled:cursor-wait disabled:opacity-50"
                    >
                      {activatingId === slip.id ? "Switching…" : "Make Active"}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
