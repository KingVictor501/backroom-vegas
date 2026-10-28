/*
  FILE: lib/api/respond.ts
  WHAT IT'S FOR: Shared helpers every API route uses, so they all behave the same:
  - apiError(): sends an error in our standard shape (types/api.ts)
  - withUser(): runs a route only for logged-in users (401 otherwise), and
    turns any crash or outside-API failure into a friendly JSON error
  - parseQuery(): checks the ?settings in the address (like ?league=nfl) with zod
  - parseJsonBody(): checks the JSON data sent with a POST or PATCH with zod
  WHO USES IT: Every route in app/api (Sections 6 and 7).
  WHY THIS NAME: It's how the API responds. It ends in .ts because it shows nothing on screen.
*/

import "server-only";
import { z } from "zod";
// getCurrentUser from lib/auth/dal.ts: checks the login cookie AND that the user exists.
import { getCurrentUser } from "@/lib/auth/dal";
// UpstreamError from lib/services/http.ts: thrown when ESPN or The Odds API fails.
import { UpstreamError } from "@/lib/services/http";
// logServerError from lib/logging/safeLog.ts: logs a short error line with secrets blanked out.
import { logServerError } from "@/lib/logging/safeLog";
// The shared error shape and the User type, from the types folder.
import type { ApiErrorCode, ApiErrorResponse, User } from "@/types";

/*
  apiError: a JSON error answer, like
  { "error": { "code": "not-found", "message": "We couldn't find that game." } }
*/
export function apiError(
  code: ApiErrorCode,
  message: string,
  status: number,
  fieldErrors?: Record<string, string>,
): Response {
  const body: ApiErrorResponse = { error: { code, message, ...(fieldErrors && { fieldErrors }) } };
  return Response.json(body, { status });
}

/*
  withUser: wraps a route's code so that:
  1. Not logged in → 401 "Please log in." (the code never runs).
  2. The code gets the logged-in user (for their sportsbook, and later their bet slips).
  3. If ESPN or The Odds API fails → 502 with a friendly message (no white screen).
  4. Any other crash → 500 with a friendly message. Details only go to the server log.
  Logging in is required so strangers can't use our server to spend your Odds API credits.
*/
export async function withUser(run: (user: User) => Promise<Response>): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return apiError("unauthorized", "Please log in.", 401);

  try {
    return await run(user);
  } catch (error) {
    if (error instanceof UpstreamError) {
      console.error(error.message);
      return apiError(
        "upstream-error",
        `${error.source} isn't responding right now. Please try again in a minute.`,
        502,
      );
    }
    // Cleaned-up log line (no whole error object), so a database error can't leak connection details.
    logServerError("API route failed:", error);
    return apiError("server-error", "Something went wrong on our side. Please try again.", 500);
  }
}

/*
  parseQuery: checks the address's ?settings against a zod schema.
  Gives back { ok: true, data } or { ok: false, response }, where response is a
  ready-made 400 error that says which setting was wrong, like
  { "fieldErrors": { "category": "Choose touchdowns, passing, rushing, receiving, or receptions." } }
*/
export function parseQuery<Schema extends z.ZodType>(
  request: Request,
  schema: Schema,
): Parsed<z.infer<Schema>> {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = schema.safeParse(params);
  if (parsed.success) return { ok: true, data: parsed.data };
  return {
    ok: false,
    response: apiError(
      "invalid-input",
      "Some of the request's settings are missing or wrong.",
      400,
      toFieldErrors(parsed.error.issues, "query"),
    ),
  };
}

/*
  Parsed: what parseQuery and parseJsonBody give back. Either the checked data,
  or a ready-made error response to send.
*/
type Parsed<Data> = { ok: true; data: Data } | { ok: false; response: Response };

/*
  toFieldErrors: turns zod's list of problems into { "field": "message" }, one
  message per field. Fields inside lists are named by their position, like
  "picks.0.odds" (the first pick's odds), so you can see exactly what's wrong.
*/
function toFieldErrors(issues: z.core.$ZodIssue[], fallback: string): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) {
    const field = issue.path.length > 0 ? issue.path.map(String).join(".") : fallback;
    fieldErrors[field] ??= issue.message;
  }
  return fieldErrors;
}

/** The biggest body we accept: about 100 KB. A full 25-pick slip is around 15 KB. */
const MAX_BODY_CHARACTERS = 100_000;

/*
  parseJsonBody: reads and checks the JSON data sent with a POST or PATCH.
  1. It must be marked as JSON (Content-Type: application/json), or it gets 415.
     This also helps block sneaky form posts from other websites.
  2. It can't be huge (413).
  3. It must be real JSON (400).
  4. It must follow the schema's rules (400, with fieldErrors saying what's wrong).
*/
export async function parseJsonBody<Schema extends z.ZodType>(
  request: Request,
  schema: Schema,
): Promise<Parsed<z.infer<Schema>>> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return {
      ok: false,
      response: apiError("invalid-input", "Send the data as JSON (Content-Type: application/json).", 415),
    };
  }

  const text = await request.text();
  if (text.length > MAX_BODY_CHARACTERS) {
    return { ok: false, response: apiError("invalid-input", "That's too much data for one request.", 413) };
  }

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return { ok: false, response: apiError("invalid-input", "That isn't valid JSON.", 400) };
  }

  const parsed = schema.safeParse(body);
  if (parsed.success) return { ok: true, data: parsed.data };
  return {
    ok: false,
    response: apiError(
      "invalid-input",
      "Some of the data is missing or wrong.",
      400,
      toFieldErrors(parsed.error.issues, "body"),
    ),
  };
}
