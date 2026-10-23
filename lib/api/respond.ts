/*
  FILE: lib/api/respond.ts
  WHAT IT'S FOR: Shared helpers every API route uses, so they all behave the same:
  - apiError(): sends an error in our standard shape (types/api.ts)
  - withUser(): runs a route only for logged-in users (401 otherwise), and
    turns any crash or outside-API failure into a friendly JSON error
  - parseQuery(): checks the ?settings in the address (like ?league=nfl) with zod
  WHO USES IT: Every route in app/api (Sections 6 and 7).
  WHY THIS NAME: It's how the API responds. It ends in .ts because it shows nothing on screen.
*/

import "server-only";
import { z } from "zod";
// getCurrentUser from lib/auth/dal.ts: checks the login cookie AND that the user exists.
import { getCurrentUser } from "@/lib/auth/dal";
// UpstreamError from lib/services/http.ts: thrown when ESPN or The Odds API fails.
import { UpstreamError } from "@/lib/services/http";
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
    console.error("API route failed:", error);
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
): { ok: true; data: z.infer<Schema> } | { ok: false; response: Response } {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = schema.safeParse(params);
  if (parsed.success) return { ok: true, data: parsed.data };

  const fieldErrors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const field = String(issue.path[0] ?? "query");
    fieldErrors[field] ??= issue.message;
  }
  return {
    ok: false,
    response: apiError("invalid-input", "Some of the request's settings are missing or wrong.", 400, fieldErrors),
  };
}
