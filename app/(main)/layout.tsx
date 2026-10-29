/*
  FILE: app/(main)/layout.tsx
  WHAT IT'S FOR: The shared frame around every page that's part of the app itself
  (Feed, league, matchup, team, player, Bet Slips, Settings). It adds the menu,
  the bet slip (bar on phones and tablets, panel on the right on desktop), and
  leaves room for both so page content never hides behind them.
  WHO USES IT: Next.js wraps every page inside the app/(main) folder with it.
  WHY THIS NAME: "layout" is the name Next.js requires. The folder name "(main)" has
  parentheses, which makes it a "route group": a folder used only for organizing,
  so it does NOT show up in the web address (/settings, not /main/settings). We use
  it so the login and sign up pages, which live in app/(auth), don't get the menu.
  It ends in .tsx because it shows something on screen.
*/

// The menu (bottom bar on phones, sidebar on desktop) from the components folder.
import AppNav from "@/components/nav/AppNav";
// The bet slip "brain" from components/betslip: odds buttons, slip bar, panel, and conflict popup.
import SiteFooter from "@/components/SiteFooter";
import BetSlipProvider from "@/components/betslip/BetSlipProvider";
// getCurrentUser from lib/auth/dal.ts: who's logged in (shared with the page, so it's only looked up once).
import { getCurrentUser } from "@/lib/auth/dal";
// getActiveBetSlip from lib/db/betslips.ts: the slip you're adding picks to, if any.
import { getActiveBetSlip } from "@/lib/db/betslips";

/*
  MainLayout: puts the page content, the menu, and the bet slip together.
  - It loads your active slip ON THE SERVER, so the slip bar is there the
    moment the page appears, with no flicker. Because it's a layout, Next.js
    keeps it (and your slip) on screen while you move between pages.
  - A "Skip to main content" link comes first. It's invisible until a keyboard
    user presses Tab, and it lets them jump past the menu.
  - pb-32 leaves empty space at the bottom on phones so the floating bar never
    covers the last item on the page.
  - lg:pl-66 makes room for the 240px sidebar on desktop, and xl:pr-86 makes
    room for the 320px slip panel at 1280px and wider.
*/
export default async function MainLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();
  const activeSlip = user ? await getActiveBetSlip(user) : null;

  return (
    <BetSlipProvider initialSlip={activeSlip}>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-gold focus:px-4 focus:py-2 focus:text-bg"
      >
        Skip to main content
      </a>
      <AppNav />
      <main
        id="main-content"
        className="min-h-[calc(100vh-var(--notice-h))] px-4 pb-32 pt-6 sm:px-6 lg:pb-10 lg:pl-66 lg:pr-10 xl:pr-86"
      >
        {children}
        <SiteFooter />
      </main>
    </BetSlipProvider>
  );
}
