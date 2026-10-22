/*
  FILE: components/nav/AppNav.tsx
  WHAT IT'S FOR: The main menu (Home, Bet Slips, Settings).
  - On phones and tablets it's a floating, rounded bar fixed to the bottom of the screen.
  - On desktop (1024px wide and up) it becomes a sidebar on the left.
  The page the user is on is highlighted in gold.
  WHO USES IT: app/(main)/layout.tsx, the shared frame around every app page.
  Because it lives in a layout, Next.js keeps it on screen while only the page
  content changes, so it never flickers or jumps between pages.
  WHY THIS NAME: "AppNav" = the app's navigation. It ends in .tsx because it shows
  something on screen.
*/

// "use client" means this component also runs in the browser. It has to, because
// it needs to know which page the user is on right now to highlight the right link.
"use client";

// Link: Next.js's version of a normal link. It switches pages without reloading the whole site.
import Link from "next/link";
// usePathname: tells us the current address, like "/betslips", so we know what to highlight.
import { usePathname } from "next/navigation";
// The three menu pictures, from the file next to this one.
import { BetSlipIcon, HomeIcon, SettingsIcon } from "./NavIcons";

/*
  NAV_ITEMS: the three menu links. To add a fourth link later, add it here.
  "matches" decides when a link counts as "the page you're on". Home stays
  highlighted on the league, matchup, team, and player pages, because those are
  all part of browsing games.
*/
const NAV_ITEMS = [
  {
    href: "/",
    label: "Home",
    Icon: HomeIcon,
    matches: (path: string) =>
      path === "/" ||
      ["/league", "/matchup", "/team", "/player"].some((start) =>
        path.startsWith(start),
      ),
  },
  {
    href: "/betslips",
    label: "Bet Slips",
    Icon: BetSlipIcon,
    matches: (path: string) => path.startsWith("/betslips"),
  },
  {
    href: "/settings",
    label: "Settings",
    Icon: SettingsIcon,
    matches: (path: string) => path.startsWith("/settings"),
  },
] as const;

/*
  AppNav: draws the menu. Both the phone bar and the desktop sidebar come from
  the same list, and CSS decides which shape to show based on screen width.
  - Phone/tablet: "fixed inset-x-4 bottom-4" floats the bar 16px above the bottom edge.
  - Desktop ("lg:" means 1024px and wider): it moves to a full-height column on the left.
*/
export default function AppNav() {
  const pathname = usePathname();

  return (
    // <nav> plus aria-label lets screen-reader users jump straight to "Main menu".
    <nav
      aria-label="Main menu"
      className="fixed inset-x-4 bottom-4 z-40 rounded-3xl border border-line bg-card/95 shadow-lg shadow-black/50 backdrop-blur
                 lg:inset-x-auto lg:bottom-0 lg:left-0 lg:top-0 lg:w-60 lg:rounded-none lg:border-y-0 lg:border-l-0 lg:shadow-none"
    >
      {/* The app name, only on the desktop sidebar. On phones each page shows it at the top instead. */}
      <p className="hidden px-6 pb-6 pt-8 font-display text-2xl text-gold lg:block">
        The Vegas Backroom
      </p>

      <ul className="flex justify-around lg:flex-col lg:gap-1 lg:px-3">
        {NAV_ITEMS.map(({ href, label, Icon, matches }) => {
          const isActive = matches(pathname);
          return (
            <li key={href} className="flex-1 lg:flex-none">
              <Link
                href={href}
                // aria-current="page" tells screen readers "you are here".
                aria-current={isActive ? "page" : undefined}
                className={`flex flex-col items-center gap-1 rounded-2xl px-3 py-2.5 text-xs font-medium transition-colors
                            lg:flex-row lg:gap-3 lg:px-4 lg:py-3 lg:text-sm
                            ${
                              isActive
                                ? "text-gold lg:bg-card-raised"
                                : "text-muted hover:text-text"
                            }`}
              >
                <Icon />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
