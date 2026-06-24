import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";

    if (!authHeader) return json({ error: "No autoritzat" });

    // Verify admin
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: "Sessió no vàlida. Torna a iniciar sessió." });

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: profile, error: profErr } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (profErr || profile?.role !== "admin") return json({ error: "Només administradors" });

    const body = await req.json().catch(() => ({}));
    const listId = body?.list_id as string | undefined;
    if (!listId) return json({ error: "Falta list_id" });

    // 1) Find all orders for this list
    const { data: orders, error: ordersErr } = await admin
      .from("orders")
      .select("id")
      .eq("list_id", listId);
    if (ordersErr) return json({ error: `Error llistant comandes: ${ordersErr.message}` });

    const orderIds = (orders ?? []).map((o) => o.id);

    // 2) Delete order_items (FK to orders is CASCADE, but explicit is safer for triggers)
    if (orderIds.length > 0) {
      const { error: oiErr } = await admin
        .from("order_items")
        .delete()
        .in("order_id", orderIds);
      if (oiErr) return json({ error: `Error eliminant items de comanda: ${oiErr.message}` });

      const { error: ordDelErr } = await admin
        .from("orders")
        .delete()
        .in("id", orderIds);
      if (ordDelErr) return json({ error: `Error eliminant comandes: ${ordDelErr.message}` });
    }

    // 3) Delete dependent rows that cascade anyway, explicitly for clarity
    await admin.from("list_items").delete().eq("list_id", listId);
    await admin.from("list_sections").delete().eq("list_id", listId);
    await admin.from("list_owners").delete().eq("list_id", listId);

    // 4) Delete the birth list and verify
    const { data: deleted, error: blErr } = await admin
      .from("birth_lists")
      .delete()
      .eq("id", listId)
      .select("id");
    if (blErr) return json({ error: `Error eliminant la llista: ${blErr.message}` });
    if (!deleted || deleted.length === 0) {
      return json({ error: "La llista no s'ha pogut eliminar (no trobada o ja eliminada)" });
    }

    return json({ success: true, deleted_orders: orderIds.length });
  } catch (e: any) {
    return json({ error: `Error inesperat: ${e?.message ?? String(e)}` });
  }
});
