/*
  FILE: app/(legal)/layout.tsx
  WHAT IT'S FOR: The frame around the Privacy Policy and Terms of Use pages. These pages are open to
  everyone (logged in or not), so they have no menu: just a link back, the page, and the footer.
  WHO USES IT: Next.js wraps app/(legal)/privacy/page.tsx and app/(legal)/terms/page.tsx with it.
  WHY THIS NAME: "layout" is required by Next.js. "(legal)" is a route group: the parentheses keep it
  out of the web address, so the pages are /privacy and /terms. It ends in .tsx because it shows something on screen.
*/

import Link from "next/link";
import SiteFooter from "@/components/SiteFooter";

/* LegalLayout: a readable centered column. "main" marks the main part of the page for screen readers. */
export default function LegalLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="mx-auto min-h-[calc(100vh-var(--notice-h))] max-w-3xl px-4 py-8 sm:px-6">
      {/* Breadcrumb: a way back. Someone who is already logged in is sent on to the Feed by proxy.ts. */}
      <nav aria-label="Breadcrumb" className="mb-3 text-sm">
        <Link href="/login" className="font-semibold text-gold underline-offset-4 hover:underline">
          ← Back to login
        </Link>
      </nav>
      <p className="font-display text-2xl text-gold">The Vegas Backroom</p>
      <div className="mt-6 space-y-5">{children}</div>
      <SiteFooter />
    </main>
  );
}
