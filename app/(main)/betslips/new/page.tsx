/*
  FILE: app/(main)/betslips/new/page.tsx
  WHAT IT'S FOR: The New Slip form page, at /betslips/new. For now it's a placeholder;
  the real form comes in Section 12.
  WHO USES IT: Next.js shows it when someone visits /betslips/new. The Bet Slips list links here.
  WHY THIS NAME: The folder "new" sits inside "betslips", so the address is
  /betslips/new. Next.js checks exact folder names like "new" before the [id]
  folder, so "new" is never mistaken for a slip ID. It ends in .tsx because it shows something on screen.
*/

import type { Metadata } from "next";
// The shared "coming soon" box from the components folder.
import PagePlaceholder from "@/components/PagePlaceholder";

/* The browser tab title: "New Slip | Backroom Vegas". */
export const metadata: Metadata = { title: "New Slip" };

/* NewBetSlipPage: the New Slip placeholder. */
export default function NewBetSlipPage() {
  return (
    <PagePlaceholder
      title="New Slip"
      description="A form to create a slip. If you leave the name blank, it's named with today's date."
      section="Section 12"
    />
  );
}
