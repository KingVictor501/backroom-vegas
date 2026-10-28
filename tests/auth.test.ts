/*
  FILE: tests/auth.test.ts
  WHAT IT'S FOR: Automatic tests for signing up and logging in. They call the
  real Server Actions (app/actions/auth.ts) against the throwaway test database
  and check what really got saved:
  - sign up saves a bcrypt HASH, never the password itself, and logs the user in
  - sign up refuses a taken email, a weak password, and mismatched passwords
  - login works with the right password and fails (with one vague message) with
    a wrong password or an email that doesn't exist
  - after login the user is sent only to pages inside this app
  These are INTEGRATION tests: several real pieces (the action, the database, the
  password hashing, the cookie) work together, with nothing faked except the
  browser's cookies and the redirect.
  WHO USES IT: Vitest, when you run `npm test`.
  WHY THIS NAME: It tests auth (logging in). It sits in tests/ because it needs the
  test database. It ends in .ts because it shows nothing on screen.
*/

import bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it } from "vitest";
import { login, signup } from "@/app/actions/auth";
import { readSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/token";
import { EMPTY_AUTH_FORM_STATE } from "@/lib/auth/validation";
import { UserModel } from "@/lib/db/models/User";
import { cookieJar } from "./support/cookies";
import { createInviteCode, createTestUser, grantInviteAccess, resetDatabase } from "./support/db";

/* formData: builds the form the browser would submit. */
function formData(fields: Record<string, string>): FormData {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) form.set(name, value);
  return form;
}

/* The one wrong-login message. It never says whether the email or the password was wrong. */
const INVALID_LOGIN = "Invalid email or password.";

beforeEach(async () => {
  await resetDatabase();
});

describe("sign up", () => {
  // Sign up needs an invite now, so every test here starts with a valid invite cookie.
  beforeEach(async () => {
    await grantInviteAccess(await createInviteCode());
  });

  it("saves a bcrypt hash, not the password, and logs the new user in", async () => {
    const form = formData({ email: "New.User@Example.com", password: "Sup3rSecret", confirmPassword: "Sup3rSecret" });

    // A successful sign up ends by redirecting to the Feed ("/"). Our fake redirect throws "REDIRECT:/".
    await expect(signup(EMPTY_AUTH_FORM_STATE, form)).rejects.toThrow("REDIRECT:/");

    // The email is saved trimmed and lowercase. select("+passwordHash") asks for the hash, which is normally hidden.
    const saved = await UserModel.findOne({ email: "new.user@example.com" }).select("+passwordHash").lean();
    expect(saved).not.toBeNull();
    expect(saved?.passwordHash).not.toBe("Sup3rSecret");
    expect(saved?.passwordHash).not.toContain("Sup3rSecret");
    // bcrypt hashes look like $2b$12$...: "$2b" = the bcrypt version, "$12" = how much work it took (the app uses 12).
    expect(saved?.passwordHash).toMatch(/^\$2[aby]\$12\$/);
    expect(await bcrypt.compare("Sup3rSecret", saved?.passwordHash ?? "")).toBe(true);
    expect(await bcrypt.compare("WrongPass1", saved?.passwordHash ?? "")).toBe(false);

    // They're logged in: the cookie holds a valid token for exactly this user.
    const session = await readSessionToken(cookieJar.get(SESSION_COOKIE_NAME)?.value);
    expect(session?.userId).toBe(saved?._id.toString());
  });

  it("refuses an email that's already taken, and creates no second user", async () => {
    await createTestUser("taken@example.com");
    const form = formData({ email: "taken@example.com", password: "Sup3rSecret", confirmPassword: "Sup3rSecret" });

    const result = await signup(EMPTY_AUTH_FORM_STATE, form);

    expect(result.fieldErrors.email).toMatch(/already exists/i);
    expect(await UserModel.countDocuments({ email: "taken@example.com" })).toBe(1);
    expect(cookieJar.get(SESSION_COOKIE_NAME)).toBeUndefined();
  });

  it("refuses a weak password and saves nothing", async () => {
    for (const password of ["short1", "allletters", "12345678", "a".repeat(73) + "1"]) {
      const result = await signup(
        EMPTY_AUTH_FORM_STATE,
        formData({ email: "weak@example.com", password, confirmPassword: password }),
      );
      expect(result.fieldErrors.password).toBeTruthy();
    }
    expect(await UserModel.countDocuments()).toBe(0);
  });

  it("refuses passwords that don't match", async () => {
    const result = await signup(
      EMPTY_AUTH_FORM_STATE,
      formData({ email: "mismatch@example.com", password: "Sup3rSecret", confirmPassword: "Sup3rSecreT" }),
    );
    expect(result.fieldErrors.confirmPassword).toMatch(/match/i);
    expect(await UserModel.countDocuments()).toBe(0);
  });

  it("refuses a bad email and gives the email back, but never the password", async () => {
    const result = await signup(
      EMPTY_AUTH_FORM_STATE,
      formData({ email: "not-an-email", password: "Sup3rSecret", confirmPassword: "Sup3rSecret" }),
    );
    expect(result.fieldErrors.email).toBeTruthy();
    expect(result.email).toBe("not-an-email");
    expect(JSON.stringify(result)).not.toContain("Sup3rSecret");
  });
});

describe("login", () => {
  it("works with the right password: logs in and goes to the Feed", async () => {
    const user = await createTestUser("member@example.com", "Sup3rSecret");

    await expect(
      login(EMPTY_AUTH_FORM_STATE, formData({ email: "member@example.com", password: "Sup3rSecret" })),
    ).rejects.toThrow("REDIRECT:/");

    const session = await readSessionToken(cookieJar.get(SESSION_COOKIE_NAME)?.value);
    expect(session?.userId).toBe(user.id);
  });

  it("is not picky about capital letters or spaces in the email", async () => {
    await createTestUser("member@example.com", "Sup3rSecret");
    await expect(
      login(EMPTY_AUTH_FORM_STATE, formData({ email: "  MEMBER@Example.COM ", password: "Sup3rSecret" })),
    ).rejects.toThrow("REDIRECT:/");
  });

  it("fails with a wrong password: one vague message, no cookie, password not echoed", async () => {
    await createTestUser("member@example.com", "Sup3rSecret");

    const result = await login(EMPTY_AUTH_FORM_STATE, formData({ email: "member@example.com", password: "WrongPass1" }));

    expect(result.message).toBe(INVALID_LOGIN);
    expect(cookieJar.get(SESSION_COOKIE_NAME)).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain("WrongPass1");
  });

  it("gives the SAME message for an email that has no account (so nobody can find out who has one)", async () => {
    const result = await login(EMPTY_AUTH_FORM_STATE, formData({ email: "nobody@example.com", password: "Sup3rSecret" }));
    expect(result.message).toBe(INVALID_LOGIN);
    expect(cookieJar.get(SESSION_COOKIE_NAME)).toBeUndefined();
  });

  it("asks for both boxes to be filled in", async () => {
    const result = await login(EMPTY_AUTH_FORM_STATE, formData({ email: "", password: "" }));
    expect(result.fieldErrors.email).toBeTruthy();
    expect(result.fieldErrors.password).toBeTruthy();
  });

  it("sends the user back to the page they wanted, but only if it's inside this app", async () => {
    await createTestUser("member@example.com", "Sup3rSecret");
    const base = { email: "member@example.com", password: "Sup3rSecret" };

    await expect(login(EMPTY_AUTH_FORM_STATE, formData({ ...base, next: "/betslips" }))).rejects.toThrow(
      "REDIRECT:/betslips",
    );
    // Other websites and tricks all fall back to the Feed.
    for (const next of ["//evil.example", "https://evil.example", "/\\evil.example"]) {
      cookieJar.clear();
      await expect(login(EMPTY_AUTH_FORM_STATE, formData({ ...base, next }))).rejects.toThrow("REDIRECT:/");
    }
  });

  it("never reads a password out of the database into the user object pages use", async () => {
    await createTestUser("member@example.com", "Sup3rSecret");
    // Without asking for the hash on purpose, a normal lookup must not return it.
    const record = await UserModel.findOne({ email: "member@example.com" }).lean();
    expect(record).not.toBeNull();
    expect(record).not.toHaveProperty("passwordHash");
  });
});
