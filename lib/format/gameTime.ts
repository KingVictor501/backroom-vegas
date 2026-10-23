/*
  FILE: lib/format/gameTime.ts
  WHAT IT'S FOR: Turns a game's start time into words for game cards and tables:
  "Today", "Tomorrow", "Sunday", or "Sun, Nov 2", plus "4:25 PM ET".
  WHY EASTERN TIME: The server builds the page, and it doesn't know what time
  zone your phone is in. NFL schedules are listed in Eastern time, so we always
  use it and say "ET", so the time is never wrong or confusing. The same rule
  decides what "Today" means for the Today filter.
  WHO USES IT: components/feed (game cards and the Today filter), the matchup
  page header, and the team page tables. Later: bet slip pages (Section 12).
  WHY THIS NAME: It formats game times, in lib/format. It ends in .ts because
  it shows nothing on screen. It's safe to use in the browser.
*/

/** The time zone every game time is shown in. */
const TIME_ZONE = "America/New_York";

/* easternDate: the calendar date in Eastern time, like "2026-10-25", for comparing days. */
function easternDate(date: Date): string {
  // "en-CA" writes dates as year-month-day, which is easy to compare.
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

/* daysBetween: how many calendar days from one Eastern date to another (0 = same day). */
function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/*
  gameDayLabel: the day part of a game's time.
  - same day → "Today", next day → "Tomorrow"
  - later this week → the day name, like "Sunday"
  - 7 or more days away → "Sun, Nov 2" (so two Sundays can't be confused)
*/
export function gameDayLabel(startsAt: string, now: Date = new Date()): string {
  const start = new Date(startsAt);
  const days = daysBetween(easternDate(now), easternDate(start));
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days > 1 && days < 7) {
    return new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, weekday: "long" }).format(start);
  }
  return new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, weekday: "short", month: "short", day: "numeric" }).format(start);
}

/* gameTimeLabel: the clock time, like "4:25 PM ET". */
export function gameTimeLabel(startsAt: string): string {
  const time = new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, hour: "numeric", minute: "2-digit" }).format(new Date(startsAt));
  return `${time} ET`;
}

/* isToday: true if the game starts today (Eastern time). Used by the Today filter. */
export function isToday(startsAt: string, now: Date = new Date()): boolean {
  return easternDate(new Date(startsAt)) === easternDate(now);
}

/* shortDate: a game's date, like "Oct 18" (Eastern time). Used in past-game tables. */
export function shortDate(startsAt: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, month: "short", day: "numeric" }).format(new Date(startsAt));
}
