// Round 8 (the prototype's Health history): one measurement at a time over a time range (1W … All, or two dates), its average, the chart
// (tap or hover for a day's value) and the readings in range with their grade. A family sees approved readings only; grades follow the parent's own limits.
// On a laptop the chart side (measurement, range, average, chart) is the wide LEFT column and sticks; the readings list is the RIGHT one.
// The body is health/HistoryBody (the laptop's Health tab shows the same thing inline).
import { displayName } from '@cp/shared';
import { BackLink, FamPage, PageTitle, useBack } from './kit';
import { HistoryBody } from './health/HistoryBody';
import { useParamMember } from './health/bits';

export function FamilyHistory() {
  const { t, user, id, m, sp, setSp } = useParamMember();
  const back = useBack(sp.get('from') === 'profile' && id ? `/profile?member=${id}` : '/health');
  if (!user || !m) return null;
  const short = displayName(m);
  const fromProfile = sp.get('from') === 'profile';
  const setMetric = (v: string) => {
    const next = new URLSearchParams(sp);
    next.set('metric', v);
    next.set('member', id);
    setSp(next, { replace: true });
  };
  return (
    <FamPage testId="family-history" wide>
      <BackLink label={fromProfile ? short : t('fhealth.title')} onClick={back} />
      <PageTitle eyebrow={short}>{t('fhealth.histTitle')}</PageTitle>
      <HistoryBody m={m} asked={sp.get('metric')} onMetric={setMetric} />
    </FamPage>
  );
}
