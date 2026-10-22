/*
  FILE: app/(main)/page.tsx
  WHAT IT'S FOR: The Feed (homepage), at the address "/". For now it's a placeholder
  with a link to the NFL league page; the real Feed comes in Section 9.
  WHO USES IT: Next.js shows it when someone visits the site's main address.
  The "Home" link in the menu points here.
  WHY THIS NAME: A page.tsx directly inside a folder is that folder's main page. Since
  "(main)" is a route group (not part of the address), this is the page for "/".
  It ends in .tsx because it shows something on screen.
*/

import type { Metadata } from "next";
import Link from "next/link";
// The shared "coming soon" box from the components folder.
import PagePlaceholder from "@/components/PagePlaceholder";

/* The browser tab title. absolute = show just "The Vegas Backroom" without the "| The Vegas Backroom" ending. */
export const metadata: Metadata = { title: { absolute: "The Vegas Backroom" } };

/* FeedPage: the homepage placeholder. */
export default function FeedPage() {
  return (
    <PagePlaceholder
      title="Feed"
      description="Search, league tabs, bet-type buttons, upcoming NFL games with odds, and NFL news."
      section="Section 9"
    >
      <Link
        href="/league/nfl"
        className="mt-4 inline-block text-sm text-gold underline"
      >
        Go to the NFL league page
      </Link>
    </PagePlaceholder>
  );
}
