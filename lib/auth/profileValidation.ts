/*
  FILE: lib/auth/profileValidation.ts
  WHAT IT'S FOR: The rules for the three Profile page forms (change email,
  change password, delete account) and the shape of the answer a Profile action
  sends back to its form. The server checks every form with these. It never
  trusts the browser. The email and new-password rules are the SAME ones sign up
  uses (lib/auth/validation.ts), so a password that works at sign up works here.
  WHO USES IT: app/actions/profile.ts (the Server Actions) and the forms in
  components/profile (for the state type and starting state).
  WHY THIS NAME: It's the validation (checking) for the Profile page. It ends in
  .ts because it shows nothing on screen. It has no secrets, so forms can use it.
*/

import { z } from "zod";
import { emailRule, newPasswordRule } from "./validation";

/* The words the user must type to delete their account. */
export const DELETE_CONFIRM_WORD = "DELETE";

/*
  currentPasswordRule: the "current password" box must be filled in. No password
  rules apply here (a wrong one just gets "That password isn't right."), and the
  128-character cap stops a giant paste from reaching the hashing code.
*/
const currentPasswordRule = z
  .string()
  .min(1, { error: "Enter your current password." })
  .max(128, { error: "That password is too long." });

/* changeEmailSchema: the new email (same rules as sign up) plus the current password. */
export const changeEmailSchema = z.object({
  newEmail: emailRule,
  currentPassword: currentPasswordRule,
});

/*
  changePasswordSchema: current password, new password (same rules as sign up),
  and the new password typed again. Two extra checks give red messages on the right box:
  - the two new passwords must match
  - the new password must differ from the current one
*/
export const changePasswordSchema = z
  .object({
    currentPassword: currentPasswordRule,
    newPassword: newPasswordRule,
    confirmNewPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    error: "The passwords don't match.",
    path: ["confirmNewPassword"],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    error: "Choose a password different from your current one.",
    path: ["newPassword"],
  });

/*
  deleteAccountSchema: the person must type DELETE exactly (capital letters) AND their
  password. Typing DELETE stops accidents. The password stops someone who
  grabbed a logged-in phone or a stolen cookie.
*/
export const deleteAccountSchema = z.object({
  confirmText: z.literal(DELETE_CONFIRM_WORD, { error: `Type ${DELETE_CONFIRM_WORD} in capital letters to confirm.` }),
  currentPassword: currentPasswordRule,
});

/** The form boxes that can show a red message under them. */
export type ProfileField = "newEmail" | "currentPassword" | "newPassword" | "confirmNewPassword" | "confirmText";

/*
  ProfileFormState: what a Profile action sends back to its form.
  - message: a red message for the whole form (like "Too many attempts"), or null for none (missing on purpose).
  - success: a green "Saved" message, or null for none (missing on purpose).
  - fieldErrors: a red message under each box that has a problem.
  - newEmail: what was typed in the email box, so it doesn't have to be typed again. We
    NEVER send a password back.
*/
export type ProfileFormState = {
  message: string | null;
  success: string | null;
  fieldErrors: Partial<Record<ProfileField, string>>;
  newEmail: string;
};

/** The starting state before a form has been sent: nothing to show. */
export const EMPTY_PROFILE_FORM_STATE: ProfileFormState = {
  message: null,
  success: null,
  fieldErrors: {},
  newEmail: "",
};

/* PROFILE_FIELDS: every box name, in order, so firstProfileFieldErrors can look at each. */
const PROFILE_FIELDS: readonly ProfileField[] = ["newEmail", "currentPassword", "newPassword", "confirmNewPassword", "confirmText"];

/* firstProfileFieldErrors: zod can find several problems per box. We show only the first under each box. */
export function firstProfileFieldErrors(error: z.ZodError): Partial<Record<ProfileField, string>> {
  const all = z.flattenError(error).fieldErrors as Partial<Record<string, string[]>>;
  const result: Partial<Record<ProfileField, string>> = {};
  for (const field of PROFILE_FIELDS) {
    const first = all[field]?.[0];
    if (first) result[field] = first;
  }
  return result;
}
