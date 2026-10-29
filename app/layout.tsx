/*
  FILE: app/layout.tsx
  WHAT IT'S FOR: The "root layout", the outer frame around every page in the app.
  It also draws the yellow site notice bar (components/SiteNotice.tsx) above every page,
  including login and sign up, when config/siteNotice.ts has a notice.
  It sets up the <html> and <body> tags, loads the two fonts, and loads globals.css.
  WHO USES IT: Next.js wraps every page with this automatically, including the
  login pages and the app pages.
  WHY THIS NAME: Next.js requires the name "layout" for a layout file. It ends in
  .tsx because it shows something on screen (TypeScript + JSX, the HTML-like code).
*/

import type { Metadata } from "next";
import { connection } from "next/server";
// next/font downloads the fonts when the app is built and serves them from our own
// site, so the text doesn't jump around while fonts load and the browser never contacts Google.
import { Inter, Playfair_Display } from "next/font/google";
// The shared colors and fonts from app/globals.css. Loading them here applies them to every page.
import "./globals.css";
// The yellow notice bar and its text setting (config/siteNotice.ts), shown on every page.
import SiteNotice from "@/components/SiteNotice";
import { SITE_NOTICE } from "@/config/siteNotice";

/*
  The fancy heading font. Playfair Display is an elegant serif font with a
  classic, high-end hotel look.
  "variable" makes it available to the CSS as --font-playfair (see globals.css).
*/
const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
});

/*
  The clean font for regular text, numbers, and odds. Inter is very easy to
  read at small sizes, which matters for odds like -110 and +150.
*/
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

/*
  The text that appears in the browser tab and in search results.
  "%s | The Vegas Backroom" means a page titled "Settings" shows "Settings | The Vegas Backroom".
*/
export const metadata: Metadata = {
  title: {
    default: "The Vegas Backroom",
    template: "%s | The Vegas Backroom",
  },
  description:
    "Compare NFL odds across sportsbooks, read NFL news, and build bet slips. A reference tool only, with no real betting.",
};

/*
  RootLayout: the outer frame. "children" is whatever page the user is on.
  LayoutProps is a type Next.js creates automatically, so we don't have to describe "children" ourselves.
*/
export default async function RootLayout({ children }: LayoutProps<"/">) {
  // connection(): wait for a real visit before building any page. A page built ahead of time (at build) can't get this
  // visit's Content-Security-Policy nonce (made in proxy.ts), so its scripts would be blocked, including the 404 screen.
  // Every page here is already per-visit or per-user, so this costs nothing real. (Next.js docs: Content Security Policy.)
  await connection();
  return (
    // lang="en" tells screen readers to read the page in English.
    <html
      lang="en"
      // data-notice makes globals.css give the page room for the yellow notice bar (see components/SiteNotice.tsx).
      data-notice={SITE_NOTICE === null ? undefined : ""}
      className={`${playfair.variable} ${inter.variable} h-full antialiased`}
    >
      {/* pt-(--notice-h): start the page below the notice bar. */}
      <body className="min-h-full pt-(--notice-h)">
        <SiteNotice />
        {children}
      </body>
    </html>
  );
}
