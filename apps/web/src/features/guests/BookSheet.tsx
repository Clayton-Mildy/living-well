// Book a guest host for a date and session (or edit a booking). The host, the date, the session (10:30 or 13:30, showing what is on), the activity
// (the session's own unless you pick another, which changes that day only), the fee (the host's usual one) and a note.
import { useState } from 'react';
import { live, sessionsOn, type GuestSession, type ISODate, type Slot } from '@cp/shared';
import { activityName } from '@cp/shared/rules/activity';
import { SLOTS, dayChangeable } from '@cp/shared/rules/calendar';
import { bookableHosts, guestOn, hostOf } from '@cp/shared/rules/guests';
import { Button, DateField, Note, Select, Sheet, TextField } from '../../components/ui';
import { useAct } from '../../lib/act';
import { useT, useFmt } from '../../lib/i18n';
import { useNow } from '../../lib/clock';
import { useResetOn } from '../../lib/useResetOn';
import { useClub } from '../../store/replica';
import { say } from '../../store/ui';
import { HostForm } from './HostViews';
import { MoneyField } from './lib';

const NEW = '__new__';

export function BookSheet({ open, onClose, edit, hostId, date, slot: slot0 }: { open: boolean; onClose: () => void; edit?: GuestSession; hostId?: string; date?: ISODate; slot?: Slot }) {
  const t = useT();
  const { lang, fdl } = useFmt();
  const s = useClub();
  const act = useAct();
  const { today } = useNow();
  const [host, setHost] = useState('');
  const [day, setDay] = useState('');
  const [slot, setSlot] = useState<Slot>('10:30');
  const [activityId, setActivityId] = useState('');
  const [touchedAct, setTouchedAct] = useState(false);
  const [fee, setFee] = useState('');
  const [touchedFee, setTouchedFee] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [newHost, setNewHost] = useState(false);
  useResetOn(open ? edit?.id ?? 'new' : null, () => {
    const h = edit?.hostId ?? hostId ?? '';
    setHost(h); setDay(edit?.date ?? date ?? ''); setSlot(edit?.slot ?? slot0 ?? '10:30'); setActivityId(edit?.activityId ?? ''); setTouchedAct(!!edit);
    setFee(edit ? String(edit.fee) : h && hostOf(s, h) ? String(hostOf(s, h)!.fee) : ''); setTouchedFee(!!edit); setNote(edit?.note ?? ''); setBusy(false); setNewHost(false);
  });

  const hosts = bookableHosts(s);
  const current = edit ? hostOf(s, edit.hostId) : undefined;
  const hostOptions = [...(current && !hosts.some((h) => h.id === current.id) ? [current] : []), ...hosts].map((h) => ({ value: h.id, label: h.name, hint: h.what }));
  const cellOn = (sl: Slot) => (day ? sessionsOn(s, day).find((x) => x.slot === sl)?.cell ?? null : null);
  const takenBy = (sl: Slot) => { const g = day ? guestOn(s, day, sl) : null; return g && g.session.id !== edit?.id ? g.host.name : ''; };
  const slotOptions = SLOTS.map((sl) => {
    const c = cellOn(sl);
    const who = takenBy(sl);
    return { value: sl, label: `${sl} · ${c ? activityName(s.activities[c.activityId], lang) : t('cal.noSession')}`, ...(who ? { hint: t('guests.takenBy', { name: who }) } : {}) };
  });
  const activities = live(s.activities).filter((a) => a.active || a.id === edit?.activityId).sort((a, b) => a.name.localeCompare(b.name));
  const slotAct = cellOn(slot)?.activityId ?? '';
  // follow the session's own activity until one is picked
  const act0 = touchedAct ? activityId : slotAct;
  const dayOk = !!day && dayChangeable(s, day, today);
  const taken = takenBy(slot);
  const ready = !!host && dayOk && !taken && !!act0 && Number(fee) > 0;
  const changesSlot = !!act0 && !!slotAct && act0 !== slotAct;

  const pickHost = (id: string) => {
    if (id === NEW) { setNewHost(true); return; }
    setHost(id);
    if (!touchedFee) setFee(String(hostOf(s, id)?.fee ?? ''));
  };
  const save = async () => {
    setBusy(true);
    const body = { hostId: host, date: day, slot, activityId: act0, fee: Number(fee), note: note.trim() || null };
    const r = edit ? await act('guest.update', { id: edit.id, ...body }, { silent: true }) : await act('guest.book', body, { silent: true });
    setBusy(false);
    if (r.ok) { say(t(edit ? 'guests.saved' : 'guests.booked', { name: hostOf(s, host)?.name ?? '', date: fdl(day) })); onClose(); }
  };
  return (
    <>
      <Sheet open={open} onClose={onClose} title={edit ? t('guests.editTitle') : t('guests.bookTitle')}
        footer={<Button full disabled={!ready || busy} onClick={save}>{edit ? t('common.save') : t('guests.bookBtn')}</Button>}>
        <Select label={t('guests.host')} value={host} onChange={pickHost} placeholder={t('guests.pickHost')} options={[...hostOptions, { value: NEW, label: t('guests.newHost') }]} />
        <DateField label={t('guests.date')} value={day} min={today} onChange={setDay} disabledDate={(d) => !dayChangeable(s, d, today)} error={!!day && !dayOk && t('guests.errDay')} />
        <Select label={t('guests.session')} value={slot} onChange={setSlot} options={slotOptions} error={!!taken && t('guests.takenBy', { name: taken })} />
        <Select label={t('cal.activity')} value={act0} onChange={(v) => { setActivityId(v); setTouchedAct(true); }} placeholder={t('guests.pickActivity')} options={activities.map((a) => ({ value: a.id, label: activityName(a, lang) }))} />
        {changesSlot ? <Note tone="cream" icon="info">{t('guests.changesSlot', { slot, date: fdl(day) })}</Note> : null}
        <MoneyField label={t('guests.fee')} value={fee} onChange={(v) => { setFee(v); setTouchedFee(true); }} />
        <TextField label={t('guests.note')} value={note} onChange={setNote} placeholder={t('guests.notePh')} maxLength={300} />
      </Sheet>
      <HostForm open={newHost} onClose={() => setNewHost(false)} onSaved={(id, usual) => { setHost(id); if (!touchedFee) setFee(String(usual)); }} />
    </>
  );
}
