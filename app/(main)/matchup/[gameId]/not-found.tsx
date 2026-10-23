/*
  FILE: app/(main)/matchup/[gameId]/not-found.tsx
  WHAT IT'S FOR: What you see for a game that doesn't exist, like
  /matchup/999999999 or /matchup/abc. It keeps the app's menu and slip on
  screen (unlike the site-wide not-found page) and points back to the Feed.
  WHO USES IT: Next.js, when the matchup page calls notFound().
  WHY THIS NAME: "not-found" is the name Next.js requires. It ends in .tsx
  because it shows something on screen.
*/

// The shared "not found" box from components/NotFoundCard.tsx.
import NotFoundCard from "@/components/NotFoundCard";

/* MatchupNotFound: the "game not found" message. */
export default function MatchupNotFound() {
  return <NotFoundCard title="Game not found" message="We couldn't find that game. It may have been removed, or the link has a typo." />;
}
