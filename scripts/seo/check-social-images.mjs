#!/usr/bin/env node
/**
 * Runtime SEO check: for each route, after Helmet hydrates, the DOM must
 * contain exactly ONE <meta property="og:image">, ONE <meta name="twitter:image">,
 * ONE <meta property="og:title"> and ONE <meta property="og:description">.
 *
 * For /marca/:slug, og:image must point at the resolved brand logo, and
 * og:title / og:description must reflect the brand (i.e. differ from the
 * sitewide fallback captured on "/").
 *
 * Runs against the dev server at http://localhost:8080.
 *
 * Usage:
 *   node scripts/seo/check-social-images.mjs [brandSlug]
 *
 * Exit code is non-zero on any failed assertion so CI can gate on it.
 */
import { spawnSync } from "node:child_process";

const BASE = process.env.SEO_CHECK_BASE_URL ?? "http://localhost:8080";
const BRAND_SLUG = process.argv[2] ?? "ikid";

const ROUTES = [
  { path: "/", name: "home", isHome: true },
  { path: "/catalog", name: "catalog" },
  { path: `/marca/${BRAND_SLUG}`, name: "brand", requireBrandImage: true, requireBrandMeta: true },
  { path: `/marca/__definitely-missing-${Date.now()}`, name: "brand-404" },
];

const py = `
import asyncio, json, sys
from playwright.async_api import async_playwright

BASE = ${JSON.stringify(BASE)}
ROUTES = json.loads(${JSON.stringify(JSON.stringify(ROUTES))})

async def inspect(page, route):
    await page.goto(BASE + route["path"], wait_until="networkidle")
    if route.get("requireBrandImage") or route.get("requireBrandMeta"):
        try:
            await page.wait_for_function(
                "() => document.title && document.title !== 'El Mussolet'",
                timeout=8000,
            )
        except Exception:
            pass
    await page.wait_for_timeout(1200)
    data = await page.evaluate("""() => {
        const all = (sel) => Array.from(document.querySelectorAll(sel)).map(m => m.content);
        return {
            ogImage: all('meta[property="og:image"]'),
            twImage: all('meta[name="twitter:image"]'),
            ogTitle: all('meta[property="og:title"]'),
            ogDesc:  all('meta[property="og:description"]'),
            twTitle: all('meta[name="twitter:title"]'),
            twDesc:  all('meta[name="twitter:description"]'),
            title: document.title,
        };
    }""")
    return data

async def main():
    results = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        ctx = await browser.new_context(viewport={"width": 1280, "height": 1200})
        bypass_state = (
            "window.sessionStorage.setItem('maintenance.state.v1',"
            "JSON.stringify({ts:Date.now(),state:{enabled:false,bypass:true,show_logo:true,message_ca:'',message_es:''}}))"
        )
        await ctx.add_init_script(bypass_state)
        await ctx.route(
            "**/functions/v1/check-maintenance-access",
            lambda r: r.fulfill(
                status=200,
                content_type="application/json",
                body='{"enabled":false,"bypass":true,"show_logo":true,"message_ca":"","message_es":""}',
            ),
        )
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

// Capture home fallback to compare brand routes against.
const home = results.find((r) => r.route.isHome)?.data;
const homeOgTitle = home?.ogTitle?.[0];
const homeOgDesc = home?.ogDesc?.[0];

let failed = 0;
for (const { route, data } of results) {
  const errors = [];
  const expectOne = (label, arr) => {
    if (arr.length !== 1) errors.push(`${label} count = ${arr.length} (expected 1)`);
  };
  expectOne("og:image", data.ogImage);
  expectOne("twitter:image", data.twImage);
  expectOne("og:title", data.ogTitle);
  expectOne("og:description", data.ogDesc);

  if (route.requireBrandImage && data.ogImage[0]) {
    const looksLikeBrand =
      /brand-logos|\/brands\//i.test(data.ogImage[0]) || data.ogImage[0].includes(BRAND_SLUG);
    if (!looksLikeBrand) {
      errors.push(`og:image does not look like a brand logo: ${data.ogImage[0]}`);
    }
    if (data.twImage[0] !== data.ogImage[0]) {
      errors.push(`twitter:image (${data.twImage[0]}) does not match og:image (${data.ogImage[0]})`);
    }
  }

  if (route.requireBrandMeta) {
    if (data.ogTitle[0] && homeOgTitle && data.ogTitle[0] === homeOgTitle) {
      errors.push(`og:title equals sitewide fallback (${JSON.stringify(homeOgTitle)})`);
    }
    if (data.ogDesc[0] && homeOgDesc && data.ogDesc[0] === homeOgDesc) {
      errors.push(`og:description equals sitewide fallback (${JSON.stringify(homeOgDesc)})`);
    }
    if (data.ogTitle[0] && data.title && data.ogTitle[0] !== data.title) {
      errors.push(`og:title (${JSON.stringify(data.ogTitle[0])}) does not match document.title (${JSON.stringify(data.title)})`);
    }
    if (data.twTitle[0] && data.twTitle[0] !== data.ogTitle[0]) {
      errors.push(`twitter:title does not match og:title`);
    }
    if (data.twDesc[0] && data.twDesc[0] !== data.ogDesc[0]) {
      errors.push(`twitter:description does not match og:description`);
    }
  }

  const status = errors.length ? "FAIL" : "PASS";
  console.log(`[${status}] ${route.name} (${route.path})`);
  console.log(`        og:image    = ${JSON.stringify(data.ogImage)}`);
  console.log(`        twitter:img = ${JSON.stringify(data.twImage)}`);
  console.log(`        og:title    = ${JSON.stringify(data.ogTitle)}`);
  console.log(`        og:desc     = ${JSON.stringify(data.ogDesc)}`);
  for (const e of errors) console.log(`        - ${e}`);
  if (errors.length) failed++;
}

if (failed) {
  console.error(`\n${failed} route(s) failed social-meta checks.`);
  process.exit(1);
}
console.log("\nAll routes pass social-meta checks.");
