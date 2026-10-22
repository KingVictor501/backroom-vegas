/*
  FILE: app/(main)/betslips/[id]/page.tsx
  WHAT IT'S FOR: One bet slip's detail page, e.g. /betslips/abc123. For now it's a
  placeholder; in Section 12 it will rename the slip, remove picks, and delete the
  slip, and get its own loading and error screens.
  WHO USES IT: Next.js shows it for any address like /betslips/<something>. The Bet Slips list links here.
  WHY THIS NAME: "[id]" in square brackets is a dynamic folder: the slip's ID from
  the address is handed to the page as "id". The rubric asks for exactly this [id]
  page. It ends in .tsx because it shows something on screen.
*/

import type { Metadata } from "next";
// The shared "coming soon" box from the components folder.
import PagePlaceholder from "@/components/PagePlaceholder";

/* The browser tab title: "Bet Slip | The Vegas Backroom". */
export const metadata: Metadata = { title: "Bet Slip" };

/* BetSlipDetailPage: reads the slip ID from the address and shows it in the placeholder. */
export default async function BetSlipDetailPage(
  props: PageProps<"/betslips/[id]">,
) {
  const { id } = await props.params;
  return (
    <PagePlaceholder
      title="Bet Slip"
      description={`Rename, remove picks from, or delete slip ${id}.`}
      section="Section 12"
    />
  );
}
