import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Verify calling user is admin
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claims?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = claims.claims.sub as string;

    // Use service role for admin check and data fetching
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: isAdmin } = await adminClient.rpc('is_admin', { _user_id: userId });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { order_id, new_status } = await req.json();

    if (!order_id || !new_status) {
      return new Response(JSON.stringify({ error: 'Missing order_id or new_status' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch order with user profile
    const { data: order, error: orderError } = await adminClient
      .from('orders')
      .select('*, profiles(full_name, preferred_language)')
      .eq('id', order_id)
      .single();

    if (orderError || !order) {
      return new Response(JSON.stringify({ error: 'Order not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user email from auth
    const { data: authUser } = await adminClient.auth.admin.getUserById(order.user_id);
    const customerEmail = authUser?.user?.email;

    if (!customerEmail) {
      return new Response(JSON.stringify({ error: 'Customer email not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const customerLang = (order as any).profiles?.preferred_language || 'ca';
    const customerName = (order as any).profiles?.full_name || customerEmail;

    // Get the email template for the new status
    const { data: statusRow } = await adminClient
      .from('order_statuses')
      .select('id, slug, order_status_translations(name, language)')
      .eq('slug', new_status)
      .single();

    if (!statusRow) {
      return new Response(JSON.stringify({ message: 'No status found, email skipped' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const statusTranslations = (statusRow as any).order_status_translations || [];
    const statusNameTr = statusTranslations.find((t: any) => t.language === customerLang) || statusTranslations[0];
    const statusName = statusNameTr?.name || new_status;

    const { data: emailTemplate } = await adminClient
      .from('order_status_email_templates')
      .select('subject, body_html')
      .eq('status_id', statusRow.id)
      .eq('language', customerLang)
      .single();

    if (!emailTemplate || !emailTemplate.subject) {
      return new Response(JSON.stringify({ message: 'No email template configured, skipped' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Replace template variables
    const formatPrice = (p: number) => new Intl.NumberFormat('ca-ES', { style: 'currency', currency: 'EUR' }).format(p);

    const replaceVars = (text: string) =>
      text
        .replace(/\{\{order_number\}\}/g, order.order_number)
        .replace(/\{\{customer_name\}\}/g, customerName)
        .replace(/\{\{status_name\}\}/g, statusName)
        .replace(/\{\{total\}\}/g, formatPrice(order.total));

    const subject = replaceVars(emailTemplate.subject);
    const body = replaceVars(emailTemplate.body_html);

    // Log the email (actual sending requires email service integration)
    console.log(`[ORDER EMAIL] To: ${customerEmail}, Subject: ${subject}`);
    console.log(`[ORDER EMAIL] Body: ${body}`);

    // TODO: Integrate with email sending service (Resend, etc.)
    // For now, log that the email would be sent

    return new Response(JSON.stringify({
      success: true,
      message: 'Email notification processed',
      to: customerEmail,
      subject,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in send-order-status-email:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
