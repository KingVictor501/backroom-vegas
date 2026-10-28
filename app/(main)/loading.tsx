/*
  FILE: app/(main)/loading.tsx
  WHAT IT'S FOR: The "catch-all" loading screen for every app page that doesn't
  have its own: the Feed, league pages, Settings, New slip, the Bet Slips list,
  and the team page. Next.js shows it instantly while the server gets the page's
  data, so the screen never sits blank. The menu and slip bar stay put around it
  (they live in the shared layout). Pages with their own loading.tsx (matchup,
  player, and one slip) still use theirs.
  WHO USES IT: Next.js, automatically, for any page inside app/(main) without a closer loading.tsx.
  WHY THIS NAME: "loading" is the name Next.js requires. It ends in .tsx because it shows something on screen.
*/

/* Bar: one gray placeholder shape. animate-pulse makes it gently fade in and out. */
function Bar({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-xl bg-card-raised ${className}`} />;
}

/*
  MainLoading: a plain page shape in gray: a title bar, then a few cards.
  "min-w-0" and "grid-cols-1" keep it from widening the page on phones.
  sr-only text is read aloud by screen readers but not shown on screen.
*/
export default function MainLoading() {
  return (
    <div className="mx-auto max-w-4xl space-y-5" aria-busy="true">
      <p className="sr-only" role="status">
        Loading…
      </p>
      <Bar className="h-8 w-48" />
      <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
        {[0, 1, 2, 3].map((card) => (
          <div key={card} className="min-w-0 space-y-3 rounded-2xl border border-line bg-card p-5">
            <Bar className="h-5 w-2/3" />
            <Bar className="h-12 w-full" />
            <Bar className="h-5 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}
