import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const { password } = await req.json();
  const { default: bcrypt } = await import("https://deno.land/x/bcrypt@v0.4.1/mod.ts");
  const hash = await bcrypt.hash(password);

  return new Response(JSON.stringify({ hash }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
