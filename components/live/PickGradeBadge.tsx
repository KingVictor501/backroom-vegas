/*
  FILE: components/live/PickGradeBadge.tsx
  WHAT IT'S FOR: The small badge on a pick showing where it stands: Pending, Winning, Losing, Push, Live
  (when we can't tell, like a prop with no box score yet), and once decided Won, Lost, or Push.
  Color is never the only signal: the word itself is always there, with a symbol.
  WHO USES IT: components/betslips/SlipDetail.tsx.
  WHY THIS NAME: It's the badge for a pick's grade. It ends in .tsx because it shows something on screen.
*/

import { gradeLabel } from "@/lib/betting/grading";
import type { PickGrade } from "@/types";

/* STYLE: the look for each kind of result. */
function style(grade: PickGrade): { symbol: string; className: string } {
  if (grade.phase === "pending") return { symbol: "○", className: "border-line text-muted" };
  if (grade.outcome === null) return { symbol: "●", className: "border-gold text-gold" };
  if (grade.outcome === "push") return { symbol: "＝", className: "border-muted text-text" };
  if (grade.outcome === "win") {
    return { symbol: "✓", className: grade.phase === "final" ? "border-money bg-money/20 text-money" : "border-money text-money" };
  }
  return { symbol: "✕", className: grade.phase === "final" ? "border-danger bg-danger/20 text-danger" : "border-danger text-danger" };
}

/* PickGradeBadge: e.g. "✓ Winning". */
export default function PickGradeBadge({ grade }: { grade: PickGrade }) {
  const { symbol, className } = style(grade);
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${className}`}>
      <span aria-hidden>{symbol}</span>
      {gradeLabel(grade)}
    </span>
  );
}
