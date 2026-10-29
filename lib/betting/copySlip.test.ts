/*
  FILE: lib/betting/copySlip.test.ts
  WHAT IT'S FOR: Automatic tests for the slip-copy RULES (lib/betting/copySlip.ts), using plain
  example picks and example "current odds". They prove:
  - the copy's name is "Copy of ..." and never longer than 50 characters
  - picks for games that started, finished, or were canceled are skipped, with a reason
  - the rest get the sportsbook's current price (and moved lines), and remember the old ones
  - a bet the sportsbook doesn't offer keeps its old price and says "no odds"
  - when odds couldn't be looked up, the old price is kept and says "not checked"
  WHO USES IT: Vitest, when you run `npm test`.
  WHY THIS NAME: It tests copySlip.ts, so it's copySlip.test.ts right next to it. It ends in .ts
  because it shows nothing on screen.
*/

import { describe, expect, it } from "vitest";
import { copySlipName, planSlipCopy, sameParticipant, type PickOddsResult } from "./copySlip";
import type { BetPick, GameStatus, MarketOutcome } from "@/types";
import { KC_SEA, LAC_KC, makePick } from "../../tests/support/factories";

/* "Now" in these tests: Sunday Oct 25 2026, 12:00 UTC. Games on this day at 20:25 UTC haven't started. */
const NOW = new Date("2026-10-25T12:00:00Z");
const LATER = "2026-10-25T20:25:00Z";
const EARLIER = "2026-10-25T01:00:00Z";

const KC = { kind: "team", id: "12", name: "Kansas City Chiefs" } as const;
const SEA = { kind: "team", id: "26", name: "Seattle Seahawks" } as const;
const GAME = { kind: "game", id: null, name: "Game" } as const;

/* outcome: a current price from the sportsbook. */
function outcome(side: MarketOutcome["side"], participant: MarketOutcome["participant"], line: number | null, odds: number): MarketOutcome {
  return { side, participant, line, odds };
}

/* plan: runs the rules with a short way to give current odds. */
function plan(picks: BetPick[], odds: Record<string, PickOddsResult> = {}, statuses: Record<string, GameStatus> = {}) {
  return planSlipCopy({
    picks,
    odds: new Map(Object.entries(odds)),
    gameStatuses: new Map(Object.entries(statuses)),
    sportsbook: "betmgm",
    now: NOW,
  });
}

/* A spread pick on the Chiefs (the away team in the factory's KC @ SEA game) at -3 (-110) from Hard Rock, for a game that hasn't started. */
const chiefs = makePick({ gameStartsAt: LATER });

describe("copySlipName", () => {
  it("puts 'Copy of ' in front", () => {
    expect(copySlipName("Sunday Parlay")).toBe("Copy of Sunday Parlay");
  });

  it("is never longer than 50 characters", () => {
    const name = copySlipName("x".repeat(50));
    expect(name.length).toBe(50);
    expect(name.startsWith("Copy of x")).toBe(true);
  });

  it("leaves room for ' (2)' to ' (99)' when asked", () => {
    const name = copySlipName("x".repeat(50), true);
    expect(name.length).toBeLessThanOrEqual(45);
    expect(`${name} (99)`.length).toBeLessThanOrEqual(50);
  });

  it("never cuts an emoji in half", () => {
    const name = copySlipName(`${"a".repeat(41)}🏈🏈`);
    expect(name.length).toBeLessThanOrEqual(50);
    // No lone half-emoji at the end.
    expect(/[\uD800-\uDBFF]$/.test(name)).toBe(false);
    expect(/(^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(name)).toBe(false);
  });
});

describe("sameParticipant", () => {
  it("matches by ID when both have one, otherwise by name ignoring capitals", () => {
    expect(sameParticipant(KC, { ...KC, name: "Chiefs" })).toBe(true);
    expect(sameParticipant(KC, SEA)).toBe(false);
    expect(sameParticipant({ kind: "player", id: null, name: "Patrick Mahomes" }, { kind: "player", id: null, name: " patrick mahomes " })).toBe(true);
    expect(sameParticipant({ kind: "player", id: "1", name: "A" }, { kind: "team", id: "1", name: "A" })).toBe(false);
    expect(sameParticipant(GAME, GAME)).toBe(true);
  });
});

describe("skipping picks whose games are not coming up", () => {
  it("skips a game whose kickoff time has passed, and says why", () => {
    const old = makePick({ gameStartsAt: EARLIER });
    const result = plan([old, chiefs]);
    expect(result.picks).toHaveLength(1);
    expect(result.skipped).toEqual([{ label: old.label, gameLabel: old.gameLabel, reason: "That game already started." }]);
  });

  it("skips a finished game (ESPN says final) even if the time looks odd", () => {
    const result = plan([chiefs], {}, { [chiefs.gameId]: "final" });
    expect(result.picks).toHaveLength(0);
    expect(result.skipped[0].reason).toBe("That game is already over.");
  });

  it("skips a game that is in progress, and one that was canceled", () => {
    const a = makePick({ gameId: KC_SEA, gameStartsAt: LATER });
    const b = makePick({ gameId: LAC_KC, gameStartsAt: LATER });
    const result = plan([a, b], {}, { [KC_SEA]: "in-progress", [LAC_KC]: "canceled" });
    expect(result.skipped.map((s) => s.reason)).toEqual(["That game already started.", "That game was canceled."]);
  });

  it("keeps a game that is scheduled or postponed with a future kickoff", () => {
    expect(plan([chiefs], {}, { [chiefs.gameId]: "scheduled" }).picks).toHaveLength(1);
    expect(plan([chiefs], {}, { [chiefs.gameId]: "postponed" }).picks).toHaveLength(1);
  });

  it("an empty slip copies to an empty plan", () => {
    expect(plan([])).toEqual({ picks: [], skipped: [], counts: { updated: 0, unchanged: 0, "no-odds": 0, "not-checked": 0 } });
  });

  it("everything skipped → no picks, all noted", () => {
    const result = plan([makePick({ gameStartsAt: EARLIER }), makePick({ gameStartsAt: EARLIER, side: "home" })]);
    expect(result.picks).toEqual([]);
    expect(result.skipped).toHaveLength(2);
  });
});

describe("refreshing prices", () => {
  it("same line, new price: updates the price, takes the user's sportsbook, and remembers the old price", () => {
    const result = plan([chiefs], { [chiefs.id]: { state: "outcomes", outcomes: [outcome("away", KC, -3, -115), outcome("home", SEA, 3, -105)] } });
    const [pick] = result.picks;
    expect(pick.odds).toBe(-115);
    expect(pick.line).toBe(-3);
    expect(pick.sportsbook).toBe("betmgm");
    expect(pick.id).toBe(chiefs.id); // same line, so the same ID
    expect(pick.refresh).toEqual({ status: "updated", previousOdds: -110, previousLine: -3, previousSportsbook: "hardrock" });
    expect(result.counts.updated).toBe(1);
  });

  it("nothing moved: status 'unchanged' (the sportsbook still switches to the user's)", () => {
    const result = plan([chiefs], { [chiefs.id]: { state: "outcomes", outcomes: [outcome("away", KC, -3, -110)] } });
    expect(result.picks[0].refresh?.status).toBe("unchanged");
    expect(result.picks[0].sportsbook).toBe("betmgm");
    expect(result.counts.unchanged).toBe(1);
  });

  it("a moved spread: new line, new ID, and the label shows the new number", () => {
    const result = plan([chiefs], { [chiefs.id]: { state: "outcomes", outcomes: [outcome("away", KC, -3.5, -108), outcome("home", SEA, 3.5, -112)] } });
    const [pick] = result.picks;
    expect(pick.line).toBe(-3.5);
    expect(pick.odds).toBe(-108);
    expect(pick.label).toBe("Chiefs -3.5");
    expect(pick.id).toBe("401873022|spreads|12|away|-3.5");
    expect(pick.refresh).toMatchObject({ status: "updated", previousLine: -3, previousOdds: -110 });
  });

  it("a moved total updates 'Over 47.5' to the new number", () => {
    const total = makePick({
      gameStartsAt: LATER, marketKey: "totals", marketLabel: "Total", participant: GAME, side: "over", line: 47.5, odds: -110, label: "Over 47.5",
    });
    const result = plan([total], { [total.id]: { state: "outcomes", outcomes: [outcome("over", GAME, 48.5, -105), outcome("under", GAME, 48.5, -115)] } });
    expect(result.picks[0].label).toBe("Over 48.5");
    expect(result.picks[0].line).toBe(48.5);
  });

  it("a moved prop line updates the number inside a longer label", () => {
    const mahomes = { kind: "player", id: "3139477", name: "Patrick Mahomes" } as const;
    const prop = makePick({
      gameStartsAt: LATER, marketKey: "player_pass_yds", marketCategory: "player-props", marketLabel: "Passing Yards",
      participant: mahomes, side: "over", line: 274.5, odds: -115, label: "Patrick Mahomes Over 274.5 Passing Yards",
    });
    const result = plan([prop], { [prop.id]: { state: "outcomes", outcomes: [outcome("over", mahomes, 279.5, -110), outcome("under", mahomes, 279.5, -110)] } });
    expect(result.picks[0].label).toBe("Patrick Mahomes Over 279.5 Passing Yards");
  });

  it("the same line is preferred when the book offers several (alternate lines)", () => {
    const mahomes = { kind: "player", id: null, name: "Patrick Mahomes" } as const;
    const prop = makePick({
      gameStartsAt: LATER, marketKey: "player_pass_yds", marketCategory: "player-props", marketLabel: "Passing Yards",
      participant: mahomes, side: "over", line: 249.5, odds: -150, label: "Patrick Mahomes Over 249.5 Passing Yards",
    });
    const outcomes = [
      outcome("over", mahomes, 249.5, -140), outcome("under", mahomes, 249.5, 110),
      outcome("over", mahomes, 274.5, -110), outcome("under", mahomes, 274.5, -110),
    ];
    const result = plan([prop], { [prop.id]: { state: "outcomes", outcomes } });
    expect(result.picks[0].line).toBe(249.5);
    expect(result.picks[0].odds).toBe(-140);
  });

  it("when the old alternate line is gone, the MAIN line (prices closest together) is used", () => {
    const mahomes = { kind: "player", id: null, name: "Patrick Mahomes" } as const;
    const prop = makePick({
      gameStartsAt: LATER, marketKey: "player_pass_yds", marketCategory: "player-props", marketLabel: "Passing Yards",
      participant: mahomes, side: "over", line: 199.5, odds: -400, label: "Patrick Mahomes Over 199.5 Passing Yards",
    });
    const outcomes = [
      outcome("over", mahomes, 249.5, -250), outcome("under", mahomes, 249.5, 190),
      outcome("over", mahomes, 274.5, -112), outcome("under", mahomes, 274.5, -108),
      outcome("over", mahomes, 299.5, 180), outcome("under", mahomes, 299.5, -240),
    ];
    const result = plan([prop], { [prop.id]: { state: "outcomes", outcomes } });
    expect(result.picks[0].line).toBe(274.5);
    expect(result.picks[0].odds).toBe(-112);
  });

  it("a winner (no line) pick refreshes by team and side", () => {
    const winner = makePick({ gameStartsAt: LATER, marketKey: "h2h", marketLabel: "Winner", line: null, odds: -150, label: "Chiefs to win" });
    const result = plan([winner], { [winner.id]: { state: "outcomes", outcomes: [outcome("away", KC, null, -165), outcome("home", SEA, null, 140)] } });
    expect(result.picks[0].odds).toBe(-165);
    expect(result.picks[0].line).toBeNull();
    expect(result.picks[0].id).toBe(winner.id);
  });

  it("only the matching side and team is used (the Seahawks' price never replaces the Chiefs')", () => {
    const result = plan([chiefs], { [chiefs.id]: { state: "outcomes", outcomes: [outcome("home", SEA, 3, -500)] } });
    expect(result.picks[0].odds).toBe(-110);
    expect(result.picks[0].refresh?.status).toBe("no-odds");
  });

  it("sets addedAt to now and drops any old refresh note", () => {
    const old = { ...chiefs, addedAt: "2020-01-01T00:00:00Z", refresh: { status: "updated" as const, previousOdds: 999, previousLine: 1, previousSportsbook: "betmgm" as const } };
    const result = plan([old], { [old.id]: { state: "outcomes", outcomes: [outcome("away", KC, -3, -110)] } });
    expect(result.picks[0].addedAt).toBe(NOW.toISOString());
    expect(result.picks[0].refresh).toMatchObject({ status: "unchanged", previousOdds: -110, previousSportsbook: "hardrock" });
  });
});

describe("when the sportsbook has no odds, or we couldn't look", () => {
  it("'none': keeps the old price, line, and sportsbook, and says 'no-odds'", () => {
    const result = plan([chiefs], { [chiefs.id]: { state: "none" } });
    expect(result.picks[0]).toMatchObject({ odds: -110, line: -3, sportsbook: "hardrock", id: chiefs.id });
    expect(result.picks[0].refresh).toEqual({ status: "no-odds", previousOdds: -110, previousLine: -3, previousSportsbook: "hardrock" });
    expect(result.counts["no-odds"]).toBe(1);
  });

  it("'not-checked' and a missing entry both keep the old price and say 'not-checked'", () => {
    const result = plan([chiefs, makePick({ gameStartsAt: LATER, side: "home", participant: SEA, line: 3, label: "Seahawks +3" })], {
      [chiefs.id]: { state: "not-checked" },
    });
    expect(result.picks.map((p) => p.refresh?.status)).toEqual(["not-checked", "not-checked"]);
    expect(result.picks.map((p) => p.odds)).toEqual([-110, -110]);
    expect(result.counts["not-checked"]).toBe(2);
  });

  it("a price that can't be found for this side counts as 'no-odds'", () => {
    const result = plan([chiefs], { [chiefs.id]: { state: "outcomes", outcomes: [] } });
    expect(result.picks[0].refresh?.status).toBe("no-odds");
  });
});

describe("a slip with a mix of everything", () => {
  it("copies in order, skips the right ones, and counts each state", () => {
    const a = makePick({ gameId: KC_SEA, gameStartsAt: LATER });
    const b = makePick({ gameId: LAC_KC, gameStartsAt: EARLIER, label: "Old game pick" });
    const c = makePick({ gameId: LAC_KC, gameStartsAt: LATER, side: "home", participant: SEA, line: 3, label: "Seahawks +3" });
    const result = plan([a, b, c], {
      [a.id]: { state: "outcomes", outcomes: [outcome("away", KC, -4, -105)] },
      [c.id]: { state: "none" },
    });
    expect(result.picks.map((p) => p.label)).toEqual(["Chiefs -4", "Seahawks +3"]);
    expect(result.skipped.map((s) => s.label)).toEqual(["Old game pick"]);
    expect(result.counts).toEqual({ updated: 1, unchanged: 0, "no-odds": 1, "not-checked": 0 });
  });

  it("two old picks landing on the same current line: the second goes back to its old self (no duplicate)", () => {
    const mahomes = { kind: "player", id: null, name: "Patrick Mahomes" } as const;
    const make = (line: number) =>
      makePick({
        gameStartsAt: LATER, marketKey: "player_pass_yds", marketCategory: "player-props", marketLabel: "Passing Yards",
        participant: mahomes, side: "over", line, odds: -200, label: `Patrick Mahomes Over ${line} Passing Yards`,
      });
    const one = make(224.5);
    const two = make(249.5);
    const current: PickOddsResult = { state: "outcomes", outcomes: [outcome("over", mahomes, 274.5, -110), outcome("under", mahomes, 274.5, -110)] };
    const result = plan([one, two], { [one.id]: current, [two.id]: current });
    const ids = result.picks.map((p) => p.id);
    expect(new Set(ids).size).toBe(2);
    expect(result.picks[0].line).toBe(274.5);
    expect(result.picks[1]).toMatchObject({ line: 249.5, odds: -200, id: two.id });
    expect(result.picks[1].refresh?.status).toBe("not-checked");
  });

  it("never changes the picks it was given", () => {
    const before = JSON.stringify(chiefs);
    plan([chiefs], { [chiefs.id]: { state: "outcomes", outcomes: [outcome("away", KC, -9, 500)] } });
    expect(JSON.stringify(chiefs)).toBe(before);
  });
});
