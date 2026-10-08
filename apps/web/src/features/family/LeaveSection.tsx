// Leave (cuti, the brochure's terms): the months of leave a member has asked for, the "Ask for leave" button with its sheet, and the word the club waits for
// after 2 months. Used by the family plan card (the billing contact asks, takes back and confirms) and by the profile's Plan tab (finance and management record it).
import { useState, type ReactNode } from 'react';
import { currentMembership, feeOf, issueDateOf, leaveChoices, leaveDeadline, leaveMonths, leaveNeedsWord, leaveOpen, LEAVE_MAX_MONTHS, memberShort, membershipStatus, priceOn, rp, ym, type ClubState, type Member } from '@cp/shared';
import { Button, ChipGroup, Icon, Sheet, TextField } from '../../components/ui';
import type { TFn, useFmt } from '../../lib/i18n';
import type { useAct } from '../../lib/act';

interface Args {
  s: ClubState;
  m: Member;
  today: string;
  t: TFn;
  fmt: ReturnType<typeof useFmt>;
  act: ReturnType<typeof useAct>;
  /** may ask, take back and confirm: the billing contact (family), finance and management (staff) */
  canEdit: boolean;
  /** staff record what the family asked for in writing: a note field and "Record" wording */
  staff?: boolean;
}
/** The pieces of the leave UI as nodes, so the caller places the button beside its own buttons: `rows` (months and the word), `button` and its `sheet`. */
export function useLeaveUi({ s, m, today, t, fmt, act, canEdit, staff }: Args): { rows: ReactNode; button: ReactNode; sheet: ReactNode; any: boolean } {
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const months = leaveMonths(m).filter((x) => x >= ym(today));
  const word = leaveNeedsWord(m, today);
  const choices = leaveChoices(s, m, today);
  const firstOk = choices.find((c) => c.ok)?.month ?? '';
  const chosen = choices.find((c) => c.month === (pick || firstOk) && c.ok)?.month ?? '';
  const active = membershipStatus(m, today) !== 'ended' && !currentMembership(m)?.lastDay;
  const feeOn = (month: string) => rp(feeOf(priceOn(s, issueDateOf(s, month)), 'leave'));
  const text = { fontSize: 15, lineHeight: '22px', color: '#24201C' } as const;
  const name = memberShort(m);

  const rows = months.length || word ? (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-testid="leave">
      {months.map((month) => {
        const now = month === ym(today);
        const asked = !now && leaveOpen(month, today);
        const label = now ? t('family.leaveNow', { m: fmt.fmonth(month) })
          : asked ? t(staff ? 'family.leaveOpenStaff' : 'family.leaveOpen', { m: fmt.fmonth(month), d: fmt.fds(leaveDeadline(month)) })
          : t('family.leaveLocked', { m: fmt.fmonth(month), fee: feeOn(month) });
        return (
          <div key={month} data-testid="leave-row" data-month={month} style={{ display: 'flex', alignItems: 'center', gap: 8, ...text }}>
            <Icon name="beach_access" size={20} color="#7A5510" fill={1} />
            <span style={{ flex: 1, minWidth: 0 }}>{label}</span>
            {asked && canEdit ? <Button variant="ghost" size={44} onClick={() => act('membership.withdrawLeave', { memberId: m.id, month }, { ok: t('family.leaveTakenBack', { m: fmt.fmonth(month) }) })}>{t('family.leaveTakeBack')}</Button> : null}
          </div>
        );
      })}
      {word ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-testid="leave-word">
          <div style={{ ...text, color: '#7A5510' }}>{t('family.leaveWord', { n: name, d: fmt.fds(word.deadline), m: fmt.fmonth(word.after) })}</div>
          {canEdit ? <div><Button variant="secondary" size={44} icon="event_available" onClick={() => act('membership.confirmReturn', { memberId: m.id }, { ok: t('family.leaveBackSent', { n: name, m: fmt.fmonth(word.after) }) })}>{t('family.leaveBack', { m: fmt.fmonth(word.after) })}</Button></div> : null}
        </div>
      ) : null}
    </div>
  ) : null;

  const send = async () => {
    if (!chosen || busy) return;
    setBusy(true);
    try {
      const r = await act('membership.requestLeave', { memberId: m.id, month: chosen, ...(staff && note.trim() ? { note: note.trim() } : {}) }, { ok: t(staff ? 'family.leaveRecorded' : 'family.leaveSent', { m: fmt.fmonth(chosen) }) });
      if (r.ok) { setOpen(false); setPick(''); setNote(''); }
    } finally { setBusy(false); }
  };
  const button = canEdit && active ? (
    <Button variant="secondary" size={44} icon="beach_access" onClick={() => setOpen(true)}>{t(staff ? 'family.leaveRecord' : 'family.leaveAsk')}</Button>
  ) : null;
  const sheet = canEdit && active ? (
    <Sheet open={open} onClose={() => setOpen(false)} title={t(staff ? 'family.leaveRecordTitle' : 'family.leaveTitle', { name })}
      footer={<Button size={56} full disabled={!chosen || busy} onClick={send}>{chosen ? t(staff ? 'family.leaveRecordSend' : 'family.leaveSend', { m: fmt.fmonth(chosen) }) : t('family.leaveNone')}</Button>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontSize: 15, lineHeight: '24px' }}>{t(staff ? 'family.leaveBodyStaff' : 'family.leaveBody', { fee: feeOn(choices[0]?.month ?? ym(today)), max: LEAVE_MAX_MONTHS })}</div>
        {choices.length ? (
          <ChipGroup label={t('family.leaveWhich')} value={chosen || null} onChange={(v) => { const c = choices.find((x) => x.month === v); if (c?.ok) setPick(String(v)); }}
            options={choices.map((c) => ({ value: c.month, label: t('family.leaveChoice', { m: fmt.fmonth(c.month), d: fmt.fds(c.deadline) }), off: !c.ok }))} />
        ) : null}
        {staff ? <TextField label={t('family.leaveNote')} value={note} onChange={setNote} placeholder={t('family.leaveNotePh')} maxLength={200} /> : null}
      </div>
    </Sheet>
  ) : null;
  return { rows, button, sheet, any: !!rows };
}
