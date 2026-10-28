// KC 28 Oct: the demo receipts have no photo, so the server draws each one as a paper nota (SVG) from the receipt's own data: the shop, the date,
// the order number, every line, what the lines miss (shipping) and the total. The picture always matches the numbers on screen. Demo content only:
// a small "DEMO" mark sits at the bottom.
import type { Receipt } from '@cp/shared';

const W = 360;
const PAD = 22;
const MONO = "'Courier New', Courier, monospace";
const INK = '#2B2620';
const FADED = '#6F675E';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const money = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const dmy = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
/** Cut a long text to the width of the nota (monospace: about 7.2 px a letter at 12 px). */
const fit = (s: string, max: number) => (s.length > max ? s.slice(0, max - 1) + '…' : s);

export function notaSvg(r: Receipt): string {
  const lines = r.lines ?? [];
  const sum = lines.reduce((a, l) => a + l.amount, 0);
  const rest = lines.length ? r.amount - sum : 0;
  const out: string[] = [];
  let y = PAD + 18;
  const text = (x: number, s: string, o: { size?: number; weight?: number; anchor?: 'start' | 'middle' | 'end'; fill?: string } = {}) =>
    out.push(`<text x="${x}" y="${y}" font-family="${MONO}" font-size="${o.size ?? 12}" font-weight="${o.weight ?? 400}" text-anchor="${o.anchor ?? 'start'}" fill="${o.fill ?? INK}">${esc(s)}</text>`);
  const rule = () => { out.push(`<line x1="${PAD}" y1="${y}" x2="${W - PAD}" y2="${y}" stroke="${FADED}" stroke-width="1" stroke-dasharray="4 3"/>`); };

  text(W / 2, fit(r.supplier.toUpperCase(), 34), { size: 14, weight: 700, anchor: 'middle' }); y += 18;
  text(W / 2, r.source === 'tokopedia' ? 'Tokopedia · Invoice' : 'Nota pembelian', { anchor: 'middle', fill: FADED }); y += 22;
  text(PAD, `Tanggal : ${dmy(r.date)}`); y += 16;
  if (r.orderNo) { text(PAD, fit(`No.     : ${r.orderNo}`, 42)); y += 16; }
  y += 4; rule(); y += 20;
  if (lines.length) {
    for (const l of lines) {
      text(PAD, fit(l.brand ? `${l.name} ${l.brand}` : l.name, 42)); y += 16;
      text(PAD + 12, `${l.qty} ${l.unit} x ${money(l.unitPrice)}`, { fill: FADED });
      text(W - PAD, money(l.amount), { anchor: 'end' }); y += 20;
    }
  } else {
    // a receipt saved as a total only: the nota shows the one amount
    text(PAD, 'Belanja'); text(W - PAD, money(r.amount), { anchor: 'end' }); y += 20;
  }
  y -= 4; rule(); y += 20;
  if (rest > 0) {
    text(PAD, 'Subtotal'); text(W - PAD, money(sum), { anchor: 'end' }); y += 16;
    text(PAD, r.source === 'tokopedia' ? 'Ongkos kirim' : 'Biaya lain'); text(W - PAD, money(rest), { anchor: 'end' }); y += 20;
  }
  text(PAD, 'TOTAL', { size: 14, weight: 700 }); text(W - PAD, `Rp ${money(r.amount)}`, { size: 14, weight: 700, anchor: 'end' }); y += 30;
  text(W / 2, 'Terima kasih', { anchor: 'middle', fill: FADED }); y += 18;
  text(W / 2, 'DEMO', { size: 9, anchor: 'middle', fill: '#B3A99E' }); y += PAD;

  // a slightly warm paper with a zigzag torn bottom edge
  const H = y + 8;
  const zig = Array.from({ length: Math.ceil(W / 12) + 1 }, (_, i) => `L${Math.max(0, W - i * 12)} ${i % 2 ? H : H - 6}`).join(' '); // right to left
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(`Nota ${r.supplier}, Rp ${money(r.amount)}`)}">`
    + `<path d="M0 0 L${W} 0 ${zig} Z" fill="#FBF8F2"/>`
    + out.join('') + '</svg>';
}
