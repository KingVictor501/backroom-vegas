/*
  FILE: components/matchup/AutoRefresh.tsx
  WHAT IT'S FOR: Draws nothing. While a game is on and the browser tab is open, it asks the matchup page to
  reload its server-built parts (the stats tables) about every 30 seconds, without a full page reload.
  It uses the same timing rule as the live scores (components/live/livePoller.ts: shouldPoll), so it stops
  once the game is final.
  WHO USES IT: components/matchup/GameStats.tsx.
  WHY THIS NAME: It refreshes by itself. It ends in .tsx because it is a React component, even though it draws nothing.
*/

// "use client": timers and the router only exist in the browser.
"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { REFRESH_MS, shouldPoll } from "@/components/live/livePoller";
import type { GameStatus } from "@/types";

/* AutoRefresh: the game's start time and latest status come from the server's copy of the page. */
export default function AutoRefresh({ gameId, league, startsAt, status }: { gameId: string; league: string; startsAt: string; status: GameStatus }) {
  const router = useRouter();
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (!shouldPoll({ id: gameId, league, startsAt, status }, undefined, Date.now())) return;
      // refresh(): re-runs the server parts of this page; the page keeps its scroll position and any typed text.
      router.refresh();
    }, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [router, gameId, league, startsAt, status]);
  return null;
}
