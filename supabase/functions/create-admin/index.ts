import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const email = "admin@elmussolet.cat";
  const password = "Admin2026!Mussolet";

  // Create auth user
  const { data: user, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Admin El Mussolet" },
  });

  if (authError) {
    return new Response(JSON.stringify({ error: authError.message }), { status: 400 });
  }

  // Update profile role to admin
  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .update({ role: "admin", full_name: "Admin El Mussolet" })
    .eq("id", user.user.id);

  if (profileError) {
    return new Response(JSON.stringify({ error: profileError.message }), { status: 400 });
  }

  return new Response(JSON.stringify({ success: true, userId: user.user.id }), { status: 200 });
});
