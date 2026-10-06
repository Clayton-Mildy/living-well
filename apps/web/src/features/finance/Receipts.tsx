// Receipts (design ScrRcpt): snap a nota with the fake camera, pick the supplier from the directory, tag the section, send to finance;
// the receipts list (approve / reject / edit / void) and the vendor invoices list (add / edit / approve / mark paid / delete).
import { useMemo, useState } from 'react';
import { actorName, live, rp, sortBy, type Receipt, type VendorInvoice } from '@cp/shared';
import { activeSections, receiptOfRequest, receiptsList, sectionName, vendorInvoicesList } from '@cp/shared/rules/finance';
import { Button, CameraCapture, Card, CardHead, Chip, DateField, EmptyState, Icon, PageHead, PhotoImg, Pin, Select, TextField, usePaged, FONT_BODY, FONT_SMALL } from '../../components/ui';
import { padFor, useDevice } from '../../hooks/useDevice';
import { useAct } from '../../lib/act';
import { ApiError } from '../../lib/api';
import { uploadMedia } from '../../lib/media';
import { say } from '../../store/ui';
import { useNow } from '../../lib/clock';
import { useFmt, useT } from '../../lib/i18n';
import { useMe } from '../../lib/me';
import { useClub } from '../../store/replica';
import { digits, matches } from './lib';
import { Badge, ConfirmDialog, FormOverlay, PagerBar, RpField, SearchField, dangerStrip, fieldLabel, inputBox } from './parts';

const PAPER = 'linear-gradient(160deg, #FBF8F4 0%, #EFE7DD 55%, #DCCFC0 100%)';
const noteName = (date: string) => `nota_${date.slice(8)}${date.slice(5, 7)}.jpg`;

export function Receipts() {
  const s = useClub();
  const t = useT();
  const { lang } = useFmt();
  const { today } = useNow();
  const { device, isPhone } = useDevice();
  const { role } = useMe();
  const canApprove = role === 'finance' || role === 'mgmt';
  const [snapping, setSnapping] = useState(false);
  const [q, setQ] = useState('');
  const [vendorForm, setVendorForm] = useState<null | 'new' | VendorInvoice>(null);
  const [editReceipt, setEditReceipt] = useState<Receipt | null>(null);

  const rows = useMemo(() => receiptsList(s), [s]);
  const vinv = useMemo(() => vendorInvoicesList(s), [s]);
  const rHits = rows.filter((r) => matches(q, r.supplier, sectionName(s, r.sectionId, lang), actorName(s, `staff:${r.by}`), String(r.amount), r.fileName));
  const vHits = vinv.filter((v) => matches(q, v.supplier, v.number, sectionName(s, v.sectionId, lang), String(v.amount)));
  const rPaged = usePaged(rHits, 15, q);
  const vPaged = usePaged(vHits, 15, q);

  return (
    <>
      <div style={{ padding: padFor(device), display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1100 }}>
        <PageHead eyebrow={t('finance.rc.eyebrow')} title={t('nav.receipts')} />
        {!snapping && !isPhone ? (
          <Button size={56} icon="photo_camera" onClick={() => setSnapping(true)} style={{ alignSelf: 'flex-start', padding: '0 26px 0 20px' }}>{t('finance.rc.snap')}</Button>
        ) : null}
        {snapping ? <SnapPanel today={today} onClose={() => setSnapping(false)} /> : null}

        <SearchField value={q} onChange={setQ} label={t('finance.rc.search')} placeholder={t('finance.rc.search')} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,380px),1fr))', gap: 16, alignItems: 'start' }}>
          <Card>
            <CardHead title={t('nav.receipts')} meta={t('finance.rc.listMeta')} />
            {rPaged.rows.map((r) => <ReceiptRow key={r.id} r={r} canApprove={canApprove} onEdit={() => setEditReceipt(r)} />)}
            {!rHits.length ? <div style={{ borderTop: '1px solid #EFECEA' }}><EmptyState icon={q ? 'search_off' : 'receipt_long'} title={q ? t('common.noResults') : t('finance.rc.empty')} /></div> : null}
            <PagerBar paged={rPaged} label={t('nav.receipts')} />
          </Card>
          <Card>
            <CardHead title={t('finance.rc.vendorTitle')} meta={t('finance.rc.vendorMeta')} right={canApprove ? <Button variant="secondary" size={44} icon="add" onClick={() => setVendorForm('new')} style={{ padding: '0 16px' }}>{t('finance.rc.addVendor')}</Button> : undefined} />
            {vPaged.rows.map((v) => <VendorRow key={v.id} v={v} canApprove={canApprove} onEdit={() => setVendorForm(v)} />)}
            {!vHits.length ? <div style={{ borderTop: '1px solid #EFECEA' }}><EmptyState icon={q ? 'search_off' : 'request_quote'} title={q ? t('common.noResults') : t('finance.rc.vendorEmpty')} /></div> : null}
            <PagerBar paged={vPaged} label={t('finance.rc.vendorTitle')} />
          </Card>
        </div>
      </div>
      {isPhone && !snapping ? <Pin icon="photo_camera" label={t('finance.rc.snap')} onClick={() => setSnapping(true)} /> : null}
      <VendorForm value={vendorForm} onClose={() => setVendorForm(null)} />
      <EditReceipt receipt={editReceipt} onClose={() => setEditReceipt(null)} />
    </>
  );
}

// ---------- the receipt fields, shared by the snap panel and the edit dialog ----------
interface Fields { supplier: string; directoryId?: string; amount: string; sectionId: string; date: string; requestId?: string }
function ReceiptFields({ v, set, selfId }: { v: Fields; set: (p: Partial<Fields>) => void; selfId?: string }) {
  const s = useClub();
  const t = useT();
  const { lang } = useFmt();
  const { today } = useNow();
  const sections = activeSections(s);
  const suppliers = sortBy(live(s.directory).filter((d) => d.kind === 'supplier'), (d) => d.name);
  // approved requests of this section that no receipt settles yet (the one this receipt already settles stays pickable)
  const requests = live(s.budgetRequests).filter((b) => b.sectionId === v.sectionId && b.status === 'approved' && (!receiptOfRequest(s, b.id) || receiptOfRequest(s, b.id)?.id === selfId));
  return (
    <>
      <TextField label={t('finance.rc.supplier')} value={v.supplier} onChange={(x) => set({ supplier: x, directoryId: suppliers.find((d) => d.name === x)?.id })} maxLength={120} />
      <div role="group" aria-label={t('finance.rc.suppliers')} style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {suppliers.map((d) => (
          <button key={d.id} type="button" className="cp-chip" onClick={() => set({ supplier: d.name, directoryId: d.id })} aria-pressed={v.directoryId === d.id}
            style={{ height: 44, padding: '0 12px', borderRadius: 999, border: v.directoryId === d.id ? '1px solid #282828' : '1px solid #CAB8A2', background: v.directoryId === d.id ? '#282828' : '#FFFFFF', color: v.directoryId === d.id ? '#FFFFFF' : '#282828', fontSize: FONT_BODY, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'Inter' }}>{d.name}</button>
        ))}
      </div>
      <RpField label={t('finance.rc.amount')} ariaLabel={t('finance.rc.amount')} value={v.amount} onChange={(x) => set({ amount: x })} />
      <Select label={t('finance.budget.section')} value={v.sectionId} onChange={(x) => set({ sectionId: x, requestId: undefined })} options={sections.map((x) => ({ value: x.id, label: sectionName(s, x.id, lang) }))} />
      {requests.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={fieldLabel}>{t('finance.rc.settles')}</span>
          <div role="group" aria-label={t('finance.rc.settles')} style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {requests.map((b) => (
              <Chip key={b.id} size={40} selected={v.requestId === b.id} onClick={() => set(v.requestId === b.id ? { requestId: undefined } : { requestId: b.id, amount: v.amount || String(b.amount) })}>{b.item} · {rp(b.amount)}</Chip>
            ))}
          </div>
          <span style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>{t('finance.rc.settlesHint')}</span>
        </div>
      ) : null}
      <DateField label={t('finance.rc.date')} value={v.date} onChange={(x) => set({ date: x })} max={today} error={v.date > today ? t('finance.err.futureDate') : undefined} />
    </>
  );
}

function SnapPanel({ today, onClose }: { today: string; onClose: () => void }) {
  const s = useClub();
  const t = useT();
  const act = useAct();
  const { lang } = useFmt();
  const sections = activeSections(s);
  const [mediaId, setMediaId] = useState<string | null>(null);
  const [cam, setCam] = useState(false);
  const [uploading, setUploading] = useState(false);
  const snapped = !!mediaId;
  const [v, setV] = useState<Fields>({ supplier: '', amount: '', sectionId: sections[0]?.id || '', date: today });
  const set = (p: Partial<Fields>) => setV((x) => ({ ...x, ...p }));
  const amount = digits(v.amount);
  const sectionId = s.budgetSections[v.sectionId] ? v.sectionId : sections[0]?.id || '';
  const ok = snapped && !!v.supplier.trim() && amount > 0 && !!sectionId && !!v.date && v.date <= today;
  const file = noteName(v.date || today);
  // the camera hands over the photo; it is uploaded at once and the receipt keeps its id
  const took = async (blob: Blob) => {
    setUploading(true);
    try { setMediaId(await uploadMedia(blob)); }
    catch (e) { say(t(e instanceof ApiError && e.code.startsWith('common.') ? e.code : 'common.mediaFailed'), { tone: 'error', icon: 'error' }); }
    finally { setUploading(false); }
  };
  const send = async () => {
    if (!ok) return;
    const r = await act('receipt.add', { date: v.date, supplier: v.supplier.trim(), ...(v.directoryId ? { directoryId: v.directoryId } : {}), amount, sectionId, ...(v.requestId ? { budgetRequestId: v.requestId } : {}), fileName: file, ...(mediaId ? { mediaId } : {}) },
      { ok: t('finance.toast.receiptSent', { section: sectionName(s, sectionId, lang) }) });
    if (r.ok) onClose();
  };
  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #DBD7D6', borderRadius: 24, padding: '18px 20px', display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'flex-start', animation: 'cpUp .2s ease-out' }}>
      {!snapped ? (
        <button type="button" onClick={() => setCam(true)} aria-busy={uploading || undefined} style={{ flex: '0 0 220px', aspectRatio: '3/4', borderRadius: 18, border: 'none', background: '#2E2924', color: '#F4F0EE', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, cursor: 'pointer', fontFamily: 'Inter' }}>
          <Icon name="receipt_long" size={40} color="#CAB8A2" />
          <span style={{ fontSize: 16, lineHeight: 1.4 }}>{uploading ? t('common.processing') : t('finance.rc.tap')}</span>
        </button>
      ) : (
        <div style={{ flex: '0 0 220px', display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
        <div role="img" aria-label={t('finance.rc.photoAlt', { file })} style={{ width: '100%', aspectRatio: '3/4', borderRadius: 18, background: PAPER, border: '1px solid #DBD7D6', position: 'relative', overflow: 'hidden' }}>
          <PhotoImg photo={{ mediaId: mediaId || undefined, tone: 0 }} />
          <span style={{ position: 'absolute', left: 10, bottom: 10, height: 28, padding: '0 10px 0 6px', borderRadius: 999, background: '#FFFFFF', fontSize: FONT_SMALL, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
            <Icon name="check_circle" size={17} color="#3D6B4F" />{file}
          </span>
        </div>
        <Button variant="ghost" size={44} icon="refresh" onClick={() => setCam(true)} style={{ padding: '0 6px' }}>{t('common.retake')}</Button>
        </div>
      )}
      <CameraCapture open={cam} onClose={() => setCam(false)} onCapture={(b) => void took(b)} />
      <div style={{ flex: '1 1 300px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <ReceiptFields v={{ ...v, sectionId }} set={set} />
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="secondary" size={48} onClick={onClose} style={{ padding: '0 18px' }}>{t('common.cancel')}</Button>
          <Button size={48} disabled={!ok} onClick={send} style={{ flex: 1 }}>{t('finance.rc.send')}</Button>
        </div>
      </div>
    </div>
  );
}

function EditReceipt({ receipt, onClose }: { receipt: Receipt | null; onClose: () => void }) {
  const t = useT();
  const act = useAct();
  const init = (r: Receipt | null): Fields => ({ supplier: r?.supplier || '', directoryId: r?.directoryId, amount: String(r?.amount || ''), sectionId: r?.sectionId || '', date: r?.date || '', requestId: r?.budgetRequestId });
  const [v, setV] = useState<Fields>(init(receipt));
  const [prev, setPrev] = useState(receipt?.id);
  if (receipt?.id !== prev) { setPrev(receipt?.id); setV(init(receipt)); }
  if (!receipt) return null;
  const ok = !!v.supplier.trim() && digits(v.amount) > 0 && !!v.sectionId;
  const save = async () => {
    const r = await act('receipt.edit', { id: receipt.id, supplier: v.supplier.trim(), directoryId: v.directoryId ?? null, amount: digits(v.amount), sectionId: v.sectionId, date: v.date, budgetRequestId: v.requestId ?? null }, { ok: t('finance.toast.receiptSaved') });
    if (r.ok) onClose();
  };
  return (
    <FormOverlay open onClose={onClose} title={t('finance.rc.editTitle')} maxWidth={560}
      footer={<><Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button><Button disabled={!ok} onClick={save}>{t('common.save')}</Button></>}>
      <ReceiptFields v={v} set={(p) => setV((x) => ({ ...x, ...p }))} selfId={receipt.id} />
    </FormOverlay>
  );
}

function ReceiptRow({ r, canApprove, onEdit }: { r: Receipt; canApprove: boolean; onEdit: () => void }) {
  const s = useClub();
  const t = useT();
  const act = useAct();
  const { lang, fds } = useFmt();
  const { today } = useNow();
  const { id: meId } = useMe();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');
  const [confirmVoid, setConfirmVoid] = useState(false);
  const mine = r.by === meId;
  const submitted = r.status === 'submitted';
  const badge = r.status === 'submitted' ? <Badge kind="watch" label={t('finance.rc.toApprove')} /> : r.status === 'rejected' ? <Badge kind="overdue" label={t('status.rejected')} />
    : r.xero === 'synced' ? <Badge kind="paid" label={t('finance.rc.inXero')} /> : <Badge kind="pending" label={t('finance.rc.sendingXero')} />;
  const canEdit = canApprove || (mine && (r.status === 'submitted' || r.status === 'rejected'));
  const reject = async () => {
    const x = await act('receipt.reject', { id: r.id, note: note.trim() }, { ok: t('finance.toast.receiptRejected') });
    if (x.ok) { setRejecting(false); setNote(''); }
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 20px', borderTop: '1px solid #EFECEA', minHeight: 64 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span aria-hidden="true" style={{ width: 40, height: 52, borderRadius: 8, background: PAPER, border: '1px solid #DBD7D6', flex: 'none', overflow: 'hidden' }}>{r.mediaId ? <PhotoImg photo={{ mediaId: r.mediaId, tone: 0 }} /> : null}</span>
        <div style={{ flex: '1 1 160px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.4 }}>{r.supplier} · {rp(r.amount)}</span>
          <span style={{ fontSize: 'max(13px, var(--cp-body, 0px))', color: '#6A6967', lineHeight: 1.4 }}>{sectionName(s, r.sectionId, lang)} · {actorName(s, `staff:${r.by}`)} · {r.date === today ? t('common.today').toLowerCase() : fds(r.date)}</span>
        </div>
        {badge}
        {(submitted && canApprove) || canEdit || (mine && submitted) ? (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end', marginLeft: 'auto' }}>
          {canEdit ? <TextBtn onClick={onEdit} label={`${t('common.edit')} ${r.supplier}`}>{t('common.edit')}</TextBtn> : null}
          {(mine && submitted) || canApprove ? <TextBtn onClick={() => setConfirmVoid(true)} label={`${t('finance.rc.void')} ${r.supplier}`}>{t('finance.rc.void')}</TextBtn> : null}
          {submitted && canApprove ? (
            <>
              <TextBtn color="#AF4B2F" onClick={() => setRejecting(!rejecting)} label={`${t('finance.budget.reject')} ${r.supplier}`}>{t('finance.budget.reject')}</TextBtn>
              <button type="button" onClick={() => act('receipt.approve', { id: r.id }, { ok: t('finance.toast.receiptApproved', { supplier: r.supplier }) })} aria-label={`${t('finance.budget.approve')} ${r.supplier}`}
                style={{ height: 44, padding: '0 14px', borderRadius: 999, border: 'none', background: '#75624B', color: '#FFFFFF', fontSize: FONT_BODY, fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter' }}>{t('finance.budget.approve')}</button>
            </>
          ) : null}
        </div>
        ) : null}
      </div>
      {r.status === 'rejected' && r.note ? <span style={{ fontSize: FONT_BODY, color: '#AF4B2F', lineHeight: 1.4 }}>{t('finance.budget.rejectedNote', { note: r.note })}</span> : null}
      {rejecting ? (
        <div style={dangerStrip}>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('finance.budget.rejectReason')} aria-label={t('finance.budget.rejectReason')} style={{ ...inputBox, flex: '1 1 200px' }} />
          <Button variant="secondary" size={48} onClick={() => setRejecting(false)} style={{ padding: '0 18px' }}>{t('common.cancel')}</Button>
          <Button variant="danger" size={48} disabled={!note.trim()} onClick={reject} style={{ padding: '0 20px' }}>{t('finance.rc.rejectConfirm')}</Button>
        </div>
      ) : null}
      <ConfirmDialog open={confirmVoid} onClose={() => setConfirmVoid(false)} title={t('finance.rc.voidTitle')} body={t('finance.rc.voidBody', { supplier: r.supplier, amount: rp(r.amount) })} confirmLabel={t('finance.rc.void')}
        onConfirm={async () => { const x = await act('receipt.void', { id: r.id }, { ok: t('finance.toast.receiptVoided') }); if (x.ok) setConfirmVoid(false); }} />
    </div>
  );
}

function VendorRow({ v, canApprove, onEdit }: { v: VendorInvoice; canApprove: boolean; onEdit: () => void }) {
  const s = useClub();
  const t = useT();
  const act = useAct();
  const { lang, fds } = useFmt();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);
  const badge = v.status === 'toApprove' ? <Badge kind="watch" label={t('finance.rc.toApprove')} /> : v.status === 'rejected' ? <Badge kind="overdue" label={t('status.rejected')} />
    : v.status === 'paid' ? <Badge kind="paid" label={t('finance.rc.paid')} /> : <Badge kind="paid" label={v.xero === 'synced' ? t('finance.rc.approvedXero') : t('status.approved')} />;
  const reject = async () => {
    const x = await act('vendorInvoice.reject', { id: v.id, note: note.trim() }, { ok: t('finance.toast.vendorRejected', { supplier: v.supplier }) });
    if (x.ok) { setRejecting(false); setNote(''); }
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 20px', borderTop: '1px solid #EFECEA', minHeight: 64 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 200px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.4 }}>{v.supplier} · {v.number}</span>
          <span style={{ fontSize: 'max(13px, var(--cp-body, 0px))', color: '#6A6967', lineHeight: 1.4 }}>{rp(v.amount)} · {t('finance.rc.due', { date: fds(v.due) })} · {sectionName(s, v.sectionId, lang)}</span>
        </div>
        {badge}
        {canApprove ? (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end', marginLeft: 'auto' }}>
          {v.status !== 'paid' ? <TextBtn onClick={onEdit} label={`${t('common.edit')} ${v.number}`}>{t('common.edit')}</TextBtn> : null}
          {v.status !== 'paid' ? <TextBtn onClick={() => setConfirmDel(true)} label={`${t('common.delete')} ${v.number}`}>{t('common.delete')}</TextBtn> : null}
          {v.status === 'toApprove' ? (
            <>
              <TextBtn color="#AF4B2F" onClick={() => setRejecting(!rejecting)} label={`${t('finance.budget.reject')} ${v.number}`}>{t('finance.budget.reject')}</TextBtn>
              <button type="button" onClick={() => act('vendorInvoice.approve', { id: v.id }, { ok: t('finance.toast.vendorApproved', { supplier: v.supplier }) })} aria-label={`${t('finance.budget.approve')} ${v.number}`}
                style={{ height: 44, padding: '0 14px', borderRadius: 999, border: 'none', background: '#75624B', color: '#FFFFFF', fontSize: FONT_BODY, fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter' }}>{t('finance.budget.approve')}</button>
            </>
          ) : null}
          {v.status === 'approved' ? (
            <button type="button" onClick={() => act('vendorInvoice.markPaid', { id: v.id }, { ok: t('finance.toast.vendorPaid', { supplier: v.supplier }) })} aria-label={`${t('finance.rc.markPaid')} ${v.number}`}
              style={{ height: 44, padding: '0 14px', borderRadius: 999, border: 'none', background: '#75624B', color: '#FFFFFF', fontSize: FONT_BODY, fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter' }}>{t('finance.rc.markPaid')}</button>
          ) : null}
        </div>
        ) : null}
      </div>
      {v.status === 'rejected' && v.note ? <span style={{ fontSize: FONT_BODY, color: '#AF4B2F', lineHeight: 1.4 }}>{t('finance.budget.rejectedNote', { note: v.note })}</span> : null}
      {rejecting ? (
        <div style={dangerStrip}>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('finance.budget.rejectReason')} aria-label={t('finance.budget.rejectReason')} style={{ ...inputBox, flex: '1 1 200px' }} />
          <Button variant="secondary" size={48} onClick={() => setRejecting(false)} style={{ padding: '0 18px' }}>{t('common.cancel')}</Button>
          <Button variant="danger" size={48} disabled={!note.trim()} onClick={reject} style={{ padding: '0 20px' }}>{t('finance.rc.rejectConfirm')}</Button>
        </div>
      ) : null}
      <ConfirmDialog open={confirmDel} onClose={() => setConfirmDel(false)} title={t('finance.rc.deleteTitle')} body={t('finance.rc.deleteBody', { supplier: v.supplier, number: v.number })} confirmLabel={t('common.delete')}
        onConfirm={async () => { const x = await act('vendorInvoice.delete', { id: v.id }, { ok: t('finance.toast.vendorDeleted') }); if (x.ok) setConfirmDel(false); }} />
    </div>
  );
}

function VendorForm({ value, onClose }: { value: null | 'new' | VendorInvoice; onClose: () => void }) {
  const s = useClub();
  const t = useT();
  const act = useAct();
  const { lang } = useFmt();
  const editing = value && value !== 'new' ? value : null;
  const sections = activeSections(s);
  const suppliers = sortBy(live(s.directory).filter((d) => d.kind === 'supplier'), (d) => d.name);
  const init = () => ({ supplier: editing?.supplier || '', directoryId: editing?.directoryId as string | undefined, number: editing?.number || '', amount: String(editing?.amount || ''), due: editing?.due || '', sectionId: editing?.sectionId || sections[0]?.id || '' });
  const [v, setV] = useState(init);
  const [prev, setPrev] = useState<string | null>(null);
  const key = value ? (value === 'new' ? 'new' : value.id) : null;
  if (key !== prev) { setPrev(key); if (value) setV(init()); }
  if (!value) return null;
  const set = (p: Partial<typeof v>) => setV((x) => ({ ...x, ...p }));
  const ok = !!v.supplier.trim() && !!v.number.trim() && digits(v.amount) > 0 && !!v.due && !!v.sectionId;
  const save = async () => {
    const body = { supplier: v.supplier.trim(), number: v.number.trim(), amount: digits(v.amount), due: v.due, sectionId: v.sectionId };
    const r = editing
      ? await act('vendorInvoice.edit', { id: editing.id, ...body, directoryId: v.directoryId ?? null }, { ok: t('finance.toast.vendorSaved') })
      : await act('vendorInvoice.add', { ...body, ...(v.directoryId ? { directoryId: v.directoryId } : {}) }, { ok: t('finance.toast.vendorAdded', { supplier: body.supplier }) });
    if (r.ok) onClose();
  };
  return (
    <FormOverlay open onClose={onClose} title={editing ? t('finance.rc.editVendor') : t('finance.rc.addVendor')} maxWidth={560}
      footer={<><Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button><Button disabled={!ok} onClick={save}>{editing ? t('common.save') : t('finance.rc.addVendorBtn')}</Button></>}>
      <TextField label={t('finance.rc.supplier')} value={v.supplier} onChange={(x) => set({ supplier: x, directoryId: suppliers.find((d) => d.name === x)?.id })} maxLength={120} />
      <div role="group" aria-label={t('finance.rc.suppliers')} style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {suppliers.map((d) => (
          <button key={d.id} type="button" className="cp-chip" aria-pressed={v.directoryId === d.id} onClick={() => set({ supplier: d.name, directoryId: d.id })}
            style={{ height: 44, padding: '0 12px', borderRadius: 999, border: v.directoryId === d.id ? '1px solid #282828' : '1px solid #CAB8A2', background: v.directoryId === d.id ? '#282828' : '#FFFFFF', color: v.directoryId === d.id ? '#FFFFFF' : '#282828', fontSize: FONT_BODY, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'Inter' }}>{d.name}</button>
        ))}
      </div>
      <TextField label={t('finance.rc.number')} value={v.number} onChange={(x) => set({ number: x })} maxLength={60} />
      <RpField label={t('finance.rc.amount')} ariaLabel={t('finance.rc.amount')} value={v.amount} onChange={(x) => set({ amount: x })} />
      <DateField label={t('finance.rc.dueDate')} value={v.due} onChange={(x) => set({ due: x })} />
      <Select label={t('finance.budget.section')} value={v.sectionId} onChange={(x) => set({ sectionId: x })} options={sections.map((x) => ({ value: x.id, label: sectionName(s, x.id, lang) }))} />
    </FormOverlay>
  );
}

const TextBtn = ({ children, onClick, color = '#75624B', label }: { children: React.ReactNode; onClick: () => void; color?: string; label?: string }) => (
  <button type="button" onClick={onClick} aria-label={label} style={{ height: 44, padding: '0 10px', borderRadius: 999, border: 'none', background: 'transparent', color, fontSize: FONT_BODY, fontWeight: 500, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 4, fontFamily: 'Inter' }}>{children}</button>
);
