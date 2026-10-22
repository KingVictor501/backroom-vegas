/*
  FILE: app/layout.tsx
  WHAT IT'S FOR: The "root layout", the outer frame around every page in the app.
  It sets up the <html> and <body> tags, loads the two fonts, and loads globals.css.
  WHO USES IT: Next.js wraps every page with this automatically, including the
  login pages and the app pages.
  WHY THIS NAME: Next.js requires the name "layout" for a layout file. It ends in
  .tsx because it shows something on screen (TypeScript + JSX, the HTML-like code).
*/

import type { Metadata } from "next";
// next/font downloads the fonts when the app is built and serves them from our own
// site, so the text doesn't jump around while fonts load and the browser never contacts Google.
import { Inter, Playfair_Display } from "next/font/google";
// The shared colors and fonts from app/globals.css. Loading them here applies them to every page.
import "./globals.css";

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
  "%s | Backroom Vegas" means a page titled "Settings" shows "Settings | Backroom Vegas".
*/
export const metadata: Metadata = {
  title: {
    default: "Backroom Vegas",
    template: "%s | Backroom Vegas",
  },
  description:
    "Compare NFL odds across sportsbooks, read NFL news, and build bet slips. A reference tool only, with no real betting.",
};

/*
  RootLayout: the outer frame. "children" is whatever page the user is on.
  LayoutProps is a type Next.js creates automatically, so we don't have to describe "children" ourselves.
*/
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // lang="en" tells screen readers to read the page in English.
    <html
      lang="en"
      className={`${playfair.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
