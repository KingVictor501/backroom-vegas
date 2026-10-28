/*
  FILE: components/SiteNotice.test.ts
  WHAT IT'S FOR: Automatic tests for the yellow notice bar (SiteNotice.tsx): it shows the text
  from config/siteNotice.ts in a yellow bar that screen readers announce, and it draws nothing
  at all when the notice is turned off (null).
  WHO USES IT: Vitest, when you run `npm test`.
  WHY THIS NAME: It tests SiteNotice.tsx, right next to it. It ends in .ts (not .tsx) because it only
  builds the bar with createElement and shows nothing itself.
*/

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

describe("SiteNotice", () => {
  it("shows the configured text in a yellow, announced bar", async () => {
    vi.resetModules();
    vi.doMock("@/config/siteNotice", () => ({ SITE_NOTICE: "Site maintenance taking place, some data may be missing and you may experience errors." }));
    const { default: SiteNotice } = await import("./SiteNotice");
    const html = renderToStaticMarkup(createElement(SiteNotice));
    expect(html).toContain("Site maintenance taking place, some data may be missing and you may experience errors.");
    expect(html).toContain('role="status"');
    expect(html).toContain("bg-yellow-400");
  });

  it("draws nothing when the notice is turned off", async () => {
    vi.resetModules();
    vi.doMock("@/config/siteNotice", () => ({ SITE_NOTICE: null }));
    const { default: SiteNotice } = await import("./SiteNotice");
    expect(renderToStaticMarkup(createElement(SiteNotice))).toBe("");
  });

  it("the real setting contains the maintenance message", async () => {
    vi.resetModules();
    vi.doUnmock("@/config/siteNotice");
    const { SITE_NOTICE } = await import("@/config/siteNotice");
    expect(SITE_NOTICE).toContain("Site maintenance taking place");
  });
});
