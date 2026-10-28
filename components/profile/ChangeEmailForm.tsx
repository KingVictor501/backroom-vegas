/*
  FILE: components/profile/ChangeEmailForm.tsx
  WHAT IT'S FOR: The "Change email" form on the Profile page: a new email box, a
  current password box, and a button. It sends the form to the changeEmail Server
  Action and shows its answer: a green "Email changed" box, or red messages.
  WHO USES IT: app/(main)/profile/page.tsx.
  WHY THIS NAME: It's the form for changing the email. It ends in .tsx because it
  shows something on screen.
*/

// "use client": runs in the browser too, for the "Saving…" state and messages that update without reloading.
"use client";

import { useActionState } from "react";
import { changeEmail } from "@/app/actions/profile";
import AuthField from "@/components/auth/AuthField";
import ErrorMessage from "@/components/ErrorMessage";
import { EMPTY_PROFILE_FORM_STATE } from "@/lib/auth/profileValidation";
import SuccessMessage from "./SuccessMessage";

/*
  ChangeEmailForm: works like LoginForm (see that file for how useActionState works).
  noValidate turns off the browser's own pop-up bubbles, so every mistake shows
  in our red messages instead.
*/
export default function ChangeEmailForm() {
  const [state, formAction, pending] = useActionState(changeEmail, EMPTY_PROFILE_FORM_STATE);

  return (
    <form action={formAction} noValidate className="space-y-5">
      {state.message && <ErrorMessage>{state.message}</ErrorMessage>}
      {state.success && <SuccessMessage>{state.success}</SuccessMessage>}
      <AuthField
        name="newEmail"
        label="New email"
        type="email"
        autoComplete="email"
        defaultValue={state.newEmail}
        error={state.fieldErrors.newEmail}
      />
      <AuthField
        name="currentPassword"
        label="Current password"
        type="password"
        autoComplete="current-password"
        error={state.fieldErrors.currentPassword}
      />
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-gold px-6 py-3 font-semibold text-bg transition-colors hover:bg-gold-bright disabled:cursor-wait disabled:opacity-70 sm:w-auto"
      >
        {pending ? "Saving…" : "Change email"}
      </button>
    </form>
  );
}
