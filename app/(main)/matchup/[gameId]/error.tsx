/*
  FILE: app/(main)/matchup/[gameId]/error.tsx
  WHAT IT'S FOR: The friendly error screen for the matchup page. If something
  unexpected breaks (like ESPN not answering), you see this instead of a white
  screen, with a "Try again" button and a way back to the Feed. The menu and
  your bet slip stay on screen.
  WHO USES IT: Next.js, automatically, when the matchup page throws an error.
  WHY THIS NAME: "error" is the name Next.js requires. It ends in .tsx because
  it shows something on screen. (Next.js 16 calls the "try again" function
  "retry"; older versions called it "reset". I checked the bundled docs.)
*/

// "use client": error screens must run in the browser, because they catch errors there too.
"use client";

// The shared error box from components/ErrorScreen.tsx.
import ErrorScreen from "@/components/ErrorScreen";

/* MatchupError: Next.js passes in the error and a retry function. */
export default function MatchupError({ error, retry }: { error: unknown; retry: () => void }) {
  return <ErrorScreen title="We couldn't load this game" error={error} retry={retry} />;
}
