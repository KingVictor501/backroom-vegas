/*
  FILE: components/betslip/SlipToast.tsx
  WHAT IT'S FOR: The short message that pops up at the top of the screen, like
  "New slip created" or "Your slip didn't save." (A "toast" is the usual name
  for a small message that pops up and goes away by itself.)
  Screen readers announce it out loud, because it's in a "live region".
  WHO USES IT: components/betslip/BetSlipProvider.tsx, which also hides it after 5 seconds.
  WHY THIS NAME: It's the toast for slip messages. It ends in .tsx because it
  shows something on screen.
*/

"use client";

// The warning triangle from components/ErrorMessage.tsx, for error messages.
import { WarningIcon } from "@/components/ErrorMessage";

/*
  ToastMessage: one message.
  - tone "info" (gold) or "error" (red)
  - key: changes for every new message, so the same text twice still restarts the timer
*/
export type ToastMessage = { text: string; tone: "info" | "error"; key: number };

/*
  SlipToast: the live region is always on the page (screen readers only
  announce changes to a region that already exists), and the message appears inside it.
*/
export default function SlipToast({
  message,
  onDismiss,
}: {
  message: ToastMessage | null;
  onDismiss: () => void;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 top-[calc(var(--notice-h)+1rem)] z-50 flex justify-center lg:left-64"
    >
      {message && (
        <div
          key={message.key}
          className={`pointer-events-auto flex max-w-md items-start gap-3 rounded-xl px-4 py-3 text-sm shadow-lg shadow-black/50 ${
            message.tone === "error"
              ? "border-2 border-danger bg-[color-mix(in_oklab,var(--color-danger)_15%,var(--color-card-raised))] font-semibold text-danger"
              : "border border-gold bg-card-raised text-text"
          }`}
        >
          {message.tone === "error" && <WarningIcon />}
          <p className="flex-1">{message.text}</p>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Close message"
            className="-my-3 -mr-2 flex min-h-11 min-w-11 items-center justify-center rounded text-muted hover:text-text"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
