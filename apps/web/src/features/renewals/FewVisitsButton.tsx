// Next month > Few visits (round 19, task 5; R5): its own button first in the Members tab's chip row, then a thin divider, then the plan chips.
// An ink rounded rectangle (10 px, not a round filter chip) with a phone icon and a chevron: "Few visits · 9", "Few visits · 9 · 4 called" once someone is
// called, "Few visits · 9 · 4 called" after the last change day; before the alert day it is grey ("Few visits · opens 15 Nov"). It always opens the list.
// Hidden when nobody is flagged (round 17 ruling). It replaces the round 17 full-width card above the tabs.
import { useMemo } from 'react';
import { fewVisitsState, type FewVisitsState } from '@cp/shared/rules/fewVisits';
import { Icon } from '../../components/ui';
import { useNow } from '../../lib/clock';
import { useFmt, useT, type TFn } from '../../lib/i18n';
import { useClub } from '../../store/replica';

const short = { day: 'numeric', month: 'short' } as const;
const INK = '#24201C';

/** The state in a few words, for the top of the list: "6 · 1 called · changes close 17 Nov". */
export function fewLine(t: TFn, fd: (d: string, o: Intl.DateTimeFormatOptions) => string, st: FewVisitsState): string {
  if (st.phase === 'before') return t('renewals.few.before', { d: fd(st.alertDay, short) });
  if (st.phase === 'closed') return t('renewals.few.closed', { n: st.rows.length, c: st.called });
  return t('renewals.few.card', { n: st.rows.length, c: st.called, d: fd(st.deadline, short) });
}

/** The button's text: "Few visits · opens 15 Nov" · "Few visits · 9" · "Few visits · 9 · 4 called". */
export function fewButtonText(t: TFn, fd: (d: string, o: Intl.DateTimeFormatOptions) => string, st: FewVisitsState): string {
  if (st.phase === 'before') return t('renewals.few.btnBefore', { d: fd(st.alertDay, short) });
  if (st.phase === 'open' && !st.called) return t('renewals.few.btnOpen', { n: st.rows.length });
  return t('renewals.few.btnCalled', { n: st.rows.length, c: st.called });
}

export function FewVisitsButton({ onOpen }: { onOpen: () => void }) {
  const s = useClub();
  const t = useT();
  const { fd } = useFmt();
  const { today } = useNow();
  const st = useMemo(() => fewVisitsState(s, today), [s, today]);
  if (!st.rows.length) return null;
  const grey = st.phase === 'before';
  const fg = grey ? INK : '#FFFFFF';
  return (
    <>
      <button type="button" data-testid="few-btn" data-phase={st.phase} onClick={onOpen} className={grey ? 'cp-press cp-fill' : 'cp-press'}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 36, padding: '0 8px 0 10px', borderRadius: 10, border: 'none', background: grey ? 'var(--press, #EEEEF0)' : INK, color: fg, fontFamily: 'Inter', fontSize: 14, lineHeight: '20px', fontWeight: 500, whiteSpace: 'nowrap', flex: 'none', cursor: 'pointer' }}>
        <Icon name="call" size={17} color={grey ? '#6B6259' : fg} />
        <span data-testid="few-btn-text" style={{ fontVariantNumeric: 'tabular-nums' }}>{fewButtonText(t, fd, st)}</span>
        <Icon name="chevron_right" size={18} color={grey ? '#8A8078' : fg} />
      </button>
      <span data-testid="few-divider" aria-hidden="true" style={{ width: 1, alignSelf: 'stretch', minHeight: 24, margin: '6px 4px', background: 'var(--hairline, #E2E2E6)', flex: 'none' }} />
    </>
  );
}
