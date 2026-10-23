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

import Link from "next/link";
import { useEffect } from "react";

/*
  MatchupError
  - error: what went wrong (only written to the browser console, never shown, since it could be technical)
  - retry: asks Next.js to try loading the page again
*/
export default function MatchupError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="mx-auto max-w-md rounded-2xl border border-line bg-card p-8 text-center">
      <h1 className="text-2xl text-gold">We couldn&apos;t load this game</h1>
      <p className="mt-3 text-sm text-muted">
        The sports data service may be busy. Your bet slips are safe. Please try again in a moment.
      </p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <button
          type="button"
          onClick={() => retry()}
          className="min-h-11 rounded-xl bg-gold px-5 text-sm font-semibold text-bg hover:bg-gold-bright"
        >
          Try again
        </button>
        <Link href="/" className="flex min-h-11 items-center justify-center rounded-xl border border-line px-5 text-sm font-medium text-text hover:bg-card-raised">
          Back to the Feed
        </Link>
      </div>
    </div>
  );
}
