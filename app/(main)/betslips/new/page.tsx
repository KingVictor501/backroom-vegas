/*
  FILE: app/(main)/betslips/new/page.tsx
  WHAT IT'S FOR: The New Slip form page, at /betslips/new.
  WHO USES IT: Next.js shows it when someone visits /betslips/new. The Bet Slips list's "+ New slip" button links here.
  WHY THIS NAME: The folder "new" sits inside "betslips", so the address is
  /betslips/new. Next.js checks exact folder names like "new" before the [id]
  folder, so "new" is never mistaken for a slip ID. It ends in .tsx because it shows something on screen.
*/

import type { Metadata } from "next";
import Link from "next/link";
// The form itself, from components/betslips.
import NewSlipForm from "@/components/betslips/NewSlipForm";

/* The browser tab title: "New Slip | The Vegas Backroom". */
export const metadata: Metadata = { title: "New Slip" };

/* NewSlipPage: the heading, a way back, and the form. */
export default function NewSlipPage() {
  return (
    <div className="mx-auto max-w-lg space-y-5">
      <Link href="/betslips" className="inline-flex min-h-11 items-center text-sm text-muted hover:text-gold">
        ‹ Bet Slips
      </Link>
      <h1 className="text-3xl text-gold">New slip</h1>
      <NewSlipForm />
    </div>
  );
}
