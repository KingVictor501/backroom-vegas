/*
  FILE: lib/services/odds/client.ts
  WHAT IT'S FOR: Talks to The Odds API. It adds your secret key (from
  ODDS_API_KEY), asks for all three of our sportsbooks at once, and logs how many
  credits you have left after every call (in your terminal, or Vercel's logs).
  SECURITY: the key is only read here, on the server. It's never sent to the
  browser, and it's never printed. Logs use a label like "game lines", not the address.
  WHO USES IT: The other files in lib/services/odds.
  WHY THIS NAME: A "client" is the code that talks to a service. It ends in .ts
  because it shows nothing on screen.
*/

import "server-only";
// assertSafePath from lib/services/safePath.ts: refuses traversal tricks like ".." in an address.
import { assertSafePath } from "@/lib/services/safePath";
import type { z } from "zod";
import { fetchJson, UpstreamError } from "@/lib/services/http";
// Our sportsbook IDs and each one's Odds API name, from config/sportsbooks.ts.
import { SPORTSBOOKS } from "@/config/sportsbooks";
import { SPORTSBOOK_IDS, type SportsbookId } from "@/types";

/*
  The Odds API's address. We use the regular one, not the IPv6-only one
  (Vercel and home internet both connect over IPv4).
*/
const ODDS_API_BASE = "https://api.the-odds-api.com/v4";

/*
  ALL_BOOKMAKER_KEYS: "hardrockbet,betmgm,williamhill_us". We always ask for all
  three books in ONE call. Up to 10 books cost the same as one, so this is free,
  and one saved answer then serves every user, whichever book they picked.
*/
const ALL_BOOKMAKER_KEYS = SPORTSBOOK_IDS.map((id) => SPORTSBOOKS[id].providerKeys.theOddsApi).join(",");

/*
  toSportsbookId: The Odds API's book name ("williamhill_us") → our ID ("caesars").
  null for books we don't support (missing on purpose: they're skipped).
*/
export function toSportsbookId(oddsApiKey: string): SportsbookId | null {
  return SPORTSBOOK_IDS.find((id) => SPORTSBOOKS[id].providerKeys.theOddsApi === oddsApiKey) ?? null;
}

/*
  oddsGet: calls The Odds API.
  - path: like "/sports/americanfootball_nfl/odds"
  - params: extra settings, like markets=h2h,spreads,totals
  Always adds: the key, our three books, and oddsFormat=american (-110 style).
*/
export async function oddsGet<Schema extends z.ZodType>(
  path: string,
  params: Record<string, string>,
  schema: Schema,
  label: string,
): Promise<z.infer<Schema>> {
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) {
    throw new UpstreamError("The Odds API", null, "ODDS_API_KEY is missing from .env.local / Vercel");
  }

  // Second lock against path traversal: refuse "..", ".", or hidden slashes in the path (lib/services/safePath.ts).
  assertSafePath(path);
  const query = new URLSearchParams({
    ...params,
    bookmakers: ALL_BOOKMAKER_KEYS,
    oddsFormat: "american",
    apiKey,
  });
  const { data, headers } = await fetchJson(`${ODDS_API_BASE}${path}?${query}`, schema, {
    source: "The Odds API",
    label,
  });

  // The Odds API reports your credits in the response headers. Log them so you can watch your budget.
  console.info(
    `[Odds API] ${label}: cost ${headers.get("x-requests-last") ?? "?"} credits, ` +
      `${headers.get("x-requests-remaining") ?? "?"} left this month`,
  );
  return data;
}
