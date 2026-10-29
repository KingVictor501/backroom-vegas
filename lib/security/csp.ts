/*
  FILE: lib/security/csp.ts
  WHAT IT'S FOR: Builds the Content-Security-Policy (CSP) header. A CSP is a list the browser checks before it loads
  anything on a page: "scripts may only come from our own site (and ones that carry this page's secret code, called a
  nonce), pictures only from us and ESPN, nothing may be framed, forms only post to us". So even if an attacker got
  a <script> tag into a page somehow, the browser would refuse to run it.
  The nonce is a fresh random code made for every page view (proxy.ts makes it). Next.js reads it from the header and
  stamps it on its own scripts and styles automatically (Next.js docs: "Content Security Policy" guide).
  WHAT EACH PART DOES:
  - default-src 'self': anything not listed below may only come from our own site
  - script-src ... 'strict-dynamic': our scripts and the ones they load; no inline scripts without the nonce
  - style-src: our CSS file and nonce-stamped styles; style-src-attr allows only the style="..." attributes React
    writes (the "Chance of winning" bar width), never <style> tags
  - img-src: us, data: and blob: pictures, and ESPN's picture servers (team logos, headshots, news photos)
  - font-src 'self': fonts are downloaded at build time by next/font and served by us
  - connect-src 'self': the browser may only talk to our own site (it never calls ESPN or The Odds API)
  - object-src 'none', base-uri 'self', form-action 'self', frame-ancestors 'none': no plug-ins, no tricks with
    <base>, forms only post to us, and nobody may frame us
  - upgrade-insecure-requests: in production, plain http links are upgraded to https
  In development ONLY, it also allows 'unsafe-eval' (React's debugging tools need it) and web sockets (hot reload).
  WHO USES IT: proxy.ts. Tests: lib/security/csp.test.ts.
  WHY THIS NAME: It builds the CSP. It ends in .ts because it shows nothing on screen.
*/

/* ESPN_IMAGE_HOSTS: ESPN's picture servers. The wildcard covers a.espncdn.com, s.espncdn.com, and so on. */
export const ESPN_IMAGE_SOURCE = "https://*.espncdn.com";

/* buildCsp: the header text for one page view. `nonce` is that view's random code. */
export function buildCsp(nonce: string, isDevelopment: boolean): string {
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDevelopment ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'nonce-${nonce}'`,
    "style-src-attr 'unsafe-inline'",
    `img-src 'self' data: blob: ${ESPN_IMAGE_SOURCE}`,
    "font-src 'self'",
    `connect-src 'self'${isDevelopment ? " ws: wss:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDevelopment ? [] : ["upgrade-insecure-requests"]),
  ];
  return directives.join("; ");
}

/* makeNonce: a fresh unguessable code (random bytes written as text) for one page view. */
export function makeNonce(): string {
  return Buffer.from(crypto.randomUUID()).toString("base64");
}
