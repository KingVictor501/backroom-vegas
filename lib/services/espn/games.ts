/*
  FILE: lib/services/espn/games.ts
  WHAT IT'S FOR: Gets games from ESPN: this week's (and next week's) games for
  the Feed and league page, and one game's details (records, venue, win chance, box score) for the
  matchup page.
  WHO USES IT: lib/services/games.ts (which adds odds). Later: the matchup page
  (Section 10) and team page (Section 11).
  WHY THIS NAME: It's the ESPN code for games. It ends in .ts because it shows nothing on screen.
*/

import "server-only";
import type { z } from "zod";
// CACHE_SECONDS and cached() from lib/services/cache.ts: save results so ESPN isn't asked on every page view.
import { cached, CACHE_SECONDS } from "@/lib/services/cache";
// feedWeekDays (lib/format/gameTime.ts): the days left in this league's week, for leagues with no ESPN week number.
import { feedWeekDays } from "@/lib/format/gameTime";
// The ESPN helpers and the shapes we expect from ESPN.
import { espnGet, espnUrl, isNotFound, requireLeague } from "./client";
import { gameSummarySchema, scoreboardSchema } from "./schemas";
import { overallRecord, toGame, toIsoTime, toTeamSummary, competitorScore, toGameStatus } from "./mappers";
// The shared types (Section 2).
import type { Game, LeagueSlug, StatValue } from "@/types";
// logServerError (lib/logging/safeLog.ts): logs a short cleaned-up line, never connection strings or whole error objects.
import { logServerError } from "@/lib/logging/safeLog";

/*
  getWeekGames: this week's games for a league, soonest first.
  With no date, ESPN's scoreboard returns the current week (Thursday to Monday for the NFL).
  Saved for 5 minutes, since scores change during games.
*/
export const getWeekGames = cached(
  "espn-week-games",
  CACHE_SECONDS.espnScoreboard,
  async (leagueSlug: LeagueSlug): Promise<Game[]> => {
    const league = requireLeague(leagueSlug);
    const data = await espnGet(espnUrl("site", league, "scoreboard"), scoreboardSchema, "scoreboard");
    return data.events
      .map((event) => toGame(event, league.slug))
      .filter((game): game is Game => game !== null)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  },
);

/*
  UpcomingGames: this week's games and next week's games, each soonest first.
*/
export type UpcomingGames = { thisWeek: Game[]; nextWeek: Game[] };

/*
  getUpcomingGames: this week's games PLUS next week's, for the Feed and league
  page ("every upcoming matchup"). It reads the week number from this week's
  scoreboard and asks ESPN for week + 1.
  If next week can't be loaded (for example, after the last regular-season week,
  when the playoffs start), you still get this week's games.
  Saved for 5 minutes, like the scoreboard.
*/
export const getUpcomingGames = cached(
  "espn-upcoming-games",
  CACHE_SECONDS.espnScoreboard,
  async (leagueSlug: LeagueSlug): Promise<UpcomingGames> => {
    const league = requireLeague(leagueSlug);
    const toGames = (events: z.infer<typeof scoreboardSchema>["events"]) =>
      events
        .map((event) => toGame(event, league.slug))
        .filter((game): game is Game => game !== null)
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

    const current = await espnGet(espnUrl("site", league, "scoreboard"), scoreboardSchema, "scoreboard");
    let thisWeek = toGames(current.events);

    // A league with no ESPN "week" (like the NBA) only returns TODAY's games. Ask for each of the
    // other days left in its week, one day at a time (ESPN rejects a date range), and add them.
    // A day that fails is skipped: the games already loaded still show.
    if (!current.week) {
      const [, ...laterDays] = feedWeekDays(new Date(), league.weekEndsOn);
      const extra = await Promise.all(
        laterDays.map(async (day) => {
          try {
            return await espnGet(espnUrl("site", league, `scoreboard?dates=${day}`), scoreboardSchema, "scoreboard-day");
          } catch (error) {
            logServerError("A later day's games are unavailable:", error);
            return null;
          }
        }),
      );
      const seen = new Set(thisWeek.map((game) => game.id));
      for (const day of extra) {
        for (const game of day ? toGames(day.events) : []) {
          if (!seen.has(game.id)) {
            seen.add(game.id);
            thisWeek.push(game);
          }
        }
      }
      thisWeek = thisWeek.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    }

    let nextWeek: Game[] = [];
    if (current.week && current.season) {
      const query = `scoreboard?week=${current.week.number + 1}&seasontype=${current.season.type}`;
      try {
        const next = await espnGet(espnUrl("site", league, query), scoreboardSchema, "scoreboard-next-week");
        const thisWeekIds = new Set(thisWeek.map((game) => game.id));
        nextWeek = toGames(next.events).filter((game) => !thisWeekIds.has(game.id));
      } catch (error) {
        logServerError("Next week's games unavailable:", error);
      }
    }
    return { thisWeek, nextWeek };
  },
);

/*
  GameSummary: one game's details for the matchup page.
  teamStats holds each team's stats for that game (only once it's been played),
  keyed by ESPN team ID.
*/
export type GameSummary = {
  game: Game;
  teamStats: Record<string, StatValue[]>;
};

/*
  getGameSummary: one game's details, or null if ESPN doesn't know that game ID
  (a fake ID). null is missing on purpose: the page shows "not found".
  Also fills in winProbability from ESPN's "Matchup Predictor" (for example,
  Chiefs 52.8% vs Seahawks 46.8%), when ESPN has it.
*/
export const getGameSummary = cached(
  "espn-game-summary",
  CACHE_SECONDS.espnGameSummary,
  async (leagueSlug: LeagueSlug, gameId: string): Promise<GameSummary | null> => {
    const league = requireLeague(leagueSlug);
    let data;
    try {
      data = await espnGet(
        espnUrl("site", league, `summary?event=${encodeURIComponent(gameId)}`),
        gameSummarySchema,
        "game summary",
      );
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }

    const competition = data.header.competitions[0];
    const home = competition.competitors.find((c) => c.homeAway === "home");
    const away = competition.competitors.find((c) => c.homeAway === "away");
    if (!home || !away) return null;

    const status = toGameStatus(competition.status);
    const started = status === "in-progress" || status === "final";
    const homeChance = data.predictor?.homeTeam?.gameProjection ?? null;
    const awayChance = data.predictor?.awayTeam?.gameProjection ?? null;

    const game: Game = {
      id: gameId,
      league: league.slug,
      startsAt: toIsoTime(competition.date),
      status,
      awayTeam: toTeamSummary(away.team, league.slug, overallRecord(away)),
      homeTeam: toTeamSummary(home.team, league.slug, overallRecord(home)),
      awayScore: started ? competitorScore(away) : null,
      homeScore: started ? competitorScore(home) : null,
      venue: data.gameInfo?.venue?.fullName ?? null,
      oddsEventId: null,
      winProbability:
        homeChance !== null && awayChance !== null ? { home: homeChance, away: awayChance } : null,
    };

    // Each team's box score stats, like { label: "Total Yards", value: 259 }.
    const teamStats: Record<string, StatValue[]> = {};
    for (const team of data.boxscore?.teams ?? []) {
      teamStats[team.team.id] = team.statistics.map((stat) => {
        const n = Number(stat.displayValue.replace(/,/g, ""));
        return { label: stat.label ?? stat.name, value: Number.isFinite(n) ? n : null };
      });
    }

    return { game, teamStats };
  },
);
