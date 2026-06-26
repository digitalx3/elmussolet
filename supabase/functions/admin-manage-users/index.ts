// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Body {
  action: "create" | "update" | "delete" | "restore" | "get";
  user_id?: string;
  email?: string;
  password?: string;
  full_name?: string;
  phone?: string;
  role?: string;
  preferred_language?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  postal_code?: string;
  province?: string;
  nif?: string;
  company_name?: string;
  send_welcome_email?: boolean;
  delete_mode?: "soft" | "hard";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return json({ error: "Missing auth" }, 200);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      console.error("auth.getUser failed", userErr);
      return json({
        error:
          "La teva sessió ha caducat. Tanca sessió i torna a entrar per continuar.",
      }, 200);
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .single();
    if (profile?.role !== "admin") return json({ error: "Forbidden" }, 200);

    // Check if caller is super_admin
    const { data: callerRoles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);
    const callerIsSuper = (callerRoles || []).some((r: any) => r.role === "super_admin");

    const isTargetSuper = async (uid: string) => {
      const { data } = await admin
        .from("user_roles").select("role").eq("user_id", uid).eq("role", "super_admin").maybeSingle();
      return !!data;
    };

    const body = (await req.json()) as Body;

    if (body.action === "create") {
      if (!body.email || !body.password) {
        return json({ error: "email and password required" }, 400);
      }
      // Block re-registration with an email that belongs to a soft-deleted user
      const { data: blocked } = await admin
        .from("profiles")
        .select("id")
        .eq("deleted_email", body.email.toLowerCase())
        .not("deleted_at", "is", null)
        .maybeSingle();
      if (blocked) {
        return json({ error: "EMAIL_BLOCKED_DELETED_USER" }, 409);
      }

      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: body.email,
        password: body.password,
        email_confirm: true,
        user_metadata: { full_name: body.full_name || "" },
      });
      if (createErr) throw createErr;

      await admin.from("profiles").update({
        full_name: body.full_name || null,
        phone: body.phone || null,
        role: body.role || "customer",
        preferred_language: body.preferred_language || "ca",
      }).eq("id", created.user.id);

      if (body.send_welcome_email) {
        try {
          const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>Benvingut/da a El Mussolet${body.full_name ? `, ${body.full_name}` : ""}!</h2>
              <p>S'ha creat un compte per a tu amb les següents credencials:</p>
              <p><strong>Email:</strong> ${body.email}<br/>
              <strong>Contrasenya:</strong> ${body.password}</p>
              <p>Et recomanem canviar la contrasenya després del primer accés.</p>
              <p>Salut!<br/>L'equip d'El Mussolet</p>
            </div>`;
          await admin.functions.invoke("send-smtp-email", {
            body: {
              to: body.email,
              subject: "Benvingut/da a El Mussolet",
              html,
            },
          });
        } catch (e) {
          console.error("Welcome email failed", e);
        }
      }

      return json({ ok: true, user_id: created.user.id });
    }

    if (body.action === "update") {
      if (!body.user_id) return json({ error: "user_id required" }, 400);
      if (!callerIsSuper && (await isTargetSuper(body.user_id))) {
        return json({ error: "Forbidden: cannot modify Super Admin" }, 403);
      }
      const updates: any = {};
      if (body.email) updates.email = body.email;
      if (body.password) updates.password = body.password;
      if (Object.keys(updates).length > 0) {
        const { error } = await admin.auth.admin.updateUserById(body.user_id, updates);
        if (error) throw error;
      }
      const profileUpdate: any = {};
      if (body.full_name !== undefined) profileUpdate.full_name = body.full_name;
      if (body.phone !== undefined) profileUpdate.phone = body.phone;
      if (body.role !== undefined) profileUpdate.role = body.role;
      if (body.preferred_language !== undefined) profileUpdate.preferred_language = body.preferred_language;
      if (body.address_line1 !== undefined) profileUpdate.address_line1 = body.address_line1;
      if (body.address_line2 !== undefined) profileUpdate.address_line2 = body.address_line2;
      if (body.city !== undefined) profileUpdate.city = body.city;
      if (body.postal_code !== undefined) profileUpdate.postal_code = body.postal_code;
      if (body.province !== undefined) profileUpdate.province = body.province;
      if (body.nif !== undefined) profileUpdate.nif = body.nif;
      if (body.company_name !== undefined) profileUpdate.company_name = body.company_name;
      if (Object.keys(profileUpdate).length > 0) {
        await admin.from("profiles").update(profileUpdate).eq("id", body.user_id);
      }
      return json({ ok: true });
    }

    if (body.action === "get") {
      if (!body.user_id) return json({ error: "user_id required" }, 400);
      const { data: u, error: gErr } = await admin.auth.admin.getUserById(body.user_id);
      if (gErr) {
        console.error("auth.admin.getUserById failed", gErr);
        return json({ error: gErr.message }, 200);
      }
      const { data: prof, error: pErr } = await admin
        .from("profiles").select("*").eq("id", body.user_id).maybeSingle();
      if (pErr) {
        console.error("profiles select failed", pErr);
        return json({ error: pErr.message }, 200);
      }
      return json({ ok: true, email: u?.user?.email || "", profile: prof || {} });
    }

    if (body.action === "delete") {
      if (!body.user_id) return json({ error: "user_id required" }, 400);
      if (body.user_id === userData.user.id) {
        return json({ error: "Cannot delete yourself" }, 400);
      }
      if (!callerIsSuper && (await isTargetSuper(body.user_id))) {
        return json({ error: "Forbidden: cannot delete Super Admin" }, 403);
      }
      const mode = body.delete_mode || "soft";

      // Get the user's email (for blocking re-registration in soft mode)
      const { data: targetUser, error: getErr } = await admin.auth.admin.getUserById(body.user_id);
      if (getErr) throw getErr;
      const targetEmail = targetUser?.user?.email?.toLowerCase() || null;

      if (mode === "soft") {
        // Mark profile deleted (keep email reserved) and disable auth login by banning.
        await admin.from("profiles").update({
          deleted_at: new Date().toISOString(),
          deleted_email: targetEmail,
        }).eq("id", body.user_id);

        // Ban the auth user so they can't log in. The email remains taken in auth.users
        // so the same address cannot be used to register again.
        try {
          await admin.auth.admin.updateUserById(body.user_id, {
            ban_duration: "876000h", // ~100 years
          } as any);
        } catch (e) {
          console.error("ban user failed", e);
        }
        return json({ ok: true, mode: "soft" });
      }

      // HARD delete: wipe related data first, then the auth user.
      const step = async (label: string, fn: () => Promise<any>) => {
        const res = await fn();
        if (res?.error) {
          console.error(`hard-delete step "${label}" failed`, res.error);
          throw new Error(`${label}: ${res.error.message || res.error}`);
        }
        return res;
      };

      try {
        // 0) Find linked customer(s) for this auth user (orders no longer reference auth.users)
        const { data: linkedCustomers } = await admin
          .from("customers").select("id").eq("auth_user_id", body.user_id);
        const customerIds = (linkedCustomers || []).map((c: any) => c.id);

        // 1) Orders + order_items owned by this user's customer(s)
        let orderIds: string[] = [];
        if (customerIds.length > 0) {
          const { data: ordersToDelete } = await admin
            .from("orders").select("id").in("customer_id", customerIds);
          orderIds = (ordersToDelete || []).map((o: any) => o.id);
        }
        if (orderIds.length > 0) {
          await step("delete user order_items", () =>
            admin.from("order_items").delete().in("order_id", orderIds));
          await step("delete user orders", () =>
            admin.from("orders").delete().in("id", orderIds));
        }

        // Detach customer(s) from auth user (don't delete; preserves history)
        if (customerIds.length > 0) {
          await step("detach customer(s) from auth user", () =>
            admin.from("customers").update({ auth_user_id: null }).in("id", customerIds));
        }


        // 2) Birth lists owned by this user
        const { data: ownerRows } = await admin
          .from("list_owners").select("list_id").eq("user_id", body.user_id);
        const ownedListIds = Array.from(new Set((ownerRows || []).map((r: any) => r.list_id)));

        await step("delete list_owners (self)", () =>
          admin.from("list_owners").delete().eq("user_id", body.user_id));

        // For lists with no remaining owners, fully wipe them
        if (ownedListIds.length > 0) {
          const { data: remaining } = await admin
            .from("list_owners").select("list_id").in("list_id", ownedListIds);
          const stillOwned = new Set((remaining || []).map((r: any) => r.list_id));
          const orphanLists = ownedListIds.filter((id) => !stillOwned.has(id));
          if (orphanLists.length > 0) {
            // Other users may have placed orders on these lists; detach + wipe them
            const { data: relatedOrders } = await admin
              .from("orders").select("id").in("list_id", orphanLists);
            const relOrderIds = (relatedOrders || []).map((o: any) => o.id);
            if (relOrderIds.length > 0) {
              await step("delete orphan-list order_items", () =>
                admin.from("order_items").delete().in("order_id", relOrderIds));
              await step("delete orphan-list orders", () =>
                admin.from("orders").delete().in("id", relOrderIds));
            }
            await step("delete list_items", () =>
              admin.from("list_items").delete().in("list_id", orphanLists));
            await step("delete list_sections", () =>
              admin.from("list_sections").delete().in("list_id", orphanLists));
            await step("delete birth_lists", () =>
              admin.from("birth_lists").delete().in("id", orphanLists));
          }
        }

        // 3) Birth lists created by admin on behalf of this user
        await step("null birth_lists.created_by", () =>
          admin.from("birth_lists").update({ created_by: null }).eq("created_by", body.user_id));

        // 4) Finally delete the auth user (profile cascades via FK)
        const { error: delErr } = await admin.auth.admin.deleteUser(body.user_id);
        if (delErr) {
          console.error("auth.admin.deleteUser failed", delErr);
          return json({ error: `No s'ha pogut eliminar l'usuari d'autenticació: ${delErr.message}` }, 200);
        }
        return json({ ok: true, mode: "hard" });
      } catch (e: any) {
        console.error("hard delete failed", e);
        return json({ error: e?.message || "Error eliminant l'usuari permanentment" }, 200);
      }
    }

    if (body.action === "restore") {
      if (!body.user_id) return json({ error: "user_id required" }, 400);

      // 1) Unban the auth user (remove ban_duration / banned_until)
      try {
        await admin.auth.admin.updateUserById(body.user_id, {
          ban_duration: "none",
        } as any);
      } catch (e) {
        console.error("unban via admin API failed", e);
      }

      // 2) Clear soft-delete markers on the profile so the email is freed
      const { error: profErr } = await admin.from("profiles").update({
        deleted_at: null,
        deleted_email: null,
      }).eq("id", body.user_id);
      if (profErr) {
        console.error("profile restore failed", profErr);
        return json({ error: profErr.message }, 200);
      }

      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 200);
  } catch (e: any) {
    console.error("admin-manage-users error", e);
    return json({ error: e?.message ?? "Unknown error" }, 200);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
