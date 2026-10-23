/*
  FILE: app/(main)/betslips/error.tsx
  WHAT IT'S FOR: The friendly error screen for the Bet Slips pages, if the
  list (or a slip) can't load. Shows "Try again" and a way back to the Feed.
  WHO USES IT: Next.js, automatically, when a page in the betslips folder throws an error.
  WHY THIS NAME: "error" is the name Next.js requires. It ends in .tsx because it shows something on screen.
*/

// "use client": error screens must run in the browser.
"use client";

// The shared error box from components/ErrorScreen.tsx.
import ErrorScreen from "@/components/ErrorScreen";

/* BetSlipsError: Next.js passes in the error and a retry function. */
export default function BetSlipsError({ error, retry }: { error: unknown; retry: () => void }) {
  return <ErrorScreen title="We couldn't load your bet slips" error={error} retry={retry} />;
}
