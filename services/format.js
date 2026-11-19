// Money, quantities and date ranges shared by every screen

let currency = 'Rs';
export function setCurrency(c) { currency = c || 'Rs'; }
export function currencySymbol() { return currency; }

export function money(v) {
  const n = Number(v) || 0;
  const s = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return `${n < 0 ? '-' : ''}${currency} ${s}`;
}

export function qty(v) {
  const n = Number(v) || 0;
  return n.toLocaleString('en-US', { maximumFractionDigits: 3 });
}

const pad = (n) => String(n).padStart(2, '0');
export function ymd(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "2026-11-13 14:05:00" → "13 Nov 2026, 2:05 PM"; date-only strings drop the time
export function niceDate(s, withTime = true) {
  if (!s) return '';
  const [d, t] = String(s).split(' ');
  const [y, m, day] = d.split('-').map(Number);
  let out = `${day} ${MONTHS[(m || 1) - 1]} ${y}`;
  if (withTime && t) {
    const [h, min] = t.split(':').map(Number);
    out += `, ${((h + 11) % 12) + 1}:${pad(min)} ${h >= 12 ? 'PM' : 'AM'}`;
  }
  return out;
}

export function isYmd(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s || '') && !isNaN(new Date(s).getTime());
}

export const RANGE_PRESETS = ['today', 'yesterday', 'week', 'month', 'last_month', 'year', 'all'];

export const RANGE_LABELS = {
  today: 'Today', yesterday: 'Yesterday', week: 'Last 7 days', month: 'This month',
  last_month: 'Last month', year: 'This year', all: 'All time', custom: 'Custom',
};

// → { key, from, to } with from/to as YYYY-MM-DD ('' = open)
export function rangeFor(key, custom = {}) {
  const now = new Date();
  const today = ymd(now);
  const back = (days) => { const d = new Date(now); d.setDate(d.getDate() - days); return ymd(d); };
  switch (key) {
    case 'today': return { key, from: today, to: today };
    case 'yesterday': return { key, from: back(1), to: back(1) };
    case 'week': return { key, from: back(6), to: today };
    case 'month': return { key, from: ymd(new Date(now.getFullYear(), now.getMonth(), 1)), to: today };
    case 'last_month': return {
      key,
      from: ymd(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
      to: ymd(new Date(now.getFullYear(), now.getMonth(), 0)),
    };
    case 'year': return { key, from: `${now.getFullYear()}-01-01`, to: today };
    case 'custom': return { key, from: custom.from || '', to: custom.to || '' };
    default: return { key: 'all', from: '', to: '' };
  }
}

export function rangeLabel(r) {
  if (r.key !== 'custom') return RANGE_LABELS[r.key];
  if (r.from && r.to) return `${niceDate(r.from, false)} – ${niceDate(r.to, false)}`;
  return 'Custom';
}

export const ROLE_LABELS = { owner: 'Owner', branch: 'Branch admin', customer: 'Customer' };

// Weight/volume in friendly units: 0.25 kg → "250 g", 1.5 kg → "1.5 kg", 0.5 litre → "500 ml"
export function qtyLabel(q, unit) {
  const n = Number(q) || 0;
  if (unit === 'kg' && n < 1) return `${Math.round(n * 1000)} g`;
  if (unit === 'litre' && n < 1) return `${Math.round(n * 1000)} ml`;
  if (unit === 'g' && n >= 1000) return `${qty(n / 1000)} kg`;
  if (unit === 'ml' && n >= 1000) return `${qty(n / 1000)} litre`;
  if (unit === 'pcs') return `${qty(n)} ${n === 1 ? 'pc' : 'pcs'}`;
  return `${qty(n)} ${unit}`;
}

// "Rs 480 / kg"
export function perUnit(price, unit) {
  return `${money(price)} / ${unit === 'pcs' ? 'pc' : unit}`;
}

export const STATUS_LABELS = {
  pending: 'Pending', confirmed: 'Confirmed', out_for_delivery: 'Out for delivery', ready: 'Ready for pickup',
  delivered: 'Delivered', cancelled: 'Cancelled',
};

// How an order is paid, in one line (lists, totals, bills)
export const cashLabel = (fulfilment) => `Cash ${fulfilment === 'pickup' ? 'at pickup' : 'on delivery'}`;
export function paymentLabel(o) {
  return o.payment_method && o.payment_method !== 'cod' ? (o.payment_name || 'Online payment') : cashLabel(o.fulfilment);
}
