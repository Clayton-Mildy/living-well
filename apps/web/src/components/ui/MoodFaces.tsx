// Five faces, great first: the mood mark taken at the door, the health check and each activity (round 12).
// One tap chooses; the chosen face is ink with a white glyph, the others outlined. Labels sit under the faces only on wide screens.
import { FACES, FACE_KEY, type Face } from '@cp/shared';
import { useT } from '../../lib/i18n';
import { HAIRLINE, Icon } from './index';

/** Material glyph per face, 5 (great) to 1 (upset). */
export const FACE_ICON: Record<Face, string> = { 5: 'sentiment_very_satisfied', 4: 'sentiment_satisfied', 3: 'sentiment_neutral', 2: 'sentiment_dissatisfied', 1: 'sentiment_very_dissatisfied' };

export function MoodFaces({ value, onChange, size = 44, labels = false, name }: { value: Face | null; onChange: (f: Face) => void; size?: number; labels?: boolean; name: string }) {
  const t = useT();
  return (
    <div role="radiogroup" aria-label={t('mood.ask', { name })} style={{ display: 'flex', gap: 8, justifyContent: 'space-between', maxWidth: 5 * size + 4 * 8 + (labels ? 40 : 0) }}>
      {FACES.map((f) => {
        const on = value === f;
        return (
          <div key={f} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: 'none' }}>
            <button type="button" role="radio" aria-checked={on} aria-label={t(FACE_KEY[f])} data-face={f} onClick={() => onChange(f)}
              style={{ width: size, height: size, borderRadius: 999, border: on ? 'none' : HAIRLINE, background: on ? '#24201C' : 'transparent', color: on ? '#FFFFFF' : '#24201C', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, cursor: 'pointer', flex: 'none' }}>
              <Icon name={FACE_ICON[f]} size={Math.round(size * 0.64)} weight={300} fill={on ? 1 : 0} />
            </button>
            {labels ? <span style={{ fontSize: 13, color: on ? '#24201C' : '#6B6259', fontWeight: on ? 500 : 400, lineHeight: 1.2 }}>{t(FACE_KEY[f])}</span> : null}
          </div>
        );
      })}
    </div>
  );
}
