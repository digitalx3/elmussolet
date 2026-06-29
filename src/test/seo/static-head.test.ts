import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Static invariants for index.html.
 * Sitewide og:image / twitter:image must NOT be hard-coded here — the global
 * fallback is injected via <Helmet> in src/App.tsx so per-route pages
 * (e.g. CatalogPage on /marca/:slug) can fully override it without leaving
 * duplicate image tags in the DOM.
 */
describe("index.html social image invariants", () => {
  const html = readFileSync(path.resolve(__dirname, "../../../index.html"), "utf8");

  it("contains no static og:image", () => {
    expect(/property=["']og:image["']/i.test(html)).toBe(false);
  });

  it("contains no static twitter:image", () => {
    expect(/name=["']twitter:image["']/i.test(html)).toBe(false);
  });

  it("does not duplicate canonical / description tags", () => {
    const canonicals = html.match(/<link[^>]+rel=["']canonical["']/gi) ?? [];
    expect(canonicals.length).toBeLessThanOrEqual(1);
    const descriptions = html.match(/<meta[^>]+name=["']description["']/gi) ?? [];
    expect(descriptions.length).toBeLessThanOrEqual(1);
  });
});
