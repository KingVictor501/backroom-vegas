/*
  FILE: components/legal/TemplateNotice.tsx
  WHAT IT'S FOR: The yellow-outlined box at the top of the Privacy Policy and Terms of Use saying the
  wording is a starting template, not legal advice, and should be reviewed before real launch.
  WHO USES IT: app/(legal)/privacy/page.tsx and app/(legal)/terms/page.tsx.
  WHY THIS NAME: It's the "this is a template" notice. It ends in .tsx because it shows something on screen.
*/

/* TemplateNotice: draws the box. role="note" tells screen readers it is a side remark. */
export default function TemplateNotice() {
  return (
    <p role="note" className="rounded-xl border border-gold/60 bg-card p-4 text-sm text-gold">
      Template for review: this wording is a starting point written for a class project. It is not legal advice, and a
      lawyer should review it before the site is promoted beyond classmates and graders.
    </p>
  );
}
