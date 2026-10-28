/*
  FILE: components/profile/SuccessMessage.tsx
  WHAT IT'S FOR: A green "it worked" box with a check mark, like "Email changed to you@example.com."
  It is the happy twin of the red ErrorMessage. role="status" makes screen readers
  read it out politely when it appears.
  WHO USES IT: components/profile/ChangeEmailForm.tsx and ChangePasswordForm.tsx.
  WHY THIS NAME: It shows a success message. It ends in .tsx because it shows something on screen.
*/

import type { ReactNode } from "react";

/* SuccessMessage: the green box. `children` is the message text. */
export default function SuccessMessage({ children }: { children: ReactNode }) {
  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-xl border-2 border-money bg-money/15 px-4 py-3 text-sm font-semibold text-money"
    >
      <svg aria-hidden viewBox="0 0 24 24" className="size-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="m5 12.5 4.5 4.5L19 7.5" />
      </svg>
      <div className="min-w-0 pt-px">{children}</div>
    </div>
  );
}
