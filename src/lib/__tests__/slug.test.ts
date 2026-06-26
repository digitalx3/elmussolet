import { describe, it, expect, vi, beforeEach } from "vitest";
import { slugify, isSlug, normalizeSlugInput, autoSlug } from "@/lib/slug";

describe("slugify", () => {
  it("normalizes accents, quotes and spaces", () => {
    expect(slugify("  Càmera de fotos!  ")).toBe("camera-de-fotos");
    expect(slugify("L'Òliba d'en Joan")).toBe("l-oliba-d-en-joan");
    expect(slugify("Té & Café")).toBe("te-and-cafe");
  });
  it("rejects invalid chars by collapsing them", () => {
    expect(slugify("Hola///mundo$$$2025")).toBe("hola-mundo-2025");
    expect(slugify("---foo---bar---")).toBe("foo-bar");
  });
  it("returns empty for null/whitespace", () => {
    expect(slugify(null)).toBe("");
    expect(slugify(undefined)).toBe("");
    expect(slugify("   ")).toBe("");
  });
  it("caps length to 80 and trims trailing dash", () => {
    const s = slugify("a".repeat(120));
    expect(s.length).toBeLessThanOrEqual(80);
    expect(s.endsWith("-")).toBe(false);
  });
});

describe("isSlug", () => {
  it("accepts canonical slugs only", () => {
    expect(isSlug("hello-world")).toBe(true);
    expect(isSlug("abc123")).toBe(true);
    expect(isSlug("-bad")).toBe(false);
    expect(isSlug("bad-")).toBe(false);
    expect(isSlug("Bad-Slug")).toBe(false);
    expect(isSlug("")).toBe(false);
  });
});

describe("normalizeSlugInput", () => {
  it("strips invalid chars while typing but keeps trailing dash", () => {
    expect(normalizeSlugInput("Hola Món")).toBe("hola-mon");
    expect(normalizeSlugInput("foo--bar")).toBe("foo-bar");
    expect(normalizeSlugInput("--foo")).toBe("foo");
    expect(normalizeSlugInput("foo-")).toBe("foo-");
  });
});

describe("autoSlug (per-language auto-fill)", () => {
  it("fills slug from name when empty", () => {
    expect(autoSlug("Cotxe blau", "", "")).toBe("cotxe-blau");
  });
  it("keeps following the name if slug was auto-generated", () => {
    // user changed CA name from "Cotxe" to "Cotxe blau"; slug was auto = "cotxe"
    expect(autoSlug("Cotxe blau", "Cotxe", "cotxe")).toBe("cotxe-blau");
  });
  it("preserves manual user edits", () => {
    expect(autoSlug("Cotxe blau", "Cotxe", "el-meu-cotxe")).toBe("el-meu-cotxe");
  });
  it("works independently per language", () => {
    // CA branch
    const ca = autoSlug("Cotxe blau", "Cotxe", "cotxe");
    // ES branch (different prev name, different current slug)
    const es = autoSlug("Coche azul", "Coche", "coche");
    expect(ca).toBe("cotxe-blau");
    expect(es).toBe("coche-azul");
  });
});

// ---------------------------------------------------------------------------
// Public product lookup: base slug + translated slug fallback
// ---------------------------------------------------------------------------

// We isolate the resolver logic so it can be tested without React Query.
async function resolveProductBySlug(
  supabase: any,
  slug: string,
): Promise<{ id: string } | null> {
  const baseRes = await supabase
    .from("products")
    .select("id")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  if (baseRes.data) return baseRes.data;

  const trRes = await supabase
    .from("product_translations")
    .select("product_id")
    .eq("slug", slug)
    .limit(1)
    .maybeSingle();
  if (!trRes.data?.product_id) return null;

  const byId = await supabase
    .from("products")
    .select("id")
    .eq("id", trRes.data.product_id)
    .eq("is_active", true)
    .maybeSingle();
  return byId.data ?? null;
}

function mockSupabase(rows: {
  products: { id: string; slug: string; is_active: boolean }[];
  translations: { product_id: string; slug: string }[];
}) {
  const make = (tableData: any[]) => {
    const builder: any = { _filters: {} as Record<string, any>, _table: tableData };
    builder.select = () => builder;
    builder.limit = () => builder;
    builder.eq = (col: string, val: any) => {
      builder._filters[col] = val;
      return builder;
    };
    builder.maybeSingle = async () => {
      const filters = builder._filters;
      const found = builder._table.find((r: any) =>
        Object.entries(filters).every(([k, v]) => r[k] === v),
      );
      return { data: found ?? null, error: null };
    };
    return builder;
  };
  return {
    from: (table: string) => {
      if (table === "products") return make(rows.products);
      if (table === "product_translations") return make(rows.translations);
      throw new Error(`unexpected table ${table}`);
    },
  };
}

describe("useProductBySlug resolver", () => {
  beforeEach(() => vi.clearAllMocks());

  it("finds product by base slug", async () => {
    const sb = mockSupabase({
      products: [{ id: "p1", slug: "cotxet", is_active: true }],
      translations: [],
    });
    const r = await resolveProductBySlug(sb, "cotxet");
    expect(r?.id).toBe("p1");
  });

  it("falls back to translated slug (es)", async () => {
    const sb = mockSupabase({
      products: [{ id: "p1", slug: "cotxet", is_active: true }],
      translations: [{ product_id: "p1", slug: "cochecito" }],
    });
    const r = await resolveProductBySlug(sb, "cochecito");
    expect(r?.id).toBe("p1");
  });

  it("returns null when slug doesn't exist in any language", async () => {
    const sb = mockSupabase({
      products: [{ id: "p1", slug: "cotxet", is_active: true }],
      translations: [{ product_id: "p1", slug: "cochecito" }],
    });
    const r = await resolveProductBySlug(sb, "no-existeix");
    expect(r).toBeNull();
  });

  it("ignores inactive products even via translated slug", async () => {
    const sb = mockSupabase({
      products: [{ id: "p1", slug: "cotxet", is_active: false }],
      translations: [{ product_id: "p1", slug: "cochecito" }],
    });
    const r = await resolveProductBySlug(sb, "cochecito");
    expect(r).toBeNull();
  });
});
