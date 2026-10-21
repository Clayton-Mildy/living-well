// Round 8b: the Photos tab's memory cards (one per parent for this month, then earlier months) as a row that scrolls sideways. On a phone they are 250×150
// and bleed to the screen edges. Round 8c, on a laptop (the prototype's desktop): a grid that fills the width (190px tall cards, radius 24, a small lift on
// hover), the first row to start with and "Earlier months" for the rest.
import { useState } from 'react';
import { memberShort } from '@cp/shared';
import type { MemoryCard } from '@cp/shared/rules/famPhotos';
import { Icon, PhotoImg } from '../../components/ui';
import { F, TextLink, useFamWide } from './kit';
import { useFamilyCtx } from './useFamily';

export function MemoryCards({ cards, onOpen }: { cards: MemoryCard[]; onOpen: (c: MemoryCard) => void }) {
  const { s, t, fmt } = useFamilyCtx();
  const wide = useFamWide();
  const box = { w: 250, h: 150, bleed: 16, r: 22, title: 19 };
  const [more2, setMore2] = useState(false);
  const count = (n: number) => (n === 1 ? t('family.phCountOne') : t('family.phCountN', { n }));
  const cardText = (c: MemoryCard) => {
    const m = s.members[c.memberId];
    const title = t('family.memTitle', { m: fmt.fmonth(c.month), n: memberShort(m) });
    const sub = [c.visits === 1 ? t('family.storyVisitsOne') : t('family.storyVisitsN', { n: c.visits }), c.photos ? count(c.photos) : ''].filter(Boolean).join(' · ');
    return { m, title, sub };
  };
  if (wide) {
    const FIRST = 3; // what fits one row of the grid at the page's widest
    const shown = more2 ? cards : cards.slice(0, FIRST);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 'none' }}>
        <style>{`.cp-mem-card{transition:transform .18s ease}.cp-mem-card:hover{transform:translateY(-2px)}@media (prefers-reduced-motion: reduce){.cp-mem-card{transition:none}.cp-mem-card:hover{transform:none}}`}</style>
        <div role="group" aria-label={t('fphotos.memoriesAria')} data-testid="memory-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {shown.map((c) => {
            const { m, title, sub } = cardText(c);
            return (
              <button key={c.key} type="button" onClick={() => onOpen(c)} aria-label={t('fphotos.cardAria', { t: title })} data-testid="memory-card" data-member-id={c.memberId} data-month={c.month} className="cp-mem-card"
                style={{ position: 'relative', height: 190, borderRadius: 24, overflow: 'hidden', border: 'none', padding: 0, background: F.fill, color: '#FFFFFF', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', isolation: 'isolate' }}>
                <span aria-hidden="true" style={{ position: 'absolute', inset: 0 }}><PhotoImg photo={c.cover ?? { tone: (m.photoTone || 0) + 1 }} /></span>
                <span aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(28,22,16,.8), rgba(28,22,16,0) 70%)' }} />
                <span aria-hidden="true" style={{ position: 'absolute', top: 14, right: 14, width: 36, height: 36, borderRadius: 999, background: 'rgba(255,255,255,.22)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="play_arrow" size={22} fill={1} color="#FFFFFF" /></span>
                <span style={{ position: 'absolute', left: 18, right: 18, bottom: 16, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase', fontWeight: 600, opacity: 0.85 }}>{t('family.memEyebrow')}</span>
                  <span style={{ fontSize: 22, lineHeight: 1.2, fontWeight: 500, letterSpacing: '-0.3px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{title}</span>
                  <span style={{ fontSize: 14, opacity: 0.85 }}>{sub}</span>
                </span>
              </button>
            );
          })}
        </div>
        {cards.length > FIRST ? <TextLink onClick={() => setMore2((v) => !v)} testId="memories-earlier" style={{ alignSelf: 'flex-start' }}>{t(more2 ? 'fphotos.memsFewer' : 'fphotos.memsEarlier')}</TextLink> : null}
      </div>
    );
  }
  return (
    <div style={{ position: 'relative', margin: `0 -${box.bleed}px`, flex: 'none' }}>
      <div role="group" aria-label={t('fphotos.memoriesAria')} data-testid="memory-cards"
        className="cp-pillrow" style={{ display: 'flex', gap: 10, overflowX: 'auto', scrollbarWidth: 'none', padding: `0 ${box.bleed}px`, scrollSnapType: 'x proximity', scrollPaddingLeft: box.bleed }}>
        {cards.map((c) => {
          const { m, title, sub } = cardText(c);
          return (
            <button key={c.key} type="button" onClick={() => onOpen(c)} aria-label={t('fphotos.cardAria', { t: title })} data-testid="memory-card" data-member-id={c.memberId} data-month={c.month} className="cp-press"
              style={{ position: 'relative', flex: 'none', width: box.w, height: box.h, borderRadius: box.r, overflow: 'hidden', border: 'none', padding: 0, background: F.fill, color: '#FFFFFF', cursor: 'pointer', textAlign: 'left', scrollSnapAlign: 'start', fontFamily: 'inherit', isolation: 'isolate' }}>
              <span aria-hidden="true" style={{ position: 'absolute', inset: 0 }}><PhotoImg photo={c.cover ?? { tone: (m.photoTone || 0) + 1 }} /></span>
              <span aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(28,22,16,.84) 0%, rgba(28,22,16,.55) 42%, rgba(28,22,16,0) 85%)' }} />
              <span aria-hidden="true" style={{ position: 'absolute', top: 12, right: 12, width: 32, height: 32, borderRadius: 999, background: 'rgba(255,255,255,.22)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="play_arrow" size={20} fill={1} color="#FFFFFF" /></span>
              <span style={{ position: 'absolute', left: 14, right: 14, bottom: 12, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase', fontWeight: 600, opacity: 0.85 }}>{t('family.memEyebrow')}</span>
                <span style={{ fontSize: box.title, lineHeight: 1.2, fontWeight: 500, letterSpacing: '-0.3px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{title}</span>
                <span style={{ fontSize: 13, opacity: 0.85 }}>{sub}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
