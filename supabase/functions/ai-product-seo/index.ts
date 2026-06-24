// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Provider = "lovable" | "openai" | "anthropic";

interface Body {
  product_id?: string;
  name: string;
  sku?: string;
  brand?: string;
  category?: string;
  language: string;       // target language code
  language_name?: string; // human label e.g. "Català"
  current_short?: string;
  current_long?: string;
  provider?: Provider;
}

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function buildPrompt(b: Body): string {
  const lang = b.language_name || b.language;
  return [
    `You are an expert SEO and GEO (generative engine optimization) copywriter for an ecommerce website selling baby & childcare products in Catalonia/Spain.`,
    `Write product descriptions for the language: ${lang} (code: ${b.language}).`,
    ``,
    `Product info:`,
    `- Name: ${b.name}`,
    b.sku ? `- SKU / Reference: ${b.sku}` : ``,
    b.brand ? `- Brand: ${b.brand}` : ``,
    b.category ? `- Category: ${b.category}` : ``,
    b.current_short ? `- Existing short description (improve, do not copy verbatim): ${b.current_short}` : ``,
    b.current_long ? `- Existing long description (improve, do not copy verbatim): ${b.current_long}` : ``,
    ``,
    `Instructions:`,
    `1. Research-style: infer the product type from name/brand/SKU and produce accurate, plausible information. Do NOT invent specific technical specs that you cannot verify (e.g. exact dimensions, weights, materials) unless they are inferable from the name itself.`,
    `2. Write a SHORT description (max 160 characters, single sentence, no line breaks) with the primary keyword and a benefit. Plain text.`,
    `3. Write a LONG description in valid HTML (use <p>, <ul>, <li>, <strong>, <h3>) of 180–320 words, structured as:`,
    `   - Intro paragraph with main keyword in first sentence.`,
    `   - "Característiques destacades" (or equivalent in target language) as <h3> followed by <ul><li>...</li></ul>.`,
    `   - "Per a qui és" (or equivalent) as <h3> with a short paragraph mentioning age group / use case if inferable.`,
    `   - Closing paragraph with a soft call-to-action and secondary keywords.`,
    `4. Use natural, parent-friendly language. Optimize for SEO (semantic keywords, headings) and GEO (clear factual statements that AI search engines can quote).`,
    `5. Do not include the brand or product name verbatim more than 2-3 times. No marketing fluff like "the best" or "amazing".`,
    `6. Output language MUST be: ${lang}.`,
    ``,
    `Return ONLY a JSON object: {"short_description": "...", "description": "<p>...</p>"}`,
  ].filter(Boolean).join("\n");
}

function parseJsonLoose(text: string): any {
  const trimmed = text.trim();
  const fenced = trimmed.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  try { return JSON.parse(fenced); } catch { /* fall through */ }
  const m = fenced.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch { /* nope */ } }
  throw new Error("Model did not return valid JSON");
}

async function getActiveProvider(admin: any, override?: Provider): Promise<Provider> {
  if (override) return override;
  const { data } = await admin
    .from("site_settings")
    .select("value")
    .eq("key", "ai_provider")
    .maybeSingle();
  return ((data?.value as Provider) || "lovable");
}

async function callLovable(prompt: string): Promise<string> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new Error("LOVABLE_API_KEY not set");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Lovable-API-Key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: "You are a senior SEO copywriter. Reply with valid JSON only." },
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
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a senior SEO copywriter. Reply with valid JSON only." },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.5,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI error ${res.status}: ${await res.text()}`);
  const j = await res.json();
  return j?.choices?.[0]?.message?.content ?? "";
}

async function callAnthropic(prompt: string): Promise<string> {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) throw new Error("ANTHROPIC_API_KEY not set");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt + "\n\nRespond with only valid JSON, no markdown." }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic error ${res.status}: ${await res.text()}`);
  const j = await res.json();
  return (j?.content?.[0]?.text as string) ?? "";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

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

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: profile } = await admin
      .from("profiles").select("role").eq("id", userData.user.id).single();
    if (profile?.role !== "admin") return json({ error: "Forbidden" }, 403);

    const body = (await req.json()) as Body;
    if (!body.name || !body.language) return json({ error: "name and language required" }, 400);

    const provider = await getActiveProvider(admin, body.provider);

    const prompt = buildPrompt(body);
    let raw = "";
    if (provider === "openai") raw = await callOpenAI(prompt);
    else if (provider === "anthropic") raw = await callAnthropic(prompt);
    else raw = await callLovable(prompt);

    const parsed = parseJsonLoose(raw);
    return json({
      short_description: String(parsed.short_description || ""),
      description: String(parsed.description || ""),
      provider,
    });
  } catch (e: any) {
    const msg = String(e?.message || e);
    console.error("ai-product-seo error", msg);
    if (msg === "RATE_LIMIT") return json({ error: "RATE_LIMIT" }, 429);
    if (msg === "CREDITS_EXHAUSTED") return json({ error: "CREDITS_EXHAUSTED" }, 402);
    return json({ error: msg }, 500);
  }
});
