// Family Photos (design ScrFphotos 1933–1942): photos by day, solo first then group; tiles open the viewer (family audience, no staff actions).
import { useCallback, useState } from 'react';
import { memberShort, type Photo } from '@cp/shared';
import { familyPhotoDays, photoActivityLabel, photosInOrder, type PhotoSet } from '@cp/shared/rules/family';
import { useDevice } from '../../hooks/useDevice';
import { PhotoViewer } from '../activity/PhotoViewer';
import { Cap, FamSwitch, H1, PhotoGrid, fcard } from './parts';
import { famPad, useFamilyCtx, useFamilySel } from './useFamily';

export function FamilyPhotos() {
  const { s, t, fmt, now, user, pron } = useFamilyCtx();
  const { isPhone } = useDevice();
  const { choices, sel, who, setSel, multi } = useFamilySel();
  const [viewer, setViewer] = useState<{ startId: string } | null>(null);
  const closeViewer = useCallback(() => setViewer(null), []);
  if (!user || !who.length) return null;
  const both = who.length > 1;
  const first = s.members[who[0]];
  const days = familyPhotoDays(s, who, 10);
  const all = photosInOrder(days);
  const label = (p: Photo) => {
    const a = photoActivityLabel(s, p.activity, fmt.lang) || t('family.clubPhoto');
    return t(p.media === 'video' ? 'family.photoAriaVideo' : p.kind === 'group' ? 'family.photoAriaGroup' : 'family.photoAria', { a, t: p.time });
  };
  const setLabel = (x: PhotoSet) => {
    if (x.kind === 'solo') return both ? memberShort(s.members[x.memberId!]) : t('family.soloPhotos', { n: memberShort(first) });
    if (x.kind === 'both') return t('family.groupWithBoth');
    return both ? t('family.groupOther') : t('family.groupWith', { o: pron(first).o, n: memberShort(first) });
  };
  return (
    <div style={{ padding: famPad(isPhone), display: 'flex', flexDirection: 'column', gap: 'clamp(16px, 3vw, 28px)', maxWidth: 680, margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: isPhone ? 4 : 8 }}>
        <Cap>{both ? t('family.phEyebrowBoth') : t('family.phEyebrow', { n: memberShort(first) })}</Cap>
        <H1>{t('nav.photos')}</H1>
      </div>
      {multi ? <FamSwitch label={t('family.switcher')} value={sel} onChange={setSel} items={[...choices.map((id) => ({ key: id, label: memberShort(s.members[id]) })), { key: 'both', label: choices.length > 2 ? t('family.everyone') : t('family.both') }]} /> : null}
      {days.map((d) => (
        <div key={d.date} style={fcard('', 12)} data-testid="photo-day" data-date={d.date}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 20, lineHeight: '28px', fontWeight: 400, letterSpacing: '-0.3px', color: '#2B231C' }}>{d.date === now.today ? t('common.today') : fmt.fds(d.date)}</span>
            <span style={{ fontSize: 14, color: '#6B6259', whiteSpace: 'nowrap', lineHeight: 1.4 }}>{d.count === 1 ? t('family.phCountOne') : t('family.phCountN', { n: d.count })}</span>
          </div>
          {d.sets.map((x) => (
            <div key={x.key} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 14, color: '#6B6259', lineHeight: 1.4 }}>{setLabel(x)}</span>
              <PhotoGrid photos={x.photos} label={label} onOpen={(p) => setViewer({ startId: p.id })} />
            </div>
          ))}
        </div>
      ))}
      {!days.length ? <div style={fcard('', 4, { textAlign: 'center', fontSize: 16, fontWeight: 300, color: '#6B6259', lineHeight: 1.4, padding: '36px 20px' })} data-testid="photos-empty">{t('family.phEmpty')}</div> : null}
      {viewer ? <PhotoViewer photos={all} startId={viewer.startId} onClose={closeViewer} audience="family" /> : null}
    </div>
  );
}
