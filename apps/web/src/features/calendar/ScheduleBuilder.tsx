// Weekly schedule builder (design ScrCal builder): palette from the catalog, drag or tap-to-place, room / teacher / activity editor, dated publish.
// The schedule is versioned by effective date: the grid shows one Mon–Fri week at a time (previous / next week, date under each day name) with the version
// in force for that week. A week that has not started can be changed; publishing defaults to that week's Monday. Edits are saved as a shared draft.
// Drag works with a mouse; on touch, tap an activity and then a slot (or use "Move to"). Every placed activity has a quick ✕ to remove it.
// Round 6 (phone, native look): one day is an iOS grouped list (the day's slots as rows), the slot editor is a set of groups, the versions are a list group.
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, type KeyboardEvent } from 'react';
import { useResetOn } from '../../lib/useResetOn';
import { actorName, addDays, live, scheduleVersionFor, staffCall, type ISODate, type Slot, type Weekday } from '@cp/shared';
import { activityName, roomName } from '@cp/shared/rules/activity';
import { SLOTS, WEEKDAYS, activityTeachers, changedCells, cloneDays, effectiveVersions, mondayOf, nextMonday, sameCell, weekDays, weekView, type Days } from '@cp/shared/rules/calendar';
import { Button, DateField, Group, Icon, IconButton, Note, Pager, Select, Sheet, Toggle, chipStyle, usePaged, FONT_BODY, FONT_SMALL } from '../../components/ui';
import { useDevice } from '../../hooks/useDevice';
import { useT, useFmt } from '../../lib/i18n';
import { useAct } from '../../lib/act';
import { useNow } from '../../lib/clock';
import { useClub } from '../../store/replica';
import { say } from '../../store/ui';
import { Badge, plural, rowLine } from '../activity/lib';
import { CatalogEditor } from './CatalogEditor';
import { smallCaps, weekdayName } from './lib';

type Cell = { w: Weekday; slot: Slot };
const key = (c: Cell) => `${c.w}|${c.slot}`;
export interface CellRequest { w: Weekday; slot: Slot; n: number }

/** The shared draft for one week: local edits show at once and are saved to the server in order (one request at a time, latest wins). */
function useDraft(week: ISODate) {
  const s = useClub();
  const act = useAct();
  const { today } = useNow();
  const view = useMemo(() => weekView(s, week, today), [s, week, today]);
  const [local, setLocal] = useState<Days | null>(null);
  const localRef = useRef<Days | null>(null);
  const run = useRef({ busy: false, next: null as { days: Days; from: ISODate } | null, idle: [] as (() => void)[] });
  useResetOn(week, () => { localRef.current = null; setLocal(null); });
  const draft = local ?? view.days;

  const send = useCallback((days: Days, from: ISODate) => {
    const r = run.current;
    r.next = { days, from };
    if (r.busy) return;
    r.busy = true;
    void (async () => {
      let last: Days | null = null;
      while (r.next) { const n = r.next; r.next = null; last = n.days; await act('schedule.saveDraft', { days: n.days, effectiveFrom: n.from }, { silent: true }); }
      r.busy = false;
      if (localRef.current === last) { localRef.current = null; setLocal(null); }
      r.idle.splice(0).forEach((f) => f());
    })();
  }, [act]);
  const put = (next: Days) => { localRef.current = next; setLocal(next); send(next, week); };
  const edit = (fn: (d: Days) => void) => { const next = cloneDays(draft); fn(next); put(next); };
  const flush = () => new Promise<void>((res) => { const r = run.current; if (!r.busy && !r.next) res(); else r.idle.push(res); });
  const reset = () => { localRef.current = null; setLocal(null); };
  return { view, draft, base: view.base, edit, flush, reset, discard: () => put(cloneDays(view.base)), changes: changedCells(draft, view.base) };
}

export function ScheduleBuilder({ week, onWeek, focusDate, request }: { week: ISODate; onWeek: (monday: ISODate) => void; focusDate?: ISODate | null; request?: CellRequest | null }) {
  const t = useT();
  const { lang, fds, fdl, fd } = useFmt();
  const { isPhone } = useDevice();
  const s = useClub();
  const { today } = useNow();
  const act = useAct();
  const d = useDraft(week);
  const view = d.view;
  const [sel, setSel] = useState<Cell | null>(null);
  const [pal, setPal] = useState<string | null>(null);
  const [drag, setDrag] = useState<null | { act: string } | { cell: Cell }>(null);
  const [over, setOver] = useState<string | null>(null);
  const todayW = new Date(today + 'T00:00:00Z').getUTCDay();
  const [pday, setPday] = useState<Weekday>(todayW >= 1 && todayW <= 5 ? (todayW as Weekday) : 1);
  const [pubOpen, setPubOpen] = useState(false);
  const [catalog, setCatalog] = useState(false);
  useResetOn(week, () => { setSel(null); setPal(null); });

  const teachers = activityTeachers(s);
  const palette = live(s.activities).filter((a) => a.active).sort((a, b) => a.name.localeCompare(b.name));
  const rooms = live(s.rooms).sort((a, b) => a.name.localeCompare(b.name));
  const versions = effectiveVersions(s);
  const vp = usePaged(versions, 5);
  const inForce = scheduleVersionFor(s, today);
  const hours = s.club.settings;
  const changed = d.changes.length;
  const canEdit = view.editable && !view.otherDraft;
  const wLong = (w: number) => weekdayName(lang, w, 'long');
  const wShort = (w: number) => weekdayName(lang, w, 'short');
  const dateOf = (w: number) => view.dates[w - 1];
  const dayNum = (w: number) => fd(dateOf(w), { day: 'numeric', month: 'short' });
  const cellOf = (c: Cell) => d.draft[c.w][c.slot];
  const title = (c: Cell) => { const x = cellOf(c); return x ? activityName(s.activities[x.activityId], lang) : ''; };
  const roomOf = (id?: string) => (id ? roomName(s.rooms[id], lang) : '');
  const isChanged = (c: Cell) => !sameCell(d.draft[c.w][c.slot], d.base[c.w][c.slot]);

  // "Edit activity" from the calendar: show the slot's editor
  useEffect(() => {
    if (!request) return;
    const c = { w: request.w, slot: request.slot };
    setPday(c.w);
    if (d.draft[c.w][c.slot]) setSel(c);
  }, [request?.n]); // eslint-disable-line react-hooks/exhaustive-deps

  const placeAct = (c: Cell, activityId: string) => {
    if (!canEdit) return;
    const a = s.activities[activityId];
    if (!a) return;
    const staff = cellOf(c)?.staffId ?? teachers[c.slot === '10:30' ? 0 : 1]?.id ?? teachers[0]?.id;
    if (!staff) { say(t('cal.err.noTeacher'), { tone: 'error', icon: 'error' }); return; }
    d.edit((x) => { x[c.w][c.slot] = { activityId, roomId: a.roomId, staffId: staff }; });
    setSel(c);
    setPal(null);
  };
  const swap = (a: Cell, b: Cell) => { d.edit((x) => { const tmp = x[b.w][b.slot]; x[b.w][b.slot] = x[a.w][a.slot]; x[a.w][a.slot] = tmp; }); setSel(b); };
  const clearCell = (c: Cell) => { d.edit((x) => { x[c.w][c.slot] = null; }); if (sel && key(sel) === key(c)) setSel(null); };
  const dropAt = (c: Cell) => {
    const g = drag;
    setDrag(null);
    setOver(null);
    if (!g || !canEdit) return;
    if ('act' in g) placeAct(c, g.act);
    else if (key(g.cell) !== key(c)) swap(g.cell, c);
  };
  const tapCell = (c: Cell) => { if (!canEdit) return; if (pal) placeAct(c, pal); else setSel(sel && key(sel) === key(c) ? null : c); };
  const onKey = (c: Cell) => (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tapCell(c); } };

  const cellStyle = (c: Cell) => {
    const v = cellOf(c);
    const on = !!sel && key(sel) === key(c);
    const hot = over === key(c) && !!drag;
    return { background: hot ? '#E8E1D8' : v ? '#FFFFFF' : '#FBF8F4', border: hot ? '2px dashed #75624B' : v ? (isChanged(c) ? '1px solid #8A755B' : '1px solid #EFE7DC') : '1px dashed #D9CCBC', boxShadow: on ? '0 0 0 3px #24201C' : v ? '0 1px 2px rgba(60,40,20,.05)' : 'none' };
  };
  const aria = (c: Cell) => `${wLong(c.w)} ${c.slot}: ${cellOf(c) ? title(c) : t('cal.empty')}`;
  const hint = !canEdit ? '' : pal ? t('cal.tapToPlace', { name: activityName(s.activities[pal], lang) }) : '';

  const fixed: [string, string, string | null, string][] = [
    [hours.open, t('cal.fixOpen'), 'door_front', ''],
    ['10:30', '', null, t('cal.morning')],
    ['12:00', t('cal.fixLunch', { room: roomOf('room-dining') || t('cal.diningRoom') }), 'restaurant', ''],
    ['13:30', '', null, t('cal.afternoon')],
    ['15:00', t('cal.fixTea', { room: roomOf('room-lounge') || t('cal.lounge') }), 'local_cafe', ''],
    [hours.close, t('cal.fixClose'), 'home', ''],
  ];
  const fixedIcon = (i: string) => <Icon name={i} size={18} color="#75624B" />;

  const shown = view.versions[0];
  const who = (v: NonNullable<typeof shown>) => (v.publishedBy ? (staffCall(s.staff[v.publishedBy.replace('staff:', '')]) || actorName(s, v.publishedBy)) : '');
  const status = changed ? plural(t, 'cal.changesPending', changed)
    : shown ? t('cal.publishedBy', { when: `${fds(shown.publishedAt?.slice(0, 10) || shown.effectiveFrom)}, ${shown.publishedAt?.slice(11, 16) || ''}`, who: who(shown) }) + ' · ' + t('cal.inForceFrom', { date: fds(shown.effectiveFrom) })
      : t('cal.noSchedule');
  const midWeek = !changed && view.versions.length > 1 ? view.versions[1] : null;

  // the remove ✕ sits beside the cell (never inside the cell's own button)
  const removeBtn = (c: Cell, size: number, pos: CSSProperties = { top: 2, right: 2 }) => {
    if (!canEdit || !cellOf(c)) return null;
    return (
      <button type="button" className={isPhone ? 'cp-press' : undefined} onClick={() => clearCell(c)} aria-label={t('cal.removeFromSlot', { name: title(c), day: wLong(c.w), slot: c.slot })} title={t('cal.clearSlot')}
        style={{ position: 'absolute', ...pos, width: size, height: size, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span aria-hidden="true" style={{ width: 28, height: 28, borderRadius: 999, background: '#F3EEE8', color: '#5E5852', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="close" size={18} /></span>
      </button>
    );
  };

  // round 6, phone: a slot is one row of the day's group (time and part of the day, the activity with room and teacher); the selected row has a dark bar
  const slotCard = (c: Cell, label: string, first: boolean) => {
    const v = cellOf(c);
    const on = !!sel && key(sel) === key(c);
    const inner = (
      <>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 'none', width: 74 }}>
          <span style={{ fontSize: 16, fontVariantNumeric: 'tabular-nums', fontWeight: 500, lineHeight: 1.4 }}>{c.slot}</span>
          <span style={{ fontSize: 13, color: '#6B6259', lineHeight: 1.3 }}>{label}</span>
        </span>
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2, paddingRight: v && canEdit ? 40 : 0 }}>
          {v ? (
            <>
              <span style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.35 }}>{title(c)}</span>
              <span style={{ fontSize: 14, color: '#6B6259', lineHeight: 1.35 }}>{roomOf(v.roomId)} · {staffCall(s.staff[v.staffId])}</span>
            </>
          ) : <span style={{ fontSize: 15, color: hint ? '#75624B' : '#8A8078', fontWeight: hint ? 500 : 400, lineHeight: 1.4 }}>{hint || t('cal.empty')}</span>}
          {isChanged(c) ? <span style={{ fontSize: 13, fontWeight: 600, color: '#7A5510', lineHeight: 1.4 }}>{t('cal.changed')}</span> : null}
        </span>
      </>
    );
    const box = { width: '100%', minHeight: 64, padding: '10px 12px 10px 16px', display: 'flex', gap: 10, alignItems: 'center', textAlign: 'left', color: '#24201C', fontFamily: 'Inter', flex: 1, minWidth: 0, border: 'none', background: 'transparent' } as const;
    return (
      <div key={key(c)} className={canEdit ? 'cp-tap' : undefined} style={{ position: 'relative', display: 'flex', backgroundColor: on ? '#FBF8F4' : '#FFFFFF', boxShadow: on ? 'inset 3px 0 0 #2B231C' : undefined, ...rowLine(first || on) }}>
        {canEdit
          ? <button type="button" className="cp-tap-target" onClick={() => tapCell(c)} aria-label={aria(c)} aria-pressed={on} style={{ ...box, cursor: 'pointer' }}>{inner}</button>
          : <div aria-label={aria(c)} role="group" style={box}>{inner}</div>}
        {removeBtn(c, 44, { top: '50%', right: 6, marginTop: -22 })}
      </div>
    );
  };

  const selCell = canEdit && sel && cellOf(sel) ? sel : null;
  const selV = selCell ? cellOf(selCell) : null;
  const chipBtn = (labelText: string, on: boolean, onClick: () => void, role?: string) => {
    const c = chipStyle(on, false);
    return <button key={labelText} type="button" className={isPhone ? 'cp-press' : undefined} role={role} aria-checked={role ? on : undefined} onClick={onClick} style={{ height: isPhone ? 40 : 44, padding: '0 14px', borderRadius: 12, border: c.bd, background: c.bg, color: c.fg, fontSize: FONT_BODY, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'Inter' }}>{labelText}</button>;
  };
  const panelLabel = (text: string) => <span style={smallCaps}>{text}</span>;
  const roomChips = selCell && selV ? rooms.map((r) => chipBtn(roomName(r, lang), selV.roomId === r.id, () => d.edit((x) => { const c = x[selCell.w][selCell.slot]; if (c) c.roomId = r.id; }), 'radio')) : null;
  const teacherChips = selCell && selV ? [...teachers.map((x) => x.id), ...(teachers.some((x) => x.id === selV.staffId) ? [] : [selV.staffId])].map((id) => chipBtn(staffCall(s.staff[id]) || id, selV.staffId === id, () => d.edit((x) => { const c = x[selCell.w][selCell.slot]; if (c) c.staffId = id; }), 'radio')) : null;
  const moveChips = selCell && selV ? (WEEKDAYS.flatMap((w) => SLOTS.map((slot) => ({ w, slot }))).filter((c) => key(c) !== key(selCell)).map((c) => (
      <button key={key(c)} type="button" onClick={() => { swap(selCell, c); setPday(c.w); }} style={{ height: 44, padding: '0 12px', borderRadius: 12, border: cellOf(c) ? '1px solid #8A755B' : '1px dashed #CAB8A2', background: '#FFFFFF', color: '#24201C', fontSize: 16, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'Inter' }}>{wShort(c.w)} {c.slot}</button>
    ))) : null;


  const summary = d.changes.slice(0, 8).map((c) => {
    const before = d.base[c.w][c.slot], after = d.draft[c.w][c.slot];
    const nm = (x: typeof before) => (x ? activityName(s.activities[x.activityId], lang) : '—');
    return `${wShort(c.w)} ${c.slot}: ${nm(before)} → ${nm(after)}`;
  });
  const thisMonday = mondayOf(today);
  const weekLabel = `${fd(view.dates[0], { day: 'numeric', month: 'short' })} – ${fd(view.dates[4], { day: 'numeric', month: 'short', year: 'numeric' })}`;
  const discardOther = async () => {
    if (!view.otherDraft) return;
    const m = view.otherDraft.monday;
    await act('schedule.saveDraft', { days: weekDays(s, m), effectiveFrom: m }, { silent: true });
  };
  const navBtn = (icon: string, label: string, to: ISODate) => <IconButton icon={icon} label={label} onClick={() => onWeek(to)} {...(isPhone ? { size: 40, bordered: false, style: { background: '#F3EEE8', color: '#75624B', borderRadius: 999 } } : {})} />;

  const activityOptions = (() => {
    const list = palette.map((a) => ({ value: a.id, label: activityName(a, lang) }));
    const cur = selV?.activityId;
    return cur && !list.some((o) => o.value === cur) ? [...list, { value: cur, label: activityName(s.activities[cur], lang) }] : list;
  })();

  const versionRow = (v: (typeof versions)[number], i: number) => {
    const tag = v.effectiveFrom > today ? t('cal.upcoming') : inForce?.id === v.id ? t('cal.inForce') : t('cal.earlier');
    return (
      <div key={v.id} style={isPhone ? { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', minHeight: 56, flexWrap: 'wrap', ...rowLine(i === 0) } : { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 22px', borderTop: '1px solid #F0EAE1', minHeight: 56, flexWrap: 'wrap' }}>
        <span style={{ flex: '1 1 160px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.4 }}>{t('cal.versionFrom', { date: fdl(v.effectiveFrom) })}</span>
          <span style={{ fontSize: FONT_BODY, color: '#5E5852', lineHeight: '20px' }}>{t('cal.publishedBy', { when: `${fds(v.publishedAt?.slice(0, 10) || v.effectiveFrom)}, ${v.publishedAt?.slice(11, 16) || ''}`, who: who(v) })}</span>
        </span>
        <Badge label={tag} bg={v.effectiveFrom > today ? '#F6ECD6' : inForce?.id === v.id ? '#E3EFE6' : '#F0EAE1'} fg={v.effectiveFrom > today ? '#7A5510' : inForce?.id === v.id ? '#3D6B4F' : '#5E5852'} icon={v.effectiveFrom > today ? 'schedule' : inForce?.id === v.id ? 'check_circle' : 'history'} />
      </div>
    );
  };

  const paletteChips = palette.map((a) => {
    const c = chipStyle(pal === a.id, false);
    return (
      <button key={a.id} type="button" draggable onDragStart={(e: DragEvent) => { try { e.dataTransfer.setData('text/plain', a.id); } catch { /* ignore */ } setDrag({ act: a.id }); setPal(null); }} onDragEnd={() => { setDrag(null); setOver(null); }} onClick={() => { setPal(pal === a.id ? null : a.id); setSel(null); }} aria-pressed={pal === a.id}
        style={{ height: 44, padding: '0 16px 0 12px', borderRadius: 12, border: c.bd, background: c.bg, color: c.fg, fontSize: 16, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'grab', whiteSpace: 'nowrap', fontFamily: 'Inter', flex: 'none' }}>
        <Icon name={a.icon} size={18} />{activityName(a, lang)}
      </button>
    );
  });

  return (
    <div className={isPhone ? 'cp-native' : undefined} style={{ display: 'flex', flexDirection: 'column', gap: isPhone ? 14 : 16, paddingTop: isPhone ? 14 : 28, borderTop: isPhone ? 'none' : '1px solid #E6DDD1' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: isPhone ? 10 : 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: isPhone ? 4 : 6, minWidth: 0 }}>
          <div style={smallCaps}>{t('cal.builder')}</div>
          <h2 style={{ margin: 0, fontSize: isPhone ? 24 : 28, lineHeight: isPhone ? '30px' : '36px', fontWeight: 400, letterSpacing: '-0.8px', color: '#2B231C' }}>{t('cal.weekly')}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, lineHeight: 1.4, flexWrap: 'wrap' }}>
            {changed ? <Badge kind="watch" label={t('cal.draft')} /> : <Badge kind="paid" label={t('cal.published')} />}
            <span>{status}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {isPhone ? <IconButton icon="tune" label={t('cal.catalogBtn')} onClick={() => setCatalog(true)} size={40} bordered={false} style={{ background: '#EFEAE3', color: '#75624B', borderRadius: 999 }} /> : <Button variant="secondary" icon="tune" onClick={() => setCatalog(true)}>{t('cal.catalogBtn')}</Button>}
          {changed ? <Button variant="ghost" size={isPhone ? 44 : 48} onClick={() => { d.discard(); setSel(null); }}>{t('cal.discard')}</Button> : null}
          <button type="button" className={isPhone ? 'cp-press' : undefined} onClick={() => changed && canEdit && setPubOpen(true)} aria-disabled={!changed || !canEdit} aria-label={isPhone ? t('cal.publishBtn') : undefined} style={{ height: isPhone ? 40 : 52, padding: isPhone ? '0 18px' : '0 24px', borderRadius: 999, border: 'none', background: changed && canEdit ? '#24201C' : '#E8E1D8', color: changed && canEdit ? '#FFFFFF' : '#5E5852', fontSize: 16, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 8, cursor: changed && canEdit ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap', fontFamily: 'Inter' }}>
            <Icon name="send" size={20} />{isPhone ? t('cal.publishShort') : t('cal.publishBtn')}
          </button>
        </div>
      </div>
      {!teachers.length ? <Note tone="ochre" icon="info">{t('cal.noTeachers')}</Note> : null}

      <div role="group" aria-label={t('cal.weekNav')} style={isPhone ? { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 14, background: '#FFFFFF' } : { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {navBtn('chevron_left', t('cal.prevWeek'), addDays(week, -7))}
        <span aria-live="polite" style={{ fontSize: isPhone ? 16 : 18, fontWeight: 500, lineHeight: 1.4, minWidth: isPhone ? 0 : 150, flex: isPhone ? 1 : undefined, textAlign: 'center', whiteSpace: isPhone ? 'nowrap' : undefined, fontVariantNumeric: 'tabular-nums' }}>{weekLabel}</span>
        {navBtn('chevron_right', t('cal.nextWeek'), addDays(week, 7))}
        {week !== thisMonday ? <Button variant="ghost" size={44} onClick={() => onWeek(thisMonday)}>{t('cal.thisWeek')}</Button> : null}
      </div>
      {!view.editable ? (
        <Note tone="ochre" icon="lock_clock">
          <span style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
            <span>{t('cal.weekStarted')} {t('cal.weekStartedHint')}</span>
            <Button variant="secondary" size={44} onClick={() => onWeek(nextMonday(today))}>{t('cal.editNextWeek')}</Button>
          </span>
        </Note>
      ) : null}
      {view.otherDraft ? (
        <Note tone="ochre" icon="edit_note">
          <span style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
            {t('cal.otherDraft', { date: fds(view.otherDraft.monday) })}
            <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Button variant="secondary" size={44} onClick={() => onWeek(view.otherDraft!.monday)}>{t('cal.goToDraft')}</Button>
              <Button variant="ghost" size={44} onClick={() => void discardOther()}>{t('cal.discard')}</Button>
            </span>
          </span>
        </Note>
      ) : null}
      {midWeek ? <Note tone="cream" icon="info">{t('cal.midWeekChange', { date: fds(midWeek.effectiveFrom) })}</Note> : null}

      {canEdit ? (isPhone ? (
        // round 6, phone: the activities are a group with its header outside
        <Group title={t('cal.paletteHint')} pad="10px 0" gap={0}>
          <div className="scroll-x" style={{ display: 'flex', gap: 8, padding: '0 14px 2px' }}>{paletteChips}</div>
        </Group>
      ) : (
        <div style={{ background: '#FFFFFF', border: '1px solid #EFE7DC', borderRadius: 16, boxShadow: 'var(--card-shadow)', padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={smallCaps}>{t('cal.paletteHint')}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{paletteChips}</div>
        </div>
      )) : null}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
        {isPhone ? (
          // round 6, phone: one day at a time; a segmented day switch, then the day's rows in one flat group (the fixed times are quiet rows)
          <div style={{ flex: '1 1 100%', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div role="tablist" aria-label={t('cal.day')} style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 2, padding: 3, borderRadius: 11, background: '#EAE6E0' }}>
              {WEEKDAYS.map((w) => (
                <button key={w} type="button" role="tab" aria-label={`${wShort(w)} ${dayNum(w)}`} aria-selected={pday === w} onClick={() => { setPday(w); setSel(null); }} style={{ minWidth: 0, minHeight: 48, padding: '3px 0', borderRadius: 9, border: 'none', background: pday === w ? '#FFFFFF' : 'transparent', boxShadow: pday === w ? '0 1px 3px rgba(40,30,20,0.14)' : 'none', color: pday === w ? '#1E1A16' : '#5E5852', fontSize: 15, fontWeight: pday === w ? 600 : 500, cursor: 'pointer', fontFamily: 'Inter', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', lineHeight: 1.2, transition: 'background-color .15s' }}>
                  <span>{wShort(w)}</span>
                  <span style={{ fontSize: 12, color: '#6B6259', fontWeight: 400, whiteSpace: 'nowrap' }}>{fd(dateOf(w), { day: 'numeric', month: 'short' })}</span>
                </button>
              ))}
            </div>
            <div style={{ background: '#FFFFFF', borderRadius: 14, overflow: 'hidden' }}>
              {fixed.map(([time, label, icon, slotLabel], i) => icon
                ? <div key={time} style={{ minHeight: 44, background: '#FBF9F6', display: 'flex', alignItems: 'center', gap: 10, padding: '6px 16px', fontSize: 15, lineHeight: 1.3, color: '#4A4038', ...rowLine(i === 0) }}><span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 500, flex: 'none', width: 74 }}>{time}</span><span>{label}</span></div>
                : slotCard({ w: pday, slot: time as Slot }, slotLabel, i === 0))}
            </div>
          </div>
        ) : (
          <div style={{ flex: '1 1 640px', minWidth: 0, overflowX: 'auto' }}>
            <div style={{ minWidth: 660, display: 'grid', gridTemplateColumns: '96px repeat(5,minmax(0,1fr))', gap: 8 }}>
              <div />
              {WEEKDAYS.map((w) => {
                const focus = focusDate === dateOf(w);
                return (
                  <div key={w} style={{ textAlign: 'center', padding: '6px 0', lineHeight: 1.3, borderBottom: focus ? '3px solid #24201C' : '3px solid transparent' }}>
                    <div style={{ fontSize: FONT_BODY, fontWeight: 600 }}>{wLong(w)}</div>
                    <div style={{ fontSize: FONT_SMALL, color: '#5E5852', fontWeight: focus ? 600 : 400 }}>{dayNum(w)}</div>
                  </div>
                );
              })}
              {fixed.map(([time, label, icon, slotLabel]) => (
                <div key={time} style={{ display: 'contents' }}>
                  <div style={{ padding: '10px 4px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 16, fontVariantNumeric: 'tabular-nums', lineHeight: 1.4 }}>{time}</span>
                    <span style={{ fontSize: 'max(13px, var(--cp-body, 0px))', color: '#5E5852', lineHeight: 1.4 }}>{slotLabel}</span>
                  </div>
                  {icon ? (
                    <div style={{ gridColumn: 'span 5', minHeight: 48, borderRadius: 10, background: '#F0EAE1', display: 'flex', alignItems: 'center', gap: 8, padding: '0 14px', fontSize: FONT_BODY }}>{fixedIcon(icon)}{label}</div>
                  ) : WEEKDAYS.map((w) => {
                    const c: Cell = { w, slot: time as Slot };
                    const v = cellOf(c);
                    const st = cellStyle(c);
                    const content = v ? (
                      <>
                        <span style={{ fontSize: FONT_BODY, lineHeight: '19px', fontWeight: 600, paddingRight: canEdit ? 24 : 0 }}>{title(c)}</span>
                        <span style={{ fontSize: 'max(13px, var(--cp-body, 0px))', color: '#5E5852', lineHeight: 1.4 }}>{roomOf(v.roomId)}</span>
                        <span style={{ fontSize: FONT_SMALL, lineHeight: 1.4 }}>{staffCall(s.staff[v.staffId])}</span>
                        {isChanged(c) ? <span style={{ marginTop: 'auto', fontSize: 12, fontWeight: 600, color: '#7A5510' }}>{t('cal.changed')}</span> : null}
                      </>
                    ) : (
                      <>
                        <span style={{ margin: 'auto', fontSize: 'max(13px, var(--cp-body, 0px))', color: '#5E5852', textAlign: 'center', lineHeight: 1.4 }}>{hint || t('cal.empty')}</span>
                        {isChanged(c) ? <span style={{ fontSize: 12, fontWeight: 600, color: '#7A5510' }}>{t('cal.changed')}</span> : null}
                      </>
                    );
                    const box = { flex: 1, minHeight: 104, borderRadius: 10, border: st.border, background: st.background, boxShadow: st.boxShadow, padding: 10, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 } as const;
                    return (
                      <div key={key(c)} style={{ position: 'relative', display: 'flex', minWidth: 0 }} onDragOver={canEdit ? (e) => { e.preventDefault(); if (over !== key(c)) setOver(key(c)); } : undefined} onDrop={canEdit ? (e) => { e.preventDefault(); dropAt(c); } : undefined}>
                        {canEdit ? (
                          <div draggable={!!v} onDragStart={(e) => { if (!v) return; try { e.dataTransfer.setData('text/plain', key(c)); } catch { /* ignore */ } setDrag({ cell: c }); }} onDragEnd={() => { setDrag(null); setOver(null); }}
                            onClick={() => tapCell(c)} onKeyDown={onKey(c)} role="button" tabIndex={0} aria-label={aria(c)} aria-pressed={!!sel && key(sel) === key(c)} style={{ ...box, cursor: 'pointer' }}>{content}</div>
                        ) : <div role="group" aria-label={aria(c)} style={box}>{content}</div>}
                        {removeBtn(c, 44)}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}

        {selCell && selV ? (isPhone ? (
          // round 6, phone: the slot editor is a set of groups (the activity, the room, the teacher, move to) and a red "clear" row
          <div style={{ flex: '1 1 100%', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 18 }}>
            <Group title={`${wLong(selCell.w)} ${dayNum(selCell.w)} · ${selCell.slot}`} pad="12px 16px 14px" gap={12}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 20, lineHeight: '28px', fontWeight: 500, letterSpacing: '-0.3px', color: '#2B231C', minWidth: 0 }}>{title(selCell)}</span>
                <button type="button" className="cp-press" onClick={() => setSel(null)} aria-label={t('common.close')} style={{ width: 34, height: 34, borderRadius: 999, border: 'none', background: '#F3EEE8', color: '#75624B', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flex: 'none', padding: 0 }}>
                  <Icon name="close" size={19} />
                </button>
              </div>
              <Select label={t('cal.activity')} value={selV.activityId} onChange={(id) => placeAct(selCell, id)} options={activityOptions} />
            </Group>
            <Group title={t('cal.room')} pad="12px 14px">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }} role="radiogroup" aria-label={t('cal.room')}>{roomChips}</div>
            </Group>
            <Group title={t('cal.teacher')} pad="12px 14px">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }} role="radiogroup" aria-label={t('cal.teacher')}>{teacherChips}</div>
            </Group>
            <Group title={t('cal.moveTo')} pad="12px 14px">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{moveChips}</div>
            </Group>
            <button type="button" className="cp-tap-self" onClick={() => clearCell(selCell)} style={{ height: 50, borderRadius: 14, border: 'none', background: '#FFFFFF', color: '#9A3D24', fontSize: 16, fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter' }}>{t('cal.clearSlot')}</button>
          </div>
        ) : (
          <div style={{ flex: isPhone ? '1 1 100%' : '0 1 300px', minWidth: isPhone ? 0 : 260, background: '#FFFFFF', border: '1px solid #EFE7DC', borderRadius: 16, boxShadow: 'var(--card-shadow)', padding: isPhone ? '16px 16px 14px' : '20px 22px', display: 'flex', flexDirection: 'column', gap: isPhone ? 12 : 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={smallCaps}>{wLong(selCell.w)} {dayNum(selCell.w)} · {selCell.slot}</span>
                <span style={{ fontSize: 20, lineHeight: '28px', fontWeight: 500, letterSpacing: '-0.3px', color: '#2B231C' }}>{title(selCell)}</span>
              </div>
              <button type="button" onClick={() => setSel(null)} aria-label={t('common.close')} style={{ width: 44, height: 44, borderRadius: 999, border: '1px solid #E4DACD', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flex: 'none', padding: 0 }}>
                <Icon name="close" size={20} />
              </button>
            </div>
            <Select label={t('cal.activity')} value={selV.activityId} onChange={(id) => placeAct(selCell, id)} options={activityOptions} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {panelLabel(t('cal.room'))}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }} role="radiogroup" aria-label={t('cal.room')}>
                {roomChips}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {panelLabel(t('cal.teacher'))}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }} role="radiogroup" aria-label={t('cal.teacher')}>
                {teacherChips}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {panelLabel(t('cal.moveTo'))}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {moveChips}
              </div>
            </div>
            <button type="button" onClick={() => clearCell(selCell)} style={{ alignSelf: 'flex-start', height: 44, padding: '0 14px', borderRadius: 12, border: 'none', background: 'transparent', color: '#9A3D24', fontSize: 16, fontWeight: 500, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 4, fontFamily: 'Inter' }}>{t('cal.clearSlot')}</button>
          </div>
        )) : null}
      </div>

      {isPhone ? (
        <Group title={t('cal.versions')} pad={0} gap={0}>
          {vp.rows.map((v, i) => versionRow(v, i))}
          <Pager page={vp.page} pages={vp.pages} onPage={vp.setPage} label={t('cal.pagerVersions')} />
        </Group>
      ) : (
        <div style={{ background: '#FFFFFF', border: '1px solid #EFE7DC', borderRadius: 16, boxShadow: 'var(--card-shadow)', overflow: 'hidden' }}>
          <div style={{ padding: '18px 22px 10px' }}><span style={smallCaps}>{t('cal.versions')}</span></div>
          {vp.rows.map((v, i) => versionRow(v, i))}
          <Pager page={vp.page} pages={vp.pages} onPage={vp.setPage} label={t('cal.pagerVersions')} />
        </div>
      )}

      <PublishSheet open={pubOpen} onClose={() => setPubOpen(false)} summary={summary} more={Math.max(0, changed - summary.length)} count={changed} week={week}
        onPublish={async (effectiveFrom, notify) => {
          await d.flush();
          const r = await act('schedule.publish', { effectiveFrom, days: d.draft, notify }, { silent: true });
          if (r.ok) { d.reset(); setPubOpen(false); setSel(null); say(t(notify ? 'cal.publishedToast' : 'cal.publishedToastQuiet', { date: fdl(effectiveFrom) })); return ''; }
          return t(r.code, r.params);
        }} />
      <CatalogEditor open={catalog} onClose={() => setCatalog(false)} />
    </div>
  );
}

function PublishSheet({ open, onClose, summary, more, count, week, onPublish }: { open: boolean; onClose: () => void; summary: string[]; more: number; count: number; week: ISODate; onPublish: (date: string, notify: boolean) => Promise<string> }) {
  const t = useT();
  const { fdl } = useFmt();
  const { today } = useNow();
  // default: the Monday of the week being edited (only a week that has not started can be edited, so it is always after today)
  const [date, setDate] = useState<string>(week);
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useResetOn(open ? 'open' + week : null, () => { setDate(week); setNotify(true); setErr(''); });
  const min = addDays(today, 1);
  const ok = !!date && date >= min;
  return (
    <Sheet open={open} onClose={onClose} title={t('cal.publishTitle')}>
      <div style={{ fontSize: 16, lineHeight: '22px' }}>{plural(t, 'cal.changesPending', count)}</div>
      <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4, fontSize: FONT_BODY, lineHeight: 1.4 }}>
        {summary.map((x) => <li key={x}>{x}</li>)}
        {more ? <li>{t('cal.andMore', { n: more })}</li> : null}
      </ul>
      <DateField label={t('cal.effective')} value={date} min={min} onChange={setDate} error={!ok && t('cal.err.futureOnly')} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Button variant="quiet" size={44} onClick={() => setDate(week)}>{t('cal.weekStart')}</Button>
        <Button variant="quiet" size={44} onClick={() => setDate(nextMonday(today))}>{t('cal.nextMonday')}</Button>
      </div>
      <Note tone="cream" icon="info">{ok ? t('cal.effectiveNote', { date: fdl(date) }) : t('cal.err.futureOnly')}</Note>
      <Toggle on={notify} onClick={() => setNotify(!notify)} label={t('cal.notify')} />
      {err ? <Note tone="rust" icon="error">{err}</Note> : null}
      <Button full disabled={!ok || busy} onClick={async () => { setBusy(true); setErr(await onPublish(date, notify)); setBusy(false); }}>{t('cal.publishBtn')}</Button>
    </Sheet>
  );
}
