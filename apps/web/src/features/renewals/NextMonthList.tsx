// Next month, Members tab (round 15, KC: "show the list of members and their plan; if they do nothing it continues; if someone wants to change, we can mark it").
// KC (28 Oct): "the goal is to know what is our plan for next month, so the plan should be more visible, and should have a quick action to message or call".
// Every member with next month's plan up front: the plan name when it continues, an ink badge when something changes (Flex → Gold, On leave, Stops 31 Oct),
// a count of next month's plans on top, and Call / WhatsApp for the family contact on each row. A tap on the member records a change.
import { useMemo, useState, type ReactNode } from 'react';
import { contactsOfMember, isPendingRow, listName, memberName, waUrl, type Plan, type YM } from '@cp/shared';
import { renewalMembers, nextMonthPlans, type NextMonthRow } from '@cp/shared/rules/renewals';
import { planDefs, planLabel } from '@cp/shared/rules/plans';
import { Avatar, EmptyState, Icon } from '../../components/ui';
import { useDevice } from '../../hooks/useDevice';
import { useNow } from '../../lib/clock';
import { useFmt, useLang, useT } from '../../lib/i18n';
import { memberPhoto } from '../../lib/media';
import { useClub } from '../../store/replica';
import { FollowUpSheet } from './FollowUpSheet';

type Filter = 'all' | 'continues' | 'changing';
/** a plan id, or 'leave' / 'stop' */
type PlanPick = string | null;
const INK = '#24201C';
const MUTED = '#6B6259';
const badge = { display: 'inline-flex', alignSelf: 'flex-start', alignItems: 'center', gap: 4, padding: '2px 10px', borderRadius: 999, background: INK, color: '#FFFFFF', fontSize: 13, lineHeight: '20px', fontWeight: 500, whiteSpace: 'nowrap' } as const;

export function NextMonthList({ month }: { month: YM }) {
  const s = useClub();
  const t = useT();
  const lang = useLang();
  const { fd } = useFmt();
  const { today } = useNow();
  const { isPhone } = useDevice();
  const [filter, setFilter] = useState<Filter>('all');
  const [pick, setPick] = useState<PlanPick>(null);
  const [open, setOpen] = useState<string | null>(null);
  const all = useMemo(() => nextMonthPlans(s, today), [s, today]);
  /** the members a change can be recorded for (a new member who starts on the 1st has no follow-up to open) */
  const followable = useMemo(() => new Set(renewalMembers(s, month).map((m) => m.id)), [s, month]);
  const planName = (p: Plan) => planLabel(s, p, lang);
  const continuing = all.filter((r) => r.status === 'continues').length;
  /** what a summary chip counts: next month's plan for members who are in, else on leave or stopping */
  const pickOf = (r: NextMonthRow): string | null => (r.status === 'stop' ? 'stop' : r.status === 'leave' ? 'leave' : r.planNext);
  const rows = all.filter((r) => (filter === 'all' || (filter === 'continues') === (r.status === 'continues')) && (!pick || pickOf(r) === pick));

  /** next month at a glance: how many on each plan (in the catalogue's order), then on leave and stopping */
  const summary = useMemo(() => {
    const by = new Map<Plan, number>();
    let leave = 0, stop = 0;
    for (const r of all) {
      const k = pickOf(r);
      if (k === 'stop') stop++;
      else if (k === 'leave') leave++;
      else if (k) by.set(k as Plan, (by.get(k as Plan) ?? 0) + 1);
    }
    const plans = planDefs(s).filter((p) => by.get(p.id)).map((p) => ({ key: p.id, label: planLabel(s, p.id, lang), n: by.get(p.id)! }));
    return [...plans, ...(leave ? [{ key: 'leave', label: t('renewals.onLeave'), n: leave }] : []), ...(stop ? [{ key: 'stop', label: t('renewals.stops'), n: stop }] : [])];
  }, [all, s, lang, t]);

  /** the family member to call: the primary one with an approved link first */
  const contactOf = (memberId: string) => {
    const cs = contactsOfMember(s, memberId);
    return (cs.find((x) => !isPendingRow(x.link) && !isPendingRow(x.contact)) ?? cs[0])?.contact;
  };

  /** next month's plan, up front: the plan name when it continues, an ink badge when something changes */
  const planLine = (r: NextMonthRow) => {
    const stopsOn = r.lastDay ? t('renewals.stopsOn', { d: fd(r.lastDay, { day: 'numeric', month: 'short' }) }) : t('renewals.stops');
    if (r.status === 'plan') return (
      <span data-testid="next-status" style={badge}>
        <span style={{ fontWeight: 400, opacity: 0.75 }}>{planName(r.planNow)}</span>→<span data-testid="next-plan">{planName(r.planNext!)}</span>
      </span>
    );
    if (r.status === 'leave' || r.status === 'stop') return (
      <span style={{ display: 'inline-flex', alignSelf: 'flex-start', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span data-testid="next-status" style={badge}>{r.status === 'leave' ? t('renewals.onLeave') : stopsOn}</span>
        <span data-testid="next-plan" style={{ fontSize: 13, color: MUTED }}>{planName(r.planNext ?? r.planNow)}</span>
      </span>
    );
    return (
      <span style={{ display: 'inline-flex', alignSelf: 'flex-start', alignItems: 'baseline', gap: 6 }}>
        <span data-testid="next-plan" style={{ fontSize: 15, lineHeight: '22px', fontWeight: 600, color: INK }}>{planName(r.planNext ?? r.planNow)}</span>
        <span data-testid="next-status" style={{ fontSize: 13, color: MUTED }}>{t('renewals.continues')}</span>
      </span>
    );
  };

  /** a tap-to-filter chip: ink when on, tap again to clear */
  const chip = (on: boolean, onClick: () => void, children: ReactNode, data: Record<string, string>) => (
    <button key={Object.values(data)[0]} type="button" aria-pressed={on} onClick={onClick} className={on ? undefined : 'cp-fill'} {...data}
      style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6, minHeight: 36, padding: '7px 14px', borderRadius: 999, border: 'none', cursor: 'pointer', fontFamily: 'Inter', fontSize: 14, lineHeight: '20px', background: on ? INK : 'var(--fill, #F4F4F5)', color: on ? '#FFFFFF' : INK, whiteSpace: 'nowrap', flex: 'none' }}>
      {children}
    </button>
  );
  const round = (size: number) => ({ width: size, height: size, borderRadius: 999, background: 'var(--fill, #F4F4F5)', color: INK, display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', flex: 'none' }) as const;
  const rowEl = (r: NextMonthRow, i: number) => {
    const m = r.member;
    const name = listName(m);
    const c = contactOf(m.id);
    const wa = c ? waUrl(c.phone) : null;
    const size = isPhone ? 40 : 38;
    const main = (
      <>
        <Avatar name={memberName(m)} member={m} tone={m.photoTone} src={memberPhoto(m)} size={42} />
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ fontSize: 16, lineHeight: '22px', fontWeight: 500, overflowWrap: 'anywhere' }}>{name}</span>
          {planLine(r)}
        </span>
      </>
    );
    const mainStyle = { flex: '1 1 0', minWidth: 0, display: 'flex', alignItems: 'center', gap: 12, padding: 0, border: 'none', background: 'transparent', textAlign: 'left', fontFamily: 'Inter', color: INK, minHeight: 44 } as const;
    return (
      <div key={m.id} data-member={m.id} data-status={r.status} className={followable.has(m.id) ? 'cp-tap' : undefined}
        style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', minHeight: 60, boxSizing: 'border-box', padding: isPhone ? '8px 12px 8px 16px' : '8px 0', borderTop: i && !isPhone ? '0.5px solid var(--hairline, #E2E2E6)' : 'none', backgroundImage: i && isPhone ? 'linear-gradient(var(--hairline, #E2E2E6), #E2E2E6)' : 'none', backgroundSize: 'calc(100% - 70px) 0.5px', backgroundPosition: 'right top', backgroundRepeat: 'no-repeat' }}>
        {followable.has(m.id)
          ? <button type="button" data-open={m.id} aria-label={name} onClick={() => setOpen(m.id)} className="cp-tap-target" style={{ ...mainStyle, cursor: 'pointer' }}>{main}</button>
          : <div style={mainStyle}>{main}</div>}
        {c ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 'none' }}>
            <a href={`tel:${c.phone}`} data-testid="next-call" aria-label={t('renewals.callWho', { name: c.name })} title={t('renewals.callWho', { name: c.name })} className={isPhone ? 'cp-press cp-fill' : 'h-fill cp-fill'} style={round(size)}><Icon name="call" size={19} /></a>
            {wa ? <a href={wa} target="_blank" rel="noreferrer" data-testid="next-wa" aria-label={t('renewals.waWho', { name: c.name })} title={t('renewals.waWho', { name: c.name })} className={isPhone ? 'cp-press cp-fill' : 'h-fill cp-fill'} style={round(size)}><Icon name="chat" size={19} /></a> : null}
          </span>
        ) : null}
      </div>
    );
  };

  return (
    <div data-testid="next-month-list" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div role="group" aria-label={t('renewals.nextPlans')} data-testid="next-plans" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: isPhone ? 'nowrap' : 'wrap', overflowX: isPhone ? 'auto' : undefined, margin: isPhone ? '0 -16px' : undefined, padding: isPhone ? '0 16px' : undefined, scrollbarWidth: 'none' }}>
        <span style={{ fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase', color: MUTED, fontWeight: 600, marginRight: 4, flex: 'none' }}>{t('renewals.nextPlans')}</span>
        {summary.map((x) => chip(pick === x.key, () => setPick(pick === x.key ? null : x.key), <><span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{x.n}</span>{x.label}</>, { 'data-plan-count': x.key }))}
      </div>
      <div role="group" aria-label={t('renewals.segLabel')} data-testid="next-count" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {chip(filter === 'continues', () => setFilter(filter === 'continues' ? 'all' : 'continues'), <><span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{continuing}</span>{t('renewals.chip.continues')}</>, { 'data-filter': 'continues' })}
        {chip(filter === 'changing', () => setFilter(filter === 'changing' ? 'all' : 'changing'), <><span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{all.length - continuing}</span>{t('renewals.chip.changing')}</>, { 'data-filter': 'changing' })}
      </div>
      {rows.length
        ? <div className="cp-grey" style={{ background: 'var(--fill, #F4F4F5)', borderRadius: 16, overflow: 'hidden', padding: isPhone ? 0 : '4px clamp(18px, 3vw, 28px)' }}>{rows.map(rowEl)}</div>
        : <EmptyState icon="group" title={t('renewals.noMatch')} />}
      {open ? <FollowUpSheet memberId={open} month={month} onClose={() => setOpen(null)} /> : null}
    </div>
  );
}
