/*
  FILE: lib/services/espn/players.ts
  WHAT IT'S FOR: Gets one player's data from ESPN: name, photo, number,
  position, team, injury status, season stats, game-by-game stats (with
  last-5 and last-10 averages), next game, and news. Past STATS only: no old
  betting lines.
  WHO USES IT: Later: the player page and player API route (Section 11B) and the team page (Section 11).
  WHY THIS NAME: It's the ESPN code for players. It ends in .ts because it shows nothing on screen.
*/

import "server-only";
import { cached, CACHE_SECONDS } from "@/lib/services/cache";
import { espnGet, espnUrl, isNotFound, requireLeague } from "./client";
import { athleteOverviewSchema, athleteSchema, athleteStatsSchema, gameLogSchema } from "./schemas";
import { toIsoTime, toNewsArticle } from "./mappers";
// Injury status comes from the league injury report (lib/services/espn/injuries.ts).
import { getPlayerInjuryStatus } from "./injuries";
import { getTeams } from "./teams";
import type {
  LeagueSlug,
  NewsArticle,
  Player,
  PlayerDetails,
  PlayerGameLog,
  PlayerStatKey,
  PlayerStats,
  PositionGroup,
} from "@/types";

/*
  ESPN_STAT_NAMES: ESPN's stat name → our PlayerStatKey (types/player.ts).
  Any ESPN stat not listed here is ignored.
*/
const ESPN_STAT_NAMES: Record<string, PlayerStatKey> = {
  completions: "passCompletions",
  passingAttempts: "passAttempts",
  passingYards: "passYards",
  passingTouchdowns: "passTouchdowns",
  interceptions: "interceptions",
  rushingAttempts: "rushAttempts",
  rushingYards: "rushYards",
  rushingTouchdowns: "rushTouchdowns",
  receptions: "receptions",
  receivingTargets: "targets",
  receivingYards: "receivingYards",
  receivingTouchdowns: "receivingTouchdowns",
};

/*
  toPositionGroup: which stats to show: QBs get passing, RBs rushing, WRs and TEs receiving.
*/
export function toPositionGroup(position: string | null): PositionGroup {
  if (position === "QB") return "QB";
  if (position === "RB" || position === "FB") return "RB";
  if (position === "WR" || position === "TE") return "WR-TE";
  return "OTHER";
}

/*
  toStats: lines up a list of ESPN stat names with a list of values (same order)
  and keeps the ones we track. Values arrive as text like "1,309", so commas are removed.
  Note: for a defensive player, ESPN's "interceptions" means passes they CAUGHT.
  Season stats only read offensive categories to avoid that mix-up, and defensive
  players' pages (positionGroup "OTHER") don't show passing stats anyway.
*/
function toStats(names: string[], values: string[]): PlayerStats {
  const stats: PlayerStats = {};
  names.forEach((name, index) => {
    const key = ESPN_STAT_NAMES[name];
    const raw = values[index];
    if (!key || raw === undefined) return;
    const n = Number(raw.replace(/,/g, ""));
    if (Number.isFinite(n)) stats[key] = n;
  });
  return stats;
}

/*
  averageStats: the average of each stat across some games, rounded to 1 decimal.
  Example: passing yards of 272, 225, 300 → 265.7.
*/
export function averageStats(games: PlayerGameLog[]): PlayerStats {
  const totals: PlayerStats = {};
  const counts: Partial<Record<PlayerStatKey, number>> = {};
  for (const game of games) {
    for (const [key, value] of Object.entries(game.stats) as [PlayerStatKey, number][]) {
      totals[key] = (totals[key] ?? 0) + value;
      counts[key] = (counts[key] ?? 0) + 1;
    }
  }
  const averages: PlayerStats = {};
  for (const [key, total] of Object.entries(totals) as [PlayerStatKey, number][]) {
    averages[key] = Math.round((total / (counts[key] ?? 1)) * 10) / 10;
  }
  return averages;
}

/*
  getPlayer: a player's name, number, position, team, photo, and injury status,
  or null for a player ID ESPN doesn't know (the page shows "player not found").
*/
export const getPlayer = cached(
  "espn-player",
  CACHE_SECONDS.espnPlayer,
  async (leagueSlug: LeagueSlug, playerId: string): Promise<Player | null> => {
    const league = requireLeague(leagueSlug);
    let data;
    try {
      data = await espnGet(
        espnUrl("web", league, `athletes/${encodeURIComponent(playerId)}`),
        athleteSchema,
        "athlete",
      );
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
    const athlete = data.athlete;
    const position = athlete.position?.abbreviation ?? null;
    const teams = await getTeams(league.slug);
    const team = teams.find((t) => t.id === athlete.team?.id) ?? null;

    return {
      id: athlete.id,
      name: athlete.displayName,
      position,
      teamAbbreviation: team?.abbreviation ?? null,
      jersey: athlete.jersey ?? null,
      positionGroup: toPositionGroup(position),
      team,
      // ESPN's standard headshot address works for nearly every player.
      photoUrl:
        athlete.headshot?.href ??
        `https://a.espncdn.com/i/headshots/${league.slug}/players/full/${athlete.id}.png`,
      injuryStatus: await getPlayerInjuryStatus(league.slug, athlete.id),
    };
  },
);

/*
  getPlayerGameLog: the player's regular-season games, newest first, each with
  that game's stats. Returns [] if ESPN has no game log for the player.
*/
export const getPlayerGameLog = cached(
  "espn-player-gamelog",
  CACHE_SECONDS.espnPlayer,
  async (leagueSlug: LeagueSlug, playerId: string): Promise<PlayerGameLog[]> => {
    const league = requireLeague(leagueSlug);
    let data;
    try {
      data = await espnGet(
        espnUrl("web", league, `athletes/${encodeURIComponent(playerId)}/gamelog`),
        gameLogSchema,
        "game log",
      );
    } catch (error) {
      if (isNotFound(error)) return [];
      throw error;
    }

    // Only the regular season, so preseason games don't mix into the averages.
    const regular =
      data.seasonTypes.find((s) => s.displayName?.includes("Regular")) ?? data.seasonTypes[0];
    const rows = (regular?.categories ?? []).flatMap((category) => category.events ?? []);

    const logs: PlayerGameLog[] = [];
    const seen = new Set<string>();
    for (const row of rows) {
      const info = data.events[row.eventId];
      // Skip unknown games, and any game listed twice.
      if (!info || seen.has(row.eventId)) continue;
      seen.add(row.eventId);
      const result = info.gameResult;
      logs.push({
        gameId: row.eventId,
        playedAt: toIsoTime(info.gameDate),
        opponentAbbreviation: info.opponent?.abbreviation ?? "",
        isHome: info.atVs !== "@",
        result: result === "W" || result === "L" || result === "T" ? result : null,
        stats: toStats(data.names, row.stats),
      });
    }
    return logs.sort((a, b) => b.playedAt.localeCompare(a.playedAt));
  },
);

/*
  getPlayerSeasonStats: this season's totals (passing, rushing, receiving).
  Reads only the offensive categories, plus the newest season row in each.
*/
export const getPlayerSeasonStats = cached(
  "espn-player-stats",
  CACHE_SECONDS.espnPlayer,
  async (leagueSlug: LeagueSlug, playerId: string): Promise<PlayerStats> => {
    const league = requireLeague(leagueSlug);
    let data;
    try {
      data = await espnGet(
        espnUrl("web", league, `athletes/${encodeURIComponent(playerId)}/stats`),
        athleteStatsSchema,
        "athlete stats",
      );
    } catch (error) {
      if (isNotFound(error)) return {};
      throw error;
    }
    const stats: PlayerStats = {};
    for (const category of data.categories ?? []) {
      if (!["passing", "rushing", "receiving"].includes(category.name)) continue;
      const rows = category.statistics ?? [];
      const newest = rows.reduce<(typeof rows)[number] | null>(
        (best, row) => (!best || (row.season?.year ?? 0) > (best.season?.year ?? 0) ? row : best),
        null,
      );
      if (newest) Object.assign(stats, toStats(category.names, newest.stats));
    }
    return stats;
  },
);

/*
  getPlayerOverview: the player's next game ID and latest news. nextGameId is
  null if no game is scheduled (missing on purpose).
*/
export const getPlayerOverview = cached(
  "espn-player-overview",
  CACHE_SECONDS.espnPlayer,
  async (
    leagueSlug: LeagueSlug,
    playerId: string,
  ): Promise<{ nextGameId: string | null; news: NewsArticle[] }> => {
    const league = requireLeague(leagueSlug);
    let data;
    try {
      data = await espnGet(
        espnUrl("web", league, `athletes/${encodeURIComponent(playerId)}/overview`),
        athleteOverviewSchema,
        "athlete overview",
      );
    } catch (error) {
      if (isNotFound(error)) return { nextGameId: null, news: [] };
      throw error;
    }
    return {
      nextGameId: data.nextGame?.league?.events?.[0]?.id ?? null,
      news: (data.news ?? [])
        .map(toNewsArticle)
        .filter((article): article is NewsArticle => article !== null)
        .slice(0, 5),
    };
  },
);

/*
  getPlayerDetails: everything on the player page except live props, in one call.
  Returns null if the player doesn't exist. The four ESPN requests run at the
  same time (Promise.all) to keep the page fast.
*/
export async function getPlayerDetails(
  leagueSlug: LeagueSlug,
  playerId: string,
): Promise<PlayerDetails | null> {
  const player = await getPlayer(leagueSlug, playerId);
  if (!player) return null;

  const [gameLog, seasonStats, overview] = await Promise.all([
    getPlayerGameLog(leagueSlug, playerId),
    getPlayerSeasonStats(leagueSlug, playerId),
    getPlayerOverview(leagueSlug, playerId),
  ]);
  const recentGames = gameLog.slice(0, 10);

  return {
    player,
    seasonStats,
    recentGames,
    last5Average: averageStats(recentGames.slice(0, 5)),
    last10Average: averageStats(recentGames),
    nextGameId: overview.nextGameId,
    news: overview.news,
  };
}
