// Team (management): how each role is doing on its general duties. A date picker for any day and a Day / Week / Month switch; the roles in a list with their people and
// duty score ("7 of 8 done"; for a week or month "90%"), and the chosen role's details beside it (tabs: duties, additional tasks), like the health station. Past days are worked out
// from the data (a picture taken, a check recorded…); a duty only the live state can tell shows a dash there. Today, management can also tick an additional task off for a role
// (housekeeping and the driver have no app login).
import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import type { ClubState, ISODate, Staff, StaffRole } from '@cp/shared';
import { staffCall } from '@cp/shared';
import { activityName } from '@cp/shared/rules/activity';
import { spanOf, teamRange, teamSummary, type DutyState, type TeamSpan } from '@cp/shared/rules/tasks';
import { DateField, EmptyState, Group, Icon, Segmented } from '../../components/ui';
import { useDevice } from '../../hooks/useDevice';
import { useFmt, useT, type TFn } from '../../lib/i18n';
import { TaskRow, TaskSheet, useTick, whoIs } from './parts';
import { RoleHead, RoleSplit, pct, type RoleItem } from './RoleSplit';

const RUST = '#9A3D24';
const GREEN = '#3D6B4F';

export function TeamView({ s, today, nowMin }: { s: ClubState; today: ISODate; nowMin: number }) {
  const t = useT();
  const fmt = useFmt();
  const tick = useTick();
  const [date, setDate] = useState<ISODate>(today);
  const [span, setSpan] = useState<TeamSpan>('day');
  const [tabOf, setTab] = useState<'all' | 'duties' | 'extra'>('all');
  const [openKey, setOpenKey] = useState<{ id: string; period: string } | null>(null);
  const cur = date > today ? today : date;
  const isToday = cur === today;
  const [from, to] = spanOf(span, cur);
  const day = useMemo(() => (span === 'day' ? teamSummary(s, cur, today, nowMin) : []), [s, span, cur, today, nowMin]);
  const range = useMemo(() => (span === 'day' ? [] : teamRange(s, from, to, today, nowMin)), [s, span, from, to, today, nowMin]);
  const who = (id: string) => whoIs(s, id);
  const all = day.flatMap((r) => r.custom);
  const open = openKey ? all.find((i) => i.template.id === openKey.id && i.period === openKey.period) : undefined;

  const spanText = span === 'week' ? `${fmt.fds(from)} – ${fmt.fds(to)}` : span === 'month' ? fmt.fmonth(cur.slice(0, 7), true) : '';
  const peopleOf = (people: Staff[]) => {
    const names = people.map((p) => staffCall(p)).filter(Boolean).join(', ');
    const noLogin = people.length > 0 && people.every((p) => !p.appAccess);
    return [names, noLogin ? t('tasks.noLogin') : ''].filter(Boolean).join(' · ');
  };
  // the role list: each role with its people and its score (a day: "1 of 3 done"; a week or month: "18 of 20 · 90%")
  const items: RoleItem[] = span === 'day'
    ? day.map((r) => {
      const useDuties = r.total > 0;
      const done = useDuties ? r.done : r.customDone;
      const total = useDuties ? r.total : r.customTotal;
      return { role: r.role, sub: peopleOf(r.people), done, total, late: r.late + r.customOverdue > 0, right: total ? t('tasks.progress', { done, total }) : t('tasks.nothingForRole') };
    })
    : range.map((r) => {
      const useDuties = r.total > 0;
      const done = useDuties ? r.done : r.customDone;
      const total = useDuties ? r.total : r.customTotal;
      return { role: r.role, sub: peopleOf(r.people), done, total, right: total ? `${pct(done, total)}%` : t('tasks.nothingForRole') };
    });

  const detail = (role: StaffRole) => {
    const it = items.find((x) => x.role === role)!;
    if (span === 'day') {
      const r = day.find((x) => x.role === role)!;
      // KC round 7: everything at once by default, the duties and the additional tasks in their own sections; the tabs narrow it down
      const both = r.duties.length > 0 && r.custom.length > 0;
      const shown = both ? tabOf : r.duties.length ? 'duties' : 'extra';
      const duties = r.duties.map((d, i) => <DutyLine key={d.def.id} s={s} d={d} first={i === 0} t={t} lang={fmt.lang} who={who} />);
      const extra = r.custom.map((item, i) => (
        <TaskRow key={item.template.id} item={item} date={cur} first={i === 0} who={who} canTick={isToday} busy={tick.busy === item.template.id}
          onTick={() => void tick.tick(item.template)} onOpen={() => setOpenKey({ id: item.template.id, period: item.period })} />
      ));
      return (
        <>
          <RoleHead {...it} />
          {both ? (
            <Segmented<'all' | 'duties' | 'extra'> label={t('roles.' + role)} value={shown} onChange={setTab}
              items={[{ value: 'all', label: t('tasks.allTab') }, { value: 'duties', label: t('tasks.dutiesTab'), count: r.duties.length }, { value: 'extra', label: t('tasks.additional'), count: r.custom.length }]} />
          ) : null}
          {shown !== 'extra' && r.duties.length ? <Lines title={shown === 'all' && both ? t('tasks.dutiesTab') : undefined} meta={shown === 'all' && both ? r.duties.length : undefined}>{duties}</Lines> : null}
          {shown !== 'duties' && r.custom.length ? <Lines title={shown === 'all' && both ? t('tasks.additional') : undefined} meta={shown === 'all' && both ? r.custom.length : undefined}>{extra}</Lines> : null}
        </>
      );
    }
    const r = range.find((x) => x.role === role)!;
    return (
      <>
        <RoleHead {...it} right={it.total ? t('tasks.spanScore', { done: it.done ?? 0, total: it.total, pct: pct(it.done ?? 0, it.total) }) : it.right} />
        <Lines>
          {r.duties.map((d, i) => (
            <ScoreLine key={d.def.id} id={d.def.id} icon={d.def.icon} title={t(d.def.titleKey)} first={i === 0}
              right={d.na ? '—' : t('tasks.spanScore', { done: d.done, total: d.total, pct: pct(d.done, d.total) })} tone={d.na ? 'muted' : d.done >= d.total ? 'good' : 'plain'} hint={d.na ? t('tasks.notTracked') : undefined} />
          ))}
          {r.customTotal ? <ScoreLine id="additional" icon="checklist" title={t('tasks.additionalScore')} first={!r.duties.length} right={t('tasks.spanScore', { done: r.customDone, total: r.customTotal, pct: pct(r.customDone, r.customTotal) })} tone={r.customDone >= r.customTotal ? 'good' : 'plain'} /> : null}
        </Lines>
      </>
    );
  };

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 170px', minWidth: 0, maxWidth: 260 }}>
            <DateField value={cur} onChange={(v) => v && setDate(v)} max={today} ariaLabel={t('tasks.date')} compact />
          </div>
          <Segmented<TeamSpan> label={t('tasks.title')} value={span} onChange={setSpan}
            items={[{ value: 'day', label: t('tasks.day') }, { value: 'week', label: t('tasks.week') }, { value: 'month', label: t('tasks.month') }]} />
        </div>
        {spanText ? <div style={{ fontSize: 13, lineHeight: '18px', color: '#6B6259', padding: '0 2px' }}>{isToday && span !== 'day' ? `${spanText} · ${t('tasks.today')}` : spanText}</div> : null}
      </div>

      {items.length === 0 ? <EmptyState icon="checklist" title={t('tasks.teamEmpty')} /> : (
        <RoleSplit items={items} listTitle={t('tasks.rolesList')} back={t('tasks.team')} render={detail} />
      )}
      {open ? (
        <TaskSheet key={open.template.id + open.period} item={open} date={cur} who={who} canTick={isToday} canUndo={!!open.done} tick={tick} onClose={() => setOpenKey(null)} />
      ) : null}
      {tick.camera}
    </>
  );
}

/** The rows of a role's details: a white grouped list on a phone, edge to edge inside the details card on wider screens. */
export function Lines({ title, meta, children }: { /** a section title above the rows (the "All" view: duties, then additional tasks) */ title?: string; meta?: ReactNode; children: ReactNode }) {
  const { isPhone } = useDevice();
  if (isPhone) return <Group title={title} meta={meta} pad={0} gap={0}>{children}</Group>;
  return (
    <section data-section={title ? 'titled' : undefined} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {title ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, padding: '4px 0 2px' }}>
          <span style={{ fontSize: 12, lineHeight: '16px', letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 500, color: '#6E5A43' }}>{title}</span>
          {meta != null ? <span style={{ fontSize: 13, color: '#6B6259' }}>{meta}</span> : null}
        </div>
      ) : null}
      <div style={{ margin: '0 -20px' }}>{children}</div>
    </section>
  );
}

// ---------- pieces ----------
const lineStyle = (first: boolean): CSSProperties => ({ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px 8px 16px', minHeight: 52, backgroundColor: '#FFFFFF', backgroundImage: first ? 'none' : 'linear-gradient(#EFEAE3, #EFEAE3)', backgroundSize: 'calc(100% - 32px) 1px', backgroundPosition: 'right top', backgroundRepeat: 'no-repeat' });
/** A duty with a score on the right (a week or month: "18 of 20 · 90%"; a day: "1 of 2"). */
function ScoreLine({ id, icon, title, sub, right, tone, first, hint }: { id: string; icon: string; title: string; sub?: string; right: string; tone: 'good' | 'late' | 'plain' | 'muted'; first: boolean; hint?: string }) {
  const color = tone === 'good' ? GREEN : tone === 'late' ? RUST : tone === 'muted' ? '#8A8078' : '#4A4038';
  return (
    <div data-duty={id} style={lineStyle(first)} title={hint}>
      <span aria-hidden="true" style={{ width: 28, height: 28, borderRadius: 999, background: tone === 'good' ? '#E3EFE6' : '#F3EEE8', color: tone === 'good' ? GREEN : '#75624B', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><Icon name={tone === 'good' ? 'check' : icon} size={17} fill={tone === 'good' ? 0 : 1} /></span>
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <span style={{ fontSize: 15, lineHeight: '21px', fontWeight: 500, overflowWrap: 'anywhere' }}>{title}</span>
        {sub ? <span style={{ fontSize: 13, lineHeight: '18px', color: tone === 'late' ? RUST : '#6B6259', overflowWrap: 'anywhere' }}>{sub}</span> : null}
      </span>
      <span aria-label={hint} style={{ flex: 'none', fontSize: 13, lineHeight: '18px', fontWeight: 500, fontVariantNumeric: 'tabular-nums', color, display: 'flex', alignItems: 'center', gap: 6 }}>
        {tone === 'late' ? <span aria-hidden="true" data-late style={{ width: 6, height: 6, borderRadius: 999, background: RUST }} /> : null}
        {right}
      </span>
    </div>
  );
}
/** One duty on one day: its title, what is missing (the sessions or guests still open, or how many are left and the time), and "1 of 2". A past duty the app cannot tell shows a dash. */
function DutyLine({ s, d, first, t, lang, who }: { s: ClubState; d: DutyState; first: boolean; t: TFn; lang: 'en' | 'id'; who: (id: string) => string }) {
  const title = t(d.def.titleKey);
  if (d.status === 'past') return <ScoreLine id={d.def.id} icon={d.def.icon} title={title} first={first} right="—" tone="muted" hint={t('tasks.notTracked')} />;
  const label = (p: DutyState['parts'][number]) => (p.activityId && s.activities[p.activityId] ? activityName(s.activities[p.activityId], lang) : String(p.params.name ?? p.params.activity ?? ''));
  const missing = d.parts.filter((p) => !p.done);
  const single = d.parts.length === 1 ? d.parts[0] : null;
  let sub = '';
  if (d.status === 'done') sub = single?.by && single.at ? t('tasks.doneBy', { name: who(single.by), t: single.at }) : single?.at ? t('tasks.doneAtOnly', { t: single.at }) : '';
  else if (d.def.every !== 'day') sub = missing.map(label).filter(Boolean).join(', ');
  else if (single) sub = [single.count ? t('tasks.left', { n: single.count.total - single.count.done }) : '', t('tasks.by', { t: single.due })].filter(Boolean).join(' · ');
  const count = d.def.every === 'day' && single?.count ? t('tasks.ofDone', { done: single.count.done, total: single.count.total }) : t('tasks.ofDone', { done: d.done, total: d.total });
  return <ScoreLine id={d.def.id} icon={d.def.icon} title={title} sub={sub} first={first} right={count} tone={d.status === 'done' ? 'good' : d.status === 'late' ? 'late' : 'plain'} />;
}
