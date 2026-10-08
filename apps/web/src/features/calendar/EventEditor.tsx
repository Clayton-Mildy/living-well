// Events editor (management): add, edit and delete closures, national holidays and outings. Uses the design's edit dialog.
// A "notify" toggle (on by default) decides whether staff and families are told about the change.
// Round 6 (phone): a pushed full screen (PhoneScreen) with grouped fields and the Save pill pinned at the bottom, instead of the centred dialog.
import { useEffect, useState } from 'react';
import type { CalendarEvent } from '@cp/shared';
import { Button, Chip, DateField, Dialog, Eyebrow, Group, Note, PhoneScreen, TextField, TimeField, Toggle, FONT_BODY } from '../../components/ui';
import { useDevice } from '../../hooks/useDevice';
import { useT, useFmt } from '../../lib/i18n';
import { useAct } from '../../lib/act';
import { useNow } from '../../lib/clock';

type Kind = 'closed' | 'holiday' | 'outing';
const KINDS: Kind[] = ['closed', 'holiday', 'outing'];

export function EventEditor({ open, onClose, event, date }: { open: boolean; onClose: () => void; event?: CalendarEvent; date?: string }) {
  const t = useT();
  const { fdl } = useFmt();
  const { today } = useNow();
  const { isPhone } = useDevice();
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

  const heading = event ? t('cal.editEventTitle') : t('cal.addEventTitle');
  const pill = (label: string, run: () => void, danger = false) => (
    <button type="button" className="h-bronze cp-press" aria-disabled={busy || undefined} onClick={busy ? undefined : run} style={{ width: '100%', height: 50, borderRadius: 999, border: 'none', background: danger ? '#9A3D24' : '#24201C', color: '#FFFFFF', fontSize: 16, fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter' }}>{label}</button>
  );
  // round 6, phone: a pushed screen ("‹ Cancel"), a centred header, one group per part of the form, Save pinned at the bottom
  if (isPhone) {
    return (
      <PhoneScreen open={open} onClose={onClose} label={heading} back={t('common.cancel')}
        footer={confirmDel ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="cp-press" onClick={() => setConfirmDel(false)} style={{ flex: 1, height: 50, borderRadius: 999, border: '1px solid #DCD3C8', background: '#FFFFFF', color: '#24201C', fontSize: 16, fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter' }}>{t('cal.keep')}</button>
            <div style={{ flex: 1 }}>{pill(t('cal.confirmDelete'), remove, true)}</div>
          </div>
        ) : pill(t('common.save'), save)}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 4 }}>
          <Eyebrow>{t('cal.eventsEditor')}</Eyebrow>
          <h2 style={{ margin: 0, fontSize: 26, lineHeight: 1.15, fontWeight: 400, letterSpacing: '-0.6px', color: '#2B231C' }}>{heading}</h2>
        </div>
        {confirmDel ? (
          <>
            <Note tone="rust" icon="warning">{t('cal.deleteWarn', { date: fdl(event?.date ?? d0) })}</Note>
            <Group pad="10px 12px"><Toggle on={notify} onClick={() => setNotify(!notify)} label={t('cal.notify')} /></Group>
            {err ? <Note tone="rust" icon="error">{err}</Note> : null}
          </>
        ) : (
          <>
            <Group title={t('cal.type')} pad="12px 14px">
              <div role="group" aria-label={t('cal.type')} style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {KINDS.map((k) => <Chip key={k} selected={kind === k} onClick={() => setKind(k)}>{t('cal.t_' + k)}</Chip>)}
              </div>
            </Group>
            <Group pad="14px 14px 16px" gap={14}>
              <TextField label={t('cal.titleEn')} value={title} onChange={setTitle} maxLength={120} error={tried && errors.title} placeholder={t('cal.titleEnPh')} />
              <TextField label={t('cal.titleId')} value={titleId} onChange={setTitleId} maxLength={120} />
            </Group>
            <Group pad="14px 14px 16px" gap={14}>
              <DateField label={t('cal.date')} value={d0} min={event?.date && event.date < today ? event.date : today} onChange={setD0} error={tried && errors.date} />
              <Toggle on={multi} onClick={() => { setMulti(!multi); if (!multi && !d1) setD1(d0); }} label={t('cal.multiDay')} />
              {multi ? <DateField label={t('cal.until')} value={d1} min={d0} onChange={setD1} error={tried && errors.end} /> : null}
              {kind === 'outing' ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <TimeField label={t('cal.from')} value={from} onChange={setFrom} error={tried && errors.time} />
                  <TimeField label={t('cal.to')} value={to} onChange={setTo} />
                </div>
              ) : null}
            </Group>
            {err ? <Note tone="rust" icon="error">{err}</Note> : null}
            <Group pad="10px 12px"><Toggle on={notify} onClick={() => setNotify(!notify)} label={t('cal.notify')} /></Group>
            {event ? (
              <button type="button" className="cp-tap-self cp-press" onClick={() => setConfirmDel(true)} style={{ height: 50, borderRadius: 14, border: 'none', background: '#FFFFFF', color: '#9A3D24', fontSize: 16, fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>{t('common.delete')}</button>
            ) : null}
          </>
        )}
      </PhoneScreen>
    );
  }
  return (
    <Dialog open={open} onClose={onClose} eyebrow={t('cal.eventsEditor')} title={event ? t('cal.editEventTitle') : t('cal.addEventTitle')} maxWidth={560}
      footer={confirmDel ? (
        <>
          <Button variant="secondary" onClick={() => setConfirmDel(false)}>{t('cal.keep')}</Button>
          <Button variant="danger" disabled={busy} onClick={remove}>{t('cal.confirmDelete')}</Button>
        </>
      ) : (
        <>
          {event ? <Button variant="ghost" style={{ marginRight: 'auto', color: '#9A3D24' }} onClick={() => setConfirmDel(true)}>{t('common.delete')}</Button> : null}
          <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
          <Button disabled={busy} onClick={save}>{t('common.save')}</Button>
        </>
      )}>
      {confirmDel ? (
        <>
          <Note tone="rust" icon="warning">{t('cal.deleteWarn', { date: fdl(event?.date ?? d0) })}</Note>
          <Toggle on={notify} onClick={() => setNotify(!notify)} label={t('cal.notify')} />
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
          <TextField label={t('cal.titleId')} value={titleId} onChange={setTitleId} maxLength={120} />
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
          <Toggle on={notify} onClick={() => setNotify(!notify)} label={t('cal.notify')} />
        </>
      )}
    </Dialog>
  );
}
