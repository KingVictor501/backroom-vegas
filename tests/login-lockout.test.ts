/*
  FILE: tests/login-lockout.test.ts
  WHAT IT'S FOR: Automatic tests for Section 4, the login lockout. They run the
  real login form action and the real JSON route against the throwaway test
  database, and check:
  - 5 wrong passwords lock the email; the 6th try says "Too many attempts."
  - the RIGHT password is refused during the lockout (and no login cookie is set)
  - after the wait, login works again
  - a good login wipes the wrong-guess count
  - an email that has no account locks exactly like a real one (nothing leaks)
  - one address trying many emails gets locked at 20; other addresses are fine
  - a flood of simultaneous guesses can't sneak past the limit
  - the database holds no readable emails or addresses
  - the JSON route (what Postman uses) answers 200 / 400 / 401 / 415 / 429 correctly
  WHO USES IT: Vitest, when you run `npm test`.
  WHY THIS NAME: It tests the login lockout. It sits in tests/ because it needs
  the test database. It ends in .ts because it shows nothing on screen.
*/

import { beforeEach, describe, expect, it } from "vitest";
import { login } from "@/app/actions/auth";
import { POST } from "@/app/api/auth/login/route";
import { attemptLogin } from "@/lib/auth/loginAttempt";
import { readSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/token";
import { EMPTY_AUTH_FORM_STATE } from "@/lib/auth/validation";
import { AttemptCounterModel } from "@/lib/db/models/AttemptCounter";
import { UserModel } from "@/lib/db/models/User";
import {
  LOGIN_EMAIL_RULE,
  LOGIN_IP_RULE,
  reserveAttempt,
  TOO_MANY_ATTEMPTS_MESSAGE,
} from "@/lib/security/attempts";
import { cookieJar } from "./support/cookies";
import { actAsVisitor, createTestUser, resetDatabase, type TestUser } from "./support/db";
import { jsonRequest } from "./support/factories";

const INVALID_LOGIN = "Invalid email or password.";

/* formData: builds the form the browser would submit. */
function formData(fields: Record<string, string>): FormData {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) form.set(name, value);
  return form;
}

/* tryLogin: submits the login form. Gives back the message shown, or "LOGGED IN" if it redirected. */
async function tryLogin(email: string, password: string): Promise<string | null> {
  try {
    const result = await login(EMPTY_AUTH_FORM_STATE, formData({ email, password }));
    return result.message;
  } catch (error) {
    // A good login ends in a redirect, which our fake redirect turns into a thrown "REDIRECT:..." error.
    if (error instanceof Error && error.message.startsWith("REDIRECT:")) return "LOGGED IN";
    throw error;
  }
}

/* failTimes: submits `count` wrong passwords for an email and gives back each message. */
async function failTimes(email: string, count: number): Promise<(string | null)[]> {
  const messages: (string | null)[] = [];
  for (let i = 0; i < count; i += 1) messages.push(await tryLogin(email, "WrongPass1"));
  return messages;
}

/* endTheWait: pretends the time-out is over by moving every counter's expiry into the past. */
async function endTheWait(): Promise<void> {
  await AttemptCounterModel.updateMany({}, { $set: { expiresAt: new Date(Date.now() - 1000) } });
}

let member: TestUser;

beforeEach(async () => {
  await resetDatabase();
  actAsVisitor("203.0.113.5");
  member = await createTestUser("member@example.com", "Sup3rSecret");
});

describe("lockout after 5 wrong passwords (login form)", () => {
  it("the first 5 wrong passwords get the normal message, the 6th gets 'Too many attempts'", async () => {
    const messages = await failTimes(member.email, 6);
    expect(messages.slice(0, 5)).toEqual(Array(5).fill(INVALID_LOGIN));
    expect(messages[5]).toBe(TOO_MANY_ATTEMPTS_MESSAGE);
    expect(TOO_MANY_ATTEMPTS_MESSAGE).toBe("Too many attempts. Try again in a few minutes.");
  });

  it("the RIGHT password is refused during the lockout, and no login cookie is set", async () => {
    await failTimes(member.email, 5);
    expect(await tryLogin(member.email, member.password)).toBe(TOO_MANY_ATTEMPTS_MESSAGE);
    expect(cookieJar.get(SESSION_COOKIE_NAME)).toBeUndefined();
  });

  it("stays locked for 15 minutes from the 5th failure, not longer, not shorter", async () => {
    await failTimes(member.email, 5);
    const record = await AttemptCounterModel.findOne({ key: /^login-email:/ }).lean();
    const minutesLeft = ((record?.expiresAt.getTime() ?? 0) - Date.now()) / 60_000;
    expect(minutesLeft).toBeGreaterThan(14.9);
    expect(minutesLeft).toBeLessThanOrEqual(15);
  });

  it("works again after the wait", async () => {
    await failTimes(member.email, 6);
    await endTheWait();
    expect(await tryLogin(member.email, member.password)).toBe("LOGGED IN");
    expect(await readSessionToken(cookieJar.get(SESSION_COOKIE_NAME)?.value)).toEqual({ userId: member.id });
  });

  it("after the wait the count starts fresh (5 more wrong tries before the next lock)", async () => {
    await failTimes(member.email, 6);
    await endTheWait();
    const messages = await failTimes(member.email, 6);
    expect(messages.slice(0, 5)).toEqual(Array(5).fill(INVALID_LOGIN));
    expect(messages[5]).toBe(TOO_MANY_ATTEMPTS_MESSAGE);
  });

  it("a good login before the 5th failure wipes the count", async () => {
    await failTimes(member.email, 4);
    expect(await tryLogin(member.email, member.password)).toBe("LOGGED IN");
    cookieJar.clear();
    // Another 4 wrong tries are fine (they would have been the 5th-8th without the reset).
    expect(await failTimes(member.email, 4)).toEqual(Array(4).fill(INVALID_LOGIN));
    expect(await tryLogin(member.email, member.password)).toBe("LOGGED IN");
  });

  it("the 5th try can still be the right password (5 tries are allowed)", async () => {
    await failTimes(member.email, 4);
    expect(await tryLogin(member.email, member.password)).toBe("LOGGED IN");
  });

  it("capital letters and spaces in the email share one counter", async () => {
    await failTimes("  MEMBER@Example.COM ", 3);
    await failTimes("member@example.com", 2);
    expect(await tryLogin("Member@example.com", member.password)).toBe(TOO_MANY_ATTEMPTS_MESSAGE);
  });

  it("one person's lockout doesn't lock a different account", async () => {
    const other = await createTestUser("other@example.com", "Sup3rSecret");
    await failTimes(member.email, 6);
    expect(await tryLogin(other.email, other.password)).toBe("LOGGED IN");
  });

  it("form mistakes (empty or malformed fields) don't count as tries", async () => {
    for (let i = 0; i < 10; i += 1) await tryLogin("", "");
    for (let i = 0; i < 10; i += 1) await tryLogin("not-an-email", "x");
    expect(await AttemptCounterModel.countDocuments()).toBe(0);
    expect(await tryLogin(member.email, member.password)).toBe("LOGGED IN");
  });

  it("a password over 128 characters is refused as a form mistake, without counting", async () => {
    const result = await login(EMPTY_AUTH_FORM_STATE, formData({ email: member.email, password: "a".repeat(129) }));
    expect(result.fieldErrors.password).toBe("That password is too long.");
    expect(await AttemptCounterModel.countDocuments()).toBe(0);
  });
});

describe("an email with no account is locked exactly like a real one (nothing leaks)", () => {
  it("gives the same messages in the same order", async () => {
    const real = await failTimes(member.email, 7);
    cookieJar.clear();
    actAsVisitor("203.0.113.99");
    const fake = await failTimes("nobody@example.com", 7);
    expect(fake).toEqual(real);
  });
});

describe("limit per address (20 tries across all emails)", () => {
  it("one address trying many different emails is locked at 20", async () => {
    for (let i = 0; i < 20; i += 1) expect(await tryLogin(`guess${i}@example.com`, "WrongPass1")).toBe(INVALID_LOGIN);
    // A brand-new email, even with the right details, is refused from this address.
    expect(await tryLogin(member.email, member.password)).toBe(TOO_MANY_ATTEMPTS_MESSAGE);
  });

  it("a different address is not affected", async () => {
    for (let i = 0; i < 21; i += 1) await tryLogin(`guess${i}@example.com`, "WrongPass1");
    actAsVisitor("198.51.100.7");
    expect(await tryLogin(member.email, member.password)).toBe("LOGGED IN");
  });

  it("good logins don't use up the address's allowance (a shared Wi-Fi is fine)", async () => {
    for (let i = 0; i < 30; i += 1) {
      cookieJar.clear();
      expect(await tryLogin(member.email, member.password)).toBe("LOGGED IN");
    }
    const record = await AttemptCounterModel.findOne({ key: /^login-address:/ }).lean();
    expect(record?.count ?? 0).toBe(0);
  });

  it("a good login does NOT erase the address's earlier wrong guesses", async () => {
    await failTimes("someone@example.com", 3);
    await tryLogin(member.email, member.password);
    const record = await AttemptCounterModel.findOne({ key: /^login-address:/ }).lean();
    expect(record?.count).toBe(3);
  });

  it("the email lockout follows the email to any address", async () => {
    await failTimes(member.email, 5);
    actAsVisitor("198.51.100.7");
    expect(await tryLogin(member.email, member.password)).toBe(TOO_MANY_ATTEMPTS_MESSAGE);
  });
});

describe("simultaneous guesses can't sneak past the limit", () => {
  it("20 guesses fired at once: exactly 5 are checked, the other 15 are locked", async () => {
    const results = await Promise.all(Array.from({ length: 20 }, () => attemptLogin(member.email, "WrongPass1")));
    const checked = results.filter((r) => !r.ok && r.reason === "invalid").length;
    const locked = results.filter((r) => !r.ok && r.reason === "locked").length;
    expect(checked).toBe(5);
    expect(locked).toBe(15);
  });

  it("the right password mixed into a flood still can't get in after the 5 tries are gone", async () => {
    await failTimes(member.email, 5);
    const results = await Promise.all(Array.from({ length: 10 }, () => attemptLogin(member.email, member.password)));
    expect(results.every((r) => !r.ok && r.reason === "locked")).toBe(true);
  });
});

describe("what is stored", () => {
  it("keeps no readable email or address, only scrambled keys", async () => {
    await failTimes(member.email, 2);
    const records = await AttemptCounterModel.find().lean();
    expect(records).toHaveLength(2);
    for (const record of records) {
      expect(record.key).toMatch(/^login-(email|address):[0-9a-f]{64}$/);
      expect(record.key).not.toContain("member");
      expect(record.key).not.toContain("203.0.113.5");
    }
  });

  it("login failures and invite failures are counted separately", async () => {
    await failTimes(member.email, 2);
    const keys = (await AttemptCounterModel.find().lean()).map((r) => r.key.split(":")[0]);
    expect(keys.sort()).toEqual(["login-address", "login-email"]);
  });
});

describe("reserveAttempt (the counter itself)", () => {
  it("allows 5, refuses the 6th, and reports a wait of about 15 minutes", async () => {
    const key = "login-email:test";
    for (let i = 0; i < 5; i += 1) expect((await reserveAttempt(key, LOGIN_EMAIL_RULE)).allowed).toBe(true);
    const sixth = await reserveAttempt(key, LOGIN_EMAIL_RULE);
    expect(sixth.allowed).toBe(false);
    expect(sixth.retryAfterSeconds).toBeGreaterThan(14 * 60);
    expect(sixth.retryAfterSeconds).toBeLessThanOrEqual(15 * 60);
  });

  it("the wait is measured from the 5th try, even if the 1st was long ago", async () => {
    const key = "login-email:test2";
    const longAgo = new Date(Date.now() - 10 * 60 * 1000);
    for (let i = 0; i < 4; i += 1) await reserveAttempt(key, LOGIN_EMAIL_RULE, longAgo);
    await reserveAttempt(key, LOGIN_EMAIL_RULE); // the 5th, just now
    const next = await reserveAttempt(key, LOGIN_EMAIL_RULE);
    expect(next.allowed).toBe(false);
    expect(next.retryAfterSeconds).toBeGreaterThan(14 * 60);
  });

  it("the address rule is 20 and the email rule is 5, both for 15 minutes", () => {
    expect(LOGIN_EMAIL_RULE).toEqual({ maxFailures: 5, windowMs: 900_000 });
    expect(LOGIN_IP_RULE).toEqual({ maxFailures: 20, windowMs: 900_000 });
  });
});

describe("POST /api/auth/login (the JSON route Postman uses)", () => {
  /* send: posts JSON to the route. */
  const send = (body: unknown, contentType?: string) => POST(jsonRequest("POST", "/api/auth/login", body, contentType));

  it("200 on a good login: sets the cookie, returns the user, never the hash", async () => {
    const response = await send({ email: member.email, password: member.password });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.user.email).toBe(member.email);
    expect(JSON.stringify(body)).not.toMatch(/passwordHash|\$2[aby]\$/);
    expect(await readSessionToken(cookieJar.get(SESSION_COOKIE_NAME)?.value)).toEqual({ userId: member.id });
  });

  it("401 with one vague message for a wrong password and for an unknown email", async () => {
    const wrongPassword = await send({ email: member.email, password: "WrongPass1" });
    const unknownEmail = await send({ email: "nobody@example.com", password: "WrongPass1" });
    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(await wrongPassword.json()).toEqual(await unknownEmail.json());
    expect(cookieJar.get(SESSION_COOKIE_NAME)).toBeUndefined();
  });

  it("429 with a Retry-After header after 5 wrong passwords, even for the right password", async () => {
    for (let i = 0; i < 5; i += 1) expect((await send({ email: member.email, password: "WrongPass1" })).status).toBe(401);
    const locked = await send({ email: member.email, password: member.password });
    expect(locked.status).toBe(429);
    expect((await locked.json()).error).toEqual({ code: "too-many-requests", message: TOO_MANY_ATTEMPTS_MESSAGE });
    const retryAfter = Number(locked.headers.get("Retry-After"));
    expect(retryAfter).toBeGreaterThan(14 * 60);
    expect(retryAfter).toBeLessThanOrEqual(15 * 60);
    expect(cookieJar.get(SESSION_COOKIE_NAME)).toBeUndefined();
  });

  it("the form and the route share one counter", async () => {
    await failTimes(member.email, 3);
    await send({ email: member.email, password: "WrongPass1" });
    await send({ email: member.email, password: "WrongPass1" });
    expect((await send({ email: member.email, password: member.password })).status).toBe(429);
    expect(await tryLogin(member.email, member.password)).toBe(TOO_MANY_ATTEMPTS_MESSAGE);
  });

  it("works again after the wait", async () => {
    for (let i = 0; i < 6; i += 1) await send({ email: member.email, password: "WrongPass1" });
    await endTheWait();
    expect((await send({ email: member.email, password: member.password })).status).toBe(200);
  });

  it("400 for missing, wrong-typed, or injection-style input, and none of it counts as a try or touches the database", async () => {
    const before = await UserModel.countDocuments();
    const bad: unknown[] = [
      {},
      { email: member.email },
      { password: "x" },
      { email: 5, password: "x" },
      { email: member.email, password: ["a"] },
      { email: { $gt: "" }, password: { $gt: "" } },
      { email: "not-an-email", password: "x" },
      { email: member.email, password: "a".repeat(129) },
      [],
      "null",
    ];
    for (const body of bad) expect((await send(body)).status).toBe(400);
    expect(await AttemptCounterModel.countDocuments()).toBe(0);
    expect(await UserModel.countDocuments()).toBe(before);
  });

  it("400 for broken JSON, 415 for a body that isn't marked JSON, 413 for a huge body", async () => {
    expect((await send("{not json")).status).toBe(400);
    expect((await send(JSON.stringify({ email: member.email, password: "x" }), "text/plain")).status).toBe(415);
    expect((await send({ email: member.email, password: "x".repeat(200_000) })).status).toBe(413);
    expect(await AttemptCounterModel.countDocuments()).toBe(0);
  });

  it("a 429 or 401 never includes a stack trace or database details", async () => {
    for (let i = 0; i < 6; i += 1) {
      const text = await (await send({ email: member.email, password: "WrongPass1" })).text();
      expect(text).not.toMatch(/stack|mongo|at \S+ \(|node_modules|passwordHash/i);
    }
  });
});
