/*
  FILE: app/(auth)/layout.tsx
  WHAT IT'S FOR: The frame around the login and sign up pages. It centers the
  content and has NO menu, because someone who isn't logged in can't use Home,
  Bet Slips, or Settings yet.
  WHO USES IT: Next.js wraps app/(auth)/login/page.tsx and app/(auth)/signup/page.tsx with it.
  WHY THIS NAME: "layout" is required by Next.js. "(auth)" (short for
  "authentication", meaning proving who you are) is a route group: the parentheses
  keep it out of the web address, so the page is /login, not /auth/login.
  It ends in .tsx because it shows something on screen.
*/

/*
  AuthLayout: the app name in gold, with the login or sign up page centered below it.
  "main" marks the most important part of the page for screen readers.
*/
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="flex min-h-[calc(100vh-var(--notice-h))] flex-col items-center justify-center px-4 py-10">
      <p className="mb-8 font-display text-4xl text-gold">The Vegas Backroom</p>
      <div className="w-full max-w-md">{children}</div>
    </main>
  );
}
