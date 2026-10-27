// Next month, Members tab (round 15, KC: "show the list of members and their plan; if they do nothing it continues; if someone wants to change, we can mark it").
// Every member who is in next month with the plan they have, and what happens: Continues, → Gold, On leave, Stops. A tap records a change for that member.
import { useMemo, useState } from 'react';
import { listName, memberName, type YM } from '@cp/shared';
import { renewalMembers, nextMonthPlans, type NextMonthRow } from '@cp/shared/rules/renewals';
import { activePlans } from '@cp/shared/rules/members';
import { Avatar, EmptyState, Select } from '../../components/ui';
import { useDevice } from '../../hooks/useDevice';
import { useNow } from '../../lib/clock';
import { useT } from '../../lib/i18n';
import { memberPhoto } from '../../lib/media';
import { useClub } from '../../store/replica';
import { FollowUpSheet } from './FollowUpSheet';

type Filter = 'all' | 'continues' | 'changing';
const FILTERS: Filter[] = ['all', 'continues', 'changing'];

export function NextMonthList({ month }: { month: YM }) {
  const s = useClub();
  const t = useT();
  const { today } = useNow();
  const { isPhone } = useDevice();
  const [filter, setFilter] = useState<Filter>('all');
  const [open, setOpen] = useState<string | null>(null);
  const all = useMemo(() => nextMonthPlans(s, today), [s, today]);
  /** the members a change can be recorded for (a new member who starts on the 1st has no follow-up to open) */
  const followable = useMemo(() => new Set(renewalMembers(s, month).map((m) => m.id)), [s, month]);
  const plans = activePlans(s);
  const planName = (p: string) => { const k = plans.find((x) => x.id === p)?.label; return k ? t(k) : p; };
  const continuing = all.filter((r) => r.status === 'continues').length;
  const rows = all.filter((r) => filter === 'all' || (filter === 'continues') === (r.status === 'continues'));

  const statusText = (r: NextMonthRow) => r.status === 'plan' ? t('renewals.toPlan', { plan: planName(r.planNext!) }) : r.status === 'leave' ? t('renewals.onLeave') : r.status === 'stop' ? t('renewals.stops') : t('renewals.continues');
  const rowEl = (r: NextMonthRow, i: number) => {
    const m = r.member;
    const name = listName(m);
    const tappable = followable.has(m.id);
    const inner = (
      <>
        <Avatar name={memberName(m)} member={m} tone={m.photoTone} src={memberPhoto(m)} size={42} />
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span style={{ fontSize: 16, lineHeight: '22px', fontWeight: 500, overflowWrap: 'anywhere' }}>{name}</span>
          <span data-testid="next-plan" style={{ fontSize: 13, lineHeight: '19px', color: '#6B6259' }}>{planName(r.planNow)}</span>
        </span>
        <span data-testid="next-status" style={{ flex: 'none', fontSize: 14, lineHeight: '20px', fontWeight: r.status === 'continues' ? 400 : 500, color: r.status === 'continues' ? '#6B6259' : '#24201C' }}>{statusText(r)}</span>
      </>
    );
    const style = { display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 56, boxSizing: 'border-box', padding: isPhone ? '8px 16px' : '8px 0', border: 'none', background: 'transparent', textAlign: 'left', fontFamily: 'Inter', color: '#24201C', borderTop: i && !isPhone ? '0.5px solid var(--hairline, #E2E2E6)' : 'none', backgroundImage: i && isPhone ? 'linear-gradient(var(--hairline, #E2E2E6), #E2E2E6)' : 'none', backgroundSize: 'calc(100% - 70px) 0.5px', backgroundPosition: 'right top', backgroundRepeat: 'no-repeat' } as const;
    return tappable
      ? <button key={m.id} type="button" data-member={m.id} data-status={r.status} aria-label={name} onClick={() => setOpen(m.id)} className="cp-tap" style={{ ...style, cursor: 'pointer' }}>{inner}</button>
      : <div key={m.id} data-member={m.id} data-status={r.status} style={style}>{inner}</div>;
  };

  return (
    <div data-testid="next-month-list" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: isPhone ? '1 1 140px' : '0 0 200px' }}>
          <Select ariaLabel={t('renewals.segLabel')} value={filter} onChange={setFilter} options={FILTERS.map((f) => ({ value: f, label: t(`renewals.f.${f}`) }))} />
        </div>
        <span data-testid="next-count" style={{ fontSize: 13, lineHeight: '18px', color: '#6B6259', fontVariantNumeric: 'tabular-nums' }}>{t('renewals.countLine', { c: continuing, n: all.length - continuing })}</span>
      </div>
      {rows.length
        ? <div className="cp-grey" style={{ background: 'var(--fill, #F4F4F5)', borderRadius: 16, overflow: 'hidden', padding: isPhone ? 0 : '4px clamp(18px, 3vw, 28px)' }}>{rows.map(rowEl)}</div>
        : <EmptyState icon="group" title={t('renewals.noMatch')} />}
      {open ? <FollowUpSheet memberId={open} month={month} onClose={() => setOpen(null)} /> : null}
    </div>
  );
}
