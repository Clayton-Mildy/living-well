// Round 14: the daily mood on the family side. Families see one face a day, the average of the marked moments: a face with its word, and the Mood line
// of the health history (the last 30 visit days as small faces). Ink and grey only; the face icon says the rest.
import { FACE_KEY, HINT_KEY, dailyMood, type Face, type Member } from '@cp/shared';
import { visitDays } from '@cp/shared/rules/family';
import { FACE_ICON, Icon } from '../../components/ui';
import { Cap, F } from './kit';
import { useFamilyCtx } from './useFamily';

/** A face icon and its word ("Good"); `hint` adds the face's meaning as small text under it. */
export function MoodTag({ face, color = F.text, size = 18, hint, hintColor = F.muted, align = 'end', testId }: { face: Face; color?: string; size?: number; hint?: boolean; hintColor?: string; align?: 'start' | 'end'; testId?: string }) {
  const { t } = useFamilyCtx();
  return (
    <span data-testid={testId} data-face={face} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: align === 'end' ? 'flex-end' : 'flex-start', gap: 1, color }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <Icon name={FACE_ICON[face]} size={size} weight={300} fill={1} color={color} />{t(FACE_KEY[face])}
      </span>
      {hint ? <span style={{ fontSize: 12, fontWeight: 400, color: hintColor, opacity: hintColor === F.muted ? 1 : 0.8, lineHeight: 1.3 }}>{t(HINT_KEY[face])}</span> : null}
    </span>
  );
}

/** The Mood line of the health history: the last 30 days this parent came, one small face each (the day's mood; a muted outline when nobody marked a face), the day under it. */
export function MoodHistory({ m, inline }: { m: Member; inline?: boolean }) {
  const { s, t, fmt, now } = useFamilyCtx();
  const days = visitDays(s, m.id, now.today).slice(-30).map((d) => ({ d, face: dailyMood(s, m.id, d)?.face }));
  if (!days.some((x) => x.face !== undefined)) return null;
  return (
    <div data-testid="mood-history" style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: inline ? 0 : '0 4px' }}>
      <Cap>{t('fhealth.moodTitle')}</Cap>
      <div role="img" aria-label={t('fhealth.moodAria')} style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 6px' }}>
        {days.map(({ d, face }) => (
          <span key={d} data-date={d} data-face={face ?? ''} title={`${fmt.fds(d)} · ${face !== undefined ? t(FACE_KEY[face]) : t('fhealth.moodNone')}`} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 1, minWidth: 28 }}>
            {face !== undefined
              ? <Icon name={FACE_ICON[face]} size={20} weight={300} fill={1} color={F.text} />
              : <Icon name={FACE_ICON[3]} size={20} weight={300} fill={0} color={F.muted} style={{ opacity: 0.5 }} />}
            <span style={{ fontSize: 11, lineHeight: '14px', color: F.muted, fontVariantNumeric: 'tabular-nums' }}>{+d.slice(8, 10)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
