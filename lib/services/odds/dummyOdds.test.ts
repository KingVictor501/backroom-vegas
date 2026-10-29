/*
  FILE: lib/services/odds/dummyOdds.test.ts
  WHAT IT'S FOR: Checks the practice odds: they turn on only for the Preview site (or your computer) with
  DUMMY_ODDS=true, never on the live site, always match the ESPN game, and are the same every time.
  WHO USES IT: `npm test` (Vitest).
  WHY THIS NAME: It tests dummyOdds.ts; ".test.ts" is how Vitest finds test files.
*/

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { Game } from "@/types";
import { dummyGameLines, dummyOddsEnabled } from "./dummyOdds";
import { findOddsEvent } from "./match";

const team = (id: string, displayName: string) => ({ id, abbreviation: displayName.slice(0, 3).toUpperCase(), displayName, name: displayName, location: displayName, logoUrl: null, record: null });
const game = (league: string, id: string): Game =>
  ({ id, league, startsAt: "2026-10-29T00:30:00Z", status: "scheduled", awayScore: null, homeScore: null, venue: null, oddsEventId: null, winProbability: null, awayTeam: team("1", "Miami Heat"), homeTeam: team("2", "Atlanta Hawks") }) as unknown as Game;

afterEach(() => vi.unstubAllEnvs());

describe("dummyOddsEnabled", () => {
  it("is off unless DUMMY_ODDS is exactly true", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(dummyOddsEnabled()).toBe(false);
    vi.stubEnv("DUMMY_ODDS", "yes");
    expect(dummyOddsEnabled()).toBe(false);
  });
  it("is on for the Preview site and off for the live site", () => {
    vi.stubEnv("DUMMY_ODDS", "true");
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(dummyOddsEnabled()).toBe(true);
    vi.stubEnv("VERCEL_ENV", "production");
    expect(dummyOddsEnabled()).toBe(false);
  });
});

describe("dummyGameLines", () => {
  it("makes lines for all three books that match the ESPN game, the same way every time", () => {
    const games = [game("nba", "401909001")];
    const first = dummyGameLines(games);
    expect(JSON.stringify(dummyGameLines(games))).toBe(JSON.stringify(first));
    expect(first[0].bookmakers).toHaveLength(3);
    expect(first[0].bookmakers?.[0].markets.map((m) => m.key)).toEqual(["h2h", "spreads", "totals"]);
    expect(findOddsEvent(games[0], first)).not.toBeNull();
  });
  it("uses basketball-sized totals for the NBA and football-sized totals for the NFL", () => {
    const total = (g: Game) => dummyGameLines([g])[0].bookmakers?.[0].markets.find((m) => m.key === "totals")?.outcomes[0].point ?? 0;
    expect(total(game("nba", "5"))).toBeGreaterThan(200);
    expect(total(game("nfl", "5"))).toBeLessThan(60);
  });
});
