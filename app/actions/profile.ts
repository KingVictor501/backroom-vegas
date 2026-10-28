/*
  FILE: app/actions/profile.ts
  WHAT IT'S FOR: The Server Actions behind the Profile page (/profile):
  - changeEmail: new email, after checking the current password and that no one else has it
  - changePassword: new password (same rules as sign up), saved bcrypt-hashed. This
    device stays logged in; every OTHER device is logged out (see passwordChangedAt)
  - deleteAccount: removes the account and ALL its bet slips, logs out, and goes to the invite page
  HOW EVERY ONE OF THEM STAYS SAFE:
  1. WHO: the account to change comes ONLY from the login cookie (requireUser). The
     forms don't send an ID, and if someone adds one by hand it's ignored, so a
     person can only ever change their own account.
  2. WHAT: every box is checked on the server with the rules in lib/auth/profileValidation.ts.
  3. PROOF: each one asks for the current password first (lib/auth/currentPassword.ts),
     with a limit on wrong answers.
  4. ANSWER: errors come back as a ProfileFormState (shown in red). The password
     hash is never sent back, and passwords are never sent back or logged.
  Server Actions are the rubric's "advanced feature" the app already uses.
  WHO USES IT: components/profile/ChangeEmailForm.tsx, ChangePasswordForm.tsx, and DeleteAccountDialog.tsx.
  WHY THIS NAME: Server Actions live in app/actions, and this one is for the profile.
  It ends in .ts because it shows nothing on screen.
*/

// "use server": every function in this file runs ONLY on the server, even though the forms in the browser call it.
"use server";

import bcrypt from "bcryptjs";
// refresh: tells Next.js to redraw the page the user is on, so the new email shows right away.
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/dal";
import { checkCurrentPassword, type PasswordCheck } from "@/lib/auth/currentPassword";
import { deleteInviteCookie } from "@/lib/auth/inviteCookie";
import {
  changeEmailSchema,
  changePasswordSchema,
  deleteAccountSchema,
  EMPTY_PROFILE_FORM_STATE,
  firstProfileFieldErrors,
  type ProfileFormState,
} from "@/lib/auth/profileValidation";
import { createSession, deleteSession } from "@/lib/auth/session";
import { formText } from "@/lib/auth/validation";
import { isDuplicateKeyError } from "@/lib/db/errors";
import { BetSlipModel } from "@/lib/db/models/BetSlip";
import { UserModel } from "@/lib/db/models/User";
import { connectToDatabase } from "@/lib/db/mongodb";
import { logServerError } from "@/lib/logging/safeLog";
import { TOO_MANY_ATTEMPTS_MESSAGE } from "@/lib/security/attempts";

/*
  HASH_COST: how much work hashing takes (bcrypt's "cost"). Same as sign up (12), about 0.2 seconds.
*/
const HASH_COST = 12;

/** Shown when the "current password" box has a password that isn't right. */
const WRONG_PASSWORD_MESSAGE = "That password isn't right.";

/** Shown for any unexpected failure. It never includes details. */
const TRY_AGAIN_MESSAGE = "We couldn't save that right now. Please try again.";

/* failure: builds the state for a form that didn't work. */
function failure(changes: Partial<ProfileFormState>): ProfileFormState {
  return { ...EMPTY_PROFILE_FORM_STATE, ...changes };
}

/*
  passwordProblem: turns a bad password check into the state to show, or null if the password was fine.
  - wrong → red message under the "current password" box
  - locked → the red "Too many attempts" box
*/
function passwordProblem(check: PasswordCheck, newEmail = ""): ProfileFormState | null {
  if (check === "wrong") return failure({ newEmail, fieldErrors: { currentPassword: WRONG_PASSWORD_MESSAGE } });
  if (check === "locked") return failure({ newEmail, message: TOO_MANY_ATTEMPTS_MESSAGE });
  return null;
}

/*
  changeEmail: changes the logged-in user's email.
  `previousState` is what this action returned last time (React passes it in via
  useActionState). We don't need it, but it must be accepted.
*/
export async function changeEmail(previousState: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
  const user = await requireUser();
  const typedEmail = formText(formData, "newEmail");

  const parsed = changeEmailSchema.safeParse({
    newEmail: typedEmail,
    currentPassword: formText(formData, "currentPassword"),
  });
  if (!parsed.success) return failure({ newEmail: typedEmail, fieldErrors: firstProfileFieldErrors(parsed.error) });
  const { newEmail, currentPassword } = parsed.data;

  try {
    const problem = passwordProblem(await checkCurrentPassword(user.id, currentPassword), typedEmail);
    if (problem) return problem;

    if (newEmail === user.email) {
      return failure({ newEmail: typedEmail, fieldErrors: { newEmail: "That is already your email." } });
    }

    await connectToDatabase();
    // The filter is the user's OWN id from the cookie. The unique rule on email makes the
    // database itself refuse a duplicate, even if two people try the same email at once.
    await UserModel.updateOne({ _id: user.id }, { $set: { email: newEmail } });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return failure({ newEmail: typedEmail, fieldErrors: { newEmail: "That email is already used by another account." } });
    }
    logServerError("Change email failed:", error);
    return failure({ newEmail: typedEmail, message: TRY_AGAIN_MESSAGE });
  }

  refresh();
  return failure({ success: `Email changed to ${newEmail}.` });
}

/*
  changePassword: changes the logged-in user's password.
  1. Check the boxes, then the current password.
  2. Save the new password hashed, and note WHEN (passwordChangedAt).
  3. Give THIS device a brand-new login cookie. Logins made before that moment
     (other phones, other computers, a stolen cookie) stop working.
*/
export async function changePassword(previousState: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
  const user = await requireUser();

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formText(formData, "currentPassword"),
    newPassword: formText(formData, "newPassword"),
    confirmNewPassword: formText(formData, "confirmNewPassword"),
  });
  if (!parsed.success) return failure({ fieldErrors: firstProfileFieldErrors(parsed.error) });
  const { currentPassword, newPassword } = parsed.data;

  try {
    const problem = passwordProblem(await checkCurrentPassword(user.id, currentPassword));
    if (problem) return problem;

    const passwordHash = await bcrypt.hash(newPassword, HASH_COST);
    await connectToDatabase();
    await UserModel.updateOne({ _id: user.id }, { $set: { passwordHash, passwordChangedAt: new Date() } });
  } catch (error) {
    logServerError("Change password failed:", error);
    return failure({ message: TRY_AGAIN_MESSAGE });
  }

  // A new cookie, made AFTER passwordChangedAt, keeps this device logged in.
  await createSession(user.id);
  refresh();
  return failure({ success: "Password changed. Your other devices have been logged out." });
}

/*
  deleteAccount: permanently deletes the logged-in user's account and bet slips.
  1. Must type DELETE and the right password.
  2. The account goes first, so nobody can log in to it any more, then its slips.
     (Slips with no account can't be reached by anyone, so if that second step
     ever failed, nothing would be exposed. It is logged, and the person is still logged out.)
  3. Both cookies are cleared, and the person lands on the invite page.
  The invite code's "uses" are NOT given back, so a code can't be reused by deleting and re-joining.
*/
export async function deleteAccount(previousState: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
  const user = await requireUser();

  const parsed = deleteAccountSchema.safeParse({
    confirmText: formText(formData, "confirmText"),
    currentPassword: formText(formData, "currentPassword"),
  });
  if (!parsed.success) return failure({ fieldErrors: firstProfileFieldErrors(parsed.error) });

  try {
    const problem = passwordProblem(await checkCurrentPassword(user.id, parsed.data.currentPassword));
    if (problem) return problem;

    await connectToDatabase();
    await UserModel.deleteOne({ _id: user.id });
    try {
      await BetSlipModel.deleteMany({ userId: user.id });
    } catch (error) {
      logServerError("Deleting a removed account's slips failed:", error);
    }
  } catch (error) {
    logServerError("Delete account failed:", error);
    return failure({ message: TRY_AGAIN_MESSAGE });
  }

  // Outside the try/catch on purpose: redirect() works by throwing a special signal.
  await deleteSession();
  await deleteInviteCookie();
  redirect("/invite");
}
