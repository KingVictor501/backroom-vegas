/*
  FILE: components/profile/DeleteAccountDialog.tsx
  WHAT IT'S FOR: The "Delete account" button and its confirmation popup. The popup
  explains what will be erased, then asks the user to type DELETE and their
  password. On success the Server Action logs them out and sends them to the invite page.
  ACCESSIBILITY: it uses the browser's built-in <dialog> popup (opened with showModal).
  The browser itself then keeps the keyboard focus inside the popup, closes it
  with the Esc key, and hides the page behind it from screen readers. Clicking the dark area
  outside the popup, or Cancel, also closes it.
  WHO USES IT: app/(main)/profile/page.tsx.
  WHY THIS NAME: It's the dialog (popup) for deleting an account. It ends in .tsx because
  it shows something on screen.
*/

// "use client": it needs the browser to open and close the popup and to show messages.
"use client";

import { useActionState, useRef } from "react";
import { deleteAccount } from "@/app/actions/profile";
import AuthField from "@/components/auth/AuthField";
import ErrorMessage from "@/components/ErrorMessage";
import { DELETE_CONFIRM_WORD, EMPTY_PROFILE_FORM_STATE } from "@/lib/auth/profileValidation";

/*
  DeleteAccountDialog: the red button plus the popup.
  - dialogRef points at the <dialog> element so the buttons can open and close it.
  - The form is INSIDE the popup, so pressing Enter submits it like any form.
*/
export default function DeleteAccountDialog() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, formAction, pending] = useActionState(deleteAccount, EMPTY_PROFILE_FORM_STATE);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="rounded-full border-2 border-danger px-6 py-2.5 font-semibold text-danger transition-colors hover:bg-danger hover:text-bg"
      >
        Delete account…
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby="delete-heading"
        // Clicking the dark backdrop (which counts as clicking the dialog itself) closes it.
        onClick={(event) => {
          if (event.target === dialogRef.current) dialogRef.current?.close();
        }}
        className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-2xl border border-line bg-card p-5 text-text backdrop:bg-black/70"
      >
        <h2 id="delete-heading" className="text-xl text-danger">
          Delete your account?
        </h2>
        <p className="mt-2 text-sm text-muted">
          This permanently erases your account and <strong className="text-text">all of your bet slips</strong>. It
          cannot be undone.
        </p>

        <form action={formAction} noValidate className="mt-4 space-y-5">
          {state.message && <ErrorMessage>{state.message}</ErrorMessage>}
          <AuthField
            name="confirmText"
            label={`Type ${DELETE_CONFIRM_WORD} to confirm`}
            type="text"
            autoComplete="off"
            placeholder={DELETE_CONFIRM_WORD}
            maxLength={20}
            error={state.fieldErrors.confirmText}
          />
          <AuthField
            name="currentPassword"
            label="Your password"
            type="password"
            autoComplete="current-password"
            error={state.fieldErrors.currentPassword}
          />
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="rounded-full border border-line px-6 py-3 font-semibold text-text transition-colors hover:border-gold hover:text-gold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-full bg-danger px-6 py-3 font-semibold text-bg transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-70"
            >
              {pending ? "Deleting…" : "Delete my account"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
