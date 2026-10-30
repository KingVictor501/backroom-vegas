/*
  FILE: components/feed/GameBrowser.tsx
  WHAT IT'S FOR: Everything on the Feed and league page, in the order of your
  LAYOUT section:
  1. the "Find a team or player" search bar (it also filters the games)
  2. the league tabs
  3. the bet-type buttons (Game Lines, Passing, Rushing, Receiving, Touchdowns)
  4. the This Week / Today filter (This Week = now through Monday night)
  5. the game cards (one column on phones, two on tablets and up), 3 rows per page with a page indicator under them.
  Games in progress come first, then upcoming games by soonest start (see lib/feed/paging.ts)
  The games arrive already loaded by the SERVER, so they're in the page even
  with JavaScript turned off. This file only filters what's already there,
  which is why typing "Chiefs" updates instantly, with no waiting.
  WHO USES IT: components/feed/LeagueGames.tsx (used by the Feed and /league/nfl).
  WHY THIS NAME: It's for browsing games. It ends in .tsx because it shows something on screen.
*/

// "use client": this part reacts to typing and tapping, so it runs in the browser too.
"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
// isToday and isThisFeedWeek from lib/format/gameTime.ts: what "Today" and "This Week" mean (Eastern time).
import { isThisFeedWeek, isToday } from "@/lib/format/gameTime";
// Live scores: the refresh hook and the "Scores delayed" note, from components/live.
import ScoresDelayed from "@/components/live/ScoresDelayed";
import { useLiveScores } from "@/components/live/useLiveScores";
// The shared types: a game with odds, a team, and a sportsbook ID.
import type { GameWithLines, SportsbookId, TeamSummary } from "@/types";
// The pieces of the page, from the files next to this one.
// The Feed's card order and pages of 3 rows, from lib/feed/paging.ts (tested there).
import {
  clampPage,
  orderForFeed,
  pageCount,
  pageItems,
  pageSize,
  PHONE_COLUMNS,
  WIDE_COLUMNS,
} from "@/lib/feed/paging";
import GameCard, { type PropsLink } from "./GameCard";
import LeagueTabs from "./LeagueTabs";
import SearchBar from "./SearchBar";

/* DateFilter: the two filter buttons. "This Week" is the default and never reaches past Monday night (see isThisFeedWeek). */
type DateFilter = "week" | "today";
const DATE_FILTERS: { value: DateFilter; label: string }[] = [
  { value: "week", label: "This Week" },
  { value: "today", label: "Today" },
];

/*
  useColumns: how many columns of cards fit: 2 on tablets and wider (the same 768px break as Tailwind's "md:"), 1 on phones.
  useSyncExternalStore is React's tool for reading something from the browser (here, the screen width) and
  redrawing when it changes. The last function is the answer used on the server, which has no screen (phone layout).
*/
function useColumns(): number {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia("(min-width: 768px)");
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () =>
      window.matchMedia("(min-width: 768px)").matches
        ? WIDE_COLUMNS
        : PHONE_COLUMNS,
    () => PHONE_COLUMNS,
  );
}

/* teamMatches: true if the typed words are part of the team's name, city, or code ("chiefs", "kansas", "kc"). */
function teamMatches(team: TeamSummary, words: string): boolean {
  return [team.displayName, team.abbreviation].some((name) =>
    name.toLowerCase().includes(words),
  );
}

/* toSlug: "Game Lines" → "game-lines", "Passing" → "passing". */
function toSlug(label: string): string {
  return label.toLowerCase().replace(/\s+/g, "-");
}

/*
  GameBrowser
  - leagueSlug / leagueLabel: the league shown, like "nfl" / "NFL"
  - betTypes: the bet-type buttons for this league (from config/leagues.ts)
  - weekEndsOn: the last day of this league's week (from config/leagues.ts), for the This Week list
  - games: every upcoming game, soonest first, already loaded by the server
  - sportsbook / sportsbookName: the user's book (from Settings)
  - oddsUnavailable: true if The Odds API couldn't be reached
  - scoresOnly: true for a league with schedules and live scores but no betting features yet (like the NBA)
*/
export default function GameBrowser({
  leagueSlug,
  leagueLabel,
  betTypes,
  weekEndsOn,
  games,
  sportsbook,
  sportsbookName,
  oddsUnavailable,
  scoresOnly,
}: {
  leagueSlug: string;
  leagueLabel: string;
  betTypes: readonly string[];
  weekEndsOn: number;
  games: GameWithLines[];
  sportsbook: SportsbookId;
  sportsbookName: string;
  oddsUnavailable: boolean;
  scoresOnly: boolean;
}) {
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("week");
  // The first bet type ("Game Lines") is picked when the page opens.
  const [betType, setBetType] = useState(betTypes[0]);
  // Which page of cards is showing. Changing the search or filter goes back to page 1 (see goToFirstPage).
  const [page, setPage] = useState(1);
  // The "Show live games" tick box. Unchecked when the page opens, so games in progress are hidden until it is ticked.
  const [showLive, setShowLive] = useState(false);
  const columns = useColumns();

  const words = search.trim().toLowerCase();
  // Only this week's games (ends on the league's last day, set in config/leagues.ts: Monday night for the NFL, Saturday for the NBA). A game in progress always counts.
  const weekGames = games.filter(
    (game) =>
      game.status === "in-progress" ||
      isThisFeedWeek(game.startsAt, new Date(), weekEndsOn),
  );
  const matching = weekGames.filter((game) => {
    if (!showLive && game.status === "in-progress") return false;
    if (dateFilter === "today" && !isToday(game.startsAt)) return false;
    return (
      words === "" ||
      teamMatches(game.awayTeam, words) ||
      teamMatches(game.homeTeam, words)
    );
  });

  // Games in progress first, then upcoming games by soonest start; cut into pages of 3 rows.
  const ordered = orderForFeed(matching);
  const size = pageSize(columns);
  const pages = pageCount(ordered.length, size);
  const currentPage = clampPage(page, pages);
  const shown = pageItems(ordered, currentPage, size);

  // Live scores for the cards on this page only (refreshed about every 30 seconds, only while one is live and the tab is open).
  const { live, delayed } = useLiveScores(shown);

  // Back to page 1 whenever the search or filter changes, so the new results start at the top.
  const goToFirstPage = () => setPage(1);

  // Any bet type other than the first (Game Lines) adds a "See ___ props" link to each card.
  const propsLink: PropsLink | null =
    betType === betTypes[0] ? null : { label: betType, slug: toSlug(betType) };

  // The small outlined button look, gold when picked.
  const chip = (picked: boolean) =>
    `min-h-10 shrink-0 whitespace-nowrap rounded-full border px-4 text-sm font-medium transition-colors ${
      picked
        ? "border-gold bg-gold/10 text-gold"
        : "border-line text-muted hover:border-muted hover:text-text"
    }`;

  return (
    <div className="space-y-4">
      <SearchBar
        value={search}
        onChange={(value) => {
          setSearch(value);
          goToFirstPage();
        }}
      />
      <LeagueTabs activeSlug={leagueSlug} />

      {/* The bet-type buttons stay on ONE line and scroll sideways when they don't fit. */}
      <div
        role="group"
        aria-label="Bet type"
        className="scroll-row -mx-4 flex flex-nowrap gap-2 px-4 pb-1 sm:mx-0 sm:px-0"
      >
        {betTypes.map((type) => (
          <button
            key={type}
            type="button"
            aria-pressed={betType === type}
            onClick={() => setBetType(type)}
            className={chip(betType === type)}
          >
            {type}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Show games" className="flex gap-2">
          {DATE_FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              aria-pressed={dateFilter === filter.value}
              onClick={() => {
                setDateFilter(filter.value);
                goToFirstPage();
              }}
              className={chip(dateFilter === filter.value)}
            >
              {filter.label}
            </button>
          ))}
        </div>
        {!scoresOnly && (
          <p className="text-xs text-muted">
            Odds from{" "}
            <span className="font-semibold text-text">{sportsbookName}</span> ·{" "}
            <Link
              href="/settings"
              className="text-gold underline-offset-4 hover:underline"
            >
              Change
            </Link>
          </p>
        )}
      </div>

      {/* A scores-only league (the NBA): say so plainly instead of showing empty odds. */}
      {scoresOnly && (
        <p
          role="status"
          className="rounded-xl border border-line bg-card px-4 py-3 text-sm text-muted"
        >
          {leagueLabel} odds and betting are coming soon. For now you can follow
          today&apos;s games and live scores.
        </p>
      )}

      {propsLink && (
        <p className="rounded-xl border border-line bg-card px-4 py-3 text-sm text-muted">
          Tap{" "}
          <span className="font-semibold text-gold">
            See {propsLink.label} props
          </span>{" "}
          on a game to see its {propsLink.label.toLowerCase()} props.
        </p>
      )}

      {/* The chosen book has no odds on ANY game (a book with no odds in The Odds API, like Caesars did before it was removed), so say so instead of showing only dashes. */}
      {!scoresOnly &&
        !oddsUnavailable &&
        weekGames.length > 0 &&
        weekGames.every((game) => game.lines === null) && (
          <p
            role="status"
            className="rounded-xl border border-line bg-card px-4 py-3 text-sm text-muted"
          >
            {sportsbookName} hasn&apos;t posted odds for these games yet.{" "}
            <Link
              href="/settings"
              className="font-semibold text-gold underline-offset-4 hover:underline"
            >
              Try another sportsbook in Settings
            </Link>
            .
          </p>
        )}

      {oddsUnavailable && (
        <p
          role="status"
          className="rounded-xl border border-danger/50 bg-card px-4 py-3 text-sm text-danger"
        >
          Odds aren&apos;t available right now, so prices show as dashes. Please
          try again in a few minutes.
        </p>
      )}

      <ScoresDelayed show={delayed} />

      {/* The tick box above the cards: live games (in progress) stay hidden until it is checked. */}
      <label className="flex min-h-11 w-fit cursor-pointer items-center gap-3 text-sm font-medium text-text">
        <input
          type="checkbox"
          checked={showLive}
          onChange={(event) => {
            setShowLive(event.target.checked);
            goToFirstPage();
          }}
          className="size-5 accent-gold"
        />
        Show live games
      </label>

      {/* aria-live: screen readers hear how many games match after each change. */}
      <p aria-live="polite" className="sr-only">
        {ordered.length} {ordered.length === 1 ? "game" : "games"} match. Page{" "}
        {currentPage} of {pages}.
      </p>

      {shown.length > 0 ? (
        <>
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {shown.map((game) => (
              <li key={game.id}>
                <GameCard
                  game={game}
                  sportsbook={sportsbook}
                  propsLink={propsLink}
                  live={live.get(game.id)}
                  scoresOnly={scoresOnly}
                />
              </li>
            ))}
          </ul>
          {/* The page indicator: only shown when there is more than one page. */}
          {pages > 1 && (
            <nav
              aria-label="Game pages"
              className="flex items-center justify-center gap-2 pt-2"
            >
              <button
                type="button"
                onClick={() => setPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="min-h-11 rounded-xl border border-line px-4 text-sm font-semibold text-text hover:border-gold disabled:opacity-40"
              >
                Previous
              </button>
              <ol className="flex items-center gap-1">
                {Array.from({ length: pages }, (_, index) => index + 1).map(
                  (number) => (
                    <li key={number}>
                      <button
                        type="button"
                        onClick={() => setPage(number)}
                        aria-label={`Page ${number}`}
                        aria-current={
                          number === currentPage ? "page" : undefined
                        }
                        className={`min-h-11 min-w-11 rounded-xl border text-sm font-semibold ${
                          number === currentPage
                            ? "border-gold bg-gold/10 text-gold"
                            : "border-line text-muted hover:border-muted hover:text-text"
                        }`}
                      >
                        {number}
                      </button>
                    </li>
                  ),
                )}
              </ol>
              <button
                type="button"
                onClick={() => setPage(currentPage + 1)}
                disabled={currentPage === pages}
                className="min-h-11 rounded-xl border border-line px-4 text-sm font-semibold text-text hover:border-gold disabled:opacity-40"
              >
                Next
              </button>
            </nav>
          )}
        </>
      ) : (
        <div className="space-y-3 rounded-2xl border border-line bg-card p-6 text-center">
          {/*
            Not red on purpose: this isn't always a mistake. Typing a PLAYER's name finds
            them in the search above, but games are only filtered by TEAM names. A real
            typo already shows the red "No teams or players match" message in the search bar.
          */}
          <p className="text-sm text-muted">
            {weekGames.length === 0
              ? `No ${leagueLabel} games left this week.`
              : words
                ? `No games match "${search.trim()}". Games are filtered by team name, like "Chiefs" or "KC".`
                : "No games for this filter."}
          </p>
          {(words || dateFilter !== "week") && weekGames.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setDateFilter("week");
              }}
              className="min-h-11 rounded-xl border border-gold px-4 text-sm font-semibold text-gold hover:bg-gold hover:text-bg"
            >
              Show all games
            </button>
          )}
        </div>
      )}
    </div>
  );
}
