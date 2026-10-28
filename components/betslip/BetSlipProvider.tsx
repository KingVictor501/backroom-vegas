/*
  FILE: components/betslip/BetSlipProvider.tsx
  WHAT IT'S FOR: The "brain" of the bet slip in the browser. It holds your
  ACTIVE slip (the one you're adding picks to) and follows BET SLIP RULES:
  - Your first tap on any odds creates a slip automatically.
  - Tapping a pick that's already on the slip removes it. Removing the LAST
    pick asks "Delete this slip?": Delete removes the whole slip (and the bar);
    Keep leaves the empty slip saved as your current slip, so the bar stays.
  - The slip bar only appears once there's a slip being built (your first pick,
    or Build your own SGP).
  - A pick that clashes with one on the slip opens the conflict popup instead.
    Cancel changes nothing. Start new slip makes a second slip with just that pick.
  - Build your own SGP starts a slip locked to one game, until you tap Done.
  - Picks highlight INSTANTLY (before the server answers). If saving fails,
    the change is undone and an error message appears.
  It also draws the slip bar, the desktop slip panel, the popup, and the
  short messages, so every page gets them without doing anything.
  WHO USES IT: app/(main)/layout.tsx wraps every app page in it. Odds buttons
  and SGP buttons read it through useBetSlip().
  WHY THIS NAME: In React, a "provider" shares information with every
  component inside it. It ends in .tsx because it shows something on screen.
*/

// "use client": this runs in the browser, because it reacts to taps.
"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
// The conflict rules from lib/betting/conflicts.ts (the server uses the same ones).
import { findConflict, type Conflict } from "@/lib/betting/conflicts";
// The parlay math from lib/betting/parlay.ts, so the bar updates instantly before the server answers.
import { getSlipPricing } from "@/lib/betting/parlay";
// The browser's requests to our bet slip API, from lib/betting/slipRequests.ts.
import { clearActiveSlip, createSlip, deleteSlip, saveSlipPicks } from "@/lib/betting/slipRequests";
// THE shared bet slip types from the types folder, plus the 25-pick limit the server uses too.
import { BET_SLIP_DEFAULT_WAGER, BET_SLIP_MAX_PICKS, type BetPick, type BetSlip, type NewBetPick } from "@/types";
// The pieces this provider draws, from the files next to this one.
import ChoiceDialog from "./ChoiceDialog";
import ConflictDialog from "./ConflictDialog";
import SlipBar from "./SlipBar";
import SlipPanel from "./SlipPanel";
import SlipToast, { type ToastMessage } from "./SlipToast";

/*
  BetSlipContextValue: everything odds buttons, SGP buttons, the bar, and the
  panel can read or do.
*/
type BetSlipContextValue = {
  /** Your active slip, or null if you don't have one yet (missing on purpose: nothing to show). */
  slip: BetSlip | null;
  /** true if this pick is on your active slip (its odds button turns gold). */
  isOnSlip: (pickId: string) => boolean;
  /** What tapping an odds button does: add it, remove it, or show the conflict popup. */
  togglePick: (pick: NewBetPick) => void;
  /** Removes one pick (the × in the slip panel). */
  removePick: (pickId: string) => void;
  /** Starts Build your own SGP for one game. */
  startSgp: (game: { gameId: string; gameLabel: string }) => void;
  /** The Done button: ends SGP mode. The SGP stays saved. */
  finishSgp: () => void;
  /**
   * For the Bet Slips pages: after they rename, change, delete, or choose a
   * slip, they hand the server's answer here so the slip bar matches.
   * null means "no active slip" (missing on purpose).
   */
  replaceActiveSlip: (slip: BetSlip | null) => void;
  /** Shows a short message at the top of the screen, like "Slip deleted." */
  announce: (text: string, tone?: "info" | "error") => void;
};

const BetSlipContext = createContext<BetSlipContextValue | null>(null);

/*
  useBetSlip: how a component inside the provider reads the slip.
  Example: const { isOnSlip, togglePick } = useBetSlip();
*/
export function useBetSlip(): BetSlipContextValue {
  const value = useContext(BetSlipContext);
  if (!value) throw new Error("useBetSlip must be used inside BetSlipProvider (app/(main)/layout.tsx).");
  return value;
}

/*
  previewSlip: what the slip will look like after a change, worked out in the
  browser so the screen updates instantly. The server's answer replaces it a
  moment later. A brand-new slip has no ID or name yet, so it shows "New slip".
*/
function previewSlip(base: BetSlip | null, picks: BetPick[], sgp?: { gameId: string; name: string }): BetSlip {
  const now = new Date().toISOString();
  return {
    id: base?.id ?? "",
    userId: base?.userId ?? "",
    name: sgp?.name ?? base?.name ?? "New slip",
    sgpGameId: sgp?.gameId ?? base?.sgpGameId ?? null,
    picks,
    ...getSlipPricing(picks),
    wager: base?.wager ?? BET_SLIP_DEFAULT_WAGER,
    // A slip being previewed keeps its "copied from" note (null = not a copy, missing on purpose).
    copiedFrom: base?.copiedFrom ?? null,
    createdAt: base?.createdAt ?? now,
    updatedAt: now,
  };
}

/* PendingConflict: a tapped pick waiting on the popup, plus why it clashes. */
type PendingConflict = { conflict: Conflict; pick: NewBetPick };

/*
  BetSlipProvider: wraps the app pages.
  - initialSlip: your active slip, loaded on the server by the layout, so the
    bar shows up right away with no flicker. null if you don't have one.
*/
export default function BetSlipProvider({
  initialSlip,
  children,
}: {
  initialSlip: BetSlip | null;
  children: ReactNode;
}) {
  // What's on screen right now (may be a preview that isn't saved yet).
  const [slip, setSlip] = useState<BetSlip | null>(initialSlip);
  const [pendingConflict, setPendingConflict] = useState<PendingConflict | null>(null);
  // The slip waiting on the "Delete this slip?" prompt (after its last pick was removed), or null.
  const [pendingDelete, setPendingDelete] = useState<BetSlip | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  /*
    These "refs" are notes the provider keeps for itself. They don't redraw
    the screen when they change.
    - shownRef: the same as `slip`, but readable instantly between quick taps.
    - savedRef: the last slip the SERVER confirmed. If a save fails, we go back to this.
    - queueRef: saves wait in line and run one at a time, in tap order.
    - roundRef: goes up by 1 whenever a save fails, so saves still waiting in
      line from before the failure are skipped instead of sent.
    - waitingRef: how many saves haven't finished yet.
  */
  const shownRef = useRef<BetSlip | null>(initialSlip);
  const savedRef = useRef<BetSlip | null>(initialSlip);
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const roundRef = useRef(0);
  const waitingRef = useRef(0);

  /* show: puts a slip on screen (or hides the bar with null). */
  function show(next: BetSlip | null) {
    shownRef.current = next;
    setSlip(next);
  }

  /* notify: shows a short message at the top of the screen. */
  function notify(text: string, tone: ToastMessage["tone"] = "info") {
    setToast({ text, tone, key: Date.now() });
  }

  /*
    queueSave: adds a save to the line.
    - save(): does the request and gives back the server's version of the active slip.
    - If it works and nothing else is waiting, the server's version goes on
      screen (with the server's own type and odds).
    - If it fails, the screen goes back to the last saved slip, waiting saves
      are skipped, and the server's message is shown.
  */
  function queueSave(save: () => Promise<BetSlip | null>) {
    const round = roundRef.current;
    waitingRef.current += 1;
    queueRef.current = queueRef.current.then(async () => {
      try {
        if (round !== roundRef.current) return;
        const saved = await save();
        savedRef.current = saved;
        if (waitingRef.current === 1) show(saved);
      } catch (error) {
        roundRef.current += 1;
        show(savedRef.current);
        notify(error instanceof Error ? error.message : "Your slip didn't save. Please try again.", "error");
      } finally {
        waitingRef.current -= 1;
      }
    });
  }

  /* savedSlipId: the real ID of the active slip, once the server has created it. */
  function savedSlipId(): string {
    const id = savedRef.current?.id;
    if (!id) throw new Error("Your slip didn't save. Please try again.");
    return id;
  }

  /* savePicks: shows the new picks right away, then saves them. */
  function savePicks(current: BetSlip, picks: BetPick[]) {
    show(previewSlip(current, picks));
    queueSave(() => saveSlipPicks(savedSlipId(), picks));
  }

  /* startNewSlipWith: creates a brand-new active slip holding just this pick. */
  function startNewSlipWith(pick: BetPick, announce: boolean) {
    show(previewSlip(null, [pick]));
    queueSave(async () => {
      const created = await createSlip({ picks: [pick], setActive: true });
      if (announce) notify(`New slip created: "${created.name}". Your old slip is still saved.`);
      return created;
    });
  }

  /* togglePick: what tapping an odds button does (see BET SLIP RULES at the top). */
  function togglePick(newPick: NewBetPick) {
    const current = shownRef.current;
    const pick: BetPick = { ...newPick, addedAt: new Date().toISOString() };

    // No active slip yet: the first tap creates one.
    if (!current) return startNewSlipWith(pick, false);

    // Already on the slip: tapping again removes it.
    if (current.picks.some((p) => p.id === pick.id)) return removePick(pick.id);

    // Clashes with a pick on the slip (or the wrong game for an SGP): ask first.
    const conflict = findConflict(current.picks, pick, current.sgpGameId);
    if (conflict) return setPendingConflict({ conflict, pick: newPick });

    if (current.picks.length >= BET_SLIP_MAX_PICKS) {
      return notify(`A slip can have at most ${BET_SLIP_MAX_PICKS} picks.`, "error");
    }
    savePicks(current, [...current.picks, pick]);
  }

  /*
    removePick: takes one pick off the slip (tapping a gold button again, or the
    × in the slip panel). If it's the LAST pick, nothing changes yet: the
    "Delete this slip?" prompt opens first.
  */
  function removePick(pickId: string) {
    const current = shownRef.current;
    if (!current) return;
    const remaining = current.picks.filter((p) => p.id !== pickId);
    if (remaining.length === 0) return setPendingDelete(current);
    savePicks(current, remaining);
  }

  /* The prompt's choices. Escape or clicking outside closes it and changes nothing (the pick stays). */
  function keepEmptySlip() {
    setPendingDelete(null);
    const current = shownRef.current;
    if (current) savePicks(current, []);
  }
  function deleteWholeSlip() {
    setPendingDelete(null);
    show(null);
    queueSave(async () => {
      await deleteSlip(savedSlipId());
      return null;
    });
  }

  /*
    startSgp: Build your own SGP. Makes a new, empty slip named like
    "KC @ SEA SGP" (or "KC @ SEA SGP (2)" if that's taken), locked to that game,
    and makes it the active slip. Your old slip stays saved.
  */
  function startSgp(game: { gameId: string; gameLabel: string }) {
    if (shownRef.current?.sgpGameId === game.gameId) {
      return notify("You're already building an SGP for this game.");
    }
    const name = `${game.gameLabel} SGP`;
    show(previewSlip(null, [], { gameId: game.gameId, name }));
    queueSave(() =>
      createSlip({ name, numberIfTaken: true, sgpGameId: game.gameId, picks: [], setActive: true }),
    );
  }

  /* finishSgp: the Done button. The SGP stays saved; your next tap starts a new slip. */
  function finishSgp() {
    show(null);
    queueSave(async () => {
      await clearActiveSlip();
      return null;
    });
  }

  /* replaceActiveSlip: the Bet Slips pages already saved the change, so this just updates the screen. */
  function replaceActiveSlip(next: BetSlip | null) {
    savedRef.current = next;
    show(next);
  }

  /* The popup's two buttons. */
  function cancelConflict() {
    setPendingConflict(null);
  }
  function confirmNewSlip() {
    if (!pendingConflict) return;
    setPendingConflict(null);
    startNewSlipWith({ ...pendingConflict.pick, addedAt: new Date().toISOString() }, true);
  }

  // A quick lookup of which picks are on the slip, so each odds button can check instantly.
  const pickIds = useMemo(() => new Set(slip?.picks.map((p) => p.id)), [slip]);

  // Messages disappear on their own after 5 seconds.
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  const value: BetSlipContextValue = {
    slip,
    isOnSlip: (pickId) => pickIds.has(pickId),
    togglePick,
    removePick,
    startSgp,
    finishSgp,
    replaceActiveSlip,
    announce: notify,
  };

  return (
    <BetSlipContext value={value}>
      {children}
      {/* Extra space at the bottom so the slip bar never covers the end of a page. Not needed on desktop, where the panel is used. */}
      {slip && <div aria-hidden className="h-20 lg:h-24 xl:hidden" />}
      <SlipBar />
      <SlipPanel />
      <ConflictDialog
        conflict={pendingConflict?.conflict ?? null}
        onCancel={cancelConflict}
        onStartNewSlip={confirmNewSlip}
      />
      <ChoiceDialog
        open={pendingDelete !== null}
        title="Delete this slip?"
        message={`That was the last pick on "${pendingDelete?.name ?? "your slip"}".`}
        note="Delete the whole slip, or keep it (empty) as your current slip?"
        stayLabel="Keep slip"
        actLabel="Delete slip"
        danger
        onStay={keepEmptySlip}
        onAct={deleteWholeSlip}
        onDismiss={() => setPendingDelete(null)}
      />
      <SlipToast message={toast} onDismiss={() => setToast(null)} />
    </BetSlipContext>
  );
}
