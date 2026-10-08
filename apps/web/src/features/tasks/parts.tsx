// Shared pieces of the Tasks screen: the tick-off flow (camera for proof tasks, upload, task.done, Undo in the toast), one additional-task row, one duty row,
// the detail sheet (who and when, the proof picture, a note, take it back) and the progress line.
import { useState, type CSSProperties, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { staffCall, type ClubState, type ISODate, type TaskTemplate } from '@cp/shared';
import { activityName, toneOf } from '@cp/shared/rules/activity';
import { partLate, type DutyDef, type DutyPart, type TaskItem } from '@cp/shared/rules/tasks';
import { Button, CameraCapture, FONT_SMALL, Icon, PhotoImg, Sheet, TextField } from '../../components/ui';
import { ApiError } from '../../lib/api';
import { useAct } from '../../lib/act';
import { useFmt, useT, type TFn } from '../../lib/i18n';
import { uploadMedia } from '../../lib/media';
import { say } from '../../store/ui';

const RUST = '#9A3D24';
/** The row's hairline, inset past the circle (the iOS grouped-list look). */
const hairline = (first: boolean): CSSProperties => ({ backgroundColor: '#FFFFFF', backgroundImage: first ? 'none' : 'linear-gradient(#EFEAE3, #EFEAE3)', backgroundSize: 'calc(100% - 58px) 1px', backgroundPosition: 'right top', backgroundRepeat: 'no-repeat' });

/** Staff member's name from a staff id. */
export const whoIs = (s: ClubState, id: string) => staffCall(s.staff[id]) || id;

// ---------- ticking off ----------
export interface Tick {
  /** tick a task off: proof tasks open the camera first */
  tick(tpl: TaskTemplate, note?: string): Promise<boolean>;
  undo(tpl: TaskTemplate, period: string): Promise<boolean>;
  /** the template id being saved right now */
  busy: string | null;
  /** render this once on the screen */
  camera: ReactNode;
}
export function useTick(): Tick {
  const t = useT();
  const act = useAct();
  const [shot, setShot] = useState<{ tpl: TaskTemplate; note?: string; resolve: (ok: boolean) => void } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const undo = async (tpl: TaskTemplate, period: string) => {
    const r = await act('task.undo', { templateId: tpl.id, period }, { silent: true });
    if (r.ok) say(t('tasks.undoneToast', { title: tpl.title }), { icon: 'undo' });
    return r.ok;
  };
  const finish = async (tpl: TaskTemplate, o: { photoMediaId?: string; note?: string }) => {
    setBusy(tpl.id);
    const r = await act('task.done', { templateId: tpl.id, ...(o.photoMediaId ? { photoMediaId: o.photoMediaId } : {}), ...(o.note ? { note: o.note } : {}) }, { silent: true });
    setBusy(null);
    if (r.ok) say(t('tasks.doneToast', { title: tpl.title }), { action: { label: t('common.undo'), run: () => void undo(tpl, String(r.result.period)) } });
    return r.ok;
  };
  const tick = (tpl: TaskTemplate, note?: string) => (tpl.proof === 'photo' ? new Promise<boolean>((resolve) => setShot({ tpl, note, resolve })) : finish(tpl, { note }));

  const close = (ok: boolean) => { shot?.resolve(ok); setShot(null); };
  const onCapture = async (blob: Blob) => {
    const cur = shot;
    if (!cur) return;
    setShot(null);
    setBusy(cur.tpl.id);
    say(t('tasks.uploading'), { icon: 'cloud_upload' });
    try {
      const photoMediaId = await uploadMedia(blob);
      cur.resolve(await finish(cur.tpl, { photoMediaId, note: cur.note }));
    } catch (e) {
      setBusy(null);
      say(e instanceof ApiError ? t(e.code, e.params) : t('tasks.uploadFailed'), { tone: 'error', icon: 'error' });
      cur.resolve(false);
    }
  };
  return { tick, undo, busy, camera: <CameraCapture open={!!shot} onClose={() => close(false)} onCapture={(b) => void onCapture(b)} facing="environment" /> };
}

// ---------- the progress line ----------
export function Progress({ done, total }: { done: number; total: number }) {
  const t = useT();
  const complete = total > 0 && done >= total;
  return (
    <div role="status" style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 2px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 15, fontWeight: 500, lineHeight: '20px', color: complete ? '#3D6B4F' : '#24201C', fontVariantNumeric: 'tabular-nums' }}>
        {complete ? <Icon name="check_circle" size={19} fill={1} /> : null}
        {total === 0 ? t('tasks.nothingDue') : complete ? `${t('tasks.allDone')} · ${done}/${total}` : t('tasks.progress', { done, total })}
      </div>
      <div aria-hidden="true" style={{ height: 6, borderRadius: 999, background: '#E8E1D8', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${total ? Math.round((done / total) * 100) : 0}%`, borderRadius: 999, background: complete ? '#3D6B4F' : '#24201C', transition: 'width .25s ease' }} />
      </div>
    </div>
  );
}

// ---------- what a row says about its task ----------
/** The one meta line of a custom task: when it is due (rust when overdue), the photo hint; once done, who and when. */
function useMeta() {
  const t = useT();
  const fmt = useFmt();
  return (item: TaskItem, date: ISODate, who: (id: string) => string): { text: string; overdue: boolean } => {
    const { template: tpl, done } = item;
    if (done) return { text: done.date === date ? t('tasks.doneBy', { name: who(done.by), t: done.at }) : t('tasks.doneByOn', { name: who(done.by), d: fmt.fds(done.date), t: done.at }), overdue: false };
    const parts: string[] = [];
    if (item.overdue) parts.push(t('tasks.overdue'));
    if (tpl.every === 'daily') { if (tpl.dueBy) parts.push(t('tasks.by', { t: tpl.dueBy })); }
    else parts.push(t('tasks.dueDay', { d: tpl.every === 'weekly' ? fmt.fd(item.due, { weekday: 'short' }) : fmt.fd(item.due, { day: 'numeric', month: 'short' }) }) + (tpl.dueBy ? ` ${tpl.dueBy}` : ''));
    if (tpl.proof === 'photo') parts.push(t('tasks.photoProof'));
    return { text: parts.join(' · '), overdue: item.overdue };
  };
}

/** The proof picture of a ticked-off task, small (a tone placeholder when the seed kept no picture). */
export function ProofThumb({ item, size = 40, onOpen }: { item: TaskItem; size?: number; onOpen?: () => void }) {
  const t = useT();
  if (!item.done || item.template.proof !== 'photo') return null;
  const photo = { mediaId: item.done.photoMediaId, tone: toneOf(item.done.id), media: 'photo' as const };
  const body = (
    <span style={{ position: 'relative', display: 'block', width: size, height: size, borderRadius: 10, overflow: 'hidden', background: '#F3EEE8' }}>
      <PhotoImg photo={photo} />
      {item.done.photoMediaId ? null : <span aria-hidden="true" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.9)' }}><Icon name="photo_camera" size={Math.round(size * 0.45)} fill={1} /></span>}
    </span>
  );
  return onOpen
    ? <button type="button" onClick={onOpen} aria-label={t('tasks.proof') + ': ' + item.template.title} className="cp-press" style={{ flex: 'none', padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }}>{body}</button>
    : body;
}

// ---------- a custom task ----------
export function TaskRow({ item, date, first, who, canTick, busy, onTick, onOpen }: {
  item: TaskItem; date: ISODate; first: boolean; who: (id: string) => string;
  /** the circle ticks it off (today, and the role's own staff or management) */
  canTick: boolean; busy: boolean; onTick: () => void; onOpen: () => void;
}) {
  const t = useT();
  const meta = useMeta()(item, date, who);
  const done = !!item.done;
  const circle = (
    <span aria-hidden="true" style={{ width: 26, height: 26, borderRadius: 999, border: done ? 'none' : `2px solid ${item.overdue ? '#C9A596' : '#CFC4B6'}`, background: done ? '#24201C' : '#FFFFFF', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: busy ? 0.5 : 1 }}>
      {done ? <Icon name="check" size={18} /> : null}
    </span>
  );
  return (
    <div className="cp-bleed cp-tap" data-task={item.template.id} data-done={done || undefined} style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '4px 16px 4px 6px', minHeight: 56, ...hairline(first) }}>
      {done || !canTick
        ? <span style={{ width: 44, height: 44, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{circle}</span>
        : <button type="button" className="cp-press" onClick={busy ? undefined : onTick} aria-label={`${t(item.template.proof === 'photo' ? 'tasks.takePhoto' : 'tasks.markDone')}: ${item.template.title}`} style={{ width: 44, height: 44, flex: 'none', border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{circle}</button>}
      <button type="button" className="cp-tap-target" onClick={onOpen} style={{ flex: '1 1 0', minWidth: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0 6px 6px', border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', color: '#24201C', fontFamily: 'Inter' }}>
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span style={{ fontSize: 16, lineHeight: '22px', fontWeight: 500, overflowWrap: 'anywhere', color: done ? '#8A8078' : '#24201C' }}>{item.template.title}</span>
          {meta.text ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, lineHeight: '19px', color: meta.overdue ? RUST : '#6B6259' }}>
              {meta.overdue ? <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: 999, background: RUST, flex: 'none' }} /> : null}
              <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{meta.text}</span>
            </span>
          ) : null}
        </span>
        <ProofThumb item={item} size={38} />
      </button>
    </div>
  );
}

// ---------- one part of a general duty ----------
/** One row of the day's duties: a session picture, the lunch photo, a round of the log… Done: a check, greyed, with who and when if the data says. Open: the duty's icon,
 *  "By 12:30" (rust dot and "Late" once past), and how many are left. Tapping an open one goes to the place where it is done (`link` false in the team view). */
export function DutyRow({ s, def, part, date, today, nowMin, first, link = true }: {
  s: ClubState; def: DutyDef; part: DutyPart; date: ISODate; today: ISODate; nowMin: number; first: boolean;
  /** false in the team view (another role's screens are not mine to open) */
  link?: boolean;
}) {
  const t = useT();
  const { lang } = useFmt();
  const navigate = useNavigate();
  const params = { ...part.params, ...(part.activityId && s.activities[part.activityId] ? { activity: activityName(s.activities[part.activityId], lang) } : {}) };
  const title = t(part.titleKey, params);
  const open = !part.done;
  const late = partLate(part, date, today, nowMin);
  const left = part.count ? part.count.total - part.count.done : 0;
  const meta = part.done
    ? (part.by && part.at ? t('tasks.doneBy', { name: whoIs(s, part.by), t: part.at }) : part.at ? t('tasks.doneAtOnly', { t: part.at }) : '')
    : [late ? t('tasks.late') : '', t('tasks.by', { t: part.due })].filter(Boolean).join(' · ');
  const body = (
    <>
      <span style={{ width: 44, height: 44, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {part.done
          ? <span aria-hidden="true" style={{ width: 26, height: 26, borderRadius: 999, background: '#24201C', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="check" size={18} /></span>
          : <span aria-hidden="true" style={{ width: 28, height: 28, borderRadius: 999, background: '#F3EEE8', color: '#75624B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={def.icon} size={17} fill={1} /></span>}
      </span>
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1, textAlign: 'left', paddingLeft: 2 }}>
        <span style={{ fontSize: 16, lineHeight: '22px', fontWeight: 500, overflowWrap: 'anywhere', color: part.done ? '#8A8078' : '#24201C' }}>{title}</span>
        {meta ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, lineHeight: '19px', color: open && late ? RUST : '#6B6259' }}>
            {open && late ? <span aria-hidden="true" data-late style={{ width: 6, height: 6, borderRadius: 999, background: RUST, flex: 'none' }} /> : null}
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{meta}</span>
          </span>
        ) : null}
      </span>
      {open && left > 0 ? <span aria-label={t('tasks.left', { n: left })} style={{ flex: 'none', minWidth: 24, height: 24, padding: '0 8px', borderRadius: 999, background: '#F3EEE8', color: '#4A4038', fontSize: FONT_SMALL, fontWeight: 600, fontVariantNumeric: 'tabular-nums', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{left}</span> : null}
      {link && open ? <Icon name="chevron_right" size={22} color="#C2B8AB" /> : null}
    </>
  );
  const style: CSSProperties = { width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '4px 16px 4px 6px', minHeight: 56, border: 'none', color: '#24201C', fontFamily: 'Inter', ...hairline(first) };
  const data = { 'data-duty': def.id, 'data-part': part.key, 'data-done': part.done || undefined, 'data-late': (open && late) || undefined };
  return link && open
    ? <button type="button" className="cp-bleed cp-tap-self" {...data} onClick={() => navigate(part.link)} style={{ ...style, cursor: 'pointer' }}>{body}</button>
    : <div className="cp-bleed" {...data} style={style}>{body}</div>;
}

// ---------- the detail sheet ----------
const label: CSSProperties = { fontSize: 13, lineHeight: '18px', color: '#6B6259' };
const value: CSSProperties = { fontSize: 15, lineHeight: '21px', color: '#24201C', overflowWrap: 'anywhere' };
function Line({ k, children }: { k: string; children: ReactNode }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}><span style={label}>{k}</span><span style={value}>{children}</span></div>;
}
export function repeatText(t: TFn, fd: (d: string, o: Intl.DateTimeFormatOptions) => string, tpl: TaskTemplate): string {
  if (tpl.every === 'daily') return t('tasks.everyDaily');
  if (tpl.every === 'weekly') return t('tasks.everyWeekly', { d: fd(`2026-10-${18 + (tpl.weekday ?? 1)}`, { weekday: 'long' }) }); // 19 Oct 2026 is a Monday
  return tpl.dayOfMonth === 31 ? t('tasks.everyMonthlyLast') : t('tasks.everyMonthly', { n: tpl.dayOfMonth ?? 1 });
}

/** Opens from a row: when it repeats and is due, who ticked it off and when, the proof picture and note; ticking it off (with a note) or taking it back. */
export function TaskSheet({ item, date, who, canTick, canUndo, tick, onClose }: {
  item: TaskItem; date: ISODate; who: (id: string) => string; canTick: boolean; canUndo: boolean; tick: Tick; onClose: () => void;
}) {
  const t = useT();
  const fmt = useFmt();
  const [note, setNote] = useState('');
  const [working, setWorking] = useState(false);
  const { template: tpl, done } = item;
  const meta = useMeta()(item, date, who);
  const go = async (fn: () => Promise<boolean>) => { setWorking(true); const ok = await fn(); setWorking(false); if (ok) onClose(); };
  return (
    <Sheet open onClose={onClose} title={tpl.title}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Line k={t('tasks.repeats')}>{repeatText(t, fmt.fd, tpl)}{tpl.dueBy ? ` · ${t('tasks.by', { t: tpl.dueBy })}` : ''}</Line>
        {done ? <Line k={t('tasks.doneAt')}>{meta.text}</Line> : meta.text ? <Line k={t('tasks.due')}><span style={{ color: item.overdue ? RUST : undefined }}>{meta.text}</span></Line> : null}
        {done?.note ? <Line k={t('tasks.noteFrom')}>{done.note}</Line> : null}
        {done && tpl.proof === 'photo' ? (
          <div>
            <div style={{ position: 'relative', aspectRatio: '4/3', borderRadius: 12, overflow: 'hidden', background: '#F3EEE8' }}>
              <PhotoImg photo={{ mediaId: done.photoMediaId, tone: toneOf(done.id), media: 'photo' }} alt={`${t('tasks.proof')}: ${tpl.title}`} />
            </div>
            {done.photoMediaId ? null : <div style={{ ...label, marginTop: 6 }}>{t('tasks.proofNone')}</div>}
          </div>
        ) : null}
        {!done && canTick ? <TextField label={t('tasks.note')} value={note} onChange={setNote} multiline rows={2} maxLength={300} /> : null}
      </div>
      {!done && canTick
        ? <Button full icon={tpl.proof === 'photo' ? 'photo_camera' : 'check'} disabled={working || tick.busy === tpl.id} onClick={() => void go(() => tick.tick(tpl, note.trim() || undefined))}>{t(tpl.proof === 'photo' ? 'tasks.takePhoto' : 'tasks.markDone')}</Button>
        : done && canUndo
          ? <Button full variant="secondary" icon="undo" disabled={working} onClick={() => void go(() => tick.undo(tpl, item.period))}>{t('tasks.markUndone')}</Button>
          : null}
    </Sheet>
  );
}
