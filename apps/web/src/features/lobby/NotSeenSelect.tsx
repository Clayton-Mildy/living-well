// The "Not seen for" dropdown of the Check on list (round 15), shared by the lobby rail block, the call sheet and the Members filter.
import { Select } from '../../components/ui';
import { useT } from '../../lib/i18n';
import { NOT_SEEN_CHOICES, useCheckOnDays } from './useCheckOnDays';

export function NotSeenSelect() {
  const t = useT();
  const [days, setDays] = useCheckOnDays();
  return (
    <Select label={t('checkOn.notSeenFor')} value={String(days ?? 'auto')} onChange={(v) => setDays(v === 'auto' ? 'auto' : Number(v))}
      options={NOT_SEEN_CHOICES.map((c) => ({ value: String(c), label: c === 'auto' ? t('checkOn.auto') : t('checkOn.days', { n: c }) }))} />
  );
}
