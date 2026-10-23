/*
  FILE: components/ErrorMessage.tsx
  WHAT IT'S FOR: The one red look for "you made a mistake" messages, so users
  can't miss them: a warning icon, bold red text, a solid red border, and a red
  tint. Two sizes:
  - ErrorMessage: a box, like "Invalid email or password." above a form
  - FieldError: one line under a text box, like "Enter a valid email."
  - WarningIcon: the ⚠ triangle on its own, for other red messages
  WHO USES IT: the login and sign up forms, the search bar, the Feed's game
  filter, the "not found" pages, and the bet slip's error messages.
  WHY THIS NAME: It shows error messages. It ends in .tsx because it shows something on screen.
*/

import type { ReactNode } from "react";

/* WarningIcon: a small warning triangle. Screen readers skip it (the words say the same thing). */
export function WarningIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={`shrink-0 ${className}`} fill="currentColor">
      <path d="M10.3 3.9 1.8 18.6A2 2 0 0 0 3.5 21.6h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0ZM12 8.5a1 1 0 0 1 1 1v4.8a1 1 0 1 1-2 0V9.5a1 1 0 0 1 1-1Zm0 8.2a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5Z" />
    </svg>
  );
}

/*
  ErrorMessage: the red box.
  - alert: true (the default) makes screen readers announce it the moment it
    appears. Use false when it's already inside a live area.
*/
export default function ErrorMessage({ children, alert = true, id }: { children: ReactNode; alert?: boolean; id?: string }) {
  return (
    <div
      id={id}
      role={alert ? "alert" : undefined}
      className="flex items-start gap-3 rounded-xl border-2 border-danger bg-danger/15 px-4 py-3 text-sm font-semibold text-danger"
    >
      <WarningIcon />
      <div className="min-w-0 pt-px">{children}</div>
    </div>
  );
}

/* FieldError: the red line under a text box. id connects it to the box for screen readers. */
export function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="mt-1.5 flex items-start gap-1.5 text-sm font-semibold text-danger">
      <WarningIcon className="mt-px size-4" />
      <span>{children}</span>
    </p>
  );
}
