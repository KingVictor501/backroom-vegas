/*
  FILE: app/not-found.tsx
  WHAT IT'S FOR: The friendly "page not found" screen, shown for addresses that
  don't exist (like /nothing-here) or when a page calls notFound() (like /league/xyz).
  WHO USES IT: Next.js shows it automatically. app/(main)/league/[league]/page.tsx triggers it with notFound().
  WHY THIS NAME: Next.js requires the exact name "not-found" for this screen. It ends
  in .tsx because it shows something on screen.
*/

import Link from "next/link";

/* NotFound: a centered message with a gold button back to the Feed. */
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <p className="font-display text-5xl text-gold">404</p>
      <h1 className="mt-4 text-2xl">We couldn&apos;t find that page</h1>
      <p className="mt-2 text-muted">
        The link may be wrong, or the page may have moved.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-full bg-gold px-6 py-2.5 font-medium text-bg hover:bg-gold-bright"
      >
        Back to the Feed
      </Link>
    </main>
  );
}
