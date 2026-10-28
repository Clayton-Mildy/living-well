// Weekly menu plan: the week's menu editor (explicit Publish, never per keystroke).
// KC 28 Oct: no separate "Just for one date" list any more (each week has its own menu, so a day is changed in its week). A date that still has its own
// dishes ("Change today's menu" on the Menu page, or an older one-date change) shows them on its day, with Undo, because they win over the week's.
// A week switcher plans coming weeks. KC round 15: each week has its own menu: a plan is published for the week shown only (from its Monday, or
// today for the current week), a week nobody planned is empty, and "Copy last week" fills the editor from the week before (asking first when it
// replaces dishes already planned). Edits are kept per week while the page is open.
// Round 14 (B2): Saturday and Sunday follow Friday, empty by default, under a lighter "Weekend" header (they are served when the weekend is programmed).
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { addDays, dayStatus, diffDays, live, weekStart, type ISODate, type Weekday } from '@cp/shared';
import { isWaiting } from '@cp/shared/rules/approvals';
import { PendingMark } from '../../components/PendingMark';
import { useMe } from '../../lib/me';
import { ALL_DAYS, COURSES, MAX_PLAN_WEEKS, diffTemplates, planStartFor, sameIds, templateForWeek, weekDate, type Course, type MenuChange, type WeekTemplate } from '@cp/shared/rules/kitchenOps';
import { copyMenu, hasDishes, lastWeekMenu, menuCopyReplaces, menuPlanned } from '@cp/shared/rules/weekPlans';
import { Button, Card, CardHead, Dialog, Group, Icon, Note, SectionLabel, Toggle, FONT_BODY } from '../../components/ui';
import { say } from '../../store/ui';
import { useT, useFmt } from '../../lib/i18n';
import { useAct } from '../../lib/act';
import { useNow } from '../../lib/clock';
import { useClub } from '../../store/replica';
import { DishField, DishPicker } from './dish';
import { ConfirmDialog, TextButton, useResetOn } from './parts';
import { usePlanVals } from './vals';

const key = (w: Weekday, c: Course) => `${w}:${c}`;
type Edits = Record<string, string[]>;
const NO_EDITS: Edits = {};
const withEdits = (base: WeekTemplate, e: Edits): WeekTemplate => {
  const out = {} as WeekTemplate;
  for (const w of ALL_DAYS) out[w] = { lunch: e[key(w, 'lunch')] ?? base[w].lunch, soft: e[key(w, 'soft')] ?? base[w].soft, tea: e[key(w, 'tea')] ?? base[w].tea };
  return out;
};

/** Draft edits on top of the menu of the week shown. Only cells that differ are stored, so untouched cells follow the live menu. */
export function usePlanEditor() {
  const s = useClub();
  const { today } = useNow();
  const thisMonday = weekStart(today);
  const [params] = useSearchParams();
  // weeks after the current one (KC round 15: "Plan the menu" on Today opens a week with ?week=)
  const [ahead, setAhead] = useState(() => { const w = params.get('week'); return w && /^\d{4}-\d{2}-\d{2}$/.test(w) ? Math.max(0, Math.round(diffDays(thisMonday, weekStart(w)) / 7)) : 0; });
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
  /** KC round 15: the whole week at once ("Copy last week"); only cells that differ from the menu shown are kept */
  const fill = (next: WeekTemplate) => setAll((a) => {
    const e: Edits = {};
    for (const w of ALL_DAYS) for (const c of COURSES) if (!sameIds(next[w][c], base[w][c])) e[key(w, c)] = next[w][c];
    const n = { ...a };
    if (Object.keys(e).length) n[week] = e; else delete n[week];
    return n;
  });
  return { vals: v, week, offset, thisMonday, goto: (w: ISODate) => setAhead(diffDays(thisMonday, w) / 7), setAhead, cur, setCell, fill, draft, changes, others, discard };
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
  const { vals: v, week, offset, cur, setCell, fill, draft, changes, others, discard } = editor;
  // KC round 15: a week has its own menu; last week's can be copied in
  const planned = menuPlanned(s, week);
  const last = useMemo(() => lastWeekMenu(s, week), [s, week]);
  const canCopy = !readOnly && hasDishes(last);
  const [askCopy, setAskCopy] = useState(false);
  const doCopy = () => { fill(copyMenu(draft, last, week, v.today)); setAskCopy(false); say(t('kitchen.plan.copied')); };
  const onCopy = () => (menuCopyReplaces(draft, last, week, v.today) ? setAskCopy(true) : doCopy());
  const [picker, setPicker] = useState<{ w: Weekday; c: Course } | null>(null);
  const dayName = (w: Weekday) => fd(weekDate(week, w), { weekday: 'long' });
  const short = (d: ISODate) => fd(d, { day: 'numeric', month: 'short' });
  const waiting = live(s.menuVersions).filter((x) => x.status === 'published' && isWaiting(x)); // weekly menus waiting for management's approval
  const undoDay = async (date: string) => { await act('dayMenu.override', { date, lunch: null, soft: null, tea: null }, { ok: t('kitchen.override.reset') }); };
  const dayChange = (date: ISODate) => <DayChange date={date} today={v.today} readOnly={readOnly} onUndo={() => undoDay(date)} />;
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
        {!planned && !changes.length ? (
          <Note tone="cream" icon="event_busy">
            <span data-testid="menu-not-planned" style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
              <span>{t('kitchen.plan.notPlanned')}</span>
              {canCopy ? <Button variant="secondary" size={44} icon="content_copy" onClick={onCopy}>{t('kitchen.plan.copy')}</Button> : null}
            </span>
          </Note>
        ) : canCopy ? <div><Button variant="ghost" size={44} icon="content_copy" onClick={onCopy}>{t('kitchen.plan.copy')}</Button></div> : null}
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
      <ConfirmDialog open={askCopy} onClose={() => setAskCopy(false)} title={t('kitchen.plan.copyTitle')} body={t('kitchen.plan.copyBody')} confirmLabel={t('kitchen.plan.copyConfirm')} cancelLabel={t('kitchen.plan.copyKeep')} onConfirm={doCopy} danger={false} />
    </>
  );
  // round 6, phone: iOS grouped sections. The week switcher and its notes first, then one section per weekday (day name outside, its three courses inside),
  // and the unpublished bar. Publishing is the pinned "Publish menu" pill of the page.
  if (isPhone) {
    return (
      <>
        <Group title={t('kitchen.plan.title')} meta={changes.length ? t('kitchen.plan.unpublished', { n: changes.length }) : undefined} gap={10}>
          {planTop}
        </Group>
        {ALL_DAYS.map((w) => {
          const date = weekDate(week, w);
          const closed = !dayStatus(s, date).open;
          return (
            <div key={w} data-testid={`plan-day-${w}`} data-day={date}>
              <Group title={w > 5 ? <span style={{ color: '#8A8078' }}>{dayName(w)}</span> : dayName(w)} gap={12}
                meta={(
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                    {date === v.today ? <span style={{ color: '#3D6B4F', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 5 }}><span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: 999, background: '#3D6B4F' }} />{t('kitchen.plan.today')}</span> : null}
                    {w > 5 ? <span style={{ color: '#8A8078', fontWeight: 500 }}>{t('cal.weekendCol')}</span> : closed ? <span style={{ color: '#8A8078', fontWeight: 500 }}>{t('kitchen.plan.closed')}</span> : null}
                    <span data-testid={`plan-date-${w}`}>{short(date)}</span>
                  </span>
                )}>
                {field(w, 'lunch', 'none')}
                {field(w, 'soft', 'none')}
                {field(w, 'tea', 'none')}
                {dayChange(date)}
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
      {ALL_DAYS.map((w) => {
        const date = weekDate(week, w);
        const closed = !dayStatus(s, date).open;
        return (
          <div key={w} data-testid={`plan-day-${w}`} data-day={date} style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 12px', padding: '14px 22px', borderTop: '0.5px solid var(--hairline, #E2E2E6)', alignItems: 'flex-start' }}>
            <div style={{ flex: '0 0 120px', display: 'flex', flexDirection: 'column', gap: 2, paddingTop: 22 }}>
              <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.4, color: w > 5 ? '#8A8078' : undefined }}>{dayName(w)}</span>
              <span data-testid={`plan-date-${w}`} style={{ fontSize: FONT_BODY, color: '#5E5852', lineHeight: 1.4 }}>{short(date)}</span>
              {date === v.today ? <span style={{ alignSelf: 'flex-start', marginTop: 2, color: '#3D6B4F', fontSize: 13, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 5 }}><span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: 999, background: '#3D6B4F' }} />{t('kitchen.plan.today')}</span> : null}
              {w > 5 || closed ? <span style={{ alignSelf: 'flex-start', marginTop: 2, color: '#8A8078', fontSize: 13, fontWeight: 500, display: 'inline-flex', alignItems: 'center' }}>{t(w > 5 ? 'cal.weekendCol' : 'kitchen.plan.closed')}</span> : null}
            </div>
            {field(w, 'lunch', '2 1 260px')}
            {field(w, 'soft', '1 1 160px')}
            {field(w, 'tea', '1 1 160px')}
            {dayChange(date)}
          </div>
        );
      })}

      {changes.length ? (
        <div className="cp-grey" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, padding: '14px 22px', borderTop: '0.5px solid var(--hairline, #E2E2E6)', background: 'var(--fill, #F4F4F5)' }}>
          <span style={{ flex: '1 1 200px', fontSize: 16, lineHeight: '22px' }}>{t('kitchen.plan.unpublished', { n: changes.length })}</span>
          <Button variant="ghost" size={44} onClick={discard}>{t('kitchen.plan.discard')}</Button>
          {!isPhone ? <Button size={44} icon="publish" onClick={onPublish}>{t('kitchen.plan.publish')}</Button> : null}
        </div>
      ) : null}

      {dialogs}
    </Card>
  );
}

/** A week-switcher arrow: a 44px round button that looks and reads as disabled at the ends. */
function WeekButton({ icon, label, disabled, onClick }: { icon: string; label: string; disabled: boolean; onClick: () => void }) {
  return (
    <button type="button" aria-label={label} aria-disabled={disabled || undefined} onClick={disabled ? undefined : onClick} className={disabled ? 'cp-fill' : 'h-fill cp-fill'}
      style={{ width: 44, height: 44, borderRadius: 999, border: 'none', background: 'var(--fill, #F4F4F5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, flex: 'none', cursor: disabled ? 'not-allowed' : 'pointer', color: disabled ? '#B5B0AC' : '#24201C' }}>
      <Icon name={icon} size={24} />
    </button>
  );
}

/** Publish the week shown (KC round 15: for that week only): the current week from today, a coming week from its Monday, to its Sunday. */
export function PublishDialog({ open, onClose, editor }: { open: boolean; onClose: () => void; editor: PlanEditor }) {
  const t = useT();
  const { fd, fds } = useFmt();
  const s = useClub();
  const act = useAct();
  const weekName = useWeekName();
  const { role } = useMe();
  const { vals: v, week, offset, draft, changes, discard } = editor;
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  useResetOn(open ? week : null, () => { if (open) setNotify(true); });
  const dayName = (w: Weekday) => fd(weekDate(week, w), { weekday: 'long' });
  const start = planStartFor(week, v.today);
  const name = (id: string) => s.dishes[id]?.name ?? id;
  const publish = async () => {
    if (busy) return;
    setBusy(true);
    const r = await act('menu.publish', { effectiveFrom: start, days: draft, notify }, { ok: t('kitchen.publish.done', { date: fds(start) }) });
    setBusy(false);
    if (r.ok) { discard(); onClose(); }
  };
  return (
    <Dialog open={open} onClose={onClose} eyebrow={t('kitchen.plan.title')} title={t('kitchen.publish.title')}
      footer={<><Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button><Button icon="publish" onClick={publish} disabled={busy}>{t('kitchen.publish.confirm')}</Button></>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.4 }}>{t('kitchen.publish.forWeek', { week: `${weekName(offset, week)} · ${fd(week, { day: 'numeric', month: 'short' })} – ${fd(weekDate(week, 5), { day: 'numeric', month: 'short' })}` })}</span>
        <SectionLabel>{t('kitchen.publish.changes')}</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--fill, #F4F4F5)', borderRadius: 12, overflow: 'hidden' }}>
          {changes.map((c: MenuChange, k: number) => (
            <div key={key(c.weekday, c.course)} style={{ padding: '10px 14px', borderTop: k ? '0.5px solid var(--hairline, #E2E2E6)' : 'none', display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.4 }}>{dayName(c.weekday)} · {t('kitchen.course.' + c.course)}</span>
              {c.added.map((id) => <span key={'a' + id} style={{ fontSize: FONT_BODY, color: '#3D6B4F', lineHeight: 1.4 }}>+ {name(id)}</span>)}
              {c.removed.map((id) => <span key={'r' + id} style={{ fontSize: FONT_BODY, color: '#9A3D24', lineHeight: 1.4 }}>− {name(id)}</span>)}
            </div>
          ))}
        </div>
      </div>
      <Note tone="cream" icon="date_range">{t('kitchen.publish.weekOnly', { from: fds(start), to: fds(addDays(week, 6)) })}</Note>
      <Toggle on={notify} onClick={() => setNotify((x) => !x)} label={t('kitchen.notify.families')} />
      {role !== 'mgmt' ? <Note tone="ochre" icon="hourglass_top">{t('approvals.menuNeeds')}</Note> : null}
    </Dialog>
  );
}

/** A date with its own dishes (they win over the week's dishes above): what it serves, whether it waits for approval, and Undo (back to the week's
 * dishes) while the date is still to come. Nothing when the date simply follows its week. */
function DayChange({ date, today, readOnly, onUndo }: { date: ISODate; today: ISODate; readOnly: boolean; onUndo: () => void }) {
  const t = useT();
  const s = useClub();
  const row = s.dayMenus[date];
  const courses = row && !row.deletedAt ? COURSES.filter((c) => row[c] !== undefined) : [];
  if (!courses.length) return null;
  const names = (ids: string[]) => ids.map((id) => s.dishes[id]?.name ?? id).join(', ') || t('kitchen.plan.nothing');
  return (
    <div data-testid="day-change" className="cp-fill" style={{ flex: '1 1 100%', display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', borderRadius: 12, background: 'var(--fill, #F4F4F5)', color: '#24201C' }}>
      <Icon name="edit_calendar" size={18} color="#6B6259" style={{ marginTop: 2 }} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 14, fontWeight: 500, lineHeight: '20px' }}>{t('kitchen.plan.dayChanged')}</span>
        <PendingMark row={row} />
        {courses.map((c) => <span key={c} style={{ fontSize: FONT_BODY, color: '#5E5852', lineHeight: 1.4, overflowWrap: 'anywhere' }}>{t('kitchen.course.' + c)}: {names(row![c] ?? [])}</span>)}
      </div>
      {!readOnly && date >= today ? <TextButton onClick={onUndo}>{t('kitchen.plan.dayUndo')}</TextButton> : null}
    </div>
  );
}
