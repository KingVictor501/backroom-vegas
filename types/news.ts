/*
  FILE: types/news.ts
  WHAT IT'S FOR: What a news article looks like in the app.
  WHO USES IT: types/team.ts and types/player.ts. Later: the news API route and the
  NFL news widget on the Feed (Section 14).
  WHY THIS NAME: It describes news, in the types folder. It ends in .ts because it
  shows nothing on screen.
*/

/*
  NewsArticle: one news story.
  SECURITY: headline and description are always PLAIN TEXT. News sometimes arrives
  with HTML tags in it. The server code that fetches news (Section 5) strips those
  tags out before the article ever reaches a page, so nothing from a news site can
  run as code in the app. That's how we avoid dangerouslySetInnerHTML.
*/
export type NewsArticle = {
  /** The article's ID from ESPN, used as a unique key in lists. */
  id: string;
  /** The headline, as plain text. */
  headline: string;
  /** A short summary, as plain text. Can be empty. */
  description: string;
  /** Web address of the article's picture, or null if it has none. */
  imageUrl: string | null;
  /** A description of the picture for screen readers (alt text). */
  imageAlt: string;
  /** Link to the full article on ESPN. */
  url: string;
  /** When it was published, as ISO date-time text. */
  publishedAt: string;
};
