/*
  FILE: app/(main)/player/[playerId]/loading.tsx
  WHAT IT'S FOR: The loading screen for the player page. Next.js shows it
  instantly when you tap a player's name, while the server gets their stats,
  so the screen never sits blank. It's gray "skeleton" shapes where the photo,
  stats, and tables will appear.
  WHO USES IT: Next.js, automatically, for the player page.
  WHY THIS NAME: "loading" is the name Next.js requires. It ends in .tsx because it shows something on screen.
*/

/* Bar: one gray placeholder shape. animate-pulse makes it gently fade in and out. */
function Bar({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-xl bg-card-raised ${className}`} />;
}

/* PlayerLoading: the same layout as the real page, in gray. */
export default function PlayerLoading() {
  return (
    <div className="mx-auto max-w-4xl space-y-5" aria-busy="true">
      <p className="sr-only" role="status">
        Loading the player…
      </p>
      <div className="flex items-center gap-4 rounded-2xl border border-line bg-card p-5">
        <Bar className="size-24 shrink-0 rounded-full" />
        <div className="flex-1 space-y-2">
          <Bar className="h-7 w-48" />
          <Bar className="h-4 w-24" />
          <Bar className="h-4 w-36" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 rounded-2xl border border-line bg-card p-5 sm:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((box) => (
          <Bar key={box} className="h-16" />
        ))}
      </div>
      <Bar className="h-48 w-full rounded-2xl" />
    </div>
  );
}
