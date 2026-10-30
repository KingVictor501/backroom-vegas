/*
  FILE: lib/services/espn/gamesWeek.test.ts
  WHAT IT'S FOR: Checks how the Feed's games are collected for a league with no ESPN "week" (the NBA):
  ESPN's plain scoreboard only gives TODAY, so we ask for each later day in the league's week (up to Saturday),
  add them without repeating a game, and keep going if one day fails. Uses a saved real NBA scoreboard.
  WHO USES IT: `npm test` (Vitest).
  WHY THIS NAME: It tests the week-gathering part of games.ts; ".test.ts" is how Vitest finds test files.
*/

import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { espnGet } = vi.hoisted(() => ({ espnGet: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/services/cache", async (orig) => ({
  ...(await orig<object>()),
  cached: <F>(_k: string, _s: number, fn: F) => fn,
}));
vi.mock("./client", async (orig) => ({ ...(await orig<object>()), espnGet }));

import { scoreboardSchema } from "./schemas";
import { getUpcomingGames } from "./games";

/* The saved NBA scoreboard (4 games, no "week" field, like ESPN's real answer). */
const SAVED = JSON.parse(
  readFileSync("tests/fixtures/espn-nba-scoreboard-live.json", "utf8"),
);

/* withIds: a copy of the saved scoreboard whose games get new IDs, so two days don't look like the same games. */
function withIds(prefix: string) {
  return scoreboardSchema.parse({
    ...SAVED,
    events: SAVED.events.map((e: { id: string }) => ({
      ...e,
      id: `${prefix}${e.id}`,
    })),
  });
}

describe("getUpcomingGames for a league with no ESPN week (NBA)", () => {
  beforeEach(() => {
    espnGet.mockReset();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-22T19:00:00Z")); // Thursday, 3:00 PM Eastern
  });
  afterEach(() => vi.useRealTimers());

  it("asks for Friday and Saturday too, and puts all the days' games together, soonest first", async () => {
    espnGet.mockImplementation(async (url: string) =>
      url.includes("dates=20261023")
        ? withIds("fri")
        : url.includes("dates=20261024")
          ? withIds("sat")
          : withIds("thu"),
    );
    const { thisWeek, nextWeek } = await getUpcomingGames("nba");
    const urls = espnGet.mock.calls.map((call) => String(call[0]));
    expect(urls.filter((u) => u.includes("dates="))).toHaveLength(2);
    expect(urls.some((u) => u.includes("dates=20261023"))).toBe(true);
    expect(urls.some((u) => u.includes("dates=20261024"))).toBe(true);
    expect(urls.some((u) => u.includes("dates=20261025"))).toBe(false); // Sunday is next week
    expect(thisWeek).toHaveLength(SAVED.events.length * 3);
    expect(thisWeek.map((g) => g.startsAt)).toEqual(
      [...thisWeek.map((g) => g.startsAt)].sort(),
    );
    expect(nextWeek).toEqual([]);
  });

  it("does not list a game twice when two days both return it", async () => {
    espnGet.mockImplementation(async () => withIds("same"));
    const { thisWeek } = await getUpcomingGames("nba");
    expect(thisWeek).toHaveLength(SAVED.events.length);
  });

  it("keeps today's games when a later day fails to load", async () => {
    espnGet.mockImplementation(async (url: string) => {
      if (url.includes("dates=")) throw new Error("ESPN down");
      return withIds("thu");
    });
    const { thisWeek } = await getUpcomingGames("nba");
    expect(thisWeek).toHaveLength(SAVED.events.length);
  });
});
