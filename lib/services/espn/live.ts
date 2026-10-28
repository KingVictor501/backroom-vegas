/*
  FILE: lib/services/espn/live.ts
  WHAT IT'S FOR: Gets LIVE scores from ESPN (free, no Odds API credits). Two sources:
  1. The scoreboard: every game this week with score, quarter, and clock. One request covers all games.
  2. One game's summary: used for (a) a game that is not on this week's scoreboard (like last
     week's game on an old slip) and (b) the box score, which grades player props live.
  Both are saved for only 15 seconds, because the browser asks about every 30 seconds while a game
  is on. If ESPN fails for the scoreboard, the error goes up and the route answers "502"; a single
  game's failure just leaves that game out, so one bad game never hides the others.
  LIMITS (to be kind to ESPN and keep responses fast): at most 8 games are looked up one by one per request.
  WHO USES IT: app/api/live/route.ts.
  WHY THIS NAME: It's the ESPN code for live scores, next to games.ts. It ends in .ts because it shows
  nothing on screen.
*/

import "server-only";
import { cached, CACHE_SECONDS } from "@/lib/services/cache";
import { espnGet, espnUrl, isNotFound, requireLeague } from "./client";
import { competitorScore, toGameStatus } from "./mappers";
import { gameSummarySchema, scoreboardSchema, type EspnCompetitor } from "./schemas";
import { liveGameLabel } from "@/lib/betting/liveLabel";
import { toLiveStats } from "@/lib/betting/propStats";
import type { LeagueSlug, LiveGame } from "@/types";

/** The most games looked up one by one in a single request (a slip holds at most 25 picks). */
const MAX_SINGLE_LOOKUPS = 8;

/* The part of ESPN's status we read. */
type EspnStatus = {
  period?: number;
  displayClock?: string;
  type: { name: string; state: string; completed: boolean; shortDetail?: string };
};

/*
  periodPoints: a team's points in each period, in order. Entries ESPN left blank are skipped, so an
  odd answer gives a shorter list (the grader then says "Live" instead of guessing).
*/
function periodPoints(competitor: EspnCompetitor): number[] {
  const points: number[] = [];
  for (const line of competitor.linescores ?? []) {
    const value = line.value ?? (line.displayValue !== undefined ? Number(line.displayValue) : null);
    if (value === null || !Number.isFinite(value)) return [];
    points.push(value);
  }
  return points;
}

/*
  buildLiveGame: one ESPN game → our LiveGame. Scores are only kept once the game has started
  (before kickoff ESPN says "0", which would look like a 0-0 game).
*/
function buildLiveGame(
  gameId: string,
  league: ReturnType<typeof requireLeague>,
  status: EspnStatus | undefined,
  competitors: EspnCompetitor[],
  now: Date,
): LiveGame | null {
  const home = competitors.find((c) => c.homeAway === "home");
  const away = competitors.find((c) => c.homeAway === "away");
  // A game without both teams can't be shown, so skip it instead of crashing.
  if (!home || !away) return null;

  const gameStatus = toGameStatus(status);
  const started = gameStatus === "in-progress" || gameStatus === "final";
  const period = started && status?.period ? status.period : null;
  const clock = started ? (status?.displayClock ?? null) : null;

  return {
    gameId,
    league: league.slug,
    status: gameStatus,
    label: liveGameLabel({
      status: gameStatus,
      typeName: status?.type.name ?? "",
      shortDetail: status?.type.shortDetail ?? null,
      period,
      clock,
      periods: league.periods,
    }),
    period,
    clock,
    halftime: (status?.type.name ?? "").toUpperCase().includes("HALFTIME"),
    awayTeamId: away.team.id,
    homeTeamId: home.team.id,
    awayScore: started ? competitorScore(away) : null,
    homeScore: started ? competitorScore(home) : null,
    awayPeriods: started ? periodPoints(away) : [],
    homePeriods: started ? periodPoints(home) : [],
    players: null,
    updatedAt: now.toISOString(),
  };
}

/*
  getLiveScoreboard: every game on this week's scoreboard, with live scores. Saved for 15 seconds.
  (cached() can only save plain data, so the time is kept as text.)
*/
export const getLiveScoreboard = cached(
  "espn-live-scoreboard",
  CACHE_SECONDS.espnLive,
  async (leagueSlug: LeagueSlug): Promise<LiveGame[]> => {
    const league = requireLeague(leagueSlug);
    const data = await espnGet(espnUrl("site", league, "scoreboard"), scoreboardSchema, "live scoreboard");
    const now = new Date();
    return data.events
      .map((event) => {
        const competition = event.competitions[0];
        return buildLiveGame(event.id, league, competition.status ?? event.status, competition.competitors, now);
      })
      .filter((game): game is LiveGame => game !== null);
  },
);

/*
  getLiveGameDetail: ONE game from its summary, including the box score (players). null if ESPN
  doesn't know the game ID (missing on purpose: a fake ID). Saved for 15 seconds.
*/
export const getLiveGameDetail = cached(
  "espn-live-game-detail",
  CACHE_SECONDS.espnLiveBoxScore,
  async (leagueSlug: LeagueSlug, gameId: string): Promise<LiveGame | null> => {
    const league = requireLeague(leagueSlug);
    let data;
    try {
      data = await espnGet(
        espnUrl("site", league, `summary?event=${encodeURIComponent(gameId)}`),
        gameSummarySchema,
        "live game detail",
      );
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
    const competition = data.header.competitions[0];
    const game = buildLiveGame(gameId, league, competition.status, competition.competitors, new Date());
    if (!game) return null;
    // Flatten every team's box score groups into one player list.
    const groups = (data.boxscore?.players ?? []).flatMap((team) => team.statistics);
    return { ...game, players: toLiveStats(groups) };
  },
);

/*
  getLiveGames: the live state of the asked-for games.
  - Games on this week's scoreboard come from it (one shared request).
  - Others (older games on a slip) are looked up one by one, up to MAX_SINGLE_LOOKUPS.
  - includeStats: also attach the box score for games that have started, so player props can be graded.
    Without it, `players` is null and the answer stays small.
  A game ESPN doesn't know is left out of the answer.
*/
export async function getLiveGames(leagueSlug: LeagueSlug, gameIds: readonly string[], includeStats: boolean): Promise<LiveGame[]> {
  const wanted = [...new Set(gameIds)];
  const board = new Map((await getLiveScoreboard(leagueSlug)).map((game) => [game.gameId, game]));

  // Which games need their own request: ones off the scoreboard, and (with stats) started ones.
  const needsDetail = wanted
    .filter((id) => {
      const known = board.get(id);
      if (!known) return true;
      return includeStats && (known.status === "in-progress" || known.status === "final");
    })
    .slice(0, MAX_SINGLE_LOOKUPS);

  const details = await Promise.allSettled(needsDetail.map((id) => getLiveGameDetail(leagueSlug, id)));
  const detailById = new Map<string, LiveGame>();
  details.forEach((result, index) => {
    if (result.status === "fulfilled" && result.value) detailById.set(needsDetail[index], result.value);
  });

  const games: LiveGame[] = [];
  for (const id of wanted) {
    const detail = detailById.get(id);
    const known = board.get(id);
    // The scoreboard is fresher by design, but only the detail has the box score.
    const chosen = includeStats ? (detail ?? known) : (known ?? detail);
    if (!chosen) continue;
    games.push(includeStats ? chosen : { ...chosen, players: null });
  }
  return games;
}

