/*
  FILE: lib/feed/paging.ts
  WHAT IT'S FOR: The rules for the Feed's game cards: what order they go in, and how they are split into
  pages of 3 rows. Games in progress come first, then upcoming games with the one starting soonest next,
  then finished games (most recent first), then postponed or canceled ones last.
  These are plain functions with no screen code, so the tests in paging.test.ts can check them.
  WHO USES IT: components/feed/GameBrowser.tsx.
  WHY THIS NAME: It's about paging the Feed. It ends in .ts because it shows nothing on screen.
*/

// The shared game status type (scheduled, in-progress, final, ...), from the types folder.
import type { GameStatus } from "@/types";

/** How many rows of cards fit on one page. */
export const PAGE_ROWS = 3;

/** Columns of cards: 1 on phones, 2 on tablets and wider (the same split as the grid in GameBrowser). */
export const PHONE_COLUMNS = 1;
export const WIDE_COLUMNS = 2;

/* pageSize: how many cards are on a page: 3 rows times the number of columns showing right now. */
export function pageSize(columns: number): number {
  return PAGE_ROWS * columns;
}

/* pageCount: how many pages it takes to show this many cards. Always at least 1, even with no cards. */
export function pageCount(total: number, size: number): number {
  return Math.max(1, Math.ceil(total / size));
}

/* clampPage: keeps a page number inside 1..count (for example after a filter leaves fewer pages). */
export function clampPage(page: number, count: number): number {
  return Math.min(Math.max(1, page), count);
}

/* pageItems: the cards for one page. */
export function pageItems<T>(
  items: readonly T[],
  page: number,
  size: number,
): T[] {
  const current = clampPage(page, pageCount(items.length, size));
  return items.slice((current - 1) * size, current * size);
}

/* STATUS_RANK: which group a game belongs to. Lower numbers show first. */
const STATUS_RANK: Record<GameStatus, number> = {
  "in-progress": 0,
  scheduled: 1,
  final: 2,
  postponed: 3,
  canceled: 3,
};

/*
  orderForFeed: a new list in Feed order. The original list is not changed.
  - In progress first, then upcoming (soonest start first), then finished (most recent first), then the rest.
  - Within a group, ties keep their original order (sorting in JavaScript is stable).
  The start times are compared as real dates, because ESPN and The Odds API write the same moment slightly differently.
*/
export function orderForFeed<
  T extends { status: GameStatus; startsAt: string },
>(games: readonly T[]): T[] {
  return [...games].sort((a, b) => {
    const group = STATUS_RANK[a.status] - STATUS_RANK[b.status];
    if (group !== 0) return group;
    const earlier = Date.parse(a.startsAt) - Date.parse(b.startsAt);
    return a.status === "final" ? -earlier : earlier;
  });
}
