import { describe, it, expect, beforeAll } from "vitest";
import { ensureFixture, clientAs } from "./helpers";

// Creates a throwaway order owned by the admin's customer and exercises the
// validate_order_status_transition trigger together with the orders RLS
// policies (admin can update; regular user cannot read/update another's order).
async function createOrder(status: string = "pending") {
  const admin = await clientAs("admin");
  // Find any existing customer to attach the order to – not under test.
  const { data: cust } = await admin.from("customers").select("id").limit(1).maybeSingle();
  const customerId = cust?.id ?? null;
  const orderNumber = `RLS-TX-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const { data, error } = await admin
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
  const admin = await clientAs("admin");
  // Force to cancelled first so triggers don't object on hard delete.
  await admin.from("orders").update({ status: "cancelled" } as any).eq("id", orderId);
  await admin.from("orders").delete().eq("id", orderId);
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
