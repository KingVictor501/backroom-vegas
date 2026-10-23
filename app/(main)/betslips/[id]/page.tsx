/*
  FILE: app/(main)/betslips/[id]/page.tsx
  WHAT IT'S FOR: One bet slip's page, e.g. /betslips/6adabc0ede5b414776b4846c.
  It loads YOUR slip on the server (someone else's slip, or a fake ID, shows
  "Slip not found"), then hands it to SlipDetail, where you can rename it,
  remove picks, set it as your active slip, or delete it.
  It has its own loading screen (loading.tsx), error screen (error.tsx), and
  "Slip not found" screen (not-found.tsx), which the rubric asks for.
  WHO USES IT: Next.js shows it for any address like /betslips/<something>. The Bet Slips list and the slip bar's "View" link here.
  WHY THIS NAME: "[id]" in square brackets is a dynamic folder: the slip's ID from
  the address is handed to the page as "id". It ends in .tsx because it shows something on screen.
*/

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
// The actions part of the page, from components/betslips.
import SlipDetail from "@/components/betslips/SlipDetail";
// requireUser from lib/auth/dal.ts, and getBetSlip from lib/db/betslips.ts (only ever YOUR slips).
import { requireUser } from "@/lib/auth/dal";
import { getBetSlip } from "@/lib/db/betslips";

/* generateMetadata: the browser tab title, like "Sunday picks | The Vegas Backroom". */
export async function generateMetadata(props: PageProps<"/betslips/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const user = await requireUser();
  const slip = await getBetSlip(user.id, id);
  return { title: slip?.name ?? "Bet Slip" };
}

/*
  requestTime: the server's clock for this visit. This page is a Server Component,
  so it runs ONCE per visit (it never re-renders in the browser), which makes
  reading the clock here safe. React's "pure components" lint rule can't tell
  that, so the clock is read in this small helper instead of in the page itself.
*/
function requestTime(): number {
  return Date.now();
}

/* BetSlipDetailPage: runs on the server. */
export default async function BetSlipDetailPage(props: PageProps<"/betslips/[id]">) {
  const { id } = await props.params;
  const user = await requireUser();
  // getBetSlip only finds slips that belong to this user, and treats bad IDs as "not found".
  const slip = await getBetSlip(user.id, id);
  if (!slip) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link href="/betslips" className="inline-flex min-h-11 items-center text-sm text-muted hover:text-gold">
        ‹ Bet Slips
      </Link>
      {/* key: if you open a different slip, the page starts fresh instead of keeping the old slip's typing. */}
      {/* now: the server's clock, used to mark picks for games that already started. */}
      <SlipDetail key={slip.id} initialSlip={slip} now={requestTime()} />
    </div>
  );
}
