// Five faces, great first: the mood mark taken at the door, the health check and each activity (round 12).
// One tap chooses; the chosen face is ink with a white glyph, the others outlined. Labels sit under the faces only on wide screens.
// Round 14: with `hints`, the chosen face's fixed meaning ("Engaged and content") shows in one line under the row.
import { FACES, FACE_KEY, HINT_KEY, type Face } from '@cp/shared';
import { useT } from '../../lib/i18n';
import { HAIRLINE, Icon } from './index';

/** Material glyph per face, 5 (great) to 1 (upset). */
export const FACE_ICON: Record<Face, string> = { 5: 'sentiment_very_satisfied', 4: 'sentiment_satisfied', 3: 'sentiment_neutral', 2: 'sentiment_dissatisfied', 1: 'sentiment_very_dissatisfied' };

export function MoodFaces({ value, onChange, size = 44, labels = false, hints = false, name, label }: { value: Face | null; onChange: (f: Face) => void; size?: number; labels?: boolean; /** the chosen face's meaning under the row */ hints?: boolean; name: string; /** the group's accessible name; defaults to the arrival question */ label?: string }) {
  const t = useT();
  const row = (
    <div role="radiogroup" aria-label={label ?? t('mood.ask', { name })} style={{ display: 'flex', gap: 8, justifyContent: 'space-between', maxWidth: 5 * size + 4 * 8 + (labels ? 40 : 0) }}>
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
  if (!hints) return row;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      {row}
      {value !== null ? <div data-testid="mood-hint" aria-live="polite" style={{ fontSize: 13, lineHeight: '18px', color: '#6B6259' }}>{t(HINT_KEY[value])}</div> : null}
    </div>
  );
}
