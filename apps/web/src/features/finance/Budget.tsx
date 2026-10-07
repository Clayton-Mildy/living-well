// Budget (design ScrBudget): one card per section with its weekly limit, progress, committed money and requests (Approve / Reject);
// real Monday-to-Sunday weeks with a switcher, add or rename sections, and the request form.
import { useMemo, useState } from 'react';
import { actorName, rp, weekStart, addDays, type BudgetRequest, type BudgetSection } from '@cp/shared';
import { activeSections, budgetRange, budgetWeekOf, receiptOfRequest, sectionName } from '@cp/shared/rules/finance';
import { Button, Chip, DateField, Eyebrow, IconButton, PageHead, Select, TextField, FONT_BODY, Note } from '../../components/ui';
import { padFor, useDevice } from '../../hooks/useDevice';
import { useAct } from '../../lib/act';
import { useNow } from '../../lib/clock';
import { useFmt, useT } from '../../lib/i18n';
import { useMe } from '../../lib/me';
import { useClub } from '../../store/replica';
import { digits } from './lib';
import { AmberPill, Badge, FormOverlay, HAIR, Hero, RpField, dangerStrip, inputBox } from './parts';

export function Budget() {
  const s = useClub();
  const t = useT();
  const act = useAct();
  const { lang, fds } = useFmt();
  const { today } = useNow();
  const { role, id: meId } = useMe();
  const { device, isPhone } = useDevice();
  const canSet = role === 'finance' || role === 'mgmt';
  const range = budgetRange(s, today);
  const cur = weekStart(today);
  const [week, setWeek] = useState(cur);
  const ws = week < range.first ? range.first : week > range.last ? range.last : week;
  const we = addDays(ws, 6);
  const sections = activeSections(s);
  const [addOpen, setAddOpen] = useState(false);
  const [renaming, setRenaming] = useState<BudgetSection | null>(null);

  const step = (d: number) => setWeek(addDays(ws, 7 * d));
  const when = ws === cur ? t('finance.budget.resets') : ws > cur ? t('finance.budget.upcoming') : t('finance.budget.pastWeek');

  // request form
  const [sec, setSec] = useState(sections[0]?.id || '');
  const [item, setItem] = useState('');
  const [amt, setAmt] = useState('');
  const amount = digits(amt);
  const chosen = s.budgetSections[sec] ? sec : sections[0]?.id || '';
  const ok = !!item.trim() && amount > 0 && !!chosen;
  const send = async () => {
    if (!ok) return;
    const r = await act('budget.request', { sectionId: chosen, item: item.trim(), amount }, { ok: t(canSet ? 'finance.toast.requestAdded' : 'finance.toast.requestSent') });
    if (r.ok) { setItem(''); setAmt(''); }
  };

  return (
    <div style={{ padding: padFor(device), display: 'flex', flexDirection: 'column', gap: isPhone ? 16 : 'clamp(18px, 2.8vw, 36px)', maxWidth: 1180 }}>
      <PageHead eyebrow={`${t('finance.budget.weekOf', { date: fds(ws) })} · ${when}`} title={t('nav.budget')}
        right={canSet ? <Button variant="secondary" size={48} icon="add" onClick={() => setAddOpen(true)} style={{ padding: '0 18px' }}>{t('finance.budget.addSection')}</Button> : undefined} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <IconButton icon="chevron_left" label={t('finance.budget.prevWeek')} onClick={() => step(-1)} style={ws <= range.first ? { opacity: 0.4, pointerEvents: 'none' } : undefined} />
        <span role="status" aria-live="polite" data-testid="budget-week" style={{ minWidth: isPhone ? 0 : 200, flex: isPhone ? 1 : undefined, textAlign: 'center', fontSize: 17, fontWeight: 500, lineHeight: 1.4, color: '#2B231C' }}>{fds(ws)} – {fds(we)}</span>
        <IconButton icon="chevron_right" label={t('finance.budget.nextWeek')} onClick={() => step(1)} style={ws >= range.last ? { opacity: 0.4, pointerEvents: 'none' } : undefined} />
        {ws !== cur ? <Chip icon="today" onClick={() => setWeek(cur)}>{t('finance.budget.thisWeek')}</Chip> : null}
        <div style={{ flex: isPhone ? '1 1 100%' : '0 1 230px', minWidth: isPhone ? 0 : 190 }}><DateField ariaLabel={t('finance.budget.jump')} value={ws} min={range.first} max={addDays(range.last, 6)} onChange={(d) => { if (d) setWeek(weekStart(d)); }} /></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,320px),1fr))', gap: isPhone ? 14 : 'clamp(16px, 2.4vw, 28px)', alignItems: 'start' }}>
        {sections.map((x) => <SectionCard key={`${x.id}:${ws}`} section={x} ws={ws} canSet={canSet} meId={meId || ''} lang={lang} onRename={() => setRenaming(x)} />)}
      </div>
      {!sections.length ? <Note tone="cream" icon="pie_chart">{t('finance.budget.noSections')}</Note> : null}

      <Hero visible style={{ maxWidth: 760, padding: '18px 22px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Eyebrow>{t('finance.budget.requestTitle')}</Eyebrow>
        <Select label={t('finance.budget.section')} value={chosen} onChange={setSec} options={sections.map((x) => ({ value: x.id, label: sectionName(s, x.id, lang) }))} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input value={item} onChange={(e) => setItem(e.target.value)} placeholder={t('finance.budget.itemPlaceholder')} aria-label={t('finance.budget.item')} maxLength={120} style={{ ...inputBox, flex: '2 1 240px' }} />
          <div style={{ flex: '1 1 140px', minWidth: 0 }}><RpField value={amt} onChange={setAmt} ariaLabel={t('finance.budget.amount')} placeholder={t('finance.budget.amountPlaceholder')} /></div>
          <Button size={56} disabled={!ok} onClick={send} style={{ padding: '0 24px' }}>{t('finance.budget.send')}</Button>
        </div>
      </Hero>

      <AddSectionDialog open={addOpen} onClose={() => setAddOpen(false)} />
      <RenameDialog section={renaming} onClose={() => setRenaming(null)} />
    </div>
  );
}

function SectionCard({ section, ws, canSet, meId, lang, onRename }: { section: BudgetSection; ws: string; canSet: boolean; meId: string; lang: 'en' | 'id'; onRename: () => void }) {
  const s = useClub();
  const t = useT();
  const act = useAct();
  const { fds } = useFmt();
  const { today } = useNow();
  const w = useMemo(() => budgetWeekOf(s, section.id, ws), [s, section.id, ws]);
  const editable = canSet && ws >= weekStart(today); // past weeks are history: read only
  const [limit, setLimit] = useState(String(w.limit));
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [editing, setEditing] = useState<BudgetRequest | null>(null);
  const dirty = digits(limit) !== w.limit;
  const pct = Math.min(100, w.limit > 0 ? Math.round((w.used / w.limit) * 100) : w.used > 0 ? 100 : 0);
  const reqs = w.requests.filter((r) => r.status !== 'cancelled');
  const saveLimit = async () => {
    const r = await act('budget.setLimit', { sectionId: section.id, weekly: digits(limit), fromWeek: ws }, { ok: t('finance.toast.limitSaved', { date: fds(ws) }) });
    void r;
  };
  const decide = async (id: string, kind: 'approve' | 'reject') => {
    if (kind === 'approve') await act('budget.approve', { id }, { ok: t('finance.toast.approved', { name: actorName(s, `staff:${s.budgetRequests[id].requestedBy}`) }) });
    else {
      const r = await act('budget.reject', { id, note: note.trim() }, { ok: t('finance.toast.rejected') });
      if (r.ok) { setRejecting(null); setNote(''); }
    }
  };
  return (
    <Hero visible style={{ borderRadius: 16, boxShadow: 'var(--card-shadow)', padding: '18px clamp(16px, 2vw, 22px) 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 22, lineHeight: '30px', fontWeight: 400, letterSpacing: '-0.4px', color: '#2B231C', minWidth: 0 }}>{sectionName(s, section.id, lang)}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 'none' }}>
          {w.pending.length ? <AmberPill>{t('finance.budget.waiting', { n: w.pending.length })}</AmberPill> : null}
          {canSet ? <IconButton icon="edit" label={t('finance.budget.rename', { name: sectionName(s, section.id, lang) })} bordered={false} onClick={onRename} /> : null}
        </span>
      </div>
      {editable ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <RpField label={t('finance.budget.weekly')} ariaLabel={`${t('finance.budget.weekly')} ${sectionName(s, section.id, lang)}`} value={limit} onChange={setLimit} size={18} />
          {dirty ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Button size={44} onClick={saveLimit} style={{ padding: '0 18px' }}>{t('finance.budget.saveLimit', { date: fds(ws) })}</Button>
              <Button variant="ghost" size={44} onClick={() => setLimit(String(w.limit))}>{t('common.cancel')}</Button>
            </div>
          ) : null}
        </div>
      ) : (
        <span style={{ fontSize: 18, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{t('finance.budget.weekRp', { amount: rp(w.limit) })}</span>
      )}
      <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={sectionName(s, section.id, lang)} style={{ height: 8, borderRadius: 999, background: '#F0EAE1', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: pct >= 90 ? '#9A3D24' : pct >= 75 ? '#7A5510' : '#75624B', borderRadius: 999 }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', fontSize: 14, lineHeight: 1.4, fontVariantNumeric: 'tabular-nums' }}>
        <span>{t('finance.budget.spent', { amount: rp(w.spent) })}{w.committed > 0 ? ` · ${t('finance.budget.committed', { amount: rp(w.committed) })}` : ''}</span>
        <span style={{ color: w.left < 0 ? '#9A3D24' : '#2F5A40', fontWeight: 500 }}>{w.left < 0 ? t('finance.budget.over', { amount: rp(-w.left) }) : t('finance.budget.left', { amount: rp(w.left) })}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {reqs.map((r) => {
          const mine = r.requestedBy === meId;
          const pending = r.status === 'pending';
          const receipt = receiptOfRequest(s, r.id);
          return (
            <div key={r.id} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '14px 0', borderTop: HAIR }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 160px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.4 }}>{r.item} · {rp(r.amount)}</span>
                  <span style={{ fontSize: 14, color: '#6B6259', lineHeight: 1.4 }}>{actorName(s, `staff:${r.requestedBy}`)} · {fds(r.createdAt.slice(0, 10))}</span>
                </div>
                {pending ? <Badge kind="pending" label={t('finance.budget.badgeWaiting')} /> : r.status === 'approved' ? <Badge kind="paid" label={receipt ? t('finance.budget.badgeReceipt') : t('status.approved')} /> : <Badge kind="overdue" label={t('status.rejected')} />}
                {pending && (mine || canSet) ? (
                  <>
                    {mine ? <TextBtn onClick={() => setEditing(r)}>{t('common.edit')}</TextBtn> : null}
                    {mine ? <TextBtn onClick={() => act('budget.cancel', { id: r.id }, { ok: t('finance.toast.cancelled') })}>{t('finance.budget.cancelRequest')}</TextBtn> : null}
                  </>
                ) : null}
                {pending && canSet ? (
                  <>
                    <TextBtn color="#9A3D24" onClick={() => { setRejecting(rejecting === r.id ? null : r.id); setNote(''); }}>{t('finance.budget.reject')}</TextBtn>
                    <button type="button" onClick={() => decide(r.id, 'approve')} aria-label={`${t('finance.budget.approve')} ${r.item}`} style={{ height: 40, padding: '0 18px', borderRadius: 12, border: 'none', background: '#24201C', color: '#FFFFFF', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter' }}>{t('finance.budget.approve')}</button>
                  </>
                ) : null}
              </div>
              {r.status === 'rejected' && r.note ? <span style={{ fontSize: FONT_BODY, color: '#9A3D24', lineHeight: 1.4 }}>{t('finance.budget.rejectedNote', { note: r.note })}</span> : null}
              {rejecting === r.id ? (
                <div style={dangerStrip}>
                  <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('finance.budget.rejectReason')} aria-label={t('finance.budget.rejectReason')} style={{ ...inputBox, flex: '1 1 200px' }} />
                  <Button variant="secondary" size={48} onClick={() => setRejecting(null)} style={{ padding: '0 18px' }}>{t('common.cancel')}</Button>
                  <Button variant="danger" size={48} disabled={!note.trim()} onClick={() => decide(r.id, 'reject')} style={{ padding: '0 20px' }}>{t('finance.budget.rejectConfirm')}</Button>
                </div>
              ) : null}
            </div>
          );
        })}
        {!reqs.length ? <span style={{ fontSize: 14, color: '#6B6259', lineHeight: 1.4, paddingTop: 12, borderTop: HAIR }}>{t('finance.budget.noRequests')}</span> : null}
      </div>
      <EditRequest request={editing} onClose={() => setEditing(null)} />
    </Hero>
  );
}

const TextBtn = ({ children, onClick, color = '#75624B' }: { children: React.ReactNode; onClick: () => void; color?: string }) => (
  <button type="button" onClick={onClick} style={{ height: 40, padding: '0 8px', borderRadius: 12, border: 'none', background: 'transparent', color, fontSize: 14, fontWeight: 500, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 4, fontFamily: 'Inter' }}>{children}</button>
);

function EditRequest({ request, onClose }: { request: BudgetRequest | null; onClose: () => void }) {
  const t = useT();
  const act = useAct();
  const [item, setItem] = useState(request?.item || '');
  const [amt, setAmt] = useState(String(request?.amount || ''));
  const [prev, setPrev] = useState(request?.id);
  if (request?.id !== prev) { setPrev(request?.id); setItem(request?.item || ''); setAmt(String(request?.amount || '')); }
  if (!request) return null;
  const ok = !!item.trim() && digits(amt) > 0;
  const save = async () => {
    const r = await act('budget.edit', { id: request.id, item: item.trim(), amount: digits(amt) }, { ok: t('finance.toast.requestSaved') });
    if (r.ok) onClose();
  };
  return (
    <FormOverlay open onClose={onClose} title={t('finance.budget.editRequest')} maxWidth={480}
      footer={<><Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button><Button disabled={!ok} onClick={save}>{t('common.save')}</Button></>}>
      <TextField label={t('finance.budget.item')} value={item} onChange={setItem} maxLength={120} />
      <RpField label={t('finance.budget.amount')} value={amt} onChange={setAmt} />
    </FormOverlay>
  );
}

function AddSectionDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const act = useAct();
  const [name, setName] = useState('');
  const [nameId, setNameId] = useState('');
  const [weekly, setWeekly] = useState('');
  const ok = !!name.trim() && !!weekly;
  const save = async () => {
    const r = await act('budget.addSection', { name: name.trim(), ...(nameId.trim() ? { nameId: nameId.trim() } : {}), weekly: digits(weekly) }, { ok: t('finance.toast.sectionAdded', { name: name.trim() }) });
    if (r.ok) { setName(''); setNameId(''); setWeekly(''); onClose(); }
  };
  return (
    <FormOverlay open={open} onClose={onClose} title={t('finance.budget.addSection')} maxWidth={480}
      footer={<><Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button><Button disabled={!ok} onClick={save}>{t('finance.budget.addSectionBtn')}</Button></>}>
      <TextField label={t('finance.budget.sectionName')} value={name} onChange={setName} maxLength={60} placeholder={t('finance.budget.sectionEx')} />
      <TextField label={t('finance.budget.sectionNameId')} value={nameId} onChange={setNameId} maxLength={60} />
      <RpField label={t('finance.budget.weekly')} value={weekly} onChange={setWeekly} />
    </FormOverlay>
  );
}

function RenameDialog({ section, onClose }: { section: BudgetSection | null; onClose: () => void }) {
  const t = useT();
  const act = useAct();
  const [name, setName] = useState(section?.name || '');
  const [nameId, setNameId] = useState(section?.nameId || '');
  const [prev, setPrev] = useState(section?.id);
  if (section?.id !== prev) { setPrev(section?.id); setName(section?.name || ''); setNameId(section?.nameId || ''); }
  if (!section) return null;
  const save = async () => {
    const r = await act('budget.renameSection', { id: section.id, name: name.trim(), ...(nameId.trim() ? { nameId: nameId.trim() } : {}) }, { ok: t('finance.toast.sectionRenamed') });
    if (r.ok) onClose();
  };
  return (
    <FormOverlay open onClose={onClose} title={t('finance.budget.renameTitle')} maxWidth={480}
      footer={<><Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button><Button disabled={!name.trim()} onClick={save}>{t('common.save')}</Button></>}>
      <TextField label={t('finance.budget.sectionName')} value={name} onChange={setName} maxLength={60} />
      <TextField label={t('finance.budget.sectionNameId')} value={nameId} onChange={setNameId} maxLength={60} />
    </FormOverlay>
  );
}

