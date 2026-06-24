import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-maintenance-token',
};

function ipToInt(ip: string): number | null {
  const parts = ip.trim().split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    const v = Number(p);
    if (!Number.isInteger(v) || v < 0 || v > 255) return null;
    n = (n << 8) + v;
  }
  return n >>> 0;
}

function ipMatches(ip: string, rule: string): boolean {
  rule = rule.trim();
  if (!rule) return false;
  if (rule === ip) return true;
  if (rule.includes('/')) {
    const [base, bitsStr] = rule.split('/');
    const bits = Number(bitsStr);
    if (!Number.isInteger(bits) || bits < 0 || bits > 32) return false;
    const a = ipToInt(ip);
    const b = ipToInt(base);
    if (a === null || b === null) return false;
    if (bits === 0) return true;
    const mask = (0xffffffff << (32 - bits)) >>> 0;
    return (a & mask) === (b & mask);
  }
  return false;
}

function getClientIp(req: Request): string {
  const xf = req.headers.get('x-forwarded-for') || '';
  const first = xf.split(',')[0]?.trim();
  if (first) return first;
  return req.headers.get('x-real-ip') || '';
}

function constantTimeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data, error } = await supabase
      .from('maintenance_settings')
      .select('id, enabled, show_logo, message_ca, message_es, allowed_ips, emergency_token_hash, emergency_token_expires_at, emergency_token_single_use, emergency_token_used_at')
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    const ip = getClientIp(req);
    const allowed: string[] = data?.allowed_ips ?? [];
    const ipBypass = !!ip && allowed.some((r) => ipMatches(ip, r));

    const url = new URL(req.url);
    const providedToken =
      url.searchParams.get('token') ||
      req.headers.get('x-maintenance-token') ||
      '';

    let tokenBypass = false;
    if (
      providedToken &&
      data?.emergency_token_hash &&
      data?.emergency_token_expires_at &&
      new Date(data.emergency_token_expires_at).getTime() > Date.now() &&
      (!data.emergency_token_single_use || !data.emergency_token_used_at)
    ) {
      const providedHash = await sha256Hex(providedToken);
      if (constantTimeEq(providedHash, data.emergency_token_hash)) {
        tokenBypass = true;
        if (data.emergency_token_single_use && !data.emergency_token_used_at) {
          // Mark first use — subsequent calls with the same token will be rejected.
          await supabase
            .from('maintenance_settings')
            .update({ emergency_token_used_at: new Date().toISOString() })
            .eq('id', data.id)
            .is('emergency_token_used_at', null);
        }
      }
    }

    return new Response(
      JSON.stringify({
        enabled: !!data?.enabled,
        show_logo: data?.show_logo ?? true,
        message_ca: data?.message_ca ?? '',
        message_es: data?.message_es ?? '',
        bypass: ipBypass || tokenBypass,
        bypass_reason: ipBypass ? 'ip' : (tokenBypass ? 'token' : null),
        client_ip: ip,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ enabled: false, bypass: true, error: String(e) }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
