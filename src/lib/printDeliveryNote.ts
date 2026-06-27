// Opens a new window with a printable delivery note (albarán) and triggers print.
// Intentionally excludes prices — this document is for shipment packing only.

export interface DeliveryNoteLine {
  name: string;
  variant?: string | null;
  quantity: number;
}

export interface DeliveryNoteData {
  orderNumber: string;
  createdAt: string; // ISO
  customerName: string;
  shippingAddress?: {
    address_line1?: string | null;
    address_line2?: string | null;
    postal_code?: string | null;
    city?: string | null;
    province?: string | null;
    country?: string | null;
    phone?: string | null;
  } | null;
  deliveryMethod?: string | null;
  notes?: string | null;
  lines: DeliveryNoteLine[];
  labels: {
    title: string;
    order: string;
    date: string;
    recipient: string;
    shippingAddress: string;
    deliveryMethod: string;
    notes: string;
    item: string;
    variant: string;
    quantity: string;
    totalItems: string;
    signature: string;
    noPricesNotice: string;
  };
  siteName?: string;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export function printDeliveryNote(data: DeliveryNoteData) {
  const addr = data.shippingAddress;
  const addressHtml = addr
    ? [
        addr.address_line1,
        addr.address_line2,
        [addr.postal_code, addr.city].filter(Boolean).join(' '),
        [addr.province, addr.country].filter(Boolean).join(', '),
        addr.phone ? `Tel: ${addr.phone}` : null,
      ]
        .filter(Boolean)
        .map(l => escapeHtml(String(l)))
        .join('<br/>')
    : '—';

  const totalQty = data.lines.reduce((s, l) => s + (l.quantity || 0), 0);

  const rowsHtml = data.lines
    .map(
      (l, i) => `
      <tr>
        <td class="num">${i + 1}</td>
        <td>
          <div class="item-name">${escapeHtml(l.name)}</div>
          ${l.variant ? `<div class="item-variant">${escapeHtml(l.variant)}</div>` : ''}
        </td>
        <td class="qty">${l.quantity}</td>
      </tr>`,
    )
    .join('');

  const dateStr = new Date(data.createdAt).toLocaleString();
  const site = data.siteName ? escapeHtml(data.siteName) : '';

  const html = `<!doctype html>
<html lang="ca">
<head>
<meta charset="utf-8" />
<title>${data.labels.title} ${escapeHtml(data.orderNumber)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; color: #111; margin: 24px; }
  header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111; padding-bottom: 12px; margin-bottom: 18px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .muted { color: #555; font-size: 12px; }
  .site { font-weight: 700; font-size: 16px; }
  .meta { font-size: 12px; text-align: right; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 18px; }
  .box { border: 1px solid #ddd; border-radius: 6px; padding: 12px; }
  .box h3 { margin: 0 0 6px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; color: #555; }
  .box p { margin: 0; font-size: 13px; line-height: 1.45; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  thead th { text-align: left; background: #f4f4f4; padding: 8px; border-bottom: 1px solid #ccc; }
  tbody td { padding: 8px; border-bottom: 1px solid #eee; vertical-align: top; }
  .num { width: 36px; color: #888; }
  .qty { width: 80px; text-align: center; font-weight: 700; }
  .item-variant { font-size: 11px; color: #666; margin-top: 2px; }
  tfoot td { padding: 10px 8px; font-weight: 700; border-top: 2px solid #111; }
  .notice { margin-top: 8px; font-size: 11px; color: #777; font-style: italic; }
  .notes { margin-top: 18px; font-size: 12px; }
  .sign { margin-top: 40px; display: flex; justify-content: space-between; gap: 40px; font-size: 12px; color: #555; }
  .sign div { flex: 1; border-top: 1px solid #999; padding-top: 6px; text-align: center; }
  @media print {
    body { margin: 12mm; }
    .no-print { display: none; }
  }
  .toolbar { position: fixed; top: 8px; right: 8px; }
  .toolbar button { padding: 6px 12px; font-size: 12px; cursor: pointer; }
</style>
</head>
<body>
  <div class="toolbar no-print">
    <button onclick="window.print()">Imprimir</button>
  </div>
  <header>
    <div>
      ${site ? `<div class="site">${site}</div>` : ''}
      <h1>${data.labels.title}</h1>
      <div class="muted">${data.labels.order}: <strong>${escapeHtml(data.orderNumber)}</strong></div>
    </div>
    <div class="meta">
      <div>${data.labels.date}: ${escapeHtml(dateStr)}</div>
      ${data.deliveryMethod ? `<div>${data.labels.deliveryMethod}: ${escapeHtml(data.deliveryMethod)}</div>` : ''}
    </div>
  </header>

  <div class="grid">
    <div class="box">
      <h3>${data.labels.recipient}</h3>
      <p>${escapeHtml(data.customerName || '—')}</p>
    </div>
    <div class="box">
      <h3>${data.labels.shippingAddress}</h3>
      <p>${addressHtml}</p>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th class="num">#</th>
        <th>${data.labels.item}</th>
        <th class="qty">${data.labels.quantity}</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml || `<tr><td colspan="3" style="text-align:center;color:#888;padding:20px">—</td></tr>`}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="2" style="text-align:right">${data.labels.totalItems}</td>
        <td class="qty">${totalQty}</td>
      </tr>
    </tfoot>
  </table>
  <div class="notice">${data.labels.noPricesNotice}</div>

  ${data.notes ? `<div class="notes"><strong>${data.labels.notes}:</strong> ${escapeHtml(data.notes)}</div>` : ''}

  <div class="sign">
    <div>${data.labels.signature}</div>
    <div>${data.labels.signature}</div>
  </div>

  <script>
    window.addEventListener('load', () => { setTimeout(() => window.print(), 300); });
  </script>
</body>
</html>`;

  const w = window.open('', '_blank', 'width=900,height=1000');
  if (!w) return false;
  w.document.open();
  w.document.write(html);
  w.document.close();
  return true;
}
