/*
  FILE: app/(main)/layout.tsx
  WHAT IT'S FOR: The shared frame around every page that's part of the app itself
  (Feed, league, matchup, team, player, Bet Slips, Settings). It adds the menu and
  leaves room for it so page content never hides behind the menu.
  WHO USES IT: Next.js wraps every page inside the app/(main) folder with it.
  WHY THIS NAME: "layout" is the name Next.js requires. The folder name "(main)" has
  parentheses, which makes it a "route group": a folder used only for organizing,
  so it does NOT show up in the web address (/settings, not /main/settings). We use
  it so the login and sign up pages, which live in app/(auth), don't get the menu.
  It ends in .tsx because it shows something on screen.
*/

// The menu (bottom bar on phones, sidebar on desktop) from the components folder.
import AppNav from "@/components/nav/AppNav";

/*
  MainLayout: puts the page content and the menu side by side.
  - A "Skip to main content" link comes first. It's invisible until a keyboard
    user presses Tab, and it lets them jump past the menu.
  - pb-32 leaves empty space at the bottom on phones so the floating bar never
    covers the last item on the page.
  - lg:pl-60 pushes content right on desktop to make room for the 240px sidebar.
*/
export default function MainLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-gold focus:px-4 focus:py-2 focus:text-bg"
      >
        Skip to main content
      </a>
      <AppNav />
      <main
        id="main-content"
        className="min-h-screen px-4 pb-32 pt-6 sm:px-6 lg:pb-10 lg:pl-66 lg:pr-10"
      >
        {children}
      </main>
    </>
  );
}
