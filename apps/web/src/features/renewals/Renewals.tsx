// Renewals (KC round 7): the front desk's month-end follow-up. Caca (and management) go through every member to ask whether they continue, switch plan, take
// leave or stop for the coming month, and record the answer. The top shows the month being decided, "18 of 45 decided" with a thin bar and the key dates
// (the leave notice and the invoice date); three segments (To do, Waiting for management, Decided); quiet grouped rows with the plan, the family contact and the
// latest outcome, the contact's phone number, quick answers (Continue, No answer) and Call / WhatsApp; a tap opens the follow-up sheet. Past months are a read-only log.
import { useMemo, useState, type CSSProperties } from 'react';
import { addMonths, fmtPhone, memberName, memberShort, waUrl, ym, type YM } from '@cp/shared';
import { RENEWAL_STATES, renewalCounts, renewalDates, renewalFilter, renewalMonth, renewalRows, type RenewalRow, type RenewalState } from '@cp/shared/rules/renewals';
import { Avatar, EmptyState, Icon, IconButton, PageHead, Pager, usePaged } from '../../components/ui';
import { padFor, useDevice } from '../../hooks/useDevice';
import { useNow } from '../../lib/clock';
import { useFmt, useT } from '../../lib/i18n';
import { memberPhoto } from '../../lib/media';
import { useAct } from '../../lib/act';
import { useClub } from '../../store/replica';
import { FollowUpSheet } from './FollowUpSheet';
import { outcomeLabel, rowMeta } from './lib';

const PAGE_SIZE = 15;
const dm = { day: 'numeric', month: 'short' } as const;

export function Renewals() {
  const s = useClub();
  const t = useT();
  const fmt = useFmt();
  const { today } = useNow();
  const { device, isPhone } = useDevice();
  const maxMonth = renewalMonth(today);
  /** the earliest month that has a log: the current month at least, so last month's log is one tap away once the month turns */
  const minMonth = useMemo(() => Object.values(s.followUps ?? {}).reduce((lo, f) => (f.month < lo ? f.month : lo), ym(today)), [s.followUps, today]);
  const [picked, setPicked] = useState<YM | null>(null);
  const month: YM = picked && picked >= minMonth && picked <= maxMonth ? picked : maxMonth;
  const past = month <= ym(today);
  const [seg, setSeg] = useState<RenewalState>('toDo');
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const act = useAct();

  const rows = useMemo(() => renewalRows(s, month), [s, month]);
  const counts = useMemo(() => renewalCounts(rows), [rows]);
  const visible = useMemo(() => renewalFilter(s, rows, seg, q), [s, rows, seg, q]);
  const paged = usePaged(visible, PAGE_SIZE, `${month}|${seg}|${q}`);
  const dates = renewalDates(s, month, today);
  const noLog = past && !rows.some((r) => r.f);

  const monthText = fmt.fmonth(month, true);
  const eyebrow = past ? t('renewals.logEyebrow', { month: monthText }) : monthText;
  const pct = counts.total ? Math.round((counts.done / counts.total) * 100) : 0;
  const progress = counts.total && counts.done === counts.total ? t('renewals.progressAll', { total: counts.total }) : t('renewals.progress', { n: counts.done, total: counts.total });
  const dateLine = dates.leaveOpen
    ? t('renewals.datesOpen', { month: fmt.fmonth(month), date: fmt.fd(dates.leaveDeadline, dm), invoice: fmt.fd(dates.invoice, dm) })
    : t('renewals.datesClosed', { month: fmt.fmonth(dates.leaveFrom), invoice: fmt.fd(dates.invoice, dm) });

  const switcher = (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <IconButton icon="chevron_left" label={t('renewals.prevMonth')} size={40} onClick={month <= minMonth ? undefined : () => setPicked(addMonths(month, -1))} style={month <= minMonth ? { opacity: 0.35, cursor: 'default' } : undefined} />
      <IconButton icon="chevron_right" label={t('renewals.nextMonth')} size={40} onClick={month >= maxMonth ? undefined : () => setPicked(addMonths(month, 1))} style={month >= maxMonth ? { opacity: 0.35, cursor: 'default' } : undefined} />
    </div>
  );

  const segments = (
    <div role="tablist" aria-label={t('renewals.segLabel')} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 2, padding: 3, borderRadius: 11, background: '#EAE6E0', alignSelf: isPhone ? 'stretch' : 'flex-start', minWidth: isPhone ? undefined : 380 }}>
      {RENEWAL_STATES.map((k) => {
        const on = seg === k;
        return (
          <button key={k} type="button" role="tab" aria-selected={on} data-seg={k} onClick={() => setSeg(k)} className="cp-press"
            style={{ height: 36, padding: '0 8px', borderRadius: 9, border: 'none', background: on ? '#FFFFFF' : 'transparent', boxShadow: on ? '0 1px 3px rgba(40,30,20,0.14)' : 'none', fontSize: 14, fontWeight: on ? 600 : 500, color: on ? '#1E1A16' : '#5E5852', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'Inter', fontVariantNumeric: 'tabular-nums' }}>
            {t(`renewals.seg.${k}`)} · {counts[k]}
          </button>
        );
      })}
    </div>
  );
  const search = (
    <label style={{ display: 'flex', alignItems: 'center', gap: 6, height: 40, padding: '0 12px', borderRadius: 11, background: '#EAE6E0', flex: isPhone ? undefined : '1 1 280px', maxWidth: isPhone ? undefined : 380 }}>
      <Icon name="search" size={19} color="#6B6259" />
      <input value={q} onChange={(e) => setQ(e.target.value)} inputMode="search" autoComplete="off" placeholder={t('renewals.searchPh')} aria-label={t('renewals.searchLabel')} style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', height: '100%', fontSize: 16, fontFamily: 'Inter', color: '#1E1A16', background: 'transparent' }} />
    </label>
  );

  /** KC round 7: the two answers that need nothing else, in one tap from the list (anything else opens the follow-up sheet) */
  const quick = async (r: RenewalRow, outcome: 'continue' | 'noAnswer') => {
    if (busy) return;
    setBusy(r.m.id + outcome);
    await act('followUp.record', { memberId: r.m.id, month, outcome }, { ok: t('renewals.quickSaved', { name: memberShort(r.m), outcome: outcomeLabel(t, outcome) }) });
    setBusy(null);
  };
  const round: CSSProperties = { width: 36, height: 36, borderRadius: 999, border: '1px solid #DCD3C8', background: '#FFFFFF', color: '#24201C', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', flex: 'none', cursor: 'pointer', padding: 0 };
  const pill: CSSProperties = { height: 36, padding: '0 12px', borderRadius: 999, border: '1px solid #DCD3C8', background: '#FFFFFF', color: '#24201C', display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 14, fontWeight: 500, fontFamily: 'Inter', whiteSpace: 'nowrap', flex: 'none', cursor: 'pointer' };

  const rowEl = (r: RenewalRow, i: number) => {
    const meta = rowMeta(t, fmt, r);
    const name = memberName(r.m);
    const phone = r.contact?.phone ? fmtPhone(r.contact.phone) : '';
    const reach = r.contact && !past ? (
      <>
        <a href={`tel:${r.contact.phone}`} aria-label={`${t('common.call')} ${r.contact.name}`} data-testid="renewal-call" className={isPhone ? 'cp-press' : 'h-cream'} style={round}><Icon name="call" size={18} /></a>
        <a href={waUrl(r.contact.phone)} target="_blank" rel="noreferrer" aria-label={`${t('renewals.whatsapp')} ${r.contact.name}`} data-testid="renewal-wa" className={isPhone ? 'cp-press' : 'h-cream'} style={round}><Icon name="chat" size={18} /></a>
      </>
    ) : null;
    // the quick answers: only while the member is still to do, for the month being followed up
    const answers = !past && r.state === 'toDo' ? (
      <>
        <button type="button" data-testid="renewal-quick-continue" disabled={!!busy} onClick={() => void quick(r, 'continue')} className={isPhone ? 'cp-press' : 'h-cream'} style={pill}><Icon name="check" size={17} />{outcomeLabel(t, 'continue')}</button>
        <button type="button" data-testid="renewal-quick-noAnswer" disabled={!!busy} onClick={() => void quick(r, 'noAnswer')} className={isPhone ? 'cp-press' : 'h-cream'} style={pill}>{outcomeLabel(t, 'noAnswer')}</button>
      </>
    ) : null;
    const text = (
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <span style={{ fontSize: 16, lineHeight: '22px', fontWeight: 500, overflowWrap: 'anywhere' }}>{name}</span>
        <span style={{ fontSize: 13, lineHeight: '19px', color: meta.rejected ? '#9A3D24' : '#6B6259', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{meta.text}</span>
        {phone ? <span data-testid="renewal-phone" style={{ fontSize: 13, lineHeight: '19px', color: '#24201C', fontVariantNumeric: 'tabular-nums' }}>{phone}</span> : null}
      </span>
    );
    const open = (
      <button type="button" className="cp-tap-target" onClick={() => setOpenId(r.m.id)} aria-label={name}
        style={{ flex: '1 1 0', minWidth: 0, display: 'flex', alignItems: 'center', gap: 12, padding: 0, border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', color: '#24201C', fontFamily: 'Inter' }}>
        <Avatar name={name} tone={r.m.photoTone} src={memberPhoto(r.m)} size={42} />
        {text}
      </button>
    );
    const chevron = <span aria-hidden="true" onClick={() => setOpenId(r.m.id)} style={{ display: 'flex', flex: 'none', cursor: 'pointer' }}><Icon name="chevron_right" size={22} color="#C2B8AB" /></span>;
    if (isPhone) {
      // phone: the name, then the quick answers and the call buttons on their own line under it
      return (
        <div key={r.m.id} data-renewal={r.m.id} data-state={r.state} className="cp-tap"
          style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 16px 12px', fontFamily: 'Inter', color: '#24201C', backgroundColor: '#FFFFFF', backgroundImage: i ? 'linear-gradient(#EFEAE3, #EFEAE3)' : 'none', backgroundSize: 'calc(100% - 70px) 1px', backgroundPosition: 'right top', backgroundRepeat: 'no-repeat', transition: 'background-color .15s' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>{open}{chevron}</div>
          {answers || reach ? <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 54, flexWrap: 'wrap' }}>{answers}{reach}</div> : null}
        </div>
      );
    }
    return (
      <div key={r.m.id} data-renewal={r.m.id} data-state={r.state} className="cp-bleed"
        style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 62, fontFamily: 'Inter', color: '#24201C', padding: '10px 0', borderTop: i ? '1px solid #F0EAE1' : 'none' }}>
        {open}
        {answers ? <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 'none' }}>{answers}</div> : null}
        {reach}
        {chevron}
      </div>
    );
  };

  const empty = noLog ? t('renewals.noLog', { month: fmt.fmonth(month) })
    : !rows.length ? t('renewals.noMembers', { month: fmt.fmonth(month) })
    : q.trim() ? t('renewals.noMatch') : t(`renewals.none.${seg}`);
  const list = (
    <>
      {paged.rows.map(rowEl)}
      {!visible.length ? <EmptyState icon={noLog || !rows.length ? 'event_repeat' : q.trim() ? 'person_search' : 'done_all'} title={empty} /> : null}
    </>
  );

  return (
    <div className={isPhone ? 'cp-native' : undefined} style={{ padding: padFor(device), display: 'flex', flexDirection: 'column', gap: isPhone ? 14 : 22 }}>
      <PageHead size={40} eyebrow={eyebrow} title={t('renewals.title')} right={switcher} />
      {noLog ? null : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span data-testid="renewals-progress" style={{ fontSize: 15, fontWeight: 500, lineHeight: '22px', fontVariantNumeric: 'tabular-nums' }}>{progress}</span>
          <div role="progressbar" aria-label={progress} aria-valuemin={0} aria-valuemax={counts.total} aria-valuenow={counts.done} style={{ height: 4, borderRadius: 999, background: '#E4DED6', overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', borderRadius: 999, background: '#24201C', transition: 'width .25s ease' }} />
          </div>
          {past ? null : <span data-testid="renewals-dates" style={{ fontSize: 13, lineHeight: '19px', color: '#6B6259' }}>{dateLine}</span>}
        </div>
      )}
      {noLog ? null : isPhone ? (
        <>
          {segments}
          {search}
        </>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px 16px' }}>{segments}{search}</div>
      )}
      {isPhone
        ? <div style={{ background: '#FFFFFF', borderRadius: 14, overflow: 'hidden' }}>{list}</div>
        : <div style={{ background: '#FFFFFF', border: '1px solid #EFE7DC', borderRadius: 16, boxShadow: 'var(--card-shadow)', overflow: 'hidden', padding: '4px clamp(18px, 3vw, 28px)' }}>{list}</div>}
      {paged.pages > 1 ? <Pager page={paged.page} pages={paged.pages} onPage={paged.setPage} label={t('renewals.pager')} /> : null}
      {openId ? <FollowUpSheet key={`${month}|${openId}`} memberId={openId} month={month} onClose={() => setOpenId(null)} /> : null}
    </div>
  );
}
