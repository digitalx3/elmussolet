import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const newEmail = "admin@elmussolet.com";
  const password = "Admin2026!Mussolet";
  const oldEmail = "admin@elmussolet.cat";

  // Try to find existing user and update, or create new
  const { data: users } = await supabaseAdmin.auth.admin.listUsers();
  const existing = users?.users?.find(u => u.email === oldEmail);

  if (existing) {
    await supabaseAdmin.auth.admin.updateUserById(existing.id, { email: newEmail, email_confirm: true });
    return new Response(JSON.stringify({ success: true, action: "updated", userId: existing.id }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // Check if new email already exists
  const existingNew = users?.users?.find(u => u.email === newEmail);
  if (existingNew) {
    // Ensure admin role
    await supabaseAdmin.from("profiles").update({ role: "admin" }).eq("id", existingNew.id);
    return new Response(JSON.stringify({ success: true, action: "already_exists", userId: existingNew.id }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // Create new
  const { data: user, error } = await supabaseAdmin.auth.admin.createUser({
    email: newEmail, password, email_confirm: true,
    user_metadata: { full_name: "Admin El Mussolet" },
  });
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: corsHeaders });

  await supabaseAdmin.from("profiles").update({ role: "admin", full_name: "Admin El Mussolet" }).eq("id", user.user.id);
  return new Response(JSON.stringify({ success: true, action: "created", userId: user.user.id }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
