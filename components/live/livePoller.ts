/*
  FILE: components/live/livePoller.ts
  WHAT IT'S FOR: The timing rules for live score refreshing, as a plain function (no React), so they can be
  tested with a fake clock. The hook in useLiveScores.ts just connects it to the screen.
  THE RULES (from the assignment):
  - Load once when the screen opens, if any game has started, finished, or should have started.
    If the tab is in the background at that moment, wait until you look at it.
  - Then refresh every 30 seconds, but ONLY while a game is live (or should be) AND the tab is open.
  - Coming back to the tab refreshes right away (if a game is live).
  - A failed refresh keeps the last scores and reports "delayed"; the next success clears it.
  - When stopped (the screen closes), the timer and listeners are removed, and a late answer is ignored.
  WHO USES IT: components/live/useLiveScores.ts. Tests: components/live/livePoller.test.ts.
  WHY THIS NAME: It polls (asks again and again) for live scores. It ends in .ts because it draws nothing.
*/

import type { GameStatus, LiveGame } from "@/types";

/** How often to refresh while a game is live: 30 seconds. */
export const REFRESH_MS = 30_000;

/*
  A game that "should have started" only counts for this long. After that, if we still haven't heard
  it's live, it is old or unknown, so we stop asking about it every 30 seconds (8 hours is longer than any football game).
*/
const SHOULD_HAVE_STARTED_WINDOW_MS = 8 * 60 * 60 * 1000;

/* WatchedGame: what the screen already knows about a game (from the server). */
export type WatchedGame = { id: string; startsAt: string; status: GameStatus };

/*
  shouldPoll: true if this game could be changing right now: it is live, or it is "scheduled"
  but its start time passed within the last 8 hours (the server's copy may be a few minutes old).
  `latest` is the freshest status we have heard; it beats the server's older copy.
*/
export function shouldPoll(game: WatchedGame, latest: GameStatus | undefined, now: number): boolean {
  const status = latest ?? game.status;
  if (status === "in-progress") return true;
  const sinceStart = now - Date.parse(game.startsAt);
  return status === "scheduled" && sinceStart >= 0 && sinceStart <= SHOULD_HAVE_STARTED_WINDOW_MS;
}

/*
  needsFirstLoad: true if it's worth one request when the screen opens: the game has started,
  finished, or should have started.
*/
export function needsFirstLoad(game: WatchedGame, now: number): boolean {
  return game.status !== "scheduled" || Date.parse(game.startsAt) <= now;
}

/*
  PollerEnvironment: the outside world the poller needs. The real one is the browser; tests give a pretend one.
  - tabIsOpen: is the tab on screen?
  - onTabShown: call `callback` whenever the tab comes back on screen; returns a function that stops listening
*/
export type PollerEnvironment = {
  now: () => number;
  tabIsOpen: () => boolean;
  onTabShown: (callback: () => void) => () => void;
};

/* browserEnvironment: the real browser. */
export const browserEnvironment: PollerEnvironment = {
  now: () => Date.now(),
  tabIsOpen: () => document.visibilityState === "visible",
  onTabShown: (callback) => {
    document.addEventListener("visibilitychange", callback);
    return () => document.removeEventListener("visibilitychange", callback);
  },
};

/*
  startLivePolling: begins refreshing. Gives back a function that stops it.
  - load: asks the server for the watched games (it may throw, meaning "that refresh failed")
  - onGames: gets every game heard so far (the full latest set each time)
  - onDelayed: true after a failed refresh, false after a good one
*/
export function startLivePolling(options: {
  games: readonly WatchedGame[];
  load: () => Promise<LiveGame[]>;
  onGames: (latest: ReadonlyMap<string, LiveGame>) => void;
  onDelayed: (delayed: boolean) => void;
  environment?: PollerEnvironment;
}): () => void {
  const { games, load, onGames, onDelayed, environment = browserEnvironment } = options;
  if (games.length === 0) return () => undefined;

  // The freshest information we have, kept here so the timer always sees the latest.
  const latest = new Map<string, LiveGame>();
  let stopped = false;
  let firstLoadDone = false;

  /* refresh: one request. On failure, keep what we have and say "delayed". */
  async function refresh(): Promise<void> {
    try {
      const fresh = await load();
      if (stopped) return;
      for (const game of fresh) latest.set(game.gameId, game);
      onGames(new Map(latest));
      onDelayed(false);
    } catch {
      if (!stopped) onDelayed(true);
    }
  }

  /* anyLive: could any watched game be changing right now? */
  const anyLive = () => games.some((game) => shouldPoll(game, latest.get(game.id)?.status, environment.now()));

  /* firstLoadIfNeeded: the one load when the screen opens (or when the tab is first looked at). */
  function firstLoadIfNeeded(): boolean {
    if (firstLoadDone || !environment.tabIsOpen()) return false;
    firstLoadDone = true;
    if (!games.some((game) => needsFirstLoad(game, environment.now()))) return false;
    void refresh();
    return true;
  }
  firstLoadIfNeeded();

  const timer = setInterval(() => {
    if (environment.tabIsOpen() && anyLive()) void refresh();
  }, REFRESH_MS);

  const stopListening = environment.onTabShown(() => {
    if (firstLoadIfNeeded()) return;
    if (environment.tabIsOpen() && anyLive()) void refresh();
  });

  return () => {
    stopped = true;
    clearInterval(timer);
    stopListening();
  };
}
