/*
  FILE: components/betslip/ChoiceDialog.tsx
  WHAT IT'S FOR: The shared popup used by the bet slip: a title, a message,
  and two buttons. It uses the browser's built-in <dialog>, which handles the
  keyboard for us: Escape closes it, Tab stays inside it while it's open, and
  the page behind it can't be clicked. Clicking the dark area outside also
  closes it. Closing it any of those ways changes nothing.
  WHO USES IT: components/betslip/ConflictDialog.tsx (picks that can't go
  together) and components/betslip/BetSlipProvider.tsx ("Delete this slip?").
  WHY THIS NAME: It's a dialog (popup) that asks you to make a choice. It ends
  in .tsx because it shows something on screen.
*/

"use client";

import { useEffect, useRef } from "react";

/*
  ChoiceDialog: open whenever `open` is true.
  - title / message / note: the words to show (note is an optional second line)
  - stayLabel: the first button (selected first, so pressing Enter by accident is the safe choice)
  - actLabel: the second, gold button
  - danger: makes the second button red, for choices like deleting
  - onStay / onAct: what each button does
  - onDismiss: Escape or clicking outside (changes nothing)
*/
export default function ChoiceDialog({
  open,
  title,
  message,
  note,
  stayLabel,
  actLabel,
  danger = false,
  onStay,
  onAct,
  onDismiss,
}: {
  open: boolean;
  title: string;
  message: string;
  note?: string;
  stayLabel: string;
  actLabel: string;
  danger?: boolean;
  onStay: () => void;
  onAct: () => void;
  onDismiss: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Opens or closes the real dialog to match `open`. showModal() is what turns
  // on the keyboard handling and blocks the page behind it.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="choice-title"
      aria-describedby="choice-message"
      // onCancel: the browser's Escape key. We close it ourselves through onDismiss.
      onCancel={(event) => {
        event.preventDefault();
        onDismiss();
      }}
      // A click whose target is the <dialog> itself (not the box inside) is a click on the dark area outside.
      onClick={(event) => {
        if (event.target === event.currentTarget) onDismiss();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-line bg-card p-0 text-text shadow-2xl shadow-black/60 backdrop:bg-black/70"
    >
      <div className="p-6">
        <h2 id="choice-title" className="text-xl text-gold">
          {title}
        </h2>
        <p id="choice-message" className="mt-3 text-sm leading-relaxed text-muted">
          {message}
        </p>
        {note && <p className="mt-3 text-sm leading-relaxed text-muted">{note}</p>}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          {/* autoFocus: the first button is selected first. */}
          <button
            type="button"
            autoFocus
            onClick={onStay}
            className="min-h-11 rounded-xl border border-line px-5 text-sm font-medium text-text hover:bg-card-raised"
          >
            {stayLabel}
          </button>
          <button
            type="button"
            onClick={onAct}
            className={`min-h-11 rounded-xl px-5 text-sm font-semibold ${
              danger ? "bg-danger text-bg hover:bg-danger/85" : "bg-gold text-bg hover:bg-gold-bright"
            }`}
          >
            {actLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
