/*
  FILE: components/auth/InviteForm.tsx
  WHAT IT'S FOR: The invite code form (one box and a Continue button). It sends
  the form to the invite Server Action and shows any error it sends back, in the
  loud red box, with the code box turned red too.
  WHO USES IT: app/(auth)/invite/page.tsx.
  WHY THIS NAME: It's the form for the invite code. It ends in .tsx because it
  shows something on screen.
*/

// "use client": this form reacts to the server's answer in the browser (useActionState needs it).
"use client";

import { useActionState } from "react";
import { enterInviteCode } from "@/app/actions/invite";
import { EMPTY_INVITE_FORM_STATE } from "@/lib/invite/format";
import AuthField from "./AuthField";
import ErrorMessage from "@/components/ErrorMessage";

/*
  InviteForm: the form itself.
  - next: the page to go to after logging in (from ?next= in the address; the server re-checks it's safe).
  useActionState connects the form to the Server Action (see LoginForm.tsx for the full explanation):
  state = the last answer, formAction = what the form calls, pending = waiting for the server.
  Without JavaScript the form still works: the browser reloads the page with the result.
*/
export default function InviteForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(enterInviteCode, EMPTY_INVITE_FORM_STATE);

  return (
    <form action={formAction} noValidate className="space-y-5">
      {/* A hidden box carrying where to go after login. The server checks it's a safe path. */}
      <input type="hidden" name="next" value={next} />

      {/* role="alert" (inside ErrorMessage) makes screen readers announce the error as soon as it appears. */}
      {state.message && <ErrorMessage>{state.message}</ErrorMessage>}

      <AuthField
        name="code"
        label="Invite code"
        type="text"
        autoComplete="off"
        placeholder="BRV-XXXX-XXXX"
        maxLength={20}
        defaultValue={state.code}
        invalid={Boolean(state.message)}
      />

      <button
        type="submit"
        disabled={pending}
        className="min-h-12 w-full rounded-full bg-gold px-6 py-3 font-semibold text-bg transition-colors hover:bg-gold-bright disabled:cursor-wait disabled:opacity-70"
      >
        {pending ? "Checking…" : "Continue"}
      </button>
    </form>
  );
}
