import nodemailer from 'nodemailer';
import { supabaseAdmin, requireAuth, requireAdmin } from '../lib/auth.js';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

/**
 * POST /functions/send-order-status-email
 * Body: { orderId, statusCode, language? }
 * Sends a templated email to the order's customer.
 * Admin-only.
 */
export default [
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const { orderId, statusCode, language = 'ca' } = req.body || {};
    if (!orderId || !statusCode) {
      return res.status(400).json({ error: 'missing_params' });
    }

    const { data: order, error: orderErr } = await supabaseAdmin
      .from('orders')
      .select('id, order_number, customer_email, customer_name, total')
      .eq('id', orderId)
      .single();
    if (orderErr || !order) return res.status(404).json({ error: 'order_not_found' });

    const { data: tpl } = await supabaseAdmin
      .from('order_status_email_templates')
      .select('subject, body')
      .eq('status_code', statusCode)
      .eq('language', language)
      .single();

    const subject = (tpl?.subject || `Comanda ${order.order_number}`)
      .replaceAll('{{order_number}}', order.order_number)
      .replaceAll('{{customer_name}}', order.customer_name || '');
    const body = (tpl?.body || 'El teu pedido ha cambiado de estado.')
      .replaceAll('{{order_number}}', order.order_number)
      .replaceAll('{{customer_name}}', order.customer_name || '')
      .replaceAll('{{total}}', String(order.total));

    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: order.customer_email,
      subject,
      html: body,
    });

    res.json({ ok: true });
  },
];
