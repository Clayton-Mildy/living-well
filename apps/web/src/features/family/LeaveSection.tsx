// Leave (cuti, the brochure's terms): the months of leave a member has asked for, the "Ask for leave" button with its sheet, and the word the club waits for
// after 2 months. Used by the family plan card (the billing contact asks, takes back and confirms) and by the profile's Plan tab (finance and management record it).
import { useState, type ReactNode } from 'react';
import { currentMembership, feeOf, issueDateOf, leaveChoices, leaveDeadline, leaveMonths, leaveNeedsWord, leaveOpen, LEAVE_MAX_MONTHS, displayName, membershipStatus, priceOn, rp, ym, type ClubState, type Member } from '@cp/shared';
import { Button, ChipGroup, Icon, Sheet, TextField } from '../../components/ui';
import type { TFn, useFmt } from '../../lib/i18n';
import type { useAct } from '../../lib/act';
import { F, FamSheet, HAIR, TextLink } from './kit';

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
  const name = displayName(m);

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

/**
 * The same leave rules in the family app's look (round 8): `rows` (the months of leave and the word the club waits for, as quiet lines),
 * `link` (the bronze "Ask for leave" text) and its `sheet` (Cancel · title · Send, the months as a radio list). Only the billing contact (`canEdit`)
 * may ask, take back and confirm; everyone else only reads the rows.
 */
export function useFamilyLeave({ s, m, today, t, fmt, act, canEdit }: Omit<Args, 'staff'>): { rows: ReactNode; link: ReactNode; sheet: ReactNode } {
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState('');
  const [busy, setBusy] = useState(false);
  const months = leaveMonths(m).filter((x) => x >= ym(today));
  const word = leaveNeedsWord(m, today);
  const choices = leaveChoices(s, m, today);
  const firstOk = choices.find((c) => c.ok)?.month ?? '';
  const chosen = choices.find((c) => c.month === (pick || firstOk) && c.ok)?.month ?? '';
  const active = membershipStatus(m, today) !== 'ended' && !currentMembership(m)?.lastDay;
  const feeOn = (month: string) => rp(feeOf(priceOn(s, issueDateOf(s, month)), 'leave'));
  const name = displayName(m);
  const line = { fontSize: 14, lineHeight: '20px', color: F.text } as const;

  const rows = months.length || word ? (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }} data-testid="leave">
      {months.map((month) => {
        const now = month === ym(today);
        const asked = !now && leaveOpen(month, today);
        const label = now ? t('family.leaveNow', { m: fmt.fmonth(month) })
          : asked ? t('family.leaveOpen', { m: fmt.fmonth(month), d: fmt.fds(leaveDeadline(month)) })
          : t('family.leaveLocked', { m: fmt.fmonth(month), fee: feeOn(month) });
        return (
          <div key={month} data-testid="leave-row" data-month={month} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, ...line }}>
            <Icon name="beach_access" size={18} color={F.ochre} fill={1} style={{ marginTop: 1 }} />
            <span style={{ flex: 1, minWidth: 0 }}>{label}</span>
            {asked && canEdit ? <TextLink size={14} style={{ minHeight: 20 }} onClick={() => void act('membership.withdrawLeave', { memberId: m.id, month }, { ok: t('family.leaveTakenBack', { m: fmt.fmonth(month) }) })}>{t('family.leaveTakeBack')}</TextLink> : null}
          </div>
        );
      })}
      {word ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }} data-testid="leave-word">
          <div style={{ ...line, color: F.ochre }}>{t('family.leaveWord', { n: name, d: fmt.fds(word.deadline), m: fmt.fmonth(word.after) })}</div>
          {canEdit ? <TextLink size={14} onClick={() => void act('membership.confirmReturn', { memberId: m.id }, { ok: t('family.leaveBackSent', { n: name, m: fmt.fmonth(word.after) }) })}>{t('family.leaveBack', { m: fmt.fmonth(word.after) })}</TextLink> : null}
        </div>
      ) : null}
    </div>
  ) : null;

  const send = async () => {
    if (!chosen || busy) return;
    setBusy(true);
    try {
      const r = await act('membership.requestLeave', { memberId: m.id, month: chosen }, { ok: t('family.leaveSent', { m: fmt.fmonth(chosen) }) });
      if (r.ok) { setOpen(false); setPick(''); }
    } finally { setBusy(false); }
  };
  const link = canEdit && active ? <TextLink onClick={() => setOpen(true)} testId="leave-ask">{t('family.leaveAsk')}</TextLink> : null;
  const sheet = canEdit && active ? (
    <FamSheet open={open} onClose={() => setOpen(false)} title={t('family.leaveTitle', { name })} testId="leave-sheet" action={{ label: t('fam.send'), onClick: () => void send(), disabled: !chosen || busy }}>
      <div style={{ fontSize: 15, lineHeight: '22px', color: F.soft }}>{t('family.leaveBody', { fee: feeOn(choices[0]?.month ?? ym(today)), max: LEAVE_MAX_MONTHS })}</div>
      {choices.length ? (
        <div role="radiogroup" aria-label={t('family.leaveWhich')} style={{ background: F.fill, borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {choices.map((c, i) => {
            const on = c.ok && c.month === chosen;
            return (
              <button key={c.month} type="button" role="radio" aria-checked={on} aria-disabled={!c.ok} data-month={c.month} onClick={() => { if (c.ok) setPick(c.month); }} className="cp-fam-press"
                style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 52, padding: '0 14px', border: 'none', borderTop: i ? HAIR : 'none', background: 'transparent', textAlign: 'left', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 16, color: c.ok ? F.text : F.muted, opacity: c.ok ? 1 : 0.55, cursor: c.ok ? 'pointer' : 'default' }}>
                <span style={{ flex: 1, minWidth: 0 }}>{t('family.leaveChoice', { m: fmt.fmonth(c.month), d: fmt.fds(c.deadline) })}</span>
                {on ? <Icon name="check_circle" size={24} fill={1} color={F.ink} /> : null}
              </button>
            );
          })}
        </div>
      ) : <div style={{ fontSize: 15, color: F.muted }}>{t('family.leaveNone')}</div>}
    </FamSheet>
  ) : null;
  return { rows, link, sheet };
}
