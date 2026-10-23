/*
  FILE: lib/api/cors.ts
  WHAT IT'S FOR: The CORS rules for the app's API routes.

  WHAT IS CORS? (plain English)
  Browsers have a safety rule: a page from one website can't read answers from
  another website's API unless that API says "I allow you". CORS ("Cross-Origin
  Resource Sharing") is how the API says it, with a response header called
  Access-Control-Allow-Origin. An "origin" is a website's address, like
  http://localhost:3000 or https://your-app.vercel.app.
  - Our rule: ONLY our own website(s), listed in ALLOWED_ORIGINS, are allowed.
    Never "*" (every website).
  - CORS only controls BROWSERS. Postman, scripts, and servers ignore it. So
    CORS is not a lock. The real protection is the login check on every route.
    CORS just stops other websites from using a visitor's browser to read our API.

  WHO USES IT: proxy.ts, which runs before every /api request.
  WHY THIS NAME: It's the CORS code for the API. It ends in .ts because it shows nothing on screen.
*/

/*
  normalizeOrigin: tidies one address so tiny typos don't break matching:
  removes spaces and a trailing slash, and makes it lowercase.
  " https://My-App.vercel.app/ " → "https://my-app.vercel.app"
*/
function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/+$/, "").toLowerCase();
}

/*
  getAllowedOrigins: the list from ALLOWED_ORIGINS (comma-separated), tidied.
  In .env.local it's http://localhost:3000. In Vercel it's your live address.
  A "*" in the list is ignored on purpose. We never allow every website.
*/
export function getAllowedOrigins(): string[] {
  return (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map(normalizeOrigin)
    .filter((origin) => origin !== "" && origin !== "*");
}

/*
  isAllowedOrigin: true if this website address is on our list.
*/
export function isAllowedOrigin(origin: string): boolean {
  return getAllowedOrigins().includes(normalizeOrigin(origin));
}

/*
  corsHeaders: the "you're allowed" headers for an allowed website.
  - Allow-Origin: echoes back the exact allowed address (never "*").
  - Allow-Credentials: lets the browser send the login cookie.
  - Allow-Methods / Allow-Headers: which kinds of requests are allowed.
  - Vary: Origin: tells caches the answer depends on who's asking.
  - Max-Age: browsers can remember this permission for 10 minutes.
*/
export function corsHeaders(origin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}
