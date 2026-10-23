/*
  FILE: app/(main)/matchup/[gameId]/not-found.tsx
  WHAT IT'S FOR: What you see for a game that doesn't exist, like
  /matchup/999999999 or /matchup/abc. It keeps the app's menu and slip on
  screen (unlike the site-wide not-found page) and points back to the Feed.
  WHO USES IT: Next.js, when the matchup page calls notFound().
  WHY THIS NAME: "not-found" is the name Next.js requires. It ends in .tsx
  because it shows something on screen.
*/

import Link from "next/link";

/* MatchupNotFound: the "game not found" message. */
export default function MatchupNotFound() {
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-line bg-card p-8 text-center">
      <h1 className="text-2xl text-gold">Game not found</h1>
      <p className="mt-3 text-sm text-muted">We couldn&apos;t find that game. It may have been removed, or the link has a typo.</p>
      <Link
        href="/"
        className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-gold px-5 text-sm font-semibold text-bg hover:bg-gold-bright"
      >
        See this week&apos;s games
      </Link>
    </div>
  );
}
