/*
  FILE: lib/betting/grading.test.ts
  WHAT IT'S FOR: Automatic tests for pick grading (grading.ts), the box score reader and the
  prop stat list (propStats.ts), and the live label words (liveLabel.ts). Every example uses
  real numbers with the answer worked out by hand, in the comments.
  WHO USES IT: Vitest, when you run `npm test`.
  WHY THIS NAME: It tests grading.ts and its helpers, right next to them. It ends in .ts because it
  shows nothing on screen.
*/

import { describe, expect, it } from "vitest";
import type { BetPick, LiveGame } from "@/types";
import { makePick } from "../../tests/support/factories";
import { gradeLabel, gradePick } from "./grading";
import { liveGameLabel } from "./liveLabel";
import { propStatKeys, statTotal, toLiveStats } from "./propStats";

/* game: a live game. Chiefs are the AWAY team (id 12), Seahawks home (id 26). */
function game(changes: Partial<LiveGame> = {}): LiveGame {
  return {
    gameId: "401873022",
    league: "nfl",
    status: "in-progress",
    label: "Q3 7:32",
    period: 3,
    clock: "7:32",
    halftime: false,
    awayTeamId: "12",
    homeTeamId: "26",
    awayScore: 24,
    homeScore: 20,
    awayPeriods: [7, 10, 7],
    homePeriods: [3, 10, 7],
    players: null,
    updatedAt: "2026-10-26T01:30:00Z",
    ...changes,
  };
}
const REG = 4;
const grade = (pick: BetPick, live: LiveGame | null) => gradePick(pick, live, REG, Date.parse("2026-10-26T01:30:00Z"));

describe("spread", () => {
  // Chiefs (away) -3, ahead 24-20: 24 + (-3) = 21 > 20 → winning.
  it("winning when the team covers", () => {
    expect(grade(makePick({ line: -3 }), game())).toEqual({ phase: "live", outcome: "win" });
  });
  // Chiefs -5 with 24-20: 24 - 5 = 19 < 20 → losing.
  it("losing when the team doesn't cover", () => {
    expect(grade(makePick({ line: -5 }), game()).outcome).toBe("lose");
  });
  // Chiefs -4 with 24-20: 24 - 4 = 20 = 20 → push.
  it("push when it lands exactly on the line", () => {
    expect(grade(makePick({ line: -4 }), game()).outcome).toBe("push");
  });
  // Seahawks (home) +3.5 trailing 24-20: 20 + 3.5 = 23.5 < 24 → losing; +4.5 → 24.5 > 24 → winning.
  it("works for the home team and underdog lines", () => {
    const home = (line: number) => makePick({ side: "home", line, participant: { kind: "team", id: "26", name: "Seattle Seahawks" } });
    expect(grade(home(3.5), game()).outcome).toBe("lose");
    expect(grade(home(4.5), game()).outcome).toBe("win");
  });
  it("says Won/Lost once the game is final", () => {
    const final = game({ status: "final", label: "Final", period: 4 });
    expect(grade(makePick({ line: -3 }), final)).toEqual({ phase: "final", outcome: "win" });
    expect(gradeLabel(grade(makePick({ line: -3 }), final))).toBe("Won");
    expect(gradeLabel(grade(makePick({ line: -5 }), final))).toBe("Lost");
  });
});

describe("total (over/under)", () => {
  const total = (side: "over" | "under", line: number) =>
    makePick({ marketKey: "totals", marketLabel: "Total", side, line, participant: { kind: "game", id: null, name: "Game" } });
  // 24 + 20 = 44 points. Over 43.5 → winning. Over 44 → push. Under 44.5 → winning right now.
  it("compares the combined score with the line", () => {
    expect(grade(total("over", 43.5), game()).outcome).toBe("win");
    expect(grade(total("over", 44), game()).outcome).toBe("push");
    expect(grade(total("over", 47.5), game()).outcome).toBe("lose");
    expect(grade(total("under", 44.5), game()).outcome).toBe("win");
    expect(grade(total("under", 40.5), game()).outcome).toBe("lose");
  });
  it("is final and decided when the game ends: 44 points is Under 47.5", () => {
    const final = game({ status: "final", label: "Final" });
    expect(gradeLabel(grade(total("under", 47.5), final))).toBe("Won");
    expect(gradeLabel(grade(total("over", 47.5), final))).toBe("Lost");
  });
});

describe("moneyline (winner)", () => {
  const ml = (side: "home" | "away") => makePick({ marketKey: "h2h", marketLabel: "Winner", side, line: null });
  it("whoever is ahead is winning", () => {
    expect(grade(ml("away"), game()).outcome).toBe("win");
    expect(grade(ml("home"), game()).outcome).toBe("lose");
  });
  it("a tie is a push", () => {
    expect(grade(ml("away"), game({ awayScore: 20, homeScore: 20 })).outcome).toBe("push");
  });
});

describe("halves and quarters count only their own part", () => {
  const half = (period: BetPick["period"], key: string, side: BetPick["side"], line: number) =>
    makePick({ marketKey: key, marketCategory: "halves", period, side, line });
  // After Q3: away [7,10,7], home [3,10,7]. First half: 17 - 13.
  it("first-half spread is decided once the first half ends", () => {
    // Chiefs -3 first half: 17 - 3 = 14 > 13 → win, and Q3 is underway so it's final already.
    expect(grade(half("first-half", "spreads_h1", "away", -3), game())).toEqual({ phase: "final", outcome: "win" });
    // Chiefs -5 first half: 17 - 5 = 12 < 13 → lose.
    expect(grade(half("first-half", "spreads_h1", "away", -5), game()).outcome).toBe("lose");
  });
  it("is decided at halftime too", () => {
    const halftime = game({ period: 2, halftime: true, awayPeriods: [7, 10], homePeriods: [3, 10], awayScore: 17, homeScore: 13, label: "Halftime" });
    expect(grade(half("first-half", "spreads_h1", "away", -3), halftime).phase).toBe("final");
  });
  it("a second-half bet is Pending at halftime and live in the third quarter", () => {
    const halftime = game({ period: 2, halftime: true, awayPeriods: [7, 10], homePeriods: [3, 10], label: "Halftime" });
    expect(grade(half("second-half", "totals_h2", "over", 20.5), halftime).phase).toBe("pending");
    // Third quarter so far: 7 + 7 = 14 points, so Over 13.5 is winning.
    expect(grade(half("second-half", "totals_h2", "over", 13.5), game())).toEqual({ phase: "live", outcome: "win" });
  });
  it("a quarter bet: Q2 total is 10 + 10 = 20 and final once Q3 starts; Q4 is Pending", () => {
    expect(grade(half("q2", "totals_q2", "over", 19.5), game())).toEqual({ phase: "final", outcome: "win" });
    expect(grade(half("q4", "totals_q4", "over", 3.5), game()).phase).toBe("pending");
  });
  it("says Live (not a guess) when ESPN has no per-period scores", () => {
    const noPeriods = game({ awayPeriods: [], homePeriods: [] });
    expect(grade(half("first-half", "spreads_h1", "away", -3), noPeriods).outcome).toBeNull();
  });
});

describe("player props", () => {
  const players = {
    "3139477": { name: "Patrick Mahomes", stats: { "passing.passingYards": 210, "passing.passingTouchdowns": 2, "rushing.rushingTouchdowns": 1 } },
    "999": { name: "Travis Kelce", stats: { "receiving.receptions": 5, "receiving.receivingYards": 61 } },
  };
  const prop = (key: string, side: BetPick["side"], line: number | null, name = "Patrick Mahomes", id: string | null = "3139477") =>
    makePick({ marketKey: key, marketCategory: "player-props", side, line, participant: { kind: "player", id, name } });

  it("over/under compares the box score number with the line", () => {
    const live = game({ players });
    expect(grade(prop("player_pass_yds", "over", 200.5), live)).toEqual({ phase: "live", outcome: "win" });
    expect(grade(prop("player_pass_yds", "over", 274.5), live).outcome).toBe("lose");
    expect(grade(prop("player_pass_yds", "under", 274.5), live).outcome).toBe("win");
    expect(grade(prop("player_pass_yds", "over", 210), live).outcome).toBe("push");
  });
  it("matches the player by name when the pick has no player ID", () => {
    expect(grade(prop("player_receptions", "over", 4.5, "Travis Kelce", null), game({ players })).outcome).toBe("win");
  });
  it("a player not in the box score has recorded 0", () => {
    expect(grade(prop("player_receptions", "over", 0.5, "Rashee Rice", "555"), game({ players })).outcome).toBe("lose");
  });
  it("anytime touchdown: adds up every kind; Mahomes' rushing TD counts", () => {
    expect(grade(prop("player_anytime_td", "yes", null), game({ players })).outcome).toBe("win");
    expect(grade(prop("player_anytime_td", "yes", null, "Travis Kelce", "999"), game({ players })).outcome).toBe("lose");
    expect(grade(prop("player_anytime_td", "no", null, "Travis Kelce", "999"), game({ players })).outcome).toBe("win");
  });
  it("says Live (no outcome) when there is no box score, or the prop isn't supported", () => {
    expect(grade(prop("player_pass_yds", "over", 200.5), game({ players: null }))).toEqual({ phase: "live", outcome: null });
    expect(grade(prop("player_1st_td", "yes", null), game({ players }))).toEqual({ phase: "live", outcome: null });
    expect(gradeLabel({ phase: "live", outcome: null })).toBe("Live");
  });
  it("is Won/Lost when the game is final", () => {
    const final = game({ players, status: "final" });
    expect(gradeLabel(grade(prop("player_pass_yds", "over", 200.5), final))).toBe("Won");
    expect(gradeLabel(grade(prop("player_pass_yds", "over", 274.5), final))).toBe("Lost");
  });
});

describe("games that haven't started, or aren't known", () => {
  it("is Pending before kickoff", () => {
    const scheduled = game({ status: "scheduled", period: null, clock: null, awayScore: null, homeScore: null, awayPeriods: [], homePeriods: [] });
    expect(grade(makePick(), scheduled)).toEqual({ phase: "pending", outcome: null });
    expect(gradeLabel({ phase: "pending", outcome: null })).toBe("Pending");
  });
  it("with no live data: Pending before the start time, Live after it", () => {
    expect(grade(makePick({ gameStartsAt: "2099-01-01T00:00Z" }), null).phase).toBe("pending");
    expect(grade(makePick({ gameStartsAt: "2020-01-01T00:00Z" }), null)).toEqual({ phase: "live", outcome: null });
  });
  it("labels", () => {
    expect(gradeLabel({ phase: "live", outcome: "push" })).toBe("Push");
    expect(gradeLabel({ phase: "final", outcome: "push" })).toBe("Push");
    expect(gradeLabel({ phase: "final", outcome: null })).toBe("Final");
    expect(gradeLabel({ phase: "live", outcome: "win" })).toBe("Winning");
    expect(gradeLabel({ phase: "live", outcome: "lose" })).toBe("Losing");
  });
});

describe("propStats", () => {
  it("knows the supported props and not the others", () => {
    expect(propStatKeys("player_pass_yds")).toEqual(["passing.passingYards"]);
    expect(propStatKeys("player_1st_td")).toBeNull();
  });
  it("adds up stats, counting a missing one as 0", () => {
    expect(statTotal({ a: 2, b: 3 }, ["a", "b", "c"])).toBe(5);
  });
  it("flattens ESPN's box score, splitting 'made/attempts' and skipping non-numbers", () => {
    const players = toLiveStats([
      {
        name: "passing",
        keys: ["completions/passingAttempts", "passingYards", "sacks-sackYardsLost"],
        athletes: [{ athlete: { id: "4038941", displayName: "Justin Herbert" }, stats: ["22/37", "204", "4-18"] }],
      },
      { name: "rushing", keys: ["rushingYards"], athletes: [{ athlete: { id: "4038941", displayName: "Justin Herbert" }, stats: ["26"] }] },
    ]);
    expect(players["4038941"]).toEqual({
      name: "Justin Herbert",
      stats: { "passing.completions": 22, "passing.passingAttempts": 37, "passing.passingYards": 204, "rushing.rushingYards": 26 },
    });
  });
});

describe("liveGameLabel", () => {
  const nfl = { short: "Q", regulation: 4 };
  const base = { status: "in-progress" as const, typeName: "STATUS_IN_PROGRESS", shortDetail: "7:32 - 3rd", period: 3, clock: "7:32", periods: nfl };
  it("shows the quarter and clock", () => {
    expect(liveGameLabel(base)).toBe("Q3 7:32");
  });
  it("shows overtime", () => {
    expect(liveGameLabel({ ...base, period: 5, clock: "4:10" })).toBe("OT 4:10");
    expect(liveGameLabel({ ...base, period: 6, clock: "9:00" })).toBe("2OT 9:00");
  });
  it("halftime, end of a quarter, and delays", () => {
    expect(liveGameLabel({ ...base, typeName: "STATUS_HALFTIME", period: 2, clock: "0:00" })).toBe("Halftime");
    expect(liveGameLabel({ ...base, typeName: "STATUS_END_PERIOD", period: 1, clock: "0:00" })).toBe("End of Q1");
    expect(liveGameLabel({ ...base, typeName: "STATUS_DELAYED" })).toBe("Delayed");
  });
  it("final, final in overtime, scheduled, postponed, canceled", () => {
    expect(liveGameLabel({ ...base, status: "final", shortDetail: "Final" })).toBe("Final");
    expect(liveGameLabel({ ...base, status: "final", shortDetail: "Final/OT" })).toBe("Final/OT");
    expect(liveGameLabel({ ...base, status: "final", shortDetail: null })).toBe("Final");
    expect(liveGameLabel({ ...base, status: "scheduled" })).toBe("Scheduled");
    expect(liveGameLabel({ ...base, status: "postponed" })).toBe("Postponed");
    expect(liveGameLabel({ ...base, status: "canceled" })).toBe("Canceled");
  });
  it("falls back to ESPN's own words for leagues with no timed periods, or with no period yet", () => {
    expect(liveGameLabel({ ...base, periods: null, shortDetail: "Round 2 - 3:10" })).toBe("Round 2 - 3:10");
    expect(liveGameLabel({ ...base, period: null, shortDetail: null })).toBe("Live");
  });
  it("uses the league's own period words", () => {
    expect(liveGameLabel({ ...base, period: 2, clock: "12:00", periods: { short: "P", regulation: 3 } })).toBe("P2 12:00");
    expect(liveGameLabel({ ...base, period: 4, clock: "5:00", periods: { short: "P", regulation: 3 } })).toBe("OT 5:00");
  });
});
