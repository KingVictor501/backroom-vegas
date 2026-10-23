/*
  FILE: components/ErrorScreen.tsx
  WHAT IT'S FOR: The shared friendly error box, used when a page breaks
  unexpectedly (like ESPN not answering): a short message, a "Try again"
  button, and a way back to the Feed. The technical details only go to the
  browser console, never on screen.
  WHO USES IT: the error.tsx files for the matchup and team pages (and later the player page).
  WHY THIS NAME: It's the error screen. It ends in .tsx because it shows something on screen.
*/

// "use client": error screens run in the browser (Next.js requires it, and the button needs it).
"use client";

import Link from "next/link";
import { useEffect } from "react";

/*
  ErrorScreen
  - title: like "We couldn't load this game"
  - error: what went wrong (console only)
  - retry: Next.js's "try loading this page again" (Next.js 16's name for it)
*/
export default function ErrorScreen({ title, error, retry }: { title: string; error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="mx-auto max-w-md rounded-2xl border border-line bg-card p-8 text-center">
      <h1 className="text-2xl text-gold">{title}</h1>
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
