// Next month (KC round 7 "Renewals", round 14): what the club decides for the coming month. Two tabs under the month: Changes (what the front desk recorded
// after talking to a family: a plan switch, leave or a stop, each in effect at once and dated from the 1st; "Record a change" adds one, Undo takes one back until
// the month starts) and Unpaid (the month's unpaid invoices). Past months are a read-only log of their changes.
import { useMemo, useState, type CSSProperties } from 'react';
import { useSearchParams } from 'react-router-dom';
import { listName, addMonths, actorName, memberName, displayName, ym, type YM } from '@cp/shared';
import { canRecord, changeRows, renewalMembers, renewalMonth } from '@cp/shared/rules/renewals';
import { Avatar, EmptyState, Icon, IconButton, PageHead, Segmented } from '../../components/ui';
import { padFor, useDevice } from '../../hooks/useDevice';
import { useNow } from '../../lib/clock';
import { useFmt, useT } from '../../lib/i18n';
import { memberPhoto } from '../../lib/media';
import { useAct } from '../../lib/act';
import { useClub } from '../../store/replica';
import { ConfirmDialog } from '../kitchen/parts';
import { FollowUpSheet } from './FollowUpSheet';
import { UnpaidList } from './UnpaidList';
import { changeText } from './lib';

type Tab = 'changes' | 'unpaid';
const dm = { day: 'numeric', month: 'short' } as const;
const pill: CSSProperties = { height: 44, padding: '0 14px', borderRadius: 999, border: 'none', background: 'var(--fill, #F4F4F5)', color: '#24201C', display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 14, fontWeight: 500, fontFamily: 'Inter', whiteSpace: 'nowrap', flex: 'none', cursor: 'pointer' };

export function Renewals() {
  const s = useClub();
  const t = useT();
  const fmt = useFmt();
  const act = useAct();
  const { today } = useNow();
  const { device, isPhone } = useDevice();
  const maxMonth = renewalMonth(today);
  /** the earliest month that has a log: the current month at least, so last month's log is one tap away once the month turns */
  const minMonth = useMemo(() => Object.values(s.followUps ?? {}).reduce((lo, f) => (f.month < lo ? f.month : lo), ym(today)), [s.followUps, today]);
  const [picked, setPicked] = useState<YM | null>(null);
  const month: YM = picked && picked >= minMonth && picked <= maxMonth ? picked : maxMonth;
  const past = month <= ym(today);
  // the tab is in the address (`?tab=unpaid`: the Month report's Outstanding and the Unpaid duty open it)
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get('tab') === 'unpaid' ? 'unpaid' : 'changes';
  const setTab = (v: Tab) => setParams(v === 'unpaid' ? { tab: 'unpaid' } : {}, { replace: true });
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  /** the member whose change is about to be undone (Undo asks first: the family is told at once) */
  const [undoing, setUndoing] = useState<string | null>(null);

  const rows = useMemo(() => changeRows(s, month, today), [s, month, today]);
  /** there is still someone a change can be recorded for */
  const canAdd = !past && renewalMembers(s, month).some((m) => canRecord(s, m, month, today));

  const undo = async (memberId: string) => {
    setUndoing(null);
    if (busy) return;
    setBusy(memberId);
    const m = s.members[memberId];
    await act('followUp.undo', { memberId, month }, { ok: t('renewals.undone', { name: m ? displayName(m) : '' }) });
    setBusy(null);
  };

  const switcher = (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <IconButton icon="chevron_left" label={t('renewals.prevMonth')} size={40} onClick={month <= minMonth ? undefined : () => setPicked(addMonths(month, -1))} style={month <= minMonth ? { opacity: 0.35, cursor: 'default' } : undefined} />
      <IconButton icon="chevron_right" label={t('renewals.nextMonth')} size={40} onClick={month >= maxMonth ? undefined : () => setPicked(addMonths(month, 1))} style={month >= maxMonth ? { opacity: 0.35, cursor: 'default' } : undefined} />
    </div>
  );
  const tabs = <Segmented label={t('renewals.title')} value={tab} onChange={setTab} cols={isPhone ? 2 : undefined} items={[{ value: 'changes', label: t('renewals.tabChanges') }, { value: 'unpaid', label: t('renewals.tabUnpaid') }]} />;

  const rowEl = (r: (typeof rows)[number], i: number) => {
    const m = s.members[r.memberId];
    if (!m) return null;
    const name = listName(m);
    const what = changeText(t, fmt, r.outcome, r.leaveMonths);
    const when = [t('renewals.from', { d: fmt.fd(r.from, dm) }), r.by ? t('renewals.recordedBy', { who: actorName(s, r.by) }) : ''].filter(Boolean).join(' · ');
    return (
      <div key={`${r.memberId}-${r.outcome}`} data-change={r.memberId} className="cp-tap"
        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: isPhone ? '10px 16px' : '12px 0', fontFamily: 'Inter', color: '#24201C', borderTop: i && !isPhone ? '0.5px solid var(--hairline, #E2E2E6)' : 'none', backgroundImage: i && isPhone ? 'linear-gradient(var(--hairline, #E2E2E6), #E2E2E6)' : 'none', backgroundSize: 'calc(100% - 70px) 0.5px', backgroundPosition: 'right top', backgroundRepeat: 'no-repeat' }}>
        <Avatar name={memberName(m)} member={m} tone={m.photoTone} src={memberPhoto(m)} size={42} />
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span style={{ fontSize: 16, lineHeight: '22px', fontWeight: 500, overflowWrap: 'anywhere' }}>{name}</span>
          <span data-testid="change-what" style={{ fontSize: 14, lineHeight: '20px', overflowWrap: 'anywhere' }}>{what}</span>
          <span data-testid="change-when" style={{ fontSize: 13, lineHeight: '19px', color: '#6B6259' }}>{when}</span>
        </span>
        {r.canUndo && !r.readOnly ? <button type="button" data-testid="change-undo" aria-label={`${t('renewals.undo')} ${name}`} disabled={!!busy} onClick={() => setUndoing(r.memberId)} className="cp-press cp-fill" style={pill}><Icon name="undo" size={17} />{t('renewals.undo')}</button> : null}
      </div>
    );
  };

  const list = rows.length
    ? <div className="cp-grey" style={{ background: 'var(--fill, #F4F4F5)', borderRadius: 16, overflow: 'hidden', padding: isPhone ? 0 : '4px clamp(18px, 3vw, 28px)' }}>{rows.map(rowEl)}</div>
    : <EmptyState icon="event_repeat" title={t('renewals.noChanges', { month: fmt.fmonth(month) })} />;

  return (
    <div className={isPhone ? 'cp-native' : undefined} style={{ padding: padFor(device), display: 'flex', flexDirection: 'column', gap: isPhone ? 14 : 22 }}>
      <PageHead size={40} eyebrow={fmt.fmonth(month, true)} title={t('renewals.title')} right={tab === 'changes' ? switcher : undefined} />
      {tabs}
      {tab === 'changes' ? (
        <>
          {canAdd ? (
            <div style={{ display: 'flex' }}>
              <button type="button" data-testid="record-change" onClick={() => setRecording(true)} className="cp-press" style={{ ...pill, background: '#24201C', color: '#FFFFFF' }}><Icon name="add" size={18} />{t('renewals.record')}</button>
            </div>
          ) : null}
          {list}
        </>
      ) : <UnpaidList />}
      {recording ? <FollowUpSheet month={month} onClose={() => setRecording(false)} /> : null}
      <ConfirmDialog open={!!undoing} onClose={() => setUndoing(null)} title={t('renewals.undoTitle')} body={undoing && s.members[undoing] ? t('renewals.undoAsk', { name: displayName(s.members[undoing]), month: fmt.fmonth(month) }) : null}
        confirmLabel={t('renewals.undo')} cancelLabel={t('renewals.keep')} onConfirm={() => (undoing ? undo(undoing) : undefined)} />
    </div>
  );
}
