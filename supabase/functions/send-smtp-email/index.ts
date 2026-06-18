// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

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

  try {
    const body = (await req.json()) as SendBody;
    if (!body?.to || !body?.subject || (!body.html && !body.text)) {
      return json({ error: "Missing required fields (to, subject, html/text)" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

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
        return json({ error: "No active SMTP configuration found" }, 400);
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

    if (!cfg.host || !cfg.from_email) {
      return json({ error: "SMTP not configured (missing host or from_email)" }, 400);
    }

    const useTls = cfg.security === "ssl" || cfg.security === "tls";
    const client = new SMTPClient({
      connection: {
        hostname: cfg.host,
        port: cfg.port,
        tls: useTls,
        auth: cfg.username
          ? { username: cfg.username, password: cfg.password }
          : undefined,
      },
    });

    const fromHeader = cfg.from_name
      ? `${cfg.from_name} <${cfg.from_email}>`
      : cfg.from_email;

    const recipients = Array.isArray(body.to) ? body.to : [body.to];

    await client.send({
      from: fromHeader,
      to: recipients,
      replyTo: body.replyTo,
      subject: body.subject,
      content: body.text ?? body.html?.replace(/<[^>]+>/g, " ") ?? "",
      html: body.html,
    });

    await client.close();

    return json({ ok: true });
  } catch (e: any) {
    console.error("send-smtp-email error", e);
    return json({ error: e?.message ?? "Unknown error" }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
