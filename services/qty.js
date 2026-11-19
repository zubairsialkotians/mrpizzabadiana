// Quantities and money math shared by product page, cart and checkout (mirrors the server)

// Half-up to cents, same as PHP sa_money
export function round2(v) {
  const n = Number(v) || 0;
  return (n < 0 ? -1 : 1) * Math.round(Math.abs(n) * 100 + 1e-6) / 100;
}

// Float noise off: 0.1 + 0.2 → 0.3
export function cleanQty(v) {
  return Math.round((Number(v) || 0) * 1000) / 1000;
}

export function stepOf(p) {
  return Number(p.qty_step) > 0 ? Number(p.qty_step) : 1;
}
export function minOf(p) {
  return Number(p.min_qty) > 0 ? Number(p.min_qty) : stepOf(p);
}

const EPS = 1e-6;
const same = (a, b) => Math.abs(a - b) < EPS;

// The amounts the owner ticked on the item form (e.g. 0.25, 0.5, 1 kg), smallest first
export function optionsOf(p) {
  return (p.qty_options || []).map(Number).filter((o) => o > 0).sort((a, b) => a - b);
}

// Same rule as the server: a ticked amount, the minimum, or a whole number of steps above the minimum
export function validQty(q, p) {
  if (q <= 0) return false;
  if (optionsOf(p).some((o) => same(o, q)) || same(q, minOf(p))) return true;
  if (q + EPS < minOf(p)) return false;
  const n = q / stepOf(p);
  return Math.abs(n - Math.round(n)) < EPS;
}

// − / + move to the next valid amount, so 250 g → 500 g → 1 kg → 2 kg with step 1 kg
export function nextQty(q, p) {
  const step = stepOf(p), min = minOf(p);
  let x = step * (Math.floor(q / step + EPS) + 1);
  if (x + EPS < min) x = step * Math.ceil(min / step - EPS);
  const cands = [x, ...optionsOf(p), min].filter((c) => c > q + EPS);
  return cleanQty(Math.min(...cands));
}
export function prevQty(q, p) {
  const step = stepOf(p), min = minOf(p);
  const x = step * (Math.ceil(q / step - EPS) - 1);
  const cands = [...optionsOf(p), min, ...(x > 0 && x + EPS >= min ? [x] : [])].filter((c) => c < q - EPS);
  return cands.length ? cleanQty(Math.max(...cands)) : 0;
}

// Delivery fee as the server computes it
export function deliveryFee(shop, subtotal, fulfilment = 'delivery') {
  if (!shop || fulfilment === 'pickup') return 0;
  const free = Number(shop.free_delivery_over) || 0;
  return free > 0 && subtotal >= free ? 0 : Number(shop.delivery_fee) || 0;
}
