/*
  FILE: lib/services/espn/injuries.ts
  WHAT IT'S FOR: Gets the league's injury report from ESPN and turns it into our
  Injury type, grouped by team.
  ESPN only offers ONE league-wide injury list, and it's huge (about 17 MB).
  So we download it at most every 30 minutes, keep only the small cleaned-up
  version, and look up one team or one player from that.
  WHO USES IT: Later: the team page (Section 11) and the player page (Section 11B).
  WHY THIS NAME: It's the ESPN code for injuries. It ends in .ts because it shows nothing on screen.
*/

import "server-only";
import { cached, CACHE_SECONDS } from "@/lib/services/cache";
import { toPlainText } from "@/lib/services/text";
import { espnGet, espnUrl, requireLeague } from "./client";
import { injuriesSchema } from "./schemas";
import { toIsoTime } from "./mappers";
import type { Injury, LeagueSlug } from "@/types";

/*
  playerIdFromLink: ESPN's injury list has no player ID field, but each player's
  ESPN link contains it: ".../nfl/player/_/id/15847/travis-kelce" → "15847".
  Returns null if no link has an ID (missing on purpose; the name won't link to a player page).
*/
function playerIdFromLink(links: { href: string }[] | undefined): string | null {
  for (const link of links ?? []) {
    const match = link.href.match(/\/id\/(\d+)/);
    if (match) return match[1];
  }
  return null;
}

/*
  getInjuriesByTeam: every injury in the league, grouped by ESPN team ID.
  Example: { "12": [ { player: Travis Kelce, status: "Questionable", detail: "Ankle" } ] }
*/
export const getInjuriesByTeam = cached(
  "espn-injuries",
  CACHE_SECONDS.espnInjuries,
  async (leagueSlug: LeagueSlug): Promise<Record<string, Injury[]>> => {
    const league = requireLeague(leagueSlug);
    const data = await espnGet(espnUrl("site", league, "injuries"), injuriesSchema, "injuries");

    const byTeam: Record<string, Injury[]> = {};
    for (const team of data.injuries) {
      byTeam[team.id] = team.injuries
        // ESPN also lists players who just RETURNED from injury, with status "Active".
        // They're healthy, so they're left off the injury report.
        .filter((injury) => injury.status.toLowerCase() !== "active")
        .map((injury) => ({
        player: {
          // If ESPN's link has no ID, we use "" and the page shows the name without a link.
          id: playerIdFromLink(injury.athlete.links) ?? "",
          name: injury.athlete.displayName,
          position: injury.athlete.position?.abbreviation ?? null,
          teamAbbreviation: injury.athlete.team?.abbreviation ?? null,
        },
        status: injury.status,
        // "Ankle", or ESPN's short note if no injury type is given. Plain text only.
        detail: toPlainText(injury.details?.type ?? injury.shortComment ?? ""),
        updatedAt: injury.date ? toIsoTime(injury.date) : null,
      }));
    }
    return byTeam;
  },
);

/* getTeamInjuries: one team's injuries, or [] if the team has none listed. */
export async function getTeamInjuries(leagueSlug: LeagueSlug, teamId: string): Promise<Injury[]> {
  const byTeam = await getInjuriesByTeam(leagueSlug);
  return byTeam[teamId] ?? [];
}

/*
  getPlayerInjuryStatus: a player's injury status, like "Questionable", or null
  if they're not on the injury report (missing on purpose: null means healthy).
*/
export async function getPlayerInjuryStatus(
  leagueSlug: LeagueSlug,
  playerId: string,
): Promise<string | null> {
  const byTeam = await getInjuriesByTeam(leagueSlug);
  for (const injuries of Object.values(byTeam)) {
    const found = injuries.find((injury) => injury.player.id === playerId);
    if (found) return found.status;
  }
  return null;
}
