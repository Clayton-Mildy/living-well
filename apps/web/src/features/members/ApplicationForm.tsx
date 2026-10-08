// The Membership Application Form, printed: the four brochure pages (/forms/application-1..4.jpg) as A4 backgrounds, with the member's answers typed
// onto their lines. Built from a plain ApplicationFormData, so it prints for a saved member (Documents tab) and for a new member who is still being
// typed (Add member, "Print the form to sign"). The word "Print" calls window.print(); the print CSS hides the app and gives one A4 sheet per page.
// Where each value goes is measured from the page images (1654 x 2339 px) and stored as a share of the page, so it scales to any size.
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { page1Values, signatureValues, type ApplicationFormData, type Page1Values } from '@cp/shared/rules/applicationForm';
import { Button, IconButton } from '../../components/ui';
import { useT } from '../../lib/i18n';

const W = 1654, H = 2339;
/** A blank line on the page: it runs from x0 to x1 (px of the 1654-wide image) and its bottom edge is at y. `rows` = lines of text it may take (a long answer wraps and shrinks). Values are in capitals, as the form asks (an email keeps its case). */
interface Box { x0: number; x1: number; y: number; rows?: 1 | 2; keep?: boolean; /** centre in a table cell: y is the middle of the cell */ mid?: boolean }
const ROW = 48; // px of image height one line of writing may use (the lines are 61px apart)
const DOWN = 4; // px: the writing's baseline sits on the labels' baseline, a little above its line

const PAGE1: Partial<Record<keyof Page1Values, Box>> = {
  name: { x0: 386, x1: 1070, y: 452 }, nickname: { x0: 1222, x1: 1539, y: 452 },
  dobAge: { x0: 473, x1: 941, y: 513 }, marital: { x0: 1232, x1: 1532, y: 513 },
  address1: { x0: 384, x1: 1538, y: 574 }, address2: { x0: 156, x1: 1544, y: 635 },
  rtRw: { x0: 274, x1: 590, y: 696 }, city: { x0: 678, x1: 1128, y: 696 }, postcode: { x0: 1276, x1: 1542, y: 696 },
  phone: { x0: 292, x1: 726, y: 757 }, mobile: { x0: 854, x1: 1540, y: 757 },
  email: { x0: 259, x1: 1547, y: 819, keep: true },
  registrationFee: { x0: 687, x1: 1539, y: 879 }, monthlyFee: { x0: 346, x1: 1550, y: 940 },
  conditions: { x0: 452, x1: 1539, y: 1001, rows: 2 }, dementia: { x0: 888, x1: 1540, y: 1062, rows: 2 },
  q1: { x0: 883, x1: 1552, y: 1123 }, q2: { x0: 1099, x1: 1551, y: 1185 }, q3: { x0: 1182, x1: 1550, y: 1246 },
  carer: { x0: 1200, x1: 1550, y: 1307 }, carerName: { x0: 750, x1: 1552, y: 1368 },
  allergy: { x0: 1265, x1: 1549, y: 1429 }, allergyList: { x0: 518, x1: 1538, y: 1491, rows: 2 },
  kin: { x0: 621, x1: 1541, y: 1552 }, kinRelation: { x0: 327, x1: 1547, y: 1613 },
  kinHome: { x0: 439, x1: 722, y: 1674 }, kinPhone: { x0: 965, x1: 1550, y: 1674 },
};
/** The ✓ next to "(berikan tanda)": the centre of the tick, on the line of each identity row. */
const TICKS: { key: 'idGuarantor' | 'idMember' | 'idCarer'; x: number; y: number }[] = [
  { key: 'idGuarantor', x: 1272, y: 1747 }, { key: 'idMember', x: 1268, y: 1808 }, { key: 'idCarer', x: 1272, y: 1868 },
];
/** The signature tables hold NAMA and TANGGAL; TANDATANGAN stays empty for the pen. */
const TABLE_NAME = { x0: 170, x1: 692 }, TABLE_DATE = { x0: 718, x1: 1068 };
const TABLE_P1_Y = 2140, TABLE_P3_Y = 1745;
const P4 = { saya: { x0: 242, x1: 1295, y: 427 } as Box, date: { x0: 322, x1: 900, y: 1771 } as Box, name: { x0: 272, x1: 900, y: 1891 } as Box };

/** One line of the printed form is about 1.6% of the page wide per character on average; a long answer shrinks, or wraps to two lines, to stay on its line. */
const BASE = 1.6; // cqw
const CHAR = 0.66; // average width of a capital letter, in em
function sizeFor(text: string, box: Box): { scale: number; wrap: boolean } {
  const width = (box.x1 - box.x0 - 14) / W * 100; // cqw
  const px = (s: number) => text.length * CHAR * BASE * s; // cqw one line of text takes at scale s
  if (px(1) <= width) return { scale: 1, wrap: false };
  if (box.rows === 2) {
    const s2 = 0.8;
    if (px(s2) <= width * 1.9) return { scale: s2, wrap: true };
    return { scale: Math.max(0.55, (width * 1.9) / (text.length * CHAR * BASE)), wrap: true };
  }
  return { scale: Math.max(0.5, width / (text.length * CHAR * BASE)), wrap: false };
}
const pct = (n: number, of: number) => `${(n / of) * 100}%`;

function Value({ k, box, text }: { k: string; box: Box; text: string }) {
  if (!text) return null;
  const rows = box.rows || 1;
  const hgt = ROW * rows;
  const { scale, wrap } = sizeFor(text, box);
  const top = box.mid ? box.y - hgt / 2 : box.y - hgt + DOWN;
  const style: CSSProperties = {
    left: pct(box.x0, W), width: pct(box.x1 - box.x0, W), top: pct(top, H), height: pct(hgt, H),
    fontSize: `calc(${BASE}cqw * ${scale.toFixed(3)})`, whiteSpace: wrap ? 'normal' : 'nowrap', alignItems: box.mid ? 'center' : 'flex-end',
    textTransform: box.keep ? 'none' : 'uppercase', justifyContent: box.mid ? 'center' : 'flex-start', textAlign: box.mid ? 'center' : 'left',
  };
  return <div className="cp-fv" data-field={k} data-fit={scale.toFixed(2)} style={style}><span>{text}</span></div>;
}
function Tick({ k, x, y }: { k: string; x: number; y: number }) {
  const size = 40;
  return (
    <div className="cp-fv cp-tick" data-field={k} role="img" aria-label="✓" style={{ left: pct(x - size / 2, W), top: pct(y - size - 1, H), width: pct(size, W), height: pct(size, H) }}>
      <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true"><path d="M3.5 12.8l5.2 5.4L20.5 5.8" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </div>
  );
}

function Sheet({ n, label, children }: { n: number; label: string; children?: React.ReactNode }) {
  return (
    <section className="cp-print-sheet" data-testid="form-page" data-page={n} aria-label={label}>
      <img className="cp-print-bg" src={`/forms/application-${n}.jpg`} alt="" draggable={false} />
      {children}
    </section>
  );
}

const CSS = `
@page { size: A4; margin: 0; }
.cp-print-root { position: fixed; inset: 0; z-index: 90; outline: none; background: #E9E4DC; display: flex; flex-direction: column; overflow: hidden; }
.cp-print-bar { flex: none; display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: #FFFFFF; border-bottom: 1px solid #EFE7DC; }
.cp-print-bar h2 { margin: 0; flex: 1; min-width: 0; font-size: 17px; font-weight: 500; color: #2B231C; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cp-print-scroll { flex: 1; min-height: 0; overflow: auto; padding: 14px 10px 40px; display: flex; flex-direction: column; align-items: center; gap: 14px; }
.cp-print-sheet { position: relative; flex: none; width: min(100%, 860px); aspect-ratio: 210 / 297; background: #FFFFFF; container-type: inline-size; box-shadow: 0 2px 14px rgba(40,30,20,0.18); overflow: hidden; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.cp-print-bg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; user-select: none; }
.cp-fv { position: absolute; display: flex; box-sizing: border-box; padding: 0 0.4cqw; overflow: hidden; font-family: Inter, 'Helvetica Neue', Arial, sans-serif; font-weight: 500; letter-spacing: 0.01em; color: #101827; line-height: 1.1; }
.cp-fv > span { min-width: 0; overflow-wrap: anywhere; }
.cp-tick { padding: 0; color: #101827; }
@media print {
  html { zoom: 1 !important; }
  html, body { height: auto !important; overflow: visible !important; background: #FFFFFF !important; }
  body > *:not(.cp-print-root) { display: none !important; }
  .cp-print-root { position: static !important; display: block !important; overflow: visible !important; background: #FFFFFF !important; }
  .cp-print-bar { display: none !important; }
  .cp-print-scroll { display: block !important; overflow: visible !important; padding: 0 !important; }
  .cp-print-sheet { width: 210mm !important; height: 296.6mm !important; aspect-ratio: auto !important; margin: 0 !important; box-shadow: none !important; break-after: page; page-break-after: always; }
  .cp-print-sheet:last-child { break-after: auto; page-break-after: auto; }
}
`;

/** The four pages with a bar to print or close. Rendered in a portal on the body so the print CSS can hide everything else. */
export function ApplicationForm({ data, onClose }: { data: ApplicationFormData; onClose: () => void }) {
  const t = useT();
  const v = page1Values(data);
  const sig = signatureValues(data);
  const root = useRef<HTMLDivElement>(null);
  const prev = useRef<Element | null>(null);
  useEffect(() => {
    prev.current = document.activeElement;
    root.current?.focus({ preventScroll: true });
    // Escape closes this view only (capture phase, so a dialog underneath does not also close)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); onClose(); } };
    window.addEventListener('keydown', onKey, true);
    return () => { window.removeEventListener('keydown', onKey, true); (prev.current as HTMLElement | null)?.focus?.({ preventScroll: true }); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const page = (n: number) => t('form.pageN', { n });
  return createPortal(
    <div ref={root} tabIndex={-1} className="cp-print-root" role="dialog" aria-modal="true" aria-label={t('form.title')} data-testid="application-form">
      <style>{CSS}</style>
      <div className="cp-print-bar">
        <IconButton icon="arrow_back" label={t('common.close')} onClick={onClose} />
        <h2>{t('form.title')}</h2>
        <Button size={44} icon="print" onClick={() => window.print()}>{t('form.print')}</Button>
      </div>
      <div className="cp-print-scroll">
        <Sheet n={1} label={page(1)}>
          {(Object.keys(PAGE1) as (keyof Page1Values)[]).map((k) => <Value key={k} k={k} box={PAGE1[k]!} text={String(v[k] ?? '')} />)}
          {TICKS.map((x) => (v[x.key] ? <Tick key={x.key} k={x.key} x={x.x} y={x.y} /> : null))}
          <Value k="signer" box={{ ...TABLE_NAME, y: TABLE_P1_Y, mid: true, rows: 2 }} text={v.signer} />
          <Value k="date" box={{ ...TABLE_DATE, y: TABLE_P1_Y, mid: true }} text={v.date} />
        </Sheet>
        <Sheet n={2} label={page(2)} />
        <Sheet n={3} label={page(3)}>
          <Value k="signer" box={{ ...TABLE_NAME, y: TABLE_P3_Y, mid: true, rows: 2 }} text={sig.signer} />
          <Value k="date" box={{ ...TABLE_DATE, y: TABLE_P3_Y, mid: true }} text={sig.date} />
        </Sheet>
        <Sheet n={4} label={page(4)}>
          <Value k="saya" box={P4.saya} text={sig.signer} />
          <Value k="date" box={P4.date} text={sig.date} />
          <Value k="signer" box={P4.name} text={sig.signer} />
        </Sheet>
      </div>
    </div>,
    document.body,
  );
}

/** Open the form from a button: `open(data)` shows it, `node` goes once anywhere in the render. */
export function useApplicationForm() {
  const [data, setData] = useState<ApplicationFormData | null>(null);
  return { open: (d: ApplicationFormData) => setData(d), node: data ? <ApplicationForm data={data} onClose={() => setData(null)} /> : null };
}
