// Weekly schedule builder (design ScrCal builder): palette from the catalog, drag or tap-to-place, room / teacher / activity editor, dated publish.
// The schedule is versioned by effective date: the grid shows one week at a time (previous / next week, date under each day name) with the version
// in force for that week. A week can be changed until it is over: a future week publishes from its Monday, the current week from today (KC round 7: the days before
// today have already happened and stay read-only). Edits are saved as a shared draft.
// Drag works with a mouse; on touch, hold an activity (or a placed one) and drag it onto a slot, or tap an activity and then a slot (or use "Move to").
// A tap on an empty slot opens a short list to choose its activity (KC round 9). Every placed activity has a quick ✕ to remove it.
// Round 6 (phone, native look): one day is an iOS grouped list (the day's slots as rows), the slot editor is a set of groups, the versions are a list group.
// Round 14 (B1): the activity team builds too. Its Publish is "Send to Ega": the version waits for management ("Waiting for Ega" above the builder); one Ega
// sent back shows "Returned: …" with Edit, which loads it into the draft. The catalog stays management's.
// Round 14 (B2): Saturday and Sunday follow Friday, empty by default under a lighter "Weekend" header; a session placed there opens the club that day.
// Round 15 (phase 2): while a version waits, "See proposed week" draws it in the grid (a changed cell shows its session before, struck through, and after) and management
// approves or rejects it right there (the same approval actions as Approvals); the activity team sees the proposed week without the buttons.
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, type KeyboardEvent } from 'react';
import { useResetOn } from '../../lib/useResetOn';
import { ALL_DAYS, actorName, addDays, asWeekday, live, publishDateOf, scheduleVersionFor, staffCall, type ISODate, type Weekday, type WeekSlot } from '@cp/shared';
import { activityName, roomName } from '@cp/shared/rules/activity';
import { SLOTS, activityTeachers, changedCells, cloneDays, dayEditable, effectiveVersions, mondayOf, nextMonday, normalizeDays, pendingVersions, returnedVersion, sameCell, weekDays, weekEditable, weekView, type Days } from '@cp/shared/rules/calendar';
import { Button, DateField, Group, Icon, IconButton, Note, Pager, Select, Sheet, Toggle, chipStyle, uiZoom, usePaged, FONT_BODY, FONT_SMALL } from '../../components/ui';
import { useDevice } from '../../hooks/useDevice';
import { useT, useFmt } from '../../lib/i18n';
import { useAct } from '../../lib/act';
import { useNow } from '../../lib/clock';
import { useMe } from '../../lib/me';
import { useClub } from '../../store/replica';
import { say } from '../../store/ui';
import { sessionText } from '../members/approvalView';
import { Badge, plural, rowLine } from '../activity/lib';
import { CatalogEditor } from './CatalogEditor';
import { ProposalActions } from './ProposalActions';
import { smallCaps, weekdayName } from './lib';

type Cell = { w: Weekday; slot: WeekSlot };
const key = (c: Cell) => `${c.w}|${c.slot}`;
export interface CellRequest { w: Weekday; slot: WeekSlot; n: number }

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
  const { role } = useMe();
  /** round 14: the activity team's publish asks Ega (management publishes itself) */
  const asks = role !== 'mgmt';
  const d = useDraft(week);
  const view = d.view;
  const waiting = pendingVersions(s)[0];
  const returned = asks ? returnedVersion(s) : undefined;
  /** round 15: the grid shows the version that waits for management instead of the plan in force */
  const [showProposed, setShowProposed] = useState(false);
  useResetOn(waiting?.id ?? '', () => setShowProposed(false));
  const proposing = !!waiting && showProposed;
  const [sel, setSel] = useState<Cell | null>(null);
  const [pal, setPal] = useState<string | null>(null);
  const [drag, setDrag] = useState<null | { act: string } | { cell: Cell }>(null);
  const [over, setOver] = useState<string | null>(null);
  const [pday, setPday] = useState<Weekday>(asWeekday(today));
  const [pubOpen, setPubOpen] = useState(false);
  const [catalog, setCatalog] = useState(false);
  /** an empty slot that was tapped: the activity list is open for it */
  const [pick, setPick] = useState<Cell | null>(null);
  /** touch drag (KC round 9: drag and drop on phones — the browser's drag and drop only works with a mouse): a long press picks up an activity
   *  or a placed one, a pill follows the finger, and the slot under it lights up */
  const [tdrag, setTdrag] = useState<null | { x: number; y: number; label: string }>(null);
  const tRef = useRef({ timer: 0, x0: 0, y0: 0, src: null as null | { act: string } | { cell: Cell }, label: '', active: false, over: null as string | null, suppress: false });
  const coarse = useMemo(() => typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches, []);
  useResetOn(week, () => { setSel(null); setPal(null); setPick(null); });

  const teachers = activityTeachers(s);
  const palette = live(s.activities).filter((a) => a.active).sort((a, b) => a.name.localeCompare(b.name));
  const rooms = live(s.rooms).sort((a, b) => a.name.localeCompare(b.name));
  const versions = effectiveVersions(s);
  const vp = usePaged(versions, 5);
  const inForce = scheduleVersionFor(s, today);
  const hours = s.club.settings;
  const changed = d.changes.length;
  const canEdit = view.editable && !view.otherDraft && !proposing;
  /** KC round 7: in the current week a day before today has already happened: it shows what ran and cannot be changed */
  const locked = (w: Weekday) => !dayEditable(view.dates[w - 1], today);
  const wLong = (w: number) => weekdayName(lang, w, 'long');
  const wShort = (w: number) => weekdayName(lang, w, 'short');
  /** round 14: Saturday and Sunday (a lighter header) */
  const weekendDay = (w: Weekday) => w > 5;
  const dateOf = (w: number) => view.dates[w - 1];
  const dayNum = (w: number) => fd(dateOf(w), { day: 'numeric', month: 'short' });
  /** round 15: the waiting version from the day it would publish (an earlier day of the week keeps the plan in force) */
  const proposedFrom = waiting ? publishDateOf(waiting, today) : '';
  const proposedDays = useMemo(() => {
    if (!waiting) return null;
    const wd = normalizeDays(waiting.days);
    return Object.fromEntries(ALL_DAYS.map((w) => [w, view.dates[w - 1] >= proposedFrom ? wd[w] : view.base[w]])) as Days;
  }, [waiting, view, proposedFrom]);
  const gridDays: Days = proposing && proposedDays ? proposedDays : d.draft;
  const shownBase: Days = proposing ? view.base : d.base;
  const cellOf = (c: Cell) => gridDays[c.w][c.slot];
  const title = (c: Cell) => { const x = cellOf(c); return x ? activityName(s.activities[x.activityId], lang) : ''; };
  const roomOf = (id?: string) => (id ? roomName(s.rooms[id], lang) : '');
  const isChanged = (c: Cell) => !sameCell(gridDays[c.w][c.slot], shownBase[c.w][c.slot]);
  /** "Changed" on a cell of the draft; in the proposed week the cell shows its session before, struck through, above the new one */
  const changedLabel = (c: Cell, fs: number) => (isChanged(c) && !proposing ? <span style={{ fontSize: fs, fontWeight: 600, color: '#7A5510', lineHeight: 1.4 }}>{t('cal.changed')}</span> : null);
  const beforeLine = (c: Cell, fs: number) => (isChanged(c) && proposing ? <s data-before style={{ fontSize: fs, color: '#8A8078', lineHeight: 1.4, overflowWrap: 'anywhere' }}>{sessionText(s, shownBase[c.w][c.slot], t, lang)}</s> : null);
  const proposedAttr = (c: Cell) => (proposing && isChanged(c) ? { 'data-proposed-cell': key(c) } : {});

  // "Edit activity" from the calendar: show the slot's editor
  useEffect(() => {
    if (!request) return;
    const c = { w: request.w, slot: request.slot };
    setPday(c.w);
    if (d.draft[c.w][c.slot] && !locked(c.w)) setSel(c);
  }, [request?.n]); // eslint-disable-line react-hooks/exhaustive-deps

  const placeAct = (c: Cell, activityId: string) => {
    if (!canEdit || locked(c.w)) return;
    const a = s.activities[activityId];
    if (!a) return;
    const staff = cellOf(c)?.staffId ?? teachers[c.slot === '10:30' ? 0 : 1]?.id ?? teachers[0]?.id;
    if (!staff) { say(t('cal.err.noTeacher'), { tone: 'error', icon: 'error' }); return; }
    d.edit((x) => { x[c.w][c.slot] = { activityId, roomId: a.roomId, staffId: staff }; });
    // KC round 8d: adding an activity just places it — the slot's side panel opens only when someone taps an activity already in a slot
    setSel(null);
    setPal(null);
  };
  /** `keep`: the move came from the open side panel ("Move to"), so the panel follows the activity; a drag elsewhere leaves it closed. */
  const swap = (a: Cell, b: Cell, keep = false) => { if (locked(a.w) || locked(b.w)) return; d.edit((x) => { const tmp = x[b.w][b.slot]; x[b.w][b.slot] = x[a.w][a.slot]; x[a.w][a.slot] = tmp; }); setSel(keep ? b : null); };
  const clearCell = (c: Cell) => { d.edit((x) => { x[c.w][c.slot] = null; }); if (sel && key(sel) === key(c)) setSel(null); };
  const dropAt = (c: Cell) => {
    const g = drag;
    setDrag(null);
    setOver(null);
    if (!g || !canEdit || locked(c.w)) return;
    if ('act' in g) placeAct(c, g.act);
    else if (key(g.cell) !== key(c)) swap(g.cell, c);
  };
  // a tap on an empty slot opens the activity list (the side panel is only for a slot that already has one)
  const tapCell = (c: Cell) => {
    if (tRef.current.suppress) { tRef.current.suppress = false; return; } // the click that ends a touch drag
    if (!canEdit || locked(c.w)) return;
    if (pal) placeAct(c, pal); else if (cellOf(c)) setSel(sel && key(sel) === key(c) ? null : c); else { setSel(null); setPick(c); }
  };
  // ---- touch drag ----
  const cellByKey = (k: string) => { const [w, slot] = k.split('|'); return { w: Number(w) as Weekday, slot: slot as WeekSlot }; };
  const dropRef = useRef<(k: string) => void>(() => {});
  dropRef.current = (k: string) => {
    const src = tRef.current.src;
    const c = cellByKey(k);
    if (!src || !canEdit || locked(c.w)) return;
    if ('act' in src) placeAct(c, src.act);
    else if (key(src.cell) !== k) swap(src.cell, c);
  };
  const touchStart = (src: { act: string } | { cell: Cell }, label: string) => (e: React.TouchEvent) => {
    if (!canEdit || e.touches.length !== 1) return;
    const r = tRef.current, p = e.touches[0];
    window.clearTimeout(r.timer);
    Object.assign(r, { x0: p.clientX, y0: p.clientY, src, label, active: false, over: null });
    r.timer = window.setTimeout(() => {
      r.active = true;
      r.suppress = true;
      try { navigator.vibrate?.(12); } catch { /* not supported */ }
      setPal(null); setSel(null);
      setDrag(src);
      setTdrag({ x: r.x0, y: r.y0, label });
    }, 280);
  };
  /** before the long press fires, a moving finger is a scroll or a swipe: no drag */
  const touchMoveEarly = (e: React.TouchEvent) => { const r = tRef.current, p = e.touches[0]; if (!r.active && p && Math.hypot(p.clientX - r.x0, p.clientY - r.y0) > 8) window.clearTimeout(r.timer); };
  const touchEndEarly = () => { const r = tRef.current; if (!r.active) { window.clearTimeout(r.timer); r.suppress = false; } };
  const dragging = !!tdrag;
  useEffect(() => {
    if (!dragging) return;
    const r = tRef.current;
    const main = document.getElementById('main');
    const move = (e: TouchEvent) => {
      e.preventDefault(); // the page holds still while something is being dragged
      const p = e.touches[0];
      if (!p) return;
      const k = (document.elementFromPoint(p.clientX, p.clientY)?.closest('[data-slot]') as HTMLElement | null)?.dataset.slot ?? null;
      if (k !== r.over) { r.over = k; setOver(k); }
      setTdrag((x) => (x ? { ...x, x: p.clientX, y: p.clientY } : x));
      if (main) { if (p.clientY < 90) main.scrollBy(0, -14); else if (p.clientY > window.innerHeight - 150) main.scrollBy(0, 14); }
    };
    const finish = (drop: boolean) => () => {
      const k = r.over;
      r.active = false; r.over = null;
      setTdrag(null); setDrag(null); setOver(null);
      if (drop && k) dropRef.current(k);
      window.setTimeout(() => { r.suppress = false; }, 450);
    };
    const end = finish(true), cancel = finish(false);
    document.addEventListener('touchmove', move, { passive: false });
    document.addEventListener('touchend', end);
    document.addEventListener('touchcancel', cancel);
    return () => { document.removeEventListener('touchmove', move); document.removeEventListener('touchend', end); document.removeEventListener('touchcancel', cancel); };
  }, [dragging]);
  /** a long press must not select text or open the system menu */
  const noCallout = { WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none' } as CSSProperties;
  const onKey = (c: Cell) => (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tapCell(c); } };

  const cellStyle = (c: Cell) => {
    const v = cellOf(c);
    const on = !!sel && key(sel) === key(c);
    const hot = over === key(c) && !!drag && !locked(c.w);
    return { background: hot ? 'var(--press, #EEEEF0)' : v ? 'var(--cell, #F4F4F5)' : 'transparent', border: hot ? '2px dashed var(--accent, #75624B)' : v ? (isChanged(c) ? '1px solid #8A755B' : 'none') : '1px dashed var(--field-bd, #E0E0E4)', boxShadow: on ? '0 0 0 3px #24201C' : v && !hot ? 'inset 0 0 0 1px var(--cell-bd, transparent)' : 'none' }; // round 9: a placed session is a warm-white cell with a fine edge on the cream page
  };
  const aria = (c: Cell) => `${wLong(c.w)} ${c.slot}: ${cellOf(c) ? title(c) : t('cal.empty')}`;
  const hint = !canEdit ? '' : drag ? t('cal.dropHere') : pal ? t('cal.tapToPlace', { name: activityName(s.activities[pal], lang) }) : '';
  /** an empty slot that can still be changed invites a tap */
  const emptyText = (c: Cell) => hint || (canEdit && !locked(c.w) ? t('cal.addHere') : t('cal.empty'));

  const fixed: [string, string, string | null, string][] = [
    [hours.open, t('cal.fixOpen'), 'door_front', ''],
    ['10:30', '', null, t('cal.morning')],
    ['12:00', t('cal.fixLunch', { room: roomOf('room-dining') || t('cal.diningRoom') }), 'restaurant', ''],
    ['13:30', '', null, t('cal.afternoon')],
    ['15:00', t('cal.fixTea', { room: roomOf('room-lounge') || t('cal.lounge') }), 'local_cafe', ''],
    [hours.close, t('cal.fixClose'), 'home', ''],
  ];
  const fixedIcon = (i: string) => <Icon name={i} size={18} color="var(--accent, #75624B)" />;

  const shown = view.versions[0];
  const who = (v: NonNullable<typeof shown>) => (v.publishedBy ? (staffCall(s.staff[v.publishedBy.replace('staff:', '')]) || actorName(s, v.publishedBy)) : '');
  const status = changed ? plural(t, 'cal.changesPending', changed)
    : shown ? t('cal.publishedBy', { when: `${fds(shown.publishedAt?.slice(0, 10) || shown.effectiveFrom)}, ${shown.publishedAt?.slice(11, 16) || ''}`, who: who(shown) }) + ' · ' + t('cal.inForceFrom', { date: fds(shown.effectiveFrom) })
      : t('cal.noSchedule');
  const midWeek = !changed && view.versions.length > 1 ? view.versions[1] : null;

  // the remove ✕ sits beside the cell (never inside the cell's own button)
  const removeBtn = (c: Cell, size: number, pos: CSSProperties = { top: 2, right: 2 }) => {
    if (!canEdit || locked(c.w) || !cellOf(c)) return null;
    return (
      <button type="button" className={isPhone ? 'cp-press' : undefined} onClick={() => clearCell(c)} aria-label={t('cal.removeFromSlot', { name: title(c), day: wLong(c.w), slot: c.slot })} title={t('cal.clearSlot')}
        style={{ position: 'absolute', ...pos, width: size, height: size, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span aria-hidden="true" style={{ width: 28, height: 28, borderRadius: 999, background: '#FFFFFF', boxShadow: '0 0 0 1px var(--hairline, #E2E2E6), 0 1px 2px rgba(40,30,20,.08)', color: '#5E5852', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="close" size={18} /></span>
      </button>
    );
  };

  // round 6, phone: a slot is one row of the day's group (time and part of the day, the activity with room and teacher); the selected row has a dark bar
  const slotCard = (c: Cell, label: string, first: boolean) => {
    const v = cellOf(c);
    const on = !!sel && key(sel) === key(c);
    const touch = canEdit && !locked(c.w); // a day before today is read-only
    const inner = (
      <>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 'none', width: 74 }}>
          <span style={{ fontSize: 16, fontVariantNumeric: 'tabular-nums', fontWeight: 500, lineHeight: 1.4 }}>{c.slot}</span>
          <span style={{ fontSize: 13, color: '#6B6259', lineHeight: 1.3 }}>{label}</span>
        </span>
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2, paddingRight: v && touch ? 40 : 0 }}>
          {beforeLine(c, 14)}
          {v ? (
            <>
              <span style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.35 }}>{title(c)}</span>
              <span style={{ fontSize: 14, color: '#6B6259', lineHeight: 1.35 }}>{roomOf(v.roomId)} · {staffCall(s.staff[v.staffId])}</span>
            </>
          ) : <span style={{ fontSize: 15, color: touch ? 'var(--accent, #75624B)' : '#8A8078', fontWeight: touch ? 500 : 400, lineHeight: 1.4, display: 'inline-flex', alignItems: 'center', gap: 4 }}>{touch && !hint ? <Icon name="add" size={18} /> : null}{emptyText(c)}</span>}
          {changedLabel(c, 13)}
        </span>
      </>
    );
    const box = { width: '100%', minHeight: 64, padding: '10px 12px 10px 16px', display: 'flex', gap: 10, alignItems: 'center', textAlign: 'left', color: '#24201C', fontFamily: 'Inter', flex: 1, minWidth: 0, border: 'none', background: 'transparent' } as const;
    return (
      <div key={key(c)} data-slot={touch ? key(c) : undefined} {...proposedAttr(c)} className={touch ? 'cp-tap' : undefined} style={{ position: 'relative', display: 'flex', backgroundColor: on || (touch && over === key(c) && !!drag) ? 'var(--press, #EEEEF0)' : 'transparent', boxShadow: on ? 'inset 3px 0 0 #2B231C' : touch && over === key(c) && !!drag ? 'inset 3px 0 0 var(--accent, #75624B)' : undefined, ...rowLine(first || on) }}>
        {touch
          ? <button type="button" className="cp-tap-target" onClick={() => tapCell(c)} aria-label={aria(c)} aria-pressed={on} style={{ ...box, ...noCallout, cursor: 'pointer' }}
              {...(v ? { onTouchStart: touchStart({ cell: c }, title(c)), onTouchMove: touchMoveEarly, onTouchEnd: touchEndEarly } : {})}>{inner}</button>
          : <div aria-label={aria(c)} role="group" style={{ ...box, ...(canEdit ? { opacity: 0.62 } : {}) }}>{inner}</div>}
        {removeBtn(c, 44, { top: '50%', right: 6, marginTop: -22 })}
      </div>
    );
  };

  const selCell = canEdit && sel && !locked(sel.w) && cellOf(sel) ? sel : null;
  const selV = selCell ? cellOf(selCell) : null;
  const chipBtn = (labelText: string, on: boolean, onClick: () => void, role?: string) => {
    const c = chipStyle(on, false);
    return <button key={labelText} type="button" className={`${isPhone ? 'cp-press' : ''}${on ? '' : ' cp-fill'}`.trim() || undefined} role={role} aria-checked={role ? on : undefined} onClick={onClick} style={{ height: isPhone ? 40 : 44, padding: '0 14px', borderRadius: 999, border: c.bd, background: c.bg, color: c.fg, fontSize: FONT_BODY, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'Inter' }}>{labelText}</button>;
  };
  const panelLabel = (text: string) => <span style={smallCaps}>{text}</span>;
  const roomChips = selCell && selV ? rooms.map((r) => chipBtn(roomName(r, lang), selV.roomId === r.id, () => d.edit((x) => { const c = x[selCell.w][selCell.slot]; if (c) c.roomId = r.id; }), 'radio')) : null;
  const teacherChips = selCell && selV ? [...teachers.map((x) => x.id), ...(teachers.some((x) => x.id === selV.staffId) ? [] : [selV.staffId])].map((id) => chipBtn(staffCall(s.staff[id]) || id, selV.staffId === id, () => d.edit((x) => { const c = x[selCell.w][selCell.slot]; if (c) c.staffId = id; }), 'radio')) : null;
  const moveChips = selCell && selV ? (ALL_DAYS.filter((w) => !locked(w)).flatMap((w) => SLOTS.map((slot) => ({ w, slot }))).filter((c) => key(c) !== key(selCell)).map((c) => (
      <button key={key(c)} type="button" className="cp-fill" onClick={() => { swap(selCell, c, true); setPday(c.w); }} style={{ height: 44, padding: '0 12px', borderRadius: 999, border: cellOf(c) ? '1px solid #8A755B' : '1px dashed #CAB8A2', background: 'var(--fill, #F4F4F5)', color: '#24201C', fontSize: 16, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'Inter' }}>{wShort(c.w)} {c.slot}</button>
    ))) : null;


  const summary = d.changes.slice(0, 8).map((c) => {
    const before = d.base[c.w][c.slot], after = d.draft[c.w][c.slot];
    const nm = (x: typeof before) => (x ? activityName(s.activities[x.activityId], lang) : '—');
    return `${wShort(c.w)} ${c.slot}: ${nm(before)} → ${nm(after)}`;
  });
  const thisMonday = mondayOf(today);
  /** the week "Edit" goes to from a week that is over: this one while it still has days to come, else the next */
  const editTarget = weekEditable(thisMonday, today) ? thisMonday : nextMonday(today);
  const weekLabel = `${fd(view.dates[0], { day: 'numeric', month: 'short' })} – ${fd(view.dates[4], { day: 'numeric', month: 'short', year: 'numeric' })}`;
  /** round 14: "Edit" on a version Ega sent back: it becomes the draft of its week (this week when its start date has passed) */
  const editReturned = async () => {
    if (!returned) return;
    const from = returned.effectiveFrom > today ? returned.effectiveFrom : today;
    const r = await act('schedule.saveDraft', { days: returned.days, effectiveFrom: from }, { silent: true });
    if (r.ok) onWeek(mondayOf(from));
  };
  const discardOther = async () => {
    if (!view.otherDraft) return;
    const m = view.otherDraft.monday;
    await act('schedule.saveDraft', { days: weekDays(s, m), effectiveFrom: m }, { silent: true });
  };
  const navBtn = (icon: string, label: string, to: ISODate) => <IconButton icon={icon} label={label} onClick={() => onWeek(to)} {...(isPhone ? { size: 40, color: 'var(--accent, #75624B)' } : {})} />;

  const activityOptions = (() => {
    const list = palette.map((a) => ({ value: a.id, label: activityName(a, lang) }));
    const cur = selV?.activityId;
    return cur && !list.some((o) => o.value === cur) ? [...list, { value: cur, label: activityName(s.activities[cur], lang) }] : list;
  })();

  const versionRow = (v: (typeof versions)[number], i: number) => {
    const tag = v.effectiveFrom > today ? t('cal.upcoming') : inForce?.id === v.id ? t('cal.inForce') : t('cal.earlier');
    return (
      <div key={v.id} style={isPhone ? { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', minHeight: 56, flexWrap: 'wrap', ...rowLine(i === 0) } : { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 22px', borderTop: '0.5px solid var(--hairline, #E2E2E6)', minHeight: 56, flexWrap: 'wrap' }}>
        <span style={{ flex: '1 1 160px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.4 }}>{t('cal.versionFrom', { date: fdl(v.effectiveFrom) })}</span>
          <span style={{ fontSize: FONT_BODY, color: '#5E5852', lineHeight: '20px' }}>{t('cal.publishedBy', { when: `${fds(v.publishedAt?.slice(0, 10) || v.effectiveFrom)}, ${v.publishedAt?.slice(11, 16) || ''}`, who: who(v) })}</span>
        </span>
        <Badge label={tag} bg={v.effectiveFrom > today ? '#F6ECD6' : inForce?.id === v.id ? '#E3EFE6' : 'var(--press, #EEEEF0)'} fg={v.effectiveFrom > today ? '#7A5510' : inForce?.id === v.id ? '#3D6B4F' : '#5E5852'} icon={v.effectiveFrom > today ? 'schedule' : inForce?.id === v.id ? 'check_circle' : 'history'} />
      </div>
    );
  };

  const paletteChips = palette.map((a) => {
    const c = chipStyle(pal === a.id, false);
    return (
      <button key={a.id} type="button" className={pal === a.id ? undefined : 'cp-fill'} draggable={!coarse} onDragStart={(e: DragEvent) => { try { e.dataTransfer.setData('text/plain', a.id); } catch { /* ignore */ } setDrag({ act: a.id }); setPal(null); }} onDragEnd={() => { setDrag(null); setOver(null); }}
        onTouchStart={touchStart({ act: a.id }, activityName(a, lang))} onTouchMove={touchMoveEarly} onTouchEnd={touchEndEarly}
        onClick={() => { if (tRef.current.suppress) { tRef.current.suppress = false; return; } setPal(pal === a.id ? null : a.id); setSel(null); }} aria-pressed={pal === a.id}
        style={{ height: 44, padding: '0 16px 0 12px', borderRadius: 999, border: c.bd, background: c.bg, color: c.fg, fontSize: 16, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'grab', whiteSpace: 'nowrap', fontFamily: 'Inter', flex: 'none', ...noCallout }}>
        <Icon name={a.icon} size={18} />{activityName(a, lang)}
      </button>
    );
  });

  return (
    <div className={isPhone ? 'cp-native' : undefined} style={{ display: 'flex', flexDirection: 'column', gap: isPhone ? 14 : 16, paddingTop: isPhone ? 14 : 28, borderTop: isPhone ? 'none' : '0.5px solid var(--hairline, #E2E2E6)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: isPhone ? 10 : 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: isPhone ? 4 : 6, minWidth: 0 }}>
          <div style={smallCaps}>{t('cal.builder')}</div>
          <h2 className="cp-serif" style={{ margin: 0, fontSize: isPhone ? 24 : 28, lineHeight: isPhone ? '30px' : '36px', fontWeight: 400, letterSpacing: '-0.8px', color: '#2B231C' }}>{t('cal.weekly')}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, lineHeight: 1.4, flexWrap: 'wrap' }}>
            {proposing ? <Badge kind="watch" label={t('cal.proposed')} /> : changed ? <Badge kind="watch" label={t('cal.draft')} /> : <Badge kind="paid" label={t('cal.published')} />}
            <span>{status}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {asks ? null : isPhone ? <IconButton icon="tune" label={t('cal.catalogBtn')} onClick={() => setCatalog(true)} size={40} color="var(--accent, #75624B)" /> : <Button variant="secondary" icon="tune" onClick={() => setCatalog(true)}>{t('cal.catalogBtn')}</Button>}
          {changed ? <Button variant="ghost" size={isPhone ? 44 : 48} onClick={() => { d.discard(); setSel(null); }}>{t('cal.discard')}</Button> : null}
          <button type="button" className={isPhone ? 'cp-press' : undefined} onClick={() => changed && canEdit && setPubOpen(true)} aria-disabled={!changed || !canEdit} aria-label={isPhone && !asks ? t('cal.publishBtn') : undefined} style={{ height: isPhone ? 40 : 52, padding: isPhone ? '0 18px' : '0 24px', borderRadius: 999, border: 'none', background: changed && canEdit ? '#24201C' : 'var(--press, #EEEEF0)', color: changed && canEdit ? '#FFFFFF' : '#5E5852', fontSize: 16, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 8, cursor: changed && canEdit ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap', fontFamily: 'Inter' }}>
            <Icon name="send" size={20} />{asks ? t('cal.sendForApproval') : isPhone ? t('cal.publishShort') : t('cal.publishBtn')}
          </button>
        </div>
      </div>
      {!teachers.length ? <Note tone="ochre" icon="info">{t('cal.noTeachers')}</Note> : null}
      {waiting ? (
        <Note tone="cream" icon="hourglass_top">
          <span data-testid="programme-waiting" style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start', minWidth: 0 }}>
            <span>{t('cal.waitingEga')} · {t('cal.fromDate', { date: fds(waiting.effectiveFrom) })}</span>
            <Button variant="secondary" size={44} icon={proposing ? 'undo' : 'visibility'} onClick={() => { if (!proposing && mondayOf(proposedFrom) !== week) onWeek(mondayOf(proposedFrom)); setShowProposed(!proposing); }}>{t(proposing ? 'cal.viewCurrent' : 'cal.viewProposed')}</Button>
            {asks ? null : <ProposalActions id={waiting.id} />}
          </span>
        </Note>
      ) : null}
      {returned ? (
        <Note tone="ochre" icon="undo">
          <span data-testid="programme-returned" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ overflowWrap: 'anywhere' }}>{t('cal.returnedNote', { note: returned.rejectNote ?? '' })}</span>
            <Button variant="secondary" size={44} onClick={() => void editReturned()}>{t('common.edit')}</Button>
          </span>
        </Note>
      ) : null}

      <div role="group" aria-label={t('cal.weekNav')} className={isPhone ? 'cp-grey' : undefined} style={isPhone ? { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 16, background: 'var(--fill, #F4F4F5)' } : { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {navBtn('chevron_left', t('cal.prevWeek'), addDays(week, -7))}
        <span aria-live="polite" style={{ fontSize: isPhone ? 16 : 18, fontWeight: 500, lineHeight: 1.4, minWidth: isPhone ? 0 : 150, flex: isPhone ? 1 : undefined, textAlign: 'center', whiteSpace: isPhone ? 'nowrap' : undefined, fontVariantNumeric: 'tabular-nums' }}>{weekLabel}</span>
        {navBtn('chevron_right', t('cal.nextWeek'), addDays(week, 7))}
        {week !== thisMonday ? <Button variant="ghost" size={44} onClick={() => onWeek(thisMonday)}>{t('cal.thisWeek')}</Button> : null}
      </div>
      {!view.editable ? (
        // KC round 7: only a week that is over is locked; the current week can be edited from today on
        <Note tone="ochre" icon="lock_clock">
          <span style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
            <span>{t('cal.weekStarted')}</span>
            <Button variant="secondary" size={44} onClick={() => onWeek(editTarget)}>{t(editTarget === thisMonday ? 'cal.editThisWeek' : 'cal.editNextWeek')}</Button>
          </span>
        </Note>
      ) : !isPhone && view.dates[0] < today ? <Note tone="cream" icon="lock_clock">{t('cal.pastDaysLocked')}</Note> : null}
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
          <div className="scroll-x cp-pillrow" style={{ display: 'flex', gap: 8, padding: '0 14px 2px' }}>{paletteChips}</div>
        </Group>
      ) : (
        <div className="cp-grey" style={{ background: 'var(--fill, #F4F4F5)', borderRadius: 20, padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={smallCaps}>{t('cal.paletteHint')}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{paletteChips}</div>
        </div>
      )) : null}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
        {isPhone ? (
          // round 6, phone: one day at a time; a segmented day switch, then the day's rows in one flat group (the fixed times are quiet rows)
          <div style={{ flex: '1 1 100%', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div role="tablist" aria-label={t('cal.day')} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 2, padding: 2, borderRadius: 9, background: 'var(--track, #E8E8EB)' }}>
              {ALL_DAYS.map((w) => (
                <button key={w} type="button" role="tab" aria-label={`${wShort(w)} ${dayNum(w)}${weekendDay(w) ? ` · ${t('cal.weekendCol')}` : ''}`} aria-selected={pday === w} onClick={() => { setPday(w); setSel(null); }} style={{ minWidth: 0, minHeight: 48, padding: '3px 0', borderRadius: 7, border: 'none', background: pday === w ? '#FFFFFF' : 'transparent', boxShadow: pday === w ? '0 1px 3px rgba(40,30,20,0.14)' : 'none', color: pday === w ? '#1E1A16' : weekendDay(w) ? '#8A8078' : '#5E5852', fontSize: 15, fontWeight: pday === w ? 600 : 500, cursor: 'pointer', fontFamily: 'Inter', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', lineHeight: 1.2, transition: 'background-color .15s' }}>
                  <span>{wShort(w)}</span>
                  <span style={{ fontSize: 12, color: weekendDay(w) ? '#8A8078' : '#6B6259', fontWeight: 400, whiteSpace: 'nowrap' }}>{fd(dateOf(w), { day: 'numeric', month: 'short' })}</span>
                </button>
              ))}
            </div>
            <div className="cp-grey" style={{ background: 'var(--fill, #F4F4F5)', borderRadius: 16, overflow: 'hidden' }}>
              {fixed.map(([time, label, icon, slotLabel], i) => icon
                ? <div key={time} style={{ minHeight: 44, background: 'var(--press, #EEEEF0)', display: 'flex', alignItems: 'center', gap: 10, padding: '6px 16px', fontSize: 15, lineHeight: 1.3, color: '#4A4038', ...rowLine(i === 0) }}><span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 500, flex: 'none', width: 74 }}>{time}</span><span>{label}</span></div>
                : slotCard({ w: pday, slot: time as WeekSlot }, slotLabel, i === 0))}
            </div>
          </div>
        ) : (
          <div style={{ flex: '1 1 640px', minWidth: 0, overflowX: 'auto' }}>
            <div style={{ minWidth: 900, display: 'grid', gridTemplateColumns: '96px repeat(7,minmax(0,1fr))', gap: 8 }}>
              <div />
              {ALL_DAYS.map((w) => {
                const focus = focusDate === dateOf(w);
                return (
                  <div key={w} style={{ textAlign: 'center', padding: '6px 0', lineHeight: 1.3, borderBottom: focus ? '3px solid #24201C' : '3px solid transparent', color: weekendDay(w) ? '#8A8078' : undefined }}>
                    <div style={{ fontSize: FONT_BODY, fontWeight: weekendDay(w) ? 500 : 600 }}>{wLong(w)}</div>
                    <div style={{ fontSize: FONT_SMALL, color: weekendDay(w) ? '#8A8078' : '#5E5852', fontWeight: focus ? 600 : 400 }}>{dayNum(w)}{weekendDay(w) ? ` · ${t('cal.weekendCol')}` : ''}</div>
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
                    <div style={{ gridColumn: 'span 7', minHeight: 48, borderRadius: 12, background: 'var(--press, #EEEEF0)', display: 'flex', alignItems: 'center', gap: 8, padding: '0 14px', fontSize: FONT_BODY }}>{fixedIcon(icon)}{label}</div>
                  ) : ALL_DAYS.map((w) => {
                    const c: Cell = { w, slot: time as WeekSlot };
                    const v = cellOf(c);
                    const st = cellStyle(c);
                    const touch = canEdit && !locked(w); // a day before today is read-only
                    const content = v ? (
                      <>
                        {beforeLine(c, 12)}
                        <span style={{ fontSize: FONT_BODY, lineHeight: '19px', fontWeight: 600, paddingRight: touch ? 24 : 0 }}>{title(c)}</span>
                        <span style={{ fontSize: 'max(13px, var(--cp-body, 0px))', color: '#5E5852', lineHeight: 1.4 }}>{roomOf(v.roomId)}</span>
                        <span style={{ fontSize: FONT_SMALL, lineHeight: 1.4 }}>{staffCall(s.staff[v.staffId])}</span>
                        {isChanged(c) && !proposing ? <span style={{ marginTop: 'auto', fontSize: 12, fontWeight: 600, color: '#7A5510' }}>{t('cal.changed')}</span> : null}
                      </>
                    ) : (
                      <>
                        {beforeLine(c, 12)}
                        <span style={{ margin: 'auto', fontSize: 'max(13px, var(--cp-body, 0px))', color: touch ? 'var(--accent, #75624B)' : '#5E5852', fontWeight: touch ? 500 : 400, textAlign: 'center', lineHeight: 1.4, display: 'inline-flex', alignItems: 'center', gap: 4 }}>{touch && !hint ? <Icon name="add" size={17} /> : null}{emptyText(c)}</span>
                        {isChanged(c) && !proposing ? <span style={{ fontSize: 12, fontWeight: 600, color: '#7A5510' }}>{t('cal.changed')}</span> : null}
                      </>
                    );
                    const box = { flex: 1, minHeight: 104, borderRadius: 12, border: st.border, background: st.background, boxShadow: st.boxShadow, padding: 10, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 } as const;
                    return (
                      <div key={key(c)} data-slot={touch ? key(c) : undefined} {...proposedAttr(c)} style={{ position: 'relative', display: 'flex', minWidth: 0 }} onDragOver={touch ? (e) => { e.preventDefault(); if (over !== key(c)) setOver(key(c)); } : undefined} onDrop={touch ? (e) => { e.preventDefault(); dropAt(c); } : undefined}>
                        {touch ? (
                          <div draggable={!!v && !coarse} onDragStart={(e) => { if (!v) return; try { e.dataTransfer.setData('text/plain', key(c)); } catch { /* ignore */ } setDrag({ cell: c }); }} onDragEnd={() => { setDrag(null); setOver(null); }}
                            {...(v ? { onTouchStart: touchStart({ cell: c }, title(c)), onTouchMove: touchMoveEarly, onTouchEnd: touchEndEarly } : {})}
                            onClick={() => tapCell(c)} onKeyDown={onKey(c)} role="button" tabIndex={0} aria-label={aria(c)} aria-pressed={!!sel && key(sel) === key(c)} style={{ ...box, ...noCallout, cursor: 'pointer' }}>{content}</div>
                        ) : <div role="group" aria-label={aria(c)} style={{ ...box, ...(canEdit ? { opacity: 0.62 } : {}) }}>{content}</div>}
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
                <button type="button" className="cp-press cp-fill" onClick={() => setSel(null)} aria-label={t('common.close')} style={{ width: 34, height: 34, borderRadius: 999, border: 'none', background: 'var(--fill, #F4F4F5)', color: 'var(--accent, #75624B)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flex: 'none', padding: 0 }}>
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
            <button type="button" className="cp-tap-self cp-fill" onClick={() => clearCell(selCell)} style={{ height: 50, borderRadius: 14, border: 'none', background: 'var(--fill, #F4F4F5)', color: '#9A3D24', fontSize: 16, fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter' }}>{t('cal.clearSlot')}</button>
          </div>
        ) : (
          <div className="cp-grey" style={{ flex: isPhone ? '1 1 100%' : '0 1 300px', minWidth: isPhone ? 0 : 260, background: 'var(--fill, #F4F4F5)', borderRadius: 20, padding: isPhone ? '16px 16px 14px' : '20px 22px', display: 'flex', flexDirection: 'column', gap: isPhone ? 12 : 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={smallCaps}>{wLong(selCell.w)} {dayNum(selCell.w)} · {selCell.slot}</span>
                <span style={{ fontSize: 20, lineHeight: '28px', fontWeight: 500, letterSpacing: '-0.3px', color: '#2B231C' }}>{title(selCell)}</span>
              </div>
              <button type="button" className="h-fill cp-fill" onClick={() => setSel(null)} aria-label={t('common.close')} style={{ width: 44, height: 44, borderRadius: 999, border: 'none', background: 'var(--fill, #F4F4F5)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flex: 'none', padding: 0 }}>
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
        <div className="cp-grey" style={{ background: 'var(--fill, #F4F4F5)', borderRadius: 20, overflow: 'hidden' }}>
          <div style={{ padding: '18px 22px 10px' }}><span style={smallCaps}>{t('cal.versions')}</span></div>
          {vp.rows.map((v, i) => versionRow(v, i))}
          <Pager page={vp.page} pages={vp.pages} onPage={vp.setPage} label={t('cal.pagerVersions')} />
        </div>
      )}

      <PublishSheet open={pubOpen} onClose={() => setPubOpen(false)} summary={summary} more={Math.max(0, changed - summary.length)} count={changed} week={week} asks={asks}
        onPublish={async (effectiveFrom, notify) => {
          await d.flush();
          const r = await act('schedule.publish', { effectiveFrom, days: d.draft, ...(asks ? {} : { notify }) }, { silent: true });
          if (r.ok) {
            d.reset(); setPubOpen(false); setSel(null);
            const k = asks ? 'cal.sentToEga' : effectiveFrom === today ? (notify ? 'cal.publishedToastToday' : 'cal.publishedToastTodayQuiet') : notify ? 'cal.publishedToast' : 'cal.publishedToastQuiet';
            say(t(k, { date: fdl(effectiveFrom) }));
            return '';
          }
          return t(r.code, r.params);
        }} />
      <CatalogEditor open={catalog} onClose={() => setCatalog(false)} />
      {/* KC round 9: a tap on an empty slot — choose its activity from a short list (it is placed at once; no side panel) */}
      <Sheet open={!!pick} onClose={() => setPick(null)} title={pick ? t('cal.chooseFor', { day: `${wLong(pick.w)} ${dayNum(pick.w)}`, slot: pick.slot }) : ''}>
        <div role="list" style={{ display: 'flex', flexDirection: 'column' }}>
          {palette.map((a, i) => (
            <button key={a.id} type="button" role="listitem" className="h-row" data-testid={`pick-${a.id}`} onClick={() => { if (pick) placeAct(pick, a.id); setPick(null); }}
              style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 56, padding: '8px 4px', border: 'none', borderTop: i ? '0.5px solid var(--hairline, #E2E2E6)' : 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', color: '#24201C', fontFamily: 'Inter', borderRadius: 0 }}>
              <span aria-hidden="true" style={{ width: 38, height: 38, borderRadius: 999, background: 'var(--on-card, #F4F4F5)', color: 'var(--accent, #75624B)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><Icon name={a.icon} size={19} /></span>
              <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.35 }}>{activityName(a, lang)}</span>
                {a.roomId ? <span style={{ fontSize: FONT_SMALL, color: '#6B6259', lineHeight: 1.35 }}>{roomOf(a.roomId)}</span> : null}
              </span>
            </button>
          ))}
        </div>
      </Sheet>
      {/* the pill that follows the finger during a touch drag (fixed positions are scaled by the UI zoom) */}
      {tdrag ? (
        <div aria-hidden="true" style={{ position: 'fixed', left: tdrag.x / uiZoom(), top: tdrag.y / uiZoom(), transform: 'translate(-50%, -135%)', zIndex: 90, pointerEvents: 'none', height: 40, padding: '0 16px', borderRadius: 999, background: '#24201C', color: '#FFFFFF', fontSize: 15, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', boxShadow: '0 8px 24px rgba(36,32,28,.28)', fontFamily: 'Inter' }}>
          <Icon name="drag_indicator" size={18} />{tdrag.label}
        </div>
      ) : null}
    </div>
  );
}

/** `asks` (round 14, the activity team): the sheet sends the version to Ega; who is told is decided when Ega approves. */
function PublishSheet({ open, onClose, summary, more, count, week, asks, onPublish }: { open: boolean; onClose: () => void; summary: string[]; more: number; count: number; week: ISODate; asks?: boolean; onPublish: (date: string, notify: boolean) => Promise<string> }) {
  const t = useT();
  const { fdl } = useFmt();
  const { today } = useNow();
  // default: the Monday of the week being edited, or today when that week has started (KC round 7: the current week publishes from today)
  const start = week > today ? week : today;
  const [date, setDate] = useState<string>(start);
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useResetOn(open ? 'open' + week : null, () => { setDate(start); setNotify(true); setErr(''); });
  const min = today;
  const ok = !!date && date >= min;
  return (
    <Sheet open={open} onClose={onClose} title={t(asks ? 'cal.sendTitle' : 'cal.publishTitle')}>
      <div style={{ fontSize: 16, lineHeight: '22px' }}>{plural(t, 'cal.changesPending', count)}</div>
      <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4, fontSize: FONT_BODY, lineHeight: 1.4 }}>
        {summary.map((x) => <li key={x}>{x}</li>)}
        {more ? <li>{t('cal.andMore', { n: more })}</li> : null}
      </ul>
      <DateField label={t('cal.effective')} value={date} min={min} onChange={setDate} error={!ok && t('cal.err.futureOnly')} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Button variant="quiet" size={44} onClick={() => setDate(start)}>{t(start === today ? 'cal.fromToday' : 'cal.weekStart')}</Button>
        <Button variant="quiet" size={44} onClick={() => setDate(nextMonday(today))}>{t('cal.nextMonday')}</Button>
      </div>
      {asks ? (ok ? null : <Note tone="cream" icon="info">{t('cal.err.futureOnly')}</Note>) : <Note tone="cream" icon="info">{ok ? t(date === today ? 'cal.effectiveNoteToday' : 'cal.effectiveNote', { date: fdl(date) }) : t('cal.err.futureOnly')}</Note>}
      {asks ? null : <Toggle on={notify} onClick={() => setNotify(!notify)} label={t('cal.notify')} />}
      {err ? <Note tone="rust" icon="error">{err}</Note> : null}
      <Button full disabled={!ok || busy} onClick={async () => { setBusy(true); setErr(await onPublish(date, notify)); setBusy(false); }}>{t(asks ? 'cal.sendForApproval' : 'cal.publishBtn')}</Button>
    </Sheet>
  );
}
