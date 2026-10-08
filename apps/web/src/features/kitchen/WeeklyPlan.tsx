// Weekly menu plan: the template editor (explicit Publish, never per keystroke) plus one-off changes for a single date.
// A week switcher plans coming weeks: the weekly menu is a template that repeats until another one starts, so a plan for a coming week
// is published from that week's Monday and carries on after it. Edits are kept per week while the page is open.
import { useMemo, useState } from 'react';
import { addDays, dayStatus, diffDays, live, weekStart, type ISODate, type Weekday } from '@cp/shared';
import { isWaiting } from '@cp/shared/rules/approvals';
import { PendingMark } from '../../components/PendingMark';
import { useMe } from '../../lib/me';
import { COURSES, MAX_PLAN_WEEKS, WEEKDAYS, diffTemplates, planStartFor, sameIds, templateForWeek, weekDate, type Course, type MenuChange, type WeekTemplate } from '@cp/shared/rules/kitchenOps';
import { Button, Card, CardHead, ChipGroup, DateField, Dialog, Group, Icon, Note, Pager, SectionLabel, Toggle, usePaged, FONT_BODY } from '../../components/ui';
import { useT, useFmt } from '../../lib/i18n';
import { useAct } from '../../lib/act';
import { useNow } from '../../lib/clock';
import { useClub } from '../../store/replica';
import { DishField, DishPicker } from './dish';
import { OverrideSheet } from './OverrideSheet';
import { OutlineButton, RowPill, TextButton, useResetOn } from './parts';
import { usePlanVals } from './vals';

const key = (w: Weekday, c: Course) => `${w}:${c}`;
type Edits = Record<string, string[]>;
const NO_EDITS: Edits = {};
const withEdits = (base: WeekTemplate, e: Edits): WeekTemplate => {
  const out = {} as WeekTemplate;
  for (const w of WEEKDAYS) out[w] = { lunch: e[key(w, 'lunch')] ?? base[w].lunch, soft: e[key(w, 'soft')] ?? base[w].soft, tea: e[key(w, 'tea')] ?? base[w].tea };
  return out;
};

/** Draft edits on top of the menu of the week shown. Only cells that differ are stored, so untouched cells follow the live menu. */
export function usePlanEditor() {
  const s = useClub();
  const { today } = useNow();
  const thisMonday = weekStart(today);
  const [ahead, setAhead] = useState(0); // weeks after the current one
  const offset = Math.min(Math.max(ahead, 0), MAX_PLAN_WEEKS);
  const week = addDays(thisMonday, offset * 7);
  const v = usePlanVals(week);
  const [all, setAll] = useState<Record<ISODate, Edits>>({}); // unpublished edits, per week
  const edits = all[week] ?? NO_EDITS;
  const base = v.days;
  const cur = (w: Weekday, c: Course) => edits[key(w, c)] ?? base[w][c];
  const setCell = (w: Weekday, c: Course, ids: string[]) => setAll((a) => {
    const e = { ...(a[week] ?? NO_EDITS) };
    if (sameIds(ids, base[w][c])) delete e[key(w, c)]; else e[key(w, c)] = ids;
    const n = { ...a };
    if (Object.keys(e).length) n[week] = e; else delete n[week];
    return n;
  });
  const draft = useMemo(() => withEdits(base, edits), [edits, base]);
  const changes = useMemo(() => diffTemplates(base, draft), [base, draft]);
  // other weeks that have unpublished edits (so they are not forgotten when the switcher moves away from them)
  const others = useMemo(() => Object.keys(all).filter((w) => w !== week).map((w) => { const b = templateForWeek(s, w, today); return { week: w, n: diffTemplates(b, withEdits(b, all[w])).length }; }).filter((x) => x.n > 0), [all, week, s, today]);
  const discard = () => setAll((a) => { const n = { ...a }; delete n[week]; return n; });
  return { vals: v, week, offset, thisMonday, goto: (w: ISODate) => setAhead(diffDays(thisMonday, w) / 7), setAhead, cur, setCell, draft, changes, others, discard };
}
export type PlanEditor = ReturnType<typeof usePlanEditor>;

/** "This week", "Next week", "Week of Mon 9 Nov". */
function useWeekName() {
  const t = useT();
  return (offset: number, week: ISODate) => (offset === 0 ? t('kitchen.plan.thisWeek') : offset === 1 ? t('kitchen.plan.nextWeek') : t('kitchen.plan.weekOf', { date: week }));
}

export function WeeklyPlan({ editor, onPublish, isPhone, readOnly = false }: { editor: PlanEditor; onPublish: () => void; isPhone: boolean; readOnly?: boolean }) {
  const t = useT();
  const { fd, fds } = useFmt();
  const s = useClub();
  const act = useAct();
  const weekName = useWeekName();
  const { vals: v, week, offset, cur, setCell, changes, others, discard } = editor;
  const [picker, setPicker] = useState<{ w: Weekday; c: Course } | null>(null);
  const [override, setOverride] = useState<string | null>(null);
  const dayName = (w: Weekday) => fd(weekDate(week, w), { weekday: 'long' });
  const short = (d: ISODate) => fd(d, { day: 'numeric', month: 'short' });
  const overrides = usePaged(v.overrides, 5);
  const waiting = live(s.menuVersions).filter((x) => x.status === 'published' && isWaiting(x)); // weekly menus waiting for management's approval
  const dishName = (id: string) => s.dishes[id]?.name ?? id;
  const clearOverride = async (date: string) => { await act('dayMenu.override', { date, lunch: null, soft: null, tea: null }, { ok: t('kitchen.override.reset') }); };
  const field = (w: Weekday, c: Course, flex: string) => (
    <DishField label={t('kitchen.course.' + c)} course={c} ids={cur(w, c)} flex={flex} testId={`plan-${w}-${c}`} date={weekDate(week, w)} readOnly={readOnly}
      onRemove={(id) => setCell(w, c, cur(w, c).filter((x) => x !== id))} onAdd={() => setPicker({ w, c })} />
  );
  const planTop = (
    <>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <WeekButton icon="chevron_left" label={t('kitchen.plan.prevWeek')} disabled={offset === 0} onClick={() => editor.setAhead(offset - 1)} />
          <div data-testid="plan-week" aria-live="polite" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, textAlign: 'center' }}>
            <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.4 }}>{weekName(offset, week)}</span>
            <span style={{ fontSize: FONT_BODY, color: '#5E5852', lineHeight: 1.4 }}>{short(week)} – {short(weekDate(week, 5))}</span>
          </div>
          <WeekButton icon="chevron_right" label={t('kitchen.plan.nextWeek')} disabled={offset >= MAX_PLAN_WEEKS} onClick={() => editor.setAhead(offset + 1)} />
        </div>
        {waiting.map((w) => <Note key={w.id} tone="ochre" icon="hourglass_top">{t('approvals.menuWaiting', { date: fds(w.effectiveFrom) })}</Note>)}
        {v.scheduled.length ? <Note tone="ochre" icon="schedule">{t('kitchen.plan.scheduled', { date: fds(v.scheduled[0].effectiveFrom) })}</Note> : null}
        {others.length ? (
          <Note tone="ochre" icon="edit_note">
            <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 4 }}>
              {t('kitchen.plan.otherWeeks')}
              {others.map((o) => {
                const off = diffDays(editor.thisMonday, o.week) / 7;
                return <TextButton key={o.week} onClick={() => editor.goto(o.week)} label={t('kitchen.plan.jumpAria', { week: weekName(off, o.week), n: o.n })}>{weekName(off, o.week)} · {o.n}</TextButton>;
              })}
            </span>
          </Note>
        ) : null}
    </>
  );
  const dialogs = (
    <>
      {picker ? (
        <DishPicker open onClose={() => setPicker(null)} title={t('kitchen.picker.titleDay', { course: t('kitchen.course.' + picker.c), day: dayName(picker.w) })} course={picker.c} picked={cur(picker.w, picker.c)} date={weekDate(week, picker.w)}
          onToggle={(id) => setCell(picker.w, picker.c, cur(picker.w, picker.c).includes(id) ? cur(picker.w, picker.c).filter((x) => x !== id) : [...cur(picker.w, picker.c), id])}
          onCreated={(id) => setCell(picker.w, picker.c, [...cur(picker.w, picker.c), id])} />
      ) : null}
      <OverrideSheet open={override !== null} initialDate={override ?? v.today} onClose={() => setOverride(null)} />
    </>
  );
  // round 6, phone: iOS grouped sections. The week switcher and its notes first, then one section per weekday (day name outside, its three courses inside),
  // the unpublished bar, and the one-off changes. Publishing is the pinned "Publish menu" pill of the page.
  if (isPhone) {
    return (
      <>
        <Group title={t('kitchen.plan.title')} meta={changes.length ? t('kitchen.plan.unpublished', { n: changes.length }) : undefined} gap={10}>
          {planTop}
        </Group>
        {WEEKDAYS.map((w) => {
          const date = weekDate(week, w);
          const closed = !dayStatus(s, date).open;
          return (
            <div key={w} data-testid={`plan-day-${w}`} data-day={date}>
              <Group title={dayName(w)} gap={12}
                meta={(
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                    {date === v.today ? <span style={{ color: '#3D6B4F', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 5 }}><span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: 999, background: '#3D6B4F' }} />{t('kitchen.plan.today')}</span> : null}
                    {closed ? <span style={{ color: '#8A8078', fontWeight: 500 }}>{t('kitchen.plan.closed')}</span> : null}
                    <span data-testid={`plan-date-${w}`}>{short(date)}</span>
                  </span>
                )}>
                {field(w, 'lunch', 'none')}
                {field(w, 'soft', 'none')}
                {field(w, 'tea', 'none')}
              </Group>
            </div>
          );
        })}
        {changes.length ? (
          <Group pad="10px 16px" gap={0}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ flex: 1, minWidth: 0, fontSize: 16, lineHeight: '22px' }}>{t('kitchen.plan.unpublished', { n: changes.length })}</span>
              <Button variant="ghost" size={44} onClick={discard}>{t('kitchen.plan.discard')}</Button>
            </div>
          </Group>
        ) : null}
        <Group title={t('kitchen.plan.oneOffTitle')} pad="0 16px" gap={0}>
          {v.overrides.length ? overrides.rows.map((o, i) => (
            <div key={o.date} data-testid="override-row" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 0', borderTop: i === 0 ? 'none' : '1px solid #EFEAE3' }}>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.4 }}>{fds(o.date)}</span>
                <PendingMark row={s.dayMenus[o.date]} />
                {COURSES.filter((c) => o[c]).map((c) => <span key={c} style={{ fontSize: FONT_BODY, color: '#5E5852', lineHeight: 1.4 }}>{t('kitchen.course.' + c)}: {(o[c] || []).map(dishName).join(', ') || t('kitchen.plan.nothing')}</span>)}
              </div>
              {readOnly ? null : (<><RowPill tone="quiet" onClick={() => setOverride(o.date)}>{t('common.edit')}</RowPill>
              <RowPill tone="danger" onClick={() => clearOverride(o.date)}>{t('kitchen.override.remove')}</RowPill></>)}
            </div>
          )) : <span style={{ padding: '14px 0', fontSize: FONT_BODY, color: '#5E5852', lineHeight: 1.4 }}>{t('kitchen.plan.noOneOff')}</span>}
          {v.overrides.length && overrides.pages > 1 ? <div style={{ borderTop: '1px solid #EFEAE3' }}><Pager page={overrides.page} pages={overrides.pages} onPage={overrides.setPage} label={t('kitchen.plan.oneOffTitle')} /></div> : null}
          {readOnly ? null : (<button type="button" onClick={() => setOverride(v.today)} className="cp-press" style={{ height: 50, margin: '0 -16px', padding: '0 16px', border: 'none', borderTop: '1px solid #EFEAE3', background: 'transparent', color: '#75624B', fontSize: 16, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontFamily: 'Inter', textAlign: 'left' }}>
            <Icon name="event" size={20} />
            {t('kitchen.plan.changeDate')}
          </button>)}
        </Group>
        {dialogs}
      </>
    );
  }
  return (
    <Card>
      <CardHead title={t('kitchen.plan.title')} meta={changes.length ? t('kitchen.plan.unpublished', { n: changes.length }) : undefined} />
      <div style={{ padding: '0 22px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {planTop}
      </div>
      {WEEKDAYS.map((w) => {
        const date = weekDate(week, w);
        const closed = !dayStatus(s, date).open;
        return (
          <div key={w} data-testid={`plan-day-${w}`} data-day={date} style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 12px', padding: '14px 22px', borderTop: '1px solid #F0EAE1', alignItems: 'flex-start' }}>
            <div style={{ flex: '0 0 120px', display: 'flex', flexDirection: 'column', gap: 2, paddingTop: 22 }}>
              <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.4 }}>{dayName(w)}</span>
              <span data-testid={`plan-date-${w}`} style={{ fontSize: FONT_BODY, color: '#5E5852', lineHeight: 1.4 }}>{short(date)}</span>
              {date === v.today ? <span style={{ alignSelf: 'flex-start', marginTop: 2, color: '#3D6B4F', fontSize: 13, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 5 }}><span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: 999, background: '#3D6B4F' }} />{t('kitchen.plan.today')}</span> : null}
              {closed ? <span style={{ alignSelf: 'flex-start', marginTop: 2, color: '#8A8078', fontSize: 13, fontWeight: 500, display: 'inline-flex', alignItems: 'center' }}>{t('kitchen.plan.closed')}</span> : null}
            </div>
            {field(w, 'lunch', '2 1 260px')}
            {field(w, 'soft', '1 1 160px')}
            {field(w, 'tea', '1 1 160px')}
          </div>
        );
      })}

      {changes.length ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, padding: '14px 22px', borderTop: '1px solid #F0EAE1', background: '#FBF8F4' }}>
          <span style={{ flex: '1 1 200px', fontSize: 16, lineHeight: '22px' }}>{t('kitchen.plan.unpublished', { n: changes.length })}</span>
          <Button variant="ghost" size={44} onClick={discard}>{t('kitchen.plan.discard')}</Button>
          {!isPhone ? <Button size={44} icon="publish" onClick={onPublish}>{t('kitchen.plan.publish')}</Button> : null}
        </div>
      ) : null}

      <div style={{ borderTop: '1px solid #F0EAE1', padding: '14px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <SectionLabel>{t('kitchen.plan.oneOffTitle')}</SectionLabel>
          {readOnly ? null : (<OutlineButton onClick={() => setOverride(v.today)} icon="event">{t('kitchen.plan.changeDate')}</OutlineButton>)}
        </div>
        {v.overrides.length ? overrides.rows.map((o) => (
          <div key={o.date} data-testid="override-row" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '8px 0', borderTop: '1px solid #F0EAE1' }}>
            <div style={{ flex: '1 1 220px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.4 }}>{fds(o.date)}</span>
              <PendingMark row={s.dayMenus[o.date]} />
              {COURSES.filter((c) => o[c]).map((c) => <span key={c} style={{ fontSize: FONT_BODY, color: '#5E5852', lineHeight: 1.4 }}>{t('kitchen.course.' + c)}: {(o[c] || []).map(dishName).join(', ') || t('kitchen.plan.nothing')}</span>)}
            </div>
            {readOnly ? null : (<><TextButton onClick={() => setOverride(o.date)}>{t('common.edit')}</TextButton>
            <TextButton onClick={() => clearOverride(o.date)} color="#9A3D24">{t('kitchen.override.remove')}</TextButton></>)}
          </div>
        )) : <span style={{ fontSize: FONT_BODY, color: '#5E5852', lineHeight: 1.4 }}>{t('kitchen.plan.noOneOff')}</span>}
        <Pager page={overrides.page} pages={overrides.pages} onPage={overrides.setPage} label={t('kitchen.plan.oneOffTitle')} />
      </div>

      {dialogs}
    </Card>
  );
}

/** A week-switcher arrow: a 44px round button that looks and reads as disabled at the ends. */
function WeekButton({ icon, label, disabled, onClick }: { icon: string; label: string; disabled: boolean; onClick: () => void }) {
  return (
    <button type="button" aria-label={label} aria-disabled={disabled || undefined} onClick={disabled ? undefined : onClick} className={disabled ? undefined : 'h-cream'}
      style={{ width: 44, height: 44, borderRadius: 999, border: '1px solid #E4DACD', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, flex: 'none', cursor: disabled ? 'not-allowed' : 'pointer', color: disabled ? '#B5B0AC' : '#24201C' }}>
      <Icon name={icon} size={24} />
    </button>
  );
}

type From = 'start' | 'monday' | 'date';
/**
 * Publish the week shown. When it starts: the current week from today (or next Monday, or a date); a coming week from its Monday (or a
 * date). A weekly menu repeats until another one starts, so the note says so for a coming week.
 */
export function PublishDialog({ open, onClose, editor }: { open: boolean; onClose: () => void; editor: PlanEditor }) {
  const t = useT();
  const { fd, fds } = useFmt();
  const s = useClub();
  const act = useAct();
  const weekName = useWeekName();
  const { role } = useMe();
  const { vals: v, week, offset, thisMonday, draft, changes, discard } = editor;
  const [from, setFrom] = useState<From>('start');
  const [date, setDate] = useState('');
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  useResetOn(open ? week : null, () => { if (open) { setFrom('start'); setDate(''); setNotify(true); } });
  const nextMonday = addDays(thisMonday, 7);
  const dayName = (w: Weekday) => fd(weekDate(week, w), { weekday: 'long' });
  const start = planStartFor(week, v.today);
  const mode: From = offset > 0 && from === 'monday' ? 'start' : from;
  const effective = mode === 'start' ? start : mode === 'monday' ? nextMonday : date;
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(effective) && effective >= v.today;
  const replaces = v.scheduled.filter((x) => x.effectiveFrom >= effective);
  const name = (id: string) => s.dishes[id]?.name ?? id;
  const publish = async () => {
    if (!valid || busy) return;
    setBusy(true);
    const r = await act('menu.publish', { effectiveFrom: effective, days: draft, notify }, { ok: t('kitchen.publish.done', { date: fds(effective) }) });
    setBusy(false);
    if (r.ok) { discard(); onClose(); }
  };
  const options: { value: From; label: string }[] = [
    { value: 'start', label: offset === 0 ? t('kitchen.publish.fromToday') : t('kitchen.publish.fromWeekStart', { date: week }) },
    ...(offset === 0 ? [{ value: 'monday' as const, label: t('kitchen.publish.fromMonday', { date: nextMonday }) }] : []),
    { value: 'date', label: t('kitchen.publish.fromDate') },
  ];
  return (
    <Dialog open={open} onClose={onClose} eyebrow={t('kitchen.plan.title')} title={t('kitchen.publish.title')}
      footer={<><Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button><Button icon="publish" onClick={publish} disabled={!valid || busy}>{t('kitchen.publish.confirm')}</Button></>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.4 }}>{t('kitchen.publish.forWeek', { week: `${weekName(offset, week)} · ${fd(week, { day: 'numeric', month: 'short' })} – ${fd(weekDate(week, 5), { day: 'numeric', month: 'short' })}` })}</span>
        <SectionLabel>{t('kitchen.publish.changes')}</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid #E4DACD', borderRadius: 12, overflow: 'hidden' }}>
          {changes.map((c: MenuChange, k: number) => (
            <div key={key(c.weekday, c.course)} style={{ padding: '10px 14px', borderTop: k ? '1px solid #F0EAE1' : 'none', display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.4 }}>{dayName(c.weekday)} · {t('kitchen.course.' + c.course)}</span>
              {c.added.map((id) => <span key={'a' + id} style={{ fontSize: FONT_BODY, color: '#3D6B4F', lineHeight: 1.4 }}>+ {name(id)}</span>)}
              {c.removed.map((id) => <span key={'r' + id} style={{ fontSize: FONT_BODY, color: '#9A3D24', lineHeight: 1.4 }}>− {name(id)}</span>)}
            </div>
          ))}
        </div>
      </div>
      <ChipGroup<From> label={t('kitchen.publish.from')} value={mode} onChange={(x) => setFrom(x as From)} options={options} />
      {mode === 'date' ? <DateField label={t('common.date')} value={date} onChange={setDate} min={v.today} error={date && !valid ? t('kitchen.err.pastDate') : undefined} /> : null}
      <Toggle on={notify} onClick={() => setNotify((x) => !x)} label={t('kitchen.notify.families')} />
      {role !== 'mgmt' ? <Note tone="ochre" icon="hourglass_top">{t('approvals.menuNeeds')}</Note> : null}
      {valid && effective > v.today ? <Note tone="cream" icon="event_repeat">{t('kitchen.publish.repeats', { date: effective })}</Note> : null}
      {replaces.length ? <Note tone="ochre" icon="info">{t('kitchen.publish.replaces', { date: replaces[0].effectiveFrom })}</Note> : null}
    </Dialog>
  );
}
