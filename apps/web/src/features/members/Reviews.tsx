// Approvals (management): everything the team enters waits here before families see it. One tab per kind: profile changes (change requests and
// the health edits that were applied at once), care log (daily logs and notes for families), health readings, photos, menu (weekly versions and
// one-day changes) and stock requests; History lists what was handled. Each row has a checkbox: select some or all, then Approve (N) or Reject (N)
// (one reason for the whole batch; one server action per batch). Rows also have their own Approve and Reject. Photos are a grid with the
// "Notify families" switch. /reviews?tab=photos (or logs, readings, menu, stock, renewals, profile, history) opens a tab.
// KC round 7: the Renewals tab lists the changes the front desk recorded after calling a family (upgrade, downgrade, leave, stop); approving applies them from the 1st.
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { actorName, memberName, memberShort, type ChangeRequest, type Photo } from '@cp/shared';
import { tabForSection, photoReviewKind } from '@cp/shared/rules/members';
import { APPROVAL_TYPES, approvalCounts, approvalHistory, pendingItems, type ApprovalItem, type ApprovalType, type HistoryItem } from '@cp/shared/rules/approvals';
import { Avatar, Button, Dialog, EmptyState, GROUP_HEAD, Group, Icon, Note, PageHead, Pager, PhotoImg, TextField, Toggle, usePaged } from '../../components/ui';
import { useDevice, padFor } from '../../hooks/useDevice';
import { useAct } from '../../lib/act';
import { useNow } from '../../lib/clock';
import { useFmt, useT } from '../../lib/i18n';
import { useClub } from '../../store/replica';
import { say, useUi } from '../../store/ui';
import { PhotoViewer } from '../activity/PhotoViewer';
import { photoCaption } from '../activity/lib';
import { crMemberName, whenText } from './lib';
import { describeCr } from './reviewDiff';
import { groupByPerson, itemView, type PersonGroup } from './approvalView';
import { DiffList } from './profile/parts';
import { memberPhoto } from '../../lib/media';

type Tab = ApprovalType | 'history';
const TABS: Tab[] = [...APPROVAL_TYPES, 'history'];
const STATUS_ICON: Record<string, string> = { approved: 'task_alt', rejected: 'block', withdrawn: 'undo', superseded: 'swap_horiz', acknowledged: 'done_all', reverted: 'undo' };
const TAB_FOR_SUB: Record<string, string> = { log: 'care', note: 'notes', reading: 'care', renewal: 'plan' };
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
  // KC round 6: approvals per item (the type tabs) or per person (everything about one member together); remembered per browser
  const [mode, setModeState] = useState<'item' | 'person'>(() => { if (sp.get('view') === 'person') return 'person'; try { return localStorage.getItem('cp.approvals.mode') === 'person' ? 'person' : 'item'; } catch { return 'item'; } });
  const setMode = (m: 'item' | 'person') => { setModeState(m); try { localStorage.setItem('cp.approvals.mode', m); } catch { /* private window */ } };
  const byPerson = useMemo(() => groupByPerson(s, items), [s, items]);
  const pagedPeople = usePaged(byPerson.people, 8, 'people');
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
    renewals: usePaged(items.renewals, 10, 'renewals'),
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
  const showBar = mode === 'item' && current !== 'history' && here.length > 0;
  const pin = useUi((u) => u.pin);
  useEffect(() => { if (!showBar) return; pin(1); return () => pin(-1); }, [showBar, pin]);
  // round 6, phone: the tab row scrolls sideways; keep the selected tab in view (a deep link can select one at the far end)
  const tabsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isPhone) return;
    tabsRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView?.({ inline: 'center', block: 'nearest' });
  }, [isPhone, current]);
  /** round 6, phone: a small iOS pill button (rows) or a wide one (cards); the same names and actions as the desktop Buttons */
  const pill = (text: string, onClick: () => void, o: { primary?: boolean; disabled?: boolean; h?: number; grow?: boolean } = {}) => (
    <button type="button" className="cp-press" aria-disabled={o.disabled || undefined} onClick={o.disabled ? undefined : onClick}
      style={{ flex: o.grow ? '1 1 0' : 'none', height: o.h ?? 34, padding: '0 16px', borderRadius: 999, fontFamily: 'Inter', fontSize: o.grow ? 15 : 14, fontWeight: 500, cursor: o.disabled ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
        ...(o.disabled ? { background: '#EDE5DA', color: '#8A8078', border: 'none' } : o.primary ? { background: '#24201C', color: '#FFFFFF', border: 'none' } : { background: '#FFFFFF', color: '#24201C', border: '1px solid #DCD3C8' }) }}>{text}</button>
  );
  /** round 6, phone: a quiet bronze text button (Details, Select all…) */
  const textBtn: CSSProperties = { height: 34, padding: '0 6px', border: 'none', background: 'transparent', color: '#75624B', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter', whiteSpace: 'nowrap' };

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
    if (ph.kind === 'lunch') return t(s.dayMenus[ph.date]?.teaPhotoIds?.includes(ph.id) ? 'reviews.photoKind.tea' : 'reviews.photoKind.lunch'); // round 7: afternoon tea photos are lunch-kind rows listed under the day's tea
    if (ph.kind === 'activity') return photoCaption(s, ph, t, fmt.lang); // KC round 7: an activity picture is of a session: its name is the activity's
    const names = ph.memberIds.filter((id) => s.members[id]).map((id) => memberShort(s.members[id]));
    return names.length ? names.slice(0, 3).join(', ') + (names.length > 3 ? ` +${names.length - 3}` : '') : t('reviews.photoKind.' + photoReviewKind(ph));
  };
  const photoTile = (ph: Photo) => {
    const on = selected.includes(ph.id);
    const names = photoNames(ph);
    return (
      <div key={ph.id} data-photo-review={ph.id} data-selected={on} style={{ background: '#FFFFFF', border: on ? '2px solid #24201C' : isPhone ? '2px solid transparent' : '1px solid #EFE7DC', borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column', margin: on || isPhone ? 0 : 1, boxShadow: 'var(--card-shadow)' }}>
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
    const who0 = m ? (
      <button type="button" onClick={() => navigate(`/members/${m.id}/${tabForSection(cr.section)}`)} style={{ alignSelf: 'flex-start', border: 'none', background: 'transparent', padding: 0, margin: 0, color: '#24201C', fontSize: isPhone ? 16 : 17, fontWeight: 500, lineHeight: '24px', cursor: 'pointer', textAlign: 'left', fontFamily: 'Inter', textDecoration: 'underline', textUnderlineOffset: 3, textDecorationColor: '#CAB8A2' }}>{memberName(m)}</button>
    ) : <span style={{ fontSize: isPhone ? 16 : 17, fontWeight: 500, lineHeight: '24px' }}>{name || d.title}</span>;
    const chip = (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: '#7A5510', fontSize: isPhone ? 13 : 14, fontWeight: 500, whiteSpace: 'nowrap', flex: 'none' }}>
        <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: 999, background: kind === 'pending' ? '#7A5510' : '#8A755B' }} />
        {kind === 'pending' ? t('reviews.waiting') : t('reviews.appliedChip')}
      </span>
    );
    // round 6, phone: a flat grouped card (no border, radius 14); the status chip moves up next to the name so the text column keeps its width
    return (
      <div key={cr.id} data-cr={cr.id} role="group" aria-label={`${d.title} ${name}`} style={isPhone ? { background: '#FFFFFF', borderRadius: 14, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 } : { background: '#FFFFFF', border: '1px solid #EFE7DC', borderRadius: 16, boxShadow: 'var(--card-shadow)', padding: '20px clamp(18px, 3vw, 28px)', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Check on={on} onClick={() => toggleSel(cr.id)} label={t('approvals.checkRow', { n: name || d.title })} />
          <Avatar name={name || d.title} tone={m?.photoTone} src={memberPhoto(m)} size={isPhone ? 40 : 46} />
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {isPhone ? <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>{who0}{chip}</div> : who0}
            <span style={{ fontSize: isPhone ? 13 : 14, color: '#6B6259', lineHeight: 1.4 }}>{`${d.title} · ${who(cr.submittedBy)} · ${whenText(fmt.fds, today, cr.createdAt, t)}`}</span>
          </div>
          {isPhone ? null : chip}
        </div>
        <DiffList d={d} t={t} proposed={kind === 'pending'} />
        {sn ? <Note icon="format_quote">{t('reviews.noteFrom', { n: actorName(s, cr.submittedBy) })}: {sn}</Note> : null}
        {conflict[cr.id] !== undefined ? <Note tone="ochre" icon="warning">{t('err.reviewConflict', { fields: conflict[cr.id] })}</Note> : null}
        {isPhone ? (
          <div style={{ display: 'flex', gap: 8 }}>
            {kind === 'pending' ? (
              <>
                {pill(conflict[cr.id] !== undefined ? t('reviews.approveAnyway') : t('reviews.approve'), () => approve(cr, conflict[cr.id] !== undefined), { primary: true, disabled: busy === cr.id, h: 40, grow: true })}
                {pill(t('reviews.reject'), () => { setReject(cr); setNote(''); setTried(false); }, { disabled: busy === cr.id, h: 40, grow: true })}
              </>
            ) : (
              <>
                {pill(t('reviews.acknowledge'), () => acknowledge(cr), { primary: true, disabled: busy === cr.id, h: 40, grow: true })}
                {pill(conflict[cr.id] !== undefined ? t('reviews.revertAnyway') : t('reviews.revert'), () => { setRevert(cr); setNote(''); }, { disabled: busy === cr.id, h: 40, grow: true })}
              </>
            )}
          </div>
        ) : (
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
        )}
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
    // round 6, phone: a row of the grouped list. Check and avatar on the left; name, one meta line, the summary and a "View" link on the right, with small Reject / Approve pills beside it
    if (isPhone) {
      return (
        <div key={it.id} data-approval={it.id} data-type={it.type} data-selected={on} role="group" aria-label={`${v.kind} ${v.who}`.trim()}
          style={{ padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: 12, backgroundColor: on ? '#FBF8F4' : '#FFFFFF', backgroundImage: i ? 'linear-gradient(#EFEAE3, #EFEAE3)' : 'none', backgroundSize: 'calc(100% - 54px) 1px', backgroundPosition: 'right top', backgroundRepeat: 'no-repeat' }}>
          <div style={{ paddingTop: 6 }}><Check on={on} onClick={() => toggleSel(it.id)} label={t('approvals.checkRow', { n: title })} /></div>
          {m ? <Avatar name={memberName(m)} tone={m.photoTone} src={memberPhoto(m)} size={40} /> : <span aria-hidden="true" style={{ width: 40, height: 40, borderRadius: 999, background: '#F3EEE8', color: '#75624B', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><Icon name={it.type === 'menu' ? 'restaurant_menu' : it.type === 'stock' ? 'inventory_2' : 'fact_check'} size={21} /></span>}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {m ? (
              <button type="button" onClick={() => navigate(`/members/${m.id}/${TAB_FOR_SUB[it.sub] || 'overview'}`)} style={{ alignSelf: 'flex-start', border: 'none', background: 'transparent', padding: 0, margin: 0, color: '#24201C', fontSize: 16, fontWeight: 500, lineHeight: '22px', cursor: 'pointer', textAlign: 'left', fontFamily: 'Inter', textDecoration: 'underline', textUnderlineOffset: 3, textDecorationColor: '#CAB8A2' }}>{v.who}</button>
            ) : <span style={{ fontSize: 16, fontWeight: 500, lineHeight: '22px' }}>{v.kind}</span>}
            <span style={{ fontSize: 13, color: '#6B6259', lineHeight: 1.4 }}>{[m ? kindLine : v.edit ? t('approvals.isEdit') : '', who(it.by), whenText(fmt.fds, today, it.at, t)].filter(Boolean).join(' · ')}</span>
            {v.summary ? <span style={{ fontSize: 15, lineHeight: '22px', color: '#24201C', overflowWrap: 'anywhere', ...(expanded ? {} : { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }) }}>{v.summary}</span> : null}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 4 }}>
              <button type="button" className="cp-press" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : it.id)} style={{ ...textBtn, padding: '0 8px 0 0' }}>{expanded ? t('approvals.hide') : t('approvals.view')}</button>
              <div style={{ display: 'flex', gap: 8, flex: 'none' }}>
                {pill(t('approvals.rejectOne'), () => askReject(it.type, [it.id]), { disabled: bulkBusy })}
                {pill(t('approvals.approveOne'), () => approveSelected(it.type, [it.id]), { primary: true, disabled: bulkBusy })}
              </div>
            </div>
            {expanded ? <div style={{ paddingTop: 6 }}><DiffList d={v.detail} t={t} proposed /></div> : null}
          </div>
        </div>
      );
    }
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
    // round 6, phone: a grouped-list row with its own inset and an inset hairline; "Details" is a quiet text button
    if (isPhone) {
      return (
        <div key={h.key} data-history={h.key} style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8, backgroundImage: i ? 'linear-gradient(#EFEAE3, #EFEAE3)' : 'none', backgroundSize: 'calc(100% - 50px) 1px', backgroundPosition: 'right top', backgroundRepeat: 'no-repeat' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <Icon name={STATUS_ICON[h.status] || 'history'} size={22} color={h.status === 'rejected' ? '#9A3D24' : '#75624B'} fill={1} />
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.4 }}>{[v.who, v.kind].filter(Boolean).join(' · ') || t('approvals.kind.' + h.sub)}</span>
              <span style={{ fontSize: 13, color: '#6B6259', lineHeight: 1.4 }}>
                {t('reviews.status.' + h.status)}{reviewer ? ` · ${reviewer}` : ''} · {whenText(fmt.fds, today, h.decidedAt, t)} · {t('reviews.sentBy', { n: who(h.by) })}
              </span>
              {h.reason && h.status !== 'approved' ? <span style={{ fontSize: 14, lineHeight: 1.4 }}>{t('reviews.reviewerNote')}: {h.reason}</span> : null}
            </div>
            <button type="button" className="cp-press" onClick={() => setOpen(expanded ? null : h.key)} style={{ ...textBtn, flex: 'none' }}>{expanded ? t('common.hide') : t('reviews.details')}</button>
          </div>
          {expanded ? (<div style={{ paddingLeft: 34 }}><DiffList d={v.detail} t={t} proposed={false} />{sn ? <div style={{ fontSize: 14, color: '#6B6259', lineHeight: 1.4, paddingTop: 6 }}>{t('reviews.noteFrom', { n: actorName(s, cr!.submittedBy) })}: {sn}</div> : null}</div>) : null}
        </div>
      );
    }
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

  // round 6, phone: the list cards are flat groups (white, radius 14, no border or shadow); the rows carry their own inset
  const card = (children: ReactNode, key?: string) => isPhone ? <Group key={key} pad={0} gap={0}>{children}</Group> : (
    <div key={key} style={{ background: '#FFFFFF', border: '1px solid #EFE7DC', borderRadius: 16, boxShadow: 'var(--card-shadow)', overflow: 'hidden', padding: '0 clamp(18px, 3vw, 28px)' }}>{children}</div>
  );
  const empty = (type: ApprovalType) => (
    <div style={isPhone ? { background: '#FFFFFF', borderRadius: 14 } : { background: '#FFFFFF', border: '1px solid #EFE7DC', borderRadius: 16, boxShadow: 'var(--card-shadow)' }}>
      {type === 'photos' ? <EmptyState icon="photo_library" title={t('reviews.nonePhotos')} /> : <EmptyState icon="done_all" title={t(`approvals.none.${type}`)} />}
    </div>
  );

  // ----- KC round 6: the per-person view. One card per member with everything waiting about them, then group photos, then menu and stock.
  /** One waiting entry inside a person (or section) card: what it is, one summary line, View, and its own actions. */
  const personRow = (it: ApprovalItem, i: number) => {
    const v = itemView(s, it, t, fmt);
    const ph = it.type === 'photos' ? s.photos[it.id] : undefined;
    const cr = it.type === 'profile' ? s.changeRequests[it.id] : undefined;
    const applied = !!cr && cr.kind !== 'approval';
    const expanded = open === 'p:' + it.id;
    const kindLine = ph ? `${t('reviews.photoKind.' + photoReviewKind(ph))}${ph.kind === 'solo' ? '' : ` · ${photoNames(ph)}`}` : v.edit ? t('approvals.editOf', { kind: v.kind }) : v.kind;
    const meta = [it.type === 'menu' || it.type === 'stock' ? '' : t('approvals.tab.' + it.type), who(it.by), whenText(fmt.fds, today, it.at, t)].filter(Boolean).join(' · ');
    const busyRow = bulkBusy || (!!cr && busy === cr.id);
    const actions: [string, () => void, boolean][] = cr
      ? applied
        ? [[t('reviews.revert'), () => { setRevert(cr); setNote(''); }, false], [t('reviews.acknowledge'), () => acknowledge(cr), true]]
        : [[t('reviews.reject'), () => { setReject(cr); setNote(''); setTried(false); }, false], [conflict[cr.id] !== undefined ? t('reviews.approveAnyway') : t('reviews.approve'), () => approve(cr, conflict[cr.id] !== undefined), true]]
      : [[t('approvals.rejectOne'), () => askReject(it.type, [it.id]), false], [t('approvals.approveOne'), () => approveSelected(it.type, [it.id]), true]];
    return (
      <div key={it.id} data-person-item={it.id} data-type={it.type} role="group" aria-label={`${kindLine} ${v.who}`.trim()}
        style={{ padding: isPhone ? '12px 16px' : '14px 0', display: 'flex', gap: 12, alignItems: 'flex-start', ...(isPhone ? { backgroundImage: i ? 'linear-gradient(#EFEAE3, #EFEAE3)' : 'none', backgroundSize: 'calc(100% - 16px) 1px', backgroundPosition: 'right top', backgroundRepeat: 'no-repeat' } : { borderTop: i ? '1px solid #F0EAE1' : 'none' }) }}>
        {ph ? (
          <button type="button" onClick={() => setViewer(ph.id)} aria-label={t('reviews.openPhoto', { n: photoNames(ph) })} style={{ width: 52, height: 52, flex: 'none', borderRadius: 10, overflow: 'hidden', border: 'none', padding: 0, background: '#E8E1D8', cursor: 'pointer', position: 'relative' }}><PhotoImg photo={ph} /></button>
        ) : null}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 15, fontWeight: 500, lineHeight: '22px' }}>{kindLine}</span>
          <span style={{ fontSize: 13, color: '#6B6259', lineHeight: 1.4 }}>{meta}</span>
          {v.summary ? <span style={{ fontSize: 15, lineHeight: '22px', color: '#24201C', overflowWrap: 'anywhere', ...(expanded ? {} : { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }) }}>{v.summary}</span> : null}
          {cr && conflict[cr.id] !== undefined ? <Note tone="ochre" icon="warning">{t('err.reviewConflict', { fields: conflict[cr.id] })}</Note> : null}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
            {ph ? <span /> : <button type="button" className="cp-press" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : 'p:' + it.id)} style={{ ...textBtn, padding: '0 8px 0 0' }}>{expanded ? t('approvals.hide') : t('approvals.view')}</button>}
            <div style={{ display: 'flex', gap: 8, flex: 'none' }}>
              {actions.map(([label, run, primary]) => isPhone
                ? <span key={label}>{pill(label, run, { primary, disabled: busyRow })}</span>
                : <Button key={label} size={44} variant={primary ? 'primary' : 'secondary'} icon={primary ? 'check' : 'close'} disabled={busyRow} onClick={run}>{label}</Button>)}
            </div>
          </div>
          {expanded ? <div style={{ paddingTop: 6 }}><DiffList d={v.detail} t={t} proposed={!applied} /></div> : null}
        </div>
      </div>
    );
  };
  /** Approve everything waiting about one member: profile changes (applied health edits are acknowledged), care logs, readings and solo photos. */
  const approveAllFor = async (g: PersonGroup) => {
    if (bulkBusy) return;
    setBulkBusy(true);
    let n = 0;
    for (const it of g.items.filter((x) => x.type === 'profile')) {
      const cr = s.changeRequests[it.id];
      if (!cr) continue;
      const r = cr.kind === 'approval' ? await act('review.approve', { crId: cr.id }, { silent: true }) : await act('review.acknowledge', { crId: cr.id }, { silent: true });
      if (r.ok) n++;
      else if (r.code === 'err.reviewConflict') setConflict((c) => ({ ...c, [cr.id]: String(r.params.fields || '') }));
    }
    for (const type of ['logs', 'readings', 'renewals'] as const) {
      const ids = g.items.filter((x) => x.type === type).map((x) => x.id);
      if (!ids.length) continue;
      const r = await act('approval.approve', { type, ids }, { silent: true });
      if (r.ok) n += Number(r.result.approved ?? 0);
    }
    const photoIds = g.items.filter((x) => x.type === 'photos').map((x) => x.id);
    if (photoIds.length) { const r = await act('photo.approve', { photoIds, notify }, { silent: true }); if (r.ok) n += photoIds.length; }
    setBulkBusy(false);
    say(t('approvals.approvedAllFor', { n, name: memberShort(s.members[g.memberId]) }), { icon: n ? 'task_alt' : 'info' });
  };
  const sectionCard = (key: string, head: ReactNode, rows: ReactNode) => (
    <section key={key} data-person={key} style={isPhone ? { background: '#FFFFFF', borderRadius: 14, overflow: 'hidden' } : { background: '#FFFFFF', border: '1px solid #EFE7DC', borderRadius: 16, boxShadow: 'var(--card-shadow)', padding: '6px clamp(18px, 3vw, 28px) 4px' }}>
      {head}
      <div style={isPhone ? { borderTop: '1px solid #EFEAE3' } : { borderTop: '1px solid #F0EAE1' }}>{rows}</div>
    </section>
  );
  const personCard = (g: PersonGroup) => {
    const m = s.members[g.memberId];
    const n = g.items.length;
    const kinds = APPROVAL_TYPES.map((k) => [k, g.items.filter((x) => x.type === k).length] as const).filter(([, c]) => c).map(([k, c]) => `${t('approvals.tab.' + k)} ${c}`).join(' · ');
    return sectionCard(g.memberId, (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: isPhone ? '12px 16px' : '12px 0' }}>
        <Avatar name={memberName(m)} tone={m.photoTone} src={memberPhoto(m)} size={isPhone ? 42 : 46} />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <button type="button" onClick={() => navigate(`/members/${m.id}`)} style={{ alignSelf: 'flex-start', border: 'none', background: 'transparent', padding: 0, margin: 0, color: '#24201C', fontSize: isPhone ? 16 : 17, fontWeight: 500, lineHeight: '22px', cursor: 'pointer', textAlign: 'left', fontFamily: 'Inter', textDecoration: 'underline', textUnderlineOffset: 3, textDecorationColor: '#CAB8A2' }}>{memberName(m)}</button>
          <span style={{ fontSize: 13, color: '#6B6259', lineHeight: 1.4 }}>{t('approvals.personWaiting', { n })} · {kinds}</span>
        </div>
        {isPhone ? pill(t('approvals.approveAllFor', { n }), () => void approveAllFor(g), { primary: true, disabled: bulkBusy })
          : <Button size={44} icon="done_all" disabled={bulkBusy} onClick={() => void approveAllFor(g)}>{t('approvals.approveAllFor', { n })}</Button>}
      </div>
    ), g.items.map(personRow));
  };
  const sectionHead = (title: string, n: number) => (
    <div style={{ padding: isPhone ? '12px 16px' : '14px 0 12px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
      <span style={{ fontSize: isPhone ? 16 : 17, fontWeight: 500, lineHeight: '22px' }}>{title}</span>
      <span style={{ fontSize: 13, color: '#6B6259' }}>{t('approvals.personWaiting', { n })}</span>
    </div>
  );
  const nothingWaiting = !byPerson.people.length && !byPerson.groupPhotos.length && !byPerson.other.length;
  const personView = (
    <div data-testid="approvals-by-person" style={{ display: 'flex', flexDirection: 'column', gap: isPhone ? 12 : 16 }}>
      {nothingWaiting ? <div style={isPhone ? { background: '#FFFFFF', borderRadius: 14 } : { background: '#FFFFFF', border: '1px solid #EFE7DC', borderRadius: 16, boxShadow: 'var(--card-shadow)' }}><EmptyState icon="done_all" title={t('approvals.none.all')} /></div> : null}
      {items.photos.length ? <Toggle on={notify} onClick={() => setNotify(!notify)} label={t('reviews.notifyFamilies')} /> : null}
      {pagedPeople.rows.map(personCard)}
      {pagedPeople.pages > 1 ? <Pager page={pagedPeople.page} pages={pagedPeople.pages} onPage={pagedPeople.setPage} label={t('approvals.pagerRows')} /> : null}
      {byPerson.groupPhotos.length ? sectionCard('group-photos', sectionHead(t('approvals.groupPhotos'), byPerson.groupPhotos.length), byPerson.groupPhotos.map(personRow)) : null}
      {byPerson.other.length ? sectionCard('other', sectionHead(t('approvals.otherSection'), byPerson.other.length), byPerson.other.map(personRow)) : null}
    </div>
  );
  const modeSwitch = (
    <div role="tablist" aria-label={t('approvals.modeLabel')} style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 2, padding: 3, borderRadius: 11, background: '#EAE6E0', alignSelf: isPhone ? 'stretch' : 'flex-start', minWidth: isPhone ? undefined : 300 }}>
      {(['item', 'person'] as const).map((k) => {
        const on = mode === k;
        return (
          <button key={k} type="button" role="tab" aria-selected={on} data-mode={k} onClick={() => setMode(k)} className="cp-press"
            style={{ height: 36, padding: '0 14px', borderRadius: 9, border: 'none', background: on ? '#FFFFFF' : 'transparent', boxShadow: on ? '0 1px 3px rgba(40,30,20,0.14)' : 'none', fontSize: 14, fontWeight: on ? 600 : 500, color: on ? '#1E1A16' : '#5E5852', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'Inter' }}>{t('approvals.mode.' + k)}</button>
        );
      })}
    </div>
  );

  const tabLabel = (k: Tab) => t('approvals.tab.' + k);
  const activePager = paged[current];
  const rejN = rej?.ids.length ?? 0;
  const rejPhotos = rej?.type === 'photos';
  return (
    <div className={isPhone ? 'cp-native' : undefined} style={{ padding: padFor(device), display: 'flex', flexDirection: 'column', gap: isPhone ? 14 : 22 }}>
      <PageHead size={40} eyebrow={t('nav.g_front')} title={t('nav.reviews')} />
      {modeSwitch}
      {mode === 'person' ? personView : null}
      {mode === 'item' ? (<>
      {/* round 6, phone: the tabs stay one scrolling row, as iOS capsule chips (grey, the selected one ink) instead of underlined text links */}
      <div ref={tabsRef} role="tablist" aria-label={t('approvals.tabsLabel')} className="cp-tabrow scroll-x" style={{ display: 'flex', gap: isPhone ? 8 : 28, ...(isPhone ? {} : { borderBottom: '1px solid #E6DDD1' }), overflowX: 'auto', scrollbarWidth: 'none' }}>
        {TABS.map((k) => {
          const sel0 = current === k;
          const n = k === 'history' ? 0 : counts[k];
          return (
            <button key={k} type="button" role="tab" aria-selected={sel0} onClick={() => setView(k)} className={isPhone ? 'cp-press' : undefined}
              style={isPhone ? { flex: 'none', height: 34, padding: '0 14px', border: 'none', borderRadius: 999, background: sel0 ? '#24201C' : '#EAE6E0', color: sel0 ? '#FFFFFF' : '#4A4038', fontSize: 14, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'Inter' }
                : { flex: 'none', height: 46, padding: 0, border: 'none', borderBottom: sel0 ? '2px solid #24201C' : '2px solid transparent', marginBottom: -1, background: 'transparent', color: sel0 ? '#24201C' : '#6B6259', fontSize: 15, fontWeight: sel0 ? 500 : 400, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'Inter' }}>{tabLabel(k)}{k === 'history' ? '' : ` · ${n}`}</button>
          );
        })}
      </div>

      {current === 'profile' ? (items.profile.length ? <div style={{ display: 'flex', flexDirection: 'column', gap: isPhone ? 12 : 16 }}>{paged.profile.rows.map(profileCard)}</div> : empty('profile')) : null}
      {current === 'logs' ? (items.logs.length ? card(paged.logs.rows.map(quietRow)) : empty('logs')) : null}
      {current === 'readings' ? (items.readings.length ? card(paged.readings.rows.map(quietRow)) : empty('readings')) : null}
      {current === 'menu' ? (items.menu.length ? card(paged.menu.rows.map(quietRow)) : empty('menu')) : null}
      {current === 'stock' ? (items.stock.length ? card(paged.stock.rows.map(quietRow)) : empty('stock')) : null}
      {current === 'renewals' ? (items.renewals.length ? card(paged.renewals.rows.map(quietRow)) : empty('renewals')) : null}
      {current === 'photos' ? (
        photos.length ? (
          <>
            {isPhone ? (
              <span style={{ ...GROUP_HEAD, padding: '0 16px', margin: '0 0 -6px' }}>{t(photos.length === 1 ? 'reviews.photosWaitingOne' : 'reviews.photosWaitingN', { n: photos.length })}</span>
            ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '10px 16px' }}>
              <div style={{ flex: '1 1 260px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 17, fontWeight: 500, lineHeight: '24px' }}>{t(photos.length === 1 ? 'reviews.photosWaitingOne' : 'reviews.photosWaitingN', { n: photos.length })}</span>
              </div>
            </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: isPhone ? 'repeat(2, minmax(0, 1fr))' : 'repeat(auto-fill,minmax(min(100%,160px),1fr))', gap: isPhone ? 10 : 12 }}>{paged.photos.rows.map(photoTile)}</div>
          </>
        ) : empty('photos')
      ) : null}
      {current === 'history' ? (
        isPhone ? (
          <Group pad={0} gap={0}>
            {paged.history.rows.map(historyRow)}
            {!history.length ? <EmptyState icon="history" title={t('approvals.none.history')} /> : null}
          </Group>
        ) : (
        <div style={{ background: '#FFFFFF', border: '1px solid #EFE7DC', borderRadius: 16, boxShadow: 'var(--card-shadow)', overflow: 'hidden', padding: '0 clamp(18px, 3vw, 28px) 6px' }}>
          {paged.history.rows.map(historyRow)}
          {!history.length ? <EmptyState icon="history" title={t('approvals.none.history')} /> : null}
        </div>
        )
      ) : null}
      {activePager.pages > 1 ? <Pager page={activePager.page} pages={activePager.pages} onPage={activePager.setPage} label={t('approvals.pagerRows')} /> : null}
      </>) : null}

      {showBar && isPhone ? (
        // round 6, phone: a bottom toolbar pinned like a PhoneScreen footer: the selection text buttons, then the two main actions side by side
        <div style={{ position: 'sticky', bottom: 0, zIndex: 4, margin: '0 -16px -20px', padding: '8px 16px 14px', background: '#F5F5F3', borderTop: '1px solid #E6E1DA', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, minHeight: 34 }}>
            {selected.length < here.length ? <button type="button" className="cp-press" onClick={() => setSel(here.map((x) => x.id))} style={{ ...textBtn, padding: '0 8px 0 0' }}>{t('reviews.selectAll', { n: here.length })}</button> : null}
            {selected.length ? <button type="button" className="cp-press" onClick={() => setSel([])} style={textBtn}>{t('reviews.clearSelection')}</button> : null}
            <span aria-live="polite" style={{ marginLeft: 'auto', fontSize: 13, color: '#6B6259', lineHeight: 1.4 }}>{selected.length ? t('reviews.selectedN', { n: selected.length }) : ''}</span>
          </div>
          {current === 'photos' ? <Toggle on={notify} onClick={() => setNotify(!notify)} label={t('reviews.notifyFamilies')} /> : null}
          <div style={{ display: 'flex', gap: 10 }}>
            <Button size={48} icon="check" disabled={!selected.length || bulkBusy} onClick={() => approveSelected(current as ApprovalType, selected)} style={{ flex: '1 1 0' }}>{t('reviews.approvePhotos', { n: selected.length })}</Button>
            <Button size={48} variant="secondary" icon="close" disabled={!selected.length || bulkBusy} onClick={() => askReject(current as ApprovalType, selected)} style={{ flex: '1 1 0' }}>{t('reviews.rejectPhotos', { n: selected.length })}</Button>
          </div>
        </div>
      ) : null}
      {showBar && !isPhone ? (
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
