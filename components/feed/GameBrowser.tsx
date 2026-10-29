/*
  FILE: components/feed/GameBrowser.tsx
  WHAT IT'S FOR: Everything on the Feed and league page, in the order of your
  LAYOUT section:
  1. the "Find a team or player" search bar (it also filters the games)
  2. the league tabs
  3. the bet-type buttons (Game Lines, Passing, Rushing, Receiving, Touchdowns)
  4. the All / Today / This Week filter
  5. the game cards (one column on phones, two on tablets and up)
  The games arrive already loaded by the SERVER, so they're in the page even
  with JavaScript turned off. This file only filters what's already there,
  which is why typing "Chiefs" updates instantly, with no waiting.
  WHO USES IT: components/feed/LeagueGames.tsx (used by the Feed and /league/nfl).
  WHY THIS NAME: It's for browsing games. It ends in .tsx because it shows something on screen.
*/

// "use client": this part reacts to typing and tapping, so it runs in the browser too.
"use client";

import Link from "next/link";
import { useState } from "react";
// isToday from lib/format/gameTime.ts: what "Today" means (Eastern time).
import { isToday } from "@/lib/format/gameTime";
// Live scores: the refresh hook and the "Scores delayed" note, from components/live.
import ScoresDelayed from "@/components/live/ScoresDelayed";
import { useLiveScores } from "@/components/live/useLiveScores";
// The shared types: a game with odds, a team, and a sportsbook ID.
import type { GameWithLines, SportsbookId, TeamSummary } from "@/types";
// The pieces of the page, from the files next to this one.
import GameCard, { type PropsLink } from "./GameCard";
import LeagueTabs from "./LeagueTabs";
import SearchBar from "./SearchBar";

/* DateFilter: the three filter buttons. */
type DateFilter = "all" | "today" | "week";
const DATE_FILTERS: { value: DateFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
];

/* teamMatches: true if the typed words are part of the team's name, city, or code ("chiefs", "kansas", "kc"). */
function teamMatches(team: TeamSummary, words: string): boolean {
  return [team.displayName, team.abbreviation].some((name) => name.toLowerCase().includes(words));
}

/* toSlug: "Game Lines" → "game-lines", "Passing" → "passing". */
function toSlug(label: string): string {
  return label.toLowerCase().replace(/\s+/g, "-");
}

/*
  GameBrowser
  - leagueSlug / leagueLabel: the league shown, like "nfl" / "NFL"
  - betTypes: the bet-type buttons for this league (from config/leagues.ts)
  - games: every upcoming game, soonest first, already loaded by the server
  - thisWeekGameIds: which of them are this week's (for "This Week")
  - sportsbook / sportsbookName: the user's book (from Settings)
  - oddsUnavailable: true if The Odds API couldn't be reached
  - scoresOnly: true for a league with schedules and live scores but no betting features yet (like the NBA)
*/
export default function GameBrowser({
  leagueSlug,
  leagueLabel,
  betTypes,
  games,
  thisWeekGameIds,
  sportsbook,
  sportsbookName,
  oddsUnavailable,
  scoresOnly,
}: {
  leagueSlug: string;
  leagueLabel: string;
  betTypes: readonly string[];
  games: GameWithLines[];
  thisWeekGameIds: string[];
  sportsbook: SportsbookId;
  sportsbookName: string;
  oddsUnavailable: boolean;
  scoresOnly: boolean;
}) {
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  // The first bet type ("Game Lines") is picked when the page opens.
  const [betType, setBetType] = useState(betTypes[0]);

  const words = search.trim().toLowerCase();
  const thisWeek = new Set(thisWeekGameIds);
  const shown = games.filter((game) => {
    if (dateFilter === "today" && !isToday(game.startsAt)) return false;
    if (dateFilter === "week" && !thisWeek.has(game.id)) return false;
    return words === "" || teamMatches(game.awayTeam, words) || teamMatches(game.homeTeam, words);
  });

  // Live scores for the games shown (refreshed about every 30 seconds, only while one is live and the tab is open).
  const { live, delayed } = useLiveScores(leagueSlug, shown);

  // Any bet type other than the first (Game Lines) adds a "See ___ props" link to each card.
  const propsLink: PropsLink | null = betType === betTypes[0] ? null : { label: betType, slug: toSlug(betType) };

  // The small outlined button look, gold when picked.
  const chip = (picked: boolean) =>
    `min-h-10 shrink-0 whitespace-nowrap rounded-full border px-4 text-sm font-medium transition-colors ${
      picked ? "border-gold bg-gold/10 text-gold" : "border-line text-muted hover:border-muted hover:text-text"
    }`;

  return (
    <div className="space-y-4">
      <SearchBar value={search} onChange={setSearch} />
      <LeagueTabs activeSlug={leagueSlug} />

      {/* The bet-type buttons stay on ONE line and scroll sideways when they don't fit. */}
      <div role="group" aria-label="Bet type" className="scroll-row -mx-4 flex flex-nowrap gap-2 px-4 pb-1 sm:mx-0 sm:px-0">
        {betTypes.map((type) => (
          <button key={type} type="button" aria-pressed={betType === type} onClick={() => setBetType(type)} className={chip(betType === type)}>
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
              onClick={() => setDateFilter(filter.value)}
              className={chip(dateFilter === filter.value)}
            >
              {filter.label}
            </button>
          ))}
        </div>
        {!scoresOnly && (
          <p className="text-xs text-muted">
            Odds from <span className="font-semibold text-text">{sportsbookName}</span> ·{" "}
            <Link href="/settings" className="text-gold underline-offset-4 hover:underline">
              Change
            </Link>
          </p>
        )}
      </div>

      {/* A scores-only league (the NBA): say so plainly instead of showing empty odds. */}
      {scoresOnly && (
        <p role="status" className="rounded-xl border border-line bg-card px-4 py-3 text-sm text-muted">
          {leagueLabel} odds and betting are coming soon. For now you can follow today&apos;s games and live scores.
        </p>
      )}

      {propsLink && (
        <p className="rounded-xl border border-line bg-card px-4 py-3 text-sm text-muted">
          Tap <span className="font-semibold text-gold">See {propsLink.label} props</span> on a game to see its {propsLink.label.toLowerCase()} props.
        </p>
      )}

      {/* The chosen book has no odds on ANY game (Caesars did this in Section 5), so say so instead of showing only dashes. */}
      {!scoresOnly && !oddsUnavailable && games.length > 0 && games.every((game) => game.lines === null) && (
        <p role="status" className="rounded-xl border border-line bg-card px-4 py-3 text-sm text-muted">
          {sportsbookName} hasn&apos;t posted odds for these games yet.{" "}
          <Link href="/settings" className="font-semibold text-gold underline-offset-4 hover:underline">
            Try another sportsbook in Settings
          </Link>
          .
        </p>
      )}

      {oddsUnavailable && (
        <p role="status" className="rounded-xl border border-danger/50 bg-card px-4 py-3 text-sm text-danger">
          Odds aren&apos;t available right now, so prices show as dashes. Please try again in a few minutes.
        </p>
      )}

      <ScoresDelayed show={delayed} />

      {/* aria-live: screen readers hear how many games match after each change. */}
      <p aria-live="polite" className="sr-only">
        {shown.length} {shown.length === 1 ? "game" : "games"} shown
      </p>

      {shown.length > 0 ? (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {shown.map((game) => (
            <li key={game.id}>
              <GameCard game={game} sportsbook={sportsbook} propsLink={propsLink} live={live.get(game.id)} scoresOnly={scoresOnly} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="space-y-3 rounded-2xl border border-line bg-card p-6 text-center">
          {/*
            Not red on purpose: this isn't always a mistake. Typing a PLAYER's name finds
            them in the search above, but games are only filtered by TEAM names. A real
            typo already shows the red "No teams or players match" message in the search bar.
          */}
          <p className="text-sm text-muted">
            {games.length === 0
              ? `No upcoming ${leagueLabel} games right now.`
              : words
                ? `No games match "${search.trim()}". Games are filtered by team name, like "Chiefs" or "KC".`
                : "No games for this filter."}
          </p>
          {(words || dateFilter !== "all") && games.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setDateFilter("all");
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
