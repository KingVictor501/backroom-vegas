/*
  FILE: components/betslips/SlipDetail.tsx
  WHAT IT'S FOR: Everything you can DO on one slip's page:
  - rename it (1 to 50 characters; a name you already used is refused, in red)
  - see every pick, with its live score and a Winning / Losing / Push badge once its game starts (Won / Lost when final)
  - remove picks (removing the last one asks "Delete this slip?", like the slip bar)
  - set it as your active slip (the one your taps add to)
  - change the pretend wager and see the estimated payout (profit, total return, sportsbook)
  - change the pretend wager and see the estimated payout (profit, total return, sportsbook)
  - copy it: a new slip named "Copy of ..." with picks for games that haven't started, refreshed to the
    current price from your sportsbook (the copy then shows which picks were skipped and which odds changed)
  - delete it, after an "Are you sure?" popup
  Each change goes to the bet slip API, and the slip bar updates to match.
  WHO USES IT: app/(main)/betslips/[id]/page.tsx, which loads the slip on the server.
  WHY THIS NAME: It's the slip's detail view. It ends in .tsx because it shows something on screen.
*/

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState, type FormEvent } from "react";
// The bet slip provider (slip bar) and the shared popup, from components/betslip.
import { useBetSlip } from "@/components/betslip/BetSlipProvider";
import ChoiceDialog from "@/components/betslip/ChoiceDialog";
// The red error styles, from components/ErrorMessage.tsx.
import ErrorMessage, { FieldError } from "@/components/ErrorMessage";
// matchupHref (lib/leagues/links.ts): the matchup address, with ?league= for leagues other than the NFL.
import { matchupHref } from "@/lib/leagues/links";
// Live scores: the refresh hook, a pick's Winning/Losing badge, and the "Scores delayed" note, from components/live.
import PickGradeBadge from "@/components/live/PickGradeBadge";
import ScoresDelayed from "@/components/live/ScoresDelayed";
import { useLiveScores, type WatchedGame } from "@/components/live/useLiveScores";
// gradePick (is a pick winning or losing?) from lib/betting/grading.ts; getLeague (how many periods a game has) from config/leagues.ts.
import { gradePick } from "@/lib/betting/grading";
import { getLeague } from "@/config/leagues";
// The wager box and estimated payout, shared with the slip bar and the desktop panel.
import PayoutBox from "@/components/betslip/PayoutBox";
// The sentences shown after a slip is copied (shared with the slip list).
import { copyAnnouncement, pickRefreshText, refreshSummary, skippedHeading } from "@/lib/betting/copyMessages";
// Odds and type words, and the day/time words.
import { formatOdds, pickCount, SLIP_TYPE_LABELS } from "@/lib/betting/picks";
import { gameDayLabel, gameTimeLabel } from "@/lib/format/gameTime";
// The browser's requests to our bet slip API, from lib/betting/slipRequests.ts.
import { copySlip, deleteSlip, renameSlip, saveSlipPicks, saveSlipWager, setActiveSlip, SlipRequestError } from "@/lib/betting/slipRequests";
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
  // True while a copy is being made (it can take a few seconds, because it looks up current odds).
  const [copying, setCopying] = useState(false);
  // Which popup is open: "delete" (Delete button), "last-pick" (removing the last pick, with the pick's ID), or none.
  const [popup, setPopup] = useState<{ kind: "delete" } | { kind: "last-pick"; pickId: string } | null>(null);
  const nameId = useId();

  // Live scores for the games on this slip. Player props also need the live box score.
  const needsBoxScore = slip.picks.some((pick) => pick.marketCategory === "player-props");
  const watched = useMemo<WatchedGame[]>(() => {
    const seen = new Map<string, WatchedGame>();
    for (const pick of slip.picks) seen.set(pick.gameId, { id: pick.gameId, league: pick.league, startsAt: pick.gameStartsAt, status: "scheduled" });
    return [...seen.values()];
  }, [slip.picks]);
  const { live, delayed } = useLiveScores(watched, needsBoxScore);
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

  /* onSaveWager: saves the pretend wager. A failure is thrown back to the wager box, which shows it in red. */
  async function onSaveWager(wager: number) {
    afterSave(await saveSlipWager(slip.id, wager));
  }

  /*
    onCopy: makes the copy on the server, makes it the active slip, and opens it, so its notes
    (skipped picks, changed odds) are the first thing you see.
  */
  function onCopy() {
    setCopying(true);
    void run(async () => {
      try {
        const copy = await copySlip(slip.id);
        replaceActiveSlip(copy);
        announce(copyAnnouncement(copy));
        router.push(`/betslips/${copy.id}`);
        router.refresh();
      } finally {
        setCopying(false);
      }
    });
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

        <PayoutBox picks={slip.picks} type={slip.type} wager={slip.wager} onSave={onSaveWager} />
        <div className="flex flex-wrap items-center gap-3">
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
          <button
            type="button"
            onClick={onCopy}
            disabled={busy}
            className="min-h-11 rounded-xl border border-gold px-4 text-sm font-semibold text-gold hover:bg-gold hover:text-bg disabled:cursor-wait disabled:opacity-50"
          >
            {copying ? "Copying…" : "Copy slip"}
          </button>
        </div>
      </section>

      {/* Only on a copied slip: where it came from, how the prices were refreshed, and which picks were left out. */}
      {slip.copiedFrom && (
        <section aria-labelledby="copy-heading" className="space-y-3 rounded-2xl border border-gold/40 bg-card p-5">
          <h2 id="copy-heading" className="text-xl text-text">
            Copied from &ldquo;{slip.copiedFrom.fromName}&rdquo;
          </h2>
          <p className="text-sm text-muted">
            Prices were refreshed from {SPORTSBOOKS[slip.copiedFrom.sportsbook].name}.
            {refreshSummary(slip.picks) && <> {refreshSummary(slip.picks)}.</>}
          </p>
          {slip.copiedFrom.skipped.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-text">
                {skippedHeading(slip.copiedFrom.skipped.length)} because {slip.copiedFrom.skipped.length === 1 ? "its game" : "their games"} already started or finished:
              </p>
              <ul className="mt-2 space-y-1 text-sm text-muted">
                {slip.copiedFrom.skipped.map((skipped, index) => (
                  <li key={`${skipped.label}-${index}`} className="break-words">
                    <span className="text-text">{skipped.label}</span> ({skipped.gameLabel}): {skipped.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* The picks. */}
      <section aria-labelledby="picks-heading" className="rounded-2xl border border-line bg-card p-5">
        <h2 id="picks-heading" className="text-xl text-text">
          Picks
        </h2>
        <div className="mt-1">
          <ScoresDelayed show={delayed} />
        </div>
        {slip.picks.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            No picks yet. {isActive ? "Tap any odds to add one." : "Set this as your active slip, then tap any odds to add picks."}
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {slip.picks.map((pick) => {
              const started = Date.parse(pick.gameStartsAt) <= now;
              const liveGame = live.get(pick.gameId);
              // How many periods a regulation game has depends on the pick's league (4 quarters in both the NFL and NBA).
              const grade = gradePick(pick, liveGame ?? null, getLeague(pick.league)?.periods?.regulation ?? 4, now);
              // "KC @ SEA" → "KC" and "SEA", to write the score as "KC 24 – SEA 20".
              const [awayName, homeName] = pick.gameLabel.split(" @ ");
              return (
                <li key={pick.id} className="flex items-start gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-text">{pick.label}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {pick.marketLabel} ·{" "}
                      <Link href={matchupHref(pick.gameId, pick.league)} className="hover:text-gold">
                        {pick.gameLabel}
                      </Link>{" "}
                      · {SPORTSBOOKS[pick.sportsbook].name}
                    </p>
                    {(() => {
                      // Only picks that came from a copy have a price-check note.
                      const note = pickRefreshText(pick);
                      if (!note) return null;
                      return (
                        <p
                          className={`mt-1 text-xs ${
                            note.tone === "changed" ? "font-semibold text-gold" : note.tone === "warning" ? "font-semibold text-gold" : "text-muted"
                          }`}
                        >
                          {note.tone === "warning" ? "⚠ " : note.tone === "changed" ? "↻ " : ""}
                          {note.text}
                        </p>
                      );
                    })()}
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                      {started || liveGame?.status === "in-progress" || liveGame?.status === "final" ? (
                        <>
                          <PickGradeBadge grade={grade} />
                          {liveGame && liveGame.status !== "scheduled" && (
                            <span className="text-muted">
                              <span className="font-semibold tabular-nums text-text">
                                {awayName} {liveGame.awayScore ?? 0} – {homeName} {liveGame.homeScore ?? 0}
                              </span>{" "}
                              · {liveGame.label}
                            </span>
                          )}
                          {!liveGame && <span className="text-muted">Started</span>}
                        </>
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
