// Today's lunch photos (the kitchen's gallery): several a day, taken with the camera. The kitchen's photos wait for management's approval
// ("Waiting for approval"); management's go live at once, with a toggle to tell the families. Each can be removed.
// KC round 7: `meal="tea"` is the same gallery for the afternoon tea (a compact "add a photo" row under the menu; its own test ids).
import { useMemo, useState } from 'react';
import { mealPhotosOn, MAX_LUNCH_PHOTOS, type ISODate, type Meal, type Photo } from '@cp/shared';
import { CameraCapture, FONT_BODY, Icon, Note, PhotoImg, Toggle } from '../../components/ui';
import { ApiError } from '../../lib/api';
import { uploadMedia } from '../../lib/media';
import { useT } from '../../lib/i18n';
import { useAct } from '../../lib/act';
import { useMe } from '../../lib/me';
import { useClub } from '../../store/replica';
import { say } from '../../store/ui';
import { PhotoViewer } from '../activity/PhotoViewer';
import { ConfirmDialog, cardLabel } from './parts';

const STATUS: Record<'visible' | 'pending' | 'hidden', { icon: string; fg: string; bg: string }> = {
  visible: { icon: 'check_circle', fg: '#3D6B4F', bg: '#E3EFE6' },
  pending: { icon: 'hourglass_top', fg: '#7A5510', bg: '#F6ECD6' },
  hidden: { icon: 'visibility_off', fg: '#5E5852', bg: 'var(--press, #EEEEF0)' },
};

export function LunchPhotos({ date, readOnly = false, meal = 'lunch' }: { date: ISODate; readOnly?: boolean; meal?: Meal }) {
  const t = useT();
  const s = useClub();
  const act = useAct();
  const { role } = useMe();
  const mgmt = role === 'mgmt';
  const tea = meal === 'tea';
  // the strings the tea gallery words differently
  const K = tea
    ? { title: 'kitchen.photo.tea.title', add: 'kitchen.photo.tea.add', alt: 'kitchen.photo.tea.alt', full: 'kitchen.photo.tea.full', postedOk: 'kitchen.photo.tea.postedOk', postedQuiet: 'kitchen.photo.tea.postedQuiet', removeAsk: 'kitchen.photo.tea.removeAsk', removed: 'kitchen.photo.tea.removed' }
    : { title: 'kitchen.photo.title', add: 'kitchen.photo.add', alt: 'kitchen.photo.alt', full: 'kitchen.photo.full', postedOk: 'kitchen.photo.postedOk', postedQuiet: 'kitchen.photo.postedQuiet', removeAsk: 'kitchen.photo.removeAsk', removed: 'kitchen.photo.removed' };
  const photos = useMemo(() => mealPhotosOn(s, date, meal), [s, date, meal]);
  const [camera, setCamera] = useState(false);
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<Photo | null>(null);
  const [viewer, setViewer] = useState<string | null>(null); // round 13: a tap on a tile opens the picture full size
  const full = photos.length >= MAX_LUNCH_PHOTOS;

  const onCapture = async (blob: Blob) => {
    setCamera(false);
    setBusy(true);
    try {
      const mediaId = await uploadMedia(blob);
      await act('menu.postLunchPhoto', { date, mediaId, notify, ...(tea ? { meal } : {}) }, { ok: (r) => t(r.pending ? 'kitchen.photo.sentOk' : notify ? K.postedOk : K.postedQuiet) });
    } catch (e) {
      say(e instanceof ApiError ? t(e.code, e.params) : t('kitchen.photo.uploadFailed'), { tone: 'error', icon: 'error' }); // the upload's own reason: too big, wrong type, offline
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!removing) return;
    const r = await act('menu.removeLunchPhoto', { photoId: removing.id }, { ok: t(K.removed) });
    if (r.ok) setRemoving(null);
  };

  if (readOnly && !photos.length) return null; // view only: no "add a photo" tile
  // round 15 (KC "the image field is too damn big"): one quiet strip. 64 px thumbnails that wrap, then a 44 px add button; the time and the "waiting" /
  // "hidden" state moved into the picture's full-size view and a small badge, and the X is a corner target (its 44 px hit area reaches out past the tile).
  const addBtn = busy ? (
    <span aria-live="polite" style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center', fontSize: FONT_BODY, color: '#5E5852', lineHeight: 1.4 }}>{t('kitchen.photo.uploading')}</span>
  ) : !full && !readOnly ? (
    <button type="button" onClick={() => setCamera(true)} className="h-fill cp-fill" data-testid={`${meal}-photo-add`} style={{ maxWidth: '100%', minHeight: 44, padding: '0 16px 0 12px', borderRadius: 12, border: 'none', background: 'var(--fill, #F4F4F5)', display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: '#24201C', fontFamily: 'Inter', fontSize: 15, fontWeight: 500, textAlign: 'left' }}>
      <Icon name="add_a_photo" size={22} color="var(--accent, #75624B)" />
      <span>{t(photos.length ? 'kitchen.photo.addMore' : K.add)}</span>
    </button>
  ) : null;
  return (
    <div data-testid={`${meal}-photos`} style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: photos.length ? (tea ? '4px 16px 16px' : '16px 16px 4px') : tea ? '0 16px 16px' : '12px 16px' }}>
      {photos.length ? (
        <>
          <span style={cardLabel}>{t(K.title)} · {photos.length}</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, paddingTop: 6 }}>
            {photos.map((p) => {
              const st = STATUS[p.visibility as keyof typeof STATUS] ?? STATUS.hidden;
              const label = t(K.alt, { time: p.time });
              return (
                <div key={p.id} role="group" aria-label={label} data-testid={`${meal}-photo`} data-photo-id={p.id} data-status={p.visibility}
                  style={{ position: 'relative', width: 64, height: 64, flex: 'none' }}>
                  <div style={{ position: 'absolute', inset: 0, borderRadius: 10, overflow: 'hidden', background: 'var(--press, #EEEEF0)' }}>
                    <PhotoImg photo={p} />
                    {/* the tile opens the picture full size, where its time and state are written out */}
                    <button type="button" onClick={() => setViewer(p.id)} aria-label={t('kitchen.photo.open', { time: p.time })} title={label} data-testid="photo-open" className="cp-press"
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none', padding: 0, background: 'transparent', cursor: 'zoom-in' }} />
                  </div>
                  {p.visibility === 'visible' ? null : (
                    <span aria-hidden="true" style={{ pointerEvents: 'none', position: 'absolute', left: 4, bottom: 4, width: 20, height: 20, borderRadius: 999, background: st.bg, color: st.fg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name={st.icon} size={14} fill={1} />
                    </span>
                  )}
                  <span className="sr-only">{t('kitchen.photo.status.' + p.visibility)}</span>
                  {readOnly ? null : (<button type="button" onClick={() => setRemoving(p)} aria-label={t('kitchen.photo.removeAria', { time: p.time })} title={t('kitchen.photo.remove')} className="h-cream"
                    style={{ position: 'absolute', right: -12, top: -12, width: 44, height: 44, borderRadius: 999, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                    <span aria-hidden="true" style={{ width: 22, height: 22, borderRadius: 999, background: 'rgba(255,255,255,0.96)', boxShadow: '0 0 0 1px rgba(36,32,28,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="close" size={16} color="#24201C" /></span>
                  </button>)}
                </div>
              );
            })}
            {addBtn}
          </div>
        </>
      ) : addBtn}
      {full && !readOnly ? <span style={{ fontSize: FONT_BODY, color: '#5E5852', lineHeight: 1.4 }}>{t(K.full)}</span> : null}
      {readOnly ? null : mgmt ? (
        <div style={{ padding: photos.length || !tea ? 0 : '12px 16px 0' }}>
          <Toggle on={notify} onClick={() => setNotify((x) => !x)} label={t('kitchen.notify.families')} />
        </div>
      ) : photos.length && !tea ? <Note tone="cream" icon="hourglass_top">{t('kitchen.photo.pendingNote')}</Note> : null}

      {viewer ? <PhotoViewer photos={photos} startId={viewer} onClose={() => setViewer(null)} audience="staff" /> : null}
      <CameraCapture open={camera} onClose={() => setCamera(false)} onCapture={(b) => void onCapture(b)} facing="environment" />
      <ConfirmDialog open={!!removing} onClose={() => setRemoving(null)} title={t('kitchen.photo.removeTitle')} body={t(K.removeAsk)} confirmLabel={t('kitchen.photo.remove')} cancelLabel={t('kitchen.photo.keep')} onConfirm={remove} />
    </div>
  );
}
