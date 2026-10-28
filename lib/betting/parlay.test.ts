/*
  FILE: lib/betting/parlay.test.ts
  WHAT IT'S FOR: Automatic tests for the betting math in parlay.ts: what counts
  as real American odds, converting odds to decimal and back, combining odds for
  a parlay, and deciding whether a slip is a Straight, Parlay, or SGP.
  These are UNIT tests: each one runs a small piece of code with known inputs
  and checks the answer. No database or website is involved, so they run instantly.
  The expected numbers are worked out by hand (see the examples in parlay.ts).
  WHO USES IT: Vitest, when you run `npm test`.
  WHY THIS NAME: It tests parlay.ts, so it's parlay.test.ts, right next to it.
  Vitest finds every file ending in .test.ts. It ends in .ts because it shows nothing on screen.
*/

import { describe, expect, it } from "vitest";
import {
  americanToDecimal,
  combineParlayOdds,
  decimalToAmerican,
  getBetSlipType,
  getSlipPricing,
  isValidAmericanOdds,
} from "./parlay";

describe("isValidAmericanOdds", () => {
  it("accepts real odds: +100 or more, or -100 or less, as whole numbers", () => {
    for (const odds of [100, 150, -100, -110, -10000, 25000]) {
      expect(isValidAmericanOdds(odds)).toBe(true);
    }
  });

  it("refuses numbers that aren't real odds", () => {
    for (const odds of [0, 50, -50, 99, -99, 1.5, -110.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(isValidAmericanOdds(odds)).toBe(false);
    }
  });
});

describe("americanToDecimal", () => {
  it("-110 returns about $1.91 for every $1 (risk 110 to win 100)", () => {
    expect(americanToDecimal(-110)).toBeCloseTo(1.9091, 4);
  });

  it("+150 returns $2.50 for every $1", () => {
    expect(americanToDecimal(150)).toBe(2.5);
  });

  it("even money is 2.0 whether written +100 or -100", () => {
    expect(americanToDecimal(100)).toBe(2);
    expect(americanToDecimal(-100)).toBe(2);
  });

  it("throws on odds that aren't real", () => {
    expect(() => americanToDecimal(50)).toThrow(RangeError);
  });
});

describe("decimalToAmerican", () => {
  it("turns decimal odds of 2 or more into positive odds", () => {
    expect(decimalToAmerican(2.5)).toBe(150);
    expect(decimalToAmerican(4.7727)).toBe(377);
  });

  it("turns decimal odds under 2 into negative odds", () => {
    expect(decimalToAmerican(1.5)).toBe(-200);
    expect(decimalToAmerican(1.9091)).toBe(-110);
  });

  it("round-trips: odds → decimal → odds comes back the same", () => {
    for (const odds of [-110, -250, 105, 150, 400]) {
      expect(decimalToAmerican(americanToDecimal(odds))).toBe(odds);
    }
  });

  it("throws on decimal odds that can't exist (1 or less, or not a number)", () => {
    expect(() => decimalToAmerican(1)).toThrow(RangeError);
    expect(() => decimalToAmerican(0.5)).toThrow(RangeError);
    expect(() => decimalToAmerican(Number.NaN)).toThrow(RangeError);
  });
});

describe("combineParlayOdds", () => {
  it("an empty slip has no odds (null)", () => {
    expect(combineParlayOdds([])).toBeNull();
  });

  it("one pick keeps its own odds", () => {
    expect(combineParlayOdds([-110])).toBe(-110);
    expect(combineParlayOdds([250])).toBe(250);
  });

  it("the worked example: -110 and +150 combine to +377", () => {
    expect(combineParlayOdds([-110, 150])).toBe(377);
  });

  it("the classic 3-team parlay: three -110 picks combine to +596", () => {
    expect(combineParlayOdds([-110, -110, -110])).toBe(596);
  });

  it("two even-money picks combine to +300", () => {
    expect(combineParlayOdds([100, 100])).toBe(300);
  });

  it("two heavy favorites can combine to positive OR negative odds", () => {
    // Two -200 picks: 1.5 × 1.5 = 2.25. That's 2 or more, so the result is positive: +125.
    expect(combineParlayOdds([-200, -200])).toBe(125);
    // Two -500 picks: 1.2 × 1.2 = 1.44. That's under 2, so the result stays negative: -227.
    expect(combineParlayOdds([-500, -500])).toBe(-227);
  });

  it("the order of the picks doesn't matter", () => {
    expect(combineParlayOdds([150, -110, 200])).toBe(combineParlayOdds([200, 150, -110]));
  });

  it("throws if any pick has odds that aren't real", () => {
    expect(() => combineParlayOdds([-110, 50])).toThrow(RangeError);
  });
});

describe("getBetSlipType", () => {
  it("0 or 1 pick is Straight", () => {
    expect(getBetSlipType([])).toBe("straight");
    expect(getBetSlipType([{ gameId: "1" }])).toBe("straight");
  });

  it("2 or more picks from one game is an SGP", () => {
    expect(getBetSlipType([{ gameId: "1" }, { gameId: "1" }])).toBe("sgp");
    expect(getBetSlipType([{ gameId: "1" }, { gameId: "1" }, { gameId: "1" }])).toBe("sgp");
  });

  it("2 or more picks from different games is a Parlay", () => {
    expect(getBetSlipType([{ gameId: "1" }, { gameId: "2" }])).toBe("parlay");
  });

  it("a slip that mixes games is a Parlay even if two picks share a game", () => {
    expect(getBetSlipType([{ gameId: "1" }, { gameId: "1" }, { gameId: "2" }])).toBe("parlay");
  });
});

describe("getSlipPricing", () => {
  it("Straight: keeps the pick's odds, not estimated", () => {
    expect(getSlipPricing([{ gameId: "1", odds: -110 }])).toEqual({
      type: "straight",
      combinedOdds: -110,
      oddsAreEstimated: false,
    });
  });

  it("Parlay: combined odds, not estimated", () => {
    expect(
      getSlipPricing([
        { gameId: "1", odds: -110 },
        { gameId: "2", odds: 150 },
      ]),
    ).toEqual({ type: "parlay", combinedOdds: 377, oddsAreEstimated: false });
  });

  it("SGP: combined odds, flagged as estimated (real SGP prices are lower)", () => {
    expect(
      getSlipPricing([
        { gameId: "1", odds: -110 },
        { gameId: "1", odds: 150 },
      ]),
    ).toEqual({ type: "sgp", combinedOdds: 377, oddsAreEstimated: true });
  });

  it("Empty slip: no odds", () => {
    expect(getSlipPricing([])).toEqual({ type: "straight", combinedOdds: null, oddsAreEstimated: false });
  });
});
