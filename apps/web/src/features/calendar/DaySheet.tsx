// KC round 7: change one session for one day only ("sudden changes in each day", today included). "Edit activity" on a day first asks what to change
// (EditChoice: just this day, or the weekly plan from next week); "Just this day" opens DaySheet for that slot: the activity, its teacher and room, "No session",
// a note, whether to tell teachers and families, the weekly plan for reference and "Back to the weekly plan". The weekly schedule itself is untouched.
// ExtraSheet (KC round 7): add, edit or remove an extra session on that date at any time (time, activity, teacher, room, note, tell teachers and families).
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { extrasOn, isWeekSlot, live, scheduleDayOf, sessionsOn, staffCall, toHM, toMin, type ISODate, type Slot } from '@cp/shared';
import { activityName, roomName } from '@cp/shared/rules/activity';
import { LAST_START_BEFORE_CLOSE, activityTeachers, extraTimeIssue, sameCell, slotChanged, suggestExtraTime, weeklyCell } from '@cp/shared/rules/calendar';
import { guestOn } from '@cp/shared/rules/guests';
import { Button, Icon, Note, Select, Sheet, TextField, TimeField, Toggle } from '../../components/ui';
import { useAct } from '../../lib/act';
import { useT, useFmt } from '../../lib/i18n';
import { useResetOn } from '../../lib/useResetOn';
import { useClub } from '../../store/replica';
import { say } from '../../store/ui';

const NONE = '__none__';

/** The ways to change a session: for this day only, in the weekly plan, a guest host, or add another session on that day. An extra session (not in the weekly plan) is edited as it is. */
export function EditChoice({ open, onClose, date, slot, onDay, onWeekly, onExtra, onEditExtra }: { open: boolean; onClose: () => void; date: ISODate; slot: Slot; onDay: () => void; onWeekly: () => void; onExtra: () => void; onEditExtra: () => void }) {
  const t = useT();
  const { lang, fdl } = useFmt();
  const s = useClub();
  const navigate = useNavigate();
  const cell = open ? sessionsOn(s, date).find((x) => x.slot === slot)?.cell ?? null : null;
  const guest = open ? guestOn(s, date, slot) : null;
  const isExtra = open && !isWeekSlot(slot);
  const title = cell ? t('cal.editChoiceTitle', { title: activityName(s.activities[cell.activityId], lang) }) : t('cal.emptyChoiceTitle', { slot });
  const row = (icon: string, label: string, sub: string, run: () => void) => (
    <button key={label} type="button" className="cp-tap-self cp-press cp-grey h-fill" onClick={run} style={{ width: '100%', minHeight: 60, padding: '8px 12px 8px 14px', border: 'none', borderRadius: 16, background: 'var(--fill, #F4F4F5)', color: '#24201C', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', fontFamily: 'Inter', textAlign: 'left' }}>
      <span aria-hidden="true" className="cp-fill" style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--fill, #F4F4F5)', color: 'var(--accent, #75624B)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><Icon name={icon} size={19} /></span>
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.35 }}>{label}</span>
        <span style={{ fontSize: 14, color: '#6B6259', lineHeight: 1.35 }}>{sub}</span>
      </span>
      <Icon name="chevron_right" size={22} color="#A89C8E" />
    </button>
  );
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {isExtra ? row('edit', t('cal.extraEdit'), t('cal.extraEditSub'), onEditExtra) : (
          <>
            {row('today', t('cal.justThisDay'), t('cal.justThisDaySub', { date: fdl(date) }), onDay)}
            {row('event_repeat', t('cal.weeklyPlan'), t('cal.weeklyPlanSub'), onWeekly)}
          </>
        )}
        {/* round 7: a guest host leads this session, or book one: the Guests screen opens on it */}
        {guest
          ? row('co_present', t('cal.guestOpen'), guest.host.name, () => navigate(`/guests?session=${guest.session.id}`))
          : row('co_present', t('cal.guestBook'), t('cal.guestBookSub'), () => navigate(`/guests?book=${date}|${slot}`))}
        {/* round 7: another session on that day, at any time */}
        {row('more_time', t('cal.extraAdd'), t('cal.extraAddSub', { date: fdl(date) }), onExtra)}
      </div>
    </Sheet>
  );
}

export function DaySheet({ open, onClose, date, slot }: { open: boolean; onClose: () => void; date: ISODate; slot: Slot }) {
  const t = useT();
  const { lang, fdl } = useFmt();
  const s = useClub();
  const act = useAct();
  const cur = open ? sessionsOn(s, date).find((x) => x.slot === slot)?.cell ?? null : null;
  const weekly = open ? weeklyCell(s, date, slot) : null;
  const over = open ? scheduleDayOf(s, date) : undefined;
  const changed = open && slotChanged(s, date, slot);
  const guest = open ? guestOn(s, date, slot) : null;
  const teachers = activityTeachers(s);
  const defaultTeacher = teachers[slot === '10:30' ? 0 : 1]?.id ?? teachers[0]?.id ?? '';
  const [actId, setActId] = useState<string>(NONE);
  const [staff, setStaff] = useState('');
  const [room, setRoom] = useState('');
  const [note, setNote] = useState('');
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  useResetOn(open ? `${date}|${slot}` : null, () => {
    setActId(cur?.activityId ?? NONE);
    setStaff(cur?.staffId ?? defaultTeacher);
    setRoom(cur?.roomId ?? '');
    setNote(over?.note ?? '');
    setNotify(true);
    setBusy(false);
  });

  const activities = live(s.activities).filter((a) => a.active || a.id === cur?.activityId).sort((a, b) => a.name.localeCompare(b.name));
  const activityOptions = [{ value: NONE, label: t('cal.noSession') }, ...activities.map((a) => ({ value: a.id, label: activityName(a, lang) }))];
  const teacherIds = [...teachers.map((x) => x.id), ...(staff && !teachers.some((x) => x.id === staff) ? [staff] : [])];
  const teacherOptions = teacherIds.map((id) => ({ value: id, label: staffCall(s.staff[id]) || id }));
  const roomOptions = live(s.rooms).sort((a, b) => a.name.localeCompare(b.name)).map((r) => ({ value: r.id, label: roomName(r, lang) }));

  const pick = (id: string) => {
    setActId(id);
    const a = s.activities[id];
    if (id !== NONE && a) { setRoom(a.roomId); if (!staff) setStaff(defaultTeacher); }
  };
  const cell = actId === NONE ? null : { activityId: actId, staffId: staff, roomId: room || s.activities[actId]?.roomId || '' };
  const noteText = note.trim();
  const dirty = !sameCell(cell, cur) || noteText !== (over?.note ?? '');
  const ready = actId === NONE || (!!cell?.staffId && !!cell.roomId);
  const weeklyText = weekly ? [activityName(s.activities[weekly.activityId], lang), roomName(s.rooms[weekly.roomId], lang), staffCall(s.staff[weekly.staffId])].filter(Boolean).join(' · ') : '';

  const save = async () => {
    setBusy(true);
    const r = await act('schedule.changeDay', { date, slot, cell, note: noteText || null, notify }, { silent: true });
    setBusy(false);
    if (r.ok) { say(t(notify ? 'cal.daySaved' : 'cal.daySavedQuiet', { date: fdl(date) })); onClose(); }
  };
  const back = async () => {
    setBusy(true);
    const r = await act('schedule.resetDay', { date, slot, notify }, { silent: true });
    setBusy(false);
    if (r.ok) { say(t('cal.dayBackDone', { date: fdl(date) })); onClose(); }
  };

  return (
    <Sheet open={open} onClose={onClose} title={t('cal.dayTitle', { date: fdl(date), slot })}>
      <div style={{ fontSize: 14, lineHeight: '20px', color: '#6B6259' }}>{weekly ? t('cal.dayWeekly', { what: weeklyText }) : t('cal.dayWeeklyNone')}</div>
      {guest ? <Note tone="ochre" icon="co_present">{t('cal.dayGuest', { name: guest.host.name })}</Note> : null}
      <Select label={t('cal.activity')} value={actId} onChange={pick} options={activityOptions} />
      {actId !== NONE ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
          <Select label={t('cal.teacher')} value={staff} onChange={setStaff} options={teacherOptions} />
          <Select label={t('cal.room')} value={room} onChange={setRoom} options={roomOptions} />
        </div>
      ) : null}
      <TextField label={t('cal.dayNote')} value={note} onChange={setNote} placeholder={t('cal.dayNotePh')} maxLength={160} />
      <Toggle on={notify} onClick={() => setNotify(!notify)} label={t('cal.dayTell')} />
      <Button full disabled={!dirty || !ready || busy} onClick={save}>{t('cal.daySave')}</Button>
      {changed ? <Button full variant="secondary" disabled={busy} onClick={back}>{t('cal.dayBack')}</Button> : null}
    </Sheet>
  );
}

/** KC round 7: add an extra session on a date (no `time`), or edit / remove one (`time` = its current time). */
export function ExtraSheet({ open, onClose, date, time }: { open: boolean; onClose: () => void; date: ISODate; time?: string }) {
  const t = useT();
  const { lang, fdl } = useFmt();
  const s = useClub();
  const act = useAct();
  const editing = !!time; // edit / remove mode (stays so while the sheet closes after a removal)
  const edit = open && time ? extrasOn(s, date).find((x) => x.time === time) : undefined;
  const teachers = activityTeachers(s);
  const [at, setAt] = useState('');
  const [actId, setActId] = useState('');
  const [staff, setStaff] = useState('');
  const [room, setRoom] = useState('');
  const [note, setNote] = useState('');
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  useResetOn(open ? `${date}|${time ?? 'new'}` : null, () => {
    setAt(edit?.time ?? (open ? suggestExtraTime(s, date) : ''));
    setActId(edit?.cell.activityId ?? '');
    setStaff(edit?.cell.staffId ?? teachers[0]?.id ?? '');
    setRoom(edit?.cell.roomId ?? '');
    setNote(edit?.note ?? '');
    setNotify(true);
    setBusy(false);
  });

  const hours = s.club.settings;
  const lastStart = toHM(toMin(hours.close) - LAST_START_BEFORE_CLOSE);
  const issue = at ? extraTimeIssue(s, date, at, edit?.time) : null;
  const activities = live(s.activities).filter((a) => a.active || a.id === edit?.cell.activityId).sort((a, b) => a.name.localeCompare(b.name));
  const teacherIds = [...teachers.map((x) => x.id), ...(staff && !teachers.some((x) => x.id === staff) ? [staff] : [])];
  const pick = (id: string) => { setActId(id); const a = s.activities[id]; if (a) setRoom(a.roomId); if (!staff) setStaff(teachers[0]?.id ?? ''); };
  const noteText = note.trim();
  const cell = { activityId: actId, staffId: staff, roomId: room };
  const ready = !!at && !issue && !!actId && !!staff && !!room;
  const dirty = (editing && !edit) ? false : !edit || at !== edit.time || !sameCell(cell, edit.cell) || noteText !== (edit.note ?? '');

  const save = async () => {
    setBusy(true);
    const body = { date, ...cell, note: noteText || null, notify };
    const r = editing && time ? await act('schedule.editSession', { ...body, time, toTime: at }, { silent: true }) : await act('schedule.addSession', { ...body, time: at }, { silent: true });
    setBusy(false);
    if (r.ok) { say(t(editing ? (notify ? 'cal.extraSaved' : 'cal.extraSavedQuiet') : notify ? 'cal.extraAdded' : 'cal.extraAddedQuiet', { date: fdl(date), time: at })); onClose(); }
  };
  const remove = async () => {
    if (!time) return;
    setBusy(true);
    const r = await act('schedule.removeSession', { date, time, notify }, { silent: true });
    setBusy(false);
    if (r.ok) { say(t(notify ? 'cal.extraRemovedDone' : 'cal.extraRemovedQuiet')); onClose(); }
  };
  const issueText = issue ? t(issue.code, issue.params) : false;

  return (
    <Sheet open={open} onClose={onClose} title={editing ? t('cal.extraEditTitle', { date: fdl(date), time: time! }) : t('cal.extraAddTitle', { date: fdl(date) })}>
      <TimeField label={t('cal.time')} value={at} onChange={setAt} min={hours.open} max={lastStart} step={5} error={issueText} />
      <Select label={t('cal.activity')} value={actId} onChange={pick} placeholder={t('guests.pickActivity')} options={activities.map((a) => ({ value: a.id, label: activityName(a, lang) }))} />
      {actId ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
          <Select label={t('cal.teacher')} value={staff} onChange={setStaff} options={teacherIds.map((id) => ({ value: id, label: staffCall(s.staff[id]) || id }))} />
          <Select label={t('cal.room')} value={room} onChange={setRoom} options={live(s.rooms).sort((a, b) => a.name.localeCompare(b.name)).map((r) => ({ value: r.id, label: roomName(r, lang) }))} />
        </div>
      ) : null}
      <TextField label={t('cal.extraNoteLabel')} value={note} onChange={setNote} placeholder={t('cal.extraNotePh')} maxLength={160} />
      <Toggle on={notify} onClick={() => setNotify(!notify)} label={t('cal.dayTell')} />
      <Button full disabled={!dirty || !ready || busy} onClick={save}>{editing ? t('cal.extraSaveBtn') : t('cal.extraAddBtn')}</Button>
      {editing ? <Button full variant="secondary" disabled={busy} onClick={remove}>{t('cal.extraRemove')}</Button> : null}
    </Sheet>
  );
}
