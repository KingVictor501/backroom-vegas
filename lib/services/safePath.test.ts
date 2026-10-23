/*
  FILE: lib/services/safePath.test.ts
  WHAT IT'S FOR: Automatic tests that the address check (safePath.ts) lets
  normal ESPN and Odds API paths through and refuses path traversal tricks.
  Run them with: npm test
  WHO USES IT: Vitest. The app never loads this file.
  WHY THIS NAME: It tests safePath.ts, right next to it. It ends in .ts because it shows nothing on screen.
*/

import { describe, expect, it } from "vitest";
import { assertSafePath, UnsafePathError } from "./safePath";

describe("assertSafePath (path traversal lock)", () => {
  it("allows the normal paths the app uses", () => {
    for (const path of [
      "teams/12",
      "athletes/3139477/gamelog",
      "summary?event=401873022",
      "scoreboard?week=8&seasontype=2",
      "news?team=12&limit=50",
      "seasons/2026/types/2/teams/12/leaders",
      "/sports/americanfootball_nfl/odds",
      "/sports/americanfootball_nfl/events/176d474ed8b2bbf1eb4d7e9c56b4bf22/odds",
    ]) {
      expect(() => assertSafePath(path), path).not.toThrow();
    }
  });

  it("refuses '..' and '.' parts", () => {
    expect(() => assertSafePath("athletes/../news")).toThrow(UnsafePathError);
    expect(() => assertSafePath("teams/./12")).toThrow(UnsafePathError);
    expect(() => assertSafePath("teams/..")).toThrow(UnsafePathError);
  });

  it("refuses encoded tricks: %2e%2e and hidden slashes", () => {
    expect(() => assertSafePath("athletes/%2e%2e/news")).toThrow(UnsafePathError);
    expect(() => assertSafePath("athletes/..%2Fnews")).toThrow(UnsafePathError);
    expect(() => assertSafePath("teams/12%2F..%2F..")).toThrow(UnsafePathError);
    expect(() => assertSafePath("teams/12%5C..")).toThrow(UnsafePathError);
  });

  it("refuses broken encoding", () => {
    expect(() => assertSafePath("teams/%E0%A4%A")).toThrow(UnsafePathError);
  });

  it("only checks the path, not the ?settings after it", () => {
    expect(() => assertSafePath("search?query=../..")).not.toThrow();
  });
});
