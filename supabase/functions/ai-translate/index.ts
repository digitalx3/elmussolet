// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Provider = "lovable" | "openai" | "anthropic";

interface TranslateBody {
  action?: "translate" | "status";
  items?: string[]; // strings to translate
  source_language: string;
  target_language: string;
  context?: string;
  scope?: string;     // for logging (e.g. "ui", "product_translations")
  provider?: Provider;
}

const MAX_ATTEMPTS = 3;

async function withRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  let lastErr: any;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (e: any) {
      lastErr = e;
      const msg = String(e?.message || e);
      const transient =
        msg === "RATE_LIMIT" ||
        msg.includes("RATE_LIMIT") ||
        msg.includes("timeout") ||
        msg.includes("ECONNRESET") ||
        /\b5\d\d\b/.test(msg);
      if (!transient || attempt === MAX_ATTEMPTS) {
        throw new Error(`${label} failed after ${attempt} attempt(s): ${msg}`);
      }
      const wait = 600 * attempt;
      console.warn(`${label} transient error (attempt ${attempt}/${MAX_ATTEMPTS}), retrying in ${wait}ms: ${msg}`);
      await new Promise(r => setTimeout(r, wait));
    }
  }
  throw lastErr;
}

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function availability() {
  return {
    lovable: !!Deno.env.get("LOVABLE_API_KEY"),
    openai: !!Deno.env.get("OPENAI_API_KEY"),
    anthropic: !!Deno.env.get("ANTHROPIC_API_KEY"),
  };
}

async function getActiveProvider(admin: any, override?: Provider): Promise<Provider> {
  if (override) return override;
  const { data } = await admin
    .from("site_settings")
    .select("value")
    .eq("key", "ai_provider")
    .maybeSingle();
  const v = (data?.value as Provider) || "lovable";
  return v;
}

function buildPrompt(items: string[], source: string, target: string, ctx?: string) {
  return [
    `You are a professional translator for an ecommerce website (baby & childcare goods).`,
    `Translate each item in the JSON array from "${source}" to "${target}".`,
    `Keep tone natural, concise, brand-appropriate.`,
    `Preserve placeholders like {{name}}, {0}, %s, HTML tags, and markdown exactly.`,
    `Do NOT translate URLs, brand names, or product references.`,
    ctx ? `Context: ${ctx}` : "",
    `Return ONLY a JSON object: {"translations": ["...", "...", ...]} with EXACTLY ${items.length} items, in the same order.`,
    `Input:`,
    JSON.stringify(items),
  ].filter(Boolean).join("\n");
}

function parseJsonLoose(text: string): any {
  const trimmed = text.trim();
  // strip code fences
  const fenced = trimmed.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  try { return JSON.parse(fenced); } catch { /* fall through */ }
  // try first {...}
  const m = fenced.match(/\{[\s\S]*\}/);
  if (m) {
    try { return JSON.parse(m[0]); } catch { /* nope */ }
  }
  throw new Error("Model did not return valid JSON");
}

async function callLovable(prompt: string): Promise<string> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new Error("LOVABLE_API_KEY not set");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Lovable-API-Key": key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: "You are a professional translator. Reply with valid JSON only." },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    if (res.status === 429) throw new Error("RATE_LIMIT");
    if (res.status === 402) throw new Error("CREDITS_EXHAUSTED");
    throw new Error(`Lovable AI error ${res.status}: ${t}`);
  }
  const j = await res.json();
  return j?.choices?.[0]?.message?.content ?? "";
}

async function callOpenAI(prompt: string): Promise<string> {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) throw new Error("OPENAI_API_KEY not set");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a professional translator. Reply with valid JSON only." },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${t}`);
  }
  const j = await res.json();
  return j?.choices?.[0]?.message?.content ?? "";
}

async function callAnthropic(prompt: string): Promise<string> {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) throw new Error("ANTHROPIC_API_KEY not set");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 4096,
      messages: [
        { role: "user", content: prompt + "\n\nRespond with only valid JSON, no markdown." },
      ],
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Anthropic error ${res.status}: ${t}`);
  }
  const j = await res.json();
  const txt = (j?.content?.[0]?.text as string) ?? "";
  return txt;
}

async function translateBatch(provider: Provider, items: string[], source: string, target: string, ctx?: string): Promise<string[]> {
  const prompt = buildPrompt(items, source, target, ctx);
  const raw = await withRetry(`call ${provider}`, async () => {
    if (provider === "openai") return await callOpenAI(prompt);
    if (provider === "anthropic") return await callAnthropic(prompt);
    return await callLovable(prompt);
  });

  const parsed = parseJsonLoose(raw);
  const arr = parsed?.translations;
  if (!Array.isArray(arr)) throw new Error("Model response missing 'translations' array");
  if (arr.length !== items.length) {
    const out = new Array(items.length).fill("");
    for (let i = 0; i < Math.min(arr.length, items.length); i++) out[i] = String(arr[i] ?? "");
    return out;
  }
  return arr.map((x: any) => String(x ?? ""));
}

async function logCall(admin: any, row: Record<string, any>) {
  try {
    await admin.from("ai_translation_logs").insert(row);
  } catch (e) {
    console.warn("ai_translation_logs insert failed", e);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const started = Date.now();
  let admin: any = null;
  let userId: string | null = null;
  let provider: Provider | null = null;
  let body: TranslateBody | null = null;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return json({ error: "Missing auth" }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
    userId = userData.user.id;

    admin = createClient(supabaseUrl, serviceKey);
    const { data: profile } = await admin
      .from("profiles").select("role").eq("id", userId).single();
    if (profile?.role !== "admin") return json({ error: "Forbidden" }, 403);

    body = (await req.json()) as TranslateBody;

    if (body.action === "status") {
      const p = await getActiveProvider(admin);
      return json({ provider: p, available: availability() });
    }

    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return json({ error: "items required" }, 400);
    }
    if (!body.source_language || !body.target_language) {
      return json({ error: "source_language and target_language required" }, 400);
    }
    if (body.source_language === body.target_language) {
      return json({ translations: body.items });
    }

    provider = await getActiveProvider(admin, body.provider);
    const avail = availability();
    if (provider === "openai" && !avail.openai) return json({ error: "OPENAI_API_KEY not configured" }, 400);
    if (provider === "anthropic" && !avail.anthropic) return json({ error: "ANTHROPIC_API_KEY not configured" }, 400);
    if (provider === "lovable" && !avail.lovable) return json({ error: "LOVABLE_API_KEY not configured" }, 400);

    const CHUNK = 40;
    const out: string[] = [];
    const failedItems: string[] = [];
    let chunkErrors = 0;
    let lastChunkErr = "";
    for (let i = 0; i < body.items.length; i += CHUNK) {
      const chunk = body.items.slice(i, i + CHUNK);
      try {
        const part = await translateBatch(provider, chunk, body.source_language, body.target_language, body.context);
        // Treat empty strings returned by the model as failures too.
        part.forEach((v, idx) => {
          if (!v || !String(v).trim()) failedItems.push(chunk[idx]);
        });
        out.push(...part);
      } catch (e: any) {
        chunkErrors += chunk.length;
        lastChunkErr = String(e?.message || e);
        failedItems.push(...chunk);
        // pad with empty strings so caller index stays aligned
        out.push(...new Array(chunk.length).fill(""));
      }
    }

    const successCount = body.items.length - chunkErrors;
    const status = chunkErrors === 0 ? "success" : (successCount > 0 ? "partial" : "error");

    const isRetry = !!(body.scope && body.scope.includes("retry"));
    const recoveredItems: string[] = [];
    if (isRetry) {
      const failedSet = new Set(failedItems);
      body.items.forEach((it) => { if (!failedSet.has(it)) recoveredItems.push(it); });
    }

    await logCall(admin, {
      user_id: userId,
      function_name: "ai-translate",
      scope: body.scope || null,
      source_language: body.source_language,
      target_language: body.target_language,
      items_count: body.items.length,
      success_count: successCount,
      error_count: chunkErrors,
      status,
      provider,
      error_message: chunkErrors > 0 ? lastChunkErr.slice(0, 500) : null,
      duration_ms: Date.now() - started,
      metadata: {
        ...(failedItems.length > 0 ? { failed_items: failedItems.slice(0, 200) } : {}),
        ...(isRetry ? {
          retried_items: body.items.slice(0, 200),
          recovered_items: recoveredItems.slice(0, 200),
          retried_count: body.items.length,
          recovered_count: recoveredItems.length,
        } : {}),
        context: body.context || null,
      },
    });

    return json({ translations: out, provider, status, success_count: successCount, error_count: chunkErrors, error_message: chunkErrors > 0 ? lastChunkErr : null });
  } catch (e: any) {
    const msg = String(e?.message || e);
    console.error("ai-translate error", msg);
    if (admin) {
      await logCall(admin, {
        user_id: userId,
        function_name: "ai-translate",
        scope: body?.scope || null,
        source_language: body?.source_language || null,
        target_language: body?.target_language || null,
        items_count: body?.items?.length || 0,
        success_count: 0,
        error_count: body?.items?.length || 0,
        status: "error",
        provider,
        error_message: msg.slice(0, 500),
        duration_ms: Date.now() - started,
        metadata: body?.items?.length
          ? { failed_items: body.items.slice(0, 200), context: body?.context || null }
          : null,
      });
    }
    if (msg === "RATE_LIMIT" || msg.includes("RATE_LIMIT")) return json({ error: "RATE_LIMIT" }, 429);
    if (msg === "CREDITS_EXHAUSTED" || msg.includes("CREDITS_EXHAUSTED")) return json({ error: "CREDITS_EXHAUSTED" }, 402);
    return json({ error: msg }, 500);
  }
});

