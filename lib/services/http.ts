/*
  FILE: lib/services/http.ts
  WHAT IT'S FOR: The one helper every outside-API call goes through. It fetches a
  web address, gives up after 10 seconds, checks the answer is OK and is JSON,
  and checks the JSON has the shape we expect. If anything goes wrong it throws
  an UpstreamError with a friendly message, never the raw error or the web
  address (Odds API addresses contain your API key).
  WHO USES IT: lib/services/espn/client.ts and lib/services/odds/client.ts.
  WHY THIS NAME: "http" is the language web requests speak. It ends in .ts because
  it shows nothing on screen.
*/

// Keeps this on the server, so outside APIs are only ever called by our server, never by the browser.
import "server-only";
// zod checks the outside data has the fields we expect, so a surprise change shows a clear error instead of a crash.
import type { z } from "zod";

/** How long to wait for an outside API before giving up (10 seconds). */
const TIMEOUT_MS = 10_000;

/*
  UpstreamError: thrown when an outside API (ESPN or The Odds API) fails.
  "Upstream" = a service our server depends on. Pages and API routes catch this
  and show a friendly message instead of a white screen.
  - source: which API failed ("ESPN" or "The Odds API"), for the friendly message.
  - status: the error number it sent back (like 404 or 500), or null if it never answered (missing on purpose).
*/
export class UpstreamError extends Error {
  readonly source: string;
  readonly status: number | null;

  constructor(source: string, status: number | null, detail: string) {
    super(`${source} request failed: ${detail}`);
    this.name = "UpstreamError";
    this.source = source;
    this.status = status;
  }
}

/*
  JsonResponse: the checked data, plus the response headers (The Odds API puts
  your remaining credits in the headers).
*/
export type JsonResponse<T> = { data: T; headers: Headers };

/*
  fetchJson: fetches a URL and checks the JSON against a zod "schema" (a
  description of the expected shape).
  - source: a name for error messages ("ESPN" or "The Odds API").
  - label: what we were fetching (like "scoreboard"). Used in logs INSTEAD of the
    URL, so an API key in the URL never ends up in a log.
  - cache: "no-store" means don't cache the raw answer. We cache our own small,
    cleaned-up results instead (see lib/services/cache.ts), because some raw
    answers (ESPN injuries is about 17 MB) are too big for Next.js's cache.
*/
export async function fetchJson<Schema extends z.ZodType>(
  url: string,
  schema: Schema,
  options: { source: string; label: string; headers?: Record<string, string> },
): Promise<JsonResponse<z.infer<Schema>>> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: "application/json", ...options.headers },
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    // No answer at all: the network failed or it took longer than 10 seconds.
    throw new UpstreamError(options.source, null, `${options.label}: no response`);
  }

  if (!response.ok) {
    throw new UpstreamError(
      options.source,
      response.status,
      `${options.label}: status ${response.status}`,
    );
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    throw new UpstreamError(options.source, response.status, `${options.label}: not JSON`);
  }

  // Check the shape. safeParse never throws; it tells us whether the data matched.
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    // Log WHICH fields didn't match (helpful if the API changes), but not the data itself.
    console.error(
      `${options.source} ${options.label}: unexpected shape`,
      parsed.error.issues.slice(0, 5).map((issue) => issue.path.join(".")),
    );
    throw new UpstreamError(options.source, response.status, `${options.label}: unexpected shape`);
  }

  return { data: parsed.data, headers: response.headers };
}
