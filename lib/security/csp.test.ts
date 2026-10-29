/*
  FILE: lib/security/csp.test.ts
  WHAT IT'S FOR: Checks the Content-Security-Policy text: the nonce is in it, nothing is open to every website, and
  the development-only loosenings never reach production.
  WHO USES IT: `npm test` (Vitest).
  WHY THIS NAME: It tests csp.ts; ".test.ts" is how Vitest finds test files.
*/

import { describe, expect, it } from "vitest";
import { buildCsp, makeNonce } from "./csp";

describe("buildCsp (production)", () => {
  const csp = buildCsp("abc123", false);
  it("puts this view's nonce on scripts and styles", () => {
    expect(csp).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(csp).toContain("style-src 'self' 'nonce-abc123'");
  });
  it("allows no eval, no inline scripts, and no web sockets", () => {
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
    expect(csp).not.toContain("ws:");
  });
  it("blocks framing, plug-ins, and forms that post elsewhere", () => {
    for (const rule of ["frame-ancestors 'none'", "object-src 'none'", "form-action 'self'", "base-uri 'self'", "upgrade-insecure-requests"]) {
      expect(csp).toContain(rule);
    }
  });
  it("lets pictures come from us and ESPN only, and never uses a bare wildcard", () => {
    expect(csp).toContain("img-src 'self' data: blob: https://*.espncdn.com");
    expect(csp).not.toMatch(/(^|[\s;])\*([\s;]|$)/);
    expect(csp).not.toContain("https:;");
  });
  it("lets the browser talk only to our own site", () => {
    expect(csp).toContain("connect-src 'self'");
  });
});

describe("buildCsp (development)", () => {
  const csp = buildCsp("abc123", true);
  it("adds eval and web sockets (hot reload) and skips the https upgrade", () => {
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).toContain("ws:");
    expect(csp).not.toContain("upgrade-insecure-requests");
  });
});

describe("makeNonce", () => {
  it("is different every time", () => {
    expect(makeNonce()).not.toBe(makeNonce());
  });
});
