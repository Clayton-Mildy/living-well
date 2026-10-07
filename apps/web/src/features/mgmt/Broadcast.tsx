// Broadcast (design ScrBc): audience, template, message, when; WhatsApp preview for a chosen recipient; sent and scheduled list.
// Scheduled sends can be edited or cancelled and go out when the demo clock passes them. Templates are editable.
import { Fragment, useMemo, useState } from 'react';
import { addDays, dow, type Broadcast as BroadcastRow } from '@cp/shared';
import { AUDIENCES, audienceRecipients, broadcastRecipients, renderTemplate, scheduledBroadcasts, type AudienceKey } from '@cp/shared/rules/mgmt';
import { Button, Chip, DateField, Dialog, Note, PageHead, Pager, SectionLabel, Select, TextField, TimeField, usePaged, FONT_BODY } from '../../components/ui';
import { useT, useFmt } from '../../lib/i18n';
import { useNow } from '../../lib/clock';
import { useAct } from '../../lib/act';
import { useClub } from '../../store/replica';
import { BadgePill, ListCard, Page, HPAD, heroCard, labelStyle, chipRow, splitRow, tn } from './common';

type TplRow = { id: string; key: BroadcastRow['template']; title: string; text: string };
const DEFAULT_EN: Record<string, { title: string; text: string }> = {
  update: { title: 'Club update', text: 'Hello {name}, news from CitraPremier: {msg}' },
  closure: { title: 'Club closed', text: 'Hello {name}, a reminder that CitraPremier is closed on {msg}. We open again on the next working day at 08:30.' },
  event: { title: 'Event invitation', text: 'Hello {name}, you are invited: {msg}. Reply YES to save a place.' },
};
type When = 'now' | 'tom' | 'fri' | 'custom';

export function Broadcast() {
  const t = useT();
  const { fds } = useFmt();
  const s = useClub();
  const { today, now } = useNow();
  const act = useAct();
  const tpls = s.club.settings.broadcastTemplates as TplRow[];
  const [aud, setAud] = useState<AudienceKey[]>(['families']);
  const [tplId, setTplId] = useState('');
  const [msg, setMsg] = useState('');
  const [when, setWhen] = useState<When>('now');
  const [cDate, setCDate] = useState('');
  const [cTime, setCTime] = useState('09:00');
  const [editing, setEditing] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState('');
  const [tplOpen, setTplOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const tplTitle = (x: Pick<TplRow, 'key' | 'title'>) => (DEFAULT_EN[x.key] && x.title === DEFAULT_EN[x.key].title ? t('mgmt.tplTitle_' + x.key) : x.title);
  const tplText = (x: Pick<TplRow, 'key' | 'text'>) => (DEFAULT_EN[x.key] && x.text === DEFAULT_EN[x.key].text ? t('mgmt.tplText_' + x.key) : x.text);
  const tpl = tpls.find((x) => x.id === tplId) ?? tpls[0];
  const counts = useMemo(() => Object.fromEntries(AUDIENCES.map((a) => [a, audienceRecipients(s, a, today).length])) as Record<AudienceKey, number>, [s, today]);
  const recipients = useMemo(() => broadcastRecipients(s, aud, today), [s, aud, today]);
  const previewTo = recipients.find((r) => r.key === previewKey) ?? recipients[0];

  const tomorrow = addDays(today, 1);
  const friday = (() => { let d = addDays(today, 1); while (dow(d) !== 5) d = addDays(d, 1); return d; })();
  const sendAt = when === 'tom' ? `${tomorrow}T08:00` : when === 'fri' ? `${friday}T15:00` : when === 'custom' && cDate ? `${cDate}T${cTime}` : '';
  const customBad = when === 'custom' && (!cDate || !cTime || `${cDate}T${cTime}` <= `${today}T${now}`);
  const ok = !!tpl && aud.length > 0 && !!msg.trim() && recipients.length > 0 && !customBad && (editing ? when !== 'now' : true);
  const whenOptions: { k: When; label: string }[] = [
    ...(editing ? [] : [{ k: 'now' as const, label: t('mgmt.whenNow') }]),
    { k: 'tom', label: t('mgmt.whenTom') },
    { k: 'fri', label: `${fds(friday)}, 15:00` },
    { k: 'custom', label: t('mgmt.whenCustom') },
  ];
  const whenText = (dt: string) => `${fds(dt.slice(0, 10))}, ${dt.slice(11, 16)}`;

  const reset = () => { setMsg(''); setEditing(null); setWhen('now'); setCDate(''); };
  const send = async () => {
    if (!ok || busy || !tpl) return;
    setBusy(true);
    const base = { template: tpl.key, message: msg.trim(), audiences: aud };
    try {
      if (editing) {
        const r = await act('broadcast.update', { broadcastId: editing, ...base, sendAt }, { ok: t('mgmt.bcUpdated') });
        if (r.ok) reset();
      } else if (when === 'now') {
        const r = await act('broadcast.send', base, { ok: (res) => tn(t, 'mgmt.bcSentToast', Number(res.recipients ?? recipients.length)) });
        if (r.ok) reset();
      } else {
        const r = await act('broadcast.schedule', { ...base, sendAt }, { ok: t('mgmt.bcScheduledToast', { when: whenText(sendAt) }) });
        if (r.ok) reset();
      }
    } finally { setBusy(false); }
  };
  const edit = (b: BroadcastRow) => {
    setEditing(b.id);
    setAud(b.audiences);
    setTplId(tpls.find((x) => x.key === b.template)?.id ?? '');
    setMsg(b.message);
    setWhen('custom');
    setCDate(b.sendAt.slice(0, 10));
    setCTime(b.sendAt.slice(11, 16));
    window.scrollTo?.({ top: 0 });
  };
  const cancel = async (b: BroadcastRow) => {
    const r = await act('broadcast.cancel', { broadcastId: b.id }, { ok: t('mgmt.bcCancelled') });
    if (r.ok && editing === b.id) reset();
  };

  // sent and scheduled: scheduled first (soonest), then the rest newest first
  const all = Object.values(s.broadcasts).filter((b) => !b.deletedAt);
  const sched = scheduledBroadcasts(s);
  const rest = all.filter((b) => b.status !== 'scheduled').sort((a, b) => (a.sendAt < b.sendAt ? 1 : a.sendAt > b.sendAt ? -1 : 0));
  const rows = [...sched, ...rest];
  const paged = usePaged(rows, 8);
  const toggleAud = (a: AudienceKey) => setAud(aud.includes(a) ? aud.filter((x) => x !== a) : [...aud, a]);
  const bubble = tpl ? renderTemplate(tplText(tpl), previewTo?.firstName ?? '…', msg) : '';

  return (
    <Page gap={18}>
      <PageHead eyebrow={t('mgmt.bcEyebrow')} title={t('nav.broadcast')} />

      <div style={{ ...splitRow, gap: 'clamp(20px, 3.4vw, 44px)' }}>
        <div style={{ ...heroCard, flex: '1 1 440px', minWidth: 0, padding: `22px ${HPAD}`, display: 'flex', flexDirection: 'column', gap: 18 }}>
          {editing ? <Note tone="ochre" icon="edit">{t('mgmt.bcEditing')}</Note> : null}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <SectionLabel>{t('mgmt.audience')}</SectionLabel>
            <div style={chipRow}>
              {AUDIENCES.map((a) => <Chip key={a} selected={aud.includes(a)} onClick={() => toggleAud(a)}>{`${t('mgmt.aud_' + a)} · ${counts[a]}`}</Chip>)}
            </div>
            {!recipients.length ? <span style={{ fontSize: FONT_BODY, color: '#5E5852', lineHeight: 1.4 }}>{t('mgmt.noRecipients')}</span> : null}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <SectionLabel>{t('mgmt.template')}</SectionLabel>
            <div style={chipRow}>
              {tpls.map((x) => <Chip key={x.id} selected={tpl?.id === x.id} onClick={() => setTplId(x.id)}>{tplTitle(x)}</Chip>)}
              <Chip icon="edit" onClick={() => setTplOpen(true)}>{t('mgmt.editTemplates')}</Chip>
            </div>
          </div>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={labelStyle}>{t('mgmt.message')}</span>
            <textarea value={msg} onChange={(e) => setMsg(e.target.value)} placeholder={tpl && ['update', 'closure', 'event'].includes(tpl.key) ? t('mgmt.ph_' + tpl.key) : t('mgmt.ph_custom')}
              style={{ minHeight: 96, resize: 'vertical', border: '1px solid #DDD1C2', borderRadius: 10, padding: '12px 14px', fontSize: 16, lineHeight: '24px', fontFamily: 'Inter', color: '#24201C', outline: 'none', background: '#FFFFFF' }} />
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <SectionLabel>{t('mgmt.when')}</SectionLabel>
            <div style={chipRow}>
              {whenOptions.map((o) => <Chip key={o.k} selected={when === o.k} onClick={() => setWhen(o.k)}>{o.label}</Chip>)}
            </div>
            {when === 'custom' ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 }}>
                <DateField label={t('common.date')} value={cDate} min={today} onChange={setCDate} error={cDate && customBad ? t('mgmt.err.pastTime') : false} />
                <TimeField label={t('common.time')} value={cTime} onChange={setCTime} />
              </div>
            ) : null}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button size={56} full disabled={!ok || busy} onClick={send}>
              {editing ? t('common.saveChanges') : when === 'now' ? tn(t, 'mgmt.sendTo', recipients.length) : tn(t, 'mgmt.scheduleFor', recipients.length)}
            </Button>
            {editing ? <Button size={56} variant="secondary" onClick={reset}>{t('mgmt.stopEditing')}</Button> : null}
          </div>
        </div>

        <aside style={{ flex: '0 1 340px', minWidth: 0, width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={{ fontSize: 13, color: '#5E5852', lineHeight: 1.4 }}>
            {previewTo ? t('mgmt.previewFor', { name: previewTo.name, tpl: tpl ? tplTitle(tpl) : '' }) : t('mgmt.previewNobody')}
          </span>
          {recipients.length > 1 ? (
            <Select label={t('mgmt.previewPick')} value={previewTo?.key ?? ''} onChange={setPreviewKey} searchable
              options={recipients.map((r) => ({ value: r.key, label: `${r.name} · ${t('mgmt.aud_' + r.audience)}` }))} />
          ) : null}
          <div style={{ borderRadius: 14, background: '#E6DDD1', padding: 14, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <div style={{ maxWidth: '92%', background: '#FFFFFF', borderRadius: 10, padding: '12px 14px 8px', display: 'flex', flexDirection: 'column', gap: 6, boxShadow: '0 1px 2px rgba(40,30,20,0.1)' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#3D6B4F', lineHeight: 1.4 }}>CitraPremier</span>
              <span data-testid="bc-preview" style={{ fontSize: 15, lineHeight: 1.45, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{bubble}</span>
              <span style={{ alignSelf: 'flex-end', fontSize: 12, color: '#5E5852' }}>{now}</span>
              <div style={{ borderTop: '1px solid #F0EAE1', paddingTop: 8, textAlign: 'center', fontSize: 14, fontWeight: 500, color: '#75624B', lineHeight: 1.4 }}>{t('mgmt.openApp')}</div>
            </div>
          </div>
          <span style={{ fontSize: 12, color: '#6B6259', lineHeight: 1.4 }}>{t('mgmt.simNote')}</span>
        </aside>
      </div>

      <ListCard title={t('mgmt.sentAndScheduled')}>
        {rows.length ? paged.rows.map((b) => {
          const tp = tpls.find((x) => x.key === b.template);
          const title = `${tp ? tplTitle(tp) : t('mgmt.tplTitle_custom')}: ${b.message}`;
          const sub = `${b.audiences.map((a) => t('mgmt.aud_' + a)).join(', ')} · ${tn(t, 'mgmt.nPeople', b.recipients)} · ${b.status === 'scheduled' ? t('mgmt.scheduledFor', { when: whenText(b.sendAt) }) : b.status === 'sent' ? t('mgmt.sentOn', { when: whenText(b.sentAt || b.sendAt) }) : t('mgmt.wasFor', { when: whenText(b.sendAt) })}`;
          return (
            <Fragment key={b.id}>
              <div data-bc={b.status} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '16px 0', borderTop: '1px solid #F0EAE1', minHeight: 64 }}>
                <div style={{ flex: '1 1 220px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.35, overflowWrap: 'anywhere' }}>{title}</span>
                  <span style={{ fontSize: 14, color: '#6B6259', lineHeight: 1.4 }}>{sub}</span>
                </div>
                {b.status === 'scheduled' ? (
                  <>
                    <Button size={44} variant="secondary" icon="edit" onClick={() => edit(b)}>{t('common.edit')}</Button>
                    <Button size={44} variant="secondary" icon="cancel_schedule_send" onClick={() => cancel(b)}>{t('mgmt.cancelSend')}</Button>
                  </>
                ) : null}
                <BadgePill kind={b.status === 'sent' ? 'paid' : b.status === 'scheduled' ? 'pending' : 'void'} label={t('mgmt.st_' + b.status)} />
              </div>
            </Fragment>
          );
        }) : <div style={{ padding: '14px 0 16px', borderTop: '1px solid #F0EAE1', fontSize: 15, color: '#6B6259' }}>{t('mgmt.bcEmpty')}</div>}
        <Pager page={paged.page} pages={paged.pages} onPage={paged.setPage} label={t('mgmt.pgBroadcasts')} />
      </ListCard>
      <TemplatesDialog open={tplOpen} onClose={() => setTplOpen(false)} tpls={tpls} tplTitle={tplTitle} tplText={tplText} />
    </Page>
  );
}

/** Edit the WhatsApp templates (title and text with {name} and {msg}), add your own, remove your own. */
function TemplatesDialog({ open, onClose, tpls, tplTitle, tplText }: { open: boolean; onClose: () => void; tpls: TplRow[]; tplTitle: (x: TplRow) => string; tplText: (x: TplRow) => string }) {
  const t = useT();
  const act = useAct();
  const [form, setForm] = useState<{ id?: string; key?: string; title: string; text: string } | null>(null);
  const [confirm, setConfirm] = useState(false);
  const paged = usePaged(tpls, 5);
  const close = () => { setForm(null); setConfirm(false); onClose(); };
  const valid = !!form && form.title.trim() !== '' && form.text.includes('{msg}');
  const save = async () => {
    if (!form || !valid) return;
    const r = await act('template.upsert', { ...(form.id ? { id: form.id } : {}), title: form.title.trim(), text: form.text.trim() }, { ok: t('mgmt.tplSaved') });
    if (r.ok) setForm(null);
  };
  const remove = async () => {
    if (!form?.id) return;
    const r = await act('template.remove', { id: form.id }, { ok: t('mgmt.tplRemoved') });
    if (r.ok) { setForm(null); setConfirm(false); }
  };
  return (
    <Dialog open={open} onClose={close} eyebrow={t('mgmt.template')} title={t('mgmt.editTemplates')} maxWidth={600}
      footer={form ? (
        <>
          {form.id && form.key === 'custom' ? (confirm ? <Button variant="danger" onClick={remove}>{t('mgmt.tplConfirmRemove')}</Button> : <Button variant="secondary" onClick={() => setConfirm(true)}>{t('common.delete')}</Button>) : null}
          <Button variant="secondary" onClick={() => { setForm(null); setConfirm(false); }}>{t('common.cancel')}</Button>
          <Button disabled={!valid} onClick={save}>{t('common.save')}</Button>
        </>
      ) : <Button variant="secondary" onClick={close}>{t('common.close')}</Button>}>
      {form ? (
        <>
          <TextField label={t('mgmt.tplName')} value={form.title} onChange={(v) => setForm({ ...form, title: v })} />
          <TextField label={t('mgmt.tplBody')} multiline rows={5} value={form.text} onChange={(v) => setForm({ ...form, text: v })} error={form.text && !form.text.includes('{msg}') ? t('mgmt.err.tplMsg') : false} hint={t('mgmt.tplHint')} />
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {paged.rows.map((x) => (
            <div key={x.id} style={{ borderTop: '1px solid #F0EAE1', padding: '14px 0 4px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 16, fontWeight: 500 }}>{tplTitle(x)}</span>
                <span style={{ fontSize: 14, color: '#6B6259', lineHeight: '20px', overflowWrap: 'anywhere' }}>{tplText(x)}</span>
              </div>
              <Button size={44} variant="secondary" onClick={() => setForm({ id: x.id, key: x.key, title: tplTitle(x), text: tplText(x) })}>{t('common.edit')}</Button>
            </div>
          ))}
          <Pager page={paged.page} pages={paged.pages} onPage={paged.setPage} label={t('mgmt.pgTemplates')} />
          <div><Button variant="secondary" icon="add" onClick={() => setForm({ title: '', text: t('mgmt.tplNewText') })}>{t('mgmt.tplNew')}</Button></div>
        </div>
      )}
    </Dialog>
  );
}
