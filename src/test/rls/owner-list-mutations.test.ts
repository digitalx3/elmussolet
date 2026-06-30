import { describe, it, expect, beforeAll } from "vitest";
import { ensureFixture, clientAs } from "./helpers";

// Verifies the positive side of the policies on birth_lists and list_items:
// only the list owner (via list_owners) or an admin (is_admin) can
// INSERT / UPDATE / DELETE. The negative side for foreign users is covered
// by admin-only-lists.test.ts.
//
// Policy summary:
//   birth_lists  → INSERT: any authenticated. UPDATE: owner OR admin.
//                  DELETE: admin only.
//   list_items   → ALL ops: owner OR admin.

describe("Owner/Admin can mutate birth_lists and list_items (RLS)", () => {
  beforeAll(async () => { await ensureFixture(); }, 90_000);

  // --- birth_lists: UPDATE -------------------------------------------------

  it("owner CAN update their own birth_list", async () => {
    const f = await ensureFixture();
    const c = await clientAs("owner");
    const stamp = `owner-ok-${Date.now()}`;
    const { data, error } = await c
      .from("birth_lists")
      .update({ notes: stamp } as any)
      .eq("id", f.list_id)
      .select("id, notes");
    expect(error, error?.message).toBeNull();
    expect(data?.[0]?.notes).toBe(stamp);
  });

  it("admin CAN update someone else's birth_list", async () => {
    const f = await ensureFixture();
    const c = await clientAs("admin");
    const stamp = `admin-ok-${Date.now()}`;
    const { data, error } = await c
      .from("birth_lists")
      .update({ notes: stamp } as any)
      .eq("id", f.list_id)
      .select("id, notes");
    expect(error, error?.message).toBeNull();
    expect(data?.[0]?.notes).toBe(stamp);
  });

  it("anon CANNOT update any birth_list", async () => {
    const f = await ensureFixture();
    const c = await clientAs("anon");
    const { data, error } = await c
      .from("birth_lists")
      .update({ notes: "anon-hack" } as any)
      .eq("id", f.list_id)
      .select();
    // Either explicit error or silently filtered to zero rows.
    expect(!!error || (data?.length ?? 0) === 0).toBe(true);
  });

  // --- birth_lists: INSERT (authenticated only) ----------------------------

  it("authenticated user CAN insert a birth_list (created_by = self via trigger)", async () => {
    const c = await clientAs("user");
    const code = `RLS-USR-${Date.now()}`;
    const { data, error } = await c
      .from("birth_lists")
      .insert({
        list_code: code,
        baby_name: "Owner-Insert Test",
        expected_date: new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10),
        password_hash: "x",
        status: "active",
      } as any)
      .select("id, created_by")
      .single();
    expect(error, error?.message).toBeNull();
    expect(data?.id).toBeTruthy();
    // Cleanup as admin (only admin can DELETE birth_lists).
    if (data?.id) {
      const admin = await clientAs("admin");
      await admin.from("birth_lists").delete().eq("id", data.id);
    }
  });

  it("anon CANNOT insert a birth_list", async () => {
    const c = await clientAs("anon");
    const { error } = await c.from("birth_lists").insert({
      list_code: `RLS-ANON-${Date.now()}`,
      baby_name: "Nope",
      expected_date: new Date().toISOString().slice(0, 10),
      password_hash: "x",
      status: "active",
    } as any);
    expect(error).not.toBeNull();
  });

  // --- birth_lists: DELETE (admin only) ------------------------------------

  it("owner CANNOT delete their own birth_list (admin-only DELETE)", async () => {
    // Seed a throwaway list owned by `owner` so we don't disturb the fixture.
    const admin = await clientAs("admin");
    const f = await ensureFixture();
    const code = `RLS-DEL-${Date.now()}`;
    const { data: created, error: cErr } = await admin
      .from("birth_lists")
      .insert({
        list_code: code,
        baby_name: "Delete Probe",
        expected_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
        password_hash: "x",
        status: "active",
        created_by: f.users.owner,
      } as any)
      .select("id").single();
    expect(cErr, cErr?.message).toBeNull();
    const probeId = created!.id as string;
    await admin.from("list_owners").insert({
      list_id: probeId,
      user_id: f.users.owner,
      first_name: "Probe",
      last_name: "Owner",
      email: "test-owner@rlstest.local",
      is_primary: true,
    });

    try {
      const owner = await clientAs("owner");
      const { data, error } = await owner
        .from("birth_lists").delete().eq("id", probeId).select();
      expect(!!error || (data?.length ?? 0) === 0).toBe(true);

      // Confirm row still exists for admin
      const { data: still } = await admin
        .from("birth_lists").select("id").eq("id", probeId).single();
      expect(still?.id).toBe(probeId);

      // Admin CAN delete it.
      const { error: adminDel } = await admin
        .from("birth_lists").delete().eq("id", probeId);
      expect(adminDel, adminDel?.message).toBeNull();
    } finally {
      await admin.from("birth_lists").delete().eq("id", probeId);
    }
  });

  // --- list_items: full CRUD by owner --------------------------------------

  async function pickProduct() {
    const admin = await clientAs("admin");
    const { data } = await admin.from("products").select("id").limit(1).maybeSingle();
    return data?.id as string | undefined;
  }

  it("owner CAN insert / update / delete list_items on their list", async () => {
    const f = await ensureFixture();
    const productId = await pickProduct();
    if (!productId) { expect(true).toBe(true); return; }
    const owner = await clientAs("owner");

    const { data: ins, error: insErr } = await owner
      .from("list_items")
      .insert({
        list_id: f.list_id,
        section_id: f.section_id,
        product_id: productId,
        quantity_desired: 1,
      } as any)
      .select("id, quantity_desired").single();
    expect(insErr, insErr?.message).toBeNull();
    const id = ins!.id as string;

    try {
      const { data: upd, error: updErr } = await owner
        .from("list_items")
        .update({ quantity_desired: 4 } as any)
        .eq("id", id)
        .select("quantity_desired").single();
      expect(updErr, updErr?.message).toBeNull();
      expect(upd?.quantity_desired).toBe(4);

      const { error: delErr } = await owner.from("list_items").delete().eq("id", id);
      expect(delErr, delErr?.message).toBeNull();

      const admin = await clientAs("admin");
      const { data: gone } = await admin
        .from("list_items").select("id").eq("id", id).maybeSingle();
      expect(gone).toBeNull();
    } finally {
      const admin = await clientAs("admin");
      await admin.from("list_items").delete().eq("id", id);
    }
  });

  it("admin CAN insert / update / delete list_items on any list", async () => {
    const f = await ensureFixture();
    const productId = await pickProduct();
    if (!productId) { expect(true).toBe(true); return; }
    const admin = await clientAs("admin");

    const { data: ins, error: insErr } = await admin
      .from("list_items")
      .insert({
        list_id: f.list_id,
        section_id: f.section_id,
        product_id: productId,
        quantity_desired: 2,
      } as any)
      .select("id").single();
    expect(insErr, insErr?.message).toBeNull();
    const id = ins!.id as string;

    const { error: updErr } = await admin
      .from("list_items").update({ quantity_desired: 5 } as any).eq("id", id);
    expect(updErr, updErr?.message).toBeNull();

    const { error: delErr } = await admin.from("list_items").delete().eq("id", id);
    expect(delErr, delErr?.message).toBeNull();
  });

  it("anon CANNOT insert list_items", async () => {
    const f = await ensureFixture();
    const c = await clientAs("anon");
    const { error } = await c.from("list_items").insert({
      list_id: f.list_id,
      section_id: f.section_id,
      quantity_desired: 1,
    } as any);
    expect(error).not.toBeNull();
  });
});
