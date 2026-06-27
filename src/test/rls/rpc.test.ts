import { describe, it, expect, beforeAll } from "vitest";
import { ensureFixture, clientAs } from "./helpers";

describe("SECURITY DEFINER RPCs", () => {
  beforeAll(async () => { await ensureFixture(); }, 90_000);

  it("is_admin returns false for regular user, true for admin/super", async () => {
    const f = await ensureFixture();
    const user = await clientAs("user");
    const admin = await clientAs("admin");
    const sup = await clientAs("super");
    const a = await user.rpc("is_admin", { _user_id: f.users.user });
    const b = await admin.rpc("is_admin", { _user_id: f.users.admin });
    const c = await sup.rpc("is_admin", { _user_id: f.users.super });
    expect(a.error).toBeNull(); expect(a.data).toBe(false);
    expect(b.error).toBeNull(); expect(b.data).toBe(true);
    expect(c.error).toBeNull(); expect(c.data).toBe(true);
  });

  it("is_super_admin: false for user/admin, true for super", async () => {
    const f = await ensureFixture();
    const user = await clientAs("user");
    const admin = await clientAs("admin");
    const sup = await clientAs("super");
    expect((await user.rpc("is_super_admin", { _user_id: f.users.user })).data).toBe(false);
    expect((await admin.rpc("is_super_admin", { _user_id: f.users.admin })).data).toBe(false);
    expect((await sup.rpc("is_super_admin", { _user_id: f.users.super })).data).toBe(true);
  });

  it("has_role validates assignments", async () => {
    const f = await ensureFixture();
    const c = await clientAs("user");
    const r1 = await c.rpc("has_role", { _user_id: f.users.admin, _role: "admin" as any });
    const r2 = await c.rpc("has_role", { _user_id: f.users.user, _role: "admin" as any });
    expect(r1.data).toBe(true);
    expect(r2.data).toBe(false);
  });

  it("get_maintenance_settings_admin: forbidden for anon/user, ok for admin", async () => {
    const anon = await clientAs("anon");
    const user = await clientAs("user");
    const admin = await clientAs("admin");
    const a = await anon.rpc("get_maintenance_settings_admin");
    const b = await user.rpc("get_maintenance_settings_admin");
    const c = await admin.rpc("get_maintenance_settings_admin");
    expect(a.error, "anon must be denied").not.toBeNull();
    expect(b.error, "user must be denied").not.toBeNull();
    expect(c.error, `admin should succeed, got: ${c.error?.message}`).toBeNull();
  });

  it("get_top_products: forbidden for non-admin, ok for admin", async () => {
    const user = await clientAs("user");
    const admin = await clientAs("admin");
    const from = new Date(Date.now() - 30 * 86400000).toISOString();
    const to = new Date().toISOString();
    const u = await user.rpc("get_top_products", { _from: from, _to: to, _limit: 5 });
    const a = await admin.rpc("get_top_products", { _from: from, _to: to, _limit: 5 });
    expect(u.error).not.toBeNull();
    expect(a.error).toBeNull();
  });

  it("get_list_purchases: owner & admin allowed; other user gets empty", async () => {
    const f = await ensureFixture();
    const owner = await clientAs("owner");
    const admin = await clientAs("admin");
    const other = await clientAs("user");
    const o = await owner.rpc("get_list_purchases", { _list_id: f.list_id });
    const a = await admin.rpc("get_list_purchases", { _list_id: f.list_id });
    const x = await other.rpc("get_list_purchases", { _list_id: f.list_id });
    expect(o.error).toBeNull();
    expect(a.error).toBeNull();
    expect(x.error).toBeNull();
    expect((x.data ?? []).length).toBe(0);
  });

  it("user_owns_list: true for owner, false for other", async () => {
    const f = await ensureFixture();
    const c = await clientAs("user");
    const yes = await c.rpc("user_owns_list", { _list_id: f.list_id, _user_id: f.users.owner });
    const no = await c.rpc("user_owns_list", { _list_id: f.list_id, _user_id: f.users.user });
    expect(yes.data).toBe(true);
    expect(no.data).toBe(false);
  });
});
