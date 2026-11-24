import qrcode from 'qrcode-generator';

/*
  QR codes for the bill (Shop settings → QR code link). Plain JavaScript, so the same code draws it
  on screen (DocView), in the PDF / browser print (SVG) and on thermal printers (printer.js uses ESC/POS).
*/
qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];

// { size, rows: [[start, length] dark runs per row] } or null when the text can't be encoded
export function qrMatrix(text) {
  if (!text) return null;
  try {
    const q = qrcode(0, 'M');
    q.addData(String(text), 'Byte');
    q.make();
    const size = q.getModuleCount();
    const rows = [];
    for (let r = 0; r < size; r += 1) {
      const runs = [];
      let start = -1;
      for (let c = 0; c <= size; c += 1) {
        const dark = c < size && q.isDark(r, c);
        if (dark && start < 0) start = c;
        if (!dark && start >= 0) { runs.push([start, c - start]); start = -1; }
      }
      rows.push(runs);
    }
    return { size, rows };
  } catch (_) {
    return null; // too long for a QR code
  }
}

// Inline SVG (crisp at any print size); quiet zone of 2 modules
export function qrSvg(text, px = 120) {
  const m = qrMatrix(text);
  if (!m) return '';
  const n = m.size + 4;
  const d = m.rows.map((runs, r) => runs.map(([c, len]) => `M${c + 2} ${r + 2}h${len}v1h-${len}z`).join('')).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges"><rect width="${n}" height="${n}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}
