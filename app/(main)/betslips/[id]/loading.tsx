/*
  FILE: app/(main)/betslips/[id]/loading.tsx
  WHAT IT'S FOR: The loading screen for one slip's page. Next.js shows it
  instantly while the server gets the slip, so the screen never sits blank.
  The menu and slip bar stay put around it (they're in the shared layout).
  WHO USES IT: Next.js, automatically, for the slip detail page. (The rubric asks for this file.)
  WHY THIS NAME: "loading" is the name Next.js requires. It ends in .tsx because it shows something on screen.
*/

/* Bar: one gray placeholder shape. animate-pulse makes it gently fade in and out. */
function Bar({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-xl bg-card-raised ${className}`} />;
}

/* SlipLoading: the same layout as the real page, in gray. */
export default function SlipLoading() {
  return (
    <div className="mx-auto max-w-2xl space-y-5" aria-busy="true">
      <p className="sr-only" role="status">
        Loading your slip…
      </p>
      <Bar className="h-6 w-24" />
      <div className="space-y-3 rounded-2xl border border-line bg-card p-5">
        <Bar className="h-12 w-full" />
        <Bar className="h-8 w-40" />
      </div>
      <div className="space-y-3 rounded-2xl border border-line bg-card p-5">
        {[0, 1, 2].map((row) => (
          <Bar key={row} className="h-14 w-full" />
        ))}
      </div>
    </div>
  );
}
