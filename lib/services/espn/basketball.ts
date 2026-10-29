/*
  FILE: lib/services/espn/basketball.ts
  WHAT IT'S FOR: Gets the NBA team page and player page data from ESPN (free, no Odds API credits):
  - a team's record, standing, and per-game numbers (points, shooting %, rebounds, assists)
  - a team's last finished games
  - a team's key players (top scorers) with points / rebounds / assists per game
  - a player's details, season averages, game log, last-5 average, and news
  Football's versions of these live in teams.ts and players.ts. Basketball needs its own because the
  numbers are different (and ESPN's basketball answers are shaped a little differently: the roster is one
  flat list, and a player's game log has one unnamed group).
  Every function returns null (or an empty list) for an ID ESPN doesn't know, so the page can say "not
  found" instead of crashing. If a smaller piece is missing, its numbers are null and show as dashes.
  WHO USES IT: components/basketball/NbaTeamView.tsx and components/basketball/NbaPlayerView.tsx.
  WHY THIS NAME: It's the ESPN code for basketball. It lives next to the football versions and ends in .ts
  because it shows nothing on screen. "server-only" keeps it out of the browser.
*/

import "server-only";
import { z } from "zod";
import { cached, CACHE_SECONDS } from "@/lib/services/cache";
import { espnGet, espnUrl, isNotFound, requireLeague, seasonYearFor } from "./client";
import { getPlayerInjuryStatus } from "./injuries";
import { competitorScore, toGameStatus, toIsoTime, toNewsArticle, toTeamSummary } from "./mappers";
import { athleteOverviewSchema, athleteSchema, numberish, teamDetailSchema, teamLeadersSchema, teamScheduleSchema, teamSeasonStatsSchema } from "./schemas";
import { getTeams } from "./teams";
import type {
  LeagueSlug,
  NbaKeyPlayer,
  NbaPlayerAverages,
  NbaPlayerDetails,
  NbaPlayerGame,
  NbaTeamOverview,
  NbaTeamResult,
  NewsArticle,
} from "@/types";

/* ---------- what we read from ESPN (only the parts we use) ---------- */

/* nbaRosterSchema: basketball's roster is ONE flat list of players (football groups them by offense / defense). */
const nbaRosterSchema = z.object({
  athletes: z.array(
    z.object({
      id: z.string(),
      fullName: z.string().optional(),
      displayName: z.string(),
      jersey: z.string().optional(),
      position: z.object({ abbreviation: z.string() }).optional(),
      headshot: z.object({ href: z.string() }).optional(),
    }),
  ),
});

/* nbaOverviewSchema: a player's overview adds the season averages to the news we already read for football. */
const nbaOverviewSchema = athleteOverviewSchema.extend({
  statistics: z
    .object({
      names: z.array(z.string()),
      splits: z.array(z.object({ displayName: z.string(), stats: z.array(z.string()) })),
    })
    .optional(),
});

/* nbaGameLogSchema: the stat names once at the top, then each game's numbers in the same order. */
const nbaGameLogSchema = z.object({
  names: z.array(z.string()),
  events: z.record(
    z.string(),
    z.object({
      gameDate: z.string(),
      atVs: z.string().optional(),
      gameResult: z.string().optional(),
      homeTeamScore: numberish.optional(),
      awayTeamScore: numberish.optional(),
      opponent: z.object({ abbreviation: z.string() }),
    }),
  ),
  seasonTypes: z.array(
    z.object({
      displayName: z.string(),
      categories: z.array(z.object({ events: z.array(z.object({ eventId: z.string(), stats: z.array(z.string()) })) })),
    }),
  ),
});

/* ---------- small helpers ---------- */

/* NBA: the league these functions are for. */
const NBA = "nba" as const satisfies LeagueSlug;

/* findStat: one stat by name across ESPN's stat categories, or null if it isn't there. */
function findStat(categories: { name: string; stats: { name: string; value: number | null }[] }[], name: string): number | null {
  for (const category of categories) {
    const stat = category.stats.find((s) => s.name === name);
    if (stat) return stat.value;
  }
  return null;
}

/* toNumber: ESPN sends numbers as text ("30.8"). A dash, empty text, or anything that isn't a number becomes null. */
function toNumber(value: string | undefined): number | null {
  if (value === undefined || value.trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/** round1: one decimal place (28.5), for averages we work out ourselves. */
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/* ---------- team ---------- */

/*
  getNbaTeamOverview: one team's name, logo, record, standing, and per-game numbers, or null for a
  team ID that doesn't exist. The season numbers come from a second ESPN answer; if it fails they show as dashes.
*/
export const getNbaTeamOverview = cached(
  "espn-nba-team-overview",
  CACHE_SECONDS.espnTeam,
  async (teamId: string): Promise<NbaTeamOverview | null> => {
    const league = requireLeague(NBA);
    const teams = await getTeams(NBA);
    if (!teams.some((t) => t.id === teamId)) return null;

    const id = encodeURIComponent(teamId);
    const [detail, stats] = await Promise.all([
      espnGet(espnUrl("site", league, `teams/${id}`), teamDetailSchema, "nba team"),
      espnGet(
        espnUrl("core", league, `seasons/${seasonYearFor(league)}/types/2/teams/${id}/statistics`),
        teamSeasonStatsSchema,
        "nba team season stats",
      ).catch((error: unknown) => {
        console.error("NBA team season stats unavailable:", error);
        return null;
      }),
    ]);

    const recordItems = detail.team.record?.items ?? [];
    const total = recordItems.find((item) => item.type === "total");
    const recordStat = (name: string) => total?.stats?.find((s) => s.name === name)?.value ?? null;
    const categories = stats?.splits.categories ?? [];

    return {
      team: toTeamSummary(detail.team, NBA, total?.summary ?? null),
      standing: detail.team.standingSummary ?? null,
      stats: {
        pointsFor: recordStat("avgPointsFor"),
        pointsAgainst: recordStat("avgPointsAgainst"),
        fieldGoalPct: findStat(categories, "fieldGoalPct"),
        threePointPct: findStat(categories, "threePointPct"),
        reboundsPerGame: findStat(categories, "avgRebounds"),
        assistsPerGame: findStat(categories, "avgAssists"),
        turnoversPerGame: findStat(categories, "avgTurnovers"),
        homeRecord: recordItems.find((item) => item.type === "home")?.summary ?? null,
        awayRecord: recordItems.find((item) => item.type === "road")?.summary ?? null,
      },
      nextGameId: detail.team.nextEvent?.[0]?.id ?? null,
    };
  },
);

/*
  getNbaTeamResults: the team's last finished games, newest first (5 by default).
  A game counts only when it is final and both scores are known. Basketball has no ties.
*/
export const getNbaTeamResults = cached(
  "espn-nba-team-results",
  CACHE_SECONDS.espnTeam,
  async (teamId: string, count: number = 5): Promise<NbaTeamResult[]> => {
    const league = requireLeague(NBA);
    let data;
    try {
      data = await espnGet(espnUrl("site", league, `teams/${encodeURIComponent(teamId)}/schedule`), teamScheduleSchema, "nba team schedule");
    } catch (error) {
      if (isNotFound(error)) return [];
      throw error;
    }

    const results: NbaTeamResult[] = [];
    for (const event of data.events) {
      const competition = event.competitions[0];
      if (toGameStatus(competition.status ?? event.status) !== "final") continue;
      const us = competition.competitors.find((c) => c.team.id === teamId);
      const them = competition.competitors.find((c) => c.team.id !== teamId);
      const ourScore = us ? competitorScore(us) : null;
      const theirScore = them ? competitorScore(them) : null;
      if (!us || !them || ourScore === null || theirScore === null) continue;
      results.push({
        gameId: event.id,
        playedAt: toIsoTime(event.date),
        opponent: toTeamSummary(them.team, NBA),
        isHome: us.homeAway === "home",
        teamScore: ourScore,
        opponentScore: theirScore,
        result: ourScore > theirScore ? "W" : "L",
      });
    }
    return results.sort((a, b) => b.playedAt.localeCompare(a.playedAt)).slice(0, count);
  },
);

/*
  getNbaKeyPlayers: the team's top scorers this season (up to 5) with points, rebounds, and assists per game.
  The leaders answer only has links to each player, so names, numbers, and photos come from the roster.
  Empty list for a team ESPN has no stats for yet (early in the season).
*/
export const getNbaKeyPlayers = cached(
  "espn-nba-key-players",
  CACHE_SECONDS.espnTeam,
  async (teamId: string): Promise<NbaKeyPlayer[]> => {
    const league = requireLeague(NBA);
    const id = encodeURIComponent(teamId);

    const [roster, leaders] = await Promise.all([
      espnGet(espnUrl("site", league, `teams/${id}/roster`), nbaRosterSchema, "nba roster").catch((error: unknown) => {
        if (isNotFound(error)) return null;
        throw error;
      }),
      espnGet(espnUrl("core", league, `seasons/${seasonYearFor(league)}/types/2/teams/${id}/leaders`), teamLeadersSchema, "nba team leaders").catch(
        (error: unknown) => {
          if (isNotFound(error)) return null;
          throw error;
        },
      ),
    ]);
    if (!roster || !leaders) return [];

    // The player ID is the number after "/athletes/" in each leader's link; the value is their per-game number.
    const byCategory = (name: string): Map<string, number> => {
      const map = new Map<string, number>();
      for (const leader of leaders.categories.find((c) => c.name === name)?.leaders ?? []) {
        const playerId = /\/athletes\/(\d+)/.exec(leader.athlete.$ref)?.[1];
        if (playerId !== undefined && leader.value !== undefined && !map.has(playerId)) map.set(playerId, leader.value);
      }
      return map;
    };
    const points = byCategory("pointsPerGame");
    const rebounds = byCategory("reboundsPerGame");
    const assists = byCategory("assistsPerGame");
    const onRoster = new Map(roster.athletes.map((athlete) => [athlete.id, athlete]));

    return [...points.keys()]
      .filter((playerId) => onRoster.has(playerId))
      .slice(0, 5)
      .map((playerId) => {
        const athlete = onRoster.get(playerId);
        return {
          id: playerId,
          name: athlete?.fullName ?? athlete?.displayName ?? "Unknown player",
          position: athlete?.position?.abbreviation ?? null,
          jersey: athlete?.jersey ?? null,
          photoUrl: athlete?.headshot?.href ?? null,
          pointsPerGame: round1(points.get(playerId) ?? 0),
          reboundsPerGame: rebounds.has(playerId) ? round1(rebounds.get(playerId) ?? 0) : null,
          assistsPerGame: assists.has(playerId) ? round1(assists.get(playerId) ?? 0) : null,
        };
      });
  },
);

/* ---------- player ---------- */

/* EMPTY_AVERAGES: every number missing (a player with no games yet). */
const EMPTY_AVERAGES: NbaPlayerAverages = {
  games: null,
  minutes: null,
  points: null,
  rebounds: null,
  assists: null,
  steals: null,
  blocks: null,
  turnovers: null,
  fieldGoalPct: null,
  threePointPct: null,
  freeThrowPct: null,
};

/*
  averageOf: the average of some game-log rows (for "last 5 games"). Shooting percentages are worked
  out from the total shots made and attempted, not by averaging percentages. Null when there are no games.
*/
export function averageOf(games: readonly NbaPlayerGame[]): NbaPlayerAverages {
  if (games.length === 0) return EMPTY_AVERAGES;
  const mean = (pick: (game: NbaPlayerGame) => number | null): number | null => {
    const values = games.map(pick).filter((value): value is number => value !== null);
    return values.length === 0 ? null : round1(values.reduce((sum, value) => sum + value, 0) / values.length);
  };
  const pct = (pick: (game: NbaPlayerGame) => string | null): number | null => {
    let made = 0;
    let attempted = 0;
    for (const game of games) {
      const [m, a] = (pick(game) ?? "").split("-").map(Number);
      if (Number.isFinite(m) && Number.isFinite(a)) {
        made += m;
        attempted += a;
      }
    }
    return attempted === 0 ? null : round1((made / attempted) * 100);
  };
  return {
    games: games.length,
    minutes: mean((g) => g.minutes),
    points: mean((g) => g.points),
    rebounds: mean((g) => g.rebounds),
    assists: mean((g) => g.assists),
    steals: mean((g) => g.steals),
    blocks: mean((g) => g.blocks),
    turnovers: mean((g) => g.turnovers),
    fieldGoalPct: pct((g) => g.fieldGoals),
    threePointPct: pct((g) => g.threePointers),
    freeThrowPct: pct((g) => g.freeThrows),
  };
}

/*
  getNbaPlayerDetails: a player's name, photo, team, season averages, recent games, and news, or null for a
  player ID ESPN doesn't know. The game log and overview are optional pieces: if one fails, its part is empty.
*/
export const getNbaPlayerDetails = cached(
  "espn-nba-player",
  CACHE_SECONDS.espnPlayer,
  async (playerId: string): Promise<NbaPlayerDetails | null> => {
    const league = requireLeague(NBA);
    const id = encodeURIComponent(playerId);

    let athlete;
    try {
      athlete = (await espnGet(espnUrl("web", league, `athletes/${id}`), athleteSchema, "nba athlete")).athlete;
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }

    const [teams, overview, log, injuryStatus] = await Promise.all([
      getTeams(NBA),
      espnGet(espnUrl("web", league, `athletes/${id}/overview`), nbaOverviewSchema, "nba athlete overview").catch((error: unknown) => {
        console.error("NBA player overview unavailable:", error);
        return null;
      }),
      espnGet(espnUrl("web", league, `athletes/${id}/gamelog`), nbaGameLogSchema, "nba athlete game log").catch((error: unknown) => {
        console.error("NBA player game log unavailable:", error);
        return null;
      }),
      getPlayerInjuryStatus(NBA, playerId).catch(() => null),
    ]);

    const team = teams.find((t) => t.id === athlete.team?.id) ?? null;
    const position = athlete.position?.abbreviation ?? null;

    // Season averages: the "Regular Season" row of the overview, matched to ESPN's stat names.
    const row = overview?.statistics?.splits.find((split) => split.displayName === "Regular Season");
    const season = (name: string): number | null => {
      const index = overview?.statistics?.names.indexOf(name) ?? -1;
      return row && index >= 0 ? toNumber(row.stats[index]) : null;
    };
    const seasonAverages: NbaPlayerAverages = row
      ? {
          games: season("gamesPlayed"),
          minutes: season("avgMinutes"),
          points: season("avgPoints"),
          rebounds: season("avgRebounds"),
          assists: season("avgAssists"),
          steals: season("avgSteals"),
          blocks: season("avgBlocks"),
          turnovers: season("avgTurnovers"),
          fieldGoalPct: season("fieldGoalPct"),
          threePointPct: season("threePointPct"),
          freeThrowPct: season("freeThrowPct"),
        }
      : EMPTY_AVERAGES;

    const recentGames = log ? toGameLog(log) : [];

    return {
      player: {
        id: athlete.id,
        name: athlete.displayName,
        position,
        teamAbbreviation: team?.abbreviation ?? null,
        jersey: athlete.jersey ?? null,
        // Basketball has no QB/RB/WR groups; "OTHER" is the football type's way of saying "basic stats".
        positionGroup: "OTHER",
        team,
        photoUrl: athlete.headshot?.href ?? `https://a.espncdn.com/i/headshots/nba/players/full/${athlete.id}.png`,
        injuryStatus,
      },
      seasonAverages,
      recentGames,
      last5Average: averageOf(recentGames.slice(0, 5)),
      // The player's team's next game (the player overview's own "next game" is really the previous one).
      nextGameId: team ? ((await getNbaTeamOverview(team.id).catch(() => null))?.nextGameId ?? null) : null,
      news: (overview?.news ?? [])
        .map(toNewsArticle)
        .filter((article): article is NewsArticle => article !== null)
        .slice(0, 5),
    };
  },
);

/*
  toGameLog: ESPN's game log → rows, newest first (up to 10) from the current regular season.
  Each event lists stat numbers in the same order as `names` at the top of the answer.
*/
function toGameLog(log: z.infer<typeof nbaGameLogSchema>): NbaPlayerGame[] {
  const regularSeason = log.seasonTypes.find((type) => type.displayName.includes("Regular Season"));
  if (!regularSeason) return [];
  const at = (stats: string[], name: string): string | undefined => stats[log.names.indexOf(name)];

  const games: NbaPlayerGame[] = [];
  for (const entry of regularSeason.categories.flatMap((category) => category.events)) {
    const event = log.events[entry.eventId];
    if (!event) continue;
    const isHome = event.atVs !== "@";
    const home = event.homeTeamScore ?? null;
    const away = event.awayTeamScore ?? null;
    const ours = isHome ? home : away;
    const theirs = isHome ? away : home;
    games.push({
      gameId: entry.eventId,
      playedAt: toIsoTime(event.gameDate),
      opponentAbbreviation: event.opponent.abbreviation,
      isHome,
      result: event.gameResult === "W" || event.gameResult === "L" ? event.gameResult : null,
      score: ours !== null && theirs !== null ? `${ours}-${theirs}` : null,
      minutes: toNumber(at(entry.stats, "minutes")),
      points: toNumber(at(entry.stats, "points")),
      rebounds: toNumber(at(entry.stats, "totalRebounds")),
      assists: toNumber(at(entry.stats, "assists")),
      steals: toNumber(at(entry.stats, "steals")),
      blocks: toNumber(at(entry.stats, "blocks")),
      turnovers: toNumber(at(entry.stats, "turnovers")),
      fieldGoals: at(entry.stats, "fieldGoalsMade-fieldGoalsAttempted") ?? null,
      threePointers: at(entry.stats, "threePointFieldGoalsMade-threePointFieldGoalsAttempted") ?? null,
      freeThrows: at(entry.stats, "freeThrowsMade-freeThrowsAttempted") ?? null,
    });
  }
  return games.sort((a, b) => b.playedAt.localeCompare(a.playedAt)).slice(0, 10);
}
