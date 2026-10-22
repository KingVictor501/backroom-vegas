/*
  FILE: app/(main)/team/[teamId]/page.tsx
  WHAT IT'S FOR: A team's page, e.g. /team/12. For now it's a placeholder; the real
  page (recent results, player stats, injuries, news) comes in Section 11.
  WHO USES IT: Next.js shows it for any address that starts with /team/. Team logos will link here.
  WHY THIS NAME: "[teamId]" in square brackets is a dynamic folder: the ID in the
  address is handed to the page as "teamId". It ends in .tsx because it shows something on screen.
*/

import type { Metadata } from "next";
// The shared "coming soon" box from the components folder.
import PagePlaceholder from "@/components/PagePlaceholder";

/* The browser tab title: "Team | The Vegas Backroom". */
export const metadata: Metadata = { title: "Team" };

/* TeamPage: reads the team ID from the address and shows it in the placeholder. */
export default async function TeamPage(props: PageProps<"/team/[teamId]">) {
  const { teamId } = await props.params;
  return (
    <PagePlaceholder
      title="Team"
      description={`Recent results, player stats, injuries, and news for team ${teamId}.`}
      section="Section 11"
    />
  );
}
