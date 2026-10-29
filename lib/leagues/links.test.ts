/*
  FILE: lib/leagues/links.test.ts
  WHAT IT'S FOR: Automatic tests for the league-aware links (links.ts) and the pieces that use them. They prove:
  - NFL matchup addresses stay exactly as before; NBA ones carry ?league=nba (with other settings after it)
  - team and player page links exist for the NFL and are missing (null) for the NBA
  - ?league= is read safely: missing means NFL, nba works, and typos, tricks, lists, and leagues without
    betting are refused (null → the page says "not found")
  - viewHref keeps the league on every tab address
  - the NBA matchup tabs show only Game Lines, and NBA injury names and team names are plain text, not
    links to football-only pages (while NFL ones are still links)
  WHO USES IT: Vitest, when you run `npm test`.
  WHY THIS NAME: It tests links.ts, right next to it. It ends in .ts because it shows nothing on screen.
*/

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
// The SGP button needs the bet slip provider, which a plain render doesn't have, so it is swapped for a stand-in here.
vi.mock("@/components/betslip/StartSgpButton", () => ({ default: () => null }));
vi.mock("@/components/betslip/OddsButton", () => ({ default: () => null }));

import GameLinesTable from "@/components/feed/GameLinesTable";
import InjuryList from "@/components/InjuryList";
import MatchupTabs from "@/components/matchup/MatchupTabs";
import { viewHref } from "@/lib/matchup/views";
import type { GameWithLines, Injury } from "@/types";
import { hasMoreMarkets, hasStatsPages, matchupHref, parseMatchupLeague, playerHref, teamHref } from "./links";

describe("matchupHref", () => {
  it("keeps NFL addresses as they were, and adds ?league= for the NBA", () => {
    expect(matchupHref("401873022", "nfl")).toBe("/matchup/401873022");
    expect(matchupHref("401873022", "nfl", "props=passing")).toBe("/matchup/401873022?props=passing");
    expect(matchupHref("401909881", "nba")).toBe("/matchup/401909881?league=nba");
    expect(matchupHref("401909881", "nba", "props=passing")).toBe("/matchup/401909881?league=nba&props=passing");
  });
  it("makes odd text safe", () => {
    expect(matchupHref("a/b", "nfl")).toBe("/matchup/a%2Fb");
  });
});

describe("team and player links", () => {
  it("exist for the NFL and are null for the NBA", () => {
    expect(hasStatsPages("nfl")).toBe(true);
    expect(hasStatsPages("nba")).toBe(false);
    expect(teamHref("nfl", "12")).toBe("/team/12");
    expect(playerHref("nfl", "3139477")).toBe("/player/3139477");
    expect(teamHref("nba", "12")).toBeNull();
    expect(playerHref("nba", "3139477")).toBeNull();
    expect(teamHref("not-a-league", "12")).toBeNull();
  });
});

describe("parseMatchupLeague", () => {
  it("missing means the NFL, and nba is allowed", () => {
    expect(parseMatchupLeague(undefined)).toBe("nfl");
    expect(parseMatchupLeague("")).toBe("nfl");
    expect(parseMatchupLeague("nfl")).toBe("nfl");
    expect(parseMatchupLeague("nba")).toBe("nba");
    expect(parseMatchupLeague(["nba", "nfl"])).toBe("nba");
  });
  it.each(["nhl", "mlb", "NBA", "nba ", "../x", "nfl,nba", "$gt", "<script>"])("refuses %j", (value) => {
    expect(parseMatchupLeague(value)).toBeNull();
  });
});

describe("hasMoreMarkets and viewHref", () => {
  it("the NFL has tabs beyond Game Lines; the NBA doesn't", () => {
    expect(hasMoreMarkets("nfl")).toBe(true);
    expect(hasMoreMarkets("nba")).toBe(false);
  });
  it("viewHref keeps the league", () => {
    expect(viewHref("1", { kind: "game-lines" })).toBe("/matchup/1");
    expect(viewHref("1", { kind: "halves" })).toBe("/matchup/1?market=halves");
    expect(viewHref("1", { kind: "game-lines" }, "nba")).toBe("/matchup/1?league=nba");
    expect(viewHref("1", { kind: "quarters", quarter: 2 }, "nba")).toBe("/matchup/1?league=nba&market=quarters&quarter=2");
  });
});

describe("components in a league without team and player pages", () => {
  const team = (id: string, name: string) => ({ id, abbreviation: name.slice(0, 3).toUpperCase(), displayName: name, name, logoUrl: null, record: "1-0", color: null });
  const game = (league: string) =>
    ({ id: "1", league, startsAt: "2026-10-29T00:30:00Z", status: "scheduled", awayScore: null, homeScore: null, venue: null, oddsEventId: null, winProbability: null, lines: null, awayTeam: team("14", "Heat"), homeTeam: team("1", "Hawks") }) as unknown as GameWithLines;

  it("the odds table links team names for the NFL but not for the NBA", () => {
    const nfl = renderToStaticMarkup(createElement(GameLinesTable, { game: game("nfl"), sportsbook: "hardrock" }));
    const nba = renderToStaticMarkup(createElement(GameLinesTable, { game: game("nba"), sportsbook: "hardrock" }));
    expect(nfl).toContain('href="/team/14"');
    expect(nba).not.toContain("/team/");
    expect(nba).toContain("Heat");
  });

  const injuries: Injury[] = [{ player: { id: "9", name: "Jimmy Butler", position: "SF" }, status: "Questionable", detail: "Knee" } as unknown as Injury];
  it("injury names link to a player page for the NFL but not for the NBA", () => {
    expect(renderToStaticMarkup(createElement(InjuryList, { injuries }))).toContain('href="/player/9"');
    const nba = renderToStaticMarkup(createElement(InjuryList, { injuries, league: "nba" }));
    expect(nba).not.toContain("/player/");
    expect(nba).toContain("Jimmy Butler");
  });

  it("the matchup tabs show the market row for the NFL and only Odds for the NBA", () => {
    const nfl = renderToStaticMarkup(createElement(MatchupTabs, { gameId: "1", gameLabel: "A @ B", view: { kind: "game-lines" }, league: "nfl" }));
    const nba = renderToStaticMarkup(createElement(MatchupTabs, { gameId: "1", gameLabel: "A @ B", view: { kind: "game-lines" }, league: "nba" }));
    expect(nfl).toContain("Player Props");
    expect(nba).not.toContain("Player Props");
    expect(nba).not.toContain("Halves");
    expect(nba).toContain("league=nba");
    expect(nba).toContain("Odds");
  });
});
