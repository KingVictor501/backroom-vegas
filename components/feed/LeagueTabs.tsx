/*
  FILE: components/feed/LeagueTabs.tsx
  WHAT IT'S FOR: The row of league tabs (NFL, NBA, NHL, MLB, NCAAF, NCAABB,
  WNBA, UFC, Boxing), each with a small icon. The tabs always stay on ONE line;
  when they don't fit, you swipe (or scroll) the row left and right.
  - The league you're on is gold and underlined.
  - Leagues that aren't turned on are grayed out, can't be clicked, and show
    a "Coming soon" tooltip when the mouse is over them.
  WHO USES IT: components/feed/GameBrowser.tsx (the Feed and league page).
  WHY THIS NAME: Tabs for leagues. It ends in .tsx because it shows something on screen.
*/

import Link from "next/link";
// The league list from config/leagues.ts. Turning a league on there makes its tab work here.
import { LEAGUES } from "@/config/leagues";

/*
  LeagueTabs
  - activeSlug: the league being shown, like "nfl" (its tab is underlined)
  "title" is the browser's own tooltip, which appears when the mouse rests on a
  grayed-out tab. Screen readers hear "coming soon" from the hidden text instead.
*/
export default function LeagueTabs({ activeSlug }: { activeSlug: string }) {
  return (
    // scroll-row (app/globals.css): the row scrolls sideways instead of wrapping onto a second line.
    <nav aria-label="Leagues" className="scroll-row -mx-4 px-4 sm:mx-0 sm:px-0">
      <ul className="flex w-max min-w-full flex-nowrap gap-1 border-b border-line">
        {LEAGUES.map((league) => {
          const isActive = league.slug === activeSlug;
          // whitespace-nowrap + shrink-0: a tab never squeezes or breaks onto two lines.
          const look = "flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-semibold";
          return (
            <li key={league.slug} className="shrink-0">
              {league.enabled ? (
                <Link
                  href={`/league/${league.slug}`}
                  aria-current={isActive ? "page" : undefined}
                  className={`${look} ${isActive ? "border-gold text-gold" : "border-transparent text-muted hover:text-text"}`}
                >
                  <span aria-hidden>{league.icon}</span>
                  {league.label}
                </Link>
              ) : (
                <span
                  title="Coming soon"
                  aria-disabled="true"
                  className={`${look} cursor-not-allowed border-transparent text-disabled`}
                >
                  <span aria-hidden className="opacity-50 grayscale">
                    {league.icon}
                  </span>
                  {league.label}
                  <span className="sr-only">, coming soon</span>
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
