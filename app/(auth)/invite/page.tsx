/*
  FILE: app/(auth)/invite/page.tsx
  WHAT IT'S FOR: The invite page, at /invite: the FIRST thing a new visitor sees.
  It explains the app is invite-only for now and asks for a code. A good code
  is remembered for 30 days and leads on to log in or sign up. proxy.ts sends
  anyone without a valid invite here, even if they try /login or /signup directly.
  If sign up finds the code has stopped being good (used up, expired, or turned
  off since it was entered), it sends the visitor back here with ?error=invalid,
  and this page shows the same one red message.
  WHO USES IT: Next.js shows it at /invite. proxy.ts and the sign up action send visitors here.
  WHY THIS NAME: The folder "invite" becomes the web address, and Next.js requires
  the file name "page". It ends in .tsx because it shows something on screen.
*/

import type { Metadata } from "next";
import InviteForm from "@/components/auth/InviteForm";
import ErrorMessage from "@/components/ErrorMessage";
import { safeNextPath } from "@/lib/auth/validation";
import { INVALID_INVITE_MESSAGE } from "@/lib/invite/format";

export const metadata: Metadata = { title: "Invite code" };

/*
  InvitePage: reads ?next= (where the visitor was heading) and ?error= from the
  address. It runs on the server. The error text is OUR fixed message, chosen
  by us, never text copied from the address.
*/
export default async function InvitePage(props: PageProps<"/invite">) {
  const { next, error } = await props.searchParams;
  const nextPath = safeNextPath(next);

  return (
    <div className="rounded-3xl border border-line bg-card p-6 shadow-xl shadow-black/40 sm:p-8">
      <h1 className="text-3xl text-text">Enter your invite code</h1>
      <p className="mt-2 text-sm text-muted">
        The Vegas Backroom is invite-only for now. Enter the code you were given to continue.
        This is a reference tool only: no real bets, no real money.
      </p>

      {/* Sent here by sign up because the code stopped working. */}
      {error === "invalid" && (
        <div className="mt-6">
          <ErrorMessage>{INVALID_INVITE_MESSAGE}</ErrorMessage>
        </div>
      )}

      <div className="mt-6">
        <InviteForm next={nextPath} />
      </div>
    </div>
  );
}
