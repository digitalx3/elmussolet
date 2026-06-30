import { describe, it, expect, beforeAll } from "vitest";
import { ensureFixture, clientAs } from "./helpers";

// Creates a throwaway order owned by the admin's customer and exercises the
// validate_order_status_transition trigger together with the orders RLS
// policies (admin can update; regular user cannot read/update another's order).
// Seed with the super_admin session so that is_admin() (which checks both
// user_roles and profiles.role) is guaranteed to be true and the orders RLS
// WITH CHECK passes regardless of profiles.role state for the test admin.
async function createOrder(status: string = "pending") {
  const seeder = await clientAs("super");
  // Confirm the seeding session satisfies is_admin() — fail fast with a clear
  // message if the fixture isn't provisioned correctly.
  const { data: who } = await seeder.auth.getUser();
  const { data: isAdmin, error: roleErr } = await seeder.rpc("is_admin", {
    _user_id: who.user?.id,
  } as any);
  if (roleErr) throw new Error(`is_admin check failed: ${roleErr.message}`);
  if (!isAdmin) throw new Error("seed session does not satisfy is_admin(); check rls-test-setup");

  // Find any existing customer to attach the order to – not under test.
  const { data: cust } = await seeder.from("customers").select("id").limit(1).maybeSingle();
  const customerId = cust?.id ?? null;
  const orderNumber = `RLS-TX-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const { data, error } = await seeder
    .from("orders")
    .insert({
      order_number: orderNumber,
      customer_id: customerId,
      delivery_method: "pickup",
      payment_method: "bank_transfer",
      subtotal: 1,
      total: 1,
      status,
    } as any)
    .select("id")
    .single();
  if (error) throw new Error(`order seed failed: ${error.message}`);
  return data.id as string;
}

async function cleanup(orderId: string) {
  const seeder = await clientAs("super");
  // Force to cancelled first so triggers don't object on hard delete.
  await seeder.from("orders").update({ status: "cancelled" } as any).eq("id", orderId);
  await seeder.from("orders").delete().eq("id", orderId);
}

describe("Order status transitions + RLS", () => {
  beforeAll(async () => { await ensureFixture(); }, 90_000);

  it("admin: pending → paid is allowed", async () => {
    const id = await createOrder("pending");
    try {
      const admin = await clientAs("admin");
      const { error } = await admin.from("orders").update({ status: "paid" } as any).eq("id", id);
      expect(error, error?.message).toBeNull();
    } finally { await cleanup(id); }
  });

  it("admin: pending → shipped is rejected (illegal jump)", async () => {
    const id = await createOrder("pending");
    try {
      const admin = await clientAs("admin");
      const { error } = await admin.from("orders").update({ status: "shipped" } as any).eq("id", id);
      expect(error).not.toBeNull();
      expect(error?.message || "").toMatch(/ORDER_STATUS_TRANSITION_INVALID|Transició/);
    } finally { await cleanup(id); }
  });

  it("admin: delivered is terminal (cannot be reopened)", async () => {
    const id = await createOrder("pending");
    try {
      const admin = await clientAs("admin");
      // Walk legally to delivered
      for (const s of ["paid","preparing","ready","shipped","delivered"]) {
        const { error } = await admin.from("orders").update({ status: s } as any).eq("id", id);
        expect(error, `step ${s}: ${error?.message}`).toBeNull();
      }
      const { error: badErr } = await admin.from("orders").update({ status: "paid" } as any).eq("id", id);
      expect(badErr).not.toBeNull();
    } finally { await cleanup(id); }
  });

  it("super_admin can override any transition", async () => {
    const id = await createOrder("pending");
    try {
      const sup = await clientAs("super");
      const { error } = await sup.from("orders").update({ status: "shipped" } as any).eq("id", id);
      expect(error, error?.message).toBeNull();
    } finally { await cleanup(id); }
  });

  it("regular user cannot update another customer's order status", async () => {
    const id = await createOrder("pending");
    try {
      const user = await clientAs("user");
      const { data, error } = await user
        .from("orders").update({ status: "paid" } as any).eq("id", id).select();
      // Either explicit error, or RLS silently filters to zero rows
      expect(!!error || !data || data.length === 0).toBe(true);
      // Confirm still pending
      const admin = await clientAs("admin");
      const { data: row } = await admin.from("orders").select("status").eq("id", id).single();
      expect(row?.status).toBe("pending");
    } finally { await cleanup(id); }
  });

  it("regular user cannot read another customer's order", async () => {
    const id = await createOrder("pending");
    try {
      const user = await clientAs("user");
      const { data } = await user.from("orders").select("id").eq("id", id);
      expect(!data || data.length === 0).toBe(true);
    } finally { await cleanup(id); }
  });
});
