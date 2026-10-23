/*
  FILE: components/NewsList.tsx
  WHAT IT'S FOR: A list of news stories: headline (opens the full story on
  ESPN in a new tab), a short summary, and the date. Everything is already
  plain text (the server strips any HTML), so nothing in a story can run as code.
  WHO USES IT: the team page (components/team/TeamSections.tsx) and the player page.
  WHY THIS NAME: It lists news. It ends in .tsx because it shows something on screen.
*/

// shortDate ("Oct 18") from lib/format/gameTime.ts.
import { shortDate } from "@/lib/format/gameTime";
import type { NewsArticle } from "@/types";

/* NewsList: shows "No news right now." when the list is empty. */
export default function NewsList({ articles }: { articles: NewsArticle[] }) {
  if (articles.length === 0) return <p className="text-sm text-muted">No news right now.</p>;
  return (
    <ul className="divide-y divide-line">
      {articles.map((article) => (
        <li key={article.id} className="py-3">
          {/* noopener noreferrer: the ESPN page can't control or see our page. */}
          <a href={article.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-text hover:text-gold">
            {article.headline}
            <span className="sr-only"> (opens ESPN in a new tab)</span>
          </a>
          {article.description && <p className="mt-1 line-clamp-2 text-xs text-muted">{article.description}</p>}
          <p className="mt-1 text-xs text-muted">{shortDate(article.publishedAt)}</p>
        </li>
      ))}
    </ul>
  );
}
