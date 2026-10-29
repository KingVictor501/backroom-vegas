/*
  FILE: components/legal/legal.test.ts
  WHAT IT'S FOR: Automatic tests for the product basics. They draw the footer and the two legal pages as
  plain HTML and check that the required words and links are there: the "for reference only" disclaimer,
  the 21+ notice, the 1-800-GAMBLER help line and website, links to /privacy and /terms, and the
  "template, not legal advice" notice on both legal pages.
  WHO USES IT: Vitest, when you run `npm test`.
  WHY THIS NAME: It tests the legal and notice pieces. It ends in .ts (not .tsx) because it only builds them with createElement.
*/

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import PrivacyPage from "@/app/(legal)/privacy/page";
import TermsPage from "@/app/(legal)/terms/page";
import SiteFooter from "@/components/SiteFooter";

const footer = renderToStaticMarkup(createElement(SiteFooter));

describe("SiteFooter", () => {
  it("has the reference-only disclaimer and the 21+ notice", () => {
    expect(footer).toContain("For reference only");
    expect(footer).toContain("You must be 21 or older");
  });
  it("has a tap-to-call help line and the website", () => {
    expect(footer).toContain("1-800-GAMBLER");
    expect(footer).toContain('href="tel:18004262537"');
    expect(footer).toContain('href="https://www.ncpgambling.org"');
    // The outside link can't reach back into our page.
    expect(footer).toContain('rel="noopener noreferrer"');
  });
  it("links to the Privacy Policy and Terms of Use", () => {
    expect(footer).toContain('href="/privacy"');
    expect(footer).toContain('href="/terms"');
  });
});

describe("legal pages", () => {
  it.each([
    ["Privacy Policy", PrivacyPage],
    ["Terms of Use", TermsPage],
  ])("%s has its heading and the template notice", (heading, Page) => {
    const html = renderToStaticMarkup(createElement(Page));
    expect(html).toContain(heading);
    expect(html).toContain("not legal advice");
  });
  it("the Terms mention the age rule, the help line, and no real bets", () => {
    const html = renderToStaticMarkup(createElement(TermsPage));
    expect(html).toContain("21 or older");
    expect(html).toContain("1-800-GAMBLER");
    expect(html).toContain("doesn&#x27;t take bets");
  });
  it("the Privacy Policy says passwords are hashed and how to delete the account", () => {
    const html = renderToStaticMarkup(createElement(PrivacyPage));
    expect(html).toContain("hashed");
    expect(html).toContain("Deleting your account");
  });
});
