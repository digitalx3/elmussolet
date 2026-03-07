import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { compareSync } from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { listCode, password } = await req.json();

    if (!listCode || !password) {
      return new Response(
        JSON.stringify({ error: "Codi i contrasenya requerits" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Find the list by code
    const { data: list, error: listError } = await supabase
      .from("birth_lists")
      .select("id, list_code, baby_name, expected_date, password_hash, status")
      .eq("list_code", listCode.trim().toUpperCase())
      .single();

    if (listError || !list) {
      return new Response(
        JSON.stringify({ error: "invalid_credentials" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (list.status !== "active") {
      return new Response(
        JSON.stringify({ error: "list_not_active" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Compare password - using simple hash comparison
    // The password_hash stores a bcrypt-compatible hash, but for simplicity
    // we'll use the Deno crypto API
    const { default: bcrypt } = await import("https://deno.land/x/bcrypt@v0.4.1/mod.ts");
    const valid = await bcrypt.compare(password, list.password_hash);

    if (!valid) {
      return new Response(
        JSON.stringify({ error: "invalid_credentials" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get list owners (names only, no emails for privacy)
    const { data: owners } = await supabase
      .from("list_owners")
      .select("first_name, last_name")
      .eq("list_id", list.id);

    // Generate a simple access token (base64 of list_id + timestamp)
    const tokenPayload = JSON.stringify({
      listId: list.id,
      listCode: list.list_code,
      ts: Date.now(),
    });
    const token = btoa(tokenPayload);

    return new Response(
      JSON.stringify({
        token,
        listId: list.id,
        listCode: list.list_code,
        babyName: list.baby_name,
        expectedDate: list.expected_date,
        owners: owners || [],
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "server_error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
