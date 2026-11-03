// Next month > Few visits (round 17): one quiet card above the tabs. From the alert day to the last change day it reads "Few visits · 7 · 2 called · changes close 17 Nov";
// before the alert day it is greyer ("list opens 15 Nov"), after the last change day "7 · 2 called · changes closed". It always opens the list.
import { useMemo } from 'react';
import { fewVisitsState, type FewVisitsState } from '@cp/shared/rules/fewVisits';
import { Icon } from '../../components/ui';
import { useNow } from '../../lib/clock';
import { useFmt, useT, type TFn } from '../../lib/i18n';
import { useClub } from '../../store/replica';

const short = { day: 'numeric', month: 'short' } as const;

/** The state in a few words, for the card and the top of the list: "6 · 1 called · changes close 17 Nov". */
export function fewLine(t: TFn, fd: (d: string, o: Intl.DateTimeFormatOptions) => string, st: FewVisitsState): string {
  if (st.phase === 'before') return t('renewals.few.before', { d: fd(st.alertDay, short) });
  if (st.phase === 'closed') return t('renewals.few.closed', { n: st.rows.length, c: st.called });
  return t('renewals.few.card', { n: st.rows.length, c: st.called, d: fd(st.deadline, short) });
}

export function FewVisitsCard({ onOpen }: { onOpen: () => void }) {
  const s = useClub();
  const t = useT();
  const { fd } = useFmt();
  const { today } = useNow();
  const st = useMemo(() => fewVisitsState(s, today), [s, today]);
  if (!st.rows.length) return null;
  const quiet = st.phase !== 'open';
  return (
    <button type="button" data-testid="few-card" data-phase={st.phase} onClick={onOpen} className="cp-press cp-fill"
      style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 56, boxSizing: 'border-box', padding: '10px 14px 10px 16px', border: 'none', borderRadius: 16, background: 'var(--fill, #F4F4F5)', color: quiet ? '#6B6259' : '#24201C', textAlign: 'left', fontFamily: 'Inter', fontSize: 15, lineHeight: '21px', cursor: 'pointer' }}>
      <Icon name="call" size={20} weight={300} color={quiet ? '#8A8078' : 'var(--eyebrow, #6E5A43)'} />
      <span data-testid="few-card-text" style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}><span style={{ fontWeight: 500, color: quiet ? '#6B6259' : '#24201C' }}>{t('renewals.few.title')}</span> · {fewLine(t, fd, st)}</span>
      <Icon name="chevron_right" size={22} weight={300} color="#8A8078" />
    </button>
  );
}
