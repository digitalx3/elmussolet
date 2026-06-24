import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data, error } = await supabase
      .from('maintenance_settings')
      .select('enabled, show_logo, message_ca, message_es, allowed_ips')
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    const ip = getClientIp(req);
    const allowed: string[] = data?.allowed_ips ?? [];
    const bypass = !!ip && allowed.some((r) => ipMatches(ip, r));

    return new Response(
      JSON.stringify({
        enabled: !!data?.enabled,
        show_logo: data?.show_logo ?? true,
        message_ca: data?.message_ca ?? '',
        message_es: data?.message_es ?? '',
        bypass,
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
