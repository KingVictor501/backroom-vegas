/*
  FILE: lib/services/odds/match.ts
  WHAT IT'S FOR: Matches an ESPN game to the same game in The Odds API. The two
  APIs use completely different IDs (ESPN "401873022" vs Odds API
  "176d474ed8b2bbf1eb4d7e9c56b4bf22"), so we match by BOTH team names and the
  kickoff time, as the spec asks.
  WHO USES IT: lib/services/games.ts.
  WHY THIS NAME: It matches games. It ends in .ts because it shows nothing on screen.
*/

import "server-only";
import { normalizeName } from "@/lib/services/text";
import type { OddsEvent } from "./schemas";
import type { Game } from "@/types";

/*
  How far apart the two kickoff times may be and still count as the same game:
  12 hours. That allows for small time differences between the APIs, but never
  confuses two different games between the same teams (they're weeks apart).
*/
const MAX_KICKOFF_DIFFERENCE_MS = 12 * 60 * 60 * 1000;

/*
  findOddsEvent: the Odds API game that matches an ESPN game, or null if there
  isn't one (missing on purpose; odds aren't posted yet, so the card shows dashes).
  Names are compared after normalizeName(), so small differences in spelling,
  capital letters, or punctuation don't break the match.
*/
export function findOddsEvent(game: Game, events: OddsEvent[]): OddsEvent | null {
  const home = normalizeName(game.homeTeam.displayName);
  const away = normalizeName(game.awayTeam.displayName);
  const kickoff = new Date(game.startsAt).getTime();

  return (
    events.find(
      (event) =>
        normalizeName(event.home_team) === home &&
        normalizeName(event.away_team) === away &&
        Math.abs(new Date(event.commence_time).getTime() - kickoff) <= MAX_KICKOFF_DIFFERENCE_MS,
    ) ?? null
  );
}

/*
  teamIdLookup: builds a name → ESPN team ID lookup for one game's two teams,
  used to attach team IDs to odds outcomes (so team names can link to team pages).
*/
export function teamIdLookup(game: Game): (name: string) => string | null {
  const ids = new Map<string, string>([
    [normalizeName(game.homeTeam.displayName), game.homeTeam.id],
    [normalizeName(game.awayTeam.displayName), game.awayTeam.id],
  ]);
  return (name) => ids.get(normalizeName(name)) ?? null;
}
