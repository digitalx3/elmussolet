// Idempotent provisioning of RLS test fixtures.
// Auth: requires a caller authenticated as admin (is_admin = true).
// Creates dedicated @rlstest.local accounts, a birth list owned by test-owner,
// list section + item, and returns IDs used by the Vitest RLS suite.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

const PASSWORD = "RlsTest!2026#Mussolet";

const USERS = [
  { key: "user",  email: "test-user@rlstest.local",  full_name: "RLS Test User",  role: null as null | "admin" | "super_admin" },
  { key: "owner", email: "test-owner@rlstest.local", full_name: "RLS Test Owner", role: null },
  { key: "admin", email: "test-admin@rlstest.local", full_name: "RLS Test Admin", role: "admin" as const },
  { key: "super", email: "test-super@rlstest.local", full_name: "RLS Test Super", role: "super_admin" as const },
];

function assertNoError(error: unknown, context: string) {
  if (!error) return;
  const message = error instanceof Error ? error.message : JSON.stringify(error);
  throw new Error(`${context}: ${message}`);
}

async function ensureUser(admin: ReturnType<typeof createClient>, email: string, full_name: string) {
  // Find existing
  // @ts-ignore admin API
  const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (listErr) throw listErr;
  const existing = list.users.find((u) => (u.email ?? "").toLowerCase() === email.toLowerCase());
  if (existing) return existing.id;
  // @ts-ignore admin API
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name },
  });
  if (error) throw error;
  return data.user!.id;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing bearer token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Verify caller is admin
    const caller = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
    const { data: who } = await caller.auth.getUser();
    if (!who?.user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: isAdmin, error: roleErr } = await caller.rpc("is_admin", { _user_id: who.user.id });
    if (roleErr || !isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden: admin required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    const ids: Record<string, string> = {};
    for (const u of USERS) {
      const id = await ensureUser(admin, u.email, u.full_name);
      ids[u.key] = id;

      const { error: profileErr } = await admin.from("profiles").upsert({
        id,
        full_name: u.full_name,
        preferred_language: "ca",
        role: u.role ? "admin" : "customer",
      });
      assertNoError(profileErr, `profile upsert failed for ${u.key}`);

      if (u.role) {
        const { error: roleUpsertErr } = await admin
          .from("user_roles")
          .upsert({ user_id: id, role: u.role }, { onConflict: "user_id,role" });
        assertNoError(roleUpsertErr, `role upsert failed for ${u.key}`);
      }
    }

    // Provision birth list for owner (idempotent by list_code)
    const ACCESS_CODE = "RLS-TEST-LIST";
    const PASSWORD_HASH = "$2a$10$nLkk4QkS9SqLD9rXt6IcOOuMpAjyz9k8N7zLs5w0gPbqUq4j5sgwK"; // bcrypt("rlstest")
    let listId: string;
    const { data: existingList } = await admin
      .from("birth_lists").select("id").eq("list_code", ACCESS_CODE).maybeSingle();
    if (existingList) {
      listId = existingList.id;
    } else {
      const { data: newList, error: lErr } = await admin
        .from("birth_lists")
        .insert({
          list_code: ACCESS_CODE,
          baby_name: "RLS Test Baby",
          expected_date: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10),
          password_hash: PASSWORD_HASH,
          notes: "RLS test fixture",
          status: "active",
          created_by: ids.owner,
        })
        .select("id").single();
      if (lErr) throw lErr;
      listId = newList.id;
    }

    const { data: existingOwner, error: ownerLookupErr } = await admin
      .from("list_owners")
      .select("id")
      .eq("list_id", listId)
      .eq("user_id", ids.owner)
      .maybeSingle();
    assertNoError(ownerLookupErr, "list owner lookup failed");

    const ownerPayload = {
      list_id: listId,
      user_id: ids.owner,
      first_name: "RLS Test",
      last_name: "Owner",
      email: "test-owner@rlstest.local",
      is_primary: true,
    };
    const ownerResult = existingOwner
      ? await admin.from("list_owners").update(ownerPayload).eq("id", existingOwner.id)
      : await admin.from("list_owners").insert(ownerPayload);
    assertNoError(ownerResult.error, "list owner provision failed");

    let sectionId: string;
    const { data: existingSection } = await admin
      .from("list_sections").select("id").eq("list_id", listId).eq("name_ca", "Secció RLS").maybeSingle();
    if (existingSection) {
      sectionId = existingSection.id;
    } else {
      const { data: sec, error: sErr } = await admin
        .from("list_sections")
        .insert({ list_id: listId, name_ca: "Secció RLS", name_es: "Sección RLS", sort_order: 0 })
        .select("id")
        .single();
      if (sErr) throw sErr;
      sectionId = sec.id;
    }

    await admin.from("list_section_translations").upsert(
      { section_id: sectionId, language_code: "es", name: "Sección RLS" },
      { onConflict: "section_id,language_code" } as any,
    );

    return new Response(
      JSON.stringify({
        ok: true,
        password: PASSWORD,
        users: ids,
        list_id: listId,
        list_access_code: ACCESS_CODE,
        list_password: "rlstest",
        section_id: sectionId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
