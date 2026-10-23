/*
  FILE: app/(main)/player/[playerId]/error.tsx
  WHAT IT'S FOR: The friendly error screen for the player page, if something
  unexpected breaks (like ESPN not answering). Shows "Try again" and a way
  back to the Feed instead of a white screen.
  WHO USES IT: Next.js, automatically, when the player page throws an error.
  WHY THIS NAME: "error" is the name Next.js requires. It ends in .tsx because it shows something on screen.
*/

// "use client": error screens must run in the browser.
"use client";

// The shared error box from components/ErrorScreen.tsx.
import ErrorScreen from "@/components/ErrorScreen";

/* PlayerError: Next.js passes in the error and a retry function. */
export default function PlayerError({ error, retry }: { error: unknown; retry: () => void }) {
  return <ErrorScreen title="We couldn't load this player" error={error} retry={retry} />;
}
