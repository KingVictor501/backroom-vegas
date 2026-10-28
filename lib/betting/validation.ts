/*
  FILE: lib/betting/validation.ts
  WHAT IT'S FOR: The rules for what the browser may send when it creates or
  changes a bet slip. They check the slip name, every field of every pick, and
  how many picks there are. Bad data is refused with a friendly message before
  it ever reaches the database.
  Notice what's NOT here: type, combinedOdds, oddsAreEstimated, and userId. The
  server works those out itself, so anything the browser sends for them is
  thrown away.
  WHO USES IT: app/api/betslips/route.ts and app/api/betslips/[id]/route.ts.
  Later: the New Slip and rename forms (Section 12) can use the same rules.
  WHY THIS NAME: It's betting code ("lib/betting", next to parlay.ts), and it
  validates (checks) input. It ends in .ts because it shows nothing on screen.
  It has no secrets or database code, so the browser can use it too.
*/

import { z } from "zod";
// The league list from config/leagues.ts. Picks must come from a league that's turned on.
import { LEAGUES } from "@/config/leagues";
// isValidAmericanOdds from lib/betting/parlay.ts: the same odds check the parlay math uses.
import { isValidAmericanOdds } from "@/lib/betting/parlay";
// The ESPN ID rule from lib/api/params.ts. Our game IDs are ESPN event IDs.
import { espnIdRule } from "@/lib/api/params";
// THE shared bet slip definitions and allowed-value lists from the types folder (Section 2).
import {
  BET_SLIP_MAX_PICKS,
  BET_SLIP_NAME_MAX_LENGTH,
  GAME_PERIODS,
  MARKET_CATEGORIES,
  PARTICIPANT_KINDS,
  PICK_REFRESH_STATUSES,
  PICK_SIDES,
  SPORTSBOOK_IDS,
  type BetPick,
  type LeagueSlug,
} from "@/types";

/* ENABLED_LEAGUES: the slugs of leagues that are turned on (just "nfl" for now). */
const ENABLED_LEAGUES = LEAGUES.filter((l) => l.enabled).map((l) => l.slug);

/*
  dateTimeText: a date and time written as text, like "2026-10-26T00:20Z".
  We check it with Date.parse instead of zod's date-time rule, because ESPN
  leaves off the seconds and zod's rule would refuse that.
*/
const dateTimeText = z
  .string()
  .max(40)
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    error: "That should be a date and time, like 2026-10-26T00:20Z.",
  });

/* shortText: required text, trimmed, up to `max` characters. */
function shortText(max: number) {
  return z.string().trim().min(1, { error: "This can't be blank." }).max(max, { error: `Keep this under ${max} characters.` });
}

/*
  slipNameRule: a slip name, 1 to 50 characters after trimming spaces.
*/
export const slipNameRule = z
  .string({ error: "The name must be text." })
  .trim()
  .min(1, { error: "Give the slip a name." })
  .max(BET_SLIP_NAME_MAX_LENGTH, {
    error: `Slip names can be up to ${BET_SLIP_NAME_MAX_LENGTH} characters.`,
  });

/*
  pickRefreshRule: the note on a copied pick (see PickRefresh in types/betslip.ts). It has
  to be accepted here because the browser sends the whole list of picks back whenever
  one pick is removed. The server never TRUSTS it for anything important: it is only shown as a label.
*/
const pickRefreshRule = z.object({
  status: z.enum(PICK_REFRESH_STATUSES, { error: "That isn't a price-check result we know." }),
  previousOdds: z
    .number({ error: "Odds must be a number." })
    .refine((value) => isValidAmericanOdds(value) && Math.abs(value) <= 100000, {
      error: "Odds must be American odds like -110 or +150.",
    }),
  // null means "missing on purpose": the bet has no line.
  previousLine: z.number().finite().min(-10000).max(10000).nullable(),
  previousSportsbook: z.enum(SPORTSBOOK_IDS, { error: "That isn't a sportsbook we support." }),
});

/*
  betPickRule: the rules for ONE pick. It has exactly the fields of the shared
  BetPick type ("satisfies" makes TypeScript complain if they ever drift apart).
*/
export const betPickRule = z.object({
  id: shortText(300),
  gameId: espnIdRule,
  league: z
    .string()
    .refine((value): value is LeagueSlug => (ENABLED_LEAGUES as string[]).includes(value), {
      error: `Choose a league that's available: ${ENABLED_LEAGUES.join(", ")}.`,
    })
    .transform((value) => value as LeagueSlug),
  gameLabel: shortText(100),
  gameStartsAt: dateTimeText,
  // Market keys from The Odds API look like "spreads" or "player_pass_yds".
  marketKey: z.string().regex(/^[a-z0-9_]{1,100}$/, { error: "That isn't a market we know." }),
  marketCategory: z.enum(MARKET_CATEGORIES, { error: "That isn't a market group we know." }),
  marketLabel: shortText(100),
  period: z.enum(GAME_PERIODS, { error: "That isn't a part of the game we know." }),
  participant: z.object({
    kind: z.enum(PARTICIPANT_KINDS, { error: "Choose game, team, or player." }),
    // null means "missing on purpose": a whole-game bet (like the total) isn't about one team or player.
    id: z.string().max(100).nullable(),
    name: shortText(100),
  }),
  side: z.enum(PICK_SIDES, { error: "Choose home, away, over, under, yes, or no." }),
  // null means "missing on purpose": bets like the winner or anytime TD have no line.
  line: z.number({ error: "The line must be a number." }).finite().min(-10000).max(10000).nullable(),
  odds: z
    .number({ error: "Odds must be a number." })
    .refine((value) => isValidAmericanOdds(value) && Math.abs(value) <= 100000, {
      error: "Odds must be American odds like -110 or +150.",
    }),
  sportsbook: z.enum(SPORTSBOOK_IDS, { error: "That isn't a sportsbook we support." }),
  label: shortText(200),
  addedAt: dateTimeText,
  refresh: pickRefreshRule.optional(),
}) satisfies z.ZodType<BetPick>;

/*
  picksRule: the full list of picks, up to 25, with no pick listed twice.
  (Tapping the same odds button twice REMOVES it, so a duplicate means something went wrong.)
  The "picks that can't go together" rules (both sides of a bet, and so on) are Section 8.
*/
const picksRule = z
  .array(betPickRule, { error: "picks must be a list." })
  .max(BET_SLIP_MAX_PICKS, { error: `A slip can have at most ${BET_SLIP_MAX_PICKS} picks.` })
  .refine((picks) => new Set(picks.map((pick) => pick.id)).size === picks.length, {
    error: "The same pick is on the list twice.",
  });

/*
  createBetSlipRule: what POST /api/betslips accepts (all optional).
  - name left out or blank → the server names it with today's date
  - picks left out → an empty slip
  - sgpGameId → a Build your own SGP slip locked to that game
  - setActive: true → also make it your active slip (the one in the slip bar)
  - numberIfTaken: true → if the name is taken, add (2), (3), ... instead of
    refusing. Used for automatic names like "KC @ SEA SGP".
*/
export const createBetSlipRule = z.object({
  // A blank name counts as "no name", so the date gets used.
  name: z
    .string({ error: "The name must be text." })
    .trim()
    .transform((value) => value || undefined)
    .pipe(slipNameRule.optional())
    .optional(),
  picks: picksRule.default([]),
  // null means "missing on purpose": a normal slip isn't locked to one game.
  sgpGameId: espnIdRule.nullable().default(null),
  setActive: z.boolean({ error: "setActive must be true or false." }).default(false),
  numberIfTaken: z.boolean({ error: "numberIfTaken must be true or false." }).default(false),
});

/*
  updateBetSlipRule: what PATCH /api/betslips/<id> accepts. Send a new name, the
  new full list of picks, or both. Sending neither is refused.
*/
export const updateBetSlipRule = z
  .object({ name: slipNameRule.optional(), picks: picksRule.optional() })
  .refine((input) => input.name !== undefined || input.picks !== undefined, {
    error: "Send a new name, a new list of picks, or both.",
  });

/*
  activeBetSlipRule: what PUT /api/betslips/active accepts.
  { "slipId": "<id>" } makes that slip your active one. { "slipId": null }
  means no active slip (null is missing on purpose), which is what "Done" does in SGP mode.
*/
export const activeBetSlipRule = z.object({
  slipId: z.string({ error: "slipId must be a slip ID or null." }).max(100).nullable(),
});
