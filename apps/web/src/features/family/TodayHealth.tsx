// "Health" on Today (round 8d, KC: "Today should also put the health status for that day; that section has a button to the Health page"): right after the daily
// log, a soft card per parent who came that day with the checks the nurse did, in time order. Each check says when it was (on arrival, before leaving, a re-check),
// who took it, its grade as a pill in the family colours (Normal / Watch / Alert) and what was measured: blood pressure, oxygen, temperature, pulse (and glucose or
// weight when the monthly check took them), a number the nurse flagged in the grade's colour. A parent who came with no check says so in one quiet line; a day nobody
// came has no section. A button opens that parent on the Health tab (`/health?member=<id>`). Families only ever read approved readings (famHealth.dayChecks).
import { useNavigate } from 'react-router-dom';
import { limitsFor, memberName, displayName, staffCall, type Health, type ISODate, type Member } from '@cp/shared';
import type { DayStory } from '@cp/shared/rules/family';
import { dayChecks, worstCheck, type DayCheck, type HMetric } from '@cp/shared/rules/famHealth';
import { Avatar, Icon } from '../../components/ui';
import { memberPhoto } from '../../lib/media';
import { Cap, F, FillCard, HAIR } from './kit';
import { PALETTE } from './health/bits';
import { useFamilyCtx } from './useFamily';

const UNIT: Partial<Record<HMetric, (v: string) => string>> = { spo2: (v) => `${v}%`, temp: (v) => `${v}°`, weight: (v) => `${v} kg` };

/** The grade as a small pill: its tint, its icon and its word. */
export function StatusPill({ status }: { status: Health }) {
  const { t } = useFamilyCtx();
  const pal = PALETTE[status];
  return (
    <span data-testid="health-pill" data-status={status} style={{ flex: 'none', height: 24, padding: '0 10px 0 8px', borderRadius: 999, background: pal.bg, color: pal.fg, display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
      <Icon name={pal.icon} size={14} fill={1} color={pal.fg} />{t('status.' + status)}
    </span>
  );
}

function Check({ c, first }: { c: DayCheck; first: boolean }) {
  const { s, t } = useFamilyCtx();
  const by = c.by ? staffCall(s.staff[c.by]) : '';
  return (
    <div data-testid="health-check" data-kind={c.kind} data-status={c.status ?? ''} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 16px 14px', borderTop: first ? 'none' : HAIR }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.35, color: F.text }}>{t('ftoday.hcKind_' + c.kind)} <span style={{ fontWeight: 400, color: F.muted, fontSize: 13 }}>{c.time}</span></span>
          {by ? <span style={{ fontSize: 12, lineHeight: 1.35, color: F.muted }}>{t('ftoday.hcBy', { n: by })}</span> : null}
        </span>
        {c.status ? <StatusPill status={c.status} /> : null}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 6 }}>
        {c.parts.map((p) => {
          const flagged = p.status === 'watch' || p.status === 'alert' ? p.status : null;
          return (
            <span key={p.metric} data-testid="health-part" data-metric={p.metric} data-status={p.status ?? ''} style={{ background: '#FFFFFF', borderRadius: 14, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
              <span style={{ fontSize: 12, lineHeight: 1.3, color: F.muted }}>{t(p.metric === 'bp' || p.metric === 'temp' ? 'fhealth.s_' + p.metric : 'fhealth.m_' + p.metric)}</span>
              <span style={{ fontSize: 18, lineHeight: 1.3, fontVariantNumeric: 'tabular-nums', color: flagged ? PALETTE[flagged].fg : F.text, fontWeight: flagged ? 600 : 400, whiteSpace: 'nowrap' }}>{UNIT[p.metric]?.(p.text) ?? p.text}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

function Block({ m, checks, multi, isToday }: { m: Member; checks: DayCheck[]; multi: boolean; isToday: boolean }) {
  const { t } = useFamilyCtx();
  const navigate = useNavigate();
  return (
    <div data-testid="health-block" data-member={m.id} data-status={worstCheck(checks) ?? ''} data-checks={checks.length}>
      <FillCard radius={22} pad={0} gap={0} style={{ overflow: 'hidden' }}>
        {multi ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px 6px' }}>
            <Avatar name={memberName(m)} src={memberPhoto(m)} tone={m.photoTone} size={28} />
            <span style={{ fontSize: 15, fontWeight: 600, color: F.text }}>{displayName(m)}</span>
          </div>
        ) : null}
        {checks.length
          ? checks.map((c, i) => <Check key={c.id} c={c} first={!multi && i === 0} />)
          : <p data-testid="health-none" style={{ margin: 0, padding: multi ? '4px 16px 14px' : '16px', fontSize: 14, lineHeight: '20px', color: F.muted }}>{t(isToday ? 'ftoday.hcNoneToday' : 'ftoday.hcNone')}</p>}
        <button type="button" onClick={() => navigate(`/health?member=${m.id}`)} data-testid="health-open" data-member={m.id} className="cp-press cp-fill"
          style={{ margin: '0 12px 12px', height: 44, borderRadius: 999, border: 'none', background: '#FFFFFF', color: F.ink, fontSize: 15, fontWeight: 600, fontFamily: 'Inter, system-ui, sans-serif', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '0 16px' }}>
          {multi ? t('ftoday.hcOpenFor', { n: displayName(m) }) : t('ftoday.hcOpen')}
          <Icon name="chevron_right" size={20} color={F.ink} />
        </button>
      </FillCard>
    </div>
  );
}

/**
 * The "Health" section: a card per parent who came on `date` (the day's checks and a button to the Health tab); nothing when no parent came.
 * `stories[i]` is `members[i]`'s day.
 */
export function TodayHealthSection({ members, stories, date }: { members: Member[]; stories: DayStory[]; date: ISODate }) {
  const { s, t, now } = useFamilyCtx();
  const rows = members.map((m, i) => ({ m, came: stories[i].visited })).filter((x) => x.came);
  if (!rows.length) return null;
  return (
    <section data-testid="today-health" data-day={date} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Cap>{t('ftoday.hcTitle')}</Cap>
      {rows.map(({ m }) => <Block key={m.id} m={m} checks={dayChecks(s, m.id, date, limitsFor(s, m))} multi={members.length > 1} isToday={date === now.today} />)}
    </section>
  );
}
