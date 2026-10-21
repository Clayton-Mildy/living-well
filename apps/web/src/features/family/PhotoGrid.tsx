// Round 8b: a day's pictures on a laptop: square tiles, six across, an 8px gap, soft corners (the kit's PhotoTiles is the phone and tablet's edge-to-edge grid).
import type { Photo } from '@cp/shared';
import { Icon, PhotoImg } from '../../components/ui';
import { F } from './kit';
import { durText } from './parts';
import { pressProps, SelectMark, tileSelectStyle, type PhotoSelect } from './select';

export function PhotoGrid({ photos, onOpen, label, cols = 6, gap = 8, radius = 14, testId, select }: { photos: Photo[]; onOpen: (p: Photo) => void; label: (p: Photo) => string; cols?: number; gap?: number; radius?: number; testId?: string; /** KC round 10: long press selects, for saving in bulk */ select?: PhotoSelect }) {
  return (
    <div data-testid={testId} style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap }}>
      {photos.map((p) => (
        <button key={p.id} type="button" onClick={() => (select?.on ? select.toggle(p) : onOpen(p))} aria-label={label(p)} aria-pressed={select?.on ? select.has(p.id) : undefined} data-photo-id={p.id} data-kind={p.kind} className="cp-press" {...pressProps(() => select?.start(p), !!select)}
          style={{ position: 'relative', aspectRatio: '1', border: 'none', padding: 0, background: F.fill, cursor: 'pointer', overflow: 'hidden', borderRadius: radius, ...(select ? tileSelectStyle : {}) }}>
          <PhotoImg photo={p} />
          {select?.on ? <SelectMark selected={select.has(p.id)} /> : null}
          {p.media === 'video' ? <span aria-hidden="true" style={{ position: 'absolute', left: 8, bottom: 8, display: 'flex', alignItems: 'center', gap: 2, padding: '2px 8px 2px 4px', borderRadius: 999, background: 'rgba(20,16,12,.55)', color: '#FFFFFF', fontSize: 12, fontWeight: 600 }}><Icon name="play_arrow" size={15} fill={1} color="#FFFFFF" />{durText(p.durationSec)}</span> : null}
        </button>
      ))}
    </div>
  );
}
