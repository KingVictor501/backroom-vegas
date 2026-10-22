/*
  FILE: app/(main)/settings/page.tsx
  WHAT IT'S FOR: The Settings page, at /settings. For now it shows who's logged
  in and a Log out button (so Section 4's login can be tested). The sportsbook
  picker comes in Section 13.
  WHO USES IT: Next.js shows it when someone visits /settings. The "Settings" menu link points here.
  WHY THIS NAME: The folder "settings" becomes the web address, and Next.js requires
  the file name "page". It ends in .tsx because it shows something on screen.
*/

import type { Metadata } from "next";
// The shared "coming soon" box from the components folder.
import PagePlaceholder from "@/components/PagePlaceholder";
// The Log out button (calls the logout Server Action) from components/auth/LogoutButton.tsx.
import LogoutButton from "@/components/auth/LogoutButton";
// requireUser from lib/auth/dal.ts: gets the logged-in user, or sends the visitor to /login.
import { requireUser } from "@/lib/auth/dal";

/* The browser tab title: "Settings | The Vegas Backroom". */
export const metadata: Metadata = { title: "Settings" };

/*
  SettingsPage: loads the logged-in user on the server (never in the browser)
  and shows their email plus the Log out button.
*/
export default async function SettingsPage() {
  const user = await requireUser();

  return (
    <PagePlaceholder
      title="Settings"
      description="Pick your sportsbook (Hard Rock Bet, BetMGM, or Caesars)."
      section="Section 13"
    >
      <div className="mt-6 border-t border-line pt-5">
        <p className="text-sm text-muted">Logged in as</p>
        {/* React shows the email as plain text, so it can't be used to inject code. */}
        <p className="mt-1 break-all font-medium text-text">{user.email}</p>
        <div className="mt-4">
          <LogoutButton />
        </div>
      </div>
    </PagePlaceholder>
  );
}
