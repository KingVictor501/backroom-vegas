/*
  FILE: lib/services/odds/schemas.ts
  WHAT IT'S FOR: Descriptions ("schemas") of The Odds API's answers, built from
  your real Postman samples (api-samples/B2-B6). zod checks every answer against these.
  WHO USES IT: The other files in lib/services/odds.
  WHY THIS NAME: "schemas" is zod's word for data descriptions. It ends in .ts
  because it shows nothing on screen.
*/

import { z } from "zod";

/*
  One outcome, meaning one odds button.
  - name: a team name ("Kansas City Chiefs") for spreads/winner, or "Over"/"Under"/"Yes"/"No".
  - description: the PLAYER's name for player props ("Patrick Mahomes"), or a team name for team totals.
  - price: American odds, like -115 or 220.
  - point: the line, like -2.5 or 219.5. Missing for winner and anytime TD bets.
*/
export const oddsOutcomeSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  price: z.number(),
  point: z.number().optional(),
});
export type OddsOutcome = z.infer<typeof oddsOutcomeSchema>;

/* One market from one sportsbook, like "spreads" from Hard Rock. */
export const oddsMarketSchema = z.object({
  key: z.string(),
  last_update: z.string().optional(),
  outcomes: z.array(oddsOutcomeSchema),
});
export type OddsMarket = z.infer<typeof oddsMarketSchema>;

/* One sportsbook's markets for one game. "key" is the book's Odds API name, like "hardrockbet". */
export const oddsBookmakerSchema = z.object({
  key: z.string(),
  last_update: z.string().optional(),
  markets: z.array(oddsMarketSchema),
});

/*
  One game. home_team and away_team are full names like "Seattle Seahawks",
  the same as ESPN's displayName, which is how we match games between the two APIs.
  commence_time is the kickoff, like "2026-10-26T00:20:00Z".
*/
export const oddsEventSchema = z.object({
  id: z.string(),
  commence_time: z.string(),
  home_team: z.string(),
  away_team: z.string(),
  bookmakers: z.array(oddsBookmakerSchema).optional(),
});
export type OddsEvent = z.infer<typeof oddsEventSchema>;

/* B2/B3: a list of games (with or without odds). */
export const oddsEventListSchema = z.array(oddsEventSchema);

/* B4: which markets each book offers for one game (no prices). */
export const oddsEventMarketListSchema = z.object({
  id: z.string(),
  bookmakers: z.array(z.object({ key: z.string(), markets: z.array(z.object({ key: z.string() })) })),
});
