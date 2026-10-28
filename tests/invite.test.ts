/*
  FILE: tests/invite.test.ts
  WHAT IT'S FOR: Automatic tests for invite codes, from every angle:
  1. The invite page's action: a valid code is remembered and leads on to sign up,
     but is NOT used up by being entered
  2. Bad codes: fake, used-up, expired, and turned-off codes (and wrong shapes,
     and tricks like {"$gt": ""}) are all refused with the SAME message
  3. Trying too many codes: 5 wrong tries = a time-out, which a right code can't skip
  4. Sign up: needs a valid invite, counts the use ONLY when the account is created,
     saves which code was used, re-checks the code, and hands the spot back if the
     account can't be created
  5. The last-spot race: two sign ups at the same instant, one spot, one winner
  6. The terminal script (scripts/create-invite-code.ts) really creates a code that works
  7. The database model's own rules
  WHO USES IT: Vitest, when you run `npm test`.
  WHY THIS NAME: It tests invite codes. It sits in tests/ because it needs the
  test database. It ends in .ts because it shows nothing on screen.
*/

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enterInviteCode } from "@/app/actions/invite";
import { login, signup } from "@/app/actions/auth";
import { createInviteToken, INVITE_COOKIE_NAME, readInviteToken, SESSION_COOKIE_NAME } from "@/lib/auth/token";
import { EMPTY_AUTH_FORM_STATE } from "@/lib/auth/validation";
import { claimInviteUse, findUsableInviteCode, isInviteCodeGood, releaseInviteUse } from "@/lib/db/inviteCodes";
import { AttemptCounterModel } from "@/lib/db/models/AttemptCounter";
import { InviteCodeModel } from "@/lib/db/models/InviteCode";
import { UserModel } from "@/lib/db/models/User";
import { EMPTY_INVITE_FORM_STATE, INVALID_INVITE_MESSAGE } from "@/lib/invite/format";
import { INVITE_ATTEMPT_RULE, TOO_MANY_ATTEMPTS_MESSAGE } from "@/lib/security/attempts";
import { cookieJar } from "./support/cookies";
import { actAsVisitor, createInviteCode, createTestUser, grantInviteAccess, resetDatabase } from "./support/db";

/* formData: builds the form the browser would submit. */
function formData(fields: Record<string, string>): FormData {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) form.set(name, value);
  return form;
}

/* enter: types a code on the invite page. */
function enter(code: string, extra: Record<string, string> = {}) {
  return enterInviteCode(EMPTY_INVITE_FORM_STATE, formData({ code, ...extra }));
}

/* signUp: submits the sign up form with good details for this email. */
function signUp(email: string) {
  return signup(EMPTY_AUTH_FORM_STATE, formData({ email, password: "Sup3rSecret", confirmPassword: "Sup3rSecret" }));
}

beforeEach(async () => {
  await resetDatabase();
  // Every test starts as one particular visitor, so attempt counting is predictable.
  actAsVisitor("203.0.113.5");
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the invite page: a valid code", () => {
  it("is remembered in the invite cookie and sends the visitor on to sign up", async () => {
    const invite = await createInviteCode();

    await expect(enter(invite.code)).rejects.toThrow("REDIRECT:/signup");

    // The cookie holds a genuine token for exactly this code's record.
    const token = cookieJar.get(INVITE_COOKIE_NAME)?.value;
    expect(await readInviteToken(token)).toEqual({ inviteCodeId: invite._id.toString() });
    // The code itself is NOT inside the cookie.
    expect(token).not.toContain(invite.code);
  });

  it("is NOT used up by being entered (entering it 10 times still leaves it unused)", async () => {
    const invite = await createInviteCode({ maxUses: 1 });
    for (let i = 0; i < 10; i += 1) {
      cookieJar.clear();
      await expect(enter(invite.code)).rejects.toThrow("REDIRECT:/signup");
    }
    expect((await InviteCodeModel.findById(invite._id).lean())?.usedCount).toBe(0);
  });

  it("works with lowercase letters and spaces", async () => {
    const invite = await createInviteCode();
    await expect(enter(`  ${invite.code.toLowerCase()} `)).rejects.toThrow("REDIRECT:/signup");
  });

  it("keeps the page the visitor was heading to, but only if it's inside this app", async () => {
    const invite = await createInviteCode();
    await expect(enter(invite.code, { next: "/betslips" })).rejects.toThrow("REDIRECT:/signup?next=%2Fbetslips");
    for (const next of ["//evil.example", "https://evil.example", "/\\evil.example"]) {
      cookieJar.clear();
      await expect(enter(invite.code, { next })).rejects.toThrow("REDIRECT:/signup");
    }
  });

  it("an invite cookie is set with safe settings: it lasts 30 days", async () => {
    // Settings (httpOnly, secure, sameSite) are set in lib/auth/inviteCookie.ts; here we check the token's lifetime.
    const token = await createInviteToken("64b7f0c2a1b2c3d4e5f60718");
    const [, payload] = token.split(".");
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
    expect(claims.exp - claims.iat).toBe(30 * 24 * 60 * 60);
    expect(claims.aud).toBe("invite");
  });
});

describe("the invite page: a bad code gets one message, whatever was wrong", () => {
  it("fake code", async () => {
    const result = await enter("BRV-AAAA-BBBB");
    expect(result.message).toBe(INVALID_INVITE_MESSAGE);
    expect(cookieJar.get(INVITE_COOKIE_NAME)).toBeUndefined();
  });

  it("used-up code", async () => {
    const invite = await createInviteCode({ maxUses: 2, usedCount: 2 });
    expect((await enter(invite.code)).message).toBe(INVALID_INVITE_MESSAGE);
    expect(cookieJar.get(INVITE_COOKIE_NAME)).toBeUndefined();
  });

  it("expired code", async () => {
    const invite = await createInviteCode({ expiresAt: new Date(Date.now() - 1000) });
    expect((await enter(invite.code)).message).toBe(INVALID_INVITE_MESSAGE);
    expect(cookieJar.get(INVITE_COOKIE_NAME)).toBeUndefined();
  });

  it("turned-off code", async () => {
    const invite = await createInviteCode({ active: false });
    expect((await enter(invite.code)).message).toBe(INVALID_INVITE_MESSAGE);
    expect(cookieJar.get(INVITE_COOKIE_NAME)).toBeUndefined();
  });

  it("a code that expires in the future still works", async () => {
    const invite = await createInviteCode({ expiresAt: new Date(Date.now() + 60 * 60 * 1000) });
    await expect(enter(invite.code)).rejects.toThrow("REDIRECT:/signup");
  });

  it("empty, wrong-shaped, and trick inputs are refused with the same message", async () => {
    for (const code of ["", "   ", "hello", "BRV-1111-2222", "BRV-AAAA-BBBB'; drop", "<script>alert(1)</script>"]) {
      // Each is a failed try; reset the counter so we test the message, not the time-out.
      await AttemptCounterModel.deleteMany({});
      expect((await enter(code)).message, JSON.stringify(code)).toBe(INVALID_INVITE_MESSAGE);
    }
  });

  it("a database-style trick instead of text can't get in", async () => {
    await createInviteCode();
    const form = new FormData();
    // A form can only carry text or a file; a file is read as "not text".
    form.set("code", new Blob(["BRV-AAAA-BBBB"]), "code.txt");
    expect((await enterInviteCode(EMPTY_INVITE_FORM_STATE, form)).message).toBe(INVALID_INVITE_MESSAGE);
    // And the helper itself refuses non-text, such as {"$gt": ""} sent straight to it.
    expect(await findUsableInviteCode({ $gt: "" })).toBeNull();
    expect(await findUsableInviteCode(["BRV-AAAA-BBBB"])).toBeNull();
  });

  it("gives back what was typed so a typo is easy to fix, and never says which part failed", async () => {
    const result = await enter("BRV-AAAA-BBBB");
    expect(result.code).toBe("BRV-AAAA-BBBB");
    expect(result.message).not.toMatch(/expired|used|off|inactive|not found|exist/i);
  });
});

describe("trying too many codes", () => {
  it("5 wrong tries start a time-out: the 6th try gets the 'too many attempts' message", async () => {
    for (let i = 0; i < INVITE_ATTEMPT_RULE.maxFailures; i += 1) {
      expect((await enter("BRV-AAAA-BBBB")).message).toBe(INVALID_INVITE_MESSAGE);
    }
    expect((await enter("BRV-AAAA-BBBB")).message).toBe(TOO_MANY_ATTEMPTS_MESSAGE);
  });

  it("a RIGHT code is also refused during the time-out (and gives no hint it was right)", async () => {
    const invite = await createInviteCode();
    for (let i = 0; i < INVITE_ATTEMPT_RULE.maxFailures; i += 1) await enter("BRV-AAAA-BBBB");

    const result = await enter(invite.code);

    expect(result.message).toBe(TOO_MANY_ATTEMPTS_MESSAGE);
    expect(cookieJar.get(INVITE_COOKIE_NAME)).toBeUndefined();
  });

  it("4 wrong tries do not block; the 5th wrong try is still just 'not valid'", async () => {
    const invite = await createInviteCode();
    for (let i = 0; i < 4; i += 1) await enter("BRV-AAAA-BBBB");
    // Still allowed to try a right one on the 5th go.
    await expect(enter(invite.code)).rejects.toThrow("REDIRECT:/signup");
  });

  it("a right code does NOT reset the count (so a stolen valid code can't be used to keep guessing)", async () => {
    const invite = await createInviteCode({ maxUses: 100 });
    for (let i = 0; i < 4; i += 1) await enter("BRV-AAAA-BBBB");
    cookieJar.clear();
    await expect(enter(invite.code)).rejects.toThrow("REDIRECT:/signup"); // a right one in between
    expect((await enter("BRV-AAAA-BBBB")).message).toBe(INVALID_INVITE_MESSAGE); // 5th wrong
    expect((await enter("BRV-AAAA-BBBB")).message).toBe(TOO_MANY_ATTEMPTS_MESSAGE); // blocked
  });

  it("the time-out is per visitor: someone else is not blocked", async () => {
    const invite = await createInviteCode();
    for (let i = 0; i < INVITE_ATTEMPT_RULE.maxFailures; i += 1) await enter("BRV-AAAA-BBBB");
    expect((await enter("BRV-AAAA-BBBB")).message).toBe(TOO_MANY_ATTEMPTS_MESSAGE);

    actAsVisitor("198.51.100.77");
    await expect(enter(invite.code)).rejects.toThrow("REDIRECT:/signup");
  });

  it("the time-out ends after 15 minutes", async () => {
    const invite = await createInviteCode();
    for (let i = 0; i < INVITE_ATTEMPT_RULE.maxFailures; i += 1) await enter("BRV-AAAA-BBBB");
    expect((await enter(invite.code)).message).toBe(TOO_MANY_ATTEMPTS_MESSAGE);

    // Pretend 15 minutes have passed by moving the record's end time into the past.
    await AttemptCounterModel.updateMany({}, { $set: { expiresAt: new Date(Date.now() - 1000) } });

    await expect(enter(invite.code)).rejects.toThrow("REDIRECT:/signup");
  });

  it("the time-out lasts the full 15 minutes from the 5th failure", async () => {
    for (let i = 0; i < INVITE_ATTEMPT_RULE.maxFailures; i += 1) await enter("BRV-AAAA-BBBB");
    const record = await AttemptCounterModel.findOne({}).lean();
    const secondsLeft = ((record?.expiresAt.getTime() ?? 0) - Date.now()) / 1000;
    expect(secondsLeft).toBeGreaterThan(14 * 60);
    expect(secondsLeft).toBeLessThanOrEqual(15 * 60);
  });

  it("saves a scrambled ID, never the raw IP address", async () => {
    await enter("BRV-AAAA-BBBB");
    const record = await AttemptCounterModel.findOne({}).lean();
    expect(record?.key).toMatch(/^invite:[0-9a-f]{64}$/);
    expect(JSON.stringify(record)).not.toContain("203.0.113.5");
  });

  it("failed tries are counted separately for the invite page and (later) other forms", async () => {
    await enter("BRV-AAAA-BBBB");
    const record = await AttemptCounterModel.findOne({}).lean();
    expect(record?.key.startsWith("invite:")).toBe(true);
  });
});

describe("sign up with an invite", () => {
  it("uses up ONE spot only when the account is created, and remembers which code was used", async () => {
    const invite = await createInviteCode({ maxUses: 3 });
    await grantInviteAccess(invite);

    await expect(signUp("first@example.com")).rejects.toThrow("REDIRECT:/");

    expect((await InviteCodeModel.findById(invite._id).lean())?.usedCount).toBe(1);
    const user = await UserModel.findOne({ email: "first@example.com" }).lean();
    expect(user?.inviteCodeId?.toString()).toBe(invite._id.toString());
    // And they're logged in.
    expect(cookieJar.get(SESSION_COOKIE_NAME)).toBeDefined();
  });

  it("logging in does NOT use up a spot", async () => {
    const invite = await createInviteCode();
    await grantInviteAccess(invite);
    await createTestUser("member@example.com", "Sup3rSecret");

    await expect(
      login(EMPTY_AUTH_FORM_STATE, formData({ email: "member@example.com", password: "Sup3rSecret" })),
    ).rejects.toThrow("REDIRECT:/");

    expect((await InviteCodeModel.findById(invite._id).lean())?.usedCount).toBe(0);
  });

  it("an existing account can log in on a new device with NO invite cookie and no code", async () => {
    await createTestUser("member@example.com", "Sup3rSecret");
    expect(cookieJar.get(INVITE_COOKIE_NAME)).toBeUndefined();

    await expect(
      login(EMPTY_AUTH_FORM_STATE, formData({ email: "member@example.com", password: "Sup3rSecret" })),
    ).rejects.toThrow("REDIRECT:/");
    expect(cookieJar.get(SESSION_COOKIE_NAME)).toBeDefined();
  });

  it("an email that is not in the database can't log in, even with a valid invite cookie", async () => {
    const invite = await createInviteCode();
    await grantInviteAccess(invite);

    const result = await login(EMPTY_AUTH_FORM_STATE, formData({ email: "stranger@example.com", password: "Sup3rSecret" }));
    expect(result.message).toBeTruthy();
    expect(cookieJar.get(SESSION_COOKIE_NAME)).toBeUndefined();
    expect(await UserModel.countDocuments({ email: "stranger@example.com" })).toBe(0);
  });

  it("with no invite cookie, goes straight to the invite page and creates nothing", async () => {
    await createInviteCode();
    await expect(signUp("sneaky@example.com")).rejects.toThrow("REDIRECT:/invite");
    expect(await UserModel.countDocuments()).toBe(0);
    expect(cookieJar.get(SESSION_COOKIE_NAME)).toBeUndefined();
  });

  it("with a tampered invite cookie, goes to the invite page and creates nothing", async () => {
    const invite = await createInviteCode();
    await grantInviteAccess(invite);
    cookieJar.set(INVITE_COOKIE_NAME, `${cookieJar.get(INVITE_COOKIE_NAME)?.value}x`);
    await expect(signUp("sneaky@example.com")).rejects.toThrow("REDIRECT:/invite");
    expect(await UserModel.countDocuments()).toBe(0);
    expect((await InviteCodeModel.findById(invite._id).lean())?.usedCount).toBe(0);
  });

  it("re-checks the code: used up since it was entered → back to the invite page with the red message, cookie cleared", async () => {
    const invite = await createInviteCode({ maxUses: 1 });
    await grantInviteAccess(invite);
    // Someone else takes the only spot before this visitor submits the form.
    await InviteCodeModel.updateOne({ _id: invite._id }, { $set: { usedCount: 1 } });

    await expect(signUp("late@example.com")).rejects.toThrow("REDIRECT:/invite?error=invalid");

    expect(await UserModel.countDocuments()).toBe(0);
    expect(cookieJar.get(INVITE_COOKIE_NAME)).toBeUndefined();
    expect((await InviteCodeModel.findById(invite._id).lean())?.usedCount).toBe(1);
  });

  it("re-checks the code: turned off since it was entered", async () => {
    const invite = await createInviteCode();
    await grantInviteAccess(invite);
    await InviteCodeModel.updateOne({ _id: invite._id }, { $set: { active: false } });
    await expect(signUp("late@example.com")).rejects.toThrow("REDIRECT:/invite?error=invalid");
    expect(await UserModel.countDocuments()).toBe(0);
  });

  it("re-checks the code: expired since it was entered", async () => {
    const invite = await createInviteCode({ expiresAt: new Date(Date.now() + 60_000) });
    await grantInviteAccess(invite);
    await InviteCodeModel.updateOne({ _id: invite._id }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    await expect(signUp("late@example.com")).rejects.toThrow("REDIRECT:/invite?error=invalid");
    expect(await UserModel.countDocuments()).toBe(0);
  });

  it("a cookie for a code that was deleted is refused", async () => {
    const invite = await createInviteCode();
    await grantInviteAccess(invite);
    await InviteCodeModel.deleteOne({ _id: invite._id });
    await expect(signUp("late@example.com")).rejects.toThrow("REDIRECT:/invite?error=invalid");
  });

  it("a taken email does not use up a spot", async () => {
    const invite = await createInviteCode();
    await grantInviteAccess(invite);
    await createTestUser("taken@example.com");

    const result = await signUp("taken@example.com");

    expect(result.fieldErrors.email).toMatch(/already exists/i);
    expect((await InviteCodeModel.findById(invite._id).lean())?.usedCount).toBe(0);
  });

  it("a bad form (weak password) does not use up a spot", async () => {
    const invite = await createInviteCode();
    await grantInviteAccess(invite);
    const result = await signup(EMPTY_AUTH_FORM_STATE, formData({ email: "weak@example.com", password: "weak", confirmPassword: "weak" }));
    expect(result.fieldErrors.password).toBeTruthy();
    expect((await InviteCodeModel.findById(invite._id).lean())?.usedCount).toBe(0);
  });

  it("hands the spot back if the account can't be saved", async () => {
    const invite = await createInviteCode();
    await grantInviteAccess(invite);
    vi.spyOn(UserModel, "create").mockRejectedValueOnce(new Error("pretend the database hiccuped"));
    // Quiet the (expected) error log for this test.
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const result = await signUp("unlucky@example.com");

    expect(result.message).toMatch(/couldn't create your account/i);
    expect((await InviteCodeModel.findById(invite._id).lean())?.usedCount).toBe(0);
    expect(await UserModel.countDocuments()).toBe(0);
  });

  it("a code with 3 spots lets exactly 3 people in", async () => {
    const invite = await createInviteCode({ maxUses: 3 });
    const results: string[] = [];
    for (let n = 1; n <= 5; n += 1) {
      cookieJar.clear();
      await grantInviteAccess(invite);
      try {
        await signUp(`person${n}@example.com`);
      } catch (error) {
        results.push(error instanceof Error ? error.message : "?");
      }
    }
    expect(results).toEqual(["REDIRECT:/", "REDIRECT:/", "REDIRECT:/", "REDIRECT:/invite?error=invalid", "REDIRECT:/invite?error=invalid"]);
    expect(await UserModel.countDocuments()).toBe(3);
    expect((await InviteCodeModel.findById(invite._id).lean())?.usedCount).toBe(3);
  });

  it("an INVITE token can't be used as a login (and a login token can't be used as an invite)", async () => {
    const invite = await createInviteCode();
    const inviteToken = await createInviteToken(invite._id.toString());
    cookieJar.set(SESSION_COOKIE_NAME, inviteToken);
    // The invite token sits in the login cookie: nobody is logged in.
    const { GET } = await import("@/app/api/betslips/route");
    expect((await GET()).status).toBe(401);
  });
});

describe("the last spot: two sign ups at the same instant", () => {
  it("only one of them gets the account (one spot, one winner)", async () => {
    const invite = await createInviteCode({ maxUses: 1 });
    await grantInviteAccess(invite);

    const outcomes = await Promise.allSettled([signUp("racer1@example.com"), signUp("racer2@example.com")]);

    const messages = outcomes.map((outcome) => (outcome.status === "rejected" ? (outcome.reason as Error).message : "resolved"));
    expect(messages.sort()).toEqual(["REDIRECT:/", "REDIRECT:/invite?error=invalid"]);
    expect(await UserModel.countDocuments()).toBe(1);
    expect((await InviteCodeModel.findById(invite._id).lean())?.usedCount).toBe(1);
  });

  it("20 people racing for 5 spots: exactly 5 get in, and the count is exactly 5", async () => {
    const invite = await createInviteCode({ maxUses: 5 });
    await grantInviteAccess(invite);

    const outcomes = await Promise.allSettled(Array.from({ length: 20 }, (_, n) => signUp(`racer${n}@example.com`)));

    const winners = outcomes.filter((o) => o.status === "rejected" && (o.reason as Error).message === "REDIRECT:/");
    expect(winners).toHaveLength(5);
    expect(await UserModel.countDocuments()).toBe(5);
    expect((await InviteCodeModel.findById(invite._id).lean())?.usedCount).toBe(5);
  });

  it("claimInviteUse itself never goes past the limit, however many ask", async () => {
    const invite = await createInviteCode({ maxUses: 3 });
    const results = await Promise.all(Array.from({ length: 12 }, () => claimInviteUse(invite._id.toString())));
    expect(results.filter(Boolean)).toHaveLength(3);
    expect((await InviteCodeModel.findById(invite._id).lean())?.usedCount).toBe(3);
  });
});

describe("invite code database helpers", () => {
  it("isInviteCodeGood needs: turned on, spots left, and not expired", async () => {
    const now = new Date("2026-06-01T00:00:00Z");
    const base = await createInviteCode({ maxUses: 2, usedCount: 1, expiresAt: new Date("2026-07-01T00:00:00Z") });
    expect(isInviteCodeGood(base, now)).toBe(true);
    expect(isInviteCodeGood({ ...base, active: false }, now)).toBe(false);
    expect(isInviteCodeGood({ ...base, usedCount: 2 }, now)).toBe(false);
    expect(isInviteCodeGood({ ...base, expiresAt: new Date("2026-05-31T00:00:00Z") }, now)).toBe(false);
    expect(isInviteCodeGood({ ...base, expiresAt: null }, now)).toBe(true);
  });

  it("releaseInviteUse never goes below zero", async () => {
    const invite = await createInviteCode();
    await releaseInviteUse(invite._id.toString());
    await releaseInviteUse(invite._id.toString());
    expect((await InviteCodeModel.findById(invite._id).lean())?.usedCount).toBe(0);
  });

  it("claimInviteUse and releaseInviteUse ignore IDs that aren't real IDs", async () => {
    expect(await claimInviteUse("not-an-id")).toBeNull();
    expect(await claimInviteUse('{"$gt":""}')).toBeNull();
    await expect(releaseInviteUse("not-an-id")).resolves.toBeUndefined();
  });
});

describe("the database model's rules", () => {
  it("refuses 0 uses, a fractional number of uses, a bad code, a long note, and duplicates", async () => {
    const good = await createInviteCode();
    await expect(createInviteCode({ maxUses: 0 })).rejects.toThrow();
    await expect(createInviteCode({ maxUses: 1.5 })).rejects.toThrow();
    await expect(createInviteCode({ code: "not-a-code" })).rejects.toThrow();
    await expect(createInviteCode({ note: "x".repeat(101) })).rejects.toThrow();
    await expect(createInviteCode({ code: good.code })).rejects.toThrow(/duplicate|E11000/i);
  });
});

describe("the terminal script (scripts/create-invite-code.ts)", () => {
  const run = promisify(execFile);

  /*
    runScript: runs the script as its own program, pointed at the throwaway test
    database. Only the settings it needs are passed, so it can never read your
    real .env.local.
  */
  async function runScript(args: string[]): Promise<{ stdout: string; stderr: string }> {
    const running = run(process.execPath, ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", "scripts/create-invite-code.ts", ...args], {
      env: { PATH: process.env.PATH, MONGODB_URI: process.env.MONGODB_URI, NODE_ENV: "test" },
    });
    // Close the script's keyboard input right away: nobody is typing, like pressing Ctrl-D.
    running.child.stdin?.end();
    return running;
  }

  it("creates a code in the database you name, and that code really works on the invite page", async () => {
    const dbName = process.env.MONGODB_DB as string;

    const { stdout } = await runScript(["--db", dbName, "--uses", "10", "--note", "graders", "--expires", "2099-12-31"]);

    const code = stdout.match(/BRV-[A-Z2-9]{4}-[A-Z2-9]{4}/)?.[0];
    expect(code).toBeDefined();
    const saved = await InviteCodeModel.findOne({ code }).lean();
    expect(saved).toMatchObject({ maxUses: 10, usedCount: 0, active: true, note: "graders" });
    expect(saved?.expiresAt?.toISOString()).toBe("2099-12-31T23:59:59.999Z");
    // Not just saved: the website's own code accepts it.
    expect(await findUsableInviteCode(code)).not.toBeNull();
    await expect(enter(code ?? "")).rejects.toThrow("REDIRECT:/signup");
  });

  it("creates the code in the database named by --db and nowhere else", async () => {
    const otherDb = "some_other_database";
    const { stdout } = await runScript(["--db", otherDb, "--uses", "1"]);
    const code = stdout.match(/BRV-[A-Z2-9]{4}-[A-Z2-9]{4}/)?.[0];
    // Not in this test file's database...
    expect(await InviteCodeModel.countDocuments({ code })).toBe(0);
    // ...but in the one named. (Clean it up afterward.)
    const mongoose = (await import("mongoose")).default;
    const other = await mongoose.createConnection(process.env.MONGODB_URI as string, { dbName: otherDb }).asPromise();
    try {
      expect(await other.collection("invitecodes").countDocuments({ code })).toBe(1);
      await other.dropDatabase();
    } finally {
      await other.close();
    }
  });

  it("refuses to run without --db, and with bad choices, and creates nothing", async () => {
    for (const args of [[], ["--db", "x", "--uses", "0"], ["--db", "x", "--uses", "5000"], ["--db", "x", "--expires", "2000-01-01"], ["--db", "x", "--expires", "tomorrow"], ["--db", "bad name!"]]) {
      await expect(runScript(args), args.join(" ")).rejects.toMatchObject({ code: 1 });
    }
    expect(await InviteCodeModel.countDocuments()).toBe(0);
  });

  it("never prints the database address", async () => {
    const { stdout, stderr } = await runScript(["--db", process.env.MONGODB_DB as string]);
    expect(stdout + stderr).not.toMatch(/mongodb:\/\//);
    expect(stdout + stderr).not.toContain(String(process.env.MONGODB_URI));
  });

  it("asks for confirmation before touching the LIVE database name, and does nothing without it", async () => {
    // The keyboard input is closed (see runScript), so the confirmation question can't be answered.
    // The script must stop, not wait forever, and not create anything.
    await expect(runScript(["--db", "backroom-vegas", "--uses", "1"])).rejects.toMatchObject({ code: 1 });
  });
});
