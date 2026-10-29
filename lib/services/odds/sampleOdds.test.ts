/*
  FILE: lib/services/odds/sampleOdds.test.ts
  WHAT IT'S FOR: Automatic tests for sample odds mode (sampleOdds.ts and its hook in client.ts),
  using tiny made-up sample files in a temporary folder. They prove:
  - it is OFF unless SAMPLE_ODDS is exactly "true", and OFF in a production build even when set
    (so the live site and Vercel previews can't use it)
  - when on, game lines come from the saved file and NO internet request is made (no credits)
  - one game's markets are filtered to the asked-for ones and merged from the extra files
  - a game that isn't in the samples answers 404, like the real API
  - a missing sample file gives a friendly error, not a crash
  - answers still pass the same schema check as real ones
  WHO USES IT: Vitest, when you run `npm test`.
  WHY THIS NAME: It tests sampleOdds.ts, right next to it. It ends in .ts because it shows nothing on screen.
*/

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UpstreamError } from "@/lib/services/http";
import { oddsGet } from "./client";
import { oddsEventListSchema, oddsEventSchema } from "./schemas";
import { sampleOddsEnabled } from "./sampleOdds";

const outcome = (name: string, price: number, point?: number) => ({ name, price, ...(point !== undefined && { point }) });
const game = (id: string, markets: { key: string; outcomes: ReturnType<typeof outcome>[] }[]) => ({
  id,
  commence_time: "2026-11-01T18:00:00Z",
  home_team: "Dallas Cowboys",
  away_team: "Arizona Cardinals",
  bookmakers: [{ key: "hardrockbet", markets }],
});
const SPREADS = { key: "spreads", outcomes: [outcome("Arizona Cardinals", -110, 3.5), outcome("Dallas Cowboys", -110, -3.5)] };
const TOTALS = { key: "totals", outcomes: [outcome("Over", -105, 47.5), outcome("Under", -115, 47.5)] };
const PROPS = { key: "player_pass_yds", outcomes: [outcome("Over", -115, 250.5)] };

let folder: string;

beforeEach(async () => {
  folder = await mkdtemp(path.join(tmpdir(), "sample-odds-"));
  await writeFile(path.join(folder, "B3-odds-game-lines.json"), JSON.stringify([game("g1", [SPREADS, TOTALS]), game("g2", [SPREADS])]));
  await writeFile(path.join(folder, "B5-event-props.json"), JSON.stringify(game("g1", [PROPS])));
  await writeFile(path.join(folder, "B6-event-halves.json"), JSON.stringify(game("other-game", [PROPS])));
  vi.stubEnv("SAMPLE_ODDS", "true");
  vi.stubEnv("SAMPLE_ODDS_DIR", folder);
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("ODDS_API_KEY", "not-a-real-key");
  // Any real request would be a bug in sample mode, so make it loud.
  vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("the internet must not be used in sample mode"))));
});

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  await rm(folder, { recursive: true, force: true });
});

describe("a league with its own saved file", () => {
  it("the NBA reads its own game-lines file, not the NFL one", async () => {
    await writeFile(path.join(folder, "B3-nba-odds-game-lines.json"), JSON.stringify([game("nba1", [SPREADS])]));
    const events = await oddsGet("/sports/basketball_nba/odds", { markets: "spreads" }, oddsEventListSchema, "game lines");
    expect(events.map((event) => event.id)).toEqual(["nba1"]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("an NBA game is found in its own file, and an NFL game id is not", async () => {
    await writeFile(path.join(folder, "B3-nba-odds-game-lines.json"), JSON.stringify([game("nba1", [SPREADS])]));
    await expect(oddsGet("/sports/basketball_nba/events/nba1/odds", { markets: "spreads" }, oddsEventSchema, "event markets")).resolves.toBeDefined();
    await expect(oddsGet("/sports/basketball_nba/events/g1/odds", { markets: "spreads" }, oddsEventSchema, "event markets")).rejects.toMatchObject({ status: 404 });
  });
});

describe("when sample mode turns on", () => {
  it("is on only when SAMPLE_ODDS is exactly true, outside production", () => {
    expect(sampleOddsEnabled()).toBe(true);
    for (const value of ["", "TRUE", "1", "yes", "false"]) {
      vi.stubEnv("SAMPLE_ODDS", value);
      expect(sampleOddsEnabled()).toBe(false);
    }
  });

  it("is OFF in a production build even when SAMPLE_ODDS=true", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(sampleOddsEnabled()).toBe(false);
  });

  it("in production, a real request is attempted instead of reading samples", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await expect(oddsGet("/sports/americanfootball_nfl/odds", {}, oddsEventListSchema, "game lines")).rejects.toBeDefined();
    expect(fetch).toHaveBeenCalled();
  });
});

describe("answers from the saved samples", () => {
  it("gives every game's lines without using the internet", async () => {
    const events = await oddsGet("/sports/americanfootball_nfl/odds", { markets: "h2h,spreads,totals" }, oddsEventListSchema, "game lines");
    expect(events.map((event) => event.id)).toEqual(["g1", "g2"]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("works even with no API key set", async () => {
    vi.stubEnv("ODDS_API_KEY", "");
    await expect(oddsGet("/sports/americanfootball_nfl/odds", {}, oddsEventListSchema, "game lines")).resolves.toHaveLength(2);
  });

  it("keeps only the asked-for markets for one game, and merges the extra file for the same game", async () => {
    const event = await oddsGet("/sports/americanfootball_nfl/events/g1/odds", { markets: "totals,player_pass_yds" }, oddsEventSchema, "event markets");
    const keys = event.bookmakers?.[0]?.markets.map((market) => market.key).sort();
    expect(keys).toEqual(["player_pass_yds", "totals"]);
  });

  it("does not mix in extra files that belong to a different game", async () => {
    const event = await oddsGet("/sports/americanfootball_nfl/events/g2/odds", { markets: "spreads,player_pass_yds" }, oddsEventSchema, "event markets");
    expect(event.bookmakers?.[0]?.markets.map((market) => market.key)).toEqual(["spreads"]);
  });

  it("answers 404 for a game that isn't in the samples (like the real API)", async () => {
    const failure = await oddsGet("/sports/americanfootball_nfl/events/nope/odds", { markets: "spreads" }, oddsEventSchema, "event markets").catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(UpstreamError);
    expect((failure as UpstreamError).status).toBe(404);
  });

  it("gives a friendly error, not a crash, when a sample file is missing", async () => {
    await rm(path.join(folder, "B3-odds-game-lines.json"));
    const failure = await oddsGet("/sports/americanfootball_nfl/odds", {}, oddsEventListSchema, "game lines").catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(UpstreamError);
    expect((failure as UpstreamError).message).toContain("api-samples");
  });

  it("still checks the answer with the same schema as a real one", async () => {
    await writeFile(path.join(folder, "B3-odds-game-lines.json"), JSON.stringify([{ id: 5 }]));
    await expect(oddsGet("/sports/americanfootball_nfl/odds", {}, oddsEventListSchema, "game lines")).rejects.toBeDefined();
  });
});
