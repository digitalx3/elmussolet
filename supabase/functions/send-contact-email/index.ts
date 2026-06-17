import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { name, email, phone, subject, message, language } = body ?? {};

    if (!name || !email || !message) {
      return new Response(JSON.stringify({ error: 'Missing fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (String(message).length > 5000 || String(name).length > 150 || String(email).length > 200) {
      return new Response(JSON.stringify({ error: 'Field too long' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceKey);

    // 1) Persist in DB
    const { data: inserted, error: insertErr } = await admin
      .from('contact_messages')
      .insert({
        name: String(name).slice(0, 150),
        email: String(email).slice(0, 200),
        phone: phone ? String(phone).slice(0, 60) : null,
        subject: subject ? String(subject).slice(0, 200) : null,
        message: String(message).slice(0, 5000),
        language: language === 'es' ? 'es' : 'ca',
      })
      .select()
      .single();

    if (insertErr) {
      console.error('Insert error:', insertErr);
      return new Response(JSON.stringify({ error: 'Could not save message' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2) Lookup store email
    const { data: setting } = await admin
      .from('site_settings')
      .select('value')
      .eq('key', 'store_email')
      .maybeSingle();
    const storeEmail = setting?.value;

    // 3) Try sending via Resend if available; otherwise log only
    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (resendKey && storeEmail) {
      try {
        const fromAddress = Deno.env.get('RESEND_FROM') || 'onboarding@resend.dev';
        const html = `
          <h2>Nou missatge del formulari de contacte</h2>
          <p><strong>Nom:</strong> ${escapeHtml(name)}</p>
          <p><strong>Email:</strong> ${escapeHtml(email)}</p>
          ${phone ? `<p><strong>Telèfon:</strong> ${escapeHtml(phone)}</p>` : ''}
          ${subject ? `<p><strong>Assumpte:</strong> ${escapeHtml(subject)}</p>` : ''}
          <p><strong>Missatge:</strong></p>
          <p style="white-space:pre-wrap">${escapeHtml(message)}</p>
        `;
        const r = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: fromAddress,
            to: [storeEmail],
            reply_to: email,
            subject: `[Contacte] ${subject || name}`,
            html,
          }),
        });
        if (!r.ok) console.error('Resend error', r.status, await r.text());
      } catch (e) {
        console.error('Email send failed:', e);
      }
    } else {
      console.log(`[CONTACT] New message saved (id=${inserted.id}) — no email sent (RESEND_API_KEY or store_email missing)`);
    }

    return new Response(JSON.stringify({ success: true, id: inserted.id }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('Error:', e);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
