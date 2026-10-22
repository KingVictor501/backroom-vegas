/*
  FILE: components/PagePlaceholder.tsx
  WHAT IT'S FOR: A simple "coming soon" box with a page title. Each page shows it
  until we build that page's real content in a later section.
  WHO USES IT: Every page.tsx under app/(main) and app/(auth) for now.
  WHY THIS NAME: It's a placeholder for a page. It ends in .tsx because it shows
  something on screen.
*/

/*
  PagePlaceholderProps: what a page passes in.
  - title: the big heading, e.g. "Bet Slips".
  - description: one sentence about what the page will do.
  - section: which build section fills it in, so we remember the plan.
  - children: optional extra content (like a link) shown under the text.
*/
type PagePlaceholderProps = {
  title: string;
  description: string;
  section: string;
  children?: React.ReactNode;
};

/*
  PagePlaceholder: draws the title and a dark gray card explaining what the page will become.
  It runs on the server only (no "use client"), so it's plain HTML in the browser.
*/
export default function PagePlaceholder({
  title,
  description,
  section,
  children,
}: PagePlaceholderProps) {
  return (
    <section className="mx-auto w-full max-w-3xl">
      <h1 className="text-3xl text-text">{title}</h1>
      <div className="mt-4 rounded-2xl border border-line bg-card p-5">
        <p className="text-muted">{description}</p>
        <p className="mt-3 text-sm text-gold">Coming in {section}.</p>
        {children}
      </div>
    </section>
  );
}
