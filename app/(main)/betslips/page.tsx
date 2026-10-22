/*
  FILE: app/(main)/betslips/page.tsx
  WHAT IT'S FOR: The Bet Slips list page, at /betslips. For now it's a placeholder
  with links to the New Slip form and an example slip; the real list comes in Section 12.
  WHO USES IT: Next.js shows it when someone visits /betslips. The "Bet Slips" menu link points here.
  WHY THIS NAME: The folder "betslips" becomes the web address, and Next.js requires
  the file name "page". It ends in .tsx because it shows something on screen.
*/

import type { Metadata } from "next";
import Link from "next/link";
// The shared "coming soon" box from the components folder.
import PagePlaceholder from "@/components/PagePlaceholder";

/* The browser tab title: "Bet Slips | Backroom Vegas". */
export const metadata: Metadata = { title: "Bet Slips" };

/* BetSlipsPage: the list placeholder, with links so we can test the other two bet slip pages. */
export default function BetSlipsPage() {
  return (
    <PagePlaceholder
      title="Bet Slips"
      description="All your saved slips, with search and a Straight / Parlay / SGP filter."
      section="Section 12"
    >
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <Link href="/betslips/new" className="text-gold underline">
          New slip
        </Link>
        <Link href="/betslips/example-id" className="text-gold underline">
          Example slip detail page
        </Link>
      </div>
    </PagePlaceholder>
  );
}
