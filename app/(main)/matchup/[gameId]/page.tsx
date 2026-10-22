/*
  FILE: app/(main)/matchup/[gameId]/page.tsx
  WHAT IT'S FOR: One game's matchup page, e.g. /matchup/12345. For now it's a
  placeholder that shows the game ID from the address; the real page comes in Section 10.
  WHO USES IT: Next.js shows it for any address that starts with /matchup/. Game cards will link here.
  WHY THIS NAME: "[gameId]" in square brackets is a dynamic folder: the ID in the
  address is handed to the page as "gameId". It ends in .tsx because it shows something on screen.
*/

import type { Metadata } from "next";
// The shared "coming soon" box from the components folder.
import PagePlaceholder from "@/components/PagePlaceholder";

/* The browser tab title: "Matchup | The Vegas Backroom". */
export const metadata: Metadata = { title: "Matchup" };

/*
  MatchupPage: reads the game ID from the address and shows it in the placeholder.
  React automatically treats the ID as plain text, so even a strange ID can't inject code into the page.
*/
export default async function MatchupPage(
  props: PageProps<"/matchup/[gameId]">,
) {
  const { gameId } = await props.params;
  return (
    <PagePlaceholder
      title="Matchup"
      description={`Team logos, records, game time, odds, props, and Build your own SGP for game ${gameId}.`}
      section="Section 10"
    />
  );
}
