/*
  FILE: components/profile/ChangePasswordForm.tsx
  WHAT IT'S FOR: The "Change password" form on the Profile page: current password,
  new password, the new password again, and a button. It sends the form to the
  changePassword Server Action and shows a green "Password changed" box or red messages.
  WHO USES IT: app/(main)/profile/page.tsx.
  WHY THIS NAME: It's the form for changing the password. It ends in .tsx because it
  shows something on screen.
*/

// "use client": runs in the browser too, for the "Saving…" state and messages that update without reloading.
"use client";

import { useActionState } from "react";
import { changePassword } from "@/app/actions/profile";
import AuthField from "@/components/auth/AuthField";
import ErrorMessage from "@/components/ErrorMessage";
import { EMPTY_PROFILE_FORM_STATE } from "@/lib/auth/profileValidation";
import { PASSWORD_RULES_TEXT } from "@/lib/auth/validation";
import SuccessMessage from "./SuccessMessage";

/* ChangePasswordForm: see ChangeEmailForm for how the pieces work. */
export default function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePassword, EMPTY_PROFILE_FORM_STATE);

  return (
    <form action={formAction} noValidate className="space-y-5">
      {state.message && <ErrorMessage>{state.message}</ErrorMessage>}
      {state.success && <SuccessMessage>{state.success}</SuccessMessage>}
      <AuthField
        name="currentPassword"
        label="Current password"
        type="password"
        autoComplete="current-password"
        error={state.fieldErrors.currentPassword}
      />
      {/* autoComplete="new-password" tells password managers to offer to save the new password. */}
      <AuthField
        name="newPassword"
        label="New password"
        type="password"
        autoComplete="new-password"
        hint={PASSWORD_RULES_TEXT}
        error={state.fieldErrors.newPassword}
      />
      <AuthField
        name="confirmNewPassword"
        label="Confirm new password"
        type="password"
        autoComplete="new-password"
        error={state.fieldErrors.confirmNewPassword}
      />
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-gold px-6 py-3 font-semibold text-bg transition-colors hover:bg-gold-bright disabled:cursor-wait disabled:opacity-70 sm:w-auto"
      >
        {pending ? "Saving…" : "Change password"}
      </button>
    </form>
  );
}
