/*
  FILE: components/SiteNotice.tsx
  WHAT IT'S FOR: The yellow notice bar pinned to the very top of every page (login and sign up
  included). Its text comes from config/siteNotice.ts.
  HOW THE PAGE MAKES ROOM: the bar is a fixed height, set by the CSS variable --notice-h in
  app/globals.css (taller on phones, where the text wraps onto more lines). The page, the
  desktop sidebar, the desktop slip panel, and the pop-up messages all start BELOW that height,
  so the bar never covers anything.
  ACCESSIBILITY: role="status" lets screen readers announce it politely. Dark text on yellow
  has very high contrast.
  WHO USES IT: app/layout.tsx.
  WHY THIS NAME: It's the site notice. It ends in .tsx because it shows something on screen.
*/

// SITE_NOTICE from config/siteNotice.ts: the text to show (or null for none).
import { SITE_NOTICE } from "@/config/siteNotice";

/* SiteNotice: draws nothing when there is no notice. */
export default function SiteNotice() {
  if (SITE_NOTICE === null) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-60 flex h-(--notice-h) items-center justify-center overflow-hidden bg-yellow-400 px-4 text-center text-[13px] font-semibold leading-tight text-black sm:text-sm"
    >
      {SITE_NOTICE}
    </div>
  );
}
