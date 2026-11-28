import { Linking, Platform } from 'react-native';
import * as Print from 'expo-print';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { buildBill, docHtml, DEVELOPER_LINE } from './documents';
import { logoDataUri } from './share';
import { qrSvg } from './qr';
import { money, niceDate, qtyLabel } from './format';

/*
  Printing bills (MasterPOS). Each phone / tablet picks its own printer (My account → Printer on this device):
    system — the phone's print dialog: Wi-Fi / network printers, any printer with an Android print service
             (Mopria, HP, Epson, RawBT…), or "Save as PDF". Prints the bill sized for the chosen paper.
    rawbt  — Bluetooth / USB thermal receipt printers (58 / 80 mm, ESC/POS) through the free RawBT app:
             prints straight away, no dialog. RawBT must be installed and paired with the printer once.
  The shop decides when bills print (Shop settings → Bill printing): right after a staff order is placed,
  or only with the Print bill button (always shown on the order).
*/

const KEY = 'printer_config';
// 'a4': the full bill (same as the Bill screen / Share PDF); 58 / 80: receipt rolls
export const PAPERS = ['a4', 80, 58];
export const paperLabel = (p) => (p === 'a4' ? 'Full page (A4)' : `${p} mm roll`);
// Thermal printers can't print to the roll's edges: an 80 mm roll prints about 72 mm wide, a 58 mm roll about 48 mm.
// Drawing the bill wider than that cuts it on the right. Some printers print a bit wider: 'width' (mm) on the
// device's printer settings fine-tunes it (0 = the usual width for the roll).
export const PRINT_WIDTHS = { 80: [72, 76, 80], 58: [48, 52, 58] };
export const printWidth = (p) => {
  if (p.paper === 'a4') return null;
  const list = PRINT_WIDTHS[p.paper === 58 ? 58 : 80];
  return list.includes(Number(p.width)) ? Number(p.width) : list[0];
};
// Bluetooth (RawBT) prints text: characters per line. Most 80 mm printers fit 48 (some only 42), 58 mm ones 32.
export const PRINT_COLS = { 80: [48, 42], 58: [32, 30] };
export const printCols = (p) => {
  const list = PRINT_COLS[p.paper === 58 ? 58 : 80];
  return list.includes(Number(p.cols)) ? Number(p.cols) : list[0];
};
// device: MasterPOS Desktop only — the computer's printer that bills go to with no print window ('' = ask every time)
export const DEFAULT_PRINTER = { method: 'system', paper: 'a4', copies: 1, width: 0, cols: 0, device: '' };
// MasterPOS Desktop (Electron) gives the page its printers and silent printing (masterposdesktop/electron/preload.cjs)
export const desktopBridge = () => (typeof globalThis !== 'undefined' && globalThis.desktop?.isDesktop ? globalThis.desktop : null);
const RAWBT_STORE = 'https://play.google.com/store/apps/details?id=ru.a402d.rawbtprinter';

export async function getPrinter() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return { ...DEFAULT_PRINTER, ...(raw ? JSON.parse(raw) : {}) };
  } catch (_) {
    return { ...DEFAULT_PRINTER };
  }
}
export async function savePrinter(cfg) {
  const next = { ...DEFAULT_PRINTER, ...cfg };
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

// Print this order's bill on this device's printer
export async function printBill(order, shop, cfg) {
  const p = cfg || await getPrinter();
  const copies = Math.min(3, Math.max(1, Number(p.copies) || 1));
  if (Platform.OS === 'web') { await printOnWeb(order, shop, p.paper, printWidth(p), copies, p.device); return; }
  if (p.method === 'rawbt' && Platform.OS === 'android') {
    const text = receiptText(order, shop, printCols(p)); // thermal rolls only (A4 → 80 mm)
    const data = `rawbt:base64,${toBase64(escpos(text, copies))}`;
    try {
      await Linking.openURL(data);
    } catch (_) {
      const e = new Error('Install the RawBT app and pair your Bluetooth printer in it.');
      e.store = RAWBT_STORE;
      throw e;
    }
    return;
  }
  // Phone print dialog: the same bill as the Bill screen (a picture of it, like "Share image"),
  // in a PDF exactly the paper's width, so the printer gets the bill and not a screen / web page
  const pt = (x) => Math.round((x * 72) / 25.4);
  const pageW = p.paper === 'a4' ? 595 : pt(printWidth(p));
  const model = buildBill(order, shop);
  if (host) {
    // Rolls: draw it narrow like on a phone; A4: the full Bill screen width
    const shot = await host(model, p.paper === 'a4' ? 520 : p.paper === 58 ? 320 : 360);
    const margin = p.paper === 'a4' ? 24 : 2;
    const imgW = pageW - margin * 2;
    const pageH = Math.max(Math.ceil((imgW * shot.height) / shot.width) + margin * 2, p.paper === 'a4' ? 842 : 0);
    // Copies: the print screen doesn't take a number of copies from the app, so the PDF has one page per copy
    const page = `<div class="pg"><img src="data:image/png;base64,${shot.base64}"></div>`;
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>
      @page { margin: 0; } html, body { margin: 0; padding: 0; background: #fff; }
      .pg { height: ${pageH}pt; overflow: hidden; page-break-after: always; break-after: page; }
      .pg:last-child { page-break-after: auto; break-after: auto; }
      img { display: block; width: ${imgW}pt; margin: ${margin}pt; }
    </style></head><body>${page.repeat(copies)}</body></html>`;
    const { uri } = await Print.printToFileAsync({ html, width: pageW, height: pageH });
    await Print.printAsync({ uri });
    return;
  }
  // No picture possible (e.g. web): the bill as a document
  const { uri } = await Print.printToFileAsync({ html: repeatBody(docHtml(model, await logoDataUri(model.company.logo_url)), copies), width: 595, height: 842 });
  await Print.printAsync({ uri });
}

// The bill's page body N times, each copy starting on a new page
function repeatBody(html, copies) {
  if (copies < 2) return html;
  return html.replace(/<body([^>]*)>([\s\S]*)<\/body>/i, (all, attrs, body) => (
    `<body${attrs}>${Array(copies).fill(body).join('<div style="page-break-after: always; break-after: page;"></div>')}</body>`
  ));
}

// Set by components/PrintHost (mounted in App.js): (model, width) → { base64, width, height } picture of the bill
let host = null;
export function setPrintHost(fn) { host = fn; }

/*
  Website / PC: browsers never tell a page which printers exist, so we open the browser's print window
  with the bill; it lists the PC's printers (USB, network, Wi-Fi, Bluetooth set up in Windows / macOS)
  and "Save as PDF". Printed from a hidden frame, so pop-up blockers don't stop it.
*/
/*
  Computer printers (desktop app / browser): grey and coloured text comes out faint, above all on receipt printers.
  Everything prints pure black and bolder, lines black, no tinted backgrounds.
*/
const DARK_PRINT = `
  body, body * { color: #000 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: Arial, Tahoma, "Segoe UI", sans-serif; font-weight: 600; }
  b, .name, .title, .l1, .bh, .grid th, .totals tr.b td, .totals tr.big td, .stamp { font-weight: 800 !important; }
  .grid th { background: #fff !important; border-bottom: 2px solid #000; border-top: 2px solid #000; }
  .grid td { border-bottom: 1px solid #000 !important; }
  .grid tr.foot td { background: #fff !important; }
  .top { border-bottom: 2px solid #000 !important; }
  .totals tr.big td { border-top: 2px solid #000 !important; }
  .totals tr.div td, .pfoot { border-top: 1px dashed #000 !important; }
  .summary div { border-color: #000 !important; }
  .stamp { border-color: #000 !important; }
  .sub, .notes, .muted, .dev { font-weight: 600; }
`;

function printOnWeb(order, shop, paper, width, copies = 1, device = '') {
  const model = buildBill(order, shop);
  // The same bill as the Bill screen; on rolls the page is the printer's printable width
  const mm = width || 72;
  const page = (paper === 'a4'
    ? '@page { size: A4; margin: 12mm; }'
    // drawn 360 px wide (like on a phone), then scaled to the printable width
    : `@page { size: ${mm}mm auto; margin: 0 1mm; } body { width: 360px; zoom: ${(((mm - 2) * 96) / 25.4 / 360).toFixed(3)}; }`) + DARK_PRINT;
  const desk = desktopBridge();
  if (desk) {
    // Desktop app: straight to the chosen printer (no window), or its print window when none is chosen
    return desk.printHtml({
      html: docHtml(model, model.company.logo_url).replace('@page { margin: 28px; }', page),
      device: device || '', silent: !!device, copies, paperMm: paper === 'a4' ? 0 : Number(paper) || 80,
    }).then((r) => { if (r && r.ok === false) throw new Error(r.error || 'The printer did not print'); });
  }
  return new Promise((resolve, reject) => {
    const doc = globalThis.document;
    if (!doc) { reject(new Error('Printing is not available here')); return; }
    const html = repeatBody(docHtml(model, model.company.logo_url).replace('@page { margin: 28px; }', page), copies);
    const frame = doc.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0', visibility: 'hidden' });
    doc.body.appendChild(frame);
    const w = frame.contentWindow;
    const fd = w.document;
    fd.open();
    fd.write(html);
    fd.close();
    let done = false;
    const cleanup = () => setTimeout(() => frame.remove(), 1000);
    const go = () => {
      if (done) return;
      done = true;
      try {
        w.focus();
        w.onafterprint = cleanup;
        w.print(); // the browser's print window: pick the printer, copies, paper
        resolve();
      } catch (e) {
        cleanup();
        reject(new Error('The browser could not open printing'));
      }
      setTimeout(() => frame.remove(), 60000);
    };
    // Wait for the logo (or give up after 3 s)
    const imgs = Array.from(fd.images || []);
    if (imgs.every((i) => i.complete)) setTimeout(go, 150);
    else {
      imgs.forEach((i) => { i.onload = i.onerror = () => imgs.every((x) => x.complete) && go(); });
      setTimeout(go, 3000);
    }
  });
}

export const openRawbtStore = () => Linking.openURL(RAWBT_STORE).catch(() => {});

/* ---------------- Receipt: plain text for thermal printers ---------------- */

const clean = (v) => String(v ?? '').replace(/[\r\n]+/g, ' ').trim();
const pad = (l, r, w) => {
  const left = clean(l);
  const right = clean(r);
  const space = w - left.length - right.length;
  if (space >= 1) return left + ' '.repeat(space) + right;
  return `${left.slice(0, Math.max(0, w - right.length - 1))} ${right}`;
};
const center = (t, w) => {
  const s = clean(t).slice(0, w);
  return ' '.repeat(Math.floor((w - s.length) / 2)) + s;
};
const wrap = (t, w) => {
  const words = clean(t).split(/\s+/);
  const out = [];
  let line = '';
  words.forEach((word) => {
    if (!line) line = word;
    else if ((`${line} ${word}`).length <= w) line += ` ${word}`;
    else { out.push(line); line = word; }
  });
  if (line) out.push(line);
  return out.flatMap((l) => (l.length > w ? l.match(new RegExp(`.{1,${w}}`, 'g')) : [l]));
};

// Same contents as the on-screen bill (buildBill), laid out for 32 / 48 characters a line
export function receiptText(o, shop, w = 48) {
  const m = buildBill(o, shop);
  const rule = '-'.repeat(w);
  const L = [];
  L.push({ t: center(m.company.name, w), big: true });
  m.from.forEach((x) => wrap(x, w).forEach((y) => L.push({ t: center(y, w) })));
  if (m.stamp) L.push({ t: center(`*** ${m.stamp} ***`, w), bold: true });
  L.push({ t: rule });
  if (o.is_return) {
    // Walk-in return slip
    L.push({ t: center('*** RETURN ***', w), bold: true });
    m.meta.forEach(([k, v]) => L.push({ t: pad(k, v, w), bold: k === 'Return' }));
  } else {
    L.push({ t: pad('Bill', o.order_no, w), bold: true });
    L.push({ t: pad('Date', niceDate(o.created_at), w) });
    L.push({ t: pad(o.fulfilment === 'pickup' ? 'Takeaway' : 'Delivery', o.name, w) });
    if (o.phone) L.push({ t: pad('Phone', o.phone, w) });
    if (o.fulfilment !== 'pickup' && o.address) wrap(`Address: ${o.address}`, w).forEach((y) => L.push({ t: y }));
  }
  L.push({ t: rule });
  o.items.forEach((it) => {
    wrap(it.size && !String(it.name).includes(`(${it.size})`) ? `${it.name} (${it.size})` : it.name, w).forEach((y) => L.push({ t: y }));
    const list = Number(it.list_price) || 0;
    const off = list > Number(it.price) + 0.001 ? (list - it.price) * it.qty : 0;
    L.push({ t: pad(`  ${qtyLabel(it.qty, it.unit)} x ${money(off ? list : it.price)}${o.is_return && !it.restock ? ' (damaged)' : ''}`, money(off ? list * it.qty : it.line_total), w) });
    // Item discount on its own line under the item
    if (off) L.push({ t: pad('  Discount', `-${money(off)}`, w) });
  });
  L.push({ t: rule });
  m.totals.forEach((x) => L.push({ t: pad(x.label, x.value, w), bold: !!x.bold }));
  L.push({ t: rule });
  m.notes.forEach((n) => wrap(n, w).forEach((y) => L.push({ t: y })));
  if (m.company.bill_caption) wrap(m.company.bill_caption, w).forEach((y) => L.push({ t: center(y, w) }));
  if (m.qr) {
    L.push({ qr: m.qr.url });
    L.push({ t: center(m.qr.label, w), bold: true });
  }
  L.push({ t: center('Thank you!', w) });
  wrap(DEVELOPER_LINE, w).forEach((y) => L.push({ t: center(y, w) }));
  return L;
}

function utf8(str) {
  const out = [];
  for (const ch of str) {
    let c = ch.codePointAt(0);
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else { out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63)); }
  }
  return out;
}

// ESC/POS QR code (model 2, size 6, error level M), centred
function qrBytes(url) {
  const data = utf8(String(url));
  const len = data.length + 3;
  return [
    0x1b, 0x61, 1, // centre
    0x1d, 0x28, 0x6b, 4, 0, 0x31, 0x41, 0x32, 0, // model 2
    0x1d, 0x28, 0x6b, 3, 0, 0x31, 0x43, 6, // module size
    0x1d, 0x28, 0x6b, 3, 0, 0x31, 0x45, 0x31, // error level M
    0x1d, 0x28, 0x6b, len & 0xff, (len >> 8) & 0xff, 0x31, 0x50, 0x30, ...data, // store
    0x1d, 0x28, 0x6b, 3, 0, 0x31, 0x51, 0x30, // print
    0x0a, 0x1b, 0x61, 0, // back to left
  ];
}

// ESC/POS bytes: init, lines (bold / double size), feed and cut
function escpos(lines, copies = 1) {
  const bytes = [];
  const push = (...b) => bytes.push(...b);
  const text = (s) => {
    for (const ch of s) {
      const c = ch.charCodeAt(0);
      push(c < 128 ? c : 63); // thermal fonts are ASCII: other letters print as ?
    }
  };
  for (let n = 0; n < copies; n += 1) {
    push(0x1b, 0x40); // init
    lines.forEach((l) => {
      if (l.qr) { qrBytes(l.qr).forEach((b) => push(b)); return; }
      if (l.big) push(0x1d, 0x21, 0x11); // double width + height
      if (l.bold) push(0x1b, 0x45, 1);
      text(l.big ? l.t.trim() : l.t);
      if (l.bold) push(0x1b, 0x45, 0);
      if (l.big) push(0x1d, 0x21, 0x00);
      push(0x0a);
    });
    push(0x1b, 0x64, 4); // feed 4 lines
    push(0x1d, 0x56, 0x42, 0x00); // cut (printers without a cutter ignore it)
  }
  return bytes;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function toBase64(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const [a, b = 0, c = 0] = [bytes[i], bytes[i + 1], bytes[i + 2]];
    const n = (a << 16) | (b << 8) | c;
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63]
      + (i + 1 < bytes.length ? B64[(n >> 6) & 63] : '=') + (i + 2 < bytes.length ? B64[n & 63] : '=');
  }
  return out;
}

/* ---------------- Receipt: HTML for the phone's print dialog ---------------- */

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function receiptHtml(o, shop, paper = 80, given = null) {
  const lines = given || receiptText(o, shop, paper === 58 ? 32 : 48);
  const body = lines.map((l) => (l.qr
    ? `<div class="qr">${qrSvg(l.qr, paper === 58 ? 110 : 130)}</div>`
    : `<div class="${l.big ? 'big' : ''} ${l.bold ? 'b' : ''}">${esc(l.big ? l.t.trim() : l.t) || '&nbsp;'}</div>`)).join('');
  return `<!doctype html><html><head><meta charset="utf-8">
<style>
  @page { margin: 0; }
  html, body { width: ${PRINT_WIDTHS[paper === 58 ? 58 : 80][0]}mm; }
  body { padding: 5mm 3mm 0; box-sizing: border-box; }
  body { margin: 0; font-family: 'Courier New', monospace; font-size: ${paper === 58 ? 9 : 10.5}pt; color: #000; }
  div { white-space: pre; line-height: 1.25; }
  .b { font-weight: bold; }
  .qr { white-space: normal; text-align: center; margin: 6px 0 2px; } .qr svg { display: inline-block; }
  .big { font-size: 1.6em; font-weight: bold; text-align: center; white-space: normal; margin-bottom: 2px; }
</style></head><body>${body}</body></html>`;
}
