import { describe, it, expect, beforeAll } from "vitest";
import { ensureFixture, clientAs } from "./helpers";

function isBlocked(error: any, data: any) {
  if (error) return true;
  // Some RLS policies silently filter writes when the row doesn't return.
  return !data || (Array.isArray(data) && data.length === 0);
}

describe("RLS mutation guards", () => {
  beforeAll(async () => { await ensureFixture(); }, 90_000);

  it("anon cannot insert into user_roles", async () => {
    const f = await ensureFixture();
    const c = await clientAs("anon");
    const { error } = await c.from("user_roles").insert({ user_id: f.users.user, role: "admin" as any });
    expect(error, "anon insert must be denied").not.toBeNull();
  });

  it("regular user cannot grant themselves admin", async () => {
    const f = await ensureFixture();
    const c = await clientAs("user");
    const { error } = await c.from("user_roles").insert({ user_id: f.users.user, role: "admin" as any });
    expect(error, "self-elevation must be denied").not.toBeNull();
  });

  it("regular user cannot insert into user_permissions", async () => {
    const f = await ensureFixture();
    const c = await clientAs("user");
    const { error } = await c
      .from("user_permissions")
      .insert({ user_id: f.users.user, permission: "ai_features" as any });
    expect(error).not.toBeNull();
  });

  it("regular user cannot update another user's profile", async () => {
    const f = await ensureFixture();
    const c = await clientAs("user");
    const { data, error } = await c
      .from("profiles").update({ full_name: "hacked" }).eq("id", f.users.owner).select();
    expect(isBlocked(error, data)).toBe(true);
  });

  it("regular user cannot read smtp_settings", async () => {
    const c = await clientAs("user");
    const { data, error } = await c.from("smtp_settings").select("*").limit(1);
    expect(isBlocked(error, data)).toBe(true);
  });

  it("regular user cannot update smtp_settings", async () => {
    const c = await clientAs("user");
    const { data, error } = await c
      .from("smtp_settings").update({ smtp_host: "evil.example.com" }).gt("id", "00000000-0000-0000-0000-000000000000").select();
    expect(isBlocked(error, data)).toBe(true);
  });

  it("regular user cannot update maintenance_settings", async () => {
    const c = await clientAs("user");
    const { data, error } = await c
      .from("maintenance_settings").update({ is_maintenance_mode: true }).gt("id", "00000000-0000-0000-0000-000000000000").select();
    expect(isBlocked(error, data)).toBe(true);
  });

  it("foreign user cannot delete other user's list_owner record", async () => {
    const f = await ensureFixture();
    const c = await clientAs("user");
    const { data, error } = await c
      .from("list_owners").delete().eq("list_id", f.list_id).eq("user_id", f.users.owner).select();
    expect(isBlocked(error, data)).toBe(true);
  });

  it("foreign user cannot update foreign birth_list", async () => {
    const f = await ensureFixture();
    const c = await clientAs("user");
    const { data, error } = await c
      .from("birth_lists").update({ welcome_message: "pwned" }).eq("id", f.list_id).select();
    expect(isBlocked(error, data)).toBe(true);
  });

  it("anon cannot insert orders", async () => {
    const c = await clientAs("anon");
    const { error } = await c.from("orders").insert({
      order_number: "RLS-TEST-FAKE",
      total: 1, subtotal: 1, status: "pending",
    } as any);
    expect(error).not.toBeNull();
  });

  it("admin can read smtp_settings", async () => {
    const c = await clientAs("admin");
    const { error } = await c.from("smtp_settings").select("*").limit(1);
    expect(error).toBeNull();
  });

  it("admin can read maintenance_settings", async () => {
    const c = await clientAs("admin");
    const { error } = await c.from("maintenance_settings").select("*").limit(1);
    expect(error).toBeNull();
  });
});
