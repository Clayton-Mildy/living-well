// Today's lunch photos (the kitchen's gallery): several a day, taken with the camera. The kitchen's photos wait for management's approval
// ("Waiting for approval"); management's go live at once, with a toggle to tell the families. Each can be removed.
import { useMemo, useState } from 'react';
import { lunchPhotosOn, MAX_LUNCH_PHOTOS, type ISODate, type Photo } from '@cp/shared';
import { CameraCapture, FONT_BODY, FONT_SMALL, Icon, Note, PhotoImg, Toggle } from '../../components/ui';
import { ApiError } from '../../lib/api';
import { uploadMedia } from '../../lib/media';
import { useT } from '../../lib/i18n';
import { useAct } from '../../lib/act';
import { useMe } from '../../lib/me';
import { useClub } from '../../store/replica';
import { say } from '../../store/ui';
import { ConfirmDialog, cardLabel } from './parts';

const STATUS: Record<'visible' | 'pending' | 'hidden', { icon: string; fg: string; bg: string }> = {
  visible: { icon: 'check_circle', fg: '#3D6B4F', bg: '#E3EFE6' },
  pending: { icon: 'hourglass_top', fg: '#7A5510', bg: '#F6ECD6' },
  hidden: { icon: 'visibility_off', fg: '#5E5852', bg: '#F0EAE1' },
};

export function LunchPhotos({ date }: { date: ISODate }) {
  const t = useT();
  const s = useClub();
  const act = useAct();
  const { role } = useMe();
  const mgmt = role === 'mgmt';
  const photos = useMemo(() => lunchPhotosOn(s, date), [s, date]);
  const [camera, setCamera] = useState(false);
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<Photo | null>(null);
  const full = photos.length >= MAX_LUNCH_PHOTOS;

  const onCapture = async (blob: Blob) => {
    setCamera(false);
    setBusy(true);
    try {
      const mediaId = await uploadMedia(blob);
      await act('menu.postLunchPhoto', { date, mediaId, notify }, { ok: (r) => t(r.pending ? 'kitchen.photo.sentOk' : notify ? 'kitchen.photo.postedOk' : 'kitchen.photo.postedQuiet') });
    } catch (e) {
      say(e instanceof ApiError ? t(e.code, e.params) : t('kitchen.photo.uploadFailed'), { tone: 'error', icon: 'error' }); // the upload's own reason: too big, wrong type, offline
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!removing) return;
    const r = await act('menu.removeLunchPhoto', { photoId: removing.id }, { ok: t('kitchen.photo.removed') });
    if (r.ok) setRemoving(null);
  };

  return (
    <div data-testid="lunch-photos" style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: photos.length ? '16px 16px 4px' : 0 }}>
      {!photos.length && !busy ? (
        <button type="button" onClick={() => setCamera(true)} className="h-row cp-addphoto" data-testid="lunch-photo-add" style={{ width: '100%', aspectRatio: '16/9', border: 'none', borderBottom: '2px dashed #CAB8A2', background: '#FBF8F4', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', color: '#24201C', fontFamily: 'Inter', padding: 12 }}>
          <Icon name="add_a_photo" size={36} color="#75624B" />
          <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.4 }}>{t('kitchen.photo.add')}</span>
        </button>
      ) : (
        <>
        <span style={cardLabel}>{t('kitchen.photo.title')} · {photos.length}</span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 150px), 1fr))', gap: 8 }}>
          {photos.map((p) => {
            const st = STATUS[p.visibility as keyof typeof STATUS] ?? STATUS.hidden;
            return (
              <div key={p.id} role="group" aria-label={t('kitchen.photo.alt', { time: p.time })} data-testid="lunch-photo" data-photo-id={p.id} data-status={p.visibility}
                style={{ position: 'relative', aspectRatio: '4/3', borderRadius: 12, overflow: 'hidden', background: '#F3EEE8' }}>
                <PhotoImg photo={p} />
                <span style={{ position: 'absolute', left: 8, top: 8, height: 26, padding: '0 10px', borderRadius: 8, background: '#FFFFFF', fontSize: FONT_SMALL, fontWeight: 600, display: 'inline-flex', alignItems: 'center', fontVariantNumeric: 'tabular-nums' }}>{p.time}</span>
                <button type="button" onClick={() => setRemoving(p)} aria-label={t('kitchen.photo.removeAria', { time: p.time })} title={t('kitchen.photo.remove')} className="h-cream"
                  style={{ position: 'absolute', right: 4, top: 4, width: 44, height: 44, borderRadius: 999, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                  <span aria-hidden="true" style={{ width: 32, height: 32, borderRadius: 999, background: 'rgba(255,255,255,0.94)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="close" size={20} color="#24201C" /></span>
                </button>
                <span style={{ position: 'absolute', left: 8, bottom: 8, right: 8, width: 'max-content', maxWidth: 'calc(100% - 16px)', minHeight: 28, padding: '4px 10px 4px 6px', borderRadius: 10, background: st.bg, color: st.fg, fontSize: FONT_SMALL, fontWeight: 600, lineHeight: 1.25, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Icon name={st.icon} size={17} fill={1} />
                  {t('kitchen.photo.status.' + p.visibility)}
                </span>
              </div>
            );
          })}
          {busy ? (
            <div aria-live="polite" style={{ aspectRatio: '4/3', borderRadius: 12, background: '#F3EEE8', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 8, fontSize: FONT_BODY, color: '#5E5852', lineHeight: 1.4 }}>{t('kitchen.photo.uploading')}</div>
          ) : !full ? (
            <button type="button" onClick={() => setCamera(true)} className="h-row" data-testid="lunch-photo-add" style={{ aspectRatio: '4/3', borderRadius: 12, border: '2px dashed #CAB8A2', background: '#FBF8F4', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, cursor: 'pointer', color: '#24201C', fontFamily: 'Inter', padding: 8, minHeight: 44 }}>
              <Icon name="add_a_photo" size={28} color="#75624B" />
              <span style={{ fontSize: FONT_BODY, fontWeight: 500, lineHeight: 1.4 }}>{t('kitchen.photo.addMore')}</span>
            </button>
          ) : null}
        </div>
        </>
      )}
      {full ? <span style={{ fontSize: FONT_BODY, color: '#5E5852', lineHeight: 1.4 }}>{t('kitchen.photo.full')}</span> : null}
      {mgmt ? (
        <div style={{ padding: photos.length ? 0 : '12px 16px 0' }}>
          <Toggle on={notify} onClick={() => setNotify((x) => !x)} label={t('kitchen.notify.families')} />
        </div>
      ) : photos.length ? <Note tone="cream" icon="hourglass_top">{t('kitchen.photo.pendingNote')}</Note> : null}

      <CameraCapture open={camera} onClose={() => setCamera(false)} onCapture={(b) => void onCapture(b)} facing="environment" />
      <ConfirmDialog open={!!removing} onClose={() => setRemoving(null)} title={t('kitchen.photo.removeTitle')} body={t('kitchen.photo.removeAsk')} confirmLabel={t('kitchen.photo.remove')} cancelLabel={t('kitchen.photo.keep')} onConfirm={remove} />
    </div>
  );
}
