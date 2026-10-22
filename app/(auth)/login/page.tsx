/*
  FILE: app/(auth)/login/page.tsx
  WHAT IT'S FOR: The login page, at the address /login. For now it's a placeholder;
  the real form comes in Section 4.
  WHO USES IT: Next.js shows it when someone visits /login. The sign up page links here.
  WHY THIS NAME: The folder "login" becomes the web address. The file must be named
  "page" for Next.js to treat it as a page. It ends in .tsx because it shows something on screen.
*/

import type { Metadata } from "next";
import Link from "next/link";
// The shared "coming soon" box from the components folder, so every placeholder looks the same.
import PagePlaceholder from "@/components/PagePlaceholder";

/* The browser tab title: "Log in | Backroom Vegas". */
export const metadata: Metadata = { title: "Log in" };

/* LoginPage: shows the placeholder with a link to sign up. */
export default function LoginPage() {
  return (
    <PagePlaceholder
      title="Log in"
      description="Log in with your email and password."
      section="Section 4"
    >
      <p className="mt-4 text-sm text-muted">
        New here?{" "}
        <Link href="/signup" className="text-gold underline">
          Create an account
        </Link>
      </p>
    </PagePlaceholder>
  );
}
