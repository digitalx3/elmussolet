// Public sitemap generator. No auth required.
// Query params:
//   lang   - language code (e.g. ca, es). Defaults to default language.
//   host   - base URL to use (e.g. https://elmussolet.lovable.app). Defaults to PUBLIC_SITE_URL or request origin.
//   types  - comma list: static,products,pages,categories,brands. Default = all.
// Returns application/xml.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function xmlEscape(s: string) {
  return s.replace(/[<>&"']/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" }[c]!),
  );
}

function buildXml(entries: { loc: string; lastmod?: string | null }[]) {
  const urls = entries
    .map(
      (e) =>
        `  <url>\n    <loc>${xmlEscape(e.loc)}</loc>${
          e.lastmod ? `\n    <lastmod>${e.lastmod.slice(0, 10)}</lastmod>` : ""
        }\n  </url>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

// Per-language static routes available in the storefront.
const STATIC_ROUTES: Record<string, string[]> = {
  ca: ["/", "/cataleg", "/contacte", "/llista-naixement", "/politica-cookies"],
  es: ["/", "/cataleg", "/contacto", "/llista-naixement", "/politica-de-cookies"],
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const url = new URL(req.url);
    const lang = (url.searchParams.get("lang") || "ca").toLowerCase();
    const hostParam = url.searchParams.get("host");
    const host = (hostParam || `${url.protocol}//${url.host}`).replace(/\/$/, "");
    const types = (url.searchParams.get("types") || "static,products,pages,categories,brands")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const entries: { loc: string; lastmod?: string | null }[] = [];

    if (types.includes("static")) {
      const routes = STATIC_ROUTES[lang] || STATIC_ROUTES.ca;
      for (const r of routes) entries.push({ loc: `${host}${r}` });
    }

    if (types.includes("products")) {
      // Base products
      const { data: products } = await sb
        .from("products")
        .select("slug, updated_at, is_active")
        .eq("is_active", true);
      const byId: Record<string, { slug: string; updated_at: string }> = {};
      for (const p of products || []) byId[p.slug] = { slug: p.slug, updated_at: p.updated_at };

      // Language-specific slugs override
      const { data: pt } = await sb
        .from("product_translations")
        .select("product_id, slug, products!inner(slug, updated_at, is_active)")
        .eq("language", lang)
        .eq("products.is_active", true);

      const handled = new Set<string>();
      for (const row of (pt || []) as any[]) {
        const slug = row.slug || row.products?.slug;
        if (!slug) continue;
        entries.push({ loc: `${host}/producte/${slug}`, lastmod: row.products?.updated_at });
        handled.add(row.products?.slug);
      }
      for (const p of products || []) {
        if (handled.has(p.slug)) continue;
        entries.push({ loc: `${host}/producte/${p.slug}`, lastmod: p.updated_at });
      }
    }

    if (types.includes("pages")) {
      const { data: pages } = await sb
        .from("cms_blocks")
        .select("slug, updated_at")
        .eq("kind", "page")
        .eq("is_active", true);
      for (const p of pages || []) entries.push({ loc: `${host}/pagina/${p.slug}`, lastmod: p.updated_at });
    }

    if (types.includes("categories")) {
      const { data: cats } = await sb
        .from("categories")
        .select("slug, updated_at, is_active")
        .eq("is_active", true);
      const { data: ct } = await sb
        .from("category_translations")
        .select("category_id, slug, categories!inner(slug, updated_at, is_active)")
        .eq("language", lang)
        .eq("categories.is_active", true);
      const handled = new Set<string>();
      for (const row of (ct || []) as any[]) {
        const slug = row.slug || row.categories?.slug;
        if (!slug) continue;
        entries.push({ loc: `${host}/cataleg/${slug}`, lastmod: row.categories?.updated_at });
        handled.add(row.categories?.slug);
      }
      for (const c of cats || []) {
        if (handled.has(c.slug)) continue;
        entries.push({ loc: `${host}/cataleg/${c.slug}`, lastmod: c.updated_at });
      }
    }

    if (types.includes("brands")) {
      const { data: brands } = await sb
        .from("brands")
        .select("slug, updated_at, is_active")
        .eq("is_active", true);
      for (const b of brands || []) entries.push({ loc: `${host}/cataleg?brand=${b.slug}`, lastmod: b.updated_at });
    }

    const xml = buildXml(entries);
    return new Response(xml, {
      status: 200,
      headers: {
        ...cors,
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=600",
      },
    });
  } catch (e) {
    return new Response(`<!-- error: ${String(e)} -->`, {
      status: 500,
      headers: { ...cors, "Content-Type": "application/xml" },
    });
  }
});
