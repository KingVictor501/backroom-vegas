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
import {
  gameDayLabel,
  gameTimeLabel,
  isThisFeedWeek,
  isToday,
} from "./gameTime";

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

describe("isThisFeedWeek (a week runs Tuesday through Monday night, Eastern time)", () => {
  it("on a Thursday, includes everything from today through Monday night", () => {
    expect(isThisFeedWeek("2026-10-23T00:15Z", NOW)).toBe(true); // Thursday night game, 8:15 PM ET
    expect(isThisFeedWeek("2026-10-25T17:00Z", NOW)).toBe(true); // Sunday 1:00 PM ET
    expect(isThisFeedWeek("2026-10-27T00:15Z", NOW)).toBe(true); // Monday night, 8:15 PM ET
  });

  it("on a Thursday, leaves out last week and the Tuesday after Monday night", () => {
    expect(isThisFeedWeek("2026-10-21T00:15Z", NOW)).toBe(false); // Tuesday before
    expect(isThisFeedWeek("2026-10-28T00:15Z", NOW)).toBe(false); // Tuesday 8:15 PM ET, next week
    expect(isThisFeedWeek("2026-10-30T00:15Z", NOW)).toBe(false); // next Thursday
  });

  it("on a Tuesday, a new week starts: the window runs to the next Monday night", () => {
    const tuesday = new Date("2026-10-27T16:00:00Z");
    expect(isThisFeedWeek("2026-10-30T00:15Z", tuesday)).toBe(true); // Thursday night game
    expect(isThisFeedWeek("2026-11-03T00:15Z", tuesday)).toBe(true); // Monday night, Nov 2 ET
    expect(isThisFeedWeek("2026-11-04T00:15Z", tuesday)).toBe(false); // the Tuesday after
  });

  it("on a Monday, only today counts", () => {
    const monday = new Date("2026-10-26T15:00:00Z");
    expect(isThisFeedWeek("2026-10-27T00:15Z", monday)).toBe(true);
    expect(isThisFeedWeek("2026-10-28T00:15Z", monday)).toBe(false);
  });

  it("uses the Eastern calendar day, so a late game stays on its own day", () => {
    // 11:30 PM ET Monday is already Tuesday in UTC, but it is still Monday in Eastern time.
    expect(isThisFeedWeek("2026-10-27T03:30Z", NOW)).toBe(true);
  });
});
