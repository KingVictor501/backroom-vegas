/*
  FILE: components/auth/LoginForm.tsx
  WHAT IT'S FOR: The login form (email, password, Log in button). It sends the
  form to the login Server Action and shows any error it sends back.
  WHO USES IT: app/(auth)/login/page.tsx.
  WHY THIS NAME: It's the form for logging in. It ends in .tsx because it shows
  something on screen.
*/

// "use client": this form runs in the browser too, because it shows
// "Logging in…" while waiting and updates the error messages without reloading the page.
"use client";

import { useActionState } from "react";
// The login Server Action from app/actions/auth.ts. It runs on the server even though this form is in the browser.
import { login } from "@/app/actions/auth";
// The shared form state type and its empty starting value, from lib/auth/validation.ts.
import { EMPTY_AUTH_FORM_STATE } from "@/lib/auth/validation";
// The shared labeled text box from the file next to this one.
import AuthField from "./AuthField";
// The red error box from components/ErrorMessage.tsx.
import ErrorMessage from "@/components/ErrorMessage";

/*
  LoginForm: the form itself.
  - next: the page to go to after logging in (from ?next= in the address).
  useActionState connects the form to the Server Action:
  - state: the last answer from the server (errors and the typed email)
  - formAction: what the form calls when submitted
  - pending: true while waiting for the server (we disable the button so it can't be clicked twice)
  Without JavaScript, the form still works: the browser just reloads the page with the result.
*/
export default function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(
    login,
    EMPTY_AUTH_FORM_STATE,
  );

  return (
    <form action={formAction} noValidate className="space-y-5">
      {/* A hidden box carrying where to go after login. The server checks it's a safe path. */}
      <input type="hidden" name="next" value={next} />

      {/* role="alert" makes screen readers announce the error as soon as it appears. */}
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
        // A wrong email or password turns BOTH boxes red. (We never say which one was wrong, for security.)
        invalid={Boolean(state.message)}
      />
      <AuthField
        name="password"
        label="Password"
        type="password"
        autoComplete="current-password"
        error={state.fieldErrors.password}
        invalid={Boolean(state.message)}
      />

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-gold px-6 py-3 font-semibold text-bg transition-colors hover:bg-gold-bright disabled:cursor-wait disabled:opacity-70"
      >
        {pending ? "Logging in…" : "Log in"}
      </button>
    </form>
  );
}
