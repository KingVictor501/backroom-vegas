/*
  FILE: app/(auth)/signup/page.tsx
  WHAT IT'S FOR: The sign up page, at the address /signup. For now it's a placeholder;
  the real form comes in Section 4.
  WHO USES IT: Next.js shows it when someone visits /signup. The login page links here.
  WHY THIS NAME: The folder "signup" becomes the web address, and Next.js requires the
  file name "page". It ends in .tsx because it shows something on screen.
*/

import type { Metadata } from "next";
import Link from "next/link";
// The shared "coming soon" box from the components folder.
import PagePlaceholder from "@/components/PagePlaceholder";

/* The browser tab title: "Sign up | Backroom Vegas". */
export const metadata: Metadata = { title: "Sign up" };

/* SignupPage: shows the placeholder with a link back to login. */
export default function SignupPage() {
  return (
    <PagePlaceholder
      title="Sign up"
      description="Create an account with your email and a password. No email verification needed."
      section="Section 4"
    >
      <p className="mt-4 text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="text-gold underline">
          Log in
        </Link>
      </p>
    </PagePlaceholder>
  );
}
