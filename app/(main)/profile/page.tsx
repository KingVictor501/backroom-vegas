/*
  FILE: app/(main)/profile/page.tsx
  WHAT IT'S FOR: The Profile page, at /profile. A protected page for managing your
  own account, with three cards:
  - Change email (needs your current password)
  - Change password (needs your current password; logs your other devices out)
  - Delete account (a confirmation popup; erases the account and all its slips)
  WHO USES IT: Next.js shows it when someone visits /profile. The "Profile" menu link
  and the Profile button on the Settings page point here.
  WHY THIS NAME: The folder "profile" becomes the web address, and Next.js requires
  the file name "page". It ends in .tsx because it shows something on screen.
  The four states: loading is app/(main)/loading.tsx, an error is app/(main)/error.tsx,
  "empty" doesn't apply (every account has an email), and the data is the cards below.
*/

import type { Metadata } from "next";
import ChangeEmailForm from "@/components/profile/ChangeEmailForm";
import ChangePasswordForm from "@/components/profile/ChangePasswordForm";
import DeleteAccountDialog from "@/components/profile/DeleteAccountDialog";
// requireUser from lib/auth/dal.ts: gets the logged-in user, or sends the visitor to /login.
import { requireUser } from "@/lib/auth/dal";

/* The browser tab title: "Profile | The Vegas Backroom". */
export const metadata: Metadata = { title: "Profile" };

/* ProfilePage: loads the logged-in user on the server (never in the browser). */
export default async function ProfilePage() {
  const user = await requireUser();

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <h1 className="text-3xl text-gold">Profile</h1>

      <section aria-labelledby="email-heading" className="rounded-2xl border border-line bg-card p-5">
        <h2 id="email-heading" className="text-xl text-text">
          Email
        </h2>
        <p className="mt-3 text-sm text-muted">Your email is</p>
        {/* React shows the email as plain text, so it can't be used to inject code. */}
        <p className="mt-1 break-all font-medium text-text">{user.email}</p>
        <div className="mt-5">
          <ChangeEmailForm />
        </div>
      </section>

      <section aria-labelledby="password-heading" className="rounded-2xl border border-line bg-card p-5">
        <h2 id="password-heading" className="text-xl text-text">
          Password
        </h2>
        <p className="mt-2 text-sm text-muted">
          Changing your password logs out every other device. This one stays logged in.
        </p>
        <div className="mt-5">
          <ChangePasswordForm />
        </div>
      </section>

      <section aria-labelledby="delete-section-heading" className="rounded-2xl border-2 border-danger/60 bg-card p-5">
        <h2 id="delete-section-heading" className="text-xl text-danger">
          Delete account
        </h2>
        <p className="mt-2 text-sm text-muted">Permanently erase your account and all of your bet slips.</p>
        <div className="mt-4">
          <DeleteAccountDialog />
        </div>
      </section>
    </div>
  );
}
