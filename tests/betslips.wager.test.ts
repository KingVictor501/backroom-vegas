/*
  FILE: tests/betslips.wager.test.ts
  WHAT IT'S FOR: Automatic tests for the pretend wager saved on a slip, run against the
  throwaway test database. They prove:
  - a new slip starts at $10, and a wager sent when creating a slip is saved
  - PATCH can change only the wager, and it survives a reload from MongoDB
  - bad wagers are refused with a 400 and change nothing: zero, negative, over $10,000,
    three decimals, text, null, a list, a MongoDB-style object, NaN-like text
  - another user can't change your wager (same 404 as a fake slip)
  - changing the picks doesn't reset the wager, and a copy keeps the original's wager
  WHO USES IT: Vitest, when you run `npm test`.
  WHY THIS NAME: It tests the wager on the bet slip routes. It ends in .ts because it shows nothing on screen.
*/

import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as copyPost } from "@/app/api/betslips/[id]/copy/route";
import { PATCH as slipPatch } from "@/app/api/betslips/[id]/route";
import { POST as slipsPost } from "@/app/api/betslips/route";
import { BetSlipModel } from "@/lib/db/models/BetSlip";
import type { CurrentOdds } from "@/lib/services/slipOdds";
import type { BetSlip } from "@/types";
import { createTestUser, logInAs, resetDatabase, type TestUser } from "./support/db";
import { jsonRequest, makePick, slipContext } from "./support/factories";

// The copy test must not call The Odds API.
const lookup = vi.hoisted(() => ({ getCurrentOddsForPicks: vi.fn() }));
vi.mock("@/lib/services/slipOdds", () => lookup);

let me: TestUser;
let other: TestUser;

/* create: saves a slip through the real API. */
async function create(body: Record<string, unknown> = {}): Promise<Response> {
  return slipsPost(jsonRequest("POST", "/api/betslips", { picks: [makePick()], ...body }));
}
/* patch: changes a slip through the real API. */
const patch = (id: string, body: unknown) => slipPatch(jsonRequest("PATCH", `/api/betslips/${id}`, body), slipContext(id) as never);
/* stored: the wager as MongoDB holds it. */
async function stored(id: string): Promise<number | undefined> {
  return (await BetSlipModel.findById(id).lean())?.wager;
}

beforeEach(async () => {
  await resetDatabase();
  lookup.getCurrentOddsForPicks.mockReset();
  lookup.getCurrentOddsForPicks.mockResolvedValue({ odds: new Map(), gameStatuses: new Map() } satisfies CurrentOdds);
  me = await createTestUser("me@example.com");
  other = await createTestUser("other@example.com");
  await logInAs(me);
});

describe("the wager on a slip", () => {
  it("starts at $10 when none is sent", async () => {
    const slip = (await (await create()).json()) as BetSlip;
    expect(slip.wager).toBe(10);
    expect(await stored(slip.id)).toBe(10);
  });

  it("saves a wager sent when creating a slip", async () => {
    const slip = (await (await create({ wager: 25.5 })).json()) as BetSlip;
    expect(slip.wager).toBe(25.5);
    expect(await stored(slip.id)).toBe(25.5);
  });

  it("can be changed on its own and is still there after reloading from MongoDB", async () => {
    const slip = (await (await create()).json()) as BetSlip;
    const response = await patch(slip.id, { wager: 40 });
    expect(response.status).toBe(200);
    expect(((await response.json()) as BetSlip).wager).toBe(40);
    expect(await stored(slip.id)).toBe(40);
  });

  it("accepts the smallest and largest allowed wagers", async () => {
    const slip = (await (await create()).json()) as BetSlip;
    expect((await patch(slip.id, { wager: 0.01 })).status).toBe(200);
    expect((await patch(slip.id, { wager: 10000 })).status).toBe(200);
    expect(await stored(slip.id)).toBe(10000);
  });

  it("is kept when the picks change", async () => {
    const slip = (await (await create({ wager: 75 })).json()) as BetSlip;
    const second = makePick({ gameId: "999", id: "999|spreads|1|home|-3" });
    const response = await patch(slip.id, { picks: [makePick(), second] });
    expect(response.status).toBe(200);
    expect(await stored(slip.id)).toBe(75);
  });

  it("is kept by a copy", async () => {
    const slip = (await (await create({ wager: 33.25 })).json()) as BetSlip;
    const response = await copyPost(jsonRequest("POST", `/api/betslips/${slip.id}/copy`), slipContext(slip.id) as never);
    expect(response.status).toBe(201);
    expect(((await response.json()) as BetSlip).wager).toBe(33.25);
  });
});

describe("bad wagers are refused", () => {
  const BAD: Array<[string, unknown]> = [
    ["zero", 0],
    ["negative", -5],
    ["over the maximum", 10000.01],
    ["huge", 1e21],
    ["three decimals", 10.255],
    ["text", "10"],
    ["null", null],
    ["a list", [10]],
    ["an injection-style object", { $gt: "" }],
    ["a boolean", true],
  ];

  it.each(BAD)("PATCH refuses %s and changes nothing", async (_name, wager) => {
    const slip = (await (await create({ wager: 12 })).json()) as BetSlip;
    const response = await patch(slip.id, { wager });
    expect(response.status).toBe(400);
    expect(await stored(slip.id)).toBe(12);
  });

  it.each(BAD)("creating a slip with %s is refused and saves nothing", async (_name, wager) => {
    const response = await create({ wager });
    expect(response.status).toBe(400);
    expect(await BetSlipModel.countDocuments()).toBe(0);
  });
});

describe("whose wager it is", () => {
  it("another user can't change it, and gets the same answer as for a fake slip", async () => {
    const slip = (await (await create({ wager: 20 })).json()) as BetSlip;
    await logInAs(other);
    const response = await patch(slip.id, { wager: 9999 });
    expect(response.status).toBe(404);
    expect(await stored(slip.id)).toBe(20);
  });
});
