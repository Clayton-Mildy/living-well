// Reviews (management): customer changes sent by other staff wait here. Each request shows who sent it, when, the section and the
// old → new values; management approves, or rejects with a note. Health changes that were applied at once are listed as "Applied, review"
// to acknowledge or revert. Handled requests stay in the history. The Photos section holds the photos taken by non-management staff (activity
// photos, profile photos, the kitchen's lunch photos): select some or all, approve them (with the "Notify families" switch) or reject with a reason.
// /reviews?tab=photos opens the Photos section.
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { actorName, memberName, memberShort, type ChangeRequest, type Photo } from '@cp/shared';
import { allPendingReviews, appliedReviews, handledReviews, pendingPhotos, photoReviewKind, tabForSection } from '@cp/shared/rules/members';
import { Avatar, Button, CardHead, Dialog, EmptyState, Icon, Note, PageHead, Pager, PhotoImg, TextField, Toggle, chipStyle, usePaged, FONT_BODY, FONT_SMALL } from '../../components/ui';
import { useDevice, padFor } from '../../hooks/useDevice';
import { useAct } from '../../lib/act';
import { useNow } from '../../lib/clock';
import { useFmt, useT } from '../../lib/i18n';
import { useClub } from '../../store/replica';
import { useUi } from '../../store/ui';
import { PhotoViewer } from '../activity/PhotoViewer';
import { crMemberName, whenText } from './lib';
import { describeCr } from './reviewDiff';
import { DiffList } from './profile/parts';
import { memberPhoto } from '../../lib/media';

type View = 'pending' | 'photos' | 'applied' | 'history';
const STATUS_ICON: Record<string, string> = { approved: 'task_alt', rejected: 'block', withdrawn: 'undo', superseded: 'swap_horiz', acknowledged: 'done_all', reverted: 'undo' };

export function Reviews() {
  const s = useClub();
  const t = useT();
  const fmt = useFmt();
  const act = useAct();
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const { today } = useNow();
  const { device, isPhone } = useDevice();
  const pending = useMemo(() => allPendingReviews(s).slice().reverse(), [s]);
  const applied = useMemo(() => appliedReviews(s), [s]);
  const handled = useMemo(() => handledReviews(s), [s]);
  const photos = useMemo(() => pendingPhotos(s), [s]);
  const [view, setView] = useState<View | null>(null);
  const linked = (['pending', 'photos', 'applied', 'history'] as const).find((k) => k === sp.get('tab')); // a deep link: /reviews?tab=photos
  const current: View = view ?? linked ?? (pending.length ? 'pending' : photos.length ? 'photos' : applied.length ? 'applied' : 'pending');
  const pagedPending = usePaged(pending, 5, 'pending');
  const pagedApplied = usePaged(applied, 5, 'applied');
  const pagedHandled = usePaged(handled, 10, 'history');
  const pagedPhotos = usePaged(photos, 12, 'photos');
  const [sel, setSel] = useState<string[]>([]);
  const [notify, setNotify] = useState(true);
  const [rejectPhotos, setRejectPhotos] = useState(false);
  const [reason, setReason] = useState('');
  const [reasonTried, setReasonTried] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [viewer, setViewer] = useState<string | null>(null);
  // photos that were approved or rejected (here or by someone else) drop out of the selection
  const selected = useMemo(() => photos.filter((p) => sel.includes(p.id)).map((p) => p.id), [photos, sel]);
  const showBar = current === 'photos' && photos.length > 0;
  const pin = useUi((u) => u.pin);
  useEffect(() => { if (!showBar) return; pin(1); return () => pin(-1); }, [showBar, pin]);
  const [conflict, setConflict] = useState<Record<string, string>>({});
  const [reject, setReject] = useState<ChangeRequest | null>(null);
  const [revert, setRevert] = useState<ChangeRequest | null>(null);
  const [note, setNote] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  const who = (cr: ChangeRequest) => {
    const a = cr.submittedBy;
    const role = a.startsWith('staff:') ? s.staff[a.slice(6)]?.role : a.startsWith('family:') ? 'family' : '';
    return `${actorName(s, a)}${role ? ` · ${t('roles.' + role)}` : ''}`;
  };
  const sectionLine = (cr: ChangeRequest, d = describeCr(cr, s, t, fmt)) => `${d.title} · ${who(cr)} · ${whenText(fmt.fds, today, cr.createdAt, t)}`;
  const submitterNote = (cr: ChangeRequest) => (cr.status === 'pending' ? cr.note || (cr.input as { note?: string } | undefined)?.note : (cr.input as { note?: string } | undefined)?.note) || '';

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

  const toggleSel = (id: string) => setSel((x) => (x.includes(id) ? x.filter((y) => y !== id) : [...x, id]));
  const approvePhotos = async () => {
    if (!selected.length || photoBusy) return;
    const n = selected.length;
    setPhotoBusy(true);
    const key = `reviews.photosApproved${notify ? 'Told' : ''}${n === 1 ? 'One' : 'N'}`;
    const r = await act('photo.approve', { photoIds: selected, notify }, { ok: t(key, { n }) });
    setPhotoBusy(false);
    if (r.ok) setSel([]);
  };
  const doRejectPhotos = async () => {
    setReasonTried(true);
    if (!selected.length || !reason.trim() || photoBusy) return;
    const n = selected.length;
    setPhotoBusy(true);
    const r = await act('photo.reject', { photoIds: selected, reason: reason.trim() }, { ok: t(n === 1 ? 'reviews.photosRejectedOne' : 'reviews.photosRejectedN', { n }) });
    setPhotoBusy(false);
    if (r.ok) { setRejectPhotos(false); setReason(''); setReasonTried(false); setSel([]); }
  };
  const photoNames = (ph: Photo) => {
    if (ph.kind === 'lunch') return t('reviews.photoKind.lunch');
    const names = ph.memberIds.filter((id) => s.members[id]).map((id) => memberShort(s.members[id]));
    return names.length ? names.slice(0, 3).join(', ') + (names.length > 3 ? ` +${names.length - 3}` : '') : t('reviews.photoKind.' + photoReviewKind(ph));
  };
  const photoTile = (ph: Photo) => {
    const on = selected.includes(ph.id);
    const names = photoNames(ph);
    return (
      <div key={ph.id} data-photo-review={ph.id} data-selected={on} style={{ background: '#FFFFFF', border: on ? '2px solid #75624B' : '1px solid #DBD7D6', borderRadius: 20, overflow: 'hidden', display: 'flex', flexDirection: 'column', margin: on ? 0 : 1 }}>
        <div style={{ position: 'relative', aspectRatio: '1', background: '#E8E1D8' }}>
          <button type="button" onClick={() => setViewer(ph.id)} aria-label={t('reviews.openPhoto', { n: names })} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none', padding: 0, background: 'transparent', cursor: 'pointer' }}><PhotoImg photo={ph} /></button>
          <button type="button" role="checkbox" aria-checked={on} onClick={() => toggleSel(ph.id)} aria-label={t('reviews.selectPhoto', { n: names })} style={{ position: 'absolute', top: 0, left: 0, width: 52, height: 52, border: 'none', padding: 0, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span aria-hidden="true" style={{ width: 28, height: 28, borderRadius: 9, border: '2px solid #FFFFFF', background: on ? '#75624B' : 'rgba(40,40,40,0.4)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.25)' }}>{on ? <Icon name="check" size={20} /> : null}</span>
          </button>
          {ph.media === 'video' ? <span aria-hidden="true" style={{ position: 'absolute', right: 8, top: 8, width: 28, height: 28, borderRadius: 999, background: 'rgba(40,40,40,0.55)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="videocam" size={18} fill={1} /></span> : null}
        </div>
        <div style={{ padding: '10px 12px 12px', display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <span style={{ fontSize: 16, fontWeight: 500, lineHeight: '22px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'anywhere' }}>{names}</span>
          <span style={{ fontSize: FONT_SMALL, color: '#6A6967', lineHeight: 1.35 }}>{names === t('reviews.photoKind.' + photoReviewKind(ph)) ? '' : `${t('reviews.photoKind.' + photoReviewKind(ph))} · `}{whenText(fmt.fds, today, `${ph.date}T${ph.time}`, t)}</span>
          <span style={{ fontSize: FONT_SMALL, color: '#6A6967', lineHeight: 1.35 }}>{t('reviews.photoBy', { n: actorName(s, ph.createdBy) })}</span>
        </div>
      </div>
    );
  };

  const card = (cr: ChangeRequest, kind: 'pending' | 'applied') => {
    const d = describeCr(cr, s, t, fmt);
    const memberName0 = crMemberName(s, cr);
    const m = cr.target.memberId ? s.members[cr.target.memberId] : undefined;
    const sn = submitterNote(cr);
    return (
      <div key={cr.id} data-cr={cr.id} role="group" aria-label={`${d.title} ${memberName0}`} style={{ background: '#FFFFFF', border: '1px solid #DBD7D6', borderRadius: 24, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar name={memberName0 || d.title} tone={m?.photoTone} src={memberPhoto(m)} size={44} />
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {m ? (
              <button type="button" onClick={() => navigate(`/members/${m.id}/${tabForSection(cr.section)}`)} style={{ alignSelf: 'flex-start', border: 'none', background: 'transparent', padding: 0, margin: 0, color: '#282828', fontSize: 17, fontWeight: 500, lineHeight: '24px', cursor: 'pointer', textAlign: 'left', fontFamily: 'Inter', textDecoration: 'underline', textUnderlineOffset: 3, textDecorationColor: '#CAB8A2' }}>{memberName(m)}</button>
            ) : <span style={{ fontSize: 17, fontWeight: 500, lineHeight: '24px' }}>{memberName0 || d.title}</span>}
            <span style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>{sectionLine(cr, d)}</span>
          </div>
          <span style={{ height: 30, padding: '0 12px 0 8px', borderRadius: 999, background: kind === 'pending' ? '#F6ECD6' : '#F4F0EE', color: '#7A5510', fontSize: FONT_SMALL, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', flex: 'none' }}>
            <Icon name={kind === 'pending' ? 'hourglass_top' : 'fact_check'} size={18} fill={1} />
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

  const pg = current === 'pending' ? pagedPending : pagedApplied;
  const activePager = current === 'pending' ? pagedPending : current === 'applied' ? pagedApplied : current === 'photos' ? pagedPhotos : pagedHandled;
  const pagerLabel = current === 'photos' ? t('reviews.photosPager') : current === 'history' ? t('reviews.pagerHistory') : current === 'pending' ? t('reviews.pagerPending') : t('reviews.pagerApplied');
  return (
    <div style={{ padding: padFor(device), display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 980 }}>
      <PageHead size={40} eyebrow={t('nav.g_front')} title={t('nav.reviews')} sub={t('reviews.sub')} />
      <div role="tablist" aria-label={t('nav.reviews')} className="cp-tabrow" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {([['pending', t('reviews.tabPending'), pending.length], ['photos', t('reviews.tabPhotos'), photos.length], ['applied', t('reviews.tabApplied'), applied.length], ['history', t('reviews.tabHistory'), handled.length]] as [View, string, number][]).map(([k, label, n]) => {
          const c = chipStyle(current === k, false);
          return (
            <button key={k} type="button" role="tab" aria-selected={current === k} className="cp-chip" onClick={() => setView(k)} style={{ height: 44, padding: '0 18px', borderRadius: 999, border: c.bd, background: c.bg, color: c.fg, fontSize: 16, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'Inter' }}>{label}{' · '}{n}</button>
          );
        })}
      </div>
      {current === 'applied' && applied.length ? <div className="cp-hide-phone" style={{ fontSize: 16, lineHeight: '22px', color: '#6A6967' }}>{t('reviews.appliedSub')}</div> : null}
      {current === 'pending' || current === 'applied' ? (
        pg.rows.length ? <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>{pg.rows.map((cr) => card(cr, current === 'pending' ? 'pending' : 'applied'))}</div> : (
          <div style={{ background: '#FFFFFF', border: '1px solid #DBD7D6', borderRadius: 24 }}>
            <EmptyState icon="done_all" title={current === 'pending' ? t('reviews.nonePending') : t('reviews.noneApplied')} sub={current === 'pending' ? t('reviews.nonePendingSub') : t('reviews.noneAppliedSub')} />
          </div>
        )
      ) : null}
      {current === 'photos' ? (
        photos.length ? (
          <>
            <div style={{ background: '#FFFFFF', border: '1px solid #DBD7D6', borderRadius: 24, padding: '16px 20px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '10px 16px' }}>
              <div style={{ flex: '1 1 260px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 17, fontWeight: 500, lineHeight: '24px' }}>{t(photos.length === 1 ? 'reviews.photosWaitingOne' : 'reviews.photosWaitingN', { n: photos.length })}</span>
                <span className="cp-hide-phone" style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>{t('reviews.photosSub')}</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                <span aria-live="polite" style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>{selected.length ? t('reviews.selectedN', { n: selected.length }) : ''}</span>
                {selected.length < photos.length ? <Button variant="secondary" size={44} icon="select_all" onClick={() => setSel(photos.map((x) => x.id))}>{t('reviews.selectAll', { n: photos.length })}</Button> : null}
                {selected.length ? <Button variant="ghost" size={44} onClick={() => setSel([])}>{t('reviews.clearSelection')}</Button> : null}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,160px),1fr))', gap: 12 }}>{pagedPhotos.rows.map(photoTile)}</div>
          </>
        ) : (
          <div style={{ background: '#FFFFFF', border: '1px solid #DBD7D6', borderRadius: 24 }}>
            <EmptyState icon="photo_library" title={t('reviews.nonePhotos')} sub={t('reviews.nonePhotosSub')} />
          </div>
        )
      ) : null}
      {current === 'history' ? (
        <div style={{ background: '#FFFFFF', border: '1px solid #DBD7D6', borderRadius: 24, overflow: 'hidden' }}>
          <CardHead title={t('reviews.tabHistory')} meta={t('reviews.historySub')} />
          {pagedHandled.rows.map((cr) => {
            const d = describeCr(cr, s, t, fmt);
            const isOpen = open === cr.id;
            const reviewer = cr.reviewedBy ? actorName(s, cr.reviewedBy) : '';
            const sn = submitterNote(cr);
            return (
              <div key={cr.id} style={{ borderTop: '1px solid #EFECEA', padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <Icon name={STATUS_ICON[cr.status] || 'history'} size={22} color={cr.status === 'rejected' ? '#AF4B2F' : '#75624B'} fill={1} />
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.4 }}>{[crMemberName(s, cr), d.title].filter(Boolean).join(' · ')}</span>
                    <span style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>
                      {t('reviews.status.' + cr.status)}{reviewer ? ` · ${reviewer}` : ''} · {whenText(fmt.fds, today, cr.reviewedAt || cr.createdAt, t)} · {t('reviews.sentBy', { n: who(cr) })}
                    </span>
                    {cr.note && cr.status !== 'pending' ? <span style={{ fontSize: FONT_BODY, lineHeight: 1.4 }}>{t('reviews.reviewerNote')}: {cr.note}</span> : null}
                  </div>
                  <Button variant="ghost" size={44} onClick={() => setOpen(isOpen ? null : cr.id)}>{isOpen ? t('common.hide') : t('reviews.details')}</Button>
                </div>
                {isOpen ? (<div style={{ paddingLeft: 34 }}><DiffList d={d} t={t} proposed={false} />{sn ? <div style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4, paddingTop: 6 }}>{t('reviews.noteFrom', { n: actorName(s, cr.submittedBy) })}: {sn}</div> : null}</div>) : null}
              </div>
            );
          })}
          {!handled.length ? <EmptyState icon="history" title={t('reviews.noneHistory')} /> : null}
        </div>
      ) : null}
      {activePager.pages > 1 ? <Pager page={activePager.page} pages={activePager.pages} onPage={activePager.setPage} label={pagerLabel} /> : null}
      {showBar ? (
        <div style={{ position: 'sticky', bottom: 0, zIndex: 4, margin: '0 -4px', padding: '12px 4px 14px', background: 'linear-gradient(to top, #F6F5F5 72%, rgba(246,245,245,0))', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: '1 1 260px', minWidth: 0 }}><Toggle on={notify} onClick={() => setNotify(!notify)} label={t('reviews.notifyFamilies')} sub={isPhone ? undefined : t('reviews.notifyFamiliesSub')} /></div>
          <Button size={isPhone ? 48 : 56} icon="check" disabled={!selected.length || photoBusy} onClick={approvePhotos} style={{ flex: '1 1 140px' }}>{t('reviews.approvePhotos', { n: selected.length })}</Button>
          <Button size={isPhone ? 48 : 56} variant="secondary" icon="close" disabled={!selected.length || photoBusy} onClick={() => { setReason(''); setReasonTried(false); setRejectPhotos(true); }} style={{ flex: '1 1 140px' }}>{t('reviews.rejectPhotos', { n: selected.length })}</Button>
        </div>
      ) : null}
      {viewer ? <PhotoViewer photos={photos} startId={viewer} onClose={() => setViewer(null)} audience="staff" /> : null}
      <Dialog open={rejectPhotos} onClose={() => setRejectPhotos(false)} eyebrow={t('reviews.reject')} title={t(selected.length === 1 ? 'reviews.rejectPhotosTitleOne' : 'reviews.rejectPhotosTitleN', { n: selected.length })} maxWidth={520}
        footer={<><Button variant="secondary" onClick={() => setRejectPhotos(false)}>{t('common.cancel')}</Button><Button variant="danger" icon="close" disabled={photoBusy} onClick={doRejectPhotos}>{t('reviews.reject')}</Button></>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flexShrink: 0 }}>
          <div style={{ fontSize: 16, lineHeight: '22px' }}>{t('reviews.rejectPhotosSub')}</div>
          <TextField label={t('reviews.rejectPhotosReason')} value={reason} onChange={setReason} multiline rows={3} autoFocus error={reasonTried && !reason.trim() ? t('err.noteRequired') : false} name="rejectPhotosReason" />
        </div>
      </Dialog>
      <Dialog open={!!reject} onClose={() => setReject(null)} eyebrow={t('reviews.reject')} title={reject ? describeCr(reject, s, t, fmt).title : ''} maxWidth={520}
        footer={<><Button variant="secondary" onClick={() => setReject(null)}>{t('common.cancel')}</Button><Button variant="danger" icon="close" disabled={busy === reject?.id} onClick={doReject}>{t('reviews.reject')}</Button></>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flexShrink: 0 }}>
          <div style={{ fontSize: 16, lineHeight: '22px' }}>{t('reviews.rejectSub')}</div>
          <TextField label={t('reviews.rejectNote')} value={note} onChange={setNote} multiline rows={3} autoFocus error={tried && !note.trim() ? t('err.noteRequired') : false} name="rejectNote" />
        </div>
      </Dialog>
      <Dialog open={!!revert} onClose={() => setRevert(null)} eyebrow={t('reviews.revert')} title={revert ? describeCr(revert, s, t, fmt).title : ''} maxWidth={520}
        footer={<><Button variant="secondary" onClick={() => setRevert(null)}>{t('common.cancel')}</Button><Button icon="undo" disabled={busy === revert?.id} onClick={() => doRevert(!!(revert && conflict[revert.id] !== undefined))}>{revert && conflict[revert.id] !== undefined ? t('reviews.revertAnyway') : t('reviews.revert')}</Button></>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flexShrink: 0 }}>
          <div style={{ fontSize: 16, lineHeight: '22px' }}>{t('reviews.revertSub')}</div>
          {revert && conflict[revert.id] !== undefined ? <Note tone="ochre" icon="warning">{t('err.reviewConflict', { fields: conflict[revert.id] })}</Note> : null}
          <TextField label={t('reviews.revertNote')} value={note} onChange={setNote} multiline rows={2} />
        </div>
      </Dialog>
    </div>
  );
}
