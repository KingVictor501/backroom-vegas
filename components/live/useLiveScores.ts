/*
  FILE: components/live/useLiveScores.ts
  WHAT IT'S FOR: A "hook" (a reusable piece of browser logic) that keeps live scores fresh for the
  games on a screen. Give it the games you are showing; it gives back the latest live information
  for each, and a flag saying whether the last refresh failed ("Scores delayed").
  The timing rules (every 30 seconds, only while a game is live and the tab is open, keep the last
  scores if a refresh fails) live in livePoller.ts, where they are tested. This file connects them to the screen.
  Scores come from our own route, /api/live (components never call ESPN directly, so keys and limits stay on the server).
  WHO USES IT: components/feed/GameBrowser.tsx, components/matchup/MatchupHeader.tsx, components/betslips/SlipDetail.tsx.
  WHY THIS NAME: React hooks start with "use". It ends in .ts because it draws nothing itself.
*/
"use client";

import { useEffect, useState } from "react";
import { startLivePolling, type WatchedGame } from "./livePoller";
import type { GameStatus, LiveGame, LiveScoresResponse } from "@/types";

export type { WatchedGame } from "./livePoller";

/** The most games one request may ask about (the route allows 25). */
const MAX_GAMES = 25;

/*
  useLiveScores
  - league: like "nfl"
  - watched: the games on screen (the server's copy of each)
  - includeStats: also ask for the box score (needed to grade player props on slips)
*/
export function useLiveScores(
  league: string,
  watched: readonly WatchedGame[],
  includeStats = false,
): { live: ReadonlyMap<string, LiveGame>; delayed: boolean } {
  const [live, setLive] = useState<ReadonlyMap<string, LiveGame>>(new Map());
  const [delayed, setDelayed] = useState(false);

  // A plain text summary of what is being watched. It only changes when the games really change,
  // so the effect below doesn't restart on every redraw.
  const signature = watched
    .slice(0, MAX_GAMES)
    .map((game) => `${game.id}|${game.startsAt}|${game.status}`)
    .sort()
    .join(",");

  useEffect(() => {
    const games: WatchedGame[] = signature
      ? signature.split(",").map((part) => {
          const [id, startsAt, status] = part.split("|");
          return { id, startsAt, status: status as GameStatus };
        })
      : [];
    const controller = new AbortController();

    const stop = startLivePolling({
      games,
      onGames: setLive,
      onDelayed: setDelayed,
      load: async () => {
        const query = new URLSearchParams({ league, games: games.map((game) => game.id).join(","), stats: String(includeStats) });
        const response = await fetch(`/api/live?${query}`, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error("Live scores request failed");
        return ((await response.json()) as LiveScoresResponse).games;
      },
    });

    return () => {
      controller.abort();
      stop();
    };
  }, [league, signature, includeStats]);

  return { live, delayed };
}
