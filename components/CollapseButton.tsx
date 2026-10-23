/*
  FILE: components/CollapseButton.tsx
  WHAT IT'S FOR: A "Collapse" button for the BOTTOM of an open collapsible
  section (a <details> box), so after scrolling through a long section you
  don't have to scroll back up to close it. It closes the section it's inside,
  then brings that section's heading back into view and puts the keyboard
  focus on it, so you don't lose your place.
  It only shows while the section is open (it's inside the part that opens and closes).
  WHO USES IT: components/team/TeamSections.tsx (Key players).
  WHY THIS NAME: It's a button that collapses a section. It ends in .tsx because it shows something on screen.
*/

// "use client": closing the section on a click needs to run in the browser.
"use client";

/*
  CollapseButton
  - label: what screen readers hear, like "Collapse key players"
*/
export default function CollapseButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(event) => {
        const section = event.currentTarget.closest("details");
        if (!section) return;
        section.open = false;
        const heading = section.querySelector("summary");
        heading?.scrollIntoView({ block: "nearest" });
        heading?.focus();
      }}
      className="mx-auto flex min-h-11 items-center gap-1.5 rounded-xl border border-money/60 px-4 text-sm font-semibold text-money hover:bg-money hover:text-bg"
    >
      Collapse
      {/* The same arrow as the heading, pointing up. */}
      <svg aria-hidden viewBox="0 0 20 20" className="size-5 rotate-180" fill="currentColor">
        <path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4Z" />
      </svg>
    </button>
  );
}
