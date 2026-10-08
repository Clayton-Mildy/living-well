// Today's lunch photos (the kitchen's gallery): several a day, taken with the camera. The kitchen's photos wait for management's approval
// ("Waiting for approval"); management's go live at once, with a toggle to tell the families. Each can be removed.
// KC round 7: `meal="tea"` is the same gallery for the afternoon tea (a compact "add a photo" row under the menu; its own test ids).
import { useMemo, useState } from 'react';
import { mealPhotosOn, MAX_LUNCH_PHOTOS, type ISODate, type Meal, type Photo } from '@cp/shared';
import { CameraCapture, FONT_BODY, FONT_SMALL, Icon, Note, PhotoImg, Toggle } from '../../components/ui';
import { useDevice } from '../../hooks/useDevice';
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

export function LunchPhotos({ date, readOnly = false, meal = 'lunch' }: { date: ISODate; readOnly?: boolean; meal?: Meal }) {
  const t = useT();
  const s = useClub();
  const act = useAct();
  const { role } = useMe();
  const mgmt = role === 'mgmt';
  const { isPhone } = useDevice();
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
  return (
    <div data-testid={`${meal}-photos`} style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: photos.length ? (tea ? '4px 16px 16px' : '16px 16px 4px') : tea ? '0 16px 16px' : 0 }}>
      {/* round 6, phone: the add row has a plain hairline under it (the dashed edge is the desktop look) */}
      {!photos.length && !busy && tea ? (
        <button type="button" onClick={() => setCamera(true)} className="h-cream" data-testid="tea-photo-add" style={{ alignSelf: 'flex-start', maxWidth: '100%', minHeight: 44, padding: '0 16px 0 12px', borderRadius: 12, border: '1px solid #DCD3C8', background: '#FFFFFF', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: '#24201C', fontFamily: 'Inter', fontSize: 15, fontWeight: 500, textAlign: 'left' }}>
          <Icon name="add_a_photo" size={22} color="#75624B" />
          <span>{t(K.add)}</span>
        </button>
      ) : !photos.length && !busy ? (
        <button type="button" onClick={() => setCamera(true)} className="h-row cp-addphoto" data-testid="lunch-photo-add" style={{ width: '100%', aspectRatio: '16/9', border: 'none', borderBottom: isPhone ? '1px solid #EFEAE3' : '2px dashed #CAB8A2', background: '#FBF8F4', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', color: '#24201C', fontFamily: 'Inter', padding: 12 }}>
          <Icon name="add_a_photo" size={36} color="#75624B" />
          <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.4 }}>{t(K.add)}</span>
        </button>
      ) : (
        <>
        <span style={cardLabel}>{t(K.title)} · {photos.length}</span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 150px), 1fr))', gap: 8 }}>
          {photos.map((p) => {
            const st = STATUS[p.visibility as keyof typeof STATUS] ?? STATUS.hidden;
            return (
              <div key={p.id} role="group" aria-label={t(K.alt, { time: p.time })} data-testid={`${meal}-photo`} data-photo-id={p.id} data-status={p.visibility}
                style={{ position: 'relative', aspectRatio: '4/3', borderRadius: 12, overflow: 'hidden', background: '#F3EEE8' }}>
                <PhotoImg photo={p} />
                <span style={{ position: 'absolute', left: 8, top: 8, height: 26, padding: '0 10px', borderRadius: 8, background: '#FFFFFF', fontSize: FONT_SMALL, fontWeight: 600, display: 'inline-flex', alignItems: 'center', fontVariantNumeric: 'tabular-nums' }}>{p.time}</span>
                {readOnly ? null : (<button type="button" onClick={() => setRemoving(p)} aria-label={t('kitchen.photo.removeAria', { time: p.time })} title={t('kitchen.photo.remove')} className="h-cream"
                  style={{ position: 'absolute', right: 4, top: 4, width: 44, height: 44, borderRadius: 999, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                  <span aria-hidden="true" style={{ width: 32, height: 32, borderRadius: 999, background: 'rgba(255,255,255,0.94)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="close" size={20} color="#24201C" /></span>
                </button>)}
                <span style={{ position: 'absolute', left: 8, bottom: 8, right: 8, width: 'max-content', maxWidth: 'calc(100% - 16px)', minHeight: 28, padding: '4px 10px 4px 6px', borderRadius: 10, background: st.bg, color: st.fg, fontSize: FONT_SMALL, fontWeight: 600, lineHeight: 1.25, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Icon name={st.icon} size={17} fill={1} />
                  {t('kitchen.photo.status.' + p.visibility)}
                </span>
              </div>
            );
          })}
          {busy ? (
            <div aria-live="polite" style={{ aspectRatio: '4/3', borderRadius: 12, background: '#F3EEE8', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 8, fontSize: FONT_BODY, color: '#5E5852', lineHeight: 1.4 }}>{t('kitchen.photo.uploading')}</div>
          ) : !full && !readOnly ? (
            <button type="button" onClick={() => setCamera(true)} className="h-row" data-testid={`${meal}-photo-add`} style={{ aspectRatio: '4/3', borderRadius: 12, border: '2px dashed #CAB8A2', background: '#FBF8F4', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, cursor: 'pointer', color: '#24201C', fontFamily: 'Inter', padding: 8, minHeight: 44 }}>
              <Icon name="add_a_photo" size={28} color="#75624B" />
              <span style={{ fontSize: FONT_BODY, fontWeight: 500, lineHeight: 1.4 }}>{t('kitchen.photo.addMore')}</span>
            </button>
          ) : null}
        </div>
        </>
      )}
      {full && !readOnly ? <span style={{ fontSize: FONT_BODY, color: '#5E5852', lineHeight: 1.4 }}>{t(K.full)}</span> : null}
      {readOnly ? null : mgmt ? (
        <div style={{ padding: photos.length ? 0 : '12px 16px 0' }}>
          <Toggle on={notify} onClick={() => setNotify((x) => !x)} label={t('kitchen.notify.families')} />
        </div>
      ) : photos.length && !tea ? <Note tone="cream" icon="hourglass_top">{t('kitchen.photo.pendingNote')}</Note> : null}

      <CameraCapture open={camera} onClose={() => setCamera(false)} onCapture={(b) => void onCapture(b)} facing="environment" />
      <ConfirmDialog open={!!removing} onClose={() => setRemoving(null)} title={t('kitchen.photo.removeTitle')} body={t(K.removeAsk)} confirmLabel={t('kitchen.photo.remove')} cancelLabel={t('kitchen.photo.keep')} onConfirm={remove} />
    </div>
  );
}
