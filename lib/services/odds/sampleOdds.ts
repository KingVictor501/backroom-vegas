/*
  FILE: lib/services/odds/sampleOdds.ts
  WHAT IT'S FOR: "Sample odds mode" for building and testing WITHOUT spending Odds API credits.
  When SAMPLE_ODDS=true is set in .env.local, lib/services/odds/client.ts asks this file for
  answers instead of calling the internet. The answers come from saved real responses in the
  api-samples folder on YOUR computer (B3 = game lines for every game, B5/B6 = player props
  and halves for ONE game, Kansas City @ Seattle).
  WHAT TO EXPECT:
  - Feed and league pages: spread, total, and winner for every game in the sample.
  - Matchup extras (props, halves): only for the game that has them in the samples. Other games
    say the book doesn't offer them, which is the app's normal "no markets" message.
  - The odds are OLD (saved from a past day), so don't treat them as current.
  SAFETY: this can NEVER run on the live site or on Vercel previews. It only turns on when
  SAMPLE_ODDS is exactly "true" AND the app is NOT a production build (Vercel always builds in
  production mode). The api-samples folder is gitignored, so it never reaches GitHub or Vercel.
  WHO USES IT: lib/services/odds/client.ts (oddsGet). Tests: lib/services/odds/sampleOdds.test.ts.
  WHY THIS NAME: It serves sample odds. It sits with the other odds code and ends in .ts because
  it shows nothing on screen.
*/

import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { z } from "zod";
import { UpstreamError } from "@/lib/services/http";

/* The saved files (inside the samples folder). */
const GAME_LINES_FILE = "B3-odds-game-lines.json";

/*
  SPORT_GAME_LINES_FILES: leagues that have their OWN saved game-lines file. Any other league uses the
  NFL file above. (Extra markets like player props only exist for the NFL samples.)
*/
const SPORT_GAME_LINES_FILES: Record<string, string> = {
  basketball_nba: "B3-nba-odds-game-lines.json",
};

/* sportFile: which saved file answers a request path like "/sports/basketball_nba/odds". */
function sportFile(requestPath: string): string {
  const sport = /^\/sports\/([^/]+)\//.exec(requestPath)?.[1] ?? "";
  return SPORT_GAME_LINES_FILES[sport] ?? GAME_LINES_FILE;
}
// B4 only lists market NAMES (no prices), so it is not used here.
const EXTRA_FILES = ["B5-event-props.json", "B6-event-halves.json"];

/*
  sampleOddsEnabled: true only when SAMPLE_ODDS is exactly "true" and this is not a production build.
*/
export function sampleOddsEnabled(): boolean {
  return process.env.SAMPLE_ODDS === "true" && process.env.NODE_ENV !== "production";
}

/* SampleEvent: the small part of an Odds API game that we need to merge and filter samples. */
type SampleEvent = { id: string; bookmakers?: SampleBookmaker[] } & Record<string, unknown>;
type SampleBookmaker = { key: string; markets: { key: string }[] } & Record<string, unknown>;

/* samplesFolder: where the saved files live (api-samples by default; tests point it at their own folder). */
function samplesFolder(): string {
  return process.env.SAMPLE_ODDS_DIR ?? path.join(/*turbopackIgnore: true*/ process.cwd(), "api-samples");
}

/* readJson: reads one saved file, with a friendly error if it's missing. */
async function readJson(file: string): Promise<unknown> {
  try {
    // turbopackIgnore: this only runs in sample mode on your own computer (never in production), so Next.js
    // must not copy the whole project into the deployment just because the folder is chosen at run time.
    return JSON.parse(await readFile(path.join(/*turbopackIgnore: true*/ samplesFolder(), file), "utf8"));
  } catch {
    throw new UpstreamError("The Odds API", null, `sample odds mode is on, but ${file} could not be read from the api-samples folder`);
  }
}

/*
  onlyMarkets: a copy of a game that keeps only the asked-for markets (and drops books left with none),
  like the real API does when you ask for specific markets.
*/
function onlyMarkets(event: SampleEvent, wanted: string[]): SampleEvent {
  const bookmakers = (event.bookmakers ?? [])
    .map((book) => ({ ...book, markets: book.markets.filter((market) => wanted.includes(market.key)) }))
    .filter((book) => book.markets.length > 0);
  return { ...event, bookmakers };
}

/*
  withExtras: the game plus any extra markets the saved extra files hold for the SAME game,
  merged book by book (a market already there is kept once).
*/
async function withExtras(event: SampleEvent): Promise<SampleEvent> {
  const merged = new Map<string, SampleBookmaker>((event.bookmakers ?? []).map((book) => [book.key, { ...book, markets: [...book.markets] }]));
  for (const file of EXTRA_FILES) {
    const extra = (await readJson(file)) as SampleEvent;
    if (extra.id !== event.id) continue;
    for (const book of extra.bookmakers ?? []) {
      const target = merged.get(book.key) ?? { ...book, markets: [] };
      for (const market of book.markets) if (!target.markets.some((m) => m.key === market.key)) target.markets.push(market);
      merged.set(book.key, target);
    }
  }
  return { ...event, bookmakers: [...merged.values()] };
}

/*
  getSampleOdds: answers the same questions oddsGet asks the internet:
  - ".../odds" (every game): the saved game-lines list
  - ".../events/<id>/odds": that one game with the asked-for markets, or a 404 (as the real API would) if the id isn't in the samples
  The answer goes through the SAME schema check as a real answer.
*/
export async function getSampleOdds<Schema extends z.ZodType>(
  requestPath: string,
  params: Record<string, string>,
  schema: Schema,
  label: string,
): Promise<z.infer<Schema>> {
  const file = sportFile(requestPath);
  const events = (await readJson(file)) as SampleEvent[];
  const match = /\/events\/([^/]+)\/odds$/.exec(requestPath);

  let answer: unknown;
  if (!match) {
    answer = events;
  } else {
    const id = decodeURIComponent(match[1]);
    const event = events.find((candidate) => candidate.id === id);
    if (!event) throw new UpstreamError("The Odds API", 404, "that game is not in the saved samples");
    // Extra markets (player props, halves) were only saved for the NFL, so other leagues skip the merge.
    const full = file === GAME_LINES_FILE ? await withExtras(event) : event;
    answer = onlyMarkets(full, (params.markets ?? "").split(",").filter(Boolean));
  }

  console.info(`[Odds API] ${label}: SAMPLE data (no credits used)`);
  return schema.parse(answer);
}
