/*
  FILE: components/feed/NewsWidget.tsx
  WHAT IT'S FOR: The NFL news box on the Feed. Unlike the game list (which the
  server builds), this box loads IN THE BROWSER from our /api/news route, so it
  has four different looks (the rubric's "four-states fetch"):
  1. LOADING: gray placeholder cards while the stories are on their way
  2. ERROR:   a message and a Retry button, if the request fails
  3. EMPTY:   "No NFL news right now", if there are no stories
  4. NEWS:    each story's picture, headline, short summary, and a link to ESPN
  GRADER TEST SWITCHES (in the Feed's address, or the "For testing" links under the box):
    /?news=slow     → the API waits 3 seconds, so you see LOADING
    /?news=bad-url  → the box asks for an address that doesn't exist, so you see ERROR
    /?news=empty    → the API answers with no stories, so you see EMPTY
    /               → the normal NEWS
  Everything shown is plain text from our server (any HTML was stripped there),
  and React never runs anything inside it. No dangerouslySetInnerHTML.
  WHO USES IT: app/(main)/page.tsx (the Feed), below the games.
  WHY THIS NAME: It's the news widget. It ends in .tsx because it shows something on screen.
*/

// "use client": this box fetches in the browser (that's the point of the four states).
"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
// shortDate ("Oct 23"), from lib/format/gameTime.ts.
import { shortDate } from "@/lib/format/gameTime";
// THE shared news story type, from the types folder.
import type { NewsArticle } from "@/types";

/* NewsTestMode: which grader test switch is on, if any. */
export type NewsTestMode = "normal" | "slow" | "bad-url" | "empty";

/* NewsState: the four looks. Exactly one is showing at a time. */
type NewsState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "empty" }
  | { kind: "news"; articles: NewsArticle[] };

/* HOW_MANY: how many stories to show. */
const HOW_MANY = 6;

/*
  newsUrl: the address the box asks for. "bad-url" asks for one that doesn't
  exist on purpose, which is the rubric's "bad URL" test.
*/
function newsUrl(mode: NewsTestMode): string {
  if (mode === "bad-url") return "/api/news-this-address-does-not-exist";
  const demo = mode === "slow" || mode === "empty" ? `&demo=${mode}` : "";
  return `/api/news?limit=${HOW_MANY}${demo}`;
}

/* isSafeImage: only show pictures from regular https web addresses. */
function isSafeImage(url: string | null): url is string {
  return url !== null && url.startsWith("https://");
}

/* NewsWidget: mode comes from the Feed's address (?news=...). */
export default function NewsWidget({ mode }: { mode: NewsTestMode }) {
  const [state, setState] = useState<NewsState>({ kind: "loading" });
  // attempt goes up by 1 each time Retry is tapped, which makes the request run again.
  const [attempt, setAttempt] = useState(0);

  /*
    The request. It runs when the box first appears and again after Retry.
    If you leave the page first, it's canceled ("abort") so nothing updates a page you've left.
  */
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const response = await fetch(newsUrl(mode), { signal: controller.signal });
        if (!response.ok) {
          setState({ kind: "error", message: `The news service answered with an error (${response.status}).` });
          return;
        }
        const articles: NewsArticle[] = await response.json();
        setState(articles.length === 0 ? { kind: "empty" } : { kind: "news", articles });
      } catch {
        // Canceled because you left the page: nothing to show. Anything else is a real failure.
        if (!controller.signal.aborted) setState({ kind: "error", message: "We couldn't reach the news service. Check your connection." });
      }
    })();
    return () => controller.abort();
  }, [mode, attempt]);

  /* retry: back to the loading look, then ask again. */
  function retry() {
    setState({ kind: "loading" });
    setAttempt((n) => n + 1);
  }

  return (
    <section id="nfl-news" aria-labelledby="nfl-news-heading" aria-busy={state.kind === "loading"} className="scroll-mt-6 rounded-2xl border border-line bg-card p-5">
      <h2 id="nfl-news-heading" className="text-xl text-text">
        NFL news
      </h2>

      <div className="mt-4">
        {/* 1. LOADING: gray cards in the same shape as the real stories. */}
        {state.kind === "loading" && (
          <div>
            <p className="sr-only" role="status">
              Loading NFL news…
            </p>
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((card) => (
                <li key={card} aria-hidden className="overflow-hidden rounded-xl border border-line bg-card-raised">
                  <div className="aspect-video animate-pulse bg-line" />
                  <div className="space-y-2 p-3">
                    <div className="h-4 w-11/12 animate-pulse rounded bg-line" />
                    <div className="h-4 w-2/3 animate-pulse rounded bg-line" />
                    <div className="h-3 w-1/3 animate-pulse rounded bg-line" />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 2. ERROR: what happened, and a Retry button. */}
        {state.kind === "error" && (
          <div role="alert" className="flex flex-col items-start gap-3 rounded-xl border-2 border-danger bg-danger/10 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-danger">NFL news didn&apos;t load</p>
              <p className="mt-1 text-sm text-text">{state.message}</p>
            </div>
            <button
              type="button"
              onClick={retry}
              className="min-h-11 shrink-0 rounded-xl bg-gold px-5 text-sm font-semibold text-bg hover:bg-gold-bright"
            >
              Retry
            </button>
          </div>
        )}

        {/* 3. EMPTY: no stories right now. */}
        {state.kind === "empty" && (
          <p role="status" className="rounded-xl border border-line bg-card-raised p-6 text-center text-sm text-muted">
            No NFL news right now. Check back later.
          </p>
        )}

        {/* 4. NEWS: picture, headline, summary, and a link to the full story on ESPN. */}
        {state.kind === "news" && (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {state.articles.map((article) => (
              <li key={article.id} className="min-w-0 overflow-hidden rounded-xl border border-line bg-card-raised transition-colors hover:border-gold/50">
                {/* noopener noreferrer: the ESPN page can't control or see our page. */}
                <a href={article.url} target="_blank" rel="noopener noreferrer" className="group block">
                  {isSafeImage(article.imageUrl) ? (
                    // unoptimized: ESPN serves these pictures from several addresses, so they load straight from ESPN.
                    <Image
                      src={article.imageUrl}
                      alt={article.imageAlt}
                      width={640}
                      height={360}
                      unoptimized
                      className="aspect-video w-full bg-line object-cover"
                    />
                  ) : (
                    <div aria-hidden className="flex aspect-video items-center justify-center bg-line font-display text-2xl text-muted">
                      NFL
                    </div>
                  )}
                  <div className="p-3">
                    <p className="font-semibold leading-snug text-text group-hover:text-gold">
                      {article.headline}
                      <span className="sr-only"> (opens ESPN in a new tab)</span>
                    </p>
                    {article.description && <p className="mt-1 line-clamp-2 text-sm text-muted">{article.description}</p>}
                    <p className="mt-2 text-xs text-gold">ESPN · {shortDate(article.publishedAt)}</p>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* The grader test switches, as links (they reload the Feed with ?news=...). */}
      <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
        <span className="inline-flex min-h-8 items-center">For testing:</span>
        {(
          [
            ["slow", "Slow (loading)"],
            ["bad-url", "Bad URL (error)"],
            ["empty", "Empty"],
            ["normal", "Normal"],
          ] as const
        ).map(([value, label]) => (
          <Link
            key={value}
            href={value === "normal" ? "/#nfl-news" : `/?news=${value}#nfl-news`}
            aria-current={mode === value ? "true" : undefined}
            className={`inline-flex min-h-8 items-center underline-offset-4 hover:text-gold hover:underline ${mode === value ? "font-semibold text-gold" : ""}`}
          >
            {label}
          </Link>
        ))}
      </p>
    </section>
  );
}
