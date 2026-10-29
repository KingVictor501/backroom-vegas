/*
  FILE: components/live/livePoller.test.ts
  WHAT IT'S FOR: Automatic tests for the live refresh timing (livePoller.ts), using a fake clock and a
  pretend browser tab. They prove the assignment's rules:
  - it loads once on open if a game has started or finished, and not at all for games in the future
  - it refreshes every 30 seconds ONLY while a game is live (or should be) and the tab is open
  - nothing is requested while the tab is hidden; coming back refreshes right away
  - it stops asking once every game is final, and never asks about a game that ended long ago
  - a failed refresh keeps the last scores and reports "delayed"; the next good one clears it
  - when stopped, the timer is gone and a late answer is ignored
  WHO USES IT: Vitest, when you run `npm test`.
  WHY THIS NAME: It tests livePoller.ts, right next to it. It ends in .ts because it shows nothing on screen.
*/

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LiveGame } from "@/types";
import { needsFirstLoad, REFRESH_MS, shouldPoll, startLivePolling, type PollerEnvironment, type WatchedGame } from "./livePoller";

const NOW = Date.parse("2026-10-26T02:00:00Z");
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString();
const hoursAhead = (h: number) => new Date(NOW + h * 3_600_000).toISOString();

const watchedGame = (id: string, startsAt: string, status: WatchedGame["status"], league = "nfl"): WatchedGame => ({ id, league, startsAt, status });

function liveGame(gameId: string, status: LiveGame["status"], awayScore = 0): LiveGame {
  return {
    gameId, league: "nfl", status, label: status === "final" ? "Final" : "Q2 5:00", period: 2, clock: "5:00", halftime: false,
    awayTeamId: "12", homeTeamId: "26", awayScore, homeScore: 0, awayPeriods: [], homePeriods: [], players: null, updatedAt: "",
  };
}

/* A pretend browser: the tab can be hidden and shown, and the clock follows the fake timers. */
function fakeEnvironment() {
  let open = true;
  let listener: (() => void) | null = null;
  const environment: PollerEnvironment = {
    now: () => Date.now(),
    tabIsOpen: () => open,
    onTabShown: (callback) => {
      listener = callback;
      return () => {
        listener = null;
      };
    },
  };
  return {
    environment,
    hideTab: () => {
      open = false;
    },
    showTab: () => {
      open = true;
      listener?.();
    },
    hasListener: () => listener !== null,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

describe("shouldPoll / needsFirstLoad", () => {
  it("polls a live game, and a 'scheduled' game whose start time has passed (but not for ever)", () => {
    expect(shouldPoll(watchedGame("1", hoursAgo(1), "in-progress"), undefined, NOW)).toBe(true);
    expect(shouldPoll(watchedGame("1", hoursAgo(1), "scheduled"), undefined, NOW)).toBe(true);
    expect(shouldPoll(watchedGame("1", hoursAgo(9), "scheduled"), undefined, NOW)).toBe(false);
  });
  it("doesn't poll future, finished, postponed, or canceled games", () => {
    expect(shouldPoll(watchedGame("1", hoursAhead(2), "scheduled"), undefined, NOW)).toBe(false);
    expect(shouldPoll(watchedGame("1", hoursAgo(5), "final"), undefined, NOW)).toBe(false);
    expect(shouldPoll(watchedGame("1", hoursAgo(1), "postponed"), undefined, NOW)).toBe(false);
    expect(shouldPoll(watchedGame("1", hoursAgo(1), "canceled"), undefined, NOW)).toBe(false);
  });
  it("the freshest status beats the server's older copy", () => {
    expect(shouldPoll(watchedGame("1", hoursAgo(1), "in-progress"), "final", NOW)).toBe(false);
    expect(shouldPoll(watchedGame("1", hoursAgo(1), "scheduled"), "in-progress", NOW)).toBe(true);
  });
  it("a first load is worth it once a game has started, finished, or should have started", () => {
    expect(needsFirstLoad(watchedGame("1", hoursAhead(3), "scheduled"), NOW)).toBe(false);
    expect(needsFirstLoad(watchedGame("1", hoursAgo(1), "scheduled"), NOW)).toBe(true);
    expect(needsFirstLoad(watchedGame("1", hoursAgo(30), "final"), NOW)).toBe(true);
  });
});

describe("startLivePolling", () => {
  /* setup: starts polling with a recording `load` and returns the pieces to look at. */
  function setup(games: WatchedGame[], answers: () => Promise<LiveGame[]>) {
    const tab = fakeEnvironment();
    const load = vi.fn(answers);
    const onGames = vi.fn();
    const onDelayed = vi.fn();
    const stop = startLivePolling({ games, load, onGames, onDelayed, environment: tab.environment });
    return { tab, load, onGames, onDelayed, stop };
  }

  it("makes no request at all for games that are all in the future", async () => {
    const { load, stop } = setup([watchedGame("1", hoursAhead(3), "scheduled")], async () => []);
    await vi.advanceTimersByTimeAsync(REFRESH_MS * 10);
    expect(load).not.toHaveBeenCalled();
    stop();
  });

  it("loads once on open and refreshes every 30 seconds while a game is live", async () => {
    const { load, onGames, stop } = setup([watchedGame("1", hoursAgo(1), "in-progress")], async () => [liveGame("1", "in-progress")]);
    await vi.advanceTimersByTimeAsync(0);
    expect(load).toHaveBeenCalledTimes(1);
    expect(onGames).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(REFRESH_MS);
    expect(load).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(REFRESH_MS * 3);
    expect(load).toHaveBeenCalledTimes(5);
    stop();
  });

  it("loads a finished game once and then stops asking", async () => {
    const { load, stop } = setup([watchedGame("1", hoursAgo(30), "final")], async () => [liveGame("1", "final", 31)]);
    await vi.advanceTimersByTimeAsync(REFRESH_MS * 10);
    expect(load).toHaveBeenCalledTimes(1);
    stop();
  });

  it("stops refreshing once the game it was watching turns final", async () => {
    let status: LiveGame["status"] = "in-progress";
    const { load, stop } = setup([watchedGame("1", hoursAgo(1), "in-progress")], async () => [liveGame("1", status)]);
    await vi.advanceTimersByTimeAsync(REFRESH_MS * 2);
    const callsWhileLive = load.mock.calls.length;
    expect(callsWhileLive).toBe(3);
    status = "final";
    await vi.advanceTimersByTimeAsync(REFRESH_MS); // this refresh hears "final"
    const afterFinal = load.mock.calls.length;
    await vi.advanceTimersByTimeAsync(REFRESH_MS * 5);
    expect(load.mock.calls.length).toBe(afterFinal);
    stop();
  });

  it("starts refreshing when a scheduled game's start time arrives", async () => {
    const { load, stop } = setup([watchedGame("1", hoursAhead(0.01), "scheduled")], async () => [liveGame("1", "in-progress")]);
    await vi.advanceTimersByTimeAsync(REFRESH_MS);
    expect(load).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(REFRESH_MS * 2); // 36 seconds is past the start
    expect(load).toHaveBeenCalled();
    stop();
  });

  it("makes no requests while the tab is hidden, and refreshes right away when it comes back", async () => {
    const { tab, load, stop } = setup([watchedGame("1", hoursAgo(1), "in-progress")], async () => [liveGame("1", "in-progress")]);
    await vi.advanceTimersByTimeAsync(0);
    expect(load).toHaveBeenCalledTimes(1);
    tab.hideTab();
    await vi.advanceTimersByTimeAsync(REFRESH_MS * 10);
    expect(load).toHaveBeenCalledTimes(1);
    tab.showTab();
    await vi.advanceTimersByTimeAsync(0);
    expect(load).toHaveBeenCalledTimes(2);
    stop();
  });

  it("opened in a background tab: waits, then does its first load when the tab is shown", async () => {
    const tab = fakeEnvironment();
    tab.hideTab();
    const load = vi.fn(async () => [liveGame("1", "final", 20)]);
    const stop = startLivePolling({ games: [watchedGame("1", hoursAgo(30), "final")], load, onGames: vi.fn(), onDelayed: vi.fn(), environment: tab.environment });
    await vi.advanceTimersByTimeAsync(REFRESH_MS * 3);
    expect(load).not.toHaveBeenCalled();
    tab.showTab();
    await vi.advanceTimersByTimeAsync(0);
    expect(load).toHaveBeenCalledTimes(1);
    stop();
  });

  it("keeps the last scores and says 'delayed' when a refresh fails; the next good one clears it", async () => {
    let fail = false;
    const { onGames, onDelayed, stop } = setup([watchedGame("1", hoursAgo(1), "in-progress")], async () => {
      if (fail) throw new Error("ESPN is down");
      return [liveGame("1", "in-progress", 7)];
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(onDelayed).toHaveBeenLastCalledWith(false);
    expect(onGames).toHaveBeenCalledTimes(1);

    fail = true;
    await vi.advanceTimersByTimeAsync(REFRESH_MS);
    expect(onDelayed).toHaveBeenLastCalledWith(true);
    expect(onGames).toHaveBeenCalledTimes(1); // the screen was not told anything new, so it keeps the last score

    fail = false;
    await vi.advanceTimersByTimeAsync(REFRESH_MS);
    expect(onDelayed).toHaveBeenLastCalledWith(false);
    expect(onGames).toHaveBeenCalledTimes(2);
    stop();
  });

  it("keeps games from earlier answers when a later answer leaves one out", async () => {
    let round = 0;
    const { onGames, stop } = setup([watchedGame("1", hoursAgo(1), "in-progress"), watchedGame("2", hoursAgo(1), "in-progress")], async () => {
      round += 1;
      return round === 1 ? [liveGame("1", "in-progress", 3), liveGame("2", "in-progress", 6)] : [liveGame("1", "in-progress", 10)];
    });
    await vi.advanceTimersByTimeAsync(REFRESH_MS);
    const last = onGames.mock.calls.at(-1)?.[0] as Map<string, LiveGame>;
    expect(last.get("1")?.awayScore).toBe(10);
    expect(last.get("2")?.awayScore).toBe(6);
    stop();
  });

  it("stops completely: no more timer, no listener, and a late answer is ignored", async () => {
    let finish: (games: LiveGame[]) => void = () => undefined;
    const { tab, load, onGames, stop } = setup([watchedGame("1", hoursAgo(1), "in-progress")], () => new Promise<LiveGame[]>((resolve) => (finish = resolve)));
    await vi.advanceTimersByTimeAsync(0);
    expect(load).toHaveBeenCalledTimes(1);
    stop();
    expect(tab.hasListener()).toBe(false);
    finish([liveGame("1", "in-progress")]);
    await vi.advanceTimersByTimeAsync(REFRESH_MS * 5);
    expect(onGames).not.toHaveBeenCalled();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("does nothing for an empty list", async () => {
    const { load, stop } = setup([], async () => []);
    await vi.advanceTimersByTimeAsync(REFRESH_MS * 3);
    expect(load).not.toHaveBeenCalled();
    stop();
  });
});
