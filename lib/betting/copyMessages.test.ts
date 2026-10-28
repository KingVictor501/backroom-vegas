/*
  FILE: lib/betting/copyMessages.test.ts
  WHAT IT'S FOR: Automatic tests for the sentences shown after a slip is copied
  (lib/betting/copyMessages.ts): the pop-up message, the summary line of counts, and the
  note under each pick ("Odds changed: was -110, now -115"). Wrong wording here would
  mislead the user about their prices, so it is checked with real example numbers.
  WHO USES IT: Vitest, when you run `npm test`.
  WHY THIS NAME: It tests copyMessages.ts, so it's copyMessages.test.ts right next to it. It ends
  in .ts because it shows nothing on screen.
*/

import { describe, expect, it } from "vitest";
import { copyAnnouncement, pickRefreshText, refreshSummary, skippedHeading } from "./copyMessages";
import type { BetPick, BetSlip, PickRefresh } from "@/types";
import { makePick } from "../../tests/support/factories";

/* withRefresh: a pick carrying a price-check note. */
function withRefresh(refresh: PickRefresh, changes: Partial<BetPick> = {}): BetPick {
  return { ...makePick(changes), refresh };
}

const OLD = { previousOdds: -110, previousLine: -3, previousSportsbook: "hardrock" } as const;

describe("copyAnnouncement", () => {
  const slip = (skipped: number) =>
    ({
      name: "Copy of Sunday Parlay",
      copiedFrom: { fromName: "Sunday Parlay", sportsbook: "hardrock", copiedAt: "", skipped: Array.from({ length: skipped }, () => ({ label: "x", gameLabel: "y", reason: "z" })) },
    }) as BetSlip;

  it("says only what was made when nothing was skipped", () => {
    expect(copyAnnouncement(slip(0))).toBe('Copied to "Copy of Sunday Parlay".');
  });

  it("says how many were skipped, and why (singular and plural)", () => {
    expect(copyAnnouncement(slip(1))).toBe('Copied to "Copy of Sunday Parlay". 1 pick was skipped because its game already started or finished.');
    expect(copyAnnouncement(slip(3))).toBe('Copied to "Copy of Sunday Parlay". 3 picks were skipped because their games already started or finished.');
  });
});

describe("skippedHeading", () => {
  it("uses 'was' for one and 'were' for more", () => {
    expect(skippedHeading(1)).toBe("1 pick was not copied");
    expect(skippedHeading(2)).toBe("2 picks were not copied");
  });
});

describe("refreshSummary", () => {
  it("counts each result, in a fixed order, leaving out zeros", () => {
    const picks = [
      withRefresh({ status: "updated", ...OLD }),
      withRefresh({ status: "updated", ...OLD }, { gameId: "2" }),
      withRefresh({ status: "unchanged", ...OLD }, { gameId: "3" }),
      withRefresh({ status: "no-odds", ...OLD }, { gameId: "4" }),
    ];
    expect(refreshSummary(picks)).toBe("2 prices updated · 1 unchanged · 1 with no odds from your sportsbook");
  });

  it("is empty for picks that weren't copied", () => {
    expect(refreshSummary([makePick()])).toBe("");
    expect(refreshSummary([])).toBe("");
  });

  it("says 'couldn't be checked' for picks the lookup missed", () => {
    expect(refreshSummary([withRefresh({ status: "not-checked", ...OLD })])).toBe("1 couldn't be checked");
  });
});

describe("pickRefreshText", () => {
  it("says nothing for a pick that wasn't copied", () => {
    expect(pickRefreshText(makePick())).toBeNull();
  });

  it("shows the old and new price", () => {
    const pick = withRefresh({ status: "updated", ...OLD }, { odds: -125 });
    expect(pickRefreshText(pick)).toEqual({ tone: "changed", text: "Odds changed: was -110, now -125" });
  });

  it("formats positive prices with a plus sign", () => {
    const pick = withRefresh({ status: "updated", ...OLD, previousOdds: 150 }, { odds: 140 });
    expect(pickRefreshText(pick)?.text).toBe("Odds changed: was +150, now +140");
  });

  it("shows a moved spread line with its signs, and the price change too", () => {
    const pick = withRefresh({ status: "updated", ...OLD }, { line: -3.5, odds: -105 });
    expect(pickRefreshText(pick)?.text).toBe("Odds changed: was -110, now -105. Line moved: was -3, now -3.5");
  });

  it("shows a moved total or prop line as a plain number", () => {
    const pick = withRefresh(
      { status: "updated", previousOdds: -110, previousLine: 47.5, previousSportsbook: "hardrock" },
      { side: "over", line: 48.5, odds: -110 },
    );
    expect(pickRefreshText(pick)?.text).toBe("Line moved: was 47.5, now 48.5");
  });

  it("says 'Odds unchanged' when nothing moved", () => {
    expect(pickRefreshText(withRefresh({ status: "unchanged", ...OLD }))).toEqual({ tone: "same", text: "Odds unchanged" });
  });

  it("names the sportsbook that has no odds (like Caesars) and says the old price was kept", () => {
    const pick = withRefresh({ status: "no-odds", ...OLD }, { sportsbook: "caesars" });
    expect(pickRefreshText(pick)).toEqual({
      tone: "warning",
      text: "Caesars has no odds for this bet right now, so it kept its old price.",
    });
  });

  it("explains a failed lookup in plain words", () => {
    expect(pickRefreshText(withRefresh({ status: "not-checked", ...OLD }))).toEqual({
      tone: "warning",
      text: "We couldn't check current odds, so it kept its old price.",
    });
  });
});
