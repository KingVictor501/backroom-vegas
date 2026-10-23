/*
  FILE: components/feed/SearchBar.tsx
  WHAT IT'S FOR: The wide, rounded "Find a team or player" search bar at the
  top of the Feed. It does two things at once (the choice you made in Section 9):
  1. Whatever you type filters the game cards below instantly (GameBrowser does that).
  2. After 2 letters, it also lists matching teams and players from our own
     /api/search route, so you can tap one to open their page.
  The browser only ever talks to OUR server, never to ESPN directly.
  WHO USES IT: components/feed/GameBrowser.tsx.
  WHY THIS NAME: It's the search bar. It ends in .tsx because it shows something on screen.
*/

"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
// The shared search result type (a team or a player), from the types folder.
import type { SearchResult } from "@/types";

/* MIN_LETTERS: searching starts after this many letters (the /api/search route needs at least 2). */
const MIN_LETTERS = 2;

/*
  Suggestions: the results AND the words they're for. Keeping the words lets
  us ignore results that arrive after you've already typed something else.
*/
type Suggestions = { query: string; results: SearchResult[] };

/*
  SearchBar
  - value / onChange: the text, kept by GameBrowser so it can filter the games
*/
export default function SearchBar({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [suggestions, setSuggestions] = useState<Suggestions>({ query: "", results: [] });
  const inputId = useId();
  const query = value.trim();

  /*
    Ask /api/search 300 ms after you stop typing (not on every key press).
    If you keep typing, the old request is canceled ("abort").
    If the search fails, we just show no suggestions. The game filter still works.
  */
  useEffect(() => {
    if (query.length < MIN_LETTERS) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        if (!response.ok) return;
        const results: SearchResult[] = await response.json();
        setSuggestions({ query, results: results.slice(0, 6) });
      } catch {
        // Canceled or offline: no suggestions this time.
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  // Only show suggestions that belong to what's typed right now.
  const results = query.length >= MIN_LETTERS && suggestions.query === query ? suggestions.results : [];

  return (
    // role="search" tells screen readers this is the search area. Pressing Enter doesn't reload the page.
    <form role="search" onSubmit={(event) => event.preventDefault()}>
      <label htmlFor={inputId} className="sr-only">
        Find a team or player
      </label>
      <div className="flex items-center gap-2 rounded-full border border-line bg-card px-4 focus-within:border-gold">
        <svg aria-hidden viewBox="0 0 24 24" className="size-5 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" strokeLinecap="round" />
        </svg>
        <input
          id={inputId}
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") onChange("");
          }}
          placeholder="Find a team or player"
          autoComplete="off"
          maxLength={50}
          className="min-h-12 w-full bg-transparent text-base text-text placeholder:text-muted focus:outline-none"
        />
      </div>

      {results.length > 0 && (
        <div className="mt-2 rounded-2xl border border-line bg-card p-2">
          <p className="px-2 pb-1 pt-1 text-xs font-medium uppercase tracking-wide text-muted">Teams and players</p>
          <ul>
            {results.map((result) => (
              <li key={`${result.kind}-${result.kind === "team" ? result.team.id : result.player.id}`}>
                {result.kind === "team" ? (
                  <Link href={`/team/${result.team.id}`} className="flex min-h-11 items-center justify-between rounded-xl px-2 text-sm hover:bg-card-raised">
                    <span className="font-medium text-text">{result.team.displayName}</span>
                    <span className="text-xs text-muted">Team</span>
                  </Link>
                ) : (
                  <Link href={`/player/${result.player.id}`} className="flex min-h-11 items-center justify-between rounded-xl px-2 text-sm hover:bg-card-raised">
                    <span className="font-medium text-text">{result.player.name}</span>
                    <span className="text-xs text-muted">
                      {[result.player.position, result.player.teamAbbreviation].filter(Boolean).join(" · ") || "Player"}
                    </span>
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </form>
  );
}
