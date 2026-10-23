/*
  FILE: lib/services/teamPage.ts
  WHAT IT'S FOR: The two slower parts of the team page, built from several ESPN answers:
  1. getTeamRecentGames: the last 5 games (opponent, final score, win or loss)
     PLUS the team's stats from each game, read from each game's box score.
  2. getTeamKeyPlayers: the starting QB, top 2 running backs, and top 3
     receivers, each with their last 5 games and the average.
  Stats only. No betting lines anywhere (ESPN's game data includes some, and we never read them).
  WHO USES IT: app/(main)/team/[teamId]/page.tsx.
  WHY THIS NAME: It's the service for the team page. It ends in .ts because it shows nothing on screen.
*/

import "server-only";
// One game's box score (getGameSummary) from lib/services/espn/games.ts.
import { getGameSummary } from "@/lib/services/espn/games";
// A player's game-by-game stats and the averaging math, from lib/services/espn/players.ts.
import { averageStats, getPlayerGameLog } from "@/lib/services/espn/players";
// The team's results, roster, and stat leaders, from lib/services/espn/teams.ts.
import { getTeamLeaders, getTeamRecentResults, getTeamRoster, type RosterPlayer } from "@/lib/services/espn/teams";
import type { LeagueSlug, TeamGameResult, TeamKeyPlayer } from "@/types";

/*
  GAME_STATS: which of the team's box score stats to show for each game, in
  order. The labels are ESPN's (from your sample C8). "Passing" and "Rushing" are yards.
*/
export const GAME_STATS = ["Total Yards", "Passing", "Rushing", "1st Downs", "Turnovers"] as const;

/*
  getTeamRecentGames: the last 5 finished games, newest first, each with the
  team's stats from that game. The 5 box scores load at the same time. If one
  fails, that game just shows dashes instead of breaking the page.
*/
export async function getTeamRecentGames(league: LeagueSlug, teamId: string): Promise<TeamGameResult[]> {
  const results = await getTeamRecentResults(league, teamId, 5);
  const summaries = await Promise.all(
    results.map((result) => getGameSummary(league, result.gameId).catch(() => null)),
  );
  return results.map((result, index) => {
    const teamStats = summaries[index]?.teamStats[teamId] ?? [];
    return {
      ...result,
      stats: GAME_STATS.map((label) => ({ label, value: teamStats.find((stat) => stat.label === label)?.value ?? null })),
    };
  });
}

/*
  pickPlayers: the first `count` leaders who play one of these positions.
  ESPN's rushing leaders can include the QB, so the position check matters.
*/
function pickPlayers(leaderIds: string[], roster: Map<string, RosterPlayer>, positions: string[], count: number): RosterPlayer[] {
  return leaderIds
    .map((id) => roster.get(id))
    .filter((player): player is RosterPlayer => player !== undefined && positions.includes(player.position ?? ""))
    .slice(0, count);
}

/*
  getTeamKeyPlayers: the team's key players, chosen from ESPN's season leaders:
  the QB with the most passing yards, the 2 running backs with the most rushing
  yards, and the 3 receivers (WR or TE) with the most receiving yards.
  Each one's last 5 games load at the same time.
*/
export async function getTeamKeyPlayers(league: LeagueSlug, teamId: string): Promise<TeamKeyPlayer[]> {
  const [leaders, rosterList] = await Promise.all([getTeamLeaders(league, teamId), getTeamRoster(league, teamId)]);
  const roster = new Map(rosterList.map((player) => [player.id, player]));

  const chosen: { player: RosterPlayer; role: TeamKeyPlayer["role"] }[] = [
    ...pickPlayers(leaders.passing, roster, ["QB"], 1).map((player) => ({ player, role: "QB" as const })),
    ...pickPlayers(leaders.rushing, roster, ["RB", "FB"], 2).map((player) => ({ player, role: "RB" as const })),
    ...pickPlayers(leaders.receiving, roster, ["WR", "TE"], 3).map((player) => ({ player, role: "WR-TE" as const })),
  ];

  return Promise.all(
    chosen.map(async ({ player, role }) => {
      const games = (await getPlayerGameLog(league, player.id).catch(() => [])).slice(0, 5);
      return {
        player: {
          id: player.id,
          name: player.name,
          position: player.position,
          teamAbbreviation: player.teamAbbreviation,
          jersey: player.jersey,
          photoUrl: player.photoUrl,
        },
        role,
        games,
        average: averageStats(games),
      };
    }),
  );
}
