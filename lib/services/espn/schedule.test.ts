/*
  FILE: lib/services/espn/schedule.test.ts
  WHAT IT'S FOR: Checks the "Remaining schedule" on the team page: finished and canceled games are left out, the
  rest come soonest first, home/away and the stadium are right, and a missing stadium is kept as "missing".
  WHO USES IT: `npm test` (Vitest).
  WHY THIS NAME: It tests schedule.ts; ".test.ts" is how Vitest finds test files.
*/

import { describe, expect, it, vi } from "vitest";

// "server-only" would refuse to load outside the server; tests are not the browser, so stub it.
vi.mock("server-only", () => ({}));

import type { EspnEvent } from "./schemas";
import { toUpcomingGames } from "./schedule";

/* event: a pretend ESPN game between team "1" (us) and team "2", with the given date, state and home team. */
function event(id: string, date: string, state: "pre" | "in" | "post", options: { home?: "us" | "them"; venue?: string; name?: string } = {}): EspnEvent {
  const home = options.home ?? "us";
  const team = (teamId: string) => ({ id: teamId, abbreviation: `T${teamId}`, displayName: `Team ${teamId}`, name: `Team ${teamId}`, location: "City" });
  return {
    id,
    date,
    status: { type: { name: options.name ?? (state === "post" ? "STATUS_FINAL" : "STATUS_SCHEDULED"), state, completed: state === "post" } },
    competitions: [
      {
        venue: options.venue ? { fullName: options.venue } : undefined,
        competitors: [
          { id: "1", homeAway: home === "us" ? "home" : "away", team: team("1") },
          { id: "2", homeAway: home === "us" ? "away" : "home", team: team("2") },
        ],
      },
    ],
  } as unknown as EspnEvent;
}

describe("toUpcomingGames", () => {
  it("keeps only games not finished, soonest first", () => {
    const games = toUpcomingGames(
      [event("c", "2026-11-15T18:00Z", "pre"), event("a", "2026-10-20T18:00Z", "post"), event("b", "2026-11-08T18:00Z", "pre")],
      "1",
      "nfl",
    );
    expect(games.map((g) => g.gameId)).toEqual(["b", "c"]);
  });

  it("reads home or away and the stadium, and keeps a missing stadium as null", () => {
    const [home, away] = toUpcomingGames(
      [event("h", "2026-11-08T18:00Z", "pre", { home: "us", venue: "Arrowhead Stadium" }), event("x", "2026-11-15T18:00Z", "pre", { home: "them" })],
      "1",
      "nfl",
    );
    expect(home.isHome).toBe(true);
    expect(home.venue).toBe("Arrowhead Stadium");
    expect(home.opponent.id).toBe("2");
    expect(away.isHome).toBe(false);
    expect(away.venue).toBeNull();
  });

  it("shows a game being played now and a postponed one, but not a canceled one", () => {
    const games = toUpcomingGames(
      [
        event("live", "2026-11-01T18:00Z", "in", { name: "STATUS_IN_PROGRESS" }),
        event("pp", "2026-11-08T18:00Z", "pre", { name: "STATUS_POSTPONED" }),
        event("cx", "2026-11-15T18:00Z", "pre", { name: "STATUS_CANCELED" }),
      ],
      "1",
      "nba",
    );
    expect(games.map((g) => [g.gameId, g.status])).toEqual([["live", "in-progress"], ["pp", "postponed"]]);
  });

  it("gives an empty list when the season is over", () => {
    expect(toUpcomingGames([event("a", "2026-10-20T18:00Z", "post")], "1", "nfl")).toEqual([]);
  });
});
