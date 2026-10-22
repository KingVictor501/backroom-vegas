/*
  FILE: types/api.ts
  WHAT IT'S FOR: The shape of an error answer from the app's own API routes, so
  every route reports problems the same way and every page can read them the same way.
  WHO USES IT: Later: every route in app/api (Sections 6 and 7) and the pages that call them.
  WHY THIS NAME: It describes API answers, in the types folder. It ends in .ts
  because it shows nothing on screen.
*/

/*
  ApiErrorCode: a short label for what went wrong, for code to check.
*/
export type ApiErrorCode =
  | "unauthorized" // Not logged in (status 401)
  | "forbidden" // Logged in, but not allowed, like a website CORS doesn't allow (status 403)
  | "not-found" // That ID doesn't exist, or it isn't yours (status 404)
  | "invalid-input" // The data sent was missing or wrong (status 400)
  | "conflict" // Clashes with something that already exists, like a taken email (status 409)
  | "upstream-error" // An outside API (NFL, Odds, ESPN) failed (status 502)
  | "server-error"; // Something unexpected broke on our side (status 500)

/*
  ApiErrorResponse: what an API route sends back when something goes wrong.
  Example: { "error": { "code": "not-found", "message": "We couldn't find that bet slip." } }
  - message is friendly, plain English, safe to show the user.
  - fieldErrors (optional) says which form field was wrong, like { "name": "Names can be up to 50 characters." }.
*/
export type ApiErrorResponse = {
  error: {
    code: ApiErrorCode;
    message: string;
    fieldErrors?: Record<string, string>;
  };
};
