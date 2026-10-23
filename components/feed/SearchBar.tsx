/*
  FILE: components/feed/SearchBar.tsx
  WHAT IT'S FOR: The wide, rounded "Find a team or player" search bar at the
  top of the Feed. It does two things at once (the choice you made in Section 9):
  1. Whatever you type filters the game cards below instantly (GameBrowser does that).
  2. After 2 letters, it also lists matching teams and players from our own
     /api/search route. Tap one to open their page, or use the keyboard:
     ↓ / ↑ move through the list, Enter opens the highlighted one (or the first
     one if none is highlighted), and Escape clears the search.
     If nothing matches, it says so.
  The browser only ever talks to OUR server, never to ESPN directly.
  For screen readers it follows the standard "combobox" pattern: the text box
  tells them which suggestion is highlighted (aria-activedescendant).
  WHO USES IT: components/feed/GameBrowser.tsx.
  WHY THIS NAME: It's the search bar. It ends in .tsx because it shows something on screen.
*/

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState, type KeyboardEvent } from "react";
// The shared search result type (a team or a player), from the types folder.
import type { SearchResult } from "@/types";
// The red "you made a mistake" box from components/ErrorMessage.tsx.
import ErrorMessage from "@/components/ErrorMessage";

/* MIN_LETTERS: searching starts after this many letters (the /api/search route needs at least 2). */
const MIN_LETTERS = 2;

/*
  Suggestions: the results AND the words they're for. Keeping the words lets
  us ignore results that arrive after you've already typed something else.
*/
type Suggestions = { query: string; results: SearchResult[] };

/* hrefFor: where a result goes, a team page or a player page. */
function hrefFor(result: SearchResult): string {
  return result.kind === "team" ? `/team/${result.team.id}` : `/player/${result.player.id}`;
}

/*
  fetchSuggestions: asks /api/search for up to 6 teams and players.
  Gives back null if the search couldn't run (offline, or canceled).
*/
async function fetchSuggestions(query: string, signal?: AbortSignal): Promise<SearchResult[] | null> {
  try {
    const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal });
    if (!response.ok) return null;
    const results: SearchResult[] = await response.json();
    return results.slice(0, 6);
  } catch {
    return null;
  }
}

/*
  SearchBar
  - value / onChange: the text, kept by GameBrowser so it can filter the games
*/
export default function SearchBar({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const router = useRouter();
  const [suggestions, setSuggestions] = useState<Suggestions>({ query: "", results: [] });
  // Which suggestion the arrow keys have highlighted, for which words (-1 = none).
  const [highlight, setHighlight] = useState<{ query: string; index: number }>({ query: "", index: -1 });
  const inputId = useId();
  const listId = useId();
  const query = value.trim();

  /*
    Ask /api/search 300 ms after you stop typing (not on every key press).
    If you keep typing, the old request is canceled ("abort").
  */
  useEffect(() => {
    if (query.length < MIN_LETTERS) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const results = await fetchSuggestions(query, controller.signal);
      if (results) setSuggestions({ query, results });
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  // Only use suggestions (and a highlight) that belong to what's typed right now.
  const ready = query.length >= MIN_LETTERS && suggestions.query === query;
  const results = ready ? suggestions.results : [];
  const active = highlight.query === query ? highlight.index : -1;
  const optionId = (index: number) => `${listId}-option-${index}`;

  /* open: goes to a result's page. */
  function open(result: SearchResult) {
    router.push(hrefFor(result));
  }

  /* onKeyDown: the keyboard controls described at the top of this file. */
  async function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (results.length === 0) return;
      event.preventDefault(); // stops the cursor jumping to the start or end of the text
      const step = event.key === "ArrowDown" ? 1 : -1;
      // Wraps around: ↓ on the last one goes back to the first.
      const next = active === -1 ? (step === 1 ? 0 : results.length - 1) : (active + step + results.length) % results.length;
      setHighlight({ query, index: next });
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (query.length < MIN_LETTERS) return;
      if (results.length > 0) return open(results[active === -1 ? 0 : active]);
      // Pressed Enter before the search finished: search right now, then open the first match.
      if (!ready) {
        const now = await fetchSuggestions(query);
        if (now) {
          setSuggestions({ query, results: now });
          if (now.length > 0) open(now[0]);
        }
      }
    } else if (event.key === "Escape") {
      onChange("");
    }
  }

  const showList = results.length > 0;
  const showNoMatch = ready && results.length === 0;

  return (
    // role="search" tells screen readers this is the search area. The form never reloads the page.
    <form role="search" onSubmit={(event) => event.preventDefault()}>
      <label htmlFor={inputId} className="sr-only">
        Find a team or player
      </label>
      <div className="flex items-center gap-2 rounded-full border border-line bg-card px-4 focus-within:border-gold focus-within:ring-2 focus-within:ring-gold/40">
        <svg aria-hidden viewBox="0 0 24 24" className="size-5 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" strokeLinecap="round" />
        </svg>
        <input
          id={inputId}
          type="search"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? optionId(active) : undefined}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Find a team or player"
          autoComplete="off"
          maxLength={50}
          // The rounded box around it turns gold when you're typing, so the box itself doesn't need its own (square) outline.
          // appearance-none turns off Safari's built-in search box look, which draws its own rectangle when you click in.
          // The shadow-none and ring-0 parts make sure no browser adds a focus glow of its own.
          className="min-h-12 w-full appearance-none rounded-none border-0 bg-transparent text-base text-text shadow-none ring-0 placeholder:text-muted focus:shadow-none focus:outline-none focus:ring-0 focus-visible:outline-none"
        />
      </div>

      {showList && (
        <div className="mt-2 rounded-2xl border border-line bg-card p-2">
          <p className="px-2 pb-1 pt-1 text-xs font-medium uppercase tracking-wide text-muted" aria-hidden>
            Teams and players · ↓ ↑ to choose, Enter to open
          </p>
          {/* listbox / option: the standard way to tell screen readers "this is a list of choices". */}
          <ul id={listId} role="listbox" aria-label="Teams and players">
            {results.map((result, index) => {
              const isActive = index === active;
              const key = `${result.kind}-${result.kind === "team" ? result.team.id : result.player.id}`;
              return (
                <li
                  key={key}
                  id={optionId(index)}
                  role="option"
                  aria-selected={isActive}
                  // onMouseDown + preventDefault keeps the text box focused while you click.
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => open(result)}
                  onMouseEnter={() => setHighlight({ query, index })}
                  className={`flex min-h-11 cursor-pointer items-center justify-between rounded-xl px-2 text-sm ${
                    isActive ? "bg-card-raised outline outline-1 outline-gold" : "hover:bg-card-raised"
                  }`}
                >
                  {result.kind === "team" ? (
                    <>
                      <span className="font-medium text-text">{result.team.displayName}</span>
                      <span className="text-xs text-muted">Team</span>
                    </>
                  ) : (
                    <>
                      <span className="font-medium text-text">{result.player.name}</span>
                      <span className="text-xs text-muted">
                        {[result.player.position, result.player.teamAbbreviation].filter(Boolean).join(" · ") || "Player"}
                      </span>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* aria-live: screen readers hear "No teams or players match…" when it appears (shown in red). */}
      <div aria-live="polite" className={showNoMatch ? "mt-2" : "sr-only"}>
        {showNoMatch && (
          <ErrorMessage alert={false}>No teams or players match &quot;{query}&quot;. Check the spelling and try again.</ErrorMessage>
        )}
      </div>
    </form>
  );
}
