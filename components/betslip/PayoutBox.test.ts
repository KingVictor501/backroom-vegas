/*
  FILE: components/betslip/PayoutBox.test.ts
  WHAT IT'S FOR: Automatic tests for the wager box (PayoutBox.tsx). They draw the box as plain
  HTML (with React's built-in server renderer, no browser needed) and check what it says:
  - the saved wager is in the box, and the profit and total return match the hand-checked numbers
  - the sportsbook the odds came from is named, and a slip that mixes books says so
  - SGPs say "Estimated" and that real prices are usually lower
  - an empty slip shows nothing
  The typing behavior (the payout changing as you type, the red message for a bad wager) comes
  from parseWager and estimatePayout, which lib/betting/payout.test.ts checks in detail.
  WHO USES IT: Vitest, when you run `npm test`.
  WHY THIS NAME: It tests PayoutBox.tsx, so it's PayoutBox.test.ts right next to it. It ends in
  .ts (not .tsx) because it only builds the box with createElement and shows nothing itself.
*/

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { BetPick } from "@/types";
import { makePick } from "../../tests/support/factories";
import PayoutBox from "./PayoutBox";

/* draw: the box as HTML text. */
function draw(picks: BetPick[], type: "straight" | "parlay" | "sgp", wager: number): string {
  return renderToStaticMarkup(createElement(PayoutBox, { picks, type, wager, onSave: () => undefined }));
}

describe("PayoutBox", () => {
  it("shows the wager, profit, total return, and sportsbook for a straight bet", () => {
    const html = draw([makePick({ odds: -110 })], "straight", 10);
    expect(html).toContain('value="10"');
    expect(html).toContain("Wager amount");
    expect(html).toContain("$9.09");
    expect(html).toContain("$19.09");
    expect(html).toContain("Odds from Hard Rock Bet.");
    expect(html).not.toContain("Estimated");
  });

  it("multiplies a parlay's odds together", () => {
    const html = draw([makePick({ odds: -110 }), makePick({ odds: 150, gameId: "2", id: "2|h2h|1|home|null" })], "parlay", 10);
    expect(html).toContain("$37.73");
    expect(html).toContain("$47.73");
  });

  it("labels an SGP payout Estimated and says real prices are lower", () => {
    const html = draw([makePick({ odds: -110 }), makePick({ odds: -115, id: "1|totals|g|over|47.5" })], "sgp", 20);
    expect(html).toContain("Estimated profit");
    expect(html).toContain("$51.38");
    expect(html).toContain("$71.38");
    expect(html).toContain("Real SGP prices are usually lower.");
  });

  it("says when a slip mixes sportsbooks, and names them", () => {
    const html = draw(
      [makePick({ odds: -110, sportsbook: "hardrock" }), makePick({ odds: 150, sportsbook: "betmgm", gameId: "2", id: "2|h2h|1|home|null" })],
      "parlay",
      10,
    );
    expect(html).toContain("This slip mixes sportsbooks: Hard Rock Bet and BetMGM.");
  });

  it("formats big payouts with commas", () => {
    const html = draw([makePick({ odds: 500 })], "straight", 10000);
    expect(html).toContain("$50,000.00");
    expect(html).toContain("$60,000.00");
  });

  it("shows nothing for a slip with no picks", () => {
    expect(draw([], "straight", 10)).toBe("");
  });
});
