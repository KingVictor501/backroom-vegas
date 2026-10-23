/*
  FILE: lib/services/espn/schemas.ts
  WHAT IT'S FOR: Descriptions ("schemas") of the parts of ESPN's answers that we
  actually read. They're built from the real sample responses saved in
  api-samples/ (C1-C15). zod checks each ESPN answer against these. If ESPN
  changes a field we rely on, we get a clear "unexpected shape" error instead of
  a page crashing on undefined. Fields we don't list are simply ignored. That
  includes ESPN's odds, "pickcenter", and "againstTheSpread" sections, which we
  never use, because the app shows no historical betting lines.
  WHO USES IT: The other files in lib/services/espn.
  WHY THIS NAME: "schemas" is zod's word for data descriptions. It ends in .ts
  because it shows nothing on screen.
*/

import { z } from "zod";

/*
  numberish: ESPN sometimes sends numbers as numbers (22) and sometimes as text
  ("22" or "1,309"). This accepts both and turns them into a number, or null if
  it's blank or not a number (missing on purpose).
*/
export const numberish = z
  .union([z.number(), z.string()])
  .transform((value) => {
    const n = typeof value === "number" ? value : Number(value.replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  });

/* A team as ESPN describes it inside most answers. */
export const espnTeamSchema = z.object({
  id: z.string(),
  abbreviation: z.string(),
  location: z.string().optional(),
  name: z.string().optional(),
  displayName: z.string(),
  // Some answers give one "logo" link, others a "logos" list.
  logo: z.string().optional(),
  logos: z.array(z.object({ href: z.string() })).optional(),
});
export type EspnTeam = z.infer<typeof espnTeamSchema>;

/* A team's win-loss record, like { type: "total", summary: "5-0" }. */
const espnRecordSchema = z.object({
  type: z.string().optional(),
  name: z.string().optional(),
  summary: z.string().optional(),
});

/* Where a game is right now. "state" is "pre" (not started), "in" (live), or "post" (finished). */
export const espnStatusSchema = z.object({
  type: z.object({
    name: z.string(),
    state: z.string(),
    completed: z.boolean(),
  }),
});

/* One team in one game. */
const espnCompetitorSchema = z.object({
  id: z.string(),
  homeAway: z.enum(["home", "away"]),
  // Scoreboard sends "22"; team schedule sends { value: 22 }.
  score: z.union([numberish, z.object({ value: numberish })]).optional(),
  winner: z.boolean().optional(),
  team: espnTeamSchema,
  // Scoreboard calls it "records"; game summary calls it "record".
  records: z.array(espnRecordSchema).optional(),
  record: z.array(espnRecordSchema).optional(),
});
export type EspnCompetitor = z.infer<typeof espnCompetitorSchema>;

/* One game (ESPN calls it an "event") with its "competition" (the matchup details). */
export const espnEventSchema = z.object({
  id: z.string(),
  date: z.string(),
  shortName: z.string().optional(),
  status: espnStatusSchema.optional(),
  competitions: z
    .array(
      z.object({
        status: espnStatusSchema.optional(),
        venue: z.object({ fullName: z.string().optional() }).optional(),
        competitors: z.array(espnCompetitorSchema),
      }),
    )
    .min(1),
});
export type EspnEvent = z.infer<typeof espnEventSchema>;

/*
  C12: the scoreboard (this week's games). week and season say WHICH week it
  is (like week 7 of the regular season, type 2), so we can ask for the next one.
  ESPN also sends betting odds inside each game. We never read them (no odds from ESPN).
*/
export const scoreboardSchema = z.object({
  events: z.array(espnEventSchema),
  week: z.object({ number: z.number() }).optional(),
  season: z.object({ type: z.number() }).optional(),
});

/* C1: every team in the league. */
export const teamsSchema = z.object({
  sports: z.array(
    z.object({
      leagues: z.array(z.object({ teams: z.array(z.object({ team: espnTeamSchema })) })),
    }),
  ),
});

/* C2: one team, with its record (and the stats inside it) and division standing. */
export const teamDetailSchema = z.object({
  team: espnTeamSchema.extend({
    standingSummary: z.string().optional(),
    record: z
      .object({
        items: z.array(
          espnRecordSchema.extend({
            stats: z.array(z.object({ name: z.string(), value: numberish })).optional(),
          }),
        ),
      })
      .optional(),
    nextEvent: z.array(z.object({ id: z.string() })).optional(),
  }),
});

/* C3: one team's season schedule (finished and upcoming games). */
export const teamScheduleSchema = z.object({ events: z.array(espnEventSchema) });

/*
  C17 (Core API): a team's stat leaders this season, like "Passing Yards" →
  [Mahomes 1,309]. Each leader only has a link to the player ($ref), whose
  address ends in the player's ID, like ".../athletes/3139477?lang=en".
*/
export const teamLeadersSchema = z.object({
  categories: z.array(
    z.object({
      name: z.string(),
      leaders: z.array(z.object({ value: z.number().optional(), athlete: z.object({ $ref: z.string() }) })).default([]),
    }),
  ),
});

/* C13 (Core API): one team's season stats, grouped into categories like "passing". */
export const teamSeasonStatsSchema = z.object({
  splits: z.object({
    categories: z.array(
      z.object({
        name: z.string(),
        stats: z.array(z.object({ name: z.string(), value: numberish })),
      }),
    ),
  }),
});

/* One player, as listed on a roster. */
export const espnRosterAthleteSchema = z.object({
  id: z.string(),
  fullName: z.string().optional(),
  displayName: z.string(),
  jersey: z.string().optional(),
  position: z.object({ abbreviation: z.string() }).optional(),
  headshot: z.object({ href: z.string() }).optional(),
});

/* C4: a team's roster, grouped as offense, defense, special teams, and so on. */
export const rosterSchema = z.object({
  athletes: z.array(
    z.object({ position: z.string(), items: z.array(espnRosterAthleteSchema) }),
  ),
});

/*
  C5: league-wide injuries, grouped by team.
  The injured player has no "id" field here. The ID is inside their ESPN web link
  (".../player/_/id/15847/travis-kelce"), so we keep the links to pull it out.
*/
export const injuriesSchema = z.object({
  injuries: z.array(
    z.object({
      id: z.string(),
      injuries: z.array(
        z.object({
          status: z.string(),
          date: z.string().optional(),
          shortComment: z.string().optional(),
          details: z.object({ type: z.string().optional() }).optional(),
          athlete: z.object({
            displayName: z.string(),
            position: z.object({ abbreviation: z.string() }).optional(),
            team: z.object({ abbreviation: z.string().optional() }).optional(),
            links: z.array(z.object({ href: z.string() })).optional(),
          }),
        }),
      ),
    }),
  ),
});

/* One ESPN news story (C6, and the "news" inside a player overview). */
export const espnArticleSchema = z.object({
  id: z.union([z.number(), z.string()]).optional(),
  headline: z.string(),
  description: z.string().optional(),
  published: z.string().optional(),
  lastModified: z.string().optional(),
  images: z
    .array(z.object({ url: z.string(), alt: z.string().optional(), caption: z.string().optional() }))
    .optional(),
  links: z.object({ web: z.object({ href: z.string() }).optional() }).optional(),
});
export type EspnArticle = z.infer<typeof espnArticleSchema>;

/* C6: a list of news stories. */
export const newsSchema = z.object({ articles: z.array(espnArticleSchema) });

/*
  C8/C14: one game's summary.
  - header: the two teams, records, and status
  - predictor: ESPN's win chance for each team (before kickoff), as text like "52.8"
  - boxscore.teams: each team's stats for that game (once it's been played)
*/
export const gameSummarySchema = z.object({
  header: z.object({
    competitions: z
      .array(
        z.object({
          date: z.string(),
          status: espnStatusSchema.optional(),
          competitors: z.array(espnCompetitorSchema),
        }),
      )
      .min(1),
  }),
  gameInfo: z.object({ venue: z.object({ fullName: z.string().optional() }).optional() }).optional(),
  predictor: z
    .object({
      homeTeam: z.object({ gameProjection: numberish.optional() }).optional(),
      awayTeam: z.object({ gameProjection: numberish.optional() }).optional(),
    })
    .optional(),
  boxscore: z
    .object({
      teams: z
        .array(
          z.object({
            team: z.object({ id: z.string() }),
            statistics: z.array(
              z.object({ name: z.string(), label: z.string().optional(), displayValue: z.string() }),
            ),
          }),
        )
        .optional(),
    })
    .optional(),
});

/* C15: one player's basic details (name, number, position, team, photo). */
export const athleteSchema = z.object({
  athlete: z.object({
    id: z.string(),
    displayName: z.string(),
    jersey: z.string().optional(),
    position: z.object({ abbreviation: z.string() }).optional(),
    team: z.object({ id: z.string() }).optional(),
    headshot: z.object({ href: z.string() }).optional(),
  }),
});

/* C9: a player's overview. We use the next game and the news. */
export const athleteOverviewSchema = z.object({
  nextGame: z
    .object({
      league: z.object({ events: z.array(z.object({ id: z.string() })).optional() }).optional(),
    })
    .optional(),
  news: z.array(espnArticleSchema).optional(),
});

/*
  C10: a player's game log. The stat NAMES are listed once at the top ("names"),
  and each game's numbers come in the same order. "events" holds each game's
  date, opponent, and result.
*/
export const gameLogSchema = z.object({
  names: z.array(z.string()),
  events: z.record(
    z.string(),
    z.object({
      gameDate: z.string(),
      atVs: z.string().optional(),
      gameResult: z.string().optional(),
      opponent: z.object({ abbreviation: z.string() }).optional(),
    }),
  ),
  seasonTypes: z.array(
    z.object({
      displayName: z.string().optional(),
      categories: z
        .array(
          z.object({
            events: z.array(z.object({ eventId: z.string(), stats: z.array(z.string()) })).optional(),
          }),
        )
        .optional(),
    }),
  ),
});

/*
  C16: ESPN's player search results ("walker" → Kenneth Walker III, Quay Walker, ...).
  Each result's team is inside "teamRelationships".
*/
export const playerSearchSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      displayName: z.string(),
      position: z.object({ abbreviation: z.string() }).optional(),
      isActive: z.boolean().optional(),
      teamRelationships: z
        .array(z.object({ core: z.object({ abbreviation: z.string().optional() }).optional() }))
        .optional(),
    }),
  ),
});

/*
  C11: a player's season stats, by category (passing, rushing, receiving, ...).
  Each category lists its stat "names", then one row per season in "statistics".
*/
export const athleteStatsSchema = z.object({
  categories: z
    .array(
      z.object({
        name: z.string(),
        names: z.array(z.string()),
        statistics: z
          .array(
            z.object({
              season: z.object({ year: z.number() }).optional(),
              stats: z.array(z.string()),
            }),
          )
          .optional(),
      }),
    )
    .optional(),
});
