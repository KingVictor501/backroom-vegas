/*
  FILE: lib/feed/paging.test.ts
  WHAT IT'S FOR: Checks the Feed's card order (in progress first, then soonest upcoming) and its pages of 3 rows.
  WHO USES IT: `npm test` (Vitest).
  WHY THIS NAME: It tests paging.ts; ".test.ts" is how Vitest finds test files.
*/

import { describe, expect, it } from "vitest";
import type { GameStatus } from "@/types";
import {
  clampPage,
  orderForFeed,
  pageCount,
  pageItems,
  pageSize,
  PHONE_COLUMNS,
  WIDE_COLUMNS,
} from "./paging";

/* game: a pretend game with just the two fields the ordering uses, plus an id to tell them apart. */
function game(
  id: string,
  status: GameStatus,
  startsAt: string,
): { id: string; status: GameStatus; startsAt: string } {
  return { id, status, startsAt };
}

describe("orderForFeed", () => {
  it("puts games in progress first, then upcoming games by soonest start, then finished games, then postponed or canceled (by start time)", () => {
    const ordered = orderForFeed([
      game("later", "scheduled", "2026-11-09T18:00:00Z"),
      game("done", "final", "2026-11-08T18:00:00Z"),
      game("postponed", "postponed", "2026-11-08T12:00:00Z"),
      game("soon", "scheduled", "2026-11-08T21:00:00Z"),
      game("live-b", "in-progress", "2026-11-08T18:00:00Z"),
      game("live-a", "in-progress", "2026-11-08T17:00:00Z"),
      game("canceled", "canceled", "2026-11-07T12:00:00Z"),
    ]);
    expect(ordered.map((g) => g.id)).toEqual([
      "live-a",
      "live-b",
      "soon",
      "later",
      "done",
      "canceled",
      "postponed",
    ]);
  });

  it("shows the most recently finished game first", () => {
    const ordered = orderForFeed([
      game("old", "final", "2026-11-01T18:00:00Z"),
      game("new", "final", "2026-11-08T18:00:00Z"),
    ]);
    expect(ordered.map((g) => g.id)).toEqual(["new", "old"]);
  });

  it("compares start times as real moments (ESPN's ...T00:20Z and the Odds API's ...:00Z)", () => {
    const ordered = orderForFeed([
      game("b", "scheduled", "2026-11-09T00:20Z"),
      game("a", "scheduled", "2026-11-09T00:05:00Z"),
    ]);
    expect(ordered.map((g) => g.id)).toEqual(["a", "b"]);
  });

  it("does not change the list it was given", () => {
    const original = [
      game("b", "scheduled", "2026-11-09T18:00:00Z"),
      game("a", "in-progress", "2026-11-09T12:00:00Z"),
    ];
    orderForFeed(original);
    expect(original.map((g) => g.id)).toEqual(["b", "a"]);
  });
});

describe("pages of 3 rows", () => {
  it("is 3 cards on a phone (1 column) and 6 on a tablet or wider (2 columns)", () => {
    expect(pageSize(PHONE_COLUMNS)).toBe(3);
    expect(pageSize(WIDE_COLUMNS)).toBe(6);
  });

  it("counts pages, with at least one even for no cards", () => {
    expect(pageCount(0, 6)).toBe(1);
    expect(pageCount(6, 6)).toBe(1);
    expect(pageCount(7, 6)).toBe(2);
    expect(pageCount(16, 6)).toBe(3);
  });

  it("keeps a page number inside the real pages", () => {
    expect(clampPage(0, 3)).toBe(1);
    expect(clampPage(2, 3)).toBe(2);
    expect(clampPage(9, 3)).toBe(3);
  });

  it("cuts out one page of cards, and a too-big page number shows the last page", () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    expect(pageItems(items, 1, 6)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(pageItems(items, 2, 6)).toEqual([7, 8]);
    expect(pageItems(items, 5, 6)).toEqual([7, 8]);
    expect(pageItems([], 1, 6)).toEqual([]);
  });
});
