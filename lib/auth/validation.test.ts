/*
  FILE: lib/auth/validation.test.ts
  WHAT IT'S FOR: Automatic tests for the sign up / login rules:
  - which email endings are accepted (.com, .org, .mil, .edu, country endings, ...)
  - safeNextPath, the guard that decides where you go after logging in
    (?next=). It must keep you on this site, and refuse every "open redirect"
    trick that could send you to a fake website.
  Run them with: npm test
  WHO USES IT: Vitest. The app never loads this file.
  WHY THIS NAME: It tests validation.ts, right next to it. It ends in .ts because it shows nothing on screen.
*/

import { describe, expect, it } from "vitest";
import { hasAcceptedEnding, loginSchema, signupSchema, safeNextPath } from "./validation";

describe("safeNextPath (after-login redirect guard)", () => {
  it("keeps normal pages on this site", () => {
    expect(safeNextPath("/betslips")).toBe("/betslips");
    expect(safeNextPath("/matchup/401873022?props=passing")).toBe("/matchup/401873022?props=passing");
    expect(safeNextPath("/settings")).toBe("/settings");
  });

  it("refuses other websites", () => {
    expect(safeNextPath("https://evil.example.com")).toBe("/");
    expect(safeNextPath("//evil.example.com")).toBe("/");
    expect(safeNextPath("/\\evil.example.com")).toBe("/");
    expect(safeNextPath("javascript:alert(1)")).toBe("/");
  });

  it("refuses hidden tabs and line breaks (browsers delete them, turning /<tab>/evil.com into //evil.com)", () => {
    expect(safeNextPath("/\t/evil.example.com")).toBe("/");
    expect(safeNextPath("/\n/evil.example.com")).toBe("/");
    expect(safeNextPath("/\r/evil.example.com")).toBe("/");
    expect(safeNextPath("/\u0000/evil.example.com")).toBe("/");
  });

  it("refuses anything that isn't text, and the login pages themselves", () => {
    expect(safeNextPath(undefined)).toBe("/");
    expect(safeNextPath(42)).toBe("/");
    expect(safeNextPath("/login")).toBe("/");
    expect(safeNextPath("/signup?next=/x")).toBe("/");
  });
});

describe("accepted email endings", () => {
  it("accepts common and country endings", () => {
    for (const email of ["you@gmail.com", "you@navy.mil", "you@school.edu", "you@agency.gov", "you@team.org", "you@company.io", "you@school.co.uk", "you@shop.ca"]) {
      expect(hasAcceptedEnding(email), email).toBe(true);
    }
  });

  it("refuses typos and uncommon endings", () => {
    for (const email of ["you@gmail.con", "you@gmail.cmo", "you@site.xyz", "you@localhost"]) {
      expect(hasAcceptedEnding(email), email).toBe(false);
    }
  });

  it("sign up and login both show the friendly message", () => {
    const signup = signupSchema.safeParse({ email: "you@gmail.con", password: "Password123", confirmPassword: "Password123" });
    const login = loginSchema.safeParse({ email: "you@site.xyz", password: "anything" });
    expect(signup.success).toBe(false);
    expect(login.success).toBe(false);
    expect(signup.error?.issues[0]?.message).toContain("Use an email ending in .com");
    expect(login.error?.issues[0]?.message).toContain("Use an email ending in .com");
  });

  it("still lowercases and trims the email", () => {
    const login = loginSchema.safeParse({ email: "  You@Gmail.COM ", password: "x" });
    expect(login.success && login.data.email).toBe("you@gmail.com");
  });
});
