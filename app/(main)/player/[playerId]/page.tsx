/*
  FILE: app/(main)/player/[playerId]/page.tsx
  WHAT IT'S FOR: A player's page, e.g. /player/3139477. For now it's a placeholder;
  the real page (photo, stats, last 10 games, next game props, news) comes in Section 11B.
  WHO USES IT: Next.js shows it for any address that starts with /player/. Player names will link here.
  WHY THIS NAME: "[playerId]" in square brackets is a dynamic folder: the ID in the
  address is handed to the page as "playerId". It ends in .tsx because it shows something on screen.
*/

import type { Metadata } from "next";
// The shared "coming soon" box from the components folder.
import PagePlaceholder from "@/components/PagePlaceholder";

/* The browser tab title: "Player | Backroom Vegas". */
export const metadata: Metadata = { title: "Player" };

/* PlayerPage: reads the player ID from the address and shows it in the placeholder. */
export default async function PlayerPage(
  props: PageProps<"/player/[playerId]">,
) {
  const { playerId } = await props.params;
  return (
    <PagePlaceholder
      title="Player"
      description={`Photo, season stats, last 10 games, next-game props, and news for player ${playerId}.`}
      section="Section 11B"
    />
  );
}
