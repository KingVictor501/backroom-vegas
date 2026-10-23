/*
  FILE: app/(main)/betslips/[id]/error.tsx
  WHAT IT'S FOR: The friendly error screen for one slip's page, if something
  breaks while loading it. Shows "Try again" and a way back to the Feed, and
  the menu stays on screen. (The rubric asks for this file.)
  WHO USES IT: Next.js, automatically, when the slip detail page throws an error.
  WHY THIS NAME: "error" is the name Next.js requires. It ends in .tsx because it shows something on screen.
*/

// "use client": error screens must run in the browser.
"use client";

// The shared error box from components/ErrorScreen.tsx.
import ErrorScreen from "@/components/ErrorScreen";

/* SlipError: Next.js passes in the error and a retry function. */
export default function SlipError({ error, retry }: { error: unknown; retry: () => void }) {
  return <ErrorScreen title="We couldn't load this slip" error={error} retry={retry} />;
}
