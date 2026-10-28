/*
  FILE: components/live/live.test.ts
  WHAT IT'S FOR: Automatic tests for what the live score pieces SAY on screen. They draw each piece as
  plain HTML (React's built-in server renderer, no browser needed) and check the words:
  - LiveScoreLine: "● Q3 7:32  KC 24 – SEA 20" while live, "Final" with the score, nothing before kickoff,
    and the older server score when no live information has arrived yet
  - liveView: fresh live information wins over the server's older copy
  - PickGradeBadge: Pending, Winning, Losing, Push, Live, Won, Lost, each with a word (never color alone)
  - ScoresDelayed: appears only when the last refresh failed
  WHO USES IT: Vitest, when you run `npm test`.
  WHY THIS NAME: It tests the live display pieces. It ends in .ts (not .tsx) because it only builds them with createElement.
*/

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Game, LiveGame, PickGrade } from "@/types";
import LiveScoreLine from "./LiveScoreLine";
import PickGradeBadge from "./PickGradeBadge";
import ScoresDelayed from "./ScoresDelayed";
import { liveView } from "./liveView";

const team = (id: string, abbreviation: string, displayName: string) => ({ id, abbreviation, displayName, name: displayName, logoUrl: null, record: null, color: null });
const GAME = {
  id: "1", league: "nfl", startsAt: "2026-10-26T00:20:00Z", status: "scheduled", awayScore: null, homeScore: null, venue: null, oddsEventId: null, winProbability: null,
  awayTeam: team("12", "KC", "Kansas City Chiefs"), homeTeam: team("26", "SEA", "Seattle Seahawks"),
} as unknown as Game;
const LIVE = {
  gameId: "1", league: "nfl", status: "in-progress", label: "Q3 7:32", period: 3, clock: "7:32", halftime: false, awayTeamId: "12", homeTeamId: "26",
  awayScore: 24, homeScore: 20, awayPeriods: [], homePeriods: [], players: null, updatedAt: "",
} satisfies LiveGame;

const draw = (game: Game, live?: LiveGame) => renderToStaticMarkup(createElement(LiveScoreLine, { game, live }));

describe("LiveScoreLine", () => {
  it("shows the quarter, clock, and score while the game is on", () => {
    const html = draw(GAME, LIVE);
    expect(html).toContain("Q3 7:32");
    expect(html).toContain("KC 24 – SEA 20");
    expect(html).toContain("text-danger");
  });
  it("shows Final with the score", () => {
    const html = draw(GAME, { ...LIVE, status: "final", label: "Final/OT", awayScore: 27, homeScore: 24 });
    expect(html).toContain("Final/OT");
    expect(html).toContain("KC 27 – SEA 24");
  });
  it("shows nothing before kickoff", () => {
    expect(draw(GAME, { ...LIVE, status: "scheduled", label: "Scheduled", awayScore: null, homeScore: null })).toBe("");
    expect(draw(GAME)).toBe("");
  });
  it("uses the server's older score until live information arrives", () => {
    const html = draw({ ...GAME, status: "in-progress", awayScore: 14, homeScore: 10 });
    expect(html).toContain("Live");
    expect(html).toContain("KC 14 – SEA 10");
  });
  it("shows Postponed and Canceled in red without a score", () => {
    expect(draw({ ...GAME, status: "postponed" })).toContain("Postponed");
    expect(draw(GAME, { ...LIVE, status: "canceled", label: "Canceled", awayScore: null, homeScore: null })).not.toContain("KC");
  });
});

describe("liveView", () => {
  it("fresh live information wins; otherwise the server's copy", () => {
    expect(liveView({ status: "scheduled", awayScore: null, homeScore: null }, LIVE)).toEqual({ status: "in-progress", label: "Q3 7:32", awayScore: 24, homeScore: 20 });
    expect(liveView({ status: "final", awayScore: 31, homeScore: 34 }, undefined)).toEqual({ status: "final", label: "Final", awayScore: 31, homeScore: 34 });
  });
});

describe("PickGradeBadge", () => {
  const badge = (grade: PickGrade) => renderToStaticMarkup(createElement(PickGradeBadge, { grade }));
  it.each([
    [{ phase: "pending", outcome: null }, "Pending"],
    [{ phase: "live", outcome: "win" }, "Winning"],
    [{ phase: "live", outcome: "lose" }, "Losing"],
    [{ phase: "live", outcome: "push" }, "Push"],
    [{ phase: "live", outcome: null }, "Live"],
    [{ phase: "final", outcome: "win" }, "Won"],
    [{ phase: "final", outcome: "lose" }, "Lost"],
    [{ phase: "final", outcome: "push" }, "Push"],
  ] as [PickGrade, string][])("%j says %s", (grade, word) => {
    expect(badge(grade)).toContain(word);
  });
  it("uses green for winning and red for losing, with a symbol as well", () => {
    expect(badge({ phase: "live", outcome: "win" })).toContain("text-money");
    expect(badge({ phase: "live", outcome: "win" })).toContain("✓");
    expect(badge({ phase: "live", outcome: "lose" })).toContain("text-danger");
    expect(badge({ phase: "live", outcome: "lose" })).toContain("✕");
  });
});

describe("ScoresDelayed", () => {
  it("appears only when asked", () => {
    expect(renderToStaticMarkup(createElement(ScoresDelayed, { show: true }))).toContain("Scores delayed");
    expect(renderToStaticMarkup(createElement(ScoresDelayed, { show: false }))).toBe("");
  });
});
