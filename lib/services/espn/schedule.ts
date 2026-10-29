/*
  FILE: lib/services/espn/schedule.ts
  WHAT IT'S FOR: The "Remaining schedule" on the team page: the games a team still has to play (or is playing
  right now), soonest first. It reads the same ESPN schedule list that "Last 5 games" uses, but keeps the games
  that are NOT finished. Works for every league that has team pages (NFL and NBA). Stats only: no betting lines.
  WHO USES IT: components/team/TeamSections.tsx (UpcomingSchedule), on the NFL and NBA team pages.
  WHY THIS NAME: It's the schedule part of the ESPN service. It ends in .ts because it shows nothing on screen.
*/

import "server-only";
import { cached, CACHE_SECONDS } from "@/lib/services/cache";
import { espnGet, espnUrl, isNotFound, requireLeague } from "./client";
import { teamScheduleSchema, type EspnEvent } from "./schemas";
import { toGameStatus, toIsoTime, toTeamSummary } from "./mappers";
import type { LeagueSlug, TeamUpcomingGame } from "@/types";

/*
  toUpcomingGames: turns ESPN's list of games into the games still to come, soonest first.
  - Finished and canceled games are left out (finished ones are in "Last 5 games").
  - A game with no opponent we can find (ESPN sometimes lists "TBD") is skipped.
  Separate from the fetching so tests can feed it sample data.
*/
export function toUpcomingGames(events: EspnEvent[], teamId: string, leagueSlug: LeagueSlug): TeamUpcomingGame[] {
  const games: TeamUpcomingGame[] = [];
  for (const event of events) {
    const competition = event.competitions[0];
    const status = toGameStatus(competition.status ?? event.status);
    if (status !== "scheduled" && status !== "in-progress" && status !== "postponed") continue;
    const us = competition.competitors.find((c) => c.team.id === teamId);
    const them = competition.competitors.find((c) => c.team.id !== teamId);
    if (!us || !them) continue;
    games.push({
      gameId: event.id,
      startsAt: toIsoTime(event.date),
      opponent: toTeamSummary(them.team, leagueSlug),
      isHome: us.homeAway === "home",
      status,
      venue: competition.venue?.fullName ?? null, // null: ESPN didn't list a stadium
    });
  }
  return games.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

/*
  getTeamUpcomingGames: the team's remaining games, soonest first, or [] for a team ID ESPN doesn't know.
  Saved for the same time as the rest of the team page, so it doesn't use up extra ESPN requests.
*/
export const getTeamUpcomingGames = cached(
  "espn-team-upcoming",
  CACHE_SECONDS.espnTeam,
  async (leagueSlug: LeagueSlug, teamId: string): Promise<TeamUpcomingGame[]> => {
    const league = requireLeague(leagueSlug);
    try {
      const data = await espnGet(espnUrl("site", league, `teams/${encodeURIComponent(teamId)}/schedule`), teamScheduleSchema, "team schedule");
      return toUpcomingGames(data.events, teamId, league.slug);
    } catch (error) {
      if (isNotFound(error)) return [];
      throw error;
    }
  },
);
