/*
  FILE: app/(main)/betslips/[id]/not-found.tsx
  WHAT IT'S FOR: What you see for a slip that doesn't exist, like
  /betslips/abc, or for someone else's slip (you can only open your own).
  WHO USES IT: Next.js, when the slip detail page calls notFound().
  WHY THIS NAME: "not-found" is the name Next.js requires. It ends in .tsx because it shows something on screen.
*/

import Link from "next/link";
// The shared "not found" box from components/NotFoundCard.tsx.
import NotFoundCard from "@/components/NotFoundCard";

/* SlipNotFound: the "slip not found" message, plus a link to the list. */
export default function SlipNotFound() {
  return (
    <div className="space-y-4 text-center">
      <NotFoundCard title="Slip not found" message="We couldn't find that bet slip. It may have been deleted, or the link has a typo." />
      <Link href="/betslips" className="inline-flex min-h-11 items-center text-sm font-semibold text-gold hover:underline">
        See all your bet slips
      </Link>
    </div>
  );
}
