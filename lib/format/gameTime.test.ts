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
  feedWeekDays,
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

describe("isThisFeedWeek for a Sunday-to-Saturday league (weekEndsOn 6, like the NBA)", () => {
  it("on a Thursday, includes Friday and Saturday but not Sunday", () => {
    expect(isThisFeedWeek("2026-10-24T23:30Z", NOW, 6)).toBe(true); // Saturday 7:30 PM ET
    expect(isThisFeedWeek("2026-10-25T23:30Z", NOW, 6)).toBe(false); // Sunday starts the next week
  });

  it("on a Sunday, a whole new week starts and runs through the next Saturday", () => {
    const sunday = new Date("2026-10-25T16:00:00Z");
    expect(isThisFeedWeek("2026-10-26T23:30Z", sunday, 6)).toBe(true); // Monday
    expect(isThisFeedWeek("2026-10-31T23:30Z", sunday, 6)).toBe(true); // Saturday
    expect(isThisFeedWeek("2026-11-01T23:30Z", sunday, 6)).toBe(false); // the next Sunday
  });

  it("on a Saturday, only today counts", () => {
    const saturday = new Date("2026-10-24T16:00:00Z");
    expect(isThisFeedWeek("2026-10-25T00:30Z", saturday, 6)).toBe(true); // 8:30 PM ET Saturday
    expect(isThisFeedWeek("2026-10-25T23:30Z", saturday, 6)).toBe(false);
  });
});

describe("feedWeekDays", () => {
  it("lists each Eastern day from today to the week's last day, in ESPN's form", () => {
    expect(feedWeekDays(NOW, 6)).toEqual(["20261022", "20261023", "20261024"]); // Thu, Fri, Sat
    expect(feedWeekDays(NOW, 1)).toEqual([
      "20261022",
      "20261023",
      "20261024",
      "20261025",
      "20261026",
    ]); // Thu to Mon
  });

  it("is just today on the week's last day, and crosses month ends", () => {
    expect(feedWeekDays(new Date("2026-10-24T16:00:00Z"), 6)).toEqual([
      "20261024",
    ]);
    expect(feedWeekDays(new Date("2026-10-29T16:00:00Z"), 6)).toEqual([
      "20261029",
      "20261030",
      "20261031",
    ]);
    expect(feedWeekDays(new Date("2026-11-01T17:00:00Z"), 6)).toEqual([
      "20261101",
      "20261102",
      "20261103",
      "20261104",
      "20261105",
      "20261106",
      "20261107",
    ]);
  });

  it("uses the Eastern day, even when UTC has already moved on", () => {
    // 11:30 PM ET Thursday is already Friday in UTC.
    expect(feedWeekDays(new Date("2026-10-23T03:30:00Z"), 6)[0]).toBe(
      "20261022",
    );
  });
});
