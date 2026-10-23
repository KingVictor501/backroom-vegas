/*
  FILE: components/auth/SignupForm.tsx
  WHAT IT'S FOR: The sign up form (email, password, confirm password, Create
  account button). It sends the form to the signup Server Action and shows any
  error it sends back.
  WHO USES IT: app/(auth)/signup/page.tsx.
  WHY THIS NAME: It's the form for signing up. It ends in .tsx because it shows
  something on screen.
*/

// "use client": runs in the browser too, for the "Creating account…" state and
// error messages that update without reloading the page.
"use client";

import { useActionState } from "react";
// The signup Server Action from app/actions/auth.ts. It runs on the server.
import { signup } from "@/app/actions/auth";
// The empty starting state and the password rules text, from lib/auth/validation.ts.
import {
  EMPTY_AUTH_FORM_STATE,
  PASSWORD_RULES_TEXT,
} from "@/lib/auth/validation";
// The shared labeled text box from the file next to this one.
import AuthField from "./AuthField";
// The red error box from components/ErrorMessage.tsx.
import ErrorMessage from "@/components/ErrorMessage";

/*
  SignupForm: the form itself. Works the same way as LoginForm (see that file for how useActionState works).
  - next: the page to go to after signing up.
*/
export default function SignupForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(
    signup,
    EMPTY_AUTH_FORM_STATE,
  );

  return (
    <form action={formAction} noValidate className="space-y-5">
      <input type="hidden" name="next" value={next} />

      {state.message && (
        <ErrorMessage>{state.message}</ErrorMessage>
      )}

      <AuthField
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        defaultValue={state.email}
        error={state.fieldErrors.email}
      />
      {/* autoComplete="new-password" tells password managers to offer to create and save a new password. */}
      <AuthField
        name="password"
        label="Password"
        type="password"
        autoComplete="new-password"
        hint={PASSWORD_RULES_TEXT}
        error={state.fieldErrors.password}
      />
      <AuthField
        name="confirmPassword"
        label="Confirm password"
        type="password"
        autoComplete="new-password"
        error={state.fieldErrors.confirmPassword}
      />

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-gold px-6 py-3 font-semibold text-bg transition-colors hover:bg-gold-bright disabled:cursor-wait disabled:opacity-70"
      >
        {pending ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
