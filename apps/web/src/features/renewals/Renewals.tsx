// Renewals (KC round 7): the front desk's month-end follow-up. Caca (and management) go through every member to ask whether they continue, switch plan, take
// leave or stop for the coming month, and record the answer. The top shows the month being decided, "18 of 45 decided" with a thin bar and the key dates
// (the leave notice and the invoice date); three segments (To do, Waiting for management, Decided). KC round 8d: each member is a row of clear columns: Member (name,
// the family contact and phone) | Plan (Flex / Gold, this month's visits) | Status (a coloured pill: where the follow-up stands) | Next step (what to do now, in words)
// | quick answers (Continue, No answer) and Call / WhatsApp. A laptop gets a table with a header row; a tablet puts the answers on a line under the row; a phone stacks
// the pills and the next step under the name. A tap opens the follow-up sheet. Past months are a read-only log (no next step, no actions).
import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { listName, addMonths, flexMonth, fmtPhone, memberName, displayName, waUrl, ym, type Plan, type YM } from '@cp/shared';
import { RENEWAL_STATES, renewalCounts, renewalDates, renewalFilter, renewalMonth, renewalNext, renewalRows, type RenewalRow, type RenewalState } from '@cp/shared/rules/renewals';
import { Avatar, EmptyState, GROUP_HEAD, HAIRLINE, Icon, IconButton, InfoChip, PageHead, Pager, usePaged } from '../../components/ui';
import { padFor, useDevice } from '../../hooks/useDevice';
import { useNow } from '../../lib/clock';
import { useFmt, useT } from '../../lib/i18n';
import { memberPhoto } from '../../lib/media';
import { useAct } from '../../lib/act';
import { useMe } from '../../lib/me';
import { useClub } from '../../store/replica';
import { FollowUpSheet } from './FollowUpSheet';
import { nextText, outcomeLabel, statusLook, usageShort, usageText } from './lib';

const PAGE_SIZE = 15;
const dm = { day: 'numeric', month: 'short' } as const;
/** KC round 8d, the laptop table: Member | Plan | Status | Next step (| the answers and call buttons | a chevron). A log has no Next step and no buttons. */
const COLS = ['minmax(272px, 1.8fr)', 'minmax(112px, 0.8fr)', 'minmax(150px, 1fr)', 'minmax(140px, 1.1fr)'];
const ACTIONS_W = 292;
/** the Next steps that ask for something from the front desk are set in ink, the waiting and the done ones are quiet */
const DO_NOW = new Set(['call', 'callAgain', 'askAgain', 'answerRequest']);
/** how much room the table needs: below TABLE_MIN the rows stack like on the phone; from INLINE_MIN the answers and call buttons get their own column */
const TABLE_MIN = 780;
const INLINE_MIN = 1170;

/** The width of an element (content box), kept up to date; 0 until measured (and in tests, where nothing has a size). */
function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const on = () => setW(el.clientWidth);
    on();
    const ro = new ResizeObserver(on);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/** Flex / Gold as a small tag: a white tag on the grey list (the plan's own colour as a dot, as in the insights charts), optionally with the month's visits. */
function PlanTag({ plan, label, detail }: { plan: Plan; label: string; detail?: string }) {
  return (
    <span style={{ height: 26, padding: '0 10px 0 9px', borderRadius: 8, background: 'var(--on-card, #FFFFFF)', color: '#24201C', fontSize: 13, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', flex: 'none' }}>
      <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 999, background: plan === 'gold' ? '#C9A24D' : 'var(--accent, #75624B)', flex: 'none' }} />
      {label}
      {detail ? <span style={{ fontWeight: 500, color: '#6B6259' }}>· {detail}</span> : null}
    </span>
  );
}

export function Renewals() {
  const s = useClub();
  const t = useT();
  const fmt = useFmt();
  const { today } = useNow();
  const { device, isPhone, isTablet, isLaptop } = useDevice();
  const [cardRef, cardW] = useWidth();
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
  const { role } = useMe();

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
    <div role="tablist" aria-label={t('renewals.segLabel')} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 2, padding: 2, borderRadius: 9, background: 'var(--track, #E8E8EB)', alignSelf: isPhone ? 'stretch' : 'flex-start', minWidth: isPhone ? undefined : 380 }}>
      {RENEWAL_STATES.map((k) => {
        const on = seg === k;
        return (
          <button key={k} type="button" role="tab" aria-selected={on} data-seg={k} onClick={() => setSeg(k)} className="cp-press"
            style={{ height: 36, padding: '0 8px', borderRadius: 7, border: 'none', background: on ? '#FFFFFF' : 'transparent', boxShadow: on ? '0 1px 3px rgba(40,30,20,0.14)' : 'none', fontSize: 14, fontWeight: on ? 600 : 500, color: on ? '#1E1A16' : '#5E5852', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'Inter', fontVariantNumeric: 'tabular-nums' }}>
            {t(`renewals.seg.${k}`)} · {counts[k]}
          </button>
        );
      })}
    </div>
  );
  const search = (
    <label className="cp-input-wrap cp-fill" style={{ display: 'flex', alignItems: 'center', gap: 6, height: 40, padding: '0 12px', borderRadius: 12, background: 'var(--fill, #F4F4F5)', flex: isPhone ? undefined : '1 1 280px', maxWidth: isPhone ? undefined : 380 }}>
      <Icon name="search" size={19} color="#6B6259" />
      <input value={q} onChange={(e) => setQ(e.target.value)} inputMode="search" autoComplete="off" placeholder={t('renewals.searchPh')} aria-label={t('renewals.searchLabel')} style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', height: '100%', fontSize: 16, fontFamily: 'Inter', color: '#1E1A16', background: 'transparent' }} />
    </label>
  );

  /** KC round 7: the two answers that need nothing else, in one tap from the list (anything else opens the follow-up sheet) */
  const quick = async (r: RenewalRow, outcome: 'continue' | 'noAnswer') => {
    if (busy) return;
    setBusy(r.m.id + outcome);
    await act('followUp.record', { memberId: r.m.id, month, outcome }, { ok: t('renewals.quickSaved', { name: displayName(r.m), outcome: outcomeLabel(t, outcome) }) });
    setBusy(null);
  };
  const round: CSSProperties = { width: 36, height: 36, borderRadius: 999, border: 'none', background: 'var(--fill, #F4F4F5)', color: '#24201C', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', flex: 'none', cursor: 'pointer', padding: 0 };
  const pill: CSSProperties = { height: 36, padding: '0 12px', borderRadius: 999, border: 'none', background: 'var(--fill, #F4F4F5)', color: '#24201C', display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 14, fontWeight: 500, fontFamily: 'Inter', whiteSpace: 'nowrap', flex: 'none', cursor: 'pointer' };

  const ym0 = ym(today);
  // the room the list has decides the layout (not the device): stacked rows like the phone's, a table with the answers on a line under each row, or a table with an actions column
  const room = isPhone ? 0 : cardW ? cardW - 56 : isLaptop ? 1200 : isTablet ? 900 : 0;
  const stacked = room < TABLE_MIN;
  const inlineActions = !stacked && !past && room >= INLINE_MIN;
  const rowEl = (r: RenewalRow, i: number) => {
    const name = listName(r.m);
    const phone = r.contact?.phone ? fmtPhone(r.contact.phone) : '';
    const look = statusLook(t, fmt, r);
    const next = renewalNext(r, month, today);
    const nextTxt = nextText(t, fmt, next, role === 'mgmt');
    const fm = flexMonth(s, r.m, past ? month : ym0, today);
    const usage = usageText(t, r.plan, fm);
    const planName = t(`renewals.plan.${r.plan}`);
    const reach = r.contact && !past ? (
      <>
        <a href={`tel:${r.contact.phone}`} aria-label={`${t('common.call')} ${r.contact.name}`} data-testid="renewal-call" className={isPhone ? 'cp-press cp-fill' : 'h-fill cp-fill'} style={round}><Icon name="call" size={18} /></a>
        <a href={waUrl(r.contact.phone)} target="_blank" rel="noreferrer" aria-label={`${t('renewals.whatsapp')} ${r.contact.name}`} data-testid="renewal-wa" className={isPhone ? 'cp-press cp-fill' : 'h-fill cp-fill'} style={round}><Icon name="chat" size={18} /></a>
      </>
    ) : null;
    // the quick answers: only while the member is still to do, for the month being followed up
    const answers = !past && r.state === 'toDo' ? (
      <>
        <button type="button" data-testid="renewal-quick-continue" disabled={!!busy} onClick={() => void quick(r, 'continue')} className={isPhone ? 'cp-press cp-fill' : 'h-fill cp-fill'} style={pill}><Icon name="check" size={17} />{outcomeLabel(t, 'continue')}</button>
        <button type="button" data-testid="renewal-quick-noAnswer" disabled={!!busy} onClick={() => void quick(r, 'noAnswer')} className={isPhone ? 'cp-press cp-fill' : 'h-fill cp-fill'} style={pill}>{outcomeLabel(t, 'noAnswer')}</button>
      </>
    ) : null;
    // the cells (the same on every width; the phone puts the usage in the plan tag, the wider screens under it)
    const contactLine = (
      <span style={{ fontSize: 13, lineHeight: '19px', color: '#6B6259', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {r.contact ? r.contact.name : t('renewals.noContact')}
        {phone ? <> · <span data-testid="renewal-phone" style={{ color: '#24201C', fontVariantNumeric: 'tabular-nums' }}>{phone}</span></> : null}
      </span>
    );
    const planCell = (
      <span data-testid="renewal-plan" data-plan={r.plan} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4, minWidth: 0 }}>
        <PlanTag plan={r.plan} label={planName} detail={stacked && r.plan === 'flex' ? usageShort(fm) : undefined} />
        {stacked ? null : <span style={{ fontSize: 13, lineHeight: '18px', color: '#6B6259', fontVariantNumeric: 'tabular-nums' }}>{past || room < INLINE_MIN ? usage : t('renewals.usageLine', { usage })}</span>}
      </span>
    );
    const statusCell = (
      <span data-testid="renewal-status" data-status={look.key} data-pending={look.pending || undefined} style={{ display: 'inline-flex', minWidth: 0 }}>
        <InfoChip tone={look.tone} icon={look.icon} label={look.label} />
      </span>
    );
    const nextCell = nextTxt ? (
      <span data-testid="renewal-next" data-next={next.kind} style={{ fontSize: stacked ? 13 : 14, lineHeight: stacked ? '19px' : '20px', fontWeight: DO_NOW.has(next.kind) ? 500 : 400, color: DO_NOW.has(next.kind) ? '#24201C' : '#6B6259', minWidth: 0, overflowWrap: 'anywhere' }}>{nextTxt}</span>
    ) : null;
    const label = [name, look.pending ? `${look.label}, ${t('renewals.status.pending')}` : look.label, nextTxt].filter(Boolean).join(', ');
    const chevron = <span aria-hidden="true" style={{ display: 'flex', flex: 'none', cursor: 'pointer' }}><Icon name="chevron_right" size={22} color="#C2B8AB" /></span>;
    const openStyle: CSSProperties = { flex: '1 1 0', minWidth: 0, display: 'flex', alignItems: 'flex-start', gap: 12, padding: 0, border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', color: '#24201C', fontFamily: 'Inter' };
    const nameEl = <span style={{ fontSize: 16, lineHeight: '22px', fontWeight: 500, overflowWrap: 'anywhere' }}>{name}</span>;
    if (stacked) {
      // phone (and any list too narrow for the table): the name and the family contact, then the plan and the status pills on their own line, the next step as one quiet line, and the answers and call buttons
      return (
        <div key={r.m.id} data-renewal={r.m.id} data-state={r.state} className="cp-tap"
          style={isPhone
            ? { display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 16px 12px', fontFamily: 'Inter', color: '#24201C', backgroundColor: 'transparent', backgroundImage: i ? 'linear-gradient(var(--hairline, #E2E2E6), #E2E2E6)' : 'none', backgroundSize: 'calc(100% - 70px) 0.5px', backgroundPosition: 'right top', backgroundRepeat: 'no-repeat', transition: 'background-color .15s' }
            : { display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 0', fontFamily: 'Inter', color: '#24201C', borderTop: i ? HAIRLINE : 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button type="button" className="cp-tap-target" onClick={() => setOpenId(r.m.id)} aria-label={label} style={openStyle}>
              <Avatar name={memberName(r.m)} tone={r.m.photoTone} src={memberPhoto(r.m)} size={42} />
              <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                {nameEl}
                {contactLine}
                <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, margin: '5px 0 3px' }}>{planCell}{statusCell}</span>
                {nextCell}
              </span>
            </button>
            <span onClick={() => setOpenId(r.m.id)} style={{ display: 'flex', flex: 'none' }}>{chevron}</span>
          </div>
          {answers || reach ? <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 54, flexWrap: 'wrap' }}>{answers}{reach}</div> : null}
        </div>
      );
    }
    // laptop and tablet: a table row; the whole row opens the sheet (the buttons and links stop the click)
    const inline = inlineActions;
    const actions = answers || reach ? (
      <div onClick={(e) => e.stopPropagation()} style={inline ? { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 } : { gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 54, flexWrap: 'wrap', cursor: 'default' }}>{answers}{reach}</div>
    ) : inline ? <span aria-hidden="true" /> : null;
    return (
      <div key={r.m.id} role="row" aria-label={label} data-renewal={r.m.id} data-state={r.state} className="cp-bleed" onClick={() => setOpenId(r.m.id)}
        style={{ display: 'grid', gridTemplateColumns: gridCols, columnGap: 14, rowGap: 8, alignItems: 'center', minHeight: 66, fontFamily: 'Inter', color: '#24201C', padding: '11px 0', borderTop: HAIRLINE, cursor: 'pointer' }}>
        <div role="cell" style={{ display: 'flex', minWidth: 0 }}>
          <button type="button" className="cp-tap-target" onClick={(e) => { e.stopPropagation(); setOpenId(r.m.id); }} aria-label={name} style={{ ...openStyle, alignItems: 'center' }}>
            <Avatar name={memberName(r.m)} tone={r.m.photoTone} src={memberPhoto(r.m)} size={42} />
            <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>{nameEl}{contactLine}</span>
          </button>
        </div>
        <div role="cell" style={{ minWidth: 0 }}>{planCell}</div>
        <div role="cell" style={{ minWidth: 0 }}>{statusCell}</div>
        {past ? null : <div role="cell" style={{ minWidth: 0 }}>{nextCell}</div>}
        {inline ? <div role="cell">{actions}</div> : null}
        {chevron}
        {!inline ? actions : null}
      </div>
    );
  };

  const empty = noLog ? t('renewals.noLog', { month: fmt.fmonth(month) })
    : !rows.length ? t('renewals.noMembers', { month: fmt.fmonth(month) })
    : q.trim() ? t('renewals.noMatch') : t(`renewals.none.${seg}`);
  // the laptop/tablet table: columns and a header row (the Next step column and the buttons are not in a log)
  const gridCols = [...COLS.slice(0, past ? 3 : 4), ...(inlineActions ? [`${ACTIONS_W}px`] : []), '22px'].join(' ');
  const head = (
    <div role="row" style={{ display: 'grid', gridTemplateColumns: gridCols, columnGap: 14, alignItems: 'end', padding: '14px 0 8px' }}>
      {(past ? ['member', 'plan', 'status'] : ['member', 'plan', 'status', 'next']).map((k) => <span key={k} role="columnheader" style={{ ...GROUP_HEAD, minWidth: 0 }}>{t(`renewals.col.${k}`)}</span>)}
      {inlineActions ? <span aria-hidden="true" /> : null}
      <span aria-hidden="true" />
    </div>
  );
  const none = !visible.length ? <EmptyState icon={noLog || !rows.length ? 'event_repeat' : q.trim() ? 'person_search' : 'done_all'} title={empty} /> : null;
  const list = stacked ? (
    <>
      {paged.rows.map(rowEl)}
      {none}
    </>
  ) : (
    <>
      {paged.rows.length ? <div role="table" aria-label={t('renewals.title')}>{head}{paged.rows.map(rowEl)}</div> : null}
      {none}
    </>
  );

  return (
    <div className={isPhone ? 'cp-native' : undefined} style={{ padding: padFor(device), display: 'flex', flexDirection: 'column', gap: isPhone ? 14 : 22 }}>
      <PageHead size={40} eyebrow={eyebrow} title={t('renewals.title')} right={switcher} />
      {noLog ? null : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span data-testid="renewals-progress" style={{ fontSize: 15, fontWeight: 500, lineHeight: '22px', fontVariantNumeric: 'tabular-nums' }}>{progress}</span>
          <div role="progressbar" aria-label={progress} aria-valuemin={0} aria-valuemax={counts.total} aria-valuenow={counts.done} style={{ height: 4, borderRadius: 999, background: 'var(--track, #E8E8EB)', overflow: 'hidden' }}>
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
        ? <div ref={cardRef} className="cp-grey" style={{ background: 'var(--fill, #F4F4F5)', borderRadius: 16, overflow: 'hidden' }}>{list}</div>
        : <div ref={cardRef} className="cp-grey" style={{ background: 'var(--fill, #F4F4F5)', borderRadius: 16, overflow: 'hidden', padding: '4px clamp(18px, 3vw, 28px)' }}>{list}</div>}
      {paged.pages > 1 ? <Pager page={paged.page} pages={paged.pages} onPage={paged.setPage} label={t('renewals.pager')} /> : null}
      {openId ? <FollowUpSheet key={`${month}|${openId}`} memberId={openId} month={month} onClose={() => setOpenId(null)} /> : null}
    </div>
  );
}
