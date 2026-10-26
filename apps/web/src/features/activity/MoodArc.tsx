// The day's faces for one person, in order: arrival, the health check (only when it was marked), the morning face, each activity by its time with the lunch face
// at noon (round 14: morning and lunch only when marked), departure.
// A moment nobody marked is a muted outline; the moment's name or the session's time sits under each face. Read-only (round 12).
import type { DayArc } from '@cp/shared';
import { FACE_KEY } from '@cp/shared';
import { Icon, FACE_ICON } from '../../components/ui';
import { useT } from '../../lib/i18n';

const MUTED = '#8A8078';
const LUNCH = '12:00';

export function MoodArc({ arc, size = 18 }: { arc: DayArc; size?: number }) {
  const t = useT();
  const session = (a: DayArc['activity'][number]) => ({ k: 'activity:' + a.slot, face: a.face as DayArc['arrival'], label: a.slot });
  const items = [
    { k: 'arrival', face: arc.arrival, label: t('mood.moment.arrival') },
    ...(arc.health !== undefined ? [{ k: 'health', face: arc.health, label: t('mood.moment.health') }] : []),
    ...(arc.morning !== undefined ? [{ k: 'morning', face: arc.morning, label: t('mood.moment.morning') }] : []),
    ...arc.activity.filter((a) => a.slot < LUNCH).map(session),
    ...(arc.lunch !== undefined ? [{ k: 'lunch', face: arc.lunch, label: t('mood.moment.lunch') }] : []),
    ...arc.activity.filter((a) => a.slot >= LUNCH).map(session),
    { k: 'departure', face: arc.departure, label: t('mood.moment.departure') },
  ];
  return (
    <div data-testid="mood-arc" role="img" aria-label={t('mood.arc')} style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px' }}>
      {items.map((x) => (
        <span key={x.k} data-moment={x.k} data-face={x.face ?? ''} title={x.face ? t(FACE_KEY[x.face]) : undefined} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: size + 8 }}>
          {x.face
            ? <Icon name={FACE_ICON[x.face]} size={size} weight={300} fill={1} color="#24201C" />
            : <Icon name={FACE_ICON[3]} size={size} weight={300} fill={0} color={MUTED} style={{ opacity: 0.6 }} />}
          <span style={{ fontSize: 11, lineHeight: '14px', color: x.face ? '#5E5852' : MUTED, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{x.label}</span>
        </span>
      ))}
    </div>
  );
}
