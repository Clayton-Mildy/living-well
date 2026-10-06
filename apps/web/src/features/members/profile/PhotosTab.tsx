// Photos tab (design ScrProfile photos): the member's own photos first each day, then the group photos they are in. Tiles open the viewer.
// "Take photo" opens the real camera, uploads the picture and saves it as a solo photo of this member. Photos taken by anyone but management
// wait for approval (Reviews → Photos): staff see them tagged "Waiting for approval", families never see them.
import { useState } from 'react';
import { getAction, hasKey, live, memberShort, type Photo } from '@cp/shared';
import { Button, CameraCapture, Icon, Pager, PhotoImg, SectionLabel, usePaged, FONT_BODY } from '../../../components/ui';
import { ApiError } from '../../../lib/api';
import { uploadMedia } from '../../../lib/media';
import { say } from '../../../store/ui';
import { PhotoViewer } from '../../activity/PhotoViewer';
import { activityLabel, mmss } from '../lib';
import type { P } from './types';

export function PhotosTab({ p }: { p: P }) {
  const { s, m, t, fmt, today, lang } = p;
  const [viewer, setViewer] = useState<{ photos: Photo[]; startId: string } | null>(null);
  const [camera, setCamera] = useState(false);
  const [saving, setSaving] = useState(false);
  const canTake = !p.family && p.st.key !== 'pending' && p.st.key !== 'ended' && !!getAction('photo.take')?.can(p.me, { kind: 'solo', memberIds: [m.id], media: 'photo' }, s);
  const mine = live(s.photos).filter((x) => x.memberIds.includes(m.id) && (p.family ? x.visibility === 'visible' : x.visibility !== 'removed'));
  const dates = Array.from(new Set(mine.map((x) => x.date))).sort().reverse();
  const days = dates.map((d) => {
    const ps = mine.filter((x) => x.date === d).sort((a, b) => (a.time < b.time ? -1 : 1));
    const solo = ps.filter((x) => x.kind !== 'group');
    const grp = ps.filter((x) => x.kind === 'group');
    return { d, solo, grp, all: [...solo, ...grp] };
  });
  const paged = usePaged(days, 5, m.id);
  const all = days.reduce<Photo[]>((a, x) => a.concat(x.all), []);
  const label = (x: Photo) => {
    const a = x.activity === 'arrival' ? t('profile.photoArrival') : x.activity === 'lunch' ? t('profile.photoLunch') : activityLabel(s, lang, x.activity);
    return `${a}, ${x.time}${x.kind === 'group' ? ', ' + t('profile.groupPhoto') : ''}${x.visibility === 'hidden' ? ', ' + t('profile.hiddenFromFamily') : ''}${x.visibility === 'pending' ? ', ' + t('profile.photoPending') : ''}`;
  };
  const take = async (blob: Blob) => {
    setCamera(false);
    setSaving(true);
    try {
      const mediaId = await uploadMedia(blob);
      await p.act('photo.take', { kind: 'solo', memberIds: [m.id], media: 'photo', mediaId }, { ok: p.mgmt ? t('profile.photoSaved') : t('profile.photoSavedPending') });
    } catch (e) {
      // the upload says why in an i18n key (wrong file type, too big…); anything else gets the general message
      say(e instanceof ApiError && hasKey(e.code) ? t(e.code) : t('profile.photoUploadFailed'), { tone: 'error', icon: 'error' });
    } finally {
      setSaving(false);
    }
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flex: '1 1 280px', minWidth: 0, fontSize: 16, lineHeight: '22px', color: '#6A6967' }}>{t('profile.photosIntro_' + m.gender, { n: memberShort(m) })}</div>
        {canTake ? <Button variant="secondary" size={44} icon="photo_camera" disabled={saving} onClick={() => setCamera(true)}>{saving ? t('profile.photoSaving') : t('profile.takePhoto')}</Button> : null}
      </div>
      {paged.rows.map((day) => (
        <div key={day.d} style={{ background: '#FFFFFF', border: '1px solid #DBD7D6', borderRadius: 24, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
            <span style={{ fontSize: 20, lineHeight: '28px', letterSpacing: '-0.3px' }}>{day.d === today ? t('common.today') : fmt.fdl(day.d)}</span>
            <span style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>{t('profile.photoCount', { n: day.all.length })}</span>
          </div>
          {([[t('profile.ownPhotos', { n: memberShort(m) }), day.solo], [t('profile.groupWith_' + m.gender), day.grp]] as [string, Photo[]][]).filter((z) => z[1].length).map(([title, items]) => (
            <div key={title} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <SectionLabel>{title}</SectionLabel>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))', gap: 8 }}>
                {items.map((ph) => (
                  <button key={ph.id} type="button" data-photo={ph.id} data-visibility={ph.visibility} onClick={() => setViewer({ photos: all, startId: ph.id })} aria-label={label(ph)} style={{ aspectRatio: '1', borderRadius: 14, border: 'none', background: '#E8E1D8', position: 'relative', cursor: 'pointer', padding: 0, overflow: 'hidden' }}>
                    <span style={{ position: 'absolute', inset: 0 }}><PhotoImg photo={ph} /></span>
                    <span style={{ position: 'absolute', left: 6, bottom: 6, height: 22, padding: '0 7px', borderRadius: 999, background: '#FFFFFF', color: '#282828', fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center', fontVariantNumeric: 'tabular-nums' }}>{ph.time}</span>
                    {ph.visibility === 'hidden' ? <span style={{ position: 'absolute', left: 6, top: 6, width: 24, height: 24, borderRadius: 999, background: '#282828', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="visibility_off" size={16} /></span> : null}
                    {ph.visibility === 'pending' ? <span style={{ position: 'absolute', left: 6, top: 6, right: 6, minHeight: 24, padding: '2px 8px 2px 6px', borderRadius: 999, background: '#F6ECD6', color: '#7A5510', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, lineHeight: 1.2, textAlign: 'left' }}><Icon name="hourglass_top" size={14} fill={1} /><span style={{ minWidth: 0 }}>{t('profile.photoPending')}</span></span> : null}
                    {ph.media === 'video' ? (
                      <>
                        <span aria-hidden="true" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 44, height: 44, borderRadius: 999, background: 'rgba(40,40,40,0.55)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="play_arrow" size={28} fill={1} /></span>
                        <span style={{ position: 'absolute', right: 6, bottom: 6, height: 24, padding: '0 8px', borderRadius: 999, background: '#282828', color: '#FFFFFF', fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center' }}>{mmss(ph.durationSec)}</span>
                      </>
                    ) : null}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}
      {!days.length ? <div style={{ padding: '40px 24px', borderRadius: 24, background: '#FFFFFF', border: '1px solid #DBD7D6', textAlign: 'center', fontSize: 16, color: '#6A6967', lineHeight: 1.4 }}>{t('profile.noPhotos')}</div> : null}
      {paged.pages > 1 ? <Pager page={paged.page} pages={paged.pages} onPage={paged.setPage} label={t('profile.photosPager')} /> : null}
      {camera ? <CameraCapture open onClose={() => setCamera(false)} onCapture={take} facing="environment" allowUpload /> : null}
      {viewer ? <PhotoViewer photos={viewer.photos} startId={viewer.startId} onClose={() => setViewer(null)} audience={p.family ? 'family' : 'staff'} /> : null}
    </div>
  );
}
