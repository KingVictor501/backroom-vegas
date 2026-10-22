/*
  FILE: lib/services/espn/games.ts
  WHAT IT'S FOR: Gets games from ESPN: this week's games for the Feed and league
  page, and one game's details (records, venue, win chance, box score) for the
  matchup page.
  WHO USES IT: lib/services/games.ts (which adds odds). Later: the matchup page
  (Section 10) and team page (Section 11).
  WHY THIS NAME: It's the ESPN code for games. It ends in .ts because it shows nothing on screen.
*/

import "server-only";
// CACHE_SECONDS and cached() from lib/services/cache.ts: save results so ESPN isn't asked on every page view.
import { cached, CACHE_SECONDS } from "@/lib/services/cache";
// The ESPN helpers and the shapes we expect from ESPN.
import { espnGet, espnUrl, isNotFound, requireLeague } from "./client";
import { gameSummarySchema, scoreboardSchema } from "./schemas";
import { overallRecord, toGame, toIsoTime, toTeamSummary, competitorScore, toGameStatus } from "./mappers";
// The shared types (Section 2).
import type { Game, LeagueSlug, StatValue } from "@/types";

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
