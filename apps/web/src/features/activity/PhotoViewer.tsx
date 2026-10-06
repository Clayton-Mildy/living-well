// Full-screen photo / video viewer (design OvPhoto). Family: Save and Share (demo toasts). Staff: tags, hide from families, show again, remove (activity and management).
// Photos waiting for approval show to staff only (with a badge); management approves or rejects them here too.
// It follows the live rows, so a retag, hide or remove shows at once and removed photos drop out of the carousel.
import { useEffect, useMemo, useRef, useState, type KeyboardEvent as RKE } from 'react';
import { useResetOn } from '../../lib/useResetOn';
import { createPortal } from 'react-dom';
import { live, isPendingRow, memberShort, staffCall, type Photo } from '@cp/shared';
import { fmtDuration } from '@cp/shared/rules/activity';
import { Button, Chip, Dialog, Icon, Note, PhotoImg, Sheet, TextField, Toggle, FONT_BODY } from '../../components/ui';
import { useT, useFmt, useLang } from '../../lib/i18n';
import { useClub } from '../../store/replica';
import { useMe } from '../../lib/me';
import { useAct } from '../../lib/act';
import { say } from '../../store/ui';
import { MemberPicker } from './MemberPicker';
import { PHOTO_REASONS, photoCaption, reasonText } from './lib';

type Sheets = null | 'tags' | 'hide' | 'remove' | 'approve' | 'reject';
const ctl = { width: 44, height: 44, borderRadius: 999, border: 'none', background: 'rgba(255,255,255,0.12)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flex: 'none', padding: 0 } as const;

export function PhotoViewer({ photos, startId, onClose, audience }: { photos: Photo[]; startId: string; onClose: () => void; audience: 'staff' | 'family' }) {
  const s = useClub();
  const t = useT();
  const lang = useLang();
  const { fdl } = useFmt();
  const { user, role } = useMe();
  const act = useAct();
  const family = audience === 'family';
  const canModerate = !family && (role === 'activity' || role === 'mgmt');
  const canReview = !family && role === 'mgmt';

  // follow the live rows; families only ever see visible photos that are still in their data
  const list = useMemo(
    () => photos.map((p) => s.photos[p.id] ?? p).filter((p) => (family ? !!s.photos[p.id] && p.visibility === 'visible' && !p.deletedAt : p.visibility !== 'removed' && !p.deletedAt)),
    [photos, s.photos, family],
  );
  const [idx, setIdx] = useState(() => Math.max(0, list.findIndex((p) => p.id === startId)));
  useEffect(() => { const i = list.findIndex((p) => p.id === startId); if (i >= 0) setIdx(i); }, [startId]); // eslint-disable-line react-hooks/exhaustive-deps
  const n = list.length;
  const i = Math.min(idx, Math.max(0, n - 1));
  const p = list[i];
  useEffect(() => { if (!n) onClose(); }, [n]); // eslint-disable-line react-hooks/exhaustive-deps

  const [sheet, setSheet] = useState<Sheets>(null);
  // Feedback for actions taken inside the viewer shows in the viewer itself: the shell's toast sits under full-screen overlays.
  const [toast, setToast] = useState<null | { id: number; text: string; tone?: 'error'; action?: { label: string; run: () => void } }>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();
  const alive = useRef(true);
  const flash = (text: string, o: { tone?: 'error'; action?: { label: string; run: () => void } } = {}) => {
    // the viewer closes by itself when its last photo leaves the list (e.g. un-hiding while filtered on "Hidden"): then the shell's toast takes over
    if (!alive.current) { say(text, o); return; }
    clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), text, ...o });
    toastTimer.current = setTimeout(() => setToast(null), o.action ? 7000 : 4500);
  };
  useEffect(() => { alive.current = true; return () => { alive.current = false; clearTimeout(toastTimer.current); }; }, []);
  const [playing, setPlaying] = useState<string | null>(null);
  const [playKey, setPlayKey] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const root = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const stop = () => { clearTimeout(timer.current); setPlaying(null); };
  const go = (d: number) => { stop(); setIdx((i + d + n) % n); };
  const toggle = (x: Photo) => {
    clearTimeout(timer.current);
    if (playing === x.id) { setPlaying(null); return; }
    setPlaying(x.id);
    setPlayKey(Date.now());
    timer.current = setTimeout(() => setPlaying(null), (x.durationSec || 10) * 1000 + 300);
  };

  // focus, scroll lock, keyboard
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    closeBtn.current?.focus({ preventScroll: true });
    const body = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = body; prev?.focus?.({ preventScroll: true }); };
  }, []);
  const keys = useRef({ sheet, go, onClose });
  keys.current = { sheet, go, onClose };
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const k = keys.current;
      if (k.sheet) return; // a sheet on top handles its own keys
      if (e.key === 'Escape') { e.stopPropagation(); k.onClose(); }
      else if (e.key === 'ArrowLeft') k.go(-1);
      else if (e.key === 'ArrowRight') k.go(1);
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, []);
  const trap = (e: RKE<HTMLDivElement>) => {
    if (e.key !== 'Tab' || !root.current) return;
    const items = Array.from(root.current.querySelectorAll<HTMLElement>('button, [href], input, [tabindex]:not([tabindex="-1"])')).filter((x) => !x.hasAttribute('disabled') && getComputedStyle(x).visibility !== 'hidden');
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  if (!p) return null;
  const isVideo = p.media === 'video';
  const real = isVideo && !!p.mediaId; // a recorded or uploaded clip plays in a real <video controls>; seed videos without a file keep the simulated player
  const live1 = playing === p.id;
  const caption = photoCaption(s, p, t, lang);
  const by = staffCall(s.staff[p.takenBy]) || t('activity.theClub');
  const names = (ids: string[]) => ids.map((id) => (s.members[id] ? memberShort(s.members[id]) : '')).filter(Boolean).join(', ');
  const own = user?.kind === 'family' ? user.memberIds : [];
  const subject = family ? p.memberIds.find((id) => own.includes(id)) ?? p.memberIds[0] : undefined;
  const others = family ? names(p.memberIds.filter((id) => id !== subject)) : '';
  const meta = `${fdl(p.date)} · ${p.time}` + (family ? (others ? ' · ' + t('activity.withNames', { names: others }) : '') : p.memberIds.length ? ' · ' + t('activity.tagged', { names: names(p.memberIds) }) : '');
  const hidden = p.visibility === 'hidden';
  const pending = p.visibility === 'pending';
  const modBy = hidden && p.moderated ? staffCall(s.staff[p.moderated.by]) : '';

  const restore = async (id: string, text: string) => {
    const r = await act('photo.restore', { photoId: id }, { silent: true });
    flash(r.ok ? text : t(r.code, r.params), r.ok ? {} : { tone: 'error' });
  };
  // after a removal: undo for a few seconds
  const removed = (id: string) => {
    flash(t('activity.removedToast'), { action: { label: t('common.undo'), run: () => { void restore(id, t('activity.restoredToast')); } } });
  };

  return createPortal(
    <>
      <div ref={root} role="dialog" aria-modal="true" aria-label={caption} tabIndex={-1} onKeyDown={trap} style={{ position: 'fixed', inset: 0, zIndex: 50, background: '#1F1C19', display: 'flex', flexDirection: 'column', color: '#FFFFFF', outline: 'none' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px' }}>
          <span style={{ fontSize: 16, fontVariantNumeric: 'tabular-nums', lineHeight: 1.4 }}>{i + 1} / {n}</span>
          <button ref={closeBtn} type="button" onClick={onClose} aria-label={t('common.close')} style={ctl}><Icon name="close" size={24} /></button>
        </div>
        <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '0 8px' }}>
          <button type="button" onClick={() => go(-1)} aria-label={t('activity.prevPhoto')} style={{ ...ctl, visibility: n > 1 ? 'visible' : 'hidden' }}><Icon name="chevron_left" size={24} /></button>
          <div style={{ flex: 1, maxWidth: 640, aspectRatio: '4/5', maxHeight: '100%', borderRadius: 18, background: '#E8E1D8', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#75624B' }}>
            <span style={{ position: 'absolute', inset: 0 }}><PhotoImg photo={p} alt={caption} controls={real} /></span>
            <span style={{ position: 'relative', marginTop: 'auto', marginBottom: real ? 64 : 16, pointerEvents: real ? 'none' : undefined, height: 30, padding: '0 12px', borderRadius: 999, background: '#FFFFFF', fontSize: FONT_BODY, color: '#282828', display: 'flex', alignItems: 'center' }}>{isVideo ? t('activity.videoFrom') : t('activity.photoFrom')}{' '}{by}</span>
            {real ? (
              <span style={{ position: 'absolute', top: 12, left: 12, height: 30, padding: '0 12px', borderRadius: 999, background: '#282828', color: '#FFFFFF', fontSize: 14, display: 'flex', alignItems: 'center', whiteSpace: 'nowrap', pointerEvents: 'none' }}>{p.durationSec ? t('activity.videoLabel', { d: fmtDuration(p.durationSec) }) : t('activity.video')}</span>
            ) : isVideo ? (
              <>
                <button type="button" onClick={() => toggle(p)} aria-label={live1 ? t('activity.pause') : t('activity.play')} style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 76, height: 76, borderRadius: 999, border: 'none', background: 'rgba(40,40,40,0.6)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <Icon name={live1 ? 'pause' : 'play_arrow'} size={44} fill={1} color="#FFFFFF" />
                </button>
                <span style={{ position: 'absolute', top: 12, left: 12, height: 30, padding: '0 12px', borderRadius: 999, background: '#282828', color: '#FFFFFF', fontSize: 14, display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
                  {live1 ? t('activity.playingLabel', { d: fmtDuration(p.durationSec) }) : t('activity.videoLabel', { d: fmtDuration(p.durationSec) })}
                </span>
                {live1 ? <div key={'pg' + playKey} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 6, background: '#FFFFFF', transformOrigin: 'left center', animation: `cpProg ${p.durationSec || 10}s linear forwards` }} /> : null}
              </>
            ) : null}
            {!family && hidden ? (
              <span style={{ position: 'absolute', top: 12, right: 12, height: 30, padding: '0 12px 0 8px', borderRadius: 999, background: '#282828', color: '#FFFFFF', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                <Icon name="visibility_off" size={18} fill={1} />{t('activity.hiddenBadge')}
              </span>
            ) : null}
            {!family && pending ? (
              <span style={{ position: 'absolute', top: 12, right: 12, height: 30, padding: '0 12px 0 8px', borderRadius: 999, background: '#F6ECD6', color: '#7A5510', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                <Icon name="hourglass_top" size={18} fill={1} />{t('activity.pendingBadge')}
              </span>
            ) : null}
          </div>
          <button type="button" onClick={() => go(1)} aria-label={t('activity.nextPhoto')} style={{ ...ctl, visibility: n > 1 ? 'visible' : 'hidden' }}><Icon name="chevron_right" size={24} /></button>
        </div>
        <div style={{ padding: '16px 20px 28px', display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '48%', overflowY: 'auto' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 18 }}>{caption}</span>
            <span style={{ fontSize: FONT_BODY, color: '#E8E1D8', lineHeight: 1.4 }}>{meta}</span>
            {!family && pending ? <span style={{ fontSize: FONT_BODY, color: '#E8E1D8', lineHeight: 1.4 }}>{t('activity.pendingMeta', { name: by })}</span> : null}
            {!family && hidden && p.moderated ? <span style={{ fontSize: FONT_BODY, color: '#E8E1D8', lineHeight: 1.4 }}>{t('activity.hiddenBy', { name: modBy || t('activity.theClub') })}{p.moderated.reason ? ' · ' + reasonText(p.moderated.reason, t) : ''}</span> : null}
          </div>
          {family ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => flash(t('activity.savedPhoto'))} style={{ flex: 1, height: 48, borderRadius: 999, border: 'none', background: '#FFFFFF', color: '#282828', fontSize: 16, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer' }}>
                <Icon name="download" size={20} />{t('common.save')}
              </button>
              <button type="button" onClick={() => flash(t('activity.sharedPhoto'))} style={{ flex: 1, height: 48, borderRadius: 999, border: '1px solid #FFFFFF', background: 'transparent', color: '#FFFFFF', fontSize: 16, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer' }}>
                <Icon name="share" size={20} />{t('common.share')}
              </button>
            </div>
          ) : canModerate ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {pending && canReview ? (
                <>
                  <button type="button" onClick={() => setSheet('approve')} style={{ flex: '1 1 140px', height: 48, borderRadius: 999, border: 'none', background: '#E6EFE8', color: '#3D6B4F', fontSize: 16, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    <Icon name="check_circle" size={20} fill={1} />{t('activity.approve')}
                  </button>
                  <button type="button" onClick={() => setSheet('reject')} style={{ flex: '1 1 140px', height: 48, borderRadius: 999, border: '1px solid #FFFFFF', background: 'transparent', color: '#FFFFFF', fontSize: 16, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    <Icon name="block" size={20} />{t('activity.reject')}
                  </button>
                </>
              ) : null}
              <button type="button" onClick={() => setSheet('tags')} style={{ flex: '1 1 140px', height: 48, borderRadius: 999, border: 'none', background: '#FFFFFF', color: '#282828', fontSize: 16, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                <Icon name="sell" size={20} />{t('activity.editTags')}
              </button>
              {!pending ? (
                <button type="button" onClick={() => (hidden ? void restore(p.id, t('activity.shownToast')) : setSheet('hide'))} style={{ flex: '1 1 180px', height: 48, borderRadius: 999, border: '1px solid #FFFFFF', background: 'transparent', color: '#FFFFFF', fontSize: 16, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  <Icon name={hidden ? 'visibility' : 'visibility_off'} size={20} />{hidden ? t('activity.showToFamilies') : t('activity.hideFromFamilies')}
                </button>
              ) : null}
              <button type="button" onClick={() => setSheet('remove')} style={{ flex: '1 1 140px', height: 48, borderRadius: 999, border: 'none', background: '#F7E4DD', color: '#AF4B2F', fontSize: 16, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                <Icon name="delete" size={20} />{t('activity.removePhoto')}
              </button>
            </div>
          ) : null}
        </div>
      </div>
      {canModerate ? (
        <>
          <TagsSheet open={sheet === 'tags'} onClose={() => setSheet(null)} photo={p} flash={flash} />
          <ReasonSheet kind="hide" open={sheet === 'hide'} onClose={() => setSheet(null)} photo={p} flash={flash} removed={removed} />
          <ReasonSheet kind="remove" open={sheet === 'remove'} onClose={() => setSheet(null)} photo={p} flash={flash} removed={removed} />
          {canReview ? (
            <>
              <ApproveSheet open={sheet === 'approve'} onClose={() => setSheet(null)} photo={p} flash={flash} />
              <ReasonSheet kind="reject" open={sheet === 'reject'} onClose={() => setSheet(null)} photo={p} flash={flash} removed={removed} />
            </>
          ) : null}
        </>
      ) : null}
      {toast ? (
        <div role="status" aria-live="polite" key={toast.id} style={{ position: 'fixed', left: '50%', top: 76, transform: 'translateX(-50%)', zIndex: 80, width: 'max-content', maxWidth: 'calc(100% - 32px)', padding: '14px 20px', borderRadius: 20, background: toast.tone === 'error' ? '#AF4B2F' : '#282828', border: '1px solid rgba(255,255,255,0.28)', color: '#FFFFFF', fontSize: 16, lineHeight: '22px', display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 12px 32px rgba(0,0,0,0.35)', animation: 'cpUp .22s ease-out' }}>
          <Icon name={toast.tone === 'error' ? 'error' : 'check_circle'} size={22} fill={1} color={toast.tone === 'error' ? '#FFFFFF' : '#CAB8A2'} />
          <span style={{ flex: 1 }}>{toast.text}</span>
          {toast.action ? <button type="button" onClick={() => { toast.action!.run(); setToast(null); }} style={{ marginLeft: 6, height: 36, padding: '0 14px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.5)', background: 'transparent', color: '#FFFFFF', fontWeight: 600, fontSize: 15, cursor: 'pointer', fontFamily: 'Inter' }}>{toast.action.label}</button> : null}
        </div>
      ) : null}
    </>,
    document.body,
  );
}

/** Who is in the photo: toggle members, save as one retag. */
function TagsSheet({ open, onClose, photo, flash }: { open: boolean; onClose: () => void; photo: Photo; flash: (text: string) => void }) {
  const s = useClub();
  const t = useT();
  const act = useAct();
  const [sel, setSel] = useState<string[]>(photo.memberIds);
  const [err, setErr] = useState('');
  useResetOn(open ? photo.id : null, () => { setSel(photo.memberIds); setErr(''); });
  const members = useMemo(() => live(s.members).filter((m) => !isPendingRow(m)).sort((a, b) => a.firstName.localeCompare(b.firstName)), [s.members]);
  const same = sel.length === photo.memberIds.length && sel.every((id) => photo.memberIds.includes(id));
  const save = async () => {
    const r = await act('photo.retag', { photoId: photo.id, memberIds: sel }, { silent: true });
    if (r.ok) { flash(t('activity.tagsSaved')); onClose(); } else setErr(t(r.code, r.params));
  };
  return (
    <Sheet open={open} onClose={onClose} title={t('activity.tagsTitle')}>
      <div style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>{t('activity.tagsHint')}</div>
      <MemberPicker members={members} value={sel} onChange={setSel} selectedLabel={t('activity.tagsTitle')} emptyLabel={t('activity.nobodyAdded')} />
      {!sel.length ? <Note tone="ochre" icon="info">{t('activity.tagsNone')}</Note> : null}
      {err ? <Note tone="rust" icon="error">{err}</Note> : null}
      <Button full disabled={same || !sel.length} onClick={save}>{t('activity.saveTags')}</Button>
    </Sheet>
  );
}

/** Hide from families (sheet), remove or reject (dialog): pick a reason, then confirm. A rejection sends the reason as plain text for the teacher. */
function ReasonSheet({ kind, open, onClose, photo, flash, removed }: { kind: 'hide' | 'remove' | 'reject'; open: boolean; onClose: () => void; photo: Photo; flash: (text: string) => void; removed: (id: string) => void }) {
  const t = useT();
  const act = useAct();
  const [reason, setReason] = useState<string>('blurry');
  const [other, setOther] = useState('');
  const [err, setErr] = useState('');
  useResetOn(open ? 'open' : null, () => { setReason('blurry'); setOther(''); setErr(''); });
  const value = reason === 'other' ? 'other:' + other.trim() : reason;
  const submit = async () => {
    if (kind === 'hide') {
      const r = await act('photo.hide', { photoId: photo.id, reason: value }, { silent: true });
      if (r.ok) { flash(t('activity.hiddenToast')); onClose(); } else setErr(t(r.code, r.params));
    } else if (kind === 'reject') {
      const r = await act('photo.reject', { photoIds: [photo.id], reason: reason === 'other' ? other.trim() : t('activity.reason.' + reason) }, { silent: true });
      if (r.ok) { flash(t('activity.rejectedToast')); onClose(); } else setErr(t(r.code, r.params));
    } else {
      const r = await act('photo.remove', { photoId: photo.id, reason: value }, { silent: true });
      if (r.ok) { onClose(); removed(photo.id); } else setErr(t(r.code, r.params));
    }
  };
  const hint = kind === 'hide' ? t('activity.hideHint') : kind === 'reject' ? t('activity.rejectHint') : t('activity.removeHint');
  const body = (
    <>
      <div style={{ fontSize: FONT_BODY, color: '#282828', lineHeight: 1.4 }}>{hint}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: FONT_BODY, fontWeight: 500, lineHeight: 1.4 }}>{t('activity.reasonLabel')}</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }} role="group" aria-label={t('activity.reasonLabel')}>
          {[...PHOTO_REASONS, 'other' as const].map((r) => <Chip key={r} selected={reason === r} onClick={() => setReason(r)}>{t('activity.reason.' + r)}</Chip>)}
        </div>
      </div>
      {reason === 'other' ? <TextField label={t('activity.otherReason')} value={other} onChange={setOther} maxLength={150} /> : null}
      {err ? <Note tone="rust" icon="error">{err}</Note> : null}
    </>
  );
  const confirm = <Button variant={kind === 'hide' ? 'primary' : 'danger'} disabled={reason === 'other' && !other.trim()} onClick={submit} full={kind === 'hide'}>{kind === 'hide' ? t('activity.confirmHide') : kind === 'reject' ? t('activity.confirmReject') : t('activity.confirmRemove')}</Button>;
  return kind === 'hide' ? (
    <Sheet open={open} onClose={onClose} title={t('activity.hideTitle')}>{body}{confirm}</Sheet>
  ) : (
    <Dialog open={open} onClose={onClose} title={t(kind === 'reject' ? 'activity.rejectTitle' : 'activity.removeTitle')} maxWidth={480} footer={<><Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>{confirm}</>}>{body}</Dialog>
  );
}

/** Management approves a photo that is waiting: choose whether to tell the families (on by default). */
function ApproveSheet({ open, onClose, photo, flash }: { open: boolean; onClose: () => void; photo: Photo; flash: (text: string) => void }) {
  const t = useT();
  const act = useAct();
  const [notify, setNotify] = useState(true);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  useResetOn(open ? 'open' : null, () => { setNotify(true); setErr(''); setBusy(false); });
  const submit = async () => {
    setBusy(true);
    const r = await act('photo.approve', { photoIds: [photo.id], notify }, { silent: true });
    setBusy(false);
    if (r.ok) { flash(t(notify ? 'activity.approvedNotified' : 'activity.approvedToast')); onClose(); } else setErr(t(r.code, r.params));
  };
  return (
    <Sheet open={open} onClose={onClose} title={t('activity.approveTitle')}>
      <div style={{ fontSize: FONT_BODY, color: '#282828', lineHeight: 1.4 }}>{t('activity.approveHint')}</div>
      <Toggle on={notify} onClick={() => setNotify(!notify)} label={t('activity.notifyFamilies')} sub={t('activity.notifyFamiliesSub')} />
      {err ? <Note tone="rust" icon="error">{err}</Note> : null}
      <Button full disabled={busy} onClick={submit}>{t('activity.confirmApprove')}</Button>
    </Sheet>
  );
}
