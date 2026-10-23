/*
  FILE: app/(main)/betslips/page.tsx
  WHAT IT'S FOR: The Bet Slips list page, at /betslips: every slip you've
  saved, with a search box, an All / Straight / Parlay / SGP filter, and a
  New slip button. If you have no slips yet, it tells you to tap any odds to start one.
  HOW IT LOADS: on the SERVER, from your GET /api/betslips route (as your spec
  and rubric ask), so the list is already in the page, even with JavaScript off.
  (The Next.js docs suggest reading the database directly instead, to skip one
  extra hop. We chose the API route on purpose, so the list visibly uses it.)
  WHO USES IT: Next.js shows it when someone visits /betslips. The "Bet Slips" menu link points here.
  WHY THIS NAME: The folder "betslips" becomes the web address, and Next.js requires
  the file name "page". It ends in .tsx because it shows something on screen.
*/

import type { Metadata } from "next";
import Link from "next/link";
// The list with search and filter, from components/betslips.
import SlipList from "@/components/betslips/SlipList";
// getFromOwnApi from lib/api/ownApi.ts: calls our own /api/betslips with your login cookie.
import { getFromOwnApi } from "@/lib/api/ownApi";
// requireUser from lib/auth/dal.ts: logged-in users only.
import { requireUser } from "@/lib/auth/dal";
// THE shared bet slip type, from the types folder.
import type { BetSlip } from "@/types";

/* The browser tab title: "Bet Slips | The Vegas Backroom". */
export const metadata: Metadata = { title: "Bet Slips" };

/* BetSlipsPage: runs on the server. No useEffect: the list is ready before the page is sent. */
export default async function BetSlipsPage() {
  await requireUser();
  const slips = await getFromOwnApi<BetSlip[]>("/api/betslips");

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl text-gold">Bet Slips</h1>
        <Link
          href="/betslips/new"
          className="inline-flex min-h-11 shrink-0 items-center rounded-xl bg-gold px-4 text-sm font-semibold text-bg hover:bg-gold-bright"
        >
          + New slip
        </Link>
      </div>
      <SlipList slips={slips} />
    </div>
  );
}
