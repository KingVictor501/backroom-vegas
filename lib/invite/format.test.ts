/*
  FILE: lib/invite/format.test.ts
  WHAT IT'S FOR: Automatic tests for what invite codes look like (format.ts) and
  how new ones are made (generate.ts): the shape rule, tidying what a visitor
  typed, random codes that always have the right shape and never use look-alike
  characters, and refusing nonsense choices like 0 uses.
  These are UNIT tests: no database or website, so they run instantly.
  WHO USES IT: Vitest, when you run `npm test`.
  WHY THIS NAME: It tests format.ts (and generate.ts), so it's format.test.ts next
  to them. It ends in .ts because it shows nothing on screen.
*/

import { describe, expect, it } from "vitest";
import { INVITE_CODE_ALPHABET, INVITE_CODE_PATTERN, normalizeInviteCode } from "./format";
import { generateInviteCode, newInviteCodeFields } from "./generate";

describe("normalizeInviteCode", () => {
  it("accepts a code shaped like BRV-7K2M-Q9XD", () => {
    expect(normalizeInviteCode("BRV-7K2M-Q9XD")).toBe("BRV-7K2M-Q9XD");
  });

  it("ignores spaces around it and capital letters", () => {
    expect(normalizeInviteCode("  brv-7k2m-q9xd \n")).toBe("BRV-7K2M-Q9XD");
  });

  it("refuses the wrong shape", () => {
    for (const bad of [
      "",
      "BRV-7K2M",
      "BRV7K2MQ9XD",
      "XXX-7K2M-Q9XD",
      "BRV-7K2M-Q9XD-AAAA",
      "BRV-7K2M-Q9X",
      "BRV-7K2M-Q9XDE",
      // Look-alike characters we never use: 0, O, 1, I, L.
      "BRV-0K2M-Q9XD",
      "BRV-OK2M-Q9XD",
      "BRV-1K2M-Q9XD",
      "BRV-IK2M-Q9XD",
      "BRV-LK2M-Q9XD",
      // Tricks.
      "BRV-7K2M-Q9XD\nextra",
      "<script>alert(1)</script>",
      "BRV-7K2M-Q9XD' OR '1'='1",
    ]) {
      expect(normalizeInviteCode(bad), JSON.stringify(bad)).toBeNull();
    }
  });

  it("refuses anything that isn't text (no objects, numbers, or lists that could trick the database)", () => {
    for (const bad of [undefined, null, 123, true, ["BRV-7K2M-Q9XD"], { $gt: "" }, { code: "BRV-7K2M-Q9XD" }]) {
      expect(normalizeInviteCode(bad)).toBeNull();
    }
  });
});

describe("generateInviteCode", () => {
  it("always makes a code with the right shape", () => {
    for (let i = 0; i < 500; i += 1) {
      expect(generateInviteCode()).toMatch(INVITE_CODE_PATTERN);
    }
  });

  it("never uses look-alike characters (0, O, 1, I, L)", () => {
    for (const hard of ["0", "O", "1", "I", "L"]) {
      expect(INVITE_CODE_ALPHABET).not.toContain(hard);
    }
  });

  it("makes different codes each time (they're random)", () => {
    const codes = new Set(Array.from({ length: 1000 }, () => generateInviteCode()));
    expect(codes.size).toBe(1000);
  });

  it("uses lots of different characters (a quick check that it isn't stuck on a few)", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 300; i += 1) {
      for (const char of generateInviteCode().replace(/BRV|-/g, "")) seen.add(char);
    }
    // 31 are possible; random picks should have shown nearly all of them.
    expect(seen.size).toBeGreaterThanOrEqual(28);
  });
});

describe("newInviteCodeFields", () => {
  it("makes a fresh code: turned on, used 0 times, with the choices applied", () => {
    const expiresAt = new Date("2099-12-31T23:59:59.999Z");
    const fields = newInviteCodeFields({ maxUses: 10, expiresAt, note: "  graders  " });
    expect(fields).toMatchObject({ maxUses: 10, usedCount: 0, active: true, note: "graders" });
    expect(fields.expiresAt).toEqual(expiresAt);
    expect(fields.code).toMatch(INVITE_CODE_PATTERN);
  });

  it("allows no expiry (null)", () => {
    expect(newInviteCodeFields({ maxUses: 1, expiresAt: null, note: "" }).expiresAt).toBeNull();
  });

  it("refuses uses that aren't a whole number from 1 to 1000", () => {
    for (const maxUses of [0, -1, 1.5, 1001, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => newInviteCodeFields({ maxUses, expiresAt: null, note: "" }), String(maxUses)).toThrow(/Uses must be/);
    }
  });

  it("refuses an expiration date that's already passed", () => {
    expect(() => newInviteCodeFields({ maxUses: 1, expiresAt: new Date("2000-01-01"), note: "" })).toThrow(/future/);
  });

  it("refuses a note over 100 characters", () => {
    expect(() => newInviteCodeFields({ maxUses: 1, expiresAt: null, note: "x".repeat(101) })).toThrow(/note/);
  });
});
