/*
  FILE: components/betslip/ConflictDialog.tsx
  WHAT IT'S FOR: The conflict popup. When you tap a pick that can't go on your
  slip, this explains which pick it clashes with and why, with two buttons:
  - Cancel: close the popup and change nothing.
  - Start new slip: make a new slip with just the new pick (your old slip stays saved).
  Escape or clicking outside also cancels. The popup itself (and its keyboard
  handling) is the shared ChoiceDialog next to this file.
  WHO USES IT: components/betslip/BetSlipProvider.tsx.
  WHY THIS NAME: It's the dialog (popup) for conflicts. It ends in .tsx because
  it shows something on screen.
*/

"use client";

// The Conflict type from lib/betting/conflicts.ts: the reason and message to show.
import type { Conflict } from "@/lib/betting/conflicts";
// The shared two-button popup.
import ChoiceDialog from "./ChoiceDialog";

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
  return (
    <ChoiceDialog
      open={conflict !== null}
      title={conflict?.reason === "sgp-other-game" ? "Wrong game for this SGP" : "These picks can't go together"}
      message={conflict?.message ?? ""}
      note="Start a new slip with this pick instead? Your current slip stays saved."
      stayLabel="Cancel"
      actLabel="Start new slip"
      onStay={onCancel}
      onAct={onStartNewSlip}
      onDismiss={onCancel}
    />
  );
}
