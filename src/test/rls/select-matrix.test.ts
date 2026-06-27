import { describe, it, expect, beforeAll } from "vitest";
import { ensureFixture, clientAs, type RoleKey } from "./helpers";

// Expected SELECT behaviour per (table, role).
//   "rows"   => must be able to read & at least one row should be visible (table has seed data).
//   "ok"     => query must succeed (no permission error). Zero rows is acceptable.
//   "deny"   => must fail with a permission/RLS error OR return zero rows when the policy filters everything.
type Expect = "rows" | "ok" | "deny";

const PUBLIC_READ_TABLES = [
  "brands","brand_translations","categories","category_translations","cookie_categories",
  "cookie_settings","cookies_registry","default_list_sections","default_list_section_translations",
  "languages","list_template_items","list_template_sections","list_template_translations",
  "list_templates","order_status_translations","order_statuses","product_images",
  "product_relations","product_translations","product_variants","products","shipping_rates",
  "shipping_zones","site_settings","tax_rates","ui_translations","variant_type_translations",
  "variant_types","hero_slides","cms_blocks",
];

const AUTH_ONLY_READ: Array<{ t: string; allowed: RoleKey[] }> = [
  { t: "profiles", allowed: ["user","owner","admin","super"] },
  { t: "user_roles", allowed: ["user","owner","admin","super"] }, // users see own
  { t: "user_permissions", allowed: ["user","owner","admin","super"] },
  { t: "customers", allowed: ["admin","super"] },
];

const ADMIN_ONLY_READ = [
  "ai_translation_logs","backup_runs","contact_message_replies","contact_message_status_log",
  "contact_messages","cookie_consent_log","maintenance_settings","order_deletion_audit",
  "order_status_email_templates","smtp_send_log","smtp_settings","stock_depletion_notifications",
  "stock_movements",
];

const OWNER_READ: Array<{ t: string; col?: string; val?: () => string }> = [
  { t: "birth_lists" },
  { t: "list_items" },
  { t: "list_owners" },
  { t: "list_sections" },
  { t: "list_section_translations" },
  { t: "orders" },
  { t: "order_items" },
];

async function probeSelect(role: RoleKey, table: string) {
  const c = await clientAs(role);
  const { data, error } = await c.from(table as any).select("*").limit(1);
  return { data, error };
}

describe("RLS SELECT matrix", () => {
  beforeAll(async () => { await ensureFixture(); }, 90_000);

  describe("public-read tables (everyone)", () => {
    for (const t of PUBLIC_READ_TABLES) {
      it(`${t} – anon can read`, async () => {
        const { error } = await probeSelect("anon", t);
        expect(error, `anon should read ${t}, got: ${error?.message}`).toBeNull();
      });
    }
  });

  describe("admin-only tables", () => {
    for (const t of ADMIN_ONLY_READ) {
      it(`${t} – anon denied / empty`, async () => {
        const { data, error } = await probeSelect("anon", t);
        const denied = !!error || (data?.length ?? 0) === 0;
        expect(denied, `anon must NOT read ${t}`).toBe(true);
      });
      it(`${t} – regular user denied / empty`, async () => {
        const { data, error } = await probeSelect("user", t);
        const denied = !!error || (data?.length ?? 0) === 0;
        expect(denied, `regular user must NOT read ${t}`).toBe(true);
      });
      it(`${t} – admin can query`, async () => {
        const { error } = await probeSelect("admin", t);
        expect(error, `admin should read ${t}, got: ${error?.message}`).toBeNull();
      });
    }
  });

  describe("auth-only tables", () => {
    for (const { t, allowed } of AUTH_ONLY_READ) {
      it(`${t} – anon denied`, async () => {
        const { data, error } = await probeSelect("anon", t);
        const denied = !!error || (data?.length ?? 0) === 0;
        expect(denied).toBe(true);
      });
      for (const r of allowed) {
        it(`${t} – ${r} can query`, async () => {
          const { error } = await probeSelect(r, t);
          expect(error, `${r} should read ${t}, got: ${error?.message}`).toBeNull();
        });
      }
    }
  });

  describe("owner-scoped tables", () => {
    for (const { t } of OWNER_READ) {
      it(`${t} – anon denied / empty`, async () => {
        const { data, error } = await probeSelect("anon", t);
        const denied = !!error || (data?.length ?? 0) === 0;
        expect(denied).toBe(true);
      });
    }

    it("birth_lists – owner sees own list", async () => {
      const f = await ensureFixture();
      const c = await clientAs("owner");
      const { data, error } = await c.from("birth_lists").select("id").eq("id", f.list_id);
      expect(error).toBeNull();
      expect((data ?? []).length).toBeGreaterThan(0);
    });

    it("birth_lists – other user does NOT see foreign list", async () => {
      const f = await ensureFixture();
      const c = await clientAs("user");
      const { data, error } = await c.from("birth_lists").select("id").eq("id", f.list_id);
      expect(error).toBeNull();
      expect((data ?? []).length).toBe(0);
    });

    it("list_section_translations – owner sees, foreign user does not", async () => {
      const f = await ensureFixture();
      const owner = await clientAs("owner");
      const other = await clientAs("user");
      const a = await owner.from("list_section_translations").select("section_id").eq("section_id", f.section_id);
      const b = await other.from("list_section_translations").select("section_id").eq("section_id", f.section_id);
      expect(a.error).toBeNull();
      expect((a.data ?? []).length).toBeGreaterThan(0);
      expect(b.error).toBeNull();
      expect((b.data ?? []).length).toBe(0);
    });
  });
});
