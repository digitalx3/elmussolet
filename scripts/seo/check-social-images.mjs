#!/usr/bin/env node
/**
 * Runtime SEO check: for each route, after Helmet hydrates, the DOM must
 * contain exactly ONE <meta property="og:image"> and exactly ONE
 * <meta name="twitter:image">. For /marca/:slug, both must point at the
 * resolved brand logo (not the sitewide fallback).
 *
 * Runs against the dev server at http://localhost:8080.
 * Requires Python's pre-installed Playwright (chromium headless).
 *
 * Usage:
 *   node scripts/seo/check-social-images.mjs [brandSlug]
 *
 * Exit code is non-zero on any failed assertion so CI can gate on it.
 */
import { spawnSync } from "node:child_process";

const BASE = process.env.SEO_CHECK_BASE_URL ?? "http://localhost:8080";
const BRAND_SLUG = process.argv[2] ?? "aeromoov";

const ROUTES = [
  { path: "/", name: "home" },
  { path: "/catalog", name: "catalog" },
  { path: `/marca/${BRAND_SLUG}`, name: "brand", requireBrandImage: true },
  { path: `/marca/__definitely-missing-${Date.now()}`, name: "brand-404" },
];

const py = `
import asyncio, json, sys
from playwright.async_api import async_playwright

BASE = ${JSON.stringify(BASE)}
ROUTES = json.loads(${JSON.stringify(JSON.stringify(ROUTES))})

async def inspect(page, route):
    await page.goto(BASE + route["path"], wait_until="networkidle")
    # Give Helmet a tick to flush mutations.
    await page.wait_for_timeout(400)
    data = await page.evaluate("""() => {
        const og = Array.from(document.querySelectorAll('meta[property="og:image"]')).map(m => m.content);
        const tw = Array.from(document.querySelectorAll('meta[name="twitter:image"]')).map(m => m.content);
        return { og, tw };
    }""")
    return data

async def main():
    results = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        ctx = await browser.new_context(viewport={"width": 1280, "height": 1200})
        # Bypass maintenance gate if present.
        await ctx.add_init_script("window.sessionStorage.setItem('maintenance-bypass','1')")
        page = await ctx.new_page()
        for r in ROUTES:
            data = await inspect(page, r)
            results.append({"route": r, "data": data})
        await browser.close()
    print(json.dumps(results))

asyncio.run(main())
`;

const proc = spawnSync("python3", ["-c", py], { encoding: "utf8" });
if (proc.status !== 0) {
  console.error("Playwright runner failed:", proc.stderr);
  process.exit(2);
}

let results;
try {
  results = JSON.parse(proc.stdout.trim().split("\n").pop());
} catch (e) {
  console.error("Could not parse runner output:", proc.stdout);
  process.exit(2);
}

let failed = 0;
for (const { route, data } of results) {
  const errors = [];
  if (data.og.length !== 1) errors.push(`og:image count = ${data.og.length} (expected 1)`);
  if (data.tw.length !== 1) errors.push(`twitter:image count = ${data.tw.length} (expected 1)`);
  if (route.requireBrandImage && data.og[0]) {
    const looksLikeBrand =
      /brand-logos|\/brands\//i.test(data.og[0]) || data.og[0].includes(BRAND_SLUG);
    if (!looksLikeBrand) {
      errors.push(`og:image does not look like a brand logo: ${data.og[0]}`);
    }
    if (data.tw[0] !== data.og[0]) {
      errors.push(`twitter:image (${data.tw[0]}) does not match og:image (${data.og[0]})`);
    }
  }
  const status = errors.length ? "FAIL" : "PASS";
  console.log(`[${status}] ${route.name} (${route.path})`);
  console.log(`        og:image    = ${JSON.stringify(data.og)}`);
  console.log(`        twitter:img = ${JSON.stringify(data.tw)}`);
  for (const e of errors) console.log(`        - ${e}`);
  if (errors.length) failed++;
}

if (failed) {
  console.error(`\n${failed} route(s) failed social-image checks.`);
  process.exit(1);
}
console.log("\nAll routes pass social-image checks.");
