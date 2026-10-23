/*
  FILE: components/NotFoundCard.tsx
  WHAT IT'S FOR: The shared "not found" box for pages inside the app, like
  "Game not found" or "Team not found", with a button back to the Feed. The
  menu and bet slip stay on screen around it.
  WHO USES IT: the not-found.tsx files for the matchup and team pages (and later the player page).
  WHY THIS NAME: It's a card that says "not found". It ends in .tsx because it shows something on screen.
*/

import Link from "next/link";

/* NotFoundCard: title, a sentence, and the button back. */
export default function NotFoundCard({ title, message }: { title: string; message: string }) {
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-line bg-card p-8 text-center">
      <h1 className="text-2xl text-gold">{title}</h1>
      <p className="mt-3 text-sm text-muted">{message}</p>
      <Link
        href="/"
        className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-gold px-5 text-sm font-semibold text-bg hover:bg-gold-bright"
      >
        See this week&apos;s games
      </Link>
    </div>
  );
}
