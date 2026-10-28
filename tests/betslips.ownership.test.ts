/*
  FILE: tests/betslips.ownership.test.ts
  WHAT IT'S FOR: Automatic tests for the rule "you can only see and change your
  OWN data." User A saves a slip. Then, logged in as user B, the tests try to read
  it, rename it, replace its picks, make it active, and delete it, by its real ID.
  Every attempt must be refused with 404 (the same answer as a slip that doesn't
  exist, so B can't even learn that A's slip is real), AND A's slip in the
  database must be completely unchanged afterward.
  WHO USES IT: Vitest, when you run `npm test`.
  WHY THIS NAME: It tests ownership (who a record belongs to). It sits in tests/
  because it needs the test database. It ends in .ts because it shows nothing on screen.
*/

import { beforeEach, describe, expect, it } from "vitest";
import { GET as activeGet, PUT as activePut } from "@/app/api/betslips/active/route";
import { DELETE as slipDelete, GET as slipGet, PATCH as slipPatch } from "@/app/api/betslips/[id]/route";
import { GET as slipsGet, POST as slipsPost } from "@/app/api/betslips/route";
import { BetSlipModel } from "@/lib/db/models/BetSlip";
import { UserModel } from "@/lib/db/models/User";
import type { BetSlip } from "@/types";
import { createTestUser, logInAs, resetDatabase, type TestUser } from "./support/db";
import { jsonRequest, makePick, slipContext } from "./support/factories";

let userA: TestUser;
let userB: TestUser;
/* User A's slip, created in beforeEach. */
let slipA: BetSlip;

beforeEach(async () => {
  await resetDatabase();
  userA = await createTestUser("a@example.com");
  userB = await createTestUser("b@example.com");

  // User A saves one slip and makes it active.
  await logInAs(userA);
  const response = await slipsPost(
    jsonRequest("POST", "/api/betslips", { name: "A's private slip", picks: [makePick()], setActive: true }),
  );
  slipA = (await response.json()) as BetSlip;

  // From here on, the pretend browser belongs to user B.
  await logInAs(userB);
});

/* expectSlipAUntouched: A's slip is exactly as A left it. Called after every attack. */
async function expectSlipAUntouched(): Promise<void> {
  const stored = await BetSlipModel.findById(slipA.id).lean();
  expect(stored).not.toBeNull();
  expect(stored?.name).toBe("A's private slip");
  expect(stored?.userId.toString()).toBe(userA.id);
  expect(stored?.picks).toHaveLength(1);
  expect((await UserModel.findById(userA.id).lean())?.activeBetSlipId?.toString()).toBe(slipA.id);
}

describe("user B tries to reach user A's slip by its real ID", () => {
  it("READ: the list shows none of A's slips", async () => {
    const response = await slipsGet();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
  });

  it("READ: opening A's slip by ID is refused with 404", async () => {
    const response = await slipGet(jsonRequest("GET", "/api/betslips/x"), slipContext(slipA.id));
    expect(response.status).toBe(404);
    // The answer reveals nothing about A's slip.
    expect(JSON.stringify(await response.json())).not.toContain("A's private slip");
  });

  it("READ: gives the same 404 answer as a slip that doesn't exist (so B can't tell the difference)", async () => {
    const real = await slipGet(jsonRequest("GET", "/api/betslips/x"), slipContext(slipA.id));
    const fake = await slipGet(jsonRequest("GET", "/api/betslips/x"), slipContext("64b7f0c2a1b2c3d4e5f60718"));
    expect(real.status).toBe(fake.status);
    expect(await real.json()).toEqual(await fake.json());
  });

  it("EDIT: renaming A's slip is refused with 404 and changes nothing", async () => {
    const response = await slipPatch(jsonRequest("PATCH", "/api/betslips/x", { name: "Hacked" }), slipContext(slipA.id));
    expect(response.status).toBe(404);
    await expectSlipAUntouched();
  });

  it("EDIT: replacing A's picks is refused with 404 and changes nothing", async () => {
    const response = await slipPatch(
      jsonRequest("PATCH", "/api/betslips/x", { picks: [] }),
      slipContext(slipA.id),
    );
    expect(response.status).toBe(404);
    await expectSlipAUntouched();
  });

  it("DELETE: deleting A's slip is refused with 404 and the slip survives", async () => {
    const response = await slipDelete(jsonRequest("DELETE", "/api/betslips/x"), slipContext(slipA.id));
    expect(response.status).toBe(404);
    await expectSlipAUntouched();
  });

  it("ACTIVE: B can't make A's slip their active slip", async () => {
    const response = await activePut(jsonRequest("PUT", "/api/betslips/active", { slipId: slipA.id }));
    expect(response.status).toBe(404);
    expect(await (await activeGet()).json()).toBeNull();
    expect((await UserModel.findById(userB.id).lean())?.activeBetSlipId).toBeNull();
  });

  it("CREATE: B can't create a slip that belongs to A by sending A's user ID", async () => {
    const response = await slipsPost(
      jsonRequest("POST", "/api/betslips", { name: "Planted", userId: userA.id }),
    );
    expect(response.status).toBe(201);
    const planted = (await response.json()) as BetSlip;
    expect(planted.userId).toBe(userB.id);
    expect(await BetSlipModel.countDocuments({ userId: userA.id })).toBe(1);
  });

  it("A still sees their own slip afterward", async () => {
    await logInAs(userA);
    const slips = (await (await slipsGet()).json()) as BetSlip[];
    expect(slips.map((slip) => slip.id)).toEqual([slipA.id]);
  });
});

describe("two users can use the same slip name without clashing", () => {
  it("B can create a slip with the same name A used", async () => {
    const response = await slipsPost(jsonRequest("POST", "/api/betslips", { name: "A's private slip" }));
    expect(response.status).toBe(201);
    expect(await BetSlipModel.countDocuments({ name: "A's private slip" })).toBe(2);
  });
});
