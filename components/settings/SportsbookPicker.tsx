/*
  FILE: components/settings/SportsbookPicker.tsx
  WHAT IT'S FOR: The three big sportsbook cards on Settings (Hard Rock Bet,
  BetMGM, Caesars). Tap one and it gets a gold outline and is saved to your
  account right away by the saveSportsbook Server Action. Each card also says
  how many of this week's games that book has odds for, so you can see if a
  book has nothing posted yet.
  It's a real form with radio buttons, so it works with a keyboard (arrow keys
  move between the cards) and screen readers read it as "Sportsbook, 1 of 3".
  With JavaScript off, a Save button appears instead of saving on tap.
  WHO USES IT: app/(main)/settings/page.tsx.
  WHY THIS NAME: It picks the sportsbook. It ends in .tsx because it shows something on screen.
*/

// "use client": the cards save as soon as you tap one, and show "Saving…".
"use client";

import { useActionState, useRef } from "react";
// The Server Action from app/actions/settings.ts. It runs on the server even though this form is in the browser.
import { saveSportsbook, type SettingsFormState } from "@/app/actions/settings";
// The red error box from components/ErrorMessage.tsx.
import ErrorMessage from "@/components/ErrorMessage";
// The sportsbook names, from config/sportsbooks.ts.
import { SPORTSBOOKS } from "@/config/sportsbooks";
import { SPORTSBOOK_IDS, type SportsbookId } from "@/types";

/*
  SportsbookPicker
  - current: the book saved on the account right now
  - gameCounts: for each book, how many upcoming games it has odds for, or
    null if that couldn't be checked (missing on purpose: the card just leaves it out)
  - totalGames: how many upcoming games there are
*/
export default function SportsbookPicker({
  current,
  gameCounts,
  totalGames,
}: {
  current: SportsbookId;
  gameCounts: Record<SportsbookId, number> | null;
  totalGames: number;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<SettingsFormState, FormData>(saveSportsbook, {
    status: "idle",
    message: "",
    sportsbook: current,
  });
  // Show the newest choice: the one just saved, or the one on the account.
  const chosen = state.sportsbook ?? current;

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <fieldset disabled={pending}>
        <legend className="mb-3 text-sm text-muted">Choose the sportsbook whose odds you want to see everywhere.</legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {SPORTSBOOK_IDS.map((id) => {
            const isChosen = id === chosen;
            const count = gameCounts?.[id];
            return (
              // The label makes the whole card clickable, and the hidden radio button inside does the choosing.
              <label
                key={id}
                className={`relative flex min-h-28 cursor-pointer flex-col justify-between rounded-2xl border-2 bg-card p-5 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-gold/60 ${
                  isChosen ? "border-gold" : "border-line hover:border-muted"
                }`}
              >
                <input
                  type="radio"
                  name="sportsbook"
                  value={id}
                  defaultChecked={isChosen}
                  // Saving happens as soon as you pick a card (requestSubmit sends the form to the Server Action).
                  onChange={() => formRef.current?.requestSubmit()}
                  className="sr-only"
                />
                <span className="font-display text-2xl text-text">{SPORTSBOOKS[id].name}</span>
                <span className="mt-3 flex items-center justify-between gap-2 text-xs">
                  <span className={count === 0 ? "font-semibold text-danger" : "text-muted"}>
                    {count === undefined ? "" : count === 0 ? "No odds posted right now" : `Odds on ${count} of ${totalGames} games`}
                  </span>
                  {isChosen && <span className="rounded-full bg-gold px-2.5 py-0.5 font-semibold text-bg">{pending ? "Saving…" : "✓ Selected"}</span>}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {/* Without JavaScript the cards can't save on tap, so a Save button shows instead. */}
      <noscript>
        <button type="submit" className="min-h-11 rounded-xl bg-gold px-5 text-sm font-semibold text-bg">
          Save sportsbook
        </button>
      </noscript>

      {/* aria-live: screen readers hear "Saved. Odds now come from BetMGM." */}
      <div aria-live="polite">
        {state.status === "saved" && <p className="text-sm font-medium text-gold">{state.message}</p>}
        {state.status === "error" && <ErrorMessage alert={false}>{state.message}</ErrorMessage>}
      </div>
    </form>
  );
}
