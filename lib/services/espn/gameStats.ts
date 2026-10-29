/*
  FILE: lib/services/espn/gameStats.ts
  WHAT IT'S FOR: Gets one game's team numbers and player box score from ESPN's game summary, trimmed to
  the useful ones, for the matchup page's "Live stats" (game is on) and "Final stats" (game is over).
  Football shows passing, rushing, and receiving tables; basketball shows one table of the players who played,
  most points first. It is saved for only 15 seconds so a live game stays fresh. It costs no Odds API credits.
  Returns null for a game ESPN doesn't know (a fake ID, missing on purpose).
  WHO USES IT: components/matchup/GameStats.tsx.
  WHY THIS NAME: It gets a game's stats. It ends in .ts because it shows nothing on screen.
  "server-only" keeps it out of the browser.
*/

import "server-only";
import { cached, CACHE_SECONDS } from "@/lib/services/cache";
import { espnGet, espnUrl, isNotFound, requireLeague } from "./client";
import { toGameStatus, toIsoTime } from "./mappers";
import { gameSummarySchema } from "./schemas";
import type { GameStats, GameStatsTable, GameStatsTeam, LeagueSlug } from "@/types";

/* TEAM_STAT_LABELS: which of ESPN's team numbers to show, per sport, in this order. */
const TEAM_STAT_LABELS: Record<string, readonly string[]> = {
  football: ["Total Yards", "Passing", "Rushing", "Comp/Att", "1st Downs", "3rd down efficiency", "Turnovers", "Penalties", "Possession"],
  basketball: ["FG", "Field Goal %", "3PT", "Three Point %", "FT", "Rebounds", "Assists", "Steals", "Blocks", "Turnovers", "Fast Break Points", "Points in Paint"],
};

/* FOOTBALL_GROUPS: the football player tables to show (ESPN also lists fumbles, defense, kicking...). */
const FOOTBALL_GROUPS = ["passing", "rushing", "receiving"] as const;

/* BASKETBALL_COLUMNS: the basketball player columns to show, by ESPN's own heading. */
const BASKETBALL_COLUMNS = ["MIN", "PTS", "REB", "AST", "FG", "3PT", "STL", "BLK", "TO"] as const;

/* cap: at most this many rows per table, so a phone isn't buried. */
const MAX_ROWS = 12;

/*
  getGameStats: the stats for one game, or null if ESPN doesn't know the game.
  The two teams come back in the order away, home.
*/
export const getGameStats = cached(
  "espn-game-stats",
  CACHE_SECONDS.espnLiveBoxScore,
  async (leagueSlug: LeagueSlug, gameId: string): Promise<GameStats | null> => {
    const league = requireLeague(leagueSlug);
    let data;
    try {
      data = await espnGet(espnUrl("site", league, `summary?event=${encodeURIComponent(gameId)}`), gameSummarySchema, "game stats");
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }

    const competition = data.header.competitions[0];
    const away = competition.competitors.find((c) => c.homeAway === "away");
    const home = competition.competitors.find((c) => c.homeAway === "home");
    if (!away || !home) return null;

    const sport = league.espn.sport;
    const wantedLabels = TEAM_STAT_LABELS[sport] ?? [];

    const buildTeam = (teamId: string): GameStatsTeam => {
      // Team numbers: the first one with each wanted label (ESPN repeats a few labels).
      const all = data.boxscore?.teams?.find((t) => t.team.id === teamId)?.statistics ?? [];
      const stats = wantedLabels.flatMap((label) => {
        const found = all.find((stat) => (stat.label ?? stat.name) === label);
        return found ? [{ label, value: found.displayValue }] : [];
      });

      const groups = data.boxscore?.players?.find((p) => p.team?.id === teamId)?.statistics ?? [];
      const tables: GameStatsTable[] = [];
      if (sport === "basketball") {
        const group = groups[0];
        const labels = group?.labels ?? [];
        const indexes = BASKETBALL_COLUMNS.map((column) => labels.indexOf(column));
        const points = labels.indexOf("PTS");
        if (group && points >= 0) {
          const rows = group.athletes
            // A bench player who never got in has empty numbers.
            .filter((entry) => (entry.stats[points] ?? "") !== "")
            .sort((a, b) => Number(b.stats[points]) - Number(a.stats[points]))
            .slice(0, MAX_ROWS)
            .map((entry) => ({
              playerId: entry.athlete.id,
              name: entry.athlete.displayName,
              values: indexes.map((index) => (index >= 0 ? (entry.stats[index] ?? "–") : "–")),
            }));
          if (rows.length > 0) tables.push({ title: "Players", columns: [...BASKETBALL_COLUMNS], rows });
        }
      } else {
        for (const name of FOOTBALL_GROUPS) {
          const group = groups.find((g) => g.name === name);
          if (!group || group.athletes.length === 0) continue;
          tables.push({
            title: name.charAt(0).toUpperCase() + name.slice(1),
            columns: group.labels ?? [],
            rows: group.athletes.slice(0, MAX_ROWS).map((entry) => ({ playerId: entry.athlete.id, name: entry.athlete.displayName, values: entry.stats })),
          });
        }
      }
      return { teamId, stats, tables };
    };

    return {
      status: toGameStatus(competition.status),
      startsAt: toIsoTime(competition.date),
      teams: [buildTeam(away.team.id), buildTeam(home.team.id)],
    };
  },
);
