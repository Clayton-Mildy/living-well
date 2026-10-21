// KC round 9 ("it still looks like our old view instead the new one"): on a phone and tablet the parent's page opens like Today. Their picture fills the
// top (sticky, so the white panel below slides up over it) with ‹ back and Edit floating on it, and the plan, name and age at its foot.
// The picture is their profile picture (the demo's stock portrait); without one, the newest photo of them; without that, the bronze gradient and their initials.
import type { ReactNode } from 'react';
import { displayName } from '@cp/shared';
import { ownPicture } from '@cp/shared/rules/famPhotos';
import { PhotoImg } from '../../../components/ui';
import { useDevice } from '../../../hooks/useDevice';
import { GRADIENT, PANEL_OVERLAP, SCRIM } from '../StoryHero';
import { MemberFace } from '../health/bits';
import { headText, type PCtx } from './sections';

/** A little shorter than Today's picture, so the plan card still peeks out below it. */
const COVER_H = 'max(380px, min(58vh, 560px))';

export function ProfileCover({ p, top }: { p: PCtx; /** the floating ‹ back and Edit */ top: ReactNode }) {
  const { s, m, today } = p;
  const { isPhone } = useDevice();
  const pic = m.photoMediaId ? { mediaId: m.photoMediaId, tone: m.photoTone, media: 'photo' as const } : ownPicture(s, m, today);
  const { eyebrow, sub } = headText(p);
  return (
    <section data-testid="pf-cover" data-cover={pic ? 'photo' : 'gradient'}
      style={{ position: 'sticky', top: 0, zIndex: 0, isolation: 'isolate', overflow: 'hidden', color: '#FFFFFF', background: pic ? '#2B231C' : GRADIENT, borderRadius: isPhone ? 0 : '30px 30px 0 0',
        height: COVER_H, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxSizing: 'border-box' }}>
      {pic ? <span aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex: -3 }}><PhotoImg photo={pic} /></span> : null}
      <span aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex: -2, background: SCRIM }} />
      <div style={{ position: 'relative', zIndex: 3, padding: `${isPhone ? 'calc(env(safe-area-inset-top, 0px) + 12px)' : '16px'} 14px 0` }}>{top}</div>
      <div data-testid="pf-head" style={{ position: 'relative', padding: `20px 20px ${PANEL_OVERLAP + 20}px`, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
        {pic ? null : <span style={{ marginBottom: 6 }}><MemberFace m={m} size={72} ring /></span>}
        <span style={{ fontSize: 12, letterSpacing: '1.6px', textTransform: 'uppercase', fontWeight: 600, opacity: 0.9 }}>{eyebrow}</span>
        <h1 style={{ margin: 0, fontSize: 36, lineHeight: 1.04, fontWeight: 300, letterSpacing: '-1.1px', overflowWrap: 'anywhere' }}>{displayName(m)}</h1>
        {sub ? <span style={{ fontSize: 15, lineHeight: 1.35, opacity: 0.9 }}>{sub}</span> : null}
      </div>
    </section>
  );
}
