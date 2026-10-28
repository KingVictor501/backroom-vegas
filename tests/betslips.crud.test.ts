/*
  FILE: tests/betslips.crud.test.ts
  WHAT IT'S FOR: Automatic API tests for bet slips. CRUD = Create, Read, Update,
  Delete, the four things you can do to a saved slip. Each test sends a real
  request to the real route code (app/api/betslips/...), logged in as a test user,
  against the throwaway test database, and checks BOTH the answer the route sends
  AND what is actually stored afterward.
  An API test is different from a unit test: instead of calling one small
  function, it sends a whole request through the route (login check, input
  checking, database) and looks at the response, the way Postman would.
  Also covered: the server does the type/odds math itself (ignoring what the
  browser claims), refuses bad or oversized input with the right status, and
  refuses picks that can't go together.
  WHO USES IT: Vitest, when you run `npm test`.
  WHY THIS NAME: It tests bet slip CRUD. It sits in tests/ because it needs the
  test database. It ends in .ts because it shows nothing on screen.
*/

import { beforeEach, describe, expect, it } from "vitest";
import { PUT as activePut, GET as activeGet } from "@/app/api/betslips/active/route";
import { DELETE as slipDelete, GET as slipGet, PATCH as slipPatch } from "@/app/api/betslips/[id]/route";
import { GET as slipsGet, POST as slipsPost } from "@/app/api/betslips/route";
import { BetSlipModel } from "@/lib/db/models/BetSlip";
import { UserModel } from "@/lib/db/models/User";
import type { BetSlip } from "@/types";
import { createTestUser, logInAs, resetDatabase, type TestUser } from "./support/db";
import { jsonRequest, KC_SEA, LAC_KC, makePick, slipContext } from "./support/factories";

/* The logged-in test user for each test. */
let user: TestUser;

beforeEach(async () => {
  await resetDatabase();
  user = await createTestUser("member@example.com");
  await logInAs(user);
});

/* createSlip: POSTs a new slip and returns the response. */
function createSlip(body: unknown): Promise<Response> {
  return slipsPost(jsonRequest("POST", "/api/betslips", body));
}

/* createdSlip: POSTs a slip, checks it was made (201), and returns it. */
async function createdSlip(body: unknown): Promise<BetSlip> {
  const response = await createSlip(body);
  expect(response.status).toBe(201);
  return (await response.json()) as BetSlip;
}

/* A second, different game's pick: Chargers moneyline at +150. */
const chargersMoneyline = makePick({
  gameId: LAC_KC,
  gameLabel: "LAC @ KC",
  marketKey: "h2h",
  marketLabel: "Winner",
  participant: { kind: "team", id: "24", name: "Los Angeles Chargers" },
  side: "away",
  line: null,
  odds: 150,
  label: "Chargers to win",
});

describe("create", () => {
  it("saves a Straight slip for the logged-in user and answers 201 with its address", async () => {
    const response = await createSlip({ name: "Sunday pick", picks: [makePick()] });

    expect(response.status).toBe(201);
    const slip = (await response.json()) as BetSlip;
    expect(response.headers.get("location")).toBe(`/api/betslips/${slip.id}`);
    expect(slip).toMatchObject({ name: "Sunday pick", type: "straight", combinedOdds: -110, userId: user.id });

    // And it's really in the database, belonging to this user.
    const stored = await BetSlipModel.findById(slip.id).lean();
    expect(stored?.userId.toString()).toBe(user.id);
    expect(stored?.picks).toHaveLength(1);
  });

  it("works out a Parlay's type and combined odds on the server (-110 and +150 = +377)", async () => {
    const slip = await createdSlip({ name: "Parlay", picks: [makePick(), chargersMoneyline] });
    expect(slip).toMatchObject({ type: "parlay", combinedOdds: 377, oddsAreEstimated: false });
  });

  it("works out an SGP, flagged as estimated (two picks from one game)", async () => {
    const total = makePick({
      marketKey: "totals",
      side: "over",
      line: 47.5,
      odds: 150,
      participant: { kind: "game", id: null, name: "Game" },
      label: "Over 47.5",
    });
    const slip = await createdSlip({ name: "SGP", picks: [makePick(), total] });
    expect(slip).toMatchObject({ type: "sgp", combinedOdds: 377, oddsAreEstimated: true });
  });

  it("ignores a type, odds, or owner the browser claims (the server decides)", async () => {
    const stranger = await createTestUser("stranger@example.com");
    const slip = await createdSlip({
      name: "Sneaky",
      picks: [makePick()],
      type: "sgp",
      combinedOdds: 9999,
      oddsAreEstimated: true,
      userId: stranger.id,
    });
    expect(slip).toMatchObject({ type: "straight", combinedOdds: -110, oddsAreEstimated: false, userId: user.id });
    expect(await BetSlipModel.countDocuments({ userId: stranger.id })).toBe(0);
  });

  it("names a slip with today's date when no name is given, then numbers the next one", async () => {
    const first = await createdSlip({});
    const second = await createdSlip({});
    expect(first.name).toMatch(/^\d{2}-\d{2}-\d{4}$/);
    expect(second.name).toBe(`${first.name} (2)`);
  });

  it("makes the new slip the active slip when asked", async () => {
    const slip = await createdSlip({ name: "Active one", setActive: true });
    const active = await (await activeGet()).json();
    expect(active.id).toBe(slip.id);
  });

  it("refuses a second slip with the same name (409)", async () => {
    await createdSlip({ name: "Same name" });
    const response = await createSlip({ name: "Same name" });
    expect(response.status).toBe(409);
    expect(await BetSlipModel.countDocuments({ name: "Same name" })).toBe(1);
  });

  it("refuses picks that can't go together (409), and saves nothing", async () => {
    const chiefs = makePick();
    const seahawks = makePick({ side: "home", line: 3, participant: { kind: "team", id: "26", name: "Seattle Seahawks" }, label: "Seahawks +3" });
    const response = await createSlip({ name: "Conflict", picks: [chiefs, seahawks] });
    expect(response.status).toBe(409);
    expect(await BetSlipModel.countDocuments()).toBe(0);
  });

  it("refuses picks from another game on an SGP slip (409)", async () => {
    const response = await createSlip({ name: "Bad SGP", sgpGameId: KC_SEA, picks: [chargersMoneyline] });
    expect(response.status).toBe(409);
  });
});

describe("read", () => {
  it("lists only the logged-in user's slips, newest change first", async () => {
    await createdSlip({ name: "Older" });
    await createdSlip({ name: "Newer" });
    const slips = (await (await slipsGet()).json()) as BetSlip[];
    expect(slips.map((slip) => slip.name)).toEqual(["Newer", "Older"]);
  });

  it("returns one slip by its ID", async () => {
    const created = await createdSlip({ name: "Find me", picks: [makePick()] });
    const response = await slipGet(jsonRequest("GET", `/api/betslips/${created.id}`), slipContext(created.id));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id: created.id, name: "Find me" });
  });

  it("answers 404 for an ID that doesn't exist, or isn't even an ID", async () => {
    for (const id of ["64b7f0c2a1b2c3d4e5f60718", "nope", '{"$gt":""}', "../etc/passwd"]) {
      const response = await slipGet(jsonRequest("GET", "/api/betslips/x"), slipContext(id));
      expect(response.status, id).toBe(404);
    }
  });
});

describe("update", () => {
  it("renames a slip and keeps the change in the database", async () => {
    const created = await createdSlip({ name: "Old name", picks: [makePick()] });
    const response = await slipPatch(jsonRequest("PATCH", "/api/betslips/x", { name: "New name" }), slipContext(created.id));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ name: "New name" });
    expect((await BetSlipModel.findById(created.id).lean())?.name).toBe("New name");
  });

  it("replaces the picks and recalculates the type and odds", async () => {
    const created = await createdSlip({ name: "Grows", picks: [makePick()] });
    expect(created.type).toBe("straight");

    const response = await slipPatch(
      jsonRequest("PATCH", "/api/betslips/x", { picks: [makePick(), chargersMoneyline] }),
      slipContext(created.id),
    );
    expect(await response.json()).toMatchObject({ type: "parlay", combinedOdds: 377 });
  });

  it("refuses new picks that clash with each other (409) and leaves the slip as it was", async () => {
    const created = await createdSlip({ name: "Keep me", picks: [makePick()] });
    const clash = makePick({ side: "home", line: 3, participant: { kind: "team", id: "26", name: "Seattle Seahawks" }, label: "Seahawks +3" });
    const response = await slipPatch(
      jsonRequest("PATCH", "/api/betslips/x", { picks: [makePick(), clash] }),
      slipContext(created.id),
    );
    expect(response.status).toBe(409);
    expect((await BetSlipModel.findById(created.id).lean())?.picks).toHaveLength(1);
  });

  it("refuses renaming to a name you already use (409)", async () => {
    await createdSlip({ name: "Taken" });
    const other = await createdSlip({ name: "Other" });
    const response = await slipPatch(jsonRequest("PATCH", "/api/betslips/x", { name: "Taken" }), slipContext(other.id));
    expect(response.status).toBe(409);
    expect((await BetSlipModel.findById(other.id).lean())?.name).toBe("Other");
  });

  it("refuses an update that changes nothing (400)", async () => {
    const created = await createdSlip({ name: "Same" });
    const response = await slipPatch(jsonRequest("PATCH", "/api/betslips/x", {}), slipContext(created.id));
    expect(response.status).toBe(400);
  });
});

describe("delete", () => {
  it("deletes the slip for good", async () => {
    const created = await createdSlip({ name: "Delete me" });
    const response = await slipDelete(jsonRequest("DELETE", "/api/betslips/x"), slipContext(created.id));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deleted: true, id: created.id });

    expect(await BetSlipModel.countDocuments({ _id: created.id })).toBe(0);
    const again = await slipGet(jsonRequest("GET", "/api/betslips/x"), slipContext(created.id));
    expect(again.status).toBe(404);
  });

  it("clears the active slip if the deleted slip was the active one", async () => {
    const created = await createdSlip({ name: "Active", setActive: true });
    await slipDelete(jsonRequest("DELETE", "/api/betslips/x"), slipContext(created.id));
    const stored = await UserModel.findById(user.id).lean();
    expect(stored?.activeBetSlipId).toBeNull();
  });

  it("answers 404 when deleting something that isn't there", async () => {
    const response = await slipDelete(jsonRequest("DELETE", "/api/betslips/x"), slipContext("64b7f0c2a1b2c3d4e5f60718"));
    expect(response.status).toBe(404);
  });
});

describe("active slip", () => {
  it("can be set to your own slip and cleared again", async () => {
    const created = await createdSlip({ name: "Mine" });
    const set = await activePut(jsonRequest("PUT", "/api/betslips/active", { slipId: created.id }));
    expect(set.status).toBe(200);
    expect((await (await activeGet()).json()).id).toBe(created.id);

    const cleared = await activePut(jsonRequest("PUT", "/api/betslips/active", { slipId: null }));
    expect(cleared.status).toBe(200);
    expect(await (await activeGet()).json()).toBeNull();
  });
});

describe("bad input is refused with the right status and saves nothing", () => {
  it("odds that aren't real (400), naming the exact field", async () => {
    const response = await createSlip({ name: "Bad odds", picks: [makePick({ odds: 50 })] });
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.fieldErrors["picks.0.odds"]).toMatch(/American odds/);
    expect(await BetSlipModel.countDocuments()).toBe(0);
  });

  it("a name over 50 characters (400)", async () => {
    expect((await createSlip({ name: "x".repeat(51) })).status).toBe(400);
  });

  it("wrong types, like a number or an object for the name (400)", async () => {
    for (const name of [123, { $gt: "" }, ["a"], true]) {
      expect((await createSlip({ name })).status, JSON.stringify(name)).toBe(400);
    }
    expect(await BetSlipModel.countDocuments()).toBe(0);
  });

  it("a league that isn't available, or a made-up sportsbook (400)", async () => {
    expect((await createSlip({ picks: [makePick({ league: "nba" })] })).status).toBe(400);
    expect((await createSlip({ picks: [{ ...makePick(), sportsbook: "madeup" }] })).status).toBe(400);
  });

  it("more than 25 picks (400)", async () => {
    const picks = Array.from({ length: 26 }, (_, n) =>
      makePick({ participant: { kind: "player", id: String(1000 + n), name: `Player ${n}` }, marketKey: "player_anytime_td", side: "yes", line: null }),
    );
    expect((await createSlip({ picks })).status).toBe(400);
  });

  it("the same pick listed twice (400)", async () => {
    expect((await createSlip({ picks: [makePick(), makePick()] })).status).toBe(400);
  });

  it("a request that isn't marked as JSON (415)", async () => {
    const response = await slipsPost(jsonRequest("POST", "/api/betslips", "name=x", "application/x-www-form-urlencoded"));
    expect(response.status).toBe(415);
  });

  it("broken JSON (400)", async () => {
    const response = await slipsPost(jsonRequest("POST", "/api/betslips", "{not json"));
    expect(response.status).toBe(400);
  });

  it("a huge request body (413) without saving anything", async () => {
    const response = await createSlip({ name: "x".repeat(150_000) });
    expect(response.status).toBe(413);
    expect(await BetSlipModel.countDocuments()).toBe(0);
  });

  it("script tags in a name are stored as plain text, not run (the page shows text only)", async () => {
    const slip = await createdSlip({ name: "<script>alert(1)</script>" });
    expect(slip.name).toBe("<script>alert(1)</script>");
  });
});
