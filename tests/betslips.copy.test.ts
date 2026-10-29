/*
  FILE: tests/betslips.copy.test.ts
  WHAT IT'S FOR: Automatic tests for "Copy slip" (POST /api/betslips/<id>/copy), run against the
  throwaway test database. The odds lookup is replaced with made-up odds, so no test ever
  spends a real Odds API request. They prove:
  - copying works: the copy belongs to the same user, is named "Copy of ...", is saved in
    MongoDB, becomes the active slip, and leaves the original untouched
  - picks for games that started or finished are skipped, with a note saying how many and why
  - the other picks get the user's sportsbook's current price and line, and remember the old ones
  - a bet the book has no odds for keeps its old price and says so
  - names: unique, never over 50 characters
  - another user's slip, a fake ID, an injection-style ID, and no login are all refused
  - the browser can't forge the "copied from" note
  WHO USES IT: Vitest, when you run `npm test`.
  WHY THIS NAME: It tests the copy route. It sits in tests/ because it needs the test database.
  It ends in .ts because it shows nothing on screen.
*/

import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as copyPost } from "@/app/api/betslips/[id]/copy/route";
import { PATCH as slipPatch } from "@/app/api/betslips/[id]/route";
import { POST as slipsPost } from "@/app/api/betslips/route";
import type { PickOddsResult } from "@/lib/betting/copySlip";
import { BetSlipModel } from "@/lib/db/models/BetSlip";
import { UserModel } from "@/lib/db/models/User";
import type { CurrentOdds } from "@/lib/services/slipOdds";
import type { BetPick, BetSlip, GameStatus, MarketOutcome } from "@/types";
import { createTestUser, logInAs, logOut, resetDatabase, type TestUser } from "./support/db";
import { jsonRequest, KC_SEA, LAC_KC, makePick, slipContext } from "./support/factories";

// Replace the real odds lookup (which would call The Odds API) with one the tests control.
const lookup = vi.hoisted(() => ({ getCurrentOddsForPicks: vi.fn() }));
vi.mock("@/lib/services/slipOdds", () => lookup);

/* inDays: a time this many days from now, as the app writes it. */
const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();
const PAST = new Date(Date.now() - 3_600_000).toISOString();

const KC = { kind: "team", id: "12", name: "Kansas City Chiefs" } as const;

/* serveOdds: the next lookup answers with these current odds and game statuses. */
function serveOdds(odds: Record<string, PickOddsResult>, statuses: Record<string, GameStatus> = {}): void {
  const answer: CurrentOdds = { odds: new Map(Object.entries(odds)), gameStatuses: new Map(Object.entries(statuses)) };
  lookup.getCurrentOddsForPicks.mockResolvedValueOnce(answer);
}

/* price: a current price for the Chiefs (away team in the factory's game). */
const price = (line: number, odds: number): MarketOutcome => ({ side: "away", participant: KC, line, odds });

let me: TestUser;
let other: TestUser;

/* makeSlip: saves a slip for the logged-in user through the real API. */
async function makeSlip(name: string, picks: BetPick[], extra: Record<string, unknown> = {}): Promise<BetSlip> {
  const response = await slipsPost(jsonRequest("POST", "/api/betslips", { name, picks, ...extra }));
  expect(response.status).toBe(201);
  return (await response.json()) as BetSlip;
}

/* copy: calls the copy route. */
const copy = (id: string) => copyPost(jsonRequest("POST", `/api/betslips/${id}/copy`), slipContext(id) as never);

beforeEach(async () => {
  await resetDatabase();
  lookup.getCurrentOddsForPicks.mockReset();
  // Unless a test says otherwise, no current odds could be looked up.
  lookup.getCurrentOddsForPicks.mockResolvedValue({ odds: new Map(), gameStatuses: new Map() } satisfies CurrentOdds);
  me = await createTestUser("me@example.com");
  other = await createTestUser("other@example.com");
  await logInAs(me);
});

describe("copying a slip", () => {
  it("makes a new slip for the same user, named 'Copy of ...', saved in MongoDB", async () => {
    const original = await makeSlip("Sunday Parlay", [makePick({ gameStartsAt: inDays(2) })]);
    const response = await copy(original.id);

    expect(response.status).toBe(201);
    const made = (await response.json()) as BetSlip;
    expect(made.id).not.toBe(original.id);
    expect(made.name).toBe("Copy of Sunday Parlay");
    expect(made.userId).toBe(me.id);
    expect(response.headers.get("Location")).toBe(`/api/betslips/${made.id}`);

    const saved = await BetSlipModel.findById(made.id).lean();
    expect(saved?.userId.toString()).toBe(me.id);
    expect(saved?.name).toBe("Copy of Sunday Parlay");
    expect(await BetSlipModel.countDocuments({ userId: me.id })).toBe(2);
  });

  it("makes the copy the active slip", async () => {
    const original = await makeSlip("Sunday Parlay", [makePick({ gameStartsAt: inDays(2) })], { setActive: true });
    const made = (await (await copy(original.id)).json()) as BetSlip;
    expect((await UserModel.findById(me.id).lean())?.activeBetSlipId?.toString()).toBe(made.id);
  });

  it("leaves the original slip exactly as it was", async () => {
    const original = await makeSlip("Sunday Parlay", [makePick({ gameStartsAt: inDays(2) })]);
    serveOdds({ [original.picks[0].id]: { state: "outcomes", outcomes: [price(-4, -130)] } });
    await copy(original.id);
    const after = await BetSlipModel.findById(original.id).lean();
    expect(after?.name).toBe("Sunday Parlay");
    expect(after?.picks[0].odds).toBe(-110);
    expect(after?.picks[0].line).toBe(-3);
    expect(after?.picks[0].refresh).toBeUndefined();
    expect(after?.copiedFrom).toBeNull();
  });

  it("copies an empty slip, and works out the slip type from the picks", async () => {
    const empty = await makeSlip("Nothing yet", []);
    const made = (await (await copy(empty.id)).json()) as BetSlip;
    expect(made.picks).toEqual([]);
    expect(made.type).toBe("straight");

    const two = await makeSlip("Two games", [
      makePick({ gameId: KC_SEA, gameStartsAt: inDays(2) }),
      makePick({ gameId: LAC_KC, gameStartsAt: inDays(3), side: "home", line: 2, label: "Chiefs +2" }),
    ]);
    expect(((await (await copy(two.id)).json()) as BetSlip).type).toBe("parlay");
  });

  it("copies a copy too, with a fresh note (not the old one stacked up)", async () => {
    const original = await makeSlip("Base", [makePick({ gameStartsAt: inDays(2) })]);
    const first = (await (await copy(original.id)).json()) as BetSlip;
    const second = (await (await copy(first.id)).json()) as BetSlip;
    expect(second.name).toBe("Copy of Copy of Base");
    expect(second.copiedFrom?.fromName).toBe("Copy of Base");
  });
});

describe("games that already started or finished are not copied", () => {
  it("skips them, notes each with a reason, and keeps the rest", async () => {
    const live = makePick({ gameId: KC_SEA, gameStartsAt: inDays(2) });
    const started = makePick({ gameId: LAC_KC, gameStartsAt: PAST, side: "home", line: 2, label: "Chiefs +2" });
    const original = await makeSlip("Mixed", [live, started]);
    const made = (await (await copy(original.id)).json()) as BetSlip;

    expect(made.picks.map((p) => p.id)).toEqual([live.id]);
    expect(made.copiedFrom?.skipped).toEqual([{ label: "Chiefs +2", gameLabel: "KC @ SEA", reason: "That game already started." }]);
  });

  it("skips a game ESPN says is final, even with a future-looking time", async () => {
    const pick = makePick({ gameStartsAt: inDays(2) });
    const original = await makeSlip("Done", [pick]);
    serveOdds({}, { [pick.gameId]: "final" });
    const made = (await (await copy(original.id)).json()) as BetSlip;
    expect(made.picks).toEqual([]);
    expect(made.copiedFrom?.skipped[0].reason).toBe("That game is already over.");
  });

  it("when EVERY pick is skipped, an empty copy is still made, and says so", async () => {
    const original = await makeSlip("All old", [makePick({ gameStartsAt: PAST }), makePick({ gameId: LAC_KC, gameStartsAt: PAST, side: "home", line: 3, label: "Seahawks +3" })]);
    const response = await copy(original.id);
    expect(response.status).toBe(201);
    const made = (await response.json()) as BetSlip;
    expect(made.picks).toEqual([]);
    expect(made.copiedFrom?.skipped).toHaveLength(2);
    expect(made.combinedOdds).toBeNull();
  });

  it("an SGP slip stays locked to its game only while picks from that game remain", async () => {
    const sgp = await makeSlip("SGP", [makePick({ gameStartsAt: inDays(2) })], { sgpGameId: KC_SEA });
    expect(((await (await copy(sgp.id)).json()) as BetSlip).sgpGameId).toBe(KC_SEA);

    const old = await makeSlip("Old SGP", [makePick({ gameStartsAt: PAST })], { sgpGameId: KC_SEA });
    expect(((await (await copy(old.id)).json()) as BetSlip).sgpGameId).toBeNull();
  });
});

describe("refreshing to the user's sportsbook", () => {
  it("asks for the user's own sportsbook, and the copy uses its current price and line", async () => {
    await UserModel.updateOne({ _id: me.id }, { preferredSportsbook: "betmgm" });
    const pick = makePick({ gameStartsAt: inDays(2) });
    const original = await makeSlip("Refresh me", [pick]);
    serveOdds({ [pick.id]: { state: "outcomes", outcomes: [price(-3.5, -125)] } });
    const made = (await (await copy(original.id)).json()) as BetSlip;

    expect(lookup.getCurrentOddsForPicks).toHaveBeenCalledWith(expect.any(Array), "betmgm", expect.any(Date));
    const [p] = made.picks;
    expect(p).toMatchObject({ line: -3.5, odds: -125, sportsbook: "betmgm", label: "Chiefs -3.5" });
    expect(p.refresh).toEqual({ status: "updated", previousOdds: -110, previousLine: -3, previousSportsbook: "hardrock" });
    expect(made.copiedFrom?.sportsbook).toBe("betmgm");
    // The slip's own odds are recalculated from the new prices by the server.
    expect(made.combinedOdds).toBe(-125);
  });

  it("a bet the book has no odds for keeps its old price and says so", async () => {
    const pick = makePick({ gameStartsAt: inDays(2) });
    const original = await makeSlip("BetMGM gap", [pick]);
    serveOdds({ [pick.id]: { state: "none" } });
    const [p] = ((await (await copy(original.id)).json()) as BetSlip).picks;
    expect(p).toMatchObject({ odds: -110, line: -3, sportsbook: "hardrock" });
    expect(p.refresh?.status).toBe("no-odds");
  });

  it("when odds couldn't be looked up at all, the copy still works with old prices ('not-checked')", async () => {
    const original = await makeSlip("Offline", [makePick({ gameStartsAt: inDays(2) })]);
    const response = await copy(original.id);
    expect(response.status).toBe(201);
    expect(((await response.json()) as BetSlip).picks[0].refresh?.status).toBe("not-checked");
  });

  it("a copied slip's notes survive saving the slip again (removing a pick sends them back)", async () => {
    const a = makePick({ gameId: KC_SEA, gameStartsAt: inDays(2) });
    const b = makePick({ gameId: LAC_KC, gameStartsAt: inDays(3), side: "home", line: 2, label: "Chiefs +2" });
    const original = await makeSlip("Two", [a, b]);
    serveOdds({ [a.id]: { state: "outcomes", outcomes: [price(-3, -120)] } });
    const made = (await (await copy(original.id)).json()) as BetSlip;

    const patched = await slipPatch(jsonRequest("PATCH", `/api/betslips/${made.id}`, { picks: [made.picks[0]] }), slipContext(made.id));
    expect(patched.status).toBe(200);
    expect(((await patched.json()) as BetSlip).picks[0].refresh?.status).toBe("updated");
  });

  it("refuses a made-up price-check note on a pick (bad status, odds, or sportsbook)", async () => {
    const bad = [
      { status: "great", previousOdds: -110, previousLine: null, previousSportsbook: "hardrock" },
      { status: "updated", previousOdds: 5, previousLine: null, previousSportsbook: "hardrock" },
      { status: "updated", previousOdds: -110, previousLine: null, previousSportsbook: "bovada" },
      { status: "updated", previousOdds: -110, previousLine: "x", previousSportsbook: "hardrock" },
    ];
    for (const refresh of bad) {
      const response = await slipsPost(jsonRequest("POST", "/api/betslips", { picks: [{ ...makePick({ gameStartsAt: inDays(2) }), refresh }] }));
      expect(response.status).toBe(400);
    }
    expect(await BetSlipModel.countDocuments()).toBe(0);
  });
});

describe("names", () => {
  it("a second copy is numbered, and every name stays within 50 characters", async () => {
    const original = await makeSlip("Sunday Parlay", [makePick({ gameStartsAt: inDays(2) })]);
    const names: string[] = [];
    for (let i = 0; i < 3; i += 1) names.push(((await (await copy(original.id)).json()) as BetSlip).name);
    expect(names).toEqual(["Copy of Sunday Parlay", "Copy of Sunday Parlay (2)", "Copy of Sunday Parlay (3)"]);
  });

  it("a 50-character name is cut to fit, and numbering still fits", async () => {
    const original = await makeSlip("N".repeat(50), []);
    const first = ((await (await copy(original.id)).json()) as BetSlip).name;
    const second = ((await (await copy(original.id)).json()) as BetSlip).name;
    const third = ((await (await copy(original.id)).json()) as BetSlip).name;
    for (const name of [first, second, third]) {
      expect(name.length).toBeLessThanOrEqual(50);
      expect(name.startsWith("Copy of N")).toBe(true);
    }
    expect(new Set([first, second, third]).size).toBe(3);
    // The second copy fits as the shorter 45-character name; the third needs the number.
    expect(second.length).toBeLessThanOrEqual(45);
    expect(third.endsWith("(2)")).toBe(true);
  });

  it("two copies at the same instant both succeed with different names", async () => {
    const original = await makeSlip("Race", [makePick({ gameStartsAt: inDays(2) })]);
    const responses = await Promise.all([copy(original.id), copy(original.id), copy(original.id)]);
    expect(responses.map((r) => r.status)).toEqual([201, 201, 201]);
    const names = await Promise.all(responses.map(async (r) => ((await r.json()) as BetSlip).name));
    expect(new Set(names).size).toBe(3);
  });
});

describe("only your own slips, and only when logged in", () => {
  it("user B can't copy user A's slip: 404, nothing created, no odds looked up", async () => {
    const aSlip = await makeSlip("A's private slip", [makePick({ gameStartsAt: inDays(2) })]);
    await logInAs(other);
    lookup.getCurrentOddsForPicks.mockClear();

    const response = await copy(aSlip.id);
    expect(response.status).toBe(404);
    expect(JSON.stringify(await response.json())).not.toContain("A's private slip");
    expect(await BetSlipModel.countDocuments()).toBe(1);
    expect(await BetSlipModel.countDocuments({ userId: other.id })).toBe(0);
    expect(lookup.getCurrentOddsForPicks).not.toHaveBeenCalled();
  });

  it("gives the same answer for someone else's slip as for a slip that doesn't exist", async () => {
    const aSlip = await makeSlip("A's slip", []);
    await logInAs(other);
    const real = await copy(aSlip.id);
    const fake = await copy("64b7f0c2a1b2c3d4e5f60718");
    expect(real.status).toBe(fake.status);
    expect(await real.json()).toEqual(await fake.json());
  });

  it("bad IDs (junk, injection, too long) are 404 and create nothing", async () => {
    for (const id of ["abc", "../../etc/passwd", '{"$gt":""}', "x".repeat(5000), "undefined", ""]) {
      expect((await copy(id)).status).toBe(404);
    }
    expect(await BetSlipModel.countDocuments()).toBe(0);
  });

  it("logged out → 401, nothing created", async () => {
    const original = await makeSlip("Mine", []);
    logOut();
    expect((await copy(original.id)).status).toBe(401);
    expect(await BetSlipModel.countDocuments()).toBe(1);
  });

  it("the browser can't forge the 'copied from' note when creating a slip", async () => {
    const forged = { fromName: "Fake", sportsbook: "hardrock", skipped: [], copiedAt: new Date().toISOString() };
    const response = await slipsPost(jsonRequest("POST", "/api/betslips", { name: "Sneaky", copiedFrom: forged }));
    expect(response.status).toBe(201);
    expect(((await response.json()) as BetSlip).copiedFrom).toBeNull();
    expect((await BetSlipModel.findOne({ name: "Sneaky" }).lean())?.copiedFrom).toBeNull();
  });

  it("an unexpected failure gives a friendly 500 with no stack trace or details", async () => {
    const original = await makeSlip("Boom", [makePick({ gameStartsAt: inDays(2) })]);
    lookup.getCurrentOddsForPicks.mockRejectedValueOnce(new Error("mongodb://admin:secret@host failed at /Users/x/file.ts:1"));
    const response = await copy(original.id);
    expect(response.status).toBe(500);
    const text = await response.text();
    expect(text).not.toMatch(/mongodb|secret|\/Users|\.ts|stack/i);
  });
});
