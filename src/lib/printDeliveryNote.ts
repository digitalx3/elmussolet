// Opens a new window with a printable delivery note (albarán).
// Shows a preview first, with toolbar: Print / Download PDF / Close.
// Excludes prices — for shipment packing only.

export interface DeliveryNoteLine {
  name: string;
  variant?: string | null;
  quantity: number;
}

export interface DeliveryNoteCompany {
  name?: string | null;
  nif?: string | null;
  address?: string | null;
  email?: string | null;
  phone?: string | null;
  logoUrl?: string | null;
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
    print?: string;
    downloadPdf?: string;
    close?: string;
  };
  company?: DeliveryNoteCompany;
  /** @deprecated use company.name */
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
  const company: DeliveryNoteCompany = data.company || { name: data.siteName };
  const companyName = company.name ? escapeHtml(company.name) : (data.siteName ? escapeHtml(data.siteName) : '');
  const companyLines = [
    company.nif ? `NIF: ${company.nif}` : null,
    company.address || null,
    company.email || null,
    company.phone ? `Tel: ${company.phone}` : null,
  ]
    .filter(Boolean)
    .map(l => escapeHtml(String(l)))
    .join('<br/>');

  const labelPrint = escapeHtml(data.labels.print || 'Imprimir');
  const labelDownload = escapeHtml(data.labels.downloadPdf || 'Descarregar PDF');
  const labelClose = escapeHtml(data.labels.close || 'Tancar');

  const fileName = `albara-${data.orderNumber}.pdf`.replace(/[^a-z0-9.\-_]/gi, '_');

  const html = `<!doctype html>
<html lang="ca">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(data.labels.title)} ${escapeHtml(data.orderNumber)}</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
<style>
  * { box-sizing: border-box; }
  html, body { background: #eceff1; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; color: #111; margin: 0; padding: 80px 0 40px; }
  .sheet { background: #fff; width: 210mm; min-height: 297mm; margin: 0 auto; padding: 18mm 16mm; box-shadow: 0 2px 14px rgba(0,0,0,.12); }
  header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111; padding-bottom: 12px; margin-bottom: 18px; gap: 16px; }
  .brand { display: flex; gap: 14px; align-items: flex-start; }
  .brand img { max-height: 64px; max-width: 180px; object-fit: contain; }
  .company-name { font-weight: 700; font-size: 16px; }
  .company-info { font-size: 11px; color: #555; line-height: 1.45; margin-top: 4px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .muted { color: #555; font-size: 12px; }
  .meta { font-size: 12px; text-align: right; min-width: 180px; }
  .meta h1 { text-align: right; }
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
  .toolbar { position: fixed; top: 0; left: 0; right: 0; background: #1f2937; color: #fff; padding: 10px 16px; display: flex; gap: 8px; justify-content: flex-end; align-items: center; box-shadow: 0 2px 6px rgba(0,0,0,.2); z-index: 1000; }
  .toolbar .title { margin-right: auto; font-size: 13px; opacity: .9; }
  .toolbar button { padding: 8px 14px; font-size: 13px; cursor: pointer; border: 0; border-radius: 6px; background: #374151; color: #fff; }
  .toolbar button.primary { background: #2563eb; }
  .toolbar button.secondary { background: #4b5563; }
  .toolbar button:hover { filter: brightness(1.1); }
  @media print {
    html, body { background: #fff; }
    body { margin: 0; padding: 0; }
    .sheet { box-shadow: none; width: auto; min-height: auto; margin: 0; padding: 12mm; }
    .no-print { display: none !important; }
    @page { size: A4; margin: 0; }
  }
</style>
</head>
<body>
  <div class="toolbar no-print">
    <span class="title">${escapeHtml(data.labels.title)} — ${escapeHtml(data.orderNumber)}</span>
    <button class="primary" onclick="window.print()">🖨 ${labelPrint}</button>
    <button class="primary" id="dlpdf">⬇ ${labelDownload}</button>
    <button class="secondary" onclick="window.close()">✕ ${labelClose}</button>
  </div>

  <div class="sheet" id="sheet">
    <header>
      <div class="brand">
        ${company.logoUrl ? `<img src="${escapeHtml(company.logoUrl)}" alt="" crossorigin="anonymous" />` : ''}
        <div>
          ${companyName ? `<div class="company-name">${companyName}</div>` : ''}
          ${companyLines ? `<div class="company-info">${companyLines}</div>` : ''}
        </div>
      </div>
      <div class="meta">
        <h1>${escapeHtml(data.labels.title)}</h1>
        <div class="muted">${escapeHtml(data.labels.order)}: <strong>${escapeHtml(data.orderNumber)}</strong></div>
        <div>${escapeHtml(data.labels.date)}: ${escapeHtml(dateStr)}</div>
        ${data.deliveryMethod ? `<div>${escapeHtml(data.labels.deliveryMethod)}: ${escapeHtml(data.deliveryMethod)}</div>` : ''}
      </div>
    </header>

    <div class="grid">
      <div class="box">
        <h3>${escapeHtml(data.labels.recipient)}</h3>
        <p>${escapeHtml(data.customerName || '—')}</p>
      </div>
      <div class="box">
        <h3>${escapeHtml(data.labels.shippingAddress)}</h3>
        <p>${addressHtml}</p>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th class="num">#</th>
          <th>${escapeHtml(data.labels.item)}</th>
          <th class="qty">${escapeHtml(data.labels.quantity)}</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml || `<tr><td colspan="3" style="text-align:center;color:#888;padding:20px">—</td></tr>`}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="2" style="text-align:right">${escapeHtml(data.labels.totalItems)}</td>
          <td class="qty">${totalQty}</td>
        </tr>
      </tfoot>
    </table>
    <div class="notice">${escapeHtml(data.labels.noPricesNotice)}</div>

    ${data.notes ? `<div class="notes"><strong>${escapeHtml(data.labels.notes)}:</strong> ${escapeHtml(data.notes)}</div>` : ''}

    <div class="sign">
      <div>${escapeHtml(data.labels.signature)}</div>
      <div>${escapeHtml(data.labels.signature)}</div>
    </div>
  </div>

  <script>
    document.getElementById('dlpdf').addEventListener('click', function() {
      var el = document.getElementById('sheet');
      if (!window.html2pdf) { window.print(); return; }
      window.html2pdf().set({
        margin: 10,
        filename: ${JSON.stringify(fileName)},
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      }).from(el).save();
    });
  </script>
</body>
</html>`;

  const w = window.open('', '_blank', 'width=1000,height=1000');
  if (!w) return false;
  w.document.open();
  w.document.write(html);
  w.document.close();
  return true;
}
