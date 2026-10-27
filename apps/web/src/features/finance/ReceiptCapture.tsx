// One receipt capture for every buyer (round 14 p2): the photo is uploaded and read, the supplier, source, order no., date, lines and total fill in,
// the buyer checks them and sends. Used by Finance > Receipts and by the section staff's Requests > Snap a receipt; the reader is simulated behind lib/ocr.
import { useEffect, useRef, useState } from 'react';
import { live, rp, sortBy, type ReceiptLine, type ReceiptSource, type SpendCategory } from '@cp/shared';
import { lineCategory, linesGap, linesTotal, lineProblem, supplierCategory, RECEIPT_SOURCES } from '@cp/shared/rules/purchasing';
import { activeSections, receiptOfRequest, sectionName } from '@cp/shared/rules/finance';
import { Button, CameraCapture, Chip, DateField, Icon, ImageOpen, Note, PhotoImg, Select, TextField, FONT_BODY, FONT_SMALL } from '../../components/ui';
import { useDevice } from '../../hooks/useDevice';
import { useAct } from '../../lib/act';
import { ApiError } from '../../lib/api';
import { useNow } from '../../lib/clock';
import { useFmt, useT } from '../../lib/i18n';
import { mediaUrl, uploadMedia } from '../../lib/media';
import { readReceipt } from '../../lib/ocr';
import { say } from '../../store/ui';
import { useClub } from '../../store/replica';
import { digits } from './lib';
import { HAIR, PillBtn, RpField, Segmented, fieldLabel } from './parts';

const PAPER = 'linear-gradient(160deg, #FBF8F4 0%, #EFE7DD 55%, #DCCFC0 100%)';
const noteName = (date: string) => `nota_${date.slice(8)}${date.slice(5, 7)}.jpg`;
/** Lines the buyer adds start with this; the reader's lines are l1…ln. */
const NEW = 'new';
let seq = 0;

// a compact grey field for the item rows (44px high, 16px text so a phone keeps its zoom)
const cell: React.CSSProperties = { height: 44, border: 'none', borderRadius: 10, background: 'var(--fill, #F4F4F5)', padding: '0 10px', fontSize: 16, fontFamily: 'Inter', color: '#24201C', minWidth: 0, width: '100%', boxSizing: 'border-box' };
const num: React.CSSProperties = { ...cell, textAlign: 'right', fontVariantNumeric: 'tabular-nums' };
const bare: React.CSSProperties = { border: 0, margin: 0, padding: 0, minWidth: 0 }; // a <fieldset> that only carries `disabled`

/**
 * The lines of a receipt, one compact two-line row each: name · brand / qty unit × unit price = amount, with a remove button, and "Add item".
 * A line the buyer adds takes the supplier's category (`lineCategory`); a line with a problem gets aria-invalid on the field at fault.
 */
export function LinesEditor({ lines, onChange, supplierCat, disabled }: { lines: ReceiptLine[]; onChange: (l: ReceiptLine[]) => void; supplierCat?: SpendCategory; disabled?: boolean }) {
  const t = useT();
  const patch = (id: string, p: Partial<ReceiptLine>) => onChange(lines.map((l) => {
    if (l.id !== id) return l;
    const n = { ...l, ...p };
    return { ...n, amount: n.qty * n.unitPrice };
  }));
  const add = () => onChange([...lines, { id: `${NEW}${++seq}`, name: '', qty: 1, unit: 'pcs', unitPrice: 0, amount: 0, category: lineCategory(undefined, supplierCat) }]);
  return (
    <fieldset disabled={disabled} style={{ ...bare, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 34 }}>
        <span style={fieldLabel}>{t('purchasing.items')}</span>
        <PillBtn icon="add" onClick={add} disabled={disabled}>{t('purchasing.addItem')}</PillBtn>
      </div>
      {lines.map((l) => {
        const bad = lineProblem(l);
        const inv = (k: 'name' | 'qty' | 'price') => (bad === k ? true : undefined);
        return (
          <div key={l.id} data-line={l.id} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 0', borderTop: HAIR }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input value={l.name} onChange={(e) => patch(l.id, { name: e.target.value })} aria-label={t('purchasing.item')} placeholder={t('purchasing.item')} aria-invalid={inv('name')} maxLength={120} className="cp-input cp-fill" style={{ ...cell, flex: '1 1 0', boxShadow: bad === 'name' ? 'inset 0 0 0 2px #9A3D24' : undefined }} />
              <input value={l.brand ?? ''} onChange={(e) => patch(l.id, { brand: e.target.value || undefined })} aria-label={t('purchasing.brand')} placeholder={t('purchasing.brand')} maxLength={60} className="cp-input cp-fill" style={{ ...cell, flex: '0 0 32%' }} />
              <button type="button" onClick={() => onChange(lines.filter((x) => x.id !== l.id))} aria-label={t('purchasing.remove', { name: l.name || t('purchasing.item') })} className="cp-press cp-fill"
                style={{ width: 44, height: 44, flex: 'none', borderRadius: 999, border: 'none', background: 'transparent', color: '#5E5852', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Icon name="close" size={20} /></button>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input value={l.qty ? String(l.qty) : ''} onChange={(e) => patch(l.id, { qty: digits(e.target.value) })} inputMode="numeric" aria-label={t('purchasing.qty')} placeholder={t('purchasing.qty')} aria-invalid={inv('qty')} className="cp-input cp-fill" style={{ ...num, flex: '0 0 52px', boxShadow: bad === 'qty' ? 'inset 0 0 0 2px #9A3D24' : undefined }} />
              <input value={l.unit} onChange={(e) => patch(l.id, { unit: e.target.value })} aria-label={t('purchasing.unit')} placeholder={t('purchasing.unit')} maxLength={20} className="cp-input cp-fill" style={{ ...cell, flex: '0 0 60px' }} />
              <span aria-hidden="true" style={{ color: '#5E5852', fontSize: FONT_BODY }}>×</span>
              <input value={l.unitPrice ? (l.unitPrice).toLocaleString('id-ID') : ''} onChange={(e) => patch(l.id, { unitPrice: digits(e.target.value) })} inputMode="numeric" aria-label={t('purchasing.unitPrice')} placeholder={t('purchasing.unitPrice')} aria-invalid={inv('price')} className="cp-input cp-fill" style={{ ...num, flex: '1 1 0', boxShadow: bad === 'price' ? 'inset 0 0 0 2px #9A3D24' : undefined }} />
              <span aria-label={t('purchasing.amount')} style={{ flex: 'none', minWidth: 76, textAlign: 'right', fontSize: FONT_BODY, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>= {rp(l.amount)}</span>
            </div>
          </div>
        );
      })}
    </fieldset>
  );
}

type Status = 'idle' | 'reading' | 'filled' | 'failed';

export function ReceiptCapture({ defaultSectionId, onDone, onCancel, sentText }: {
  defaultSectionId?: string; onDone: () => void; onCancel: () => void;
  /** the toast after Send; the Requests screen words it its own way (default: Finance's) */
  sentText?: (section: string) => string;
}) {
  const s = useClub();
  const t = useT();
  const act = useAct();
  const { lang } = useFmt();
  const { today } = useNow();
  const { isPhone } = useDevice();
  const sections = activeSections(s);
  const suppliers = sortBy(live(s.directory).filter((d) => d.kind === 'supplier'), (d) => d.name);
  const [mediaId, setMediaId] = useState<string | null>(null);
  const [cam, setCam] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [sending, setSending] = useState(false);
  const [supplier, setSupplier] = useState('');
  const [directoryId, setDirectoryId] = useState<string | undefined>();
  const [source, setSource] = useState<ReceiptSource>('shop');
  const [orderNo, setOrderNo] = useState('');
  const [date, setDate] = useState(today);
  const [lines, setLines] = useState<ReceiptLine[]>([]);
  const [total, setTotal] = useState('');
  const [picked, setPicked] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | undefined>();
  // the read in flight: a new photo (or leaving) aborts it, and an answer that is no longer the latest is ignored
  const ctl = useRef<AbortController | null>(null);
  const latest = useRef(0);
  useEffect(() => () => ctl.current?.abort(), []);

  const sectionId = picked && s.budgetSections[picked] ? picked : defaultSectionId && s.budgetSections[defaultSectionId] ? defaultSectionId : sections[0]?.id || '';
  const supplierCat = supplierCategory(s, directoryId);
  const amount = digits(total);
  const sum = linesTotal(lines);
  const gap = linesGap(amount, lines);
  const busy = uploading || status === 'reading';
  const ok = !!mediaId && !busy && !sending && !!supplier.trim() && amount > 0 && !!sectionId && !!date && date <= today && !lines.some((l) => lineProblem(l));
  const file = noteName(date || today);
  // approved requests of this section that no receipt settles yet
  const requests = live(s.budgetRequests).filter((b) => b.sectionId === sectionId && b.status === 'approved' && !receiptOfRequest(s, b.id));

  const pickSupplier = (name: string) => { setSupplier(name); setDirectoryId(suppliers.find((d) => d.name === name)?.id); };
  const read = (id: string) => {
    ctl.current?.abort();
    const mine = ++latest.current;
    const c = new AbortController();
    ctl.current = c;
    setStatus('reading');
    setLines([]);
    readReceipt(id, c.signal).then((r) => {
      if (mine !== latest.current) return;
      if (r.supplier) pickSupplier(r.supplier);
      if (r.source) setSource(r.source);
      setOrderNo(r.orderNo ?? '');
      if (r.date) setDate(r.date > today ? today : r.date);
      setLines(r.lines);
      const tot = r.total ?? linesTotal(r.lines);
      setTotal(tot > 0 ? String(tot) : '');
      setStatus('filled');
    }, (e) => {
      if (mine !== latest.current || (e instanceof DOMException && e.name === 'AbortError')) return;
      setStatus('failed');
    });
  };
  // the camera hands over the photo; it is uploaded at once, then read
  const took = async (blob: Blob) => {
    setUploading(true);
    try {
      const id = await uploadMedia(blob);
      setMediaId(id);
      read(id);
    } catch (e) { say(t(e instanceof ApiError && e.code.startsWith('common.') ? e.code : 'common.mediaFailed'), { tone: 'error', icon: 'error' }); }
    finally { setUploading(false); }
  };
  const send = async () => {
    if (!ok) return;
    setSending(true);
    // a line the buyer added takes the category of the supplier as it is now
    const sent = lines.map((l) => (l.id.startsWith(NEW) ? { ...l, category: lineCategory(undefined, supplierCat) } : l));
    const r = await act('receipt.add', {
      date, supplier: supplier.trim(), ...(directoryId ? { directoryId } : {}), amount, sectionId, source, ...(orderNo.trim() ? { orderNo: orderNo.trim() } : {}),
      ...(requestId ? { budgetRequestId: requestId } : {}), fileName: file, mediaId, lines: sent,
    }, { ok: (sentText ?? ((sec: string) => t('finance.toast.receiptSent', { section: sec })))(sectionName(s, sectionId, lang)) });
    setSending(false);
    if (r.ok) onDone();
  };

  const openCam = () => setCam(true);
  const thumb = (w: number | string, r: number) => (
    <div role={mediaId ? undefined : 'img'} aria-label={mediaId ? undefined : t('finance.rc.photoAlt', { file })} style={{ width: w, flex: 'none', aspectRatio: '3/4', borderRadius: r, background: PAPER, boxShadow: '0 1px 3px rgba(40,30,20,.14)', position: 'relative', overflow: 'hidden' }}>
      <ImageOpen src={mediaId ? mediaUrl(mediaId) : null} alt={t('finance.rc.photoAlt', { file })} label={`${t('common.openFull')} · ${file}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}><PhotoImg photo={{ mediaId: mediaId || undefined, tone: 0 }} /></ImageOpen>
    </div>
  );
  const fileChip = (
    <span style={{ height: 28, padding: '0 10px 0 6px', borderRadius: 8, background: 'var(--on-card, #FFFFFF)', fontSize: FONT_SMALL, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
      <Icon name="check_circle" size={17} color="#3D6B4F" />{file}
    </span>
  );
  const tapLabel = uploading ? t('common.processing') : t('finance.rc.tap');
  const photo = !mediaId ? (
    isPhone ? (
      <button type="button" onClick={openCam} aria-busy={uploading || undefined} className="cp-press" style={{ height: 64, borderRadius: 12, border: 'none', background: '#2E2924', color: 'var(--fill, #F4F4F5)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, cursor: 'pointer', fontFamily: 'Inter' }}>
        <Icon name="receipt_long" size={28} color="#CAB8A2" />
        <span style={{ fontSize: 16, lineHeight: 1.4 }}>{tapLabel}</span>
      </button>
    ) : (
      <button type="button" onClick={openCam} aria-busy={uploading || undefined} style={{ flex: '0 0 220px', aspectRatio: '3/4', borderRadius: 14, border: 'none', background: '#2E2924', color: 'var(--fill, #F4F4F5)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, cursor: 'pointer', fontFamily: 'Inter' }}>
        <Icon name="receipt_long" size={40} color="#CAB8A2" />
        <span style={{ fontSize: 16, lineHeight: 1.4 }}>{tapLabel}</span>
      </button>
    )
  ) : isPhone ? (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      {thumb(84, 10)}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start', minWidth: 0 }}>
        {fileChip}
        <PillBtn icon="refresh" onClick={openCam}>{t('common.retake')}</PillBtn>
      </div>
    </div>
  ) : (
    <div style={{ flex: '0 0 220px', display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
      <div style={{ width: '100%', position: 'relative' }}>
        {thumb('100%', 14)}
        <span style={{ pointerEvents: 'none', position: 'absolute', left: 10, bottom: 10 }}>{fileChip}</span>
      </div>
      <Button variant="ghost" size={44} icon="refresh" onClick={openCam} style={{ padding: '0 6px' }}>{t('common.retake')}</Button>
    </div>
  );

  const note = status === 'reading' ? <div role="status"><Note icon="hourglass_top">{t('purchasing.reading')}</Note></div>
    : status === 'filled' ? <div role="status"><Note icon="check_circle">{t('purchasing.autoFilled')}</Note></div>
    : status === 'failed' ? <div role="status"><Note tone="ochre" icon="info">{t('purchasing.readFailed')}</Note></div> : null;
  const gapNote = lines.length && amount > 0 && gap !== 0
    ? <Note tone="ochre" icon="info">{t(gap > 0 ? 'purchasing.gapShort' : 'purchasing.gapOver', { sum: rp(sum), diff: rp(Math.abs(gap)) })}</Note> : null;

  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', flexDirection: isPhone ? 'column' : 'row', gap: isPhone ? 14 : 24, alignItems: isPhone ? 'stretch' : 'flex-start' }}>
        {photo}
        <CameraCapture open={cam} onClose={() => setCam(false)} onCapture={(b) => void took(b)} />
        <div style={{ flex: '1 1 300px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: isPhone ? 14 : 12 }}>
          {note}
          {/* every field waits while the receipt is uploaded and read */}
          <fieldset disabled={busy} style={{ ...bare, display: 'flex', flexDirection: 'column', gap: isPhone ? 14 : 12 }}>
            <TextField label={t('finance.rc.supplier')} value={supplier} onChange={pickSupplier} maxLength={120} />
            <div role="group" aria-label={t('finance.rc.suppliers')} style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {suppliers.map((d) => (
                <button key={d.id} type="button" className={directoryId === d.id ? 'cp-chip' : 'cp-chip cp-fill'} onClick={() => pickSupplier(d.name)} aria-pressed={directoryId === d.id}
                  style={{ height: 44, padding: '0 14px', borderRadius: 999, border: 'none', background: directoryId === d.id ? '#24201C' : 'var(--fill, #F4F4F5)', color: directoryId === d.id ? '#FFFFFF' : '#24201C', fontSize: FONT_BODY, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'Inter' }}>{d.name}</button>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={fieldLabel}>{t('purchasing.boughtAt')}</span>
              <Segmented label={t('purchasing.boughtAt')} options={RECEIPT_SOURCES.map((v) => ({ value: v, label: t(`purchasing.src.${v}`) }))} value={source} onChange={setSource} />
            </div>
            {source !== 'shop' ? <TextField label={t('purchasing.orderNo')} value={orderNo} onChange={setOrderNo} maxLength={60} /> : null}
            <LinesEditor lines={lines} onChange={setLines} supplierCat={supplierCat} />
            {gapNote}
            <RpField label={t('finance.rc.amount')} ariaLabel={t('finance.rc.amount')} value={total} onChange={setTotal} />
            <Select label={t('finance.budget.section')} value={sectionId} onChange={(x) => { setPicked(x); setRequestId(undefined); }} options={sections.map((x) => ({ value: x.id, label: sectionName(s, x.id, lang) }))} />
            {requests.length ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={fieldLabel}>{t('finance.rc.settles')}</span>
                <div role="group" aria-label={t('finance.rc.settles')} style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {requests.map((b) => (
                    <Chip key={b.id} size={40} selected={requestId === b.id} onClick={() => { if (requestId === b.id) setRequestId(undefined); else { setRequestId(b.id); if (!amount) setTotal(String(b.amount)); } }}>{b.item} · {rp(b.amount)}</Chip>
                  ))}
                </div>
              </div>
            ) : null}
            <DateField label={t('finance.rc.date')} value={date} onChange={setDate} max={today} error={date > today ? t('finance.err.futureDate') : undefined} />
          </fieldset>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="secondary" size={48} onClick={onCancel} style={{ padding: '0 18px' }}>{t('common.cancel')}</Button>
            <Button size={48} disabled={!ok} onClick={send} style={{ flex: 1 }}>{t('finance.rc.send')}</Button>
          </div>
        </div>
      </div>
    </>
  );
}
