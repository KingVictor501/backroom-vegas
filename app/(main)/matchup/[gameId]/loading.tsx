/*
  FILE: app/(main)/matchup/[gameId]/loading.tsx
  WHAT IT'S FOR: The loading screen for the matchup page. Next.js shows it
  instantly when you tap a game, while the server gets the odds, so the screen
  never sits blank. It's gray "skeleton" shapes where the logos, tabs, and
  odds will appear.
  WHO USES IT: Next.js, automatically, for every page in the matchup folder.
  WHY THIS NAME: "loading" is the name Next.js requires. It ends in .tsx because
  it shows something on screen.
*/

/* Bar: one gray placeholder shape. animate-pulse makes it gently fade in and out. */
function Bar({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-xl bg-card-raised ${className}`} />;
}

/* MatchupLoading: the same layout as the real page, in gray. */
export default function MatchupLoading() {
  return (
    <div className="mx-auto max-w-3xl space-y-5" aria-busy="true">
      <p className="sr-only" role="status">
        Loading the matchup…
      </p>
      <div className="flex justify-between rounded-2xl border border-line bg-card p-6">
        {[0, 1].map((side) => (
          <div key={side} className="flex flex-1 flex-col items-center gap-2">
            <Bar className="size-16 rounded-full sm:size-20" />
            <Bar className="h-5 w-28" />
            <Bar className="h-3 w-12" />
          </div>
        ))}
      </div>
      <div className="flex gap-3">
        <Bar className="h-12 w-48 rounded-full" />
        <Bar className="h-12 w-44 rounded-full" />
      </div>
      <div className="flex gap-2 overflow-hidden">
        {[0, 1, 2, 3, 4].map((tab) => (
          <Bar key={tab} className="h-10 w-28 shrink-0 rounded-full" />
        ))}
      </div>
      <Bar className="h-40 w-full rounded-2xl" />
    </div>
  );
}
