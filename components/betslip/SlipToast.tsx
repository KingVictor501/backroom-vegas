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
      className="pointer-events-none fixed inset-x-4 top-4 z-50 flex justify-center lg:left-64"
    >
      {message && (
        <div
          key={message.key}
          className={`pointer-events-auto flex max-w-md items-start gap-3 rounded-xl border bg-card-raised px-4 py-3 text-sm shadow-lg shadow-black/50 ${
            message.tone === "error" ? "border-danger text-danger" : "border-gold text-text"
          }`}
        >
          <p className="flex-1">{message.text}</p>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Close message"
            className="-m-1 rounded p-1 text-muted hover:text-text"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
