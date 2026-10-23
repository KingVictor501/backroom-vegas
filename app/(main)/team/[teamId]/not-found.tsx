/*
  FILE: app/(main)/team/[teamId]/not-found.tsx
  WHAT IT'S FOR: What you see for a team that doesn't exist, like /team/999 or
  /team/abc. The menu and bet slip stay on screen.
  WHO USES IT: Next.js, when the team page calls notFound().
  WHY THIS NAME: "not-found" is the name Next.js requires. It ends in .tsx because it shows something on screen.
*/

// The shared "not found" box from components/NotFoundCard.tsx.
import NotFoundCard from "@/components/NotFoundCard";

/* TeamNotFound: the "team not found" message. */
export default function TeamNotFound() {
  return <NotFoundCard title="Team not found" message="We couldn't find that team. The link may have a typo." />;
}
