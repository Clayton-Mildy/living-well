// Events editor (management): add, edit and delete closures, national holidays and outings. Uses the design's edit dialog.
// A "notify" toggle (on by default) decides whether staff and families are told about the change.
import { useEffect, useState } from 'react';
import type { CalendarEvent } from '@cp/shared';
import { Button, Chip, DateField, Dialog, Note, TextField, TimeField, Toggle, FONT_BODY } from '../../components/ui';
import { useT, useFmt } from '../../lib/i18n';
import { useAct } from '../../lib/act';
import { useNow } from '../../lib/clock';

type Kind = 'closed' | 'holiday' | 'outing';
const KINDS: Kind[] = ['closed', 'holiday', 'outing'];

export function EventEditor({ open, onClose, event, date }: { open: boolean; onClose: () => void; event?: CalendarEvent; date?: string }) {
  const t = useT();
  const { fdl } = useFmt();
  const { today } = useNow();
  const act = useAct();
  const [kind, setKind] = useState<Kind>('closed');
  const [title, setTitle] = useState('');
  const [titleId, setTitleId] = useState('');
  const [d0, setD0] = useState(today);
  const [multi, setMulti] = useState(false);
  const [d1, setD1] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [tried, setTried] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!open) return;
    setKind(event?.kind ?? 'closed');
    setTitle(event?.title ?? '');
    setTitleId(event?.titleId ?? '');
    setD0(event?.date ?? date ?? today);
    setMulti(!!event?.endDate);
    setD1(event?.endDate ?? '');
    setFrom(event?.from ?? '');
    setTo(event?.to ?? '');
    setTried(false);
    setConfirmDel(false);
    setNotify(true);
    setErr('');
  }, [open, event?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const end = multi && d1 > d0 ? d1 : '';
  const errors = {
    title: !title.trim() ? t('cal.errTitle') : '',
    date: !d0 ? t('cal.errDate') : d0 < today && d0 !== event?.date ? t('cal.err.pastDate') : '',
    end: multi && (!d1 || d1 <= d0) ? t('cal.err.endBeforeStart') : '',
    time: kind === 'outing' && (from || to) && (!from || !to) ? t('cal.err.timeBoth') : kind === 'outing' && from && to && from >= to ? t('cal.err.timeOrder') : '',
  };
  const valid = !errors.title && !errors.date && !errors.end && !errors.time;
  const save = async () => {
    setTried(true);
    if (!valid || busy) return;
    setBusy(true);
    const common = { date: d0, kind, title: title.trim(), notify };
    const r = event
      ? await act('calendarEvent.update', { eventId: event.id, ...common, endDate: end || null, titleId: titleId.trim() || null, from: kind === 'outing' && from && to ? from : null, to: kind === 'outing' && from && to ? to : null }, { ok: t(notify ? 'cal.eventSaved' : 'cal.eventSavedQuiet') })
      : await act('calendarEvent.create', { ...common, ...(end ? { endDate: end } : {}), ...(titleId.trim() ? { titleId: titleId.trim() } : {}), ...(kind === 'outing' && from && to ? { from, to } : {}) }, { ok: t(notify ? 'cal.eventSaved' : 'cal.eventSavedQuiet') });
    setBusy(false);
    if (r.ok) onClose(); else setErr(t(r.code, r.params));
  };
  const remove = async () => {
    if (!event || busy) return;
    setBusy(true);
    const r = await act('calendarEvent.delete', { eventId: event.id, notify }, { ok: t(notify ? 'cal.eventDeleted' : 'cal.eventDeletedQuiet') });
    setBusy(false);
    if (r.ok) { setConfirmDel(false); onClose(); } else setErr(t(r.code, r.params));
  };

  return (
    <Dialog open={open} onClose={onClose} eyebrow={t('cal.eventsEditor')} title={event ? t('cal.editEventTitle') : t('cal.addEventTitle')} maxWidth={560}
      footer={confirmDel ? (
        <>
          <Button variant="secondary" onClick={() => setConfirmDel(false)}>{t('cal.keep')}</Button>
          <Button variant="danger" disabled={busy} onClick={remove}>{t('cal.confirmDelete')}</Button>
        </>
      ) : (
        <>
          {event ? <Button variant="ghost" style={{ marginRight: 'auto', color: '#AF4B2F' }} onClick={() => setConfirmDel(true)}>{t('common.delete')}</Button> : null}
          <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
          <Button disabled={busy} onClick={save}>{t('common.save')}</Button>
        </>
      )}>
      {confirmDel ? (
        <>
          <Note tone="rust" icon="warning">{t('cal.deleteWarn', { date: fdl(event?.date ?? d0) })}</Note>
          <Toggle on={notify} onClick={() => setNotify(!notify)} label={t('cal.notify')} sub={t('cal.notifySub')} />
          {err ? <Note tone="rust" icon="error">{err}</Note> : null}
        </>
      ) : (
        <>
          <div role="group" aria-label={t('cal.type')} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: FONT_BODY, fontWeight: 500, lineHeight: 1.4 }}>{t('cal.type')}</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {KINDS.map((k) => <Chip key={k} selected={kind === k} onClick={() => setKind(k)}>{t('cal.t_' + k)}</Chip>)}
            </div>
          </div>
          <TextField label={t('cal.titleEn')} value={title} onChange={setTitle} maxLength={120} error={tried && errors.title} placeholder={t('cal.titleEnPh')} />
          <TextField label={t('cal.titleId')} value={titleId} onChange={setTitleId} maxLength={120} hint={t('cal.titleIdHint')} />
          <DateField label={t('cal.date')} value={d0} min={event?.date && event.date < today ? event.date : today} onChange={setD0} error={tried && errors.date} />
          <Toggle on={multi} onClick={() => { setMulti(!multi); if (!multi && !d1) setD1(d0); }} label={t('cal.multiDay')} />
          {multi ? <DateField label={t('cal.until')} value={d1} min={d0} onChange={setD1} error={tried && errors.end} /> : null}
          {kind === 'outing' ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <TimeField label={t('cal.from')} value={from} onChange={setFrom} error={tried && errors.time} />
              <TimeField label={t('cal.to')} value={to} onChange={setTo} />
            </div>
          ) : null}
          {err ? <Note tone="rust" icon="error">{err}</Note> : null}
          <Toggle on={notify} onClick={() => setNotify(!notify)} label={t('cal.notify')} sub={t('cal.notifySub')} />
        </>
      )}
    </Dialog>
  );
}
