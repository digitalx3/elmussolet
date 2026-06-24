// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import nodemailer from "npm:nodemailer@6.9.16";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface SendBody {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
  /** If true, ignore is_active flag (used by "Test send" from admin). */
  testMode?: boolean;
  /** Optional override config (used by admin test before saving). */
  override?: {
    host: string;
    port: number;
    username: string;
    password: string;
    security: "none" | "ssl" | "tls" | "starttls";
    from_email: string;
    from_name?: string;
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  let recipientForLog = "";
  let subjectForLog = "";
  let hostForLog: string | null = null;
  let testModeForLog = false;

  const logAttempt = async (success: boolean, errorMessage: string | null) => {
    try {
      await supabase.from("smtp_send_log").insert({
        recipient: recipientForLog || "(unknown)",
        subject: subjectForLog || "(unknown)",
        smtp_host: hostForLog,
        test_mode: testModeForLog,
        success,
        error_message: errorMessage,
      });
    } catch (e) {
      console.error("Failed to write smtp_send_log:", e);
    }
  };

  try {
    const body = (await req.json()) as SendBody;
    subjectForLog = body?.subject ?? "";
    recipientForLog = Array.isArray(body?.to)
      ? body.to.join(", ")
      : (body?.to as string) ?? "";
    testModeForLog = !!body?.testMode;

    if (!body?.to || !body?.subject || (!body.html && !body.text)) {
      const msg = "Missing required fields (to, subject, html/text)";
      await logAttempt(false, msg);
      return json({ error: msg }, 400);
    }

    let cfg = body.override;
    if (!cfg) {
      const { data, error } = await supabase
        .from("smtp_settings")
        .select("*")
        .eq("is_active", true)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        const msg = "No active SMTP configuration found";
        await logAttempt(false, msg);
        return json({ error: msg }, 400);
      }
      cfg = {
        host: data.host,
        port: data.port,
        username: data.username,
        password: data.password,
        security: data.security,
        from_email: data.from_email,
        from_name: data.from_name,
      };
    }

    hostForLog = cfg.host ?? null;

    if (!cfg.host || !cfg.from_email) {
      const msg = "SMTP not configured (missing host or from_email)";
      await logAttempt(false, msg);
      return json({ error: msg }, 400);
    }

    // SSL = implicit TLS (typically port 465)
    // STARTTLS / TLS = upgrade plain connection (typically 587)
    // NONE = plain
    const isImplicitTls = cfg.security === "ssl";
    const isStartTls = cfg.security === "starttls" || cfg.security === "tls";

    const transporter = nodemailer.createTransport({
      host: cfg.host,
      port: Number(cfg.port),
      secure: isImplicitTls, // true => implicit TLS (465)
      requireTLS: isStartTls, // upgrade with STARTTLS
      auth: cfg.username
        ? { user: cfg.username, pass: cfg.password }
        : undefined,
      tls: {
        // many shared hosts use self-signed/intermediate certs; let it connect
        rejectUnauthorized: false,
      },
      connectionTimeout: 15000,
      greetingTimeout: 10000,
      socketTimeout: 20000,
    });

    // Surface SMTP-level errors early
    try {
      await transporter.verify();
    } catch (verifyErr: any) {
      const msg = `SMTP verify failed: ${verifyErr?.message ?? verifyErr}`;
      console.error(msg, verifyErr);
      await logAttempt(false, msg);
      return json({ error: msg }, 502);
    }

    const fromHeader = cfg.from_name
      ? `"${cfg.from_name}" <${cfg.from_email}>`
      : cfg.from_email;

    const recipients = Array.isArray(body.to) ? body.to : [body.to];

    const info = await transporter.sendMail({
      from: fromHeader,
      to: recipients,
      replyTo: body.replyTo,
      subject: body.subject,
      text: body.text ?? body.html?.replace(/<[^>]+>/g, " ") ?? "",
      html: body.html,
    });

    await logAttempt(true, null);

    return json({ ok: true, messageId: info?.messageId ?? null });
  } catch (e: any) {
    const msg = e?.message ?? String(e) ?? "Unknown error";
    console.error("send-smtp-email error", e);
    await logAttempt(false, msg);
    return json({ error: msg }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
