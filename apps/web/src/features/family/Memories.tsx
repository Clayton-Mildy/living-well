// Round 8: the /memories page (?member=&month=YYYY-MM&slide=N): the month's story, opened full screen. Closing goes back to where the family came from
// (Photos, a notification). A month with no visits shows a gentle line instead.
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { displayName, type Member, type YM } from '@cp/shared';
import { healthMemberOf, monthRecap, recapMonths } from '@cp/shared/rules/family';
import { BackLink, FamPage, PageTitle, useBack } from './kit';
import { MemoriesStory } from './MemoriesStory';
import { useFamilyCtx, useFamilySel } from './useFamily';

export function FamilyMemories() {
  const { s, t, fmt, now, user } = useFamilyCtx();
  const { choices, sel } = useFamilySel();
  const [sp] = useSearchParams();
  const back = useBack('/photos');
  const m: Member | undefined = s.members[healthMemberOf(sel, choices)];
  const months = useMemo(() => (m ? recapMonths(m, now.today) : []), [m, now.today]);
  // the month asked for; else the newest month with a visit (this month may not have one yet)
  const asked = sp.get('month');
  const month: YM | undefined = useMemo(() => (asked && months.includes(asked) ? asked : months.find((mo) => m && monthRecap(s, m, mo).visits.length > 0) ?? months[0]), [asked, months, s, m]);
  if (!user || !m || !month) return null;
  const hasVisits = monthRecap(s, m, month).visits.length > 0;
  const slide = Math.max(0, Math.floor(Number(sp.get('slide')) || 0));
  return (
    <div data-testid="family-memories" data-member-id={m.id} data-month={month}>
      {hasVisits ? <MemoriesStory memberId={m.id} month={month} startSlide={slide} onClose={back} /> : (
        <FamPage gap={16}>
          <BackLink label={t('nav.photos')} onClick={back} />
          <PageTitle>{t('family.memTitle', { m: fmt.fmonth(month), n: displayName(m) })}</PageTitle>
          <span data-testid="memories-empty" style={{ fontSize: 16, lineHeight: 1.4, color: '#6B6259', padding: '0 4px' }}>{t('family.memEmpty', { n: displayName(m), m: fmt.fmonth(month, true) })}</span>
        </FamPage>
      )}
    </div>
  );
}
