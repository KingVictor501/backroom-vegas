/*
  FILE: app/(main)/player/[playerId]/not-found.tsx
  WHAT IT'S FOR: What you see for a player that doesn't exist, like
  /player/999999999 or /player/abc. The menu and bet slip stay on screen.
  WHO USES IT: Next.js, when the player page calls notFound().
  WHY THIS NAME: "not-found" is the name Next.js requires. It ends in .tsx because it shows something on screen.
*/

// The shared "not found" box from components/NotFoundCard.tsx.
import NotFoundCard from "@/components/NotFoundCard";

/* PlayerNotFound: the "player not found" message. */
export default function PlayerNotFound() {
  return <NotFoundCard title="Player not found" message="We couldn't find that player. The link may have a typo." />;
}
