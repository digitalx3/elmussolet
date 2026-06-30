import { describe, it, expect, beforeAll } from "vitest";
import { ensureFixture, clientAs } from "./helpers";

// Verifies that a regular authenticated user (non-admin, non-owner) cannot
// perform admin-style operations against birth lists, their items/sections,
// or the default product-section assignments. The fixture's birth_list is
// owned by `owner`; `user` is unrelated to it.

function blocked(error: any, data: any) {
  if (error) return true;
  return !data || (Array.isArray(data) && data.length === 0);
}

describe("Non-admin cannot manage lists or assign products (RLS)", () => {
  beforeAll(async () => { await ensureFixture(); }, 90_000);

  // --- birth_lists ----------------------------------------------------------

  it("non-admin cannot update a foreign birth_list", async () => {
    const f = await ensureFixture();
    const c = await clientAs("user");
    const { data, error } = await c
      .from("birth_lists")
      .update({ baby_name: "HACKED" } as any)
      .eq("id", f.list_id)
      .select();
    expect(blocked(error, data)).toBe(true);

    // Confirm untouched
    const admin = await clientAs("admin");
    const { data: row } = await admin
      .from("birth_lists").select("baby_name").eq("id", f.list_id).single();
    expect(row?.baby_name).not.toBe("HACKED");
  });

  it("non-admin cannot delete a foreign birth_list", async () => {
    const f = await ensureFixture();
    const c = await clientAs("user");
    const { data, error } = await c
      .from("birth_lists").delete().eq("id", f.list_id).select();
    expect(blocked(error, data)).toBe(true);

    const admin = await clientAs("admin");
    const { data: row } = await admin
      .from("birth_lists").select("id").eq("id", f.list_id).single();
    expect(row?.id).toBe(f.list_id);
  });

  // --- list_items (gift assignments) ---------------------------------------

  it("non-admin cannot insert list_items into a foreign list", async () => {
    const f = await ensureFixture();
    const c = await clientAs("user");
    const { error } = await c.from("list_items").insert({
      list_id: f.list_id,
      section_id: f.section_id,
      quantity_desired: 1,
    } as any);
    expect(error, "insert into foreign list must be denied").not.toBeNull();
  });

  async function seedListItem(qty: number) {
    const f = await ensureFixture();
    const admin = await clientAs("admin");
    const { data: prod, error: prodErr } = await admin
      .from("products").select("id").limit(1).maybeSingle();
    if (prodErr) throw new Error(`product lookup failed: ${prodErr.message}`);
    if (!prod?.id) return { admin, id: null as string | null };
    const { data, error } = await admin
      .from("list_items")
      .insert({
        list_id: f.list_id,
        section_id: f.section_id,
        product_id: prod.id,
        quantity_desired: qty,
      } as any)
      .select("id").single();
    if (error) throw new Error(`list_items seed failed: ${error.message}`);
    return { admin, id: data!.id as string };
  }

  it("non-admin cannot update list_items on a foreign list", async () => {
    const { admin, id } = await seedListItem(1);
    if (!id) { expect(true).toBe(true); return; }
    try {
      const c = await clientAs("user");
      const { data, error } = await c
        .from("list_items")
        .update({ quantity_desired: 99 } as any)
        .eq("id", id)
        .select();
      expect(blocked(error, data)).toBe(true);

      const { data: row } = await admin
        .from("list_items").select("quantity_desired").eq("id", id).single();
      expect(row?.quantity_desired).toBe(1);
    } finally {
      await admin.from("list_items").delete().eq("id", id);
    }
  });

  it("non-admin cannot delete list_items on a foreign list", async () => {
    const { admin, id } = await seedListItem(2);
    if (!id) { expect(true).toBe(true); return; }
    try {
      const c = await clientAs("user");
      const { data, error } = await c
        .from("list_items").delete().eq("id", id).select();
      expect(blocked(error, data)).toBe(true);

      const { data: row } = await admin
        .from("list_items").select("id").eq("id", id).single();
      expect(row?.id).toBe(id);
    } finally {
      await admin.from("list_items").delete().eq("id", id);
    }
  });

  // --- list_sections --------------------------------------------------------

  it("non-admin cannot insert sections into a foreign list", async () => {
    const f = await ensureFixture();
    const c = await clientAs("user");
    const { error } = await c.from("list_sections").insert({
      list_id: f.list_id, name_ca: "Hack", sort_order: 99,
    } as any);
    expect(error).not.toBeNull();
  });

  // --- product_default_sections (admin-only assignment) ---------------------

  it("non-admin cannot assign a product to a default section", async () => {
    const admin = await clientAs("admin");
    const { data: prod } = await admin
      .from("products").select("id").limit(1).maybeSingle();
    const { data: section } = await admin
      .from("default_list_sections").select("id").limit(1).maybeSingle();
    if (!prod?.id || !section?.id) {
      // Nothing to test against in this env – treat as soft skip.
      expect(true).toBe(true);
      return;
    }
    const c = await clientAs("user");
    const { error } = await c.from("product_default_sections").insert({
      product_id: prod.id, section_id: section.id, position: 0,
    } as any);
    expect(error, "non-admin must not insert into product_default_sections").not.toBeNull();
  });

  it("non-admin cannot delete from product_default_sections", async () => {
    const admin = await clientAs("admin");
    const { data: row } = await admin
      .from("product_default_sections").select("product_id, section_id").limit(1).maybeSingle();
    if (!row) {
      expect(true).toBe(true);
      return;
    }
    const c = await clientAs("user");
    const { data, error } = await c
      .from("product_default_sections")
      .delete()
      .eq("product_id", row.product_id)
      .eq("section_id", row.section_id)
      .select();
    expect(blocked(error, data)).toBe(true);
  });

  // --- SELECT visibility (admin-only reads) --------------------------------

  it("non-admin cannot SELECT a foreign birth_list by id", async () => {
    const f = await ensureFixture();
    const c = await clientAs("user");
    const { data, error } = await c
      .from("birth_lists").select("id, baby_name").eq("id", f.list_id);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("non-admin listing birth_lists never returns the foreign list", async () => {
    const f = await ensureFixture();
    const c = await clientAs("user");
    const { data, error } = await c
      .from("birth_lists").select("id").limit(1000);
    expect(error).toBeNull();
    const ids = (data ?? []).map((r: any) => r.id);
    expect(ids).not.toContain(f.list_id);
  });

  it("non-admin cannot SELECT list_items belonging to a foreign list", async () => {
    const { admin, id } = await seedListItem(1);
    if (!id) { expect(true).toBe(true); return; }
    try {
      const c = await clientAs("user");
      const { data, error } = await c
        .from("list_items").select("id").eq("id", id);
      expect(error).toBeNull();
      expect(data ?? []).toHaveLength(0);
    } finally {
      await admin.from("list_items").delete().eq("id", id);
    }
  });

  it("non-admin cannot SELECT list_sections of a foreign list", async () => {
    const f = await ensureFixture();
    const c = await clientAs("user");
    const { data, error } = await c
      .from("list_sections").select("id").eq("list_id", f.list_id);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("non-admin cannot SELECT list_owners of a foreign list", async () => {
    const f = await ensureFixture();
    const c = await clientAs("user");
    const { data, error } = await c
      .from("list_owners").select("id, user_id").eq("list_id", f.list_id);
    expect(error).toBeNull();
    // Visibility policy: user_id = auth.uid() OR is_admin — so foreign rows must not appear.
    expect((data ?? []).some((r: any) => r.user_id !== null && r.user_id !== undefined)).toBe(false);
  });

  it("admin CAN SELECT the foreign birth_list, items and sections", async () => {
    const f = await ensureFixture();
    const admin = await clientAs("admin");
    const { data: list } = await admin
      .from("birth_lists").select("id").eq("id", f.list_id).single();
    expect(list?.id).toBe(f.list_id);
    const { error: itemsErr } = await admin
      .from("list_items").select("id").eq("list_id", f.list_id);
    expect(itemsErr).toBeNull();
    const { error: secErr } = await admin
      .from("list_sections").select("id").eq("list_id", f.list_id);
    expect(secErr).toBeNull();
  });

  // --- sanity check: admin can do all the above ----------------------------

  it("admin can update the same birth_list", async () => {
    const f = await ensureFixture();
    const admin = await clientAs("admin");
    const { error } = await admin
      .from("birth_lists")
      .update({ notes: `admin-ok-${Date.now()}` } as any)
      .eq("id", f.list_id);
    expect(error, error?.message).toBeNull();
  });
});
