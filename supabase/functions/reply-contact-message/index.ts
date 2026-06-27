// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { data: isAdmin } = await admin.rpc("is_admin", { _user_id: user.id });
    if (!isAdmin) return json({ error: "Forbidden" }, 403);

    const body = await req.json();
    const messageId = String(body?.message_id || "");
    const replyBody = String(body?.body || "").trim();
    if (!messageId || !replyBody) return json({ error: "Missing fields" }, 400);
    if (replyBody.length > 10000) return json({ error: "Reply too long" }, 400);

    const { data: msg, error: msgErr } = await admin
      .from("contact_messages")
      .select("*")
      .eq("id", messageId)
      .maybeSingle();
    if (msgErr || !msg) return json({ error: "Message not found" }, 404);

    // Persist reply
    const { data: reply, error: insErr } = await admin
      .from("contact_message_replies")
      .insert({
        message_id: messageId,
        direction: "admin",
        body: replyBody,
        author_id: user.id,
        author_name: user.email ?? null,
      })
      .select()
      .single();
    if (insErr) return json({ error: insErr.message }, 500);

    // Build email
    const { data: nameSetting } = await admin
      .from("site_settings").select("value").eq("key", "store_name").maybeSingle();
    const storeName = (nameSetting?.value as string) || "El Mussolet";

    const subjectLine = msg.subject
      ? `Re: ${msg.subject}`
      : `Resposta del teu missatge a ${storeName}`;

    const html = `
      <div style="font-family:Arial,sans-serif;color:#222;max-width:600px">
        <p>Hola ${escapeHtml(msg.name)},</p>
        <p>Has rebut una resposta al teu missatge enviat a <strong>${escapeHtml(storeName)}</strong>:</p>
        <div style="border-left:3px solid #888;padding:8px 12px;background:#f7f7f7;white-space:pre-wrap;margin:12px 0">${escapeHtml(replyBody)}</div>
        <hr style="border:none;border-top:1px solid #eee;margin:18px 0" />
        <p style="color:#666;font-size:13px"><strong>El teu missatge original:</strong></p>
        <div style="color:#666;font-size:13px;white-space:pre-wrap">${escapeHtml(msg.message)}</div>
        <p style="margin-top:20px">Salutacions,<br/>${escapeHtml(storeName)}</p>
      </div>
    `;

    let emailSent = false;
    let emailError: string | null = null;
    try {
      const r = await fetch(`${supabaseUrl}/functions/v1/send-smtp-email`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: msg.email,
          subject: subjectLine,
          html,
        }),
      });
      if (!r.ok) {
        emailError = `${r.status} ${await r.text()}`;
      } else {
        emailSent = true;
      }
    } catch (e: any) {
      emailError = e?.message ?? String(e);
    }

    await admin
      .from("contact_message_replies")
      .update({ email_sent: emailSent, email_error: emailError })
      .eq("id", reply.id);

    // Notify admin too
    try {
      const { data: storeEmailSetting } = await admin
        .from("site_settings").select("value").eq("key", "store_email").maybeSingle();
      const storeEmail = storeEmailSetting?.value as string | undefined;
      if (storeEmail) {
        await fetch(`${supabaseUrl}/functions/v1/send-smtp-email`, {
          method: "POST",
          headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            to: storeEmail,
            subject: `[Còpia resposta] ${subjectLine}`,
            html: `<p>Resposta enviada a ${escapeHtml(msg.email)} per ${escapeHtml(user.email ?? "admin")}.</p>${html}`,
          }),
        });
      }
    } catch (e) {
      console.error("admin copy failed", e);
    }

    // Touch parent (updated_at)
    await admin.from("contact_messages").update({ is_read: true }).eq("id", messageId);

    return json({ ok: true, reply, email_sent: emailSent, email_error: emailError });
  } catch (e: any) {
    console.error("reply-contact-message error", e);
    return json({ error: e?.message ?? String(e) }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
