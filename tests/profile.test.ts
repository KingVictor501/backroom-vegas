/*
  FILE: tests/profile.test.ts
  WHAT IT'S FOR: Automatic tests for Section 5, the Profile page's three Server
  Actions. They run the real actions against the throwaway test database and check
  what really got saved:
  CHANGE EMAIL: works with the right password; refuses a wrong password, a taken
    email (any capitalization), the same email, a bad email, empty boxes
  CHANGE PASSWORD: saves a bcrypt hash that works, the old password stops working,
    this device stays logged in, OTHER devices are logged out; refuses a wrong
    current password, weak or mismatched new passwords, and reusing the old one
  DELETE ACCOUNT: needs DELETE + the right password; erases the user and ALL their
    slips (and nobody else's), clears both cookies, goes to the invite page; the
    deleted account can't log in and its old cookie no longer works
  SAFETY: logged-out visitors are sent to /login; a forged userId in the form is
    ignored, so one user can never change another's account; wrong-password
    guessing is limited to 5 tries; no answer ever contains a password hash
  WHO USES IT: Vitest, when you run `npm test`.
  WHY THIS NAME: It tests the profile actions. It sits in tests/ because it needs the
  test database. It ends in .ts because it shows nothing on screen.
*/

import bcrypt from "bcryptjs";
// SignJWT: the same signing tool the app uses. Used to make a login that is "from before" a password change.
import { SignJWT } from "jose";
import { beforeEach, describe, expect, it } from "vitest";
import { POST as slipsPost } from "@/app/api/betslips/route";
import { changeEmail, changePassword, deleteAccount } from "@/app/actions/profile";
import { attemptLogin } from "@/lib/auth/loginAttempt";
import { getCurrentUser } from "@/lib/auth/dal";
import { passwordCheckKey } from "@/lib/auth/currentPassword";
import { EMPTY_PROFILE_FORM_STATE, type ProfileFormState } from "@/lib/auth/profileValidation";
import { INVITE_COOKIE_NAME, readSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/token";
import { AttemptCounterModel } from "@/lib/db/models/AttemptCounter";
import { BetSlipModel } from "@/lib/db/models/BetSlip";
import { InviteCodeModel } from "@/lib/db/models/InviteCode";
import { UserModel } from "@/lib/db/models/User";
import { TOO_MANY_ATTEMPTS_MESSAGE } from "@/lib/security/attempts";
import { cookieJar } from "./support/cookies";
import { createInviteCode, createTestUser, grantInviteAccess, logInAs, logOut, resetDatabase, type TestUser } from "./support/db";
import { jsonRequest, makePick } from "./support/factories";

/* formData: builds the form the browser would submit. */
function formData(fields: Record<string, string>): FormData {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) form.set(name, value);
  return form;
}

/* run: calls an action with a form. Gives back its state, or "REDIRECT:/where" if it redirected. */
async function run(
  action: (previous: ProfileFormState, form: FormData) => Promise<ProfileFormState>,
  fields: Record<string, string>,
): Promise<ProfileFormState | string> {
  try {
    return await action(EMPTY_PROFILE_FORM_STATE, formData(fields));
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("REDIRECT:")) return error.message;
    throw error;
  }
}

/* asState: narrows run()'s answer to a form state (fails the test if it was a redirect). */
function asState(result: ProfileFormState | string): ProfileFormState {
  if (typeof result === "string") throw new Error(`Expected a form state, got ${result}`);
  return result;
}

/* hashOf: the stored password hash for a user. */
async function hashOf(id: string): Promise<string> {
  const record = await UserModel.findById(id).select("+passwordHash").lean();
  return record?.passwordHash ?? "";
}

let me: TestUser;
let other: TestUser;

beforeEach(async () => {
  await resetDatabase();
  me = await createTestUser("me@example.com", "Sup3rSecret");
  other = await createTestUser("other@example.com", "Other0Secret");
  await logInAs(me);
});

describe("change email", () => {
  it("saves the new email (trimmed, lowercase) when the current password is right", async () => {
    const state = asState(await run(changeEmail, { newEmail: "  New.Me@Example.COM ", currentPassword: me.password }));
    expect(state.success).toBe("Email changed to new.me@example.com.");
    expect(state.fieldErrors).toEqual({});
    expect((await UserModel.findById(me.id).lean())?.email).toBe("new.me@example.com");
  });

  it("keeps the user logged in, and the new email is what the app now shows", async () => {
    await run(changeEmail, { newEmail: "new.me@example.com", currentPassword: me.password });
    expect((await getCurrentUser())?.email).toBe("new.me@example.com");
  });

  it("the new email works for logging in, the old one doesn't", async () => {
    await run(changeEmail, { newEmail: "new.me@example.com", currentPassword: me.password });
    expect((await attemptLogin("new.me@example.com", me.password)).ok).toBe(true);
    expect((await attemptLogin("me@example.com", me.password)).ok).toBe(false);
  });

  it("refuses a wrong current password, with a red message under that box and no change", async () => {
    const state = asState(await run(changeEmail, { newEmail: "new.me@example.com", currentPassword: "WrongPass1" }));
    expect(state.fieldErrors.currentPassword).toBe("That password isn't right.");
    expect(state.success).toBeNull();
    expect(state.newEmail).toBe("new.me@example.com"); // handed back so they needn't retype it
    expect((await UserModel.findById(me.id).lean())?.email).toBe("me@example.com");
  });

  it("refuses an email another account already uses, whatever its capital letters", async () => {
    for (const taken of ["other@example.com", "OTHER@Example.com", " other@example.com "]) {
      const state = asState(await run(changeEmail, { newEmail: taken, currentPassword: me.password }));
      expect(state.fieldErrors.newEmail).toBe("That email is already used by another account.");
    }
    expect((await UserModel.findById(me.id).lean())?.email).toBe("me@example.com");
    expect((await UserModel.findById(other.id).lean())?.email).toBe("other@example.com");
  });

  it("refuses the email the user already has", async () => {
    const state = asState(await run(changeEmail, { newEmail: "ME@example.com", currentPassword: me.password }));
    expect(state.fieldErrors.newEmail).toBe("That is already your email.");
  });

  it("refuses bad or missing input with red messages, changes nothing, and doesn't count as a password guess", async () => {
    const cases: Record<string, string>[] = [
      { newEmail: "", currentPassword: me.password },
      { newEmail: "not-an-email", currentPassword: me.password },
      { newEmail: "me@example.xyz", currentPassword: me.password }, // ending not on the list
      { newEmail: `${"a".repeat(250)}@example.com`, currentPassword: me.password },
      { newEmail: "new@example.com", currentPassword: "" },
      { newEmail: "new@example.com", currentPassword: "x".repeat(129) },
      {}, // boxes missing entirely
    ];
    for (const fields of cases) {
      const state = asState(await run(changeEmail, fields));
      expect(Object.keys(state.fieldErrors).length).toBeGreaterThan(0);
      expect(state.success).toBeNull();
    }
    expect((await UserModel.findById(me.id).lean())?.email).toBe("me@example.com");
    expect(await AttemptCounterModel.countDocuments()).toBe(0);
  });

  it("treats a non-text value (like a file) as an empty box", async () => {
    const form = new FormData();
    form.set("newEmail", new File(["x"], "x.txt"));
    form.set("currentPassword", me.password);
    const state = await changeEmail(EMPTY_PROFILE_FORM_STATE, form);
    expect(state.fieldErrors.newEmail).toBe("Enter your email.");
  });
});

describe("change password", () => {
  const good = { currentPassword: "Sup3rSecret", newPassword: "Brand9NewPass", confirmNewPassword: "Brand9NewPass" };

  it("saves the new password as a bcrypt hash, never as text", async () => {
    const state = asState(await run(changePassword, good));
    expect(state.success).toBe("Password changed. Your other devices have been logged out.");
    const hash = await hashOf(me.id);
    expect(hash).toMatch(/^\$2[aby]\$12\$/);
    expect(hash).not.toContain("Brand9NewPass");
    expect(await bcrypt.compare("Brand9NewPass", hash)).toBe(true);
  });

  it("the new password logs in; the old one no longer does", async () => {
    await run(changePassword, good);
    expect((await attemptLogin(me.email, "Brand9NewPass")).ok).toBe(true);
    expect((await attemptLogin(me.email, "Sup3rSecret")).ok).toBe(false);
  });

  it("keeps THIS device logged in (it gets a fresh cookie)", async () => {
    await run(changePassword, good);
    const after = cookieJar.get(SESSION_COOKIE_NAME)?.value;
    expect(after).toBeTruthy();
    expect(await readSessionToken(after)).toMatchObject({ userId: me.id });
    expect((await getCurrentUser())?.id).toBe(me.id);
  });

  it("logs OTHER devices out: a login made before the change stops working", async () => {
    // An older login (made a minute ago), like a phone or a stolen cookie.
    const oldToken = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(me.id)
      .setIssuedAt(Math.floor(Date.now() / 1000) - 60)
      .setExpirationTime("7d")
      .sign(new TextEncoder().encode(process.env.AUTH_SECRET));
    cookieJar.set(SESSION_COOKIE_NAME, oldToken);
    expect((await getCurrentUser())?.id).toBe(me.id); // works before the change

    await logInAs(me);
    await run(changePassword, good);
    expect((await UserModel.findById(me.id).lean())?.passwordChangedAt).toBeInstanceOf(Date);

    cookieJar.set(SESSION_COOKIE_NAME, oldToken);
    expect(await getCurrentUser()).toBeNull();
  });

  it("a password change does not log out a DIFFERENT user", async () => {
    await run(changePassword, good);
    await logInAs(other);
    expect((await getCurrentUser())?.id).toBe(other.id);
  });

  it("refuses a wrong current password and changes nothing", async () => {
    const before = await hashOf(me.id);
    const state = asState(await run(changePassword, { ...good, currentPassword: "WrongPass1" }));
    expect(state.fieldErrors.currentPassword).toBe("That password isn't right.");
    expect(await hashOf(me.id)).toBe(before);
    expect((await UserModel.findById(me.id).lean())?.passwordChangedAt).toBeNull();
  });

  it("refuses new passwords that break the sign-up rules, or don't match, or repeat the old one", async () => {
    const before = await hashOf(me.id);
    const bad: [Record<string, string>, string, string][] = [
      [{ ...good, newPassword: "short1", confirmNewPassword: "short1" }, "newPassword", "Use at least 8 characters."],
      [{ ...good, newPassword: "onlyletters", confirmNewPassword: "onlyletters" }, "newPassword", "Include at least one number."],
      [{ ...good, newPassword: "12345678", confirmNewPassword: "12345678" }, "newPassword", "Include at least one letter."],
      [{ ...good, newPassword: `a1${"b".repeat(80)}`, confirmNewPassword: `a1${"b".repeat(80)}` }, "newPassword", "Use 72 characters or fewer."],
      [{ ...good, confirmNewPassword: "Different9Pass" }, "confirmNewPassword", "The passwords don't match."],
      [{ ...good, newPassword: "Sup3rSecret", confirmNewPassword: "Sup3rSecret" }, "newPassword", "Choose a password different from your current one."],
      [{ ...good, newPassword: "" }, "newPassword", "Use at least 8 characters."],
    ];
    for (const [fields, box, message] of bad) {
      const state = asState(await run(changePassword, fields));
      expect(state.fieldErrors[box as keyof typeof state.fieldErrors]).toBe(message);
      expect(state.success).toBeNull();
    }
    expect(await hashOf(me.id)).toBe(before);
    expect(await AttemptCounterModel.countDocuments()).toBe(0);
  });
});

describe("delete account", () => {
  /* makeSlips: gives the logged-in user (and then `other`) a slip each. */
  async function makeSlipFor(user: TestUser, name: string): Promise<void> {
    await logInAs(user);
    const response = await slipsPost(jsonRequest("POST", "/api/betslips", { name, picks: [makePick()], setActive: true }));
    expect(response.status).toBe(201);
  }

  beforeEach(async () => {
    await makeSlipFor(other, "Other's slip");
    await makeSlipFor(me, "My first slip");
    await makeSlipFor(me, "My second slip");
    await logInAs(me);
    await grantInviteAccess(await createInviteCode());
  });

  const good = { confirmText: "DELETE", currentPassword: "Sup3rSecret" };

  it("erases the user and ALL their slips, but nobody else's", async () => {
    expect(await run(deleteAccount, good)).toBe("REDIRECT:/invite");
    expect(await UserModel.findById(me.id).lean()).toBeNull();
    expect(await BetSlipModel.countDocuments({ userId: me.id })).toBe(0);
    // The other user and their slip are untouched.
    expect((await UserModel.findById(other.id).lean())?.email).toBe("other@example.com");
    expect(await BetSlipModel.countDocuments({ userId: other.id })).toBe(1);
  });

  it("clears the login cookie AND the invite cookie, so the visitor lands on the invite page", async () => {
    await run(deleteAccount, good);
    expect(cookieJar.get(SESSION_COOKIE_NAME)).toBeUndefined();
    expect(cookieJar.get(INVITE_COOKIE_NAME)).toBeUndefined();
  });

  it("the deleted account can't log in, and its old cookie no longer counts", async () => {
    const oldCookie = cookieJar.get(SESSION_COOKIE_NAME)?.value;
    await run(deleteAccount, good);
    expect(await attemptLogin(me.email, me.password)).toEqual({ ok: false, reason: "invalid" });
    cookieJar.set(SESSION_COOKIE_NAME, oldCookie ?? "");
    expect(await getCurrentUser()).toBeNull();
  });

  it("does not hand the invite code's use back", async () => {
    const invite = await createInviteCode({ usedCount: 3 });
    await UserModel.updateOne({ _id: me.id }, { inviteCodeId: invite._id });
    await run(deleteAccount, good);
    expect((await InviteCodeModel.findById(invite._id).lean())?.usedCount).toBe(3);
  });

  it("refuses without exactly DELETE (capital letters), and deletes nothing", async () => {
    for (const confirmText of ["", "delete", "Delete", "DELETE ", "DELET", "yes"]) {
      const state = asState(await run(deleteAccount, { ...good, confirmText }));
      expect(state.fieldErrors.confirmText).toBe("Type DELETE in capital letters to confirm.");
    }
    expect(await UserModel.findById(me.id).lean()).not.toBeNull();
    expect(await BetSlipModel.countDocuments({ userId: me.id })).toBe(2);
    expect(await AttemptCounterModel.countDocuments()).toBe(0);
  });

  it("refuses a wrong password, and deletes nothing", async () => {
    const state = asState(await run(deleteAccount, { ...good, currentPassword: "WrongPass1" }));
    expect(state.fieldErrors.currentPassword).toBe("That password isn't right.");
    expect(await UserModel.findById(me.id).lean()).not.toBeNull();
    expect(await BetSlipModel.countDocuments({ userId: me.id })).toBe(2);
    expect(cookieJar.get(SESSION_COOKIE_NAME)).toBeDefined();
  });
});

describe("safety: logged out, someone else's account, guessing, and leaks", () => {
  it("a logged-out visitor is sent to /login by every action, and nothing changes", async () => {
    logOut();
    expect(await run(changeEmail, { newEmail: "x@example.com", currentPassword: "Sup3rSecret" })).toBe("REDIRECT:/login");
    expect(await run(changePassword, { currentPassword: "Sup3rSecret", newPassword: "Brand9NewPass", confirmNewPassword: "Brand9NewPass" })).toBe("REDIRECT:/login");
    expect(await run(deleteAccount, { confirmText: "DELETE", currentPassword: "Sup3rSecret" })).toBe("REDIRECT:/login");
    expect(await UserModel.countDocuments()).toBe(2);
    expect((await UserModel.findById(me.id).lean())?.email).toBe("me@example.com");
  });

  it("a tampered login cookie is treated as logged out", async () => {
    cookieJar.set(SESSION_COOKIE_NAME, `${cookieJar.get(SESSION_COOKIE_NAME)?.value}x`);
    expect(await run(deleteAccount, { confirmText: "DELETE", currentPassword: "Sup3rSecret" })).toBe("REDIRECT:/login");
    expect(await UserModel.countDocuments()).toBe(2);
  });

  it("user B can never change user A's account, even by adding A's ID and email to the form", async () => {
    await logInAs(other);
    const forged = { userId: me.id, id: me.id, _id: me.id, email: me.email };

    // B uses B's OWN password; A's details in the form are ignored, so only B's account changes.
    await run(changeEmail, { ...forged, newEmail: "b.new@example.com", currentPassword: other.password });
    expect((await UserModel.findById(me.id).lean())?.email).toBe("me@example.com");
    expect((await UserModel.findById(other.id).lean())?.email).toBe("b.new@example.com");

    // B trying with A's password fails: the password is checked against B's account.
    const state = asState(await run(changeEmail, { ...forged, newEmail: "c@example.com", currentPassword: me.password }));
    expect(state.fieldErrors.currentPassword).toBe("That password isn't right.");

    const hashA = await hashOf(me.id);
    await run(changePassword, { ...forged, currentPassword: other.password, newPassword: "Brand9NewPass", confirmNewPassword: "Brand9NewPass" });
    expect(await hashOf(me.id)).toBe(hashA);
    expect(await bcrypt.compare("Brand9NewPass", await hashOf(other.id))).toBe(true);

    await run(deleteAccount, { ...forged, confirmText: "DELETE", currentPassword: "Brand9NewPass" });
    expect(await UserModel.findById(me.id).lean()).not.toBeNull(); // A survives
    expect(await UserModel.findById(other.id).lean()).toBeNull(); // only B's own account went
  });

  it("guessing the password is limited: 5 wrong answers, then even the right one is refused", async () => {
    for (let i = 0; i < 5; i += 1) {
      const state = asState(await run(changeEmail, { newEmail: "new@example.com", currentPassword: "WrongPass1" }));
      expect(state.fieldErrors.currentPassword).toBe("That password isn't right.");
    }
    // All three actions share the one counter.
    const email = asState(await run(changeEmail, { newEmail: "new@example.com", currentPassword: me.password }));
    expect(email.message).toBe(TOO_MANY_ATTEMPTS_MESSAGE);
    const password = asState(await run(changePassword, { currentPassword: me.password, newPassword: "Brand9NewPass", confirmNewPassword: "Brand9NewPass" }));
    expect(password.message).toBe(TOO_MANY_ATTEMPTS_MESSAGE);
    const deletion = asState(await run(deleteAccount, { confirmText: "DELETE", currentPassword: me.password }));
    expect(deletion.message).toBe(TOO_MANY_ATTEMPTS_MESSAGE);
    expect(await UserModel.findById(me.id).lean()).not.toBeNull();
    expect((await UserModel.findById(me.id).lean())?.email).toBe("me@example.com");
  });

  it("a right password wipes the wrong-answer count", async () => {
    for (let i = 0; i < 4; i += 1) await run(changeEmail, { newEmail: "new@example.com", currentPassword: "WrongPass1" });
    await run(changeEmail, { newEmail: "new@example.com", currentPassword: me.password });
    expect(await AttemptCounterModel.findOne({ key: passwordCheckKey(me.id) }).lean()).toBeNull();
  });

  it("simultaneous password guesses can't sneak past the limit", async () => {
    const results = await Promise.all(
      Array.from({ length: 12 }, () => run(changeEmail, { newEmail: "new@example.com", currentPassword: "WrongPass1" })),
    );
    const checked = results.filter((r) => typeof r !== "string" && r.fieldErrors.currentPassword).length;
    const locked = results.filter((r) => typeof r !== "string" && r.message === TOO_MANY_ATTEMPTS_MESSAGE).length;
    expect(checked).toBe(5);
    expect(locked).toBe(7);
  });

  it("keeps the wrong-answer counter by a scrambled key, not the user ID", async () => {
    await run(changeEmail, { newEmail: "new@example.com", currentPassword: "WrongPass1" });
    const record = await AttemptCounterModel.findOne({ key: /^profile-password:/ }).lean();
    expect(record?.key).toMatch(/^profile-password:[0-9a-f]{64}$/);
    expect(record?.key).not.toContain(me.id);
  });

  it("never sends back a password or a hash, in success or in failure", async () => {
    const answers = [
      await run(changeEmail, { newEmail: "new@example.com", currentPassword: me.password }),
      await run(changeEmail, { newEmail: "x@example.com", currentPassword: "WrongPass1" }),
      await run(changePassword, { currentPassword: me.password, newPassword: "Brand9NewPass", confirmNewPassword: "Brand9NewPass" }),
      await run(changePassword, { currentPassword: "WrongPass1", newPassword: "Another9Pass", confirmNewPassword: "Another9Pass" }),
    ];
    const text = JSON.stringify(answers);
    for (const secret of [me.password, "Brand9NewPass", "Another9Pass", "WrongPass1"]) expect(text).not.toContain(secret);
    expect(text).not.toMatch(/\$2[aby]\$|passwordHash/);
  });
});
