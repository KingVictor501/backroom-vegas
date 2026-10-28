/*
  FILE: lib/betting/payout.test.ts
  WHAT IT'S FOR: Automatic tests for the payout math (lib/betting/payout.ts) using real example
  numbers whose answers were worked out separately with exact decimal arithmetic:
  straight bets, parlays, and SGPs, rounding to the cent, mixed sportsbooks, and the wager box's
  rules (what's allowed, what's refused and why).
  WHO USES IT: Vitest, when you run `npm test`.
  WHY THIS NAME: It tests payout.ts, so it's payout.test.ts right next to it. It ends in .ts
  because it shows nothing on screen.
*/

import { describe, expect, it } from "vitest";
import { estimatePayout, formatMoney, parseWager } from "./payout";

const hr = (odds: number) => ({ odds, sportsbook: "hardrock" as const });

describe("estimatePayout: straight bets", () => {
  it("$10 at -110 wins $9.09 (returns $19.09)", () => {
    expect(estimatePayout([hr(-110)], 10, "straight")).toMatchObject({ profit: 9.09, totalReturn: 19.09, isEstimate: false });
  });
  it("$10 at +150 wins $15 (returns $25)", () => {
    expect(estimatePayout([hr(150)], 10, "straight")).toMatchObject({ profit: 15, totalReturn: 25 });
  });
  it("$50 at -200 wins $25 (returns $75)", () => {
    expect(estimatePayout([hr(-200)], 50, "straight")).toMatchObject({ profit: 25, totalReturn: 75 });
  });
  it("even money +100 on $33.33 wins $33.33", () => {
    expect(estimatePayout([hr(100)], 33.33, "straight")).toMatchObject({ profit: 33.33, totalReturn: 66.66 });
  });
  it("the smallest wager, one cent, wins one cent at -110 (rounded)", () => {
    expect(estimatePayout([hr(-110)], 0.01, "straight")).toMatchObject({ profit: 0.01, totalReturn: 0.02 });
  });
});

describe("estimatePayout: parlays", () => {
  it("$10 on -110 and +150 wins $37.73 (returns $47.73)", () => {
    expect(estimatePayout([hr(-110), hr(150)], 10, "parlay")).toMatchObject({ profit: 37.73, totalReturn: 47.73, isEstimate: false });
  });
  it("the classic 3-team -110 parlay: $10 wins $59.58, $100 wins $595.79", () => {
    const picks = [hr(-110), hr(-110), hr(-110)];
    expect(estimatePayout(picks, 10, "parlay")).toMatchObject({ profit: 59.58, totalReturn: 69.58 });
    expect(estimatePayout(picks, 100, "parlay")).toMatchObject({ profit: 595.79, totalReturn: 695.79 });
  });
  it("a 4-pick mix at $5 wins $128.64", () => {
    expect(estimatePayout([hr(-110), hr(150), hr(-250), hr(300)], 5, "parlay")).toMatchObject({ profit: 128.64, totalReturn: 133.64 });
  });
});

describe("estimatePayout: same game parlays (SGP)", () => {
  it("$20 on -110 and -115 wins $51.38, and is labeled an estimate", () => {
    expect(estimatePayout([hr(-110), hr(-115)], 20, "sgp")).toMatchObject({ profit: 51.38, totalReturn: 71.38, isEstimate: true });
  });
  it("$25 on +200 and +250 wins $237.50 (returns $262.50)", () => {
    expect(estimatePayout([hr(200), hr(250)], 25, "sgp")).toMatchObject({ profit: 237.5, totalReturn: 262.5, isEstimate: true });
  });
});

describe("estimatePayout: sportsbooks and empty slips", () => {
  it("lists one book once, however many picks came from it", () => {
    expect(estimatePayout([hr(-110), hr(-120)], 10, "parlay")?.sportsbooks).toEqual(["hardrock"]);
  });
  it("lists every book on a mixed slip, in the order first seen", () => {
    const picks = [{ odds: -110, sportsbook: "betmgm" as const }, hr(150), { odds: -105, sportsbook: "betmgm" as const }];
    expect(estimatePayout(picks, 10, "parlay")?.sportsbooks).toEqual(["betmgm", "hardrock"]);
  });
  it("is null for a slip with no picks (nothing to pay)", () => {
    expect(estimatePayout([], 10, "straight")).toBeNull();
  });
  it("refuses fake odds instead of giving a wrong number", () => {
    expect(() => estimatePayout([hr(50)], 10, "straight")).toThrow(RangeError);
  });
});

describe("parseWager", () => {
  it.each([
    ["10", 10],
    ["25.5", 25.5],
    ["$25.50", 25.5],
    ["1,000", 1000],
    [" 7 ", 7],
    ["0.01", 0.01],
    [".5", 0.5],
    ["10000", 10000],
  ])("accepts %j as %d", (typed, expected) => {
    expect(parseWager(typed)).toEqual({ ok: true, wager: expected });
  });

  it.each([
    ["", "Enter a wager amount."],
    ["abc", "The wager must be a number like 10 or 25.50."],
    ["-5", "The wager must be a number like 10 or 25.50."],
    ["1e3", "The wager must be a number like 10 or 25.50."],
    ["Infinity", "The wager must be a number like 10 or 25.50."],
    ["10.255", "The wager can have at most 2 decimal places."],
    ["0", "The wager must be at least $0.01."],
    ["0.00", "The wager must be at least $0.01."],
    ["10000.01", "The wager can be at most $10,000.00."],
    ["99999999999999999999", "The wager can be at most $10,000.00."],
  ])("refuses %j with a clear reason", (typed, message) => {
    expect(parseWager(typed)).toEqual({ ok: false, message });
  });
});

describe("formatMoney", () => {
  it("shows dollars, cents, and commas", () => {
    expect(formatMoney(1234.5)).toBe("$1,234.50");
    expect(formatMoney(9.09)).toBe("$9.09");
  });
});
