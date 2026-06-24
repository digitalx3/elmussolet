// Returns birth list items + sections + block summary for a guest who has already
// authenticated via verify-list-access. Runs with the service role so tightened
// RLS on list_items / list_sections does not block legitimate gift buyers.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { listCode, token } = await req.json().catch(() => ({}));

    if (typeof listCode !== "string" || !listCode.trim()) {
      return json({ error: "list_code_required" }, 400);
    }
    if (typeof token !== "string" || !token) {
      return json({ error: "token_required" }, 401);
    }

    // Decode and minimally validate the access token issued by verify-list-access.
    let payload: { listId?: string; listCode?: string; ts?: number };
    try {
      payload = JSON.parse(atob(token));
    } catch {
      return json({ error: "invalid_token" }, 401);
    }

    const code = listCode.trim().toUpperCase();
    if (
      !payload.listId ||
      payload.listCode !== code ||
      typeof payload.ts !== "number"
    ) {
      return json({ error: "invalid_token" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Confirm the list still exists, is active and matches the token's listId.
    const { data: list, error: listErr } = await supabase
      .from("birth_lists")
      .select("id, list_code, status")
      .eq("id", payload.listId)
      .eq("list_code", code)
      .maybeSingle();
    if (listErr) throw listErr;
    if (!list) return json({ error: "list_not_found" }, 404);
    if (list.status !== "active") return json({ error: "list_not_active" }, 403);

    const listId = list.id as string;

    const [itemsRes, sectionsRes, summaryRes] = await Promise.all([
      supabase
        .from("list_items")
        .select(`
          id, product_id, variant_id, section_id, quantity_desired, quantity_purchased, priority, sort_order,
          product:products(
            id, slug, base_price, has_variants, stock_quantity, stock_status,
            product_translations(language, name, short_description),
            product_images(image_url, is_primary, alt_text),
            tax_rates(percentage)
          )
        `)
        .eq("list_id", listId)
        .order("sort_order", { ascending: true }),
      supabase
        .from("list_sections")
        .select("id, name_ca, name_es, sort_order, list_section_translations(language_code, name)")
        .eq("list_id", listId)
        .order("sort_order", { ascending: true }),
      supabase.rpc("get_list_block_summary", { _list_id: listId }),
    ]);

    if (itemsRes.error) throw itemsRes.error;
    if (sectionsRes.error) throw sectionsRes.error;
    if (summaryRes.error) throw summaryRes.error;

    const items = itemsRes.data ?? [];

    // Resolve variants in a single batched query.
    const variantIds = Array.from(
      new Set(items.map((i: any) => i.variant_id).filter(Boolean)),
    ) as string[];
    let variantsById: Record<string, any> = {};
    if (variantIds.length > 0) {
      const { data: variants, error: vErr } = await supabase
        .from("product_variants")
        .select("id, value, price_override, stock_quantity, variant_type_id")
        .in("id", variantIds);
      if (vErr) throw vErr;
      variantsById = Object.fromEntries((variants || []).map((v: any) => [v.id, v]));
    }

    const enrichedItems = items.map((i: any) => ({
      ...i,
      variant: i.variant_id ? variantsById[i.variant_id] || null : null,
    }));

    const normalizedSections = (sectionsRes.data ?? []).map((s: any) => ({
      id: s.id,
      name_ca: s.name_ca,
      name_es: s.name_es,
      sort_order: s.sort_order,
      translations: (s.list_section_translations ?? []).map((t: any) => ({
        language_code: t.language_code,
        name: t.name,
      })),
    }));

    return json({
      ok: true,
      items: enrichedItems,
      sections: normalizedSections,
      blockSummary: summaryRes.data ?? [],
    });
  } catch (err) {
    console.error("get-public-list-data error", err);
    return json({ error: "server_error" }, 500);
  }
});
