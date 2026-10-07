// Approvals (management): everything the team enters waits here before families see it. One tab per kind: profile changes (change requests and
// the health edits that were applied at once), care log (daily logs and notes for families), health readings, photos, menu (weekly versions and
// one-day changes) and stock requests; History lists what was handled. Each row has a checkbox: select some or all, then Approve (N) or Reject (N)
// (one reason for the whole batch; one server action per batch). Rows also have their own Approve and Reject. Photos are a grid with the
// "Notify families" switch. /reviews?tab=photos (or logs, readings, menu, stock, profile, history) opens a tab.
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { actorName, memberName, memberShort, type ChangeRequest, type Photo } from '@cp/shared';
import { tabForSection, photoReviewKind } from '@cp/shared/rules/members';
import { APPROVAL_TYPES, approvalCounts, approvalHistory, pendingItems, type ApprovalItem, type ApprovalType, type HistoryItem } from '@cp/shared/rules/approvals';
import { Avatar, Button, Dialog, EmptyState, Icon, Note, PageHead, Pager, PhotoImg, TextField, Toggle, usePaged } from '../../components/ui';
import { useDevice, padFor } from '../../hooks/useDevice';
import { useAct } from '../../lib/act';
import { useNow } from '../../lib/clock';
import { useFmt, useT } from '../../lib/i18n';
import { useClub } from '../../store/replica';
import { say, useUi } from '../../store/ui';
import { PhotoViewer } from '../activity/PhotoViewer';
import { crMemberName, whenText } from './lib';
import { describeCr } from './reviewDiff';
import { itemView } from './approvalView';
import { DiffList } from './profile/parts';
import { memberPhoto } from '../../lib/media';

type Tab = ApprovalType | 'history';
const TABS: Tab[] = [...APPROVAL_TYPES, 'history'];
const STATUS_ICON: Record<string, string> = { approved: 'task_alt', rejected: 'block', withdrawn: 'undo', superseded: 'swap_horiz', acknowledged: 'done_all', reverted: 'undo' };
const TAB_FOR_SUB: Record<string, string> = { log: 'care', note: 'notes', reading: 'care' };
const LEGACY_TABS: Record<string, Tab> = { pending: 'profile', applied: 'profile' };

/** A checkbox in the v3 quiet style (also used on photo tiles' own button). */
function Check({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" role="checkbox" aria-checked={on} aria-label={label} onClick={onClick} style={{ width: 44, height: 44, margin: '-8px -8px -8px -10px', border: 'none', padding: 0, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
      <span aria-hidden="true" style={{ width: 24, height: 24, borderRadius: 8, border: on ? '2px solid #24201C' : '2px solid #CFC4B6', background: on ? '#24201C' : '#FFFFFF', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{on ? <Icon name="check" size={18} /> : null}</span>
    </button>
  );
}

export function Reviews() {
  const s = useClub();
  const t = useT();
  const fmt = useFmt();
  const act = useAct();
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const { today } = useNow();
  const { device, isPhone } = useDevice();
  const items = useMemo(() => Object.fromEntries(APPROVAL_TYPES.map((k) => [k, pendingItems(s, k)])) as Record<ApprovalType, ApprovalItem[]>, [s]);
  const counts = useMemo(() => approvalCounts(s), [s]);
  const history = useMemo(() => approvalHistory(s), [s]);
  const photos = useMemo(() => items.photos.map((i) => s.photos[i.id]).filter((p): p is Photo => !!p), [items, s]);
  const [view, setView] = useState<Tab | null>(null);
  const q = sp.get('tab') || '';
  const linked = TABS.find((k) => k === q) ?? LEGACY_TABS[q];
  const current: Tab = view ?? linked ?? APPROVAL_TYPES.find((k) => counts[k] > 0) ?? 'profile';
  const paged = {
    profile: usePaged(items.profile, 5, 'profile'),
    logs: usePaged(items.logs, 10, 'logs'),
    readings: usePaged(items.readings, 10, 'readings'),
    photos: usePaged(photos, 12, 'photos'),
    menu: usePaged(items.menu, 10, 'menu'),
    stock: usePaged(items.stock, 10, 'stock'),
    history: usePaged(history, 10, 'history'),
  };
  const [sels, setSels] = useState<Partial<Record<Tab, string[]>>>({});
  const [notify, setNotify] = useState(true);
  const [rej, setRej] = useState<{ type: ApprovalType; ids: string[] } | null>(null);
  const [reason, setReason] = useState('');
  const [reasonTried, setReasonTried] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [viewer, setViewer] = useState<string | null>(null);
  const [conflict, setConflict] = useState<Record<string, string>>({});
  const [reject, setReject] = useState<ChangeRequest | null>(null);
  const [revert, setRevert] = useState<ChangeRequest | null>(null);
  const [note, setNote] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  // what is on the current tab, and what is selected (entries handled by someone else drop out of the selection)
  const here: { id: string }[] = current === 'history' ? [] : current === 'photos' ? photos : items[current];
  const sel = sels[current] ?? [];
  const selected = useMemo(() => here.filter((x) => sel.includes(x.id)).map((x) => x.id), [here, sel]);
  const setSel = (ids: string[]) => setSels((x) => ({ ...x, [current]: ids }));
  const toggleSel = (id: string) => setSel(sel.includes(id) ? sel.filter((y) => y !== id) : [...sel, id]);
  const showBar = current !== 'history' && here.length > 0;
  const pin = useUi((u) => u.pin);
  useEffect(() => { if (!showBar) return; pin(1); return () => pin(-1); }, [showBar, pin]);

  const who = (a: string) => {
    const role = a.startsWith('staff:') ? s.staff[a.slice(6)]?.role : a.startsWith('family:') ? 'family' : '';
    return `${actorName(s, a)}${role ? ` · ${t('roles.' + role)}` : ''}`;
  };
  const submitterNote = (cr: ChangeRequest) => (cr.status === 'pending' ? cr.note || (cr.input as { note?: string } | undefined)?.note : (cr.input as { note?: string } | undefined)?.note) || '';

  // ----- one change request (profile tab): approve / reject, or acknowledge / revert for health edits applied at once
  const approve = async (cr: ChangeRequest, force = false) => {
    setBusy(cr.id);
    const r = await act('review.approve', { crId: cr.id, ...(force ? { force: true } : {}) }, { ok: t(cr.op === 'create' ? 'reviews.approvedCreate' : 'reviews.approved') });
    setBusy('');
    if (!r.ok && r.code === 'err.reviewConflict') setConflict((c) => ({ ...c, [cr.id]: String(r.params.fields || '') }));
    if (r.ok) setConflict((c) => { const { [cr.id]: _x, ...rest } = c; void _x; return rest; });
  };
  const doReject = async () => {
    setTried(true);
    if (!reject || !note.trim()) return;
    setBusy(reject.id);
    const r = await act('review.reject', { crId: reject.id, note: note.trim() }, { ok: t('reviews.rejected') });
    setBusy('');
    if (r.ok) { setReject(null); setNote(''); setTried(false); }
  };
  const acknowledge = async (cr: ChangeRequest) => { setBusy(cr.id); await act('review.acknowledge', { crId: cr.id }, { ok: t('reviews.acknowledged') }); setBusy(''); };
  const doRevert = async (force = false) => {
    if (!revert) return;
    setBusy(revert.id);
    const r = await act('review.revert', { crId: revert.id, ...(force ? { force: true } : {}), ...(note.trim() ? { note: note.trim() } : {}) }, { ok: t('reviews.reverted') });
    setBusy('');
    if (!r.ok && r.code === 'err.reviewConflict') setConflict((c) => ({ ...c, [revert.id]: String(r.params.fields || '') }));
    if (r.ok) { setRevert(null); setNote(''); }
  };

  // ----- batches: one server action for everything selected
  const report = (res: Record<string, unknown>, mode: 'approved' | 'rejected', type: ApprovalType) => {
    const n = Number(res[mode] ?? 0);
    const skipped = (res.skipped as string[] | undefined)?.length ?? 0;
    const conflicts = (res.conflicts as string[] | undefined)?.length ?? 0;
    const forFamilies = type === 'logs' || type === 'readings' || type === 'menu';
    const done = n === 0 ? t('approvals.nothingDone') : mode === 'approved' ? t(forFamilies ? (n === 1 ? 'approvals.approvedOne' : 'approvals.approvedN') : n === 1 ? 'approvals.approvedStaffOne' : 'approvals.approvedStaffN', { n }) : t(n === 1 ? 'approvals.rejectedOne' : 'approvals.rejectedN', { n });
    say([done, n && skipped ? t('approvals.skippedN', { n: skipped }) : '', conflicts ? t('approvals.conflictN', { n: conflicts }) : ''].filter(Boolean).join(' '), { icon: n ? 'task_alt' : 'info' });
  };
  const approveSelected = async (type: ApprovalType, ids: string[]) => {
    if (!ids.length || bulkBusy) return;
    setBulkBusy(true);
    let ok = false;
    if (type === 'photos') {
      const n = ids.length;
      const r = await act('photo.approve', { photoIds: ids, notify }, { ok: t(`reviews.photosApproved${notify ? 'Told' : ''}${n === 1 ? 'One' : 'N'}`, { n }) });
      ok = r.ok;
    } else {
      const r = await act('approval.approve', { type, ids }, { silent: true });
      if (r.ok) { report(r.result, 'approved', type); ok = true; }
    }
    setBulkBusy(false);
    if (ok) setSels((x) => ({ ...x, [type]: [] }));
  };
  const rejectSelected = async () => {
    setReasonTried(true);
    if (!rej || !rej.ids.length || !reason.trim() || bulkBusy) return;
    setBulkBusy(true);
    let ok = false;
    if (rej.type === 'photos') {
      const n = rej.ids.length;
      const r = await act('photo.reject', { photoIds: rej.ids, reason: reason.trim() }, { ok: t(n === 1 ? 'reviews.photosRejectedOne' : 'reviews.photosRejectedN', { n }) });
      ok = r.ok;
    } else {
      const r = await act('approval.reject', { type: rej.type, ids: rej.ids, reason: reason.trim() }, { silent: true });
      if (r.ok) { report(r.result, 'rejected', rej.type); ok = true; }
    }
    setBulkBusy(false);
    if (ok) { setSels((x) => ({ ...x, [rej.type]: [] })); setRej(null); setReason(''); setReasonTried(false); }
  };
  const askReject = (type: ApprovalType, ids: string[]) => { setReason(''); setReasonTried(false); setRej({ type, ids }); };

  // ----- pieces
  const photoNames = (ph: Photo) => {
    if (ph.kind === 'lunch') return t('reviews.photoKind.lunch');
    const names = ph.memberIds.filter((id) => s.members[id]).map((id) => memberShort(s.members[id]));
    return names.length ? names.slice(0, 3).join(', ') + (names.length > 3 ? ` +${names.length - 3}` : '') : t('reviews.photoKind.' + photoReviewKind(ph));
  };
  const photoTile = (ph: Photo) => {
    const on = selected.includes(ph.id);
    const names = photoNames(ph);
    return (
      <div key={ph.id} data-photo-review={ph.id} data-selected={on} style={{ background: '#FFFFFF', border: on ? '2px solid #24201C' : '1px solid #EFE7DC', borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column', margin: on ? 0 : 1, boxShadow: 'var(--card-shadow)' }}>
        <div style={{ position: 'relative', aspectRatio: '1', background: '#E8E1D8' }}>
          <button type="button" onClick={() => setViewer(ph.id)} aria-label={t('reviews.openPhoto', { n: names })} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none', padding: 0, background: 'transparent', cursor: 'pointer' }}><PhotoImg photo={ph} /></button>
          <button type="button" role="checkbox" aria-checked={on} onClick={() => toggleSel(ph.id)} aria-label={t('reviews.selectPhoto', { n: names })} style={{ position: 'absolute', top: 0, left: 0, width: 52, height: 52, border: 'none', padding: 0, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span aria-hidden="true" style={{ width: 28, height: 28, borderRadius: 9, border: '2px solid #FFFFFF', background: on ? '#24201C' : 'rgba(40,40,40,0.4)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.25)' }}>{on ? <Icon name="check" size={20} /> : null}</span>
          </button>
          {ph.media === 'video' ? <span aria-hidden="true" style={{ position: 'absolute', right: 8, top: 8, width: 28, height: 28, borderRadius: 999, background: 'rgba(40,40,40,0.55)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="videocam" size={18} fill={1} /></span> : null}
        </div>
        <div style={{ padding: '10px 12px 12px', display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 500, lineHeight: '22px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'anywhere' }}>{names}</span>
          <span style={{ fontSize: 13, color: '#6B6259', lineHeight: 1.35 }}>{names === t('reviews.photoKind.' + photoReviewKind(ph)) ? '' : `${t('reviews.photoKind.' + photoReviewKind(ph))} · `}{whenText(fmt.fds, today, `${ph.date}T${ph.time}`, t)}</span>
          <span style={{ fontSize: 13, color: '#6B6259', lineHeight: 1.35 }}>{t('reviews.photoBy', { n: actorName(s, ph.createdBy) })}</span>
        </div>
      </div>
    );
  };

  /** A profile change: the full card with the old → new rows (kept whole: the diff is the point). */
  const profileCard = (it: ApprovalItem) => {
    const cr = s.changeRequests[it.id];
    if (!cr) return null;
    const kind = cr.kind === 'approval' ? 'pending' : 'applied';
    const d = describeCr(cr, s, t, fmt);
    const name = crMemberName(s, cr);
    const m = cr.target.memberId ? s.members[cr.target.memberId] : undefined;
    const sn = submitterNote(cr);
    const on = sel.includes(cr.id);
    return (
      <div key={cr.id} data-cr={cr.id} role="group" aria-label={`${d.title} ${name}`} style={{ background: '#FFFFFF', border: '1px solid #EFE7DC', borderRadius: 16, boxShadow: 'var(--card-shadow)', padding: '20px clamp(18px, 3vw, 28px)', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Check on={on} onClick={() => toggleSel(cr.id)} label={t('approvals.checkRow', { n: name || d.title })} />
          <Avatar name={name || d.title} tone={m?.photoTone} src={memberPhoto(m)} size={46} />
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {m ? (
              <button type="button" onClick={() => navigate(`/members/${m.id}/${tabForSection(cr.section)}`)} style={{ alignSelf: 'flex-start', border: 'none', background: 'transparent', padding: 0, margin: 0, color: '#24201C', fontSize: 17, fontWeight: 500, lineHeight: '24px', cursor: 'pointer', textAlign: 'left', fontFamily: 'Inter', textDecoration: 'underline', textUnderlineOffset: 3, textDecorationColor: '#CAB8A2' }}>{memberName(m)}</button>
            ) : <span style={{ fontSize: 17, fontWeight: 500, lineHeight: '24px' }}>{name || d.title}</span>}
            <span style={{ fontSize: 14, color: '#6B6259', lineHeight: 1.4 }}>{`${d.title} · ${who(cr.submittedBy)} · ${whenText(fmt.fds, today, cr.createdAt, t)}`}</span>
          </div>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: '#7A5510', fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap', flex: 'none' }}>
            <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: 999, background: kind === 'pending' ? '#7A5510' : '#8A755B' }} />
            {kind === 'pending' ? t('reviews.waiting') : t('reviews.appliedChip')}
          </span>
        </div>
        <DiffList d={d} t={t} proposed={kind === 'pending'} />
        {sn ? <Note icon="format_quote">{t('reviews.noteFrom', { n: actorName(s, cr.submittedBy) })}: {sn}</Note> : null}
        {conflict[cr.id] !== undefined ? <Note tone="ochre" icon="warning">{t('err.reviewConflict', { fields: conflict[cr.id] })}</Note> : null}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {kind === 'pending' ? (
            <>
              <Button size={48} icon="check" disabled={busy === cr.id} onClick={() => approve(cr, conflict[cr.id] !== undefined)}>{conflict[cr.id] !== undefined ? t('reviews.approveAnyway') : t('reviews.approve')}</Button>
              <Button size={48} variant="secondary" icon="close" disabled={busy === cr.id} onClick={() => { setReject(cr); setNote(''); setTried(false); }}>{t('reviews.reject')}</Button>
            </>
          ) : (
            <>
              <Button size={48} icon="done_all" disabled={busy === cr.id} onClick={() => acknowledge(cr)}>{t('reviews.acknowledge')}</Button>
              <Button size={48} variant="secondary" icon="undo" disabled={busy === cr.id} onClick={() => { setRevert(cr); setNote(''); }}>{conflict[cr.id] !== undefined ? t('reviews.revertAnyway') : t('reviews.revert')}</Button>
            </>
          )}
        </div>
      </div>
    );
  };

  /** A quiet v3 row: checkbox, the member (or the menu / the item), one summary line, Details, and its own Approve and Reject. */
  const quietRow = (it: ApprovalItem, i: number) => {
    const v = itemView(s, it, t, fmt);
    const m = it.memberId ? s.members[it.memberId] : undefined;
    const on = sel.includes(it.id);
    const expanded = open === it.id;
    const title = v.who || v.kind;
    const kindLine = v.edit ? t('approvals.editOf', { kind: v.kind }) : v.kind;
    return (
      <div key={it.id} data-approval={it.id} data-type={it.type} data-selected={on} role="group" aria-label={`${v.kind} ${v.who}`.trim()} style={{ borderTop: i ? '1px solid #F0EAE1' : 'none', padding: '16px 0', display: 'flex', flexDirection: 'column', gap: 10, background: on ? '#FBF8F4' : 'transparent' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ paddingTop: 6 }}><Check on={on} onClick={() => toggleSel(it.id)} label={t('approvals.checkRow', { n: title })} /></div>
          {m ? <Avatar name={memberName(m)} tone={m.photoTone} src={memberPhoto(m)} size={42} /> : <span aria-hidden="true" style={{ width: 42, height: 42, borderRadius: 999, background: '#F3EEE8', color: '#75624B', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><Icon name={it.type === 'menu' ? 'restaurant_menu' : it.type === 'stock' ? 'inventory_2' : 'fact_check'} size={22} /></span>}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {m ? (
              <button type="button" onClick={() => navigate(`/members/${m.id}/${TAB_FOR_SUB[it.sub] || 'overview'}`)} style={{ alignSelf: 'flex-start', border: 'none', background: 'transparent', padding: 0, margin: 0, color: '#24201C', fontSize: 16, fontWeight: 500, lineHeight: '22px', cursor: 'pointer', textAlign: 'left', fontFamily: 'Inter', textDecoration: 'underline', textUnderlineOffset: 3, textDecorationColor: '#CAB8A2' }}>{v.who}</button>
            ) : <span style={{ fontSize: 16, fontWeight: 500, lineHeight: '22px' }}>{v.kind}</span>}
            <span style={{ fontSize: 14, color: '#6B6259', lineHeight: 1.4 }}>{[m ? kindLine : v.edit ? t('approvals.isEdit') : '', who(it.by), whenText(fmt.fds, today, it.at, t)].filter(Boolean).join(' · ')}</span>
            {v.summary ? <span style={{ fontSize: 15, lineHeight: '22px', color: '#24201C', overflowWrap: 'anywhere', ...(expanded ? {} : { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }) }}>{v.summary}</span> : null}
            <button type="button" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : it.id)} style={{ alignSelf: 'flex-start', border: 'none', background: 'transparent', padding: '4px 0', margin: 0, color: '#75624B', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter', textDecoration: 'underline', textUnderlineOffset: 3 }}>{expanded ? t('approvals.hide') : t('approvals.view')}</button>
          </div>
          <div style={{ display: 'flex', gap: 6, flex: 'none', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <Button size={48} variant="secondary" icon="close" disabled={bulkBusy} onClick={() => askReject(it.type, [it.id])}>{t('approvals.rejectOne')}</Button>
            <Button size={48} icon="check" disabled={bulkBusy} onClick={() => approveSelected(it.type, [it.id])}>{t('approvals.approveOne')}</Button>
          </div>
        </div>
        {expanded ? <div style={{ paddingLeft: 66 }}><DiffList d={v.detail} t={t} proposed /></div> : null}
      </div>
    );
  };

  const historyRow = (h: HistoryItem, i: number) => {
    const cr = h.type === 'profile' ? s.changeRequests[h.id] : undefined;
    const v = itemView(s, { id: h.id, sub: h.sub, memberId: h.memberId }, t, fmt);
    const expanded = open === h.key;
    const reviewer = h.decidedBy ? actorName(s, h.decidedBy) : '';
    const sn = cr ? submitterNote(cr) : '';
    return (
      <div key={h.key} data-history={h.key} style={{ borderTop: i ? '1px solid #F0EAE1' : 'none', padding: '14px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Icon name={STATUS_ICON[h.status] || 'history'} size={22} color={h.status === 'rejected' ? '#9A3D24' : '#75624B'} fill={1} />
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.4 }}>{[v.who, v.kind].filter(Boolean).join(' · ') || t('approvals.kind.' + h.sub)}</span>
            <span style={{ fontSize: 14, color: '#6B6259', lineHeight: 1.4 }}>
              {t('reviews.status.' + h.status)}{reviewer ? ` · ${reviewer}` : ''} · {whenText(fmt.fds, today, h.decidedAt, t)} · {t('reviews.sentBy', { n: who(h.by) })}
            </span>
            {h.reason && h.status !== 'approved' ? <span style={{ fontSize: 14, lineHeight: 1.4 }}>{t('reviews.reviewerNote')}: {h.reason}</span> : null}
          </div>
          <Button variant="ghost" size={44} onClick={() => setOpen(expanded ? null : h.key)}>{expanded ? t('common.hide') : t('reviews.details')}</Button>
        </div>
        {expanded ? (<div style={{ paddingLeft: 34 }}><DiffList d={v.detail} t={t} proposed={false} />{sn ? <div style={{ fontSize: 14, color: '#6B6259', lineHeight: 1.4, paddingTop: 6 }}>{t('reviews.noteFrom', { n: actorName(s, cr!.submittedBy) })}: {sn}</div> : null}</div>) : null}
      </div>
    );
  };

  const card = (children: ReactNode, key?: string) => (
    <div key={key} style={{ background: '#FFFFFF', border: '1px solid #EFE7DC', borderRadius: 16, boxShadow: 'var(--card-shadow)', overflow: 'hidden', padding: '0 clamp(18px, 3vw, 28px)' }}>{children}</div>
  );
  const empty = (type: ApprovalType) => (
    <div style={{ background: '#FFFFFF', border: '1px solid #EFE7DC', borderRadius: 16, boxShadow: 'var(--card-shadow)' }}>
      {type === 'photos' ? <EmptyState icon="photo_library" title={t('reviews.nonePhotos')} /> : <EmptyState icon="done_all" title={t(`approvals.none.${type}`)} />}
    </div>
  );

  const tabLabel = (k: Tab) => t('approvals.tab.' + k);
  const activePager = paged[current];
  const rejN = rej?.ids.length ?? 0;
  const rejPhotos = rej?.type === 'photos';
  return (
    <div style={{ padding: padFor(device), display: 'flex', flexDirection: 'column', gap: isPhone ? 14 : 22, maxWidth: 980 }}>
      <PageHead size={40} eyebrow={t('nav.g_front')} title={t('nav.reviews')} />
      <div role="tablist" aria-label={t('approvals.tabsLabel')} className="cp-tabrow scroll-x" style={{ display: 'flex', gap: isPhone ? 20 : 28, borderBottom: '1px solid #E6DDD1', overflowX: 'auto', scrollbarWidth: 'none' }}>
        {TABS.map((k) => {
          const sel0 = current === k;
          const n = k === 'history' ? 0 : counts[k];
          return (
            <button key={k} type="button" role="tab" aria-selected={sel0} onClick={() => setView(k)} style={{ flex: 'none', height: isPhone ? 42 : 46, padding: 0, border: 'none', borderBottom: sel0 ? '2px solid #24201C' : '2px solid transparent', marginBottom: -1, background: 'transparent', color: sel0 ? '#24201C' : '#6B6259', fontSize: isPhone ? 14 : 15, fontWeight: sel0 ? 500 : 400, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'Inter' }}>{tabLabel(k)}{k === 'history' ? '' : ` · ${n}`}</button>
          );
        })}
      </div>

      {current === 'profile' ? (items.profile.length ? <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>{paged.profile.rows.map(profileCard)}</div> : empty('profile')) : null}
      {current === 'logs' ? (items.logs.length ? card(paged.logs.rows.map(quietRow)) : empty('logs')) : null}
      {current === 'readings' ? (items.readings.length ? card(paged.readings.rows.map(quietRow)) : empty('readings')) : null}
      {current === 'menu' ? (items.menu.length ? card(paged.menu.rows.map(quietRow)) : empty('menu')) : null}
      {current === 'stock' ? (items.stock.length ? card(paged.stock.rows.map(quietRow)) : empty('stock')) : null}
      {current === 'photos' ? (
        photos.length ? (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '10px 16px' }}>
              <div style={{ flex: '1 1 260px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 17, fontWeight: 500, lineHeight: '24px' }}>{t(photos.length === 1 ? 'reviews.photosWaitingOne' : 'reviews.photosWaitingN', { n: photos.length })}</span>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,160px),1fr))', gap: 12 }}>{paged.photos.rows.map(photoTile)}</div>
          </>
        ) : empty('photos')
      ) : null}
      {current === 'history' ? (
        <div style={{ background: '#FFFFFF', border: '1px solid #EFE7DC', borderRadius: 16, boxShadow: 'var(--card-shadow)', overflow: 'hidden', padding: '0 clamp(18px, 3vw, 28px) 6px' }}>
          {paged.history.rows.map(historyRow)}
          {!history.length ? <EmptyState icon="history" title={t('approvals.none.history')} /> : null}
        </div>
      ) : null}
      {activePager.pages > 1 ? <Pager page={activePager.page} pages={activePager.pages} onPage={activePager.setPage} label={t('approvals.pagerRows')} /> : null}

      {showBar ? (
        <div style={{ position: 'sticky', bottom: 0, zIndex: 4, margin: '0 -4px', padding: '12px 4px 14px', background: 'linear-gradient(to top, #F5F5F3 72%, rgba(246,241,234,0))', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, flex: '1 1 260px', minWidth: 0 }}>
            {selected.length < here.length ? <Button variant="secondary" size={44} icon="select_all" onClick={() => setSel(here.map((x) => x.id))}>{t('reviews.selectAll', { n: here.length })}</Button> : null}
            {selected.length ? <Button variant="ghost" size={44} onClick={() => setSel([])}>{t('reviews.clearSelection')}</Button> : null}
            <span aria-live="polite" style={{ fontSize: 14, color: '#6B6259', lineHeight: 1.4 }}>{selected.length ? t('reviews.selectedN', { n: selected.length }) : ''}</span>
          </div>
          {current === 'photos' ? <div style={{ flex: '1 1 260px', minWidth: 0 }}><Toggle on={notify} onClick={() => setNotify(!notify)} label={t('reviews.notifyFamilies')} /></div> : null}
          <Button size={isPhone ? 48 : 56} icon="check" disabled={!selected.length || bulkBusy} onClick={() => approveSelected(current as ApprovalType, selected)} style={{ flex: '1 1 140px' }}>{t('reviews.approvePhotos', { n: selected.length })}</Button>
          <Button size={isPhone ? 48 : 56} variant="secondary" icon="close" disabled={!selected.length || bulkBusy} onClick={() => askReject(current as ApprovalType, selected)} style={{ flex: '1 1 140px' }}>{t('reviews.rejectPhotos', { n: selected.length })}</Button>
        </div>
      ) : null}

      {viewer ? <PhotoViewer photos={photos} startId={viewer} onClose={() => setViewer(null)} audience="staff" /> : null}
      <Dialog open={!!rej} onClose={() => setRej(null)} eyebrow={t('reviews.reject')} title={rejPhotos ? t(rejN === 1 ? 'reviews.rejectPhotosTitleOne' : 'reviews.rejectPhotosTitleN', { n: rejN }) : t(rejN === 1 ? 'approvals.rejectTitleOne' : 'approvals.rejectTitleN', { n: rejN })} maxWidth={520}
        footer={<><Button variant="secondary" onClick={() => setRej(null)}>{t('common.cancel')}</Button><Button variant="danger" icon="close" disabled={bulkBusy} onClick={rejectSelected}>{t('reviews.reject')}</Button></>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flexShrink: 0 }}>
          <div style={{ fontSize: 15, lineHeight: '22px' }}>{rejPhotos ? t('reviews.rejectPhotosSub') : t('approvals.rejectSub')}</div>
          <TextField label={rejPhotos ? t('reviews.rejectPhotosReason') : t(rejN === 1 ? 'approvals.rejectReasonOne' : 'approvals.rejectReasonN')} value={reason} onChange={setReason} multiline rows={3} autoFocus error={reasonTried && !reason.trim() ? t('err.noteRequired') : false} name="rejectReason" />
        </div>
      </Dialog>
      <Dialog open={!!reject} onClose={() => setReject(null)} eyebrow={t('reviews.reject')} title={reject ? describeCr(reject, s, t, fmt).title : ''} maxWidth={520}
        footer={<><Button variant="secondary" onClick={() => setReject(null)}>{t('common.cancel')}</Button><Button variant="danger" icon="close" disabled={busy === reject?.id} onClick={doReject}>{t('reviews.reject')}</Button></>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flexShrink: 0 }}>
          <div style={{ fontSize: 15, lineHeight: '22px' }}>{t('reviews.rejectSub')}</div>
          <TextField label={t('reviews.rejectNote')} value={note} onChange={setNote} multiline rows={3} autoFocus error={tried && !note.trim() ? t('err.noteRequired') : false} name="rejectNote" />
        </div>
      </Dialog>
      <Dialog open={!!revert} onClose={() => setRevert(null)} eyebrow={t('reviews.revert')} title={revert ? describeCr(revert, s, t, fmt).title : ''} maxWidth={520}
        footer={<><Button variant="secondary" onClick={() => setRevert(null)}>{t('common.cancel')}</Button><Button icon="undo" disabled={busy === revert?.id} onClick={() => doRevert(!!(revert && conflict[revert.id] !== undefined))}>{revert && conflict[revert.id] !== undefined ? t('reviews.revertAnyway') : t('reviews.revert')}</Button></>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flexShrink: 0 }}>
          <div style={{ fontSize: 15, lineHeight: '22px' }}>{t('reviews.revertSub')}</div>
          {revert && conflict[revert.id] !== undefined ? <Note tone="ochre" icon="warning">{t('err.reviewConflict', { fields: conflict[revert.id] })}</Note> : null}
          <TextField label={t('reviews.revertNote')} value={note} onChange={setNote} multiline rows={2} />
        </div>
      </Dialog>
    </div>
  );
}
