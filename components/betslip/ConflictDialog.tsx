/*
  FILE: components/betslip/ConflictDialog.tsx
  WHAT IT'S FOR: The conflict popup. When you tap a pick that can't go on your
  slip, this explains which pick it clashes with and why, with two buttons:
  - Cancel: close the popup and change nothing.
  - Start new slip: make a new slip with just the new pick (your old slip stays saved).
  It uses the browser's built-in <dialog>, which handles the keyboard for us:
  Escape closes it, Tab stays inside it while it's open, and the page behind it
  can't be clicked. Clicking the dark area outside it also closes it.
  WHO USES IT: components/betslip/BetSlipProvider.tsx.
  WHY THIS NAME: It's the dialog (popup) for conflicts. It ends in .tsx because
  it shows something on screen.
*/

"use client";

import { useEffect, useRef } from "react";
// The Conflict type from lib/betting/conflicts.ts: the reason and message to show.
import type { Conflict } from "@/lib/betting/conflicts";

/*
  ConflictDialog: open whenever `conflict` isn't null.
  onCancel runs for Cancel, Escape, or clicking outside. onStartNewSlip runs for Start new slip.
*/
export default function ConflictDialog({
  conflict,
  onCancel,
  onStartNewSlip,
}: {
  conflict: Conflict | null;
  onCancel: () => void;
  onStartNewSlip: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Opens or closes the real dialog to match `conflict`. showModal() is what
  // turns on the keyboard handling and blocks the page behind it.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (conflict && !dialog.open) dialog.showModal();
    if (!conflict && dialog.open) dialog.close();
  }, [conflict]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="conflict-title"
      aria-describedby="conflict-message"
      // onClose: fires when the dialog closes for any reason, including Escape.
      onClose={onCancel}
      // A click whose target is the <dialog> itself (not the box inside) is a click on the dark area outside.
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-line bg-card p-0 text-text shadow-2xl shadow-black/60 backdrop:bg-black/70"
    >
      <div className="p-6">
        <h2 id="conflict-title" className="text-xl text-gold">
          {conflict?.reason === "sgp-other-game" ? "Wrong game for this SGP" : "These picks can't go together"}
        </h2>
        <p id="conflict-message" className="mt-3 text-sm leading-relaxed text-muted">
          {conflict?.message}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Start a new slip with this pick instead? Your current slip stays saved.
        </p>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          {/* autoFocus: Cancel is selected first, so pressing Enter by accident changes nothing. */}
          <button
            type="button"
            autoFocus
            onClick={onCancel}
            className="min-h-11 rounded-xl border border-line px-5 text-sm font-medium text-text hover:bg-card-raised"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onStartNewSlip}
            className="min-h-11 rounded-xl bg-gold px-5 text-sm font-semibold text-bg hover:bg-gold-bright"
          >
            Start new slip
          </button>
        </div>
      </div>
    </dialog>
  );
}
