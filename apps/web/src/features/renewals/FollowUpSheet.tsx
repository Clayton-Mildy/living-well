// Renewals (KC round 7): follow up one member. The family contact with Call / WhatsApp, the plan and this month's days, the outcome Caca records
// (continue, upgrade or downgrade, leave, stop, no answer, call back) with its extra fields, a note, and below it the call history. A change by anyone but
// management is sent for approval; the sheet says where a record stands (waiting, not approved, applied). A pushed full screen on phones, a bottom sheet elsewhere.
import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { actorName, flexMonth, fmtPhone, memberName, memberShort, monthStart, waUrl, ym, type FollowUpOutcome, type YM } from '@cp/shared';
import { END_REASONS } from '@cp/shared/rules/members';
import { defaultLastDay, followUpOf, isApplied, isChange, lastDayOfMonth, leaveMonthChoices, leaveMonthsCheck, outcomeChoices, renewalRows } from '@cp/shared/rules/renewals';
import { Avatar, Button, Chip, DateField, GROUP_HEAD, Icon, Note, PhoneScreen, Select, Sheet, TextField } from '../../components/ui';
import { useDevice } from '../../hooks/useDevice';
import { useAct } from '../../lib/act';
import { useNow } from '../../lib/clock';
import { useFmt, useT } from '../../lib/i18n';
import { memberPhoto } from '../../lib/media';
import { useMe } from '../../lib/me';
import { useClub } from '../../store/replica';
import { relLabel, whenText } from '../members/lib';
import { outcomeLabel, planLabel } from './lib';

const HAIR = '1px solid #EFEAE3';
const short = { day: 'numeric', month: 'short' } as const;
const pill: CSSProperties = { height: 36, padding: '0 14px 0 12px', borderRadius: 999, border: '1px solid #DCD3C8', background: '#FFFFFF', color: '#24201C', fontSize: 14, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none', fontFamily: 'Inter', whiteSpace: 'nowrap' };

export function FollowUpSheet({ memberId, month, onClose }: { memberId: string; month: YM; onClose: () => void }) {
  const s = useClub();
  const t = useT();
  const fmt = useFmt();
  const act = useAct();
  const navigate = useNavigate();
  const { today } = useNow();
  const { isPhone } = useDevice();
  const { role } = useMe();
  const m = s.members[memberId];
  const row = useMemo(() => renewalRows(s, month).find((r) => r.m.id === memberId), [s, month, memberId]);
  const f = row?.f ?? followUpOf(s, memberId, month);
  const past = month <= ym(today);
  const applied = isApplied(f);
  const editable = !past && !applied;
  const mgmt = role === 'mgmt';

  // the form: what the family decided, and what that outcome needs
  const [outcome, setOutcome] = useState<FollowUpOutcome | null>(() => (f && f.status !== 'rejected' && f.outcome && f.outcome !== 'noAnswer' && f.outcome !== 'callBack' ? f.outcome : null));
  const firstLeave = useMemo(() => leaveMonthChoices(month).find((x) => m && leaveMonthsCheck(s, m, [x], today).ok), [s, m, month, today]);
  const [leaveSel, setLeaveSel] = useState<YM[]>(() => f?.leaveMonths ?? (firstLeave ? [firstLeave] : []));
  const [lastDay, setLastDay] = useState(() => f?.lastDay ?? defaultLastDay(month));
  const [reason, setReason] = useState<string>(() => f?.endReason ?? 'familyDecision');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  if (!m || !row) return null;

  const first = monthStart(month);
  const fm = flexMonth(s, m, ym(today), today);
  const leaveCheck = outcome === 'leave' ? leaveMonthsCheck(s, m, leaveSel, today) : null;
  const stopOk = outcome !== 'stop' || (/^\d{4}-\d{2}-\d{2}$/.test(lastDay) && lastDay >= today && lastDay <= lastDayOfMonth(month));
  const canSave = editable && !!outcome && (!leaveCheck || leaveCheck.ok) && stopOk && !busy;
  const needsOk = !!outcome && isChange(outcome) && !mgmt;

  const save = async () => {
    if (!outcome || !canSave) return;
    setBusy(true);
    const input = { memberId, month, outcome, ...(note.trim() ? { note: note.trim() } : {}), ...(outcome === 'leave' ? { leaveMonths: leaveSel } : {}), ...(outcome === 'stop' ? { lastDay, endReason: reason } : {}) };
    const name = memberShort(m);
    const r = await act('followUp.record', input, { ok: (res) => (res.status === 'done' && isChange(outcome) ? t('renewals.savedApplied', { name, date: first }) : t('renewals.saved', { name })) });
    setBusy(false);
    if (r.ok) onClose();
  };

  const toggleLeave = (mo: YM) => setLeaveSel((x) => (x.includes(mo) ? x.filter((y) => y !== mo) : [...x, mo].sort()));
  /** a titled box (a plain function, not a component: a component defined here would remount its inputs on every keystroke) */
  const Section = (title: ReactNode, children: ReactNode, pad: string | number = '14px 16px') => (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      <h2 style={{ ...GROUP_HEAD, padding: '0 16px' }}>{title}</h2>
      <div style={{ background: isPhone ? '#FFFFFF' : '#FAF8F5', borderRadius: 14, overflow: 'hidden', padding: pad, display: 'flex', flexDirection: 'column', gap: pad === 0 ? 0 : 12 }}>{children}</div>
    </section>
  );

  // ----- pieces
  const c = row.contact;
  const contact = Section(t('renewals.group.contact'), (
      c ? (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span style={{ fontSize: 16, fontWeight: 500, lineHeight: '22px' }}>{c.name}{row.relation ? ` · ${relLabel(t, row.relation)}` : ''}</span>
            <span style={{ fontSize: 13, color: '#6B6259', fontVariantNumeric: 'tabular-nums' }}>{fmtPhone(c.phone)}</span>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <a href={`tel:${c.phone}`} className="cp-press" style={pill}><Icon name="call" size={18} />{t('common.call')}</a>
            <a href={waUrl(c.phone)} target="_blank" rel="noreferrer" className="cp-press" style={pill}><Icon name="chat" size={18} />{t('renewals.whatsapp')}</a>
          </div>
        </>
      ) : <span style={{ fontSize: 15, color: '#6B6259' }}>{t('renewals.noContact')}</span>
  ));
  const usage = row.plan === 'flex' || fm.quota !== null
    ? `${t('renewals.usageFlex', { used: Math.min(fm.used, fm.quota ?? fm.used), quota: fm.quota ?? 0 })}${fm.extra ? t('renewals.usageExtra', { n: fm.extra }) : ''}`
    : t('renewals.usageGold', { n: fm.used });
  const line = (label: string, value: string) => (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, fontSize: 15, lineHeight: '22px' }}><span style={{ color: '#6B6259' }}>{label}</span><span style={{ fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{value}</span></div>
  );
  const membership = Section(t('renewals.group.membership'), (
    <>
      {line(t('renewals.plan'), planLabel(t, row.plan))}
      {line(t('renewals.usage'), usage)}
    </>
  ));

  // where the record stands
  const status: ReactNode[] = [];
  if (f?.status === 'pending') {
    status.push(
      <Note key="w" tone="ochre" icon="hourglass_top">
        {t('renewals.st.waiting', { who: f.approval ? actorName(s, f.approval.by) : '' })}
        {mgmt ? <div style={{ marginTop: 6 }}><button type="button" className="cp-press" onClick={() => { onClose(); navigate('/reviews?tab=renewals'); }} style={{ border: 'none', background: 'transparent', padding: 0, color: '#75624B', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter', textDecoration: 'underline', textUnderlineOffset: 3 }}>{t('renewals.st.review')}</button></div> : null}
      </Note>,
    );
  }
  if (f?.status === 'rejected') status.push(<Note key="r" tone="rust" icon="block">{t('renewals.st.rejected', { reason: f.approval?.reason || '' })}</Note>);
  if (applied && f) status.push(<Note key="a" tone="sage" icon="task_alt">{f.outcome === 'stop' ? t('renewals.st.appliedStop', { date: f.lastDay ?? '' }) : t('renewals.st.applied', { date: first })}</Note>);
  if (row.asked) status.push(<Note key="k" tone="sage" icon="smartphone">{row.asked === 'plan' ? t('renewals.st.askedPlan') : t('renewals.st.askedLeave', { month: fmt.fmonth(month) })}</Note>);

  const choices = outcomeChoices(row.planOnFirst);
  const leaveMonthsBox = outcome === 'leave' ? (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={{ fontSize: 13, fontWeight: 500, color: '#4A4038' }}>{t('renewals.leaveMonths')}</span>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {leaveMonthChoices(month).map((mo) => {
          const ok = leaveMonthsCheck(s, m, [mo], today);
          return <Chip key={mo} size={40} selected={leaveSel.includes(mo)} off={!ok.ok} onClick={() => toggleLeave(mo)}>{fmt.fmonth(mo, true)}</Chip>;
        })}
      </div>
      {leaveMonthChoices(month).map((mo) => {
        const ok = leaveMonthsCheck(s, m, [mo], today);
        if (ok.ok) return null;
        return <span key={mo} style={{ fontSize: 13, color: '#6B6259', lineHeight: '19px' }}>{ok.code === 'err.leaveLate' ? t('renewals.leaveLate', { month: fmt.fmonth(mo), date: fmt.fd(String(ok.params?.deadline ?? ''), short) }) : t(ok.code, { ...ok.params, month: fmt.fmonth(mo) })}</span>;
      })}
      {leaveCheck && !leaveCheck.ok && leaveSel.length ? <Note tone="rust" icon="error">{t(leaveCheck.code, leaveCheck.params)}</Note> : null}
    </div>
  ) : null;
  const stopBox = outcome === 'stop' ? (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <DateField label={t('renewals.lastDay')} value={lastDay} onChange={setLastDay} min={today} max={lastDayOfMonth(month)} error={stopOk ? false : t('members.err.lastDayPast')} />
      <Select label={t('renewals.reason')} value={reason} onChange={setReason} options={END_REASONS.map((r) => ({ value: r, label: t(`profile.endReason.${r}`) }))} />
    </div>
  ) : null;
  const decision = editable ? Section(t('renewals.group.outcome', { month: fmt.fmonth(month, true) }), (
    <>
      <div role="group" aria-label={t('renewals.group.outcome', { month: fmt.fmonth(month, true) })} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {choices.map((o) => <Chip key={o} size={40} selected={outcome === o} onClick={() => setOutcome(o)}>{outcomeLabel(t, o)}</Chip>)}
      </div>
      {leaveMonthsBox}
      {stopBox}
      <TextField label={t('common.note')} value={note} onChange={setNote} multiline rows={2} placeholder={t('renewals.notePh')} maxLength={400} />
    </>
  )) : null;

  const calls = [...(f?.calls ?? [])].reverse();
  const history = Section(t('renewals.group.calls'), (
    <>
      {calls.length ? calls.map((call, i) => (
        <div key={call.at + i} style={{ padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 2, borderTop: i ? HAIR : 'none', margin: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 500, lineHeight: '22px' }}>{outcomeLabel(t, call.outcome)}</span>
            <span style={{ fontSize: 13, color: '#6B6259', whiteSpace: 'nowrap' }}>{whenText(fmt.fds, today, call.at, t)}</span>
          </div>
          <span style={{ fontSize: 13, color: '#6B6259' }}>{actorName(s, call.by)}</span>
          {call.note ? <span style={{ fontSize: 15, lineHeight: '21px', overflowWrap: 'anywhere' }}>{call.note}</span> : null}
        </div>
      )) : <div style={{ padding: '14px 16px', fontSize: 15, color: '#6B6259' }}>{t('renewals.calls.none')}</div>}
    </>
  ), 0);

  const title = t('renewals.sheetTitle', { name: memberShort(m) });
  const body = (
    <>
      {isPhone ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar name={memberName(m)} tone={m.photoTone} src={memberPhoto(m)} size={48} />
          <h1 style={{ margin: 0, fontSize: 24, lineHeight: '28px', fontWeight: 400, letterSpacing: '-0.6px', color: '#2B231C', minWidth: 0, overflowWrap: 'anywhere' }}>{title}</h1>
        </div>
      ) : null}
      {status}
      {contact}
      {membership}
      {decision}
      {history}
    </>
  );
  const saveBtn = editable ? (
    isPhone
      ? <button type="button" className="cp-press" aria-disabled={!canSave || undefined} onClick={canSave ? save : undefined} style={{ width: '100%', height: 50, borderRadius: 999, border: 'none', background: canSave ? '#24201C' : '#EDE5DA', color: canSave ? '#FFFFFF' : '#8A8078', fontSize: 16, fontWeight: 500, cursor: canSave ? 'pointer' : 'not-allowed', fontFamily: 'Inter' }}>{needsOk ? t('renewals.saveApproval') : t('renewals.save')}</button>
      : <Button size={48} icon={needsOk ? 'send' : 'check'} disabled={!canSave} onClick={save}>{needsOk ? t('renewals.saveApproval') : t('renewals.save')}</Button>
  ) : undefined;

  if (isPhone) return <PhoneScreen open onClose={onClose} label={title} back={t('renewals.title')} footer={saveBtn}>{body}</PhoneScreen>;
  return <Sheet open onClose={onClose} title={title} footer={saveBtn}>{body}</Sheet>;
}
