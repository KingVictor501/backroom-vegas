/*
  FILE: lib/api/params.ts
  WHAT IT'S FOR: The rules for the values people can put in an API address:
  which league, what an ESPN ID looks like, which prop category, and so on.
  Anything outside these rules gets a friendly "400 invalid input" answer
  BEFORE we contact ESPN or The Odds API. That saves requests, and odd input
  never reaches an outside address.
  WHO USES IT: The routes in app/api.
  WHY THIS NAME: These are the parameters (settings) routes accept. It ends in
  .ts because it shows nothing on screen.
*/

import { z } from "zod";
// The league list from config/leagues.ts. Only leagues that are turned ON are allowed.
import { LEAGUES } from "@/config/leagues";
import type { LeagueSlug, PropCategory } from "@/types";

/* ENABLED_LEAGUES: the slugs of leagues that are turned on (just "nfl" for now). */
const ENABLED_LEAGUES = LEAGUES.filter((l) => l.enabled).map((l) => l.slug);

/*
  leagueParam: ?league=nfl. Optional, and defaults to "nfl".
  A turned-off league (like "nba") is refused with a clear message.
*/
export const leagueParam = z
  .string()
  .trim()
  .toLowerCase()
  .default("nfl")
  .refine((value): value is LeagueSlug => (ENABLED_LEAGUES as string[]).includes(value), {
    error: `Choose a league that's available: ${ENABLED_LEAGUES.join(", ")}.`,
  })
  .transform((value) => value as LeagueSlug);

/*
  espnIdRule: ESPN IDs are numbers written as text, like "401873022" or "12".
  1 to 12 digits, nothing else, so letters, slashes, or tricks like "../" are refused.
*/
export const espnIdRule = z
  .string()
  .regex(/^\d{1,12}$/, { error: "That ID should be a number, like 401873022." });

/* PROP_CATEGORIES: the five Player Props buttons. */
export const PROP_CATEGORIES = ["touchdowns", "passing", "rushing", "receiving", "receptions"] as const satisfies readonly PropCategory[];

/* categoryParam: ?category=touchdowns (required). */
export const categoryParam = z.enum(PROP_CATEGORIES, {
  error: `Choose ${PROP_CATEGORIES.join(", ")}.`,
});

/* optionalTeamParam: ?team=12 (optional ESPN team ID). */
export const optionalTeamParam = espnIdRule.optional();

/* limitParam: ?limit=10. A whole number from 1 to 25, default 10. */
export const limitParam = z.coerce
  .number({ error: "limit must be a number." })
  .int({ error: "limit must be a whole number." })
  .min(1, { error: "limit must be at least 1." })
  .max(25, { error: "limit can be at most 25." })
  .default(10);
