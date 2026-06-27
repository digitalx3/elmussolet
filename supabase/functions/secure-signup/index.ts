import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const RULES: { key: string; test: (p: string) => boolean }[] = [
  { key: "length", test: (p) => p.length >= 8 },
  { key: "uppercase", test: (p) => /[A-Z]/.test(p) },
  { key: "lowercase", test: (p) => /[a-z]/.test(p) },
  { key: "number", test: (p) => /\d/.test(p) },
  { key: "special", test: (p) => /[^A-Za-z0-9]/.test(p) },
];

function validatePassword(p: string): { ok: boolean; failed: string[] } {
  const failed = RULES.filter((r) => !r.test(p)).map((r) => r.key);
  return { ok: failed.length === 0, failed };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { email, password, full_name } = await req.json();

    if (typeof email !== "string" || typeof password !== "string") {
      return new Response(JSON.stringify({ error: "invalid_input" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    if (!emailOk) {
      return new Response(JSON.stringify({ error: "invalid_email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { ok, failed } = validatePassword(password);
    if (!ok) {
      return new Response(
        JSON.stringify({ error: "weak_password", failed_rules: failed }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data, error } = await admin.auth.admin.createUser({
      email: email.trim(),
      password,
      email_confirm: true,
      user_metadata: { full_name: full_name ?? null },
    });

    if (error) {
      const msg = String(error.message || "").toLowerCase();
      const status = msg.includes("already") || msg.includes("registered") ? 409 : 400;
      return new Response(JSON.stringify({ error: error.message }), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ user_id: data.user?.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
