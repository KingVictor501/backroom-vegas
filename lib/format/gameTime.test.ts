/*
  FILE: lib/format/gameTime.test.ts
  WHAT IT'S FOR: Automatic tests for the game time words ("Today", "Tomorrow",
  "Sunday", "4:25 PM ET") and the Today filter. Each test pretends "now" is a
  fixed moment, so the results never change from day to day.
  Run them with: npm test
  WHO USES IT: Vitest. The app never loads this file.
  WHY THIS NAME: It tests gameTime.ts, right next to it. It ends in .ts because it shows nothing on screen.
*/

import { describe, expect, it } from "vitest";
import { gameDayLabel, gameTimeLabel, isToday } from "./gameTime";

/* "Now" for these tests: Thursday, Oct 22, 2026, 3:00 PM Eastern. */
const NOW = new Date("2026-10-22T19:00:00Z");

describe("game time words (Eastern time)", () => {
  it("says Today for a game later today", () => {
    expect(gameDayLabel("2026-10-23T00:15Z", NOW)).toBe("Today"); // 8:15 PM ET Thursday
  });

  it("says Tomorrow for a game tomorrow", () => {
    expect(gameDayLabel("2026-10-23T23:00Z", NOW)).toBe("Tomorrow");
  });

  it("says the day name later this week", () => {
    expect(gameDayLabel("2026-10-25T20:25Z", NOW)).toBe("Sunday");
  });

  it("adds the date 7 or more days away, so two Sundays can't be confused", () => {
    expect(gameDayLabel("2026-11-01T18:00Z", NOW)).toBe("Sun, Nov 1");
  });

  it("uses Eastern time, so a late game isn't shown as the next day", () => {
    // 12:15 AM UTC Friday is still 8:15 PM Thursday in New York.
    expect(isToday("2026-10-23T00:15Z", NOW)).toBe(true);
    expect(gameTimeLabel("2026-10-23T00:15Z")).toBe("8:15 PM ET");
  });

  it("Today filter leaves out tomorrow's games", () => {
    expect(isToday("2026-10-23T23:00Z", NOW)).toBe(false);
  });
});
