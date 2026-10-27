// Quick tasks (KC round 10, "add another button beside the camera button… a floating pop up filled with the list of tasks they have, and a quick button to do it"):
// a second floating button, left of the quick camera, for every staff role that has duties. It opens a floating card with today's tasks — the role's general duties
// (a picture of each session, the lunch photo, the checks…) and the additional tasks — late ones first, done ones last, each with a one-tap action on the right:
// the camera for a picture duty (it opens the quick camera) or a photo-proof task (the proof camera), a tick for a plain task, "go there" for a duty done on a page.
// The badge is how many are still to do (rust once one is late). "All tasks" opens the Tasks screen.
import { useMemo, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { dayStatus, type StaffRole, type TaskTemplate } from '@cp/shared';
import { activityName } from '@cp/shared/rules/activity';
import { partLate, roleSummary, TASK_ROLES, type DutyDef, type DutyPart, type TaskItem } from '@cp/shared/rules/tasks';
import { Icon, useOverlayA11y } from '../components/ui';
import { countingMeta, isCountingDuty, useTick, whoIs } from '../features/tasks/parts';
import { useNow } from '../lib/clock';
import { useFmt, useT } from '../lib/i18n';
import { useMe } from '../lib/me';
import { useQuickCam } from '../store/quickCam';
import { useClub } from '../store/replica';
import { useUi } from '../store/ui';
import { QUICK_CAMERA_ROLES } from './QuickCamera';

/** The roles that have the quick tasks button: every role with duties. */
export const QUICK_TASK_ROLES: readonly string[] = TASK_ROLES;
/** Round 15: the geometry of the floating button stack, shared with the phone search button so it lines up without copying numbers.
 *  Columns count leftwards from the right edge (the quick camera is column 0, Tasks sits left of it when the role has a camera); levels count upwards. */
export const FLOAT_GAP = 10;
export function floatingSlot(phone: boolean, pins: number, col = 0, level = 0) {
  const size = phone ? 48 : 52;
  const edge = phone ? 14 : 24;
  const lift = level * (size + FLOAT_GAP);
  const bottom = phone ? `calc(${(pins ? 150 : 96) + lift}px + env(safe-area-inset-bottom, 0px))` : `${78 + lift}px`;
  return { size, edge, right: edge + col * (size + FLOAT_GAP), bottom };
}
const RUST = '#9A3D24';
const INK = '#24201C';
/** Duties done by taking a picture: their quick action is the camera. */
const CAMERA_DUTY = new Set(['photo_camera', 'add_a_photo']);

type Row =
  | { kind: 'duty'; key: string; def: DutyDef; part: DutyPart; done: boolean; late: boolean; due: string }
  | { kind: 'task'; key: string; item: TaskItem; done: boolean; late: boolean; due: string };

export function QuickTasks({ phone }: { phone: boolean }) {
  const { role } = useMe();
  if (!role || !QUICK_TASK_ROLES.includes(role)) return null;
  return <QuickTasksButton phone={phone} role={role as StaffRole} />;
}

function QuickTasksButton({ phone, role }: { phone: boolean; role: StaffRole }) {
  const t = useT();
  const s = useClub();
  const { today, nowMin } = useNow();
  const pins = useUi((st) => st.pins);
  const [open, setOpen] = useState(false);
  const sum = useMemo(() => roleSummary(s, role, today, today, nowMin), [s, role, today, nowMin]);
  // late first, then by the time they are due; done ones go last (like Mine on the Tasks screen)
  const rows = useMemo<Row[]>(() => {
    const duties = sum.duties.flatMap((d) => d.parts.map((p): Row => ({ kind: 'duty', key: d.def.id + p.key, def: d.def, part: p, done: p.done, late: partLate(p, today, today, nowMin), due: p.due })));
    const tasks = sum.custom.filter((i) => i.template.every === 'daily' || i.overdue || i.due === today).map((i): Row => ({ kind: 'task', key: i.template.id, item: i, done: !!i.done, late: i.overdue, due: i.template.dueBy ?? '' }));
    const rank = (r: Row) => (r.done ? 2 : r.late ? 0 : 1);
    return [...duties, ...tasks].sort((a, b) => rank(a) - rank(b) || a.due.localeCompare(b.due));
  }, [sum, today, nowMin]);
  const todo = rows.filter((r) => !r.done).length;
  const late = rows.some((r) => !r.done && r.late);
  const hasCam = (QUICK_CAMERA_ROLES as readonly string[]).includes(role);
  // beside the quick camera (left of it); where the role has no camera, in its place
  const { size, edge, right, bottom } = floatingSlot(phone, pins, hasCam ? 1 : 0);
  const pos: CSSProperties = { right, bottom };
  const label = todo ? t('tasks.quickN', { n: todo }) : t('tasks.quick');
  return (
    <>
      <button type="button" data-testid="quick-tasks" onClick={() => setOpen(true)} aria-label={label} title={t('tasks.quick')} aria-expanded={open} className="h-bronze cp-press"
        style={{ position: 'fixed', ...pos, zIndex: 44, width: size, height: size, borderRadius: 999, border: 'none', padding: 0, background: INK, color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 6px rgba(40,30,20,0.22), 0 14px 32px rgba(40,30,20,0.38)' }}>
        <Icon name="checklist" size={phone ? 24 : 26} />
        {todo ? <span data-testid="quick-tasks-badge" data-late={late || undefined} aria-hidden="true" style={{ position: 'absolute', top: -4, right: -4, minWidth: 20, height: 20, padding: '0 5px', borderRadius: 999, background: late ? RUST : '#FFFFFF', color: late ? '#FFFFFF' : INK, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 0 2px ${INK}`, fontVariantNumeric: 'tabular-nums' }}>{todo > 99 ? '99+' : todo}</span> : null}
      </button>
      {open ? <QuickTasksPopup rows={rows} done={rows.length - todo} total={rows.length} closed={!dayStatus(s, today).open} hasCam={hasCam} phone={phone} anchor={{ right: edge, bottom: floatingSlot(phone, pins, 0, 1).bottom }} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function QuickTasksPopup({ rows, done, total, closed, hasCam, phone, anchor, onClose }: {
  rows: Row[]; done: number; total: number; closed: boolean; hasCam: boolean; phone: boolean; anchor: { right: number; bottom: string }; onClose: () => void;
}) {
  const t = useT();
  const navigate = useNavigate();
  const tick = useTick();
  const { ref, trap } = useOverlayA11y(true, onClose);
  const go = (to: string) => { onClose(); navigate(to); };
  const camera = () => { onClose(); useQuickCam.getState().openCam(); };
  const tickOff = (tpl: TaskTemplate) => { void tick.tick(tpl); };
  return createPortal(
    <>
      <div data-testid="quick-tasks-backdrop" onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 47 }} />
      <div ref={ref} role="dialog" aria-modal="true" aria-label={t('tasks.quick')} tabIndex={-1} onKeyDown={trap} data-testid="quick-tasks-popup"
        style={{ position: 'fixed', right: anchor.right, bottom: anchor.bottom, zIndex: 48, width: `min(380px, calc(100vw - ${anchor.right * 2}px))`, maxHeight: 'min(62vh, 540px)', display: 'flex', flexDirection: 'column', borderRadius: 20, background: 'var(--card, #FFFFFF)', color: INK, boxShadow: '0 2px 8px rgba(40,30,20,.14), 0 20px 48px rgba(40,30,20,.3)', overflow: 'hidden', outline: 'none', animation: 'cpUp .18s ease-out', fontFamily: 'Inter' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 10px 10px 16px', flex: 'none' }}>
          <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span style={{ fontSize: 16, fontWeight: 600, lineHeight: '22px' }}>{t('tasks.quick')}</span>
            {total ? <span data-testid="quick-tasks-progress" style={{ fontSize: 13, lineHeight: '18px', color: done >= total ? '#3D6B4F' : '#6B6259', fontVariantNumeric: 'tabular-nums' }}>{done >= total ? `${t('tasks.allDone')} · ${done}/${total}` : t('tasks.progress', { done, total })}</span> : null}
          </span>
          <button type="button" onClick={() => go('/tasks')} data-testid="quick-tasks-all" className="cp-press cp-fill" style={{ height: 34, padding: '0 12px', borderRadius: 999, border: 'none', background: 'var(--fill, #F4F4F5)', color: INK, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>{t('tasks.quickAll')}</button>
          <button type="button" onClick={onClose} aria-label={t('tasks.quickClose')} className="cp-press" style={{ width: 34, height: 34, borderRadius: 999, border: 'none', background: 'transparent', color: '#6B6259', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}><Icon name="close" size={22} /></button>
        </div>
        <div role="list" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: `0 0 ${phone ? 8 : 6}px` }}>
          {!rows.length ? <div style={{ padding: '18px 16px 22px', fontSize: 15, color: '#6B6259', textAlign: 'center' }}>{closed ? t('tasks.closed') : t('tasks.quickEmpty')}</div> : null}
          {rows.map((r, i) => <QuickRow key={r.key} row={r} first={i === 0} hasCam={hasCam} busy={r.kind === 'task' && tick.busy === r.item.template.id} onGo={go} onCamera={camera} onTick={tickOff} />)}
        </div>
      </div>
      {tick.camera}
    </>,
    document.body,
  );
}

/** One task: its icon (a check once done), the name and its one meta line, and the quick action on the right. The row itself goes where the task is done. */
function QuickRow({ row, first, hasCam, busy, onGo, onCamera, onTick }: { row: Row; first: boolean; hasCam: boolean; busy: boolean; onGo: (to: string) => void; onCamera: () => void; onTick: (tpl: TaskTemplate) => void }) {
  const t = useT();
  const { lang, fds } = useFmt();
  const { today } = useNow();
  const s = useClub();
  let title: string, meta: string, icon: string, link: string;
  let action: { icon: string; label: string; run: () => void } | null = null;
  if (row.kind === 'duty') {
    const { def, part } = row;
    const params = { ...part.params, ...(part.activityId && s.activities[part.activityId] ? { activity: activityName(s.activities[part.activityId], lang) } : {}) };
    title = t(part.titleKey, params);
    icon = def.icon;
    link = part.link;
    const left = part.count ? part.count.total - part.count.done : 0;
    meta = isCountingDuty(def, part) ? countingMeta(t, def, part, row.late)
      : part.done
      ? (part.by && part.at ? t('tasks.doneBy', { name: whoIs(s, part.by), t: part.at }) : part.at ? t('tasks.doneAtOnly', { t: part.at }) : '')
      : [row.late ? t('tasks.late') : '', t('tasks.by', { t: part.due }), left > 0 ? t('tasks.left', { n: left }) : ''].filter(Boolean).join(' · ');
    if (!part.done) action = CAMERA_DUTY.has(def.icon) && hasCam ? { icon: 'photo_camera', label: t('tasks.quickCamera'), run: onCamera } : { icon: 'arrow_forward', label: t('tasks.quickGo'), run: () => onGo(part.link) };
  } else {
    const { item } = row;
    const tpl = item.template;
    title = tpl.title;
    icon = tpl.proof === 'photo' ? 'photo_camera' : 'task_alt';
    link = '/tasks';
    meta = item.done
      ? (item.done.date === today ? t('tasks.doneBy', { name: whoIs(s, item.done.by), t: item.done.at }) : t('tasks.doneByOn', { name: whoIs(s, item.done.by), d: fds(item.done.date), t: item.done.at }))
      : [item.overdue ? t('tasks.overdue') : '', tpl.dueBy ? t('tasks.by', { t: tpl.dueBy }) : '', tpl.proof === 'photo' ? t('tasks.photoProof') : ''].filter(Boolean).join(' · ');
    if (!item.done) action = tpl.proof === 'photo' ? { icon: 'photo_camera', label: `${t('tasks.takePhoto')}: ${tpl.title}`, run: () => onTick(tpl) } : { icon: 'check', label: `${t('tasks.markDone')}: ${tpl.title}`, run: () => onTick(tpl) };
  }
  const data = row.kind === 'duty' ? { 'data-duty': row.def.id, 'data-part': row.part.key } : { 'data-task': row.item.template.id };
  return (
    <div role="listitem" {...data} data-done={row.done || undefined} data-late={(!row.done && row.late) || undefined}
      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px 2px 10px', minHeight: 54, boxShadow: first ? 'none' : 'inset 0 1px 0 var(--hairline, #E2E2E6)' }}>
      <button type="button" onClick={() => onGo(link)} className="cp-tap-target" style={{ flex: '1 1 0', minWidth: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', color: INK, fontFamily: 'inherit' }}>
        {row.done
          ? <span aria-hidden="true" style={{ width: 28, height: 28, flex: 'none', borderRadius: 999, background: INK, color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="check" size={18} /></span>
          : <span aria-hidden="true" className="cp-fill" style={{ width: 28, height: 28, flex: 'none', borderRadius: 999, background: 'var(--fill, #F4F4F5)', color: 'var(--accent, #75624B)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={17} fill={1} /></span>}
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span style={{ fontSize: 15, lineHeight: '20px', fontWeight: 500, overflowWrap: 'anywhere', color: row.done ? '#8A8078' : INK }}>{title}</span>
          {meta ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, lineHeight: '17px', color: !row.done && row.late ? RUST : '#6B6259' }}>
              {!row.done && row.late ? <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: 999, background: RUST, flex: 'none' }} /> : null}
              <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{meta}</span>
            </span>
          ) : null}
        </span>
      </button>
      {action ? (
        <button type="button" onClick={busy ? undefined : action.run} aria-label={action.label} title={action.label} data-testid="quick-task-action" data-action={action.icon} className="cp-press"
          style={{ width: 40, height: 40, flex: 'none', borderRadius: 999, border: 'none', background: action.icon === 'photo_camera' ? INK : 'var(--fill, #F4F4F5)', color: action.icon === 'photo_camera' ? '#FFFFFF' : INK, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, opacity: busy ? 0.5 : 1 }}>
          <Icon name={action.icon} size={20} fill={action.icon === 'photo_camera' ? 1 : 0} />
        </button>
      ) : null}
    </div>
  );
}
