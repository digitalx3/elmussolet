/* eslint-disable no-console */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getRlsEnv } from "./env";

const ENV = getRlsEnv();
const SUPABASE_URL = ENV.supabaseUrl;
const SUPABASE_ANON = ENV.supabaseAnonKey;
const ADMIN_EMAIL = ENV.adminEmail;
const ADMIN_PASSWORD = ENV.adminPassword;


export type RoleKey = "anon" | "user" | "owner" | "admin" | "super";

export interface Fixture {
  password: string;
  users: { user: string; owner: string; admin: string; super: string };
  list_id: string;
  list_access_code: string;
  list_password: string;
  section_id: string;
}

let fixture: Fixture | null = null;
const clientCache = new Map<RoleKey, SupabaseClient>();

function newClient(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_ANON) {
    throw new Error("Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY env vars");
  }
  return createClient(SUPABASE_URL, SUPABASE_ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function ensureFixture(): Promise<Fixture> {
  if (fixture) return fixture;
  const bootstrap = newClient();
  const { data: signIn, error: signErr } = await bootstrap.auth.signInWithPassword({
    email: ADMIN_EMAIL, password: ADMIN_PASSWORD,
  });
  if (signErr || !signIn.session) {
    throw new Error(
      `Cannot bootstrap RLS suite: failed to log in as ${ADMIN_EMAIL}. ` +
        `Set TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD env vars to a super_admin account. Error: ${signErr?.message}`,
    );
  }
  const { data, error } = await bootstrap.functions.invoke("rls-test-setup", { body: {} });
  await bootstrap.auth.signOut();
  if (error) throw new Error(`rls-test-setup failed: ${error.message}`);
  fixture = data as Fixture;
  return fixture;
}

export async function clientAs(role: RoleKey): Promise<SupabaseClient> {
  const cached = clientCache.get(role);
  if (cached) return cached;
  const client = newClient();
  if (role !== "anon") {
    const f = await ensureFixture();
    const email = `test-${role}@rlstest.local`;
    const { error } = await client.auth.signInWithPassword({ email, password: f.password });
    if (error) throw new Error(`Login failed for ${email}: ${error.message}`);
  }
  clientCache.set(role, client);
  return client;
}

export async function resetClients() {
  for (const c of clientCache.values()) {
    await c.auth.signOut().catch(() => {});
  }
  clientCache.clear();
}
