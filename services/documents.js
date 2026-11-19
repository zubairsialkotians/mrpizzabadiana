import { money, niceDate, currencySymbol, qtyLabel, STATUS_LABELS, paymentLabel } from './format';

/*
  Printable documents (bill, order sheet) as one plain "model".
  The same model is drawn twice:
    components/DocView.js  → on screen, and captured as the shared image
    docHtml() below        → the shared PDF (expo-print)
  so the image and the PDF always show the same thing.

  model = {
    title, stamp?,                       // stamp: big red word, e.g. CANCELLED
    company: { name, logo_url, support_phone, bill_caption },
    from: [lines],                       // branch name / address / phone
    meta: [[label, value]],              // bill no, date …
    party?: { heading, lines: [first line is bold] },
    summary?: [[label, value]],          // boxes under the header (order sheet)
    blocks: [{ heading?, sub?, columns: [{ label, w, align }], rows: [{ cells, bold? }], foot?: [label, value] }],
    totals?: [{ label, value, bold?, big?, tone? }],
    notes?: [text],
  }
  A cell is a string or { text, sub }.
*/

// Plain number for table cells (the currency is in the column header)
export const num = (v) => (Number(v) || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const companyOf = (shop = {}) => ({
  name: shop.name || '', logo_url: shop.logo_url || '', support_phone: shop.phone || '', bill_caption: shop.bill_caption || '',
});

// Customer bill / receipt for one order (no costs)
export function buildBill(o, shop) {
  const cur = currencySymbol();
  const cancelled = o.status === 'cancelled';
  const rows = o.items.map((it, i) => ({
    cells: [String(i + 1), { text: it.name, sub: it.returned_qty > 0 ? `returned ${qtyLabel(it.returned_qty, it.unit)}` : '' },
      qtyLabel(it.qty, it.unit), num(it.price), num(it.line_total)],
  }));
  const totals = [
    { label: 'Items', value: money(o.subtotal) },
    { label: o.fulfilment === 'pickup' ? 'Pickup' : 'Delivery', value: o.delivery_fee ? money(o.delivery_fee) : 'Free' },
    { label: 'Total', value: money(o.total), bold: true, big: true },
  ];
  if (o.refunded > 0) {
    totals.push({ label: 'Refunded (returns)', value: `-${money(o.refunded)}`, tone: 'bad', divider: true });
    totals.push({ label: 'Net paid', value: money(o.total - o.refunded), bold: true });
  }
  return {
    title: 'BILL',
    stamp: cancelled ? 'CANCELLED' : '',
    company: companyOf(shop),
    from: [o.branch_name, o.branch_address, o.branch_phone ? `Ph: ${o.branch_phone}` : ''].filter(Boolean),
    meta: [
      ['Order', o.order_no],
      ['Date', niceDate(o.created_at)],
      ['Status', STATUS_LABELS[o.status] || o.status],
      ['Payment', paymentLabel(o) + (o.payment_status === 'verified' ? ' (paid)' : '')],
    ],
    party: {
      heading: o.fulfilment === 'pickup' ? 'Customer (pickup)' : 'Deliver to',
      lines: [o.name, o.fulfilment === 'pickup' ? '' : o.address, `Ph: ${o.phone}`].filter(Boolean),
    },
    blocks: [{
      columns: [
        { label: '#', w: 0.5 }, { label: 'Item', w: 3.2 }, { label: 'Qty', w: 1.4, align: 'right' },
        { label: 'Rate', w: 1.3, align: 'right' }, { label: `Amount (${cur})`, w: 1.7, align: 'right' },
      ],
      rows,
    }],
    totals,
    notes: [o.note ? `Note: ${o.note}` : '', cancelled && o.cancel_reason ? `Cancelled: ${o.cancel_reason}` : ''].filter(Boolean),
  };
}

/* ---------------- HTML (PDF) ---------------- */

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cellHtml = (c) => (typeof c === 'object' && c
  ? `${esc(c.text)}${c.sub ? `<div class="sub">${esc(c.sub)}</div>` : ''}`
  : esc(c));

// logoSrc: a data: URI (so the PDF never waits on the network) or the URL
export function docHtml(m, logoSrc) {
  const c = m.company;
  const toneCls = (t) => (t === 'good' ? 'good' : t === 'bad' ? 'bad' : '');
  const blocks = m.blocks.map((b) => {
    const total = b.columns.reduce((a, col) => a + col.w, 0);
    const cols = b.columns.map((col) => `<col style="width:${((col.w / total) * 100).toFixed(2)}%">`).join('');
    const head = b.columns.map((col) => `<th class="${col.align === 'right' ? 'r' : ''}">${esc(col.label)}</th>`).join('');
    const rows = b.rows.map((r) => `<tr class="${r.bold ? 'b' : ''}">${r.cells.map((cell, i) =>
      `<td class="${b.columns[i]?.align === 'right' ? 'r' : ''}">${cellHtml(cell)}</td>`).join('')}</tr>`).join('');
    const foot = b.foot ? `<tr class="foot"><td colspan="${b.columns.length - 1}">${esc(b.foot[0])}</td><td class="r">${esc(b.foot[1])}</td></tr>` : '';
    return `<div class="block">${b.heading ? `<div class="bh">${esc(b.heading)}</div>` : ''}${b.sub ? `<div class="bs">${esc(b.sub)}</div>` : ''}
      <table class="grid"><colgroup>${cols}</colgroup><thead><tr>${head}</tr></thead><tbody>${rows}${foot}</tbody></table></div>`;
  }).join('');

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(m.title)}</title>
<style>
  @page { margin: 28px; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Roboto, "Segoe UI", Arial, sans-serif; color: #111827; font-size: 12px; margin: 0; }
  .top { display: flex; justify-content: space-between; gap: 16px; border-bottom: 2px solid #1d4ed8; padding-bottom: 12px; }
  .co { display: flex; gap: 12px; align-items: center; min-width: 0; flex: 1; }
  .right { flex-shrink: 0; }
  .co img { width: 64px; height: 64px; object-fit: contain; }
  .name { font-size: 20px; font-weight: 800; color: #0b1020; }
  .muted { color: #64748b; }
  .title { font-size: 22px; font-weight: 800; color: #1d4ed8; text-align: right; letter-spacing: 1px; }
  .meta { margin-top: 4px; border-collapse: collapse; margin-left: auto; }
  .meta td { padding: 1px 0 1px 10px; text-align: right; white-space: nowrap; border: none; }
  .meta td:first-child { color: #64748b; }
  .stamp { color: #c0392b; border: 2px solid #c0392b; display: inline-block; padding: 2px 10px; font-weight: 800; margin-top: 6px; letter-spacing: 2px; }
  .party { margin: 12px 0; }
  .party .h { font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 700; letter-spacing: .5px; }
  .party .l1 { font-size: 15px; font-weight: 800; }
  .summary { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0; }
  .summary div { border: 1px solid #e2e7f0; border-radius: 6px; padding: 6px 10px; }
  .summary b { display: block; font-size: 14px; }
  .summary span { font-size: 10px; color: #64748b; }
  .block { margin-top: 12px; page-break-inside: avoid; }
  .bh { font-weight: 800; font-size: 13px; }
  .bs { color: #64748b; font-size: 11px; margin-bottom: 4px; }
  table.grid { width: 100%; border-collapse: collapse; table-layout: fixed; }
  .grid th { background: #e8eefc; color: #1e3a8a; font-size: 11px; text-align: left; padding: 6px; }
  .grid td { padding: 6px; border-bottom: 1px solid #e2e7f0; vertical-align: top; word-wrap: break-word; }
  .grid .r { text-align: right; }
  .sub { color: #64748b; font-size: 10px; }
  .grid tr.foot td { font-weight: 800; border-bottom: none; background: #f3f5f9; }
  .totals { margin: 12px 0 0 auto; width: 60%; border-collapse: collapse; }
  .totals td { border: none; padding: 3px 6px; }
  .totals td:last-child { text-align: right; white-space: nowrap; }
  .totals tr.b td { font-weight: 800; }
  .totals tr.big td { font-size: 15px; border-top: 1px solid #111827; padding-top: 6px; }
  .totals tr.div td { border-top: 1px dashed #94a3b8; padding-top: 6px; }
  .good { color: #15803d; } .bad { color: #c0392b; }
  .notes { margin-top: 12px; color: #64748b; font-size: 11px; }
  .pfoot { margin-top: 18px; text-align: center; border-top: 1px solid #e2e7f0; padding-top: 10px; }
  .caption { font-style: italic; white-space: pre-line; }
</style></head><body>
<div class="top">
  <div class="co">${logoSrc ? `<img src="${esc(logoSrc)}">` : ''}<div>
    <div class="name">${esc(c.name)}</div>
    ${m.from.map((l) => `<div class="muted">${esc(l)}</div>`).join('')}
  </div></div>
  <div class="right">
    <div class="title">${esc(m.title)}</div>
    <table class="meta">${m.meta.map(([k, v]) => `<tr><td>${esc(k)}</td><td><b>${esc(v)}</b></td></tr>`).join('')}</table>
    ${m.stamp ? `<div style="text-align:right"><span class="stamp">${esc(m.stamp)}</span></div>` : ''}
  </div>
</div>
${m.party ? `<div class="party"><div class="h">${esc(m.party.heading)}</div>${m.party.lines.map((l, i) =>
    `<div class="${i ? 'muted' : 'l1'}">${esc(l)}</div>`).join('')}</div>` : ''}
${m.summary ? `<div class="summary">${m.summary.map(([k, v]) => `<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}</div>` : ''}
${blocks}
${m.totals ? `<table class="totals">${m.totals.map((t) =>
    `<tr class="${[t.bold && 'b', t.big && 'big', t.divider && 'div'].filter(Boolean).join(' ')}"><td>${esc(t.label)}</td><td class="${toneCls(t.tone)}">${esc(t.value)}</td></tr>`).join('')}</table>` : ''}
${m.notes?.length ? `<div class="notes">${m.notes.map((n) => `<div>${esc(n)}</div>`).join('')}</div>` : ''}
${c.bill_caption || c.support_phone ? `<div class="pfoot">
  ${c.bill_caption ? `<div class="caption">${esc(c.bill_caption)}</div>` : ''}
  ${c.support_phone ? `<div class="muted">For support call: <b>${esc(c.support_phone)}</b></div>` : ''}
</div>` : ''}
</body></html>`;
}
