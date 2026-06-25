// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { order_id } = await req.json();
    if (!order_id) {
      return json({ error: "order_id required" }, 400);
    }

    // 1. Load order items
    const { data: items, error: itemsErr } = await supabase
      .from("order_items")
      .select("product_id, variant_id")
      .eq("order_id", order_id);
    if (itemsErr) throw itemsErr;

    const productIds = Array.from(
      new Set((items || []).map((i: any) => i.product_id).filter(Boolean)),
    );
    if (productIds.length === 0) {
      return json({ ok: true, affected: 0 });
    }

    // 2. Fetch products + variants to compute effective stock
    const { data: products, error: prodErr } = await supabase
      .from("products")
      .select(
        `id, stock_quantity, product_translations(language, name), product_variants(stock_quantity, is_active)`,
      )
      .in("id", productIds);
    if (prodErr) throw prodErr;

    const depleted: { id: string; name: string }[] = [];
    for (const p of products || []) {
      const variants = ((p as any).product_variants || []).filter(
        (v: any) => v.is_active !== false,
      );
      const stock = variants.length > 0
        ? variants.reduce((s: number, v: any) => s + (v.stock_quantity || 0), 0)
        : ((p as any).stock_quantity || 0);
      if (stock <= 0) {
        const tr = ((p as any).product_translations || []).find(
          (t: any) => t.language === "ca",
        ) || ((p as any).product_translations || [])[0];
        depleted.push({ id: (p as any).id, name: tr?.name || (p as any).id });
      }
    }

    if (depleted.length === 0) {
      return json({ ok: true, affected: 0 });
    }

    // 3. Find pending list_items referencing each depleted product
    const depletedIds = depleted.map((d) => d.id);
    const { data: affectedItems } = await supabase
      .from("list_items")
      .select(
        `product_id, list_id, quantity_desired, quantity_purchased,
         list:birth_lists(id, list_code, baby_name, status)`,
      )
      .in("product_id", depletedIds);

    // Group affected lists per product
    const listMap = new Map<string, { listCode: string; babyName: string | null; products: string[] }>();
    for (const li of affectedItems || []) {
      const desired = (li as any).quantity_desired || 0;
      const purchased = (li as any).quantity_purchased || 0;
      if (purchased >= desired) continue;
      const lst = (li as any).list;
      if (!lst || lst.status === "archived") continue;
      const entry = listMap.get(lst.id) || {
        listCode: lst.list_code,
        babyName: lst.baby_name,
        products: [],
      };
      const dp = depleted.find((d) => d.id === (li as any).product_id);
      if (dp && !entry.products.includes(dp.name)) entry.products.push(dp.name);
      listMap.set(lst.id, entry);
    }

    // 4. Send notifications
    let emailsSent = 0;
    let emailsFailed = 0;
    const sendEmail = async (to: string, subject: string, html: string) => {
      try {
        const res = await supabase.functions.invoke("send-smtp-email", {
          body: { to, subject, html },
        });
        if (!res.error) emailsSent++;
        else emailsFailed++;
      } catch (e) {
        emailsFailed++;
        console.error("email failed", to, e);
      }
    };

    const { data: adminProfiles } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "admin");
    const adminIds = (adminProfiles || []).map((p: any) => p.id);
    let adminEmails: string[] = [];
    if (adminIds.length > 0) {
      const { data: adminCustomers } = await supabase
        .from("customers")
        .select("email, auth_user_id")
        .in("auth_user_id", adminIds);
      adminEmails = Array.from(
        new Set((adminCustomers || []).map((c: any) => c.email).filter(Boolean)),
      );
    }

    if (adminEmails.length > 0) {
      const html = `
        <h2>Productes sense estoc</h2>
        <p>Després d'una compra recent, els següents productes han quedat sense estoc:</p>
        <ul>
          ${depleted.map((d) => `<li>${escapeHtml(d.name)}</li>`).join("")}
        </ul>
        <p>Llistes de naixement afectades: ${listMap.size}</p>
      `;
      for (const em of adminEmails) {
        await sendEmail(em, "[El Mussolet] Productes sense estoc", html);
      }
    }

    const ownerEmailsAll: string[] = [];
    const affectedListsLog: any[] = [];
    for (const [listId, info] of listMap.entries()) {
      const { data: owners } = await supabase
        .from("list_owners")
        .select("email, first_name")
        .eq("list_id", listId);
      const emails = Array.from(
        new Set((owners || []).map((o: any) => o.email).filter(Boolean)),
      );
      affectedListsLog.push({
        list_id: listId,
        list_code: info.listCode,
        baby_name: info.babyName,
        products: info.products,
        owner_emails: emails,
      });
      if (emails.length === 0) continue;
      ownerEmailsAll.push(...emails);
      const html = `
        <h2>Producte sense estoc a la teva llista</h2>
        <p>Hola${info.babyName ? `, llista de ${escapeHtml(info.babyName)}` : ""},</p>
        <p>Els següents productes de la teva llista de naixement (codi <strong>${escapeHtml(info.listCode)}</strong>) han quedat sense estoc:</p>
        <ul>
          ${info.products.map((n) => `<li>${escapeHtml(n)}</li>`).join("")}
        </ul>
        <p>Et recomanem editar la teva llista i substituir-los per altres productes similars.</p>
      `;
      for (const em of emails) {
        await sendEmail(em, "[El Mussolet] Producte sense estoc a la teva llista", html);
      }
    }

    await supabase.from("stock_depletion_notifications").insert({
      order_id,
      depleted_products: depleted,
      affected_lists: affectedListsLog,
      admin_emails: adminEmails,
      owner_emails: Array.from(new Set(ownerEmailsAll)),
      emails_sent: emailsSent,
      emails_failed: emailsFailed,
      status: emailsFailed > 0 ? "partial" : "ok",
    });

    return json({
      ok: true,
      depleted: depleted.length,
      lists_affected: listMap.size,
      emails_sent: emailsSent,
      emails_failed: emailsFailed,
    });
  } catch (e: any) {
    console.error("notify-list-stock-depleted error", e);
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, serviceKey);
      await supabase.from("stock_depletion_notifications").insert({
        status: "error",
        error: String(e?.message || e),
      });
    } catch (_) { /* ignore */ }
    return json({ error: e?.message || "internal" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
