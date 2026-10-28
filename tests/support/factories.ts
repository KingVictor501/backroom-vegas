/*
  FILE: tests/support/factories.ts
  WHAT IT'S FOR: Ready-made test data and requests:
  - makePick(): a complete, valid pick ("Chiefs -3 at -110"). A test changes only
    the fields it cares about. Its ID is built the same way the app builds it.
  - jsonRequest(): a request carrying JSON, like the browser or Postman would send
  - slipContext(): the "params" object Next.js gives a route like /api/betslips/<id>
  - KC_SEA, LAC_KC: the IDs of two example games
  WHO USES IT: the API and database tests in tests/.
  WHY THIS NAME: A "factory" is test-speak for something that makes sample data.
  It ends in .ts because it shows nothing on screen.
*/

import { makePickId } from "@/lib/betting/picks";
import type { BetPick } from "@/types";

/* Two example games: Chiefs @ Seahawks, and Chargers @ Chiefs. */
export const KC_SEA = "401873022";
export const LAC_KC = "401873006";

/*
  makePick: a valid pick, with any fields you give replacing the defaults.
  If you don't give an id, it's worked out from the other fields with the app's
  own makePickId(), so two different picks automatically get different IDs.
*/
export function makePick(changes: Partial<BetPick> = {}): BetPick {
  const pick: BetPick = {
    id: "",
    gameId: KC_SEA,
    league: "nfl",
    gameLabel: "KC @ SEA",
    gameStartsAt: "2026-10-26T00:20Z",
    marketKey: "spreads",
    marketCategory: "game-lines",
    marketLabel: "Spread",
    period: "full-game",
    participant: { kind: "team", id: "12", name: "Kansas City Chiefs" },
    side: "away",
    line: -3,
    odds: -110,
    sportsbook: "hardrock",
    label: "Chiefs -3",
    addedAt: "2026-10-22T20:00:00Z",
    ...changes,
  };
  return { ...pick, id: changes.id ?? makePickId(pick) };
}

/*
  jsonRequest: builds a request to our own site with a JSON body.
  `body` can be anything; a string is sent exactly as given (to test broken JSON).
  Pass contentType to send something that isn't JSON.
*/
export function jsonRequest(
  method: string,
  path: string,
  body?: unknown,
  contentType = "application/json",
): Request {
  return new Request(`http://localhost:3000${path}`, {
    method,
    headers: { "content-type": contentType },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
}

/* slipContext: what Next.js passes to /api/betslips/[id] routes: the ID from the address, wrapped in a promise. */
export function slipContext(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}
