/*
  FILE: app/(main)/error.tsx
  WHAT IT'S FOR: The "catch-all" friendly error screen for every app page that
  doesn't have its own: the Feed, league pages, Settings, and New slip. If one
  of them breaks, the visitor sees a short message and a "Try again" button
  instead of a white screen. The menu stays put, because this sits inside the
  shared layout. (Pages with their own error.tsx still use theirs.)
  WHO USES IT: Next.js, automatically, when a page inside app/(main) throws an error.
  WHY THIS NAME: "error" is the name Next.js requires. It ends in .tsx because it shows something on screen.
*/

// "use client": error screens must run in the browser.
"use client";

// The shared error box from components/ErrorScreen.tsx.
import ErrorScreen from "@/components/ErrorScreen";

/* MainError: Next.js passes in the error and a retry function. */
export default function MainError({ error, retry }: { error: unknown; retry: () => void }) {
  return <ErrorScreen title="We couldn't load this page" error={error} retry={retry} />;
}
