/*
  FILE: app/(main)/settings/page.tsx
  WHAT IT'S FOR: The Settings page, at /settings. For now it's a placeholder; the
  sportsbook picker and log out button come in Section 13.
  WHO USES IT: Next.js shows it when someone visits /settings. The "Settings" menu link points here.
  WHY THIS NAME: The folder "settings" becomes the web address, and Next.js requires
  the file name "page". It ends in .tsx because it shows something on screen.
*/

import type { Metadata } from "next";
// The shared "coming soon" box from the components folder.
import PagePlaceholder from "@/components/PagePlaceholder";

/* The browser tab title: "Settings | Backroom Vegas". */
export const metadata: Metadata = { title: "Settings" };

/* SettingsPage: the Settings placeholder. */
export default function SettingsPage() {
  return (
    <PagePlaceholder
      title="Settings"
      description="Pick your sportsbook (Hard Rock Bet, BetMGM, or Caesars) and log out."
      section="Section 13"
    />
  );
}
