/*
  FILE: lib/services/espn/teams.ts
  WHAT IT'S FOR: Gets team data from ESPN: the list of teams, one team's record
  and division standing, season stats, recent results, and roster. Stats only:
  no betting lines or past odds, as the spec requires.
  WHO USES IT: Later: the team page (Section 11), search (Section 6), and the
  player-name matching for props (lib/services/odds/props.ts).
  WHY THIS NAME: It's the ESPN code for teams. It ends in .ts because it shows nothing on screen.
*/

import "server-only";
import { cached, CACHE_SECONDS } from "@/lib/services/cache";
import { currentSeasonYear, espnGet, espnUrl, isNotFound, requireLeague } from "./client";
import { rosterSchema, teamDetailSchema, teamLeadersSchema, teamScheduleSchema, teamSeasonStatsSchema, teamsSchema } from "./schemas";
import { competitorScore, toGameStatus, toIsoTime, toTeamSummary } from "./mappers";
import type {
  LeagueSlug,
  PlayerSummary,
  TeamGameResult,
  TeamSeasonStats,
  TeamSummary,
} from "@/types";

/*
  getTeams: every team in the league, A to Z. Saved for 24 hours.
  Also the way we check a team ID is real. ESPN answers a fake team ID with a
  placeholder team called "TBD" instead of an error.
*/
export const getTeams = cached(
  "espn-teams",
  CACHE_SECONDS.espnTeams,
  async (leagueSlug: LeagueSlug): Promise<TeamSummary[]> => {
    const league = requireLeague(leagueSlug);
    const data = await espnGet(espnUrl("site", league, "teams"), teamsSchema, "teams");
    const teams = data.sports[0]?.leagues[0]?.teams ?? [];
    return teams
      .map(({ team }) => toTeamSummary(team, league.slug))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  },
);

/*
  TeamOverview: the top of the team page.
*/
export type TeamOverview = {
  team: TeamSummary;
  /** Like "AFC West", or null if ESPN doesn't say (missing on purpose). */
  division: string | null;
  /** Like "1st in AFC West", or null if ESPN doesn't say. */
  divisionStanding: string | null;
  seasonStats: TeamSeasonStats;
  /** The team's next game ID, so the page can link to it. null if none is scheduled. */
  nextGameId: string | null;
};

/*
  findStat: looks up one stat by name across ESPN's stat categories, or null if it isn't there.
*/
function findStat(
  categories: { name: string; stats: { name: string; value: number | null }[] }[],
  name: string,
): number | null {
  for (const category of categories) {
    const stat = category.stats.find((s) => s.name === name);
    if (stat) return stat.value;
  }
  return null;
}

/*
  getTeamOverview: one team's name, logo, record, standing, and season stats.
  Returns null for a team ID that doesn't exist, so the page can show "not found".
  Uses two ESPN answers: the team (record, points, home/away) and the Core API
  season stats (yards, turnovers). If the stats answer fails, the stats show as
  dashes instead of breaking the whole page.
*/
export const getTeamOverview = cached(
  "espn-team-overview",
  CACHE_SECONDS.espnTeam,
  async (leagueSlug: LeagueSlug, teamId: string): Promise<TeamOverview | null> => {
    const league = requireLeague(leagueSlug);
    // ESPN says "TBD" for fake team IDs, so check the ID against the real team list first.
    const teams = await getTeams(league.slug);
    if (!teams.some((t) => t.id === teamId)) return null;

    const id = encodeURIComponent(teamId);
    const [detail, stats] = await Promise.all([
      espnGet(espnUrl("site", league, `teams/${id}`), teamDetailSchema, "team"),
      espnGet(
        espnUrl("core", league, `seasons/${currentSeasonYear()}/types/2/teams/${id}/statistics`),
        teamSeasonStatsSchema,
        "team season stats",
      ).catch((error: unknown) => {
        console.error("Team season stats unavailable:", error);
        return null;
      }),
    ]);

    const recordItems = detail.team.record?.items ?? [];
    const total = recordItems.find((item) => item.type === "total");
    const recordStat = (name: string) =>
      total?.stats?.find((s) => s.name === name)?.value ?? null;
    const categories = stats?.splits.categories ?? [];
    const standing = detail.team.standingSummary ?? null;

    return {
      team: toTeamSummary(detail.team, league.slug, total?.summary ?? null),
      // "1st in AFC West" → "AFC West"
      division: standing?.split(" in ")[1] ?? null,
      divisionStanding: standing,
      seasonStats: {
        pointsFor: recordStat("pointsFor"),
        pointsAgainst: recordStat("pointsAgainst"),
        totalYardsPerGame: findStat(categories, "yardsPerGame"),
        passingYardsPerGame: findStat(categories, "netPassingYardsPerGame"),
        rushingYardsPerGame: findStat(categories, "rushingYardsPerGame"),
        // ESPN calls turnovers "giveaways" (interceptions thrown + fumbles lost).
        turnovers: findStat(categories, "totalGiveaways"),
        homeRecord: recordItems.find((item) => item.type === "home")?.summary ?? null,
        awayRecord: recordItems.find((item) => item.type === "road")?.summary ?? null,
      },
      nextGameId: detail.team.nextEvent?.[0]?.id ?? null,
    };
  },
);

/*
  getTeamRecentResults: the team's last finished games, newest first (5 by default).
  Each result's "stats" list starts empty. The team page (Section 11) fills it
  from each game's box score, which costs one ESPN request per game.
*/
export const getTeamRecentResults = cached(
  "espn-team-results",
  CACHE_SECONDS.espnTeam,
  async (leagueSlug: LeagueSlug, teamId: string, count: number = 5): Promise<TeamGameResult[]> => {
    const league = requireLeague(leagueSlug);
    let data;
    try {
      data = await espnGet(
        espnUrl("site", league, `teams/${encodeURIComponent(teamId)}/schedule`),
        teamScheduleSchema,
        "team schedule",
      );
    } catch (error) {
      if (isNotFound(error)) return [];
      throw error;
    }

    const results: TeamGameResult[] = [];
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
        opponent: toTeamSummary(them.team, league.slug),
        isHome: us.homeAway === "home",
        teamScore: ourScore,
        opponentScore: theirScore,
        result: ourScore > theirScore ? "W" : ourScore < theirScore ? "L" : "T",
        stats: [],
      });
    }
    return results.sort((a, b) => b.playedAt.localeCompare(a.playedAt)).slice(0, count);
  },
);

/*
  RosterPlayer: one player on a roster, plus their photo and jersey number.
*/
export type RosterPlayer = PlayerSummary & {
  jersey: string | null;
  photoUrl: string | null;
  /** Which part of the roster: "offense", "defense", "specialTeam", "injuredReserveOrOut", ... */
  group: string;
};

/*
  getTeamRoster: everyone on a team (except the practice squad), or [] for a
  team ID ESPN doesn't know.
*/
export const getTeamRoster = cached(
  "espn-team-roster",
  CACHE_SECONDS.espnTeam,
  async (leagueSlug: LeagueSlug, teamId: string): Promise<RosterPlayer[]> => {
    const league = requireLeague(leagueSlug);
    let data;
    try {
      data = await espnGet(
        espnUrl("site", league, `teams/${encodeURIComponent(teamId)}/roster`),
        rosterSchema,
        "roster",
      );
    } catch (error) {
      if (isNotFound(error)) return [];
      throw error;
    }

    const teams = await getTeams(league.slug);
    const abbreviation = teams.find((t) => t.id === teamId)?.abbreviation ?? null;

    return data.athletes
      .filter((group) => group.position !== "practiceSquad")
      .flatMap((group) =>
        group.items.map((athlete) => ({
          id: athlete.id,
          name: athlete.fullName ?? athlete.displayName,
          position: athlete.position?.abbreviation ?? null,
          teamAbbreviation: abbreviation,
          jersey: athlete.jersey ?? null,
          photoUrl: athlete.headshot?.href ?? null,
          group: group.position,
        })),
      );
  },
);

/*
  getTeamLeaders: the team's top players this season for passing, rushing, and
  receiving YARDS, as lists of player IDs, best first. Used to pick the "key
  players" on the team page. Returns empty lists if ESPN has none yet (week 1).
*/
export const getTeamLeaders = cached(
  "espn-team-leaders",
  CACHE_SECONDS.espnTeam,
  async (
    leagueSlug: LeagueSlug,
    teamId: string,
  ): Promise<{ passing: string[]; rushing: string[]; receiving: string[] }> => {
    const league = requireLeague(leagueSlug);
    const empty = { passing: [], rushing: [], receiving: [] };
    let data;
    try {
      data = await espnGet(
        espnUrl("core", league, `seasons/${currentSeasonYear()}/types/2/teams/${encodeURIComponent(teamId)}/leaders`),
        teamLeadersSchema,
        "team leaders",
      );
    } catch (error) {
      if (isNotFound(error)) return empty;
      throw error;
    }
    // The player ID is the number after "/athletes/" in each leader's link.
    const ids = (name: string) =>
      (data.categories.find((c) => c.name === name)?.leaders ?? [])
        .map((leader) => /\/athletes\/(\d+)/.exec(leader.athlete.$ref)?.[1])
        .filter((id): id is string => id !== undefined);
    return { passing: ids("passingYards"), rushing: ids("rushingYards"), receiving: ids("receivingYards") };
  },
);
