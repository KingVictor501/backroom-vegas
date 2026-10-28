/*
  FILE: components/betslip/PayoutBox.tsx
  WHAT IT'S FOR: The "Wager amount" box and the estimated payout under it. It shows up in three
  places, so they all look and act the same:
  - the slip's own page (components/betslips/SlipDetail.tsx)
  - the slip bar on phones and tablets (components/betslip/SlipBar.tsx)
  - the slip panel on desktop (components/betslip/SlipPanel.tsx)
  How it works:
  - You type a pretend wager. The payout changes AS YOU TYPE (no waiting for the server).
  - The wager is saved when you click out of the box or press Enter, but only if it's a good
    number ($0.01 to $10,000, up to 2 decimals). A bad one turns the box red with a loud red message,
    and nothing is saved. The server checks the number again, because the browser can be bypassed.
  - It shows the profit, the total return (wager + profit), and which sportsbook the odds came from.
    If the picks came from different books, it says the slip mixes books.
  - For SGPs it says "Estimated", because real sportsbooks pay less for same game parlays.
  - It's a pretend amount for reference only: nobody spends real money in this app.
  WHO USES IT: the three files above.
  WHY THIS NAME: It's the box about payouts. It ends in .tsx because it shows something on screen.
*/
"use client";

import { useId, useState, type FormEvent } from "react";
// The red error line from components/ErrorMessage.tsx (invalid inputs also turn red).
import { FieldError } from "@/components/ErrorMessage";
// The payout math and the wager box's rules, from lib/betting/payout.ts.
import { estimatePayout, formatMoney, parseWager } from "@/lib/betting/payout";
// Sportsbook names from config/sportsbooks.ts.
import { SPORTSBOOKS } from "@/config/sportsbooks";
import type { BetPick, BetSlipType } from "@/types";

/*
  PayoutBox props:
  - picks / type: what the slip holds right now
  - wager: the SAVED wager (from the server)
  - onSave: saves a new wager. It may throw with a message, which is shown in red.
  - compact: a tighter layout for the slip bar
*/
type PayoutBoxProps = {
  picks: readonly BetPick[];
  type: BetSlipType;
  wager: number;
  onSave: (wager: number) => Promise<void> | void;
  compact?: boolean;
};

/* sportsbookNames: "Hard Rock Bet", or "Hard Rock Bet and BetMGM", or "A, B, and C". */
function sportsbookNames(ids: readonly (keyof typeof SPORTSBOOKS)[]): string {
  const names = ids.map((id) => SPORTSBOOKS[id].name);
  if (names.length <= 2) return names.join(" and ");
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

/* PayoutBox: see the top of this file. Renders nothing when the slip has no picks. */
export default function PayoutBox({ picks, type, wager, onSave, compact = false }: PayoutBoxProps) {
  const inputId = useId();
  const errorId = useId();
  const [text, setText] = useState(String(wager));
  const [error, setError] = useState<string | null>(null);
  // When the saved wager changes from outside (another slip opened, or a failed save was undone), show it.
  const [shownWager, setShownWager] = useState(wager);
  if (wager !== shownWager) {
    setShownWager(wager);
    setText(String(wager));
    setError(null);
  }

  if (picks.length === 0) return null;

  // What was typed, if it's allowed. The payout uses it right away; otherwise the saved wager.
  const typed = parseWager(text);
  const liveWager = typed.ok ? typed.wager : wager;
  const payout = estimatePayout(picks, liveWager, type);

  /* save: runs when you click out of the box or press Enter. */
  async function save(event?: FormEvent) {
    event?.preventDefault();
    const result = parseWager(text);
    if (!result.ok) return setError(result.message);
    setError(null);
    // Show the tidy number (so "$25.50" becomes 25.5), and skip the request if nothing changed.
    setText(String(result.wager));
    if (result.wager === wager) return;
    try {
      await onSave(result.wager);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "The wager didn't save. Please try again.");
    }
  }

  return (
    <form onSubmit={save} className={compact ? "mt-2 border-t border-line pt-2" : "space-y-3"} noValidate>
      <div className={`flex items-center gap-3 ${compact ? "flex-wrap" : ""}`}>
        <label htmlFor={inputId} className={compact ? "text-xs text-muted" : "text-sm font-semibold text-text"}>
          Wager amount
        </label>
        <div className="relative">
          <span
            aria-hidden
            className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted ${compact ? "text-sm" : "text-xl"}`}
          >
            $
          </span>
          <input
            id={inputId}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={text}
            onChange={(event) => setText(event.target.value)}
            onBlur={() => void save()}
            aria-invalid={error !== null}
            aria-describedby={error ? errorId : undefined}
            className={`min-h-11 rounded-xl border-2 bg-card-raised py-1 pr-3 text-right tabular-nums text-text ${
              compact ? "w-28 pl-7 text-sm" : "w-40 pl-9 text-xl font-semibold"
            } ${error ? "border-danger bg-danger/15" : "border-line focus:border-gold"}`}
          />
        </div>
      </div>
      {error && <FieldError id={errorId}>{error}</FieldError>}

      {payout && (
        <div className={compact ? "mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-0.5" : "space-y-1 rounded-xl border border-line bg-card-raised p-4"}>
          <p className={compact ? "text-xs text-muted" : "text-sm text-muted"}>
            {payout.isEstimate ? "Estimated profit" : "Profit"}{" "}
            <span className="font-semibold tabular-nums text-gold">{formatMoney(payout.profit)}</span>
          </p>
          <p className={compact ? "text-xs text-muted" : "text-sm text-muted"}>
            {payout.isEstimate ? "Estimated total return" : "Total return"}{" "}
            <span className={`font-semibold tabular-nums text-gold ${compact ? "" : "text-lg"}`}>{formatMoney(payout.totalReturn)}</span>
          </p>
          <p className="text-xs text-muted" data-testid="payout-source">
            {payout.sportsbooks.length === 1
              ? `Odds from ${sportsbookNames(payout.sportsbooks)}.`
              : `This slip mixes sportsbooks: ${sportsbookNames(payout.sportsbooks)}.`}
            {payout.isEstimate && " Real SGP prices are usually lower."}
          </p>
        </div>
      )}
    </form>
  );
}
