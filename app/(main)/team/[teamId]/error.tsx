/*
  FILE: app/(main)/team/[teamId]/error.tsx
  WHAT IT'S FOR: The friendly error screen for the team page, if the top of
  the page can't load (like ESPN not answering). Shows "Try again" and a way
  back to the Feed instead of a white screen.
  WHO USES IT: Next.js, automatically, when the team page throws an error.
  WHY THIS NAME: "error" is the name Next.js requires. It ends in .tsx because it shows something on screen.
*/

// "use client": error screens must run in the browser.
"use client";

// The shared error box from components/ErrorScreen.tsx.
import ErrorScreen from "@/components/ErrorScreen";

/* TeamError: Next.js passes in the error and a retry function. */
export default function TeamError({ error, retry }: { error: unknown; retry: () => void }) {
  return <ErrorScreen title="We couldn't load this team" error={error} retry={retry} />;
}
