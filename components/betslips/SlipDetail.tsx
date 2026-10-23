/*
  FILE: components/betslips/SlipDetail.tsx
  WHAT IT'S FOR: Everything you can DO on one slip's page:
  - rename it (1 to 50 characters; a name you already used is refused, in red)
  - see every pick, with games that already started marked "Started"
  - remove picks (removing the last one asks "Delete this slip?", like the slip bar)
  - set it as your active slip (the one your taps add to)
  - delete it, after an "Are you sure?" popup
  Each change goes to the bet slip API, and the slip bar updates to match.
  WHO USES IT: app/(main)/betslips/[id]/page.tsx, which loads the slip on the server.
  WHY THIS NAME: It's the slip's detail view. It ends in .tsx because it shows something on screen.
*/

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
// The bet slip provider (slip bar) and the shared popup, from components/betslip.
import { useBetSlip } from "@/components/betslip/BetSlipProvider";
import ChoiceDialog from "@/components/betslip/ChoiceDialog";
// The red error styles, from components/ErrorMessage.tsx.
import ErrorMessage, { FieldError } from "@/components/ErrorMessage";
// Odds and type words, and the day/time words.
import { formatOdds, pickCount, SLIP_TYPE_LABELS } from "@/lib/betting/picks";
import { gameDayLabel, gameTimeLabel } from "@/lib/format/gameTime";
// The browser's requests to our bet slip API, from lib/betting/slipRequests.ts.
import { deleteSlip, renameSlip, saveSlipPicks, setActiveSlip, SlipRequestError } from "@/lib/betting/slipRequests";
// The sportsbook names (each pick remembers its book).
import { SPORTSBOOKS } from "@/config/sportsbooks";
// THE shared bet slip type and the 50-character limit, from the types folder.
import { BET_SLIP_NAME_MAX_LENGTH, type BetSlip } from "@/types";

/*
  SlipDetail
  - initialSlip: the slip, loaded on the server
  - now: the server's clock when the page was built, so "Started" is decided the
    same way on the server and in the browser
*/
export default function SlipDetail({ initialSlip, now }: { initialSlip: BetSlip; now: number }) {
  const router = useRouter();
  const { slip: activeSlip, replaceActiveSlip, announce } = useBetSlip();
  const [slip, setSlip] = useState(initialSlip);
  const [name, setName] = useState(initialSlip.name);
  const [nameError, setNameError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Which popup is open: "delete" (Delete button), "last-pick" (removing the last pick, with the pick's ID), or none.
  const [popup, setPopup] = useState<{ kind: "delete" } | { kind: "last-pick"; pickId: string } | null>(null);
  const nameId = useId();
  const isActive = activeSlip?.id === slip.id;

  /* afterSave: show the server's version here, and in the slip bar if it's the active slip. */
  function afterSave(saved: BetSlip) {
    setSlip(saved);
    setName(saved.name);
    if (isActive) replaceActiveSlip(saved);
    router.refresh();
  }

  /* run: does one request, with the buttons paused and any error shown in red. */
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setActionError(null);
    try {
      await action();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "That didn't save. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  /* onRename: checks the name here first (instant), then lets the server decide. */
  async function onRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNameError(null);
    const trimmed = name.trim();
    if (trimmed === slip.name) return;
    if (trimmed.length === 0) return setNameError("Give the slip a name.");
    if (trimmed.length > BET_SLIP_NAME_MAX_LENGTH) return setNameError(`Slip names can be up to ${BET_SLIP_NAME_MAX_LENGTH} characters.`);
    setBusy(true);
    try {
      afterSave(await renameSlip(slip.id, trimmed));
      announce(`Renamed to "${trimmed}".`);
    } catch (error) {
      if (error instanceof SlipRequestError && error.fieldErrors.name) setNameError(error.fieldErrors.name);
      else setActionError(error instanceof Error ? error.message : "That didn't save. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  /* removePick: removing the last pick asks first, like the slip bar does. */
  function removePick(pickId: string) {
    if (slip.picks.length === 1) return setPopup({ kind: "last-pick", pickId });
    void run(async () => afterSave(await saveSlipPicks(slip.id, slip.picks.filter((p) => p.id !== pickId))));
  }

  /* onDelete: deletes the slip, then goes back to the list. */
  function onDelete() {
    setPopup(null);
    void run(async () => {
      await deleteSlip(slip.id);
      if (isActive) replaceActiveSlip(null);
      announce(`Deleted "${slip.name}".`);
      router.push("/betslips");
      router.refresh();
    });
  }

  /* keepEmpty: the "Keep slip" choice after removing the last pick. */
  function keepEmpty() {
    setPopup(null);
    void run(async () => afterSave(await saveSlipPicks(slip.id, [])));
  }

  /* makeActive: the "Set as active slip" button. */
  function makeActive() {
    void run(async () => {
      const saved = await setActiveSlip(slip.id);
      replaceActiveSlip(saved);
      announce(`"${saved.name}" is now your active slip.`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      {actionError && <ErrorMessage>{actionError}</ErrorMessage>}

      {/* Top: name (rename form), type, odds, and the Active / Set as active control. */}
      <section aria-label="Slip summary" className="space-y-4 rounded-2xl border border-line bg-card p-5">
        <form onSubmit={onRename} noValidate>
          <label htmlFor={nameId} className="block text-xs font-medium uppercase tracking-wide text-muted">
            Slip name
          </label>
          <div className="mt-1.5 flex gap-2">
            <input
              id={nameId}
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={BET_SLIP_NAME_MAX_LENGTH + 10}
              autoComplete="off"
              aria-invalid={nameError ? true : undefined}
              aria-describedby={nameError ? `${nameId}-error` : undefined}
              className={`min-h-12 min-w-0 flex-1 rounded-xl border px-4 font-display text-xl text-text focus:outline-none ${
                nameError ? "border-danger bg-danger/10 ring-2 ring-danger/60" : "border-line bg-bg focus:border-gold"
              }`}
            />
            <button
              type="submit"
              disabled={busy || name.trim() === slip.name}
              className="min-h-12 shrink-0 rounded-xl border border-gold px-4 text-sm font-semibold text-gold hover:bg-gold hover:text-bg disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-gold"
            >
              Rename
            </button>
          </div>
          {nameError && <FieldError id={`${nameId}-error`}>{nameError}</FieldError>}
        </form>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-full border border-gold/50 px-2.5 py-0.5 text-xs font-semibold text-gold">{SLIP_TYPE_LABELS[slip.type]}</span>
          <span className="text-muted">{pickCount(slip.picks.length)}</span>
          <span className="ml-auto text-right">
            <span className="block text-2xl font-semibold tabular-nums text-gold">{formatOdds(slip.combinedOdds)}</span>
            <span className="text-xs text-muted">{slip.oddsAreEstimated ? "Estimated odds" : "Combined odds"}</span>
          </span>
        </div>
        {slip.oddsAreEstimated && (
          <p className="text-xs leading-relaxed text-muted">
            Estimated: the sportsbook&apos;s real SGP price is usually lower, because picks from the same game are related.
          </p>
        )}

        {isActive ? (
          <p className="inline-flex items-center gap-2 rounded-full bg-gold px-3 py-1 text-xs font-semibold text-bg">✓ Your active slip</p>
        ) : (
          <button
            type="button"
            onClick={makeActive}
            disabled={busy}
            className="min-h-11 rounded-xl border border-gold px-4 text-sm font-semibold text-gold hover:bg-gold hover:text-bg disabled:opacity-50"
          >
            Set as active slip
          </button>
        )}
      </section>

      {/* The picks. */}
      <section aria-labelledby="picks-heading" className="rounded-2xl border border-line bg-card p-5">
        <h2 id="picks-heading" className="text-xl text-text">
          Picks
        </h2>
        {slip.picks.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            No picks yet. {isActive ? "Tap any odds to add one." : "Set this as your active slip, then tap any odds to add picks."}
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {slip.picks.map((pick) => {
              const started = Date.parse(pick.gameStartsAt) <= now;
              return (
                <li key={pick.id} className="flex items-start gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-text">{pick.label}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {pick.marketLabel} ·{" "}
                      <Link href={`/matchup/${pick.gameId}`} className="hover:text-gold">
                        {pick.gameLabel}
                      </Link>{" "}
                      · {SPORTSBOOKS[pick.sportsbook].name}
                    </p>
                    <p className="mt-1 text-xs">
                      {started ? (
                        <span className="rounded-full border border-danger/60 px-2 py-0.5 font-semibold text-danger">Started</span>
                      ) : (
                        <span className="text-muted">
                          {gameDayLabel(pick.gameStartsAt, new Date(now))} · {gameTimeLabel(pick.gameStartsAt)}
                        </span>
                      )}
                    </p>
                  </div>
                  <p className="shrink-0 text-lg font-semibold tabular-nums text-gold">{formatOdds(pick.odds)}</p>
                  <button
                    type="button"
                    onClick={() => removePick(pick.id)}
                    disabled={busy}
                    aria-label={`Remove ${pick.label}`}
                    className="-m-1 min-h-11 min-w-11 shrink-0 rounded-lg text-muted hover:text-danger disabled:opacity-50"
                  >
                    ✕
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <button
        type="button"
        onClick={() => setPopup({ kind: "delete" })}
        disabled={busy}
        className="min-h-12 w-full rounded-xl border-2 border-danger px-5 text-sm font-semibold text-danger hover:bg-danger hover:text-bg disabled:opacity-50"
      >
        Delete slip
      </button>

      <ChoiceDialog
        open={popup?.kind === "delete"}
        title="Delete this slip?"
        message={`"${slip.name}" and its ${pickCount(slip.picks.length)} will be deleted. This can't be undone.`}
        stayLabel="Cancel"
        actLabel="Delete slip"
        danger
        onStay={() => setPopup(null)}
        onAct={onDelete}
        onDismiss={() => setPopup(null)}
      />
      <ChoiceDialog
        open={popup?.kind === "last-pick"}
        title="Delete this slip?"
        message={`That's the last pick on "${slip.name}".`}
        note="Delete the whole slip, or keep it (empty)?"
        stayLabel="Keep slip"
        actLabel="Delete slip"
        danger
        onStay={keepEmpty}
        onAct={onDelete}
        onDismiss={() => setPopup(null)}
      />
    </div>
  );
}
