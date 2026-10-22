// Round 13, lead history: the timeline of one lead's moves (on the lead card) and the History view of Enquiries (per month, the leads opened and how far each got).
import { useMemo, useState } from 'react';
import type { Enquiry } from '@cp/shared';
import { LOST_REASONS, leadHistory, leadMonths, seniorName, type LeadMonth } from '@cp/shared/rules/enquiries';
import { Group, HAIRLINE } from '../../components/ui';
import { useT, useFmt } from '../../lib/i18n';
import { useNow } from '../../lib/clock';
import { useClub } from '../../store/replica';

/** "New 8 Oct · Trial 12 Oct": the last four moves of a lead (a move back reads "Back to New"). */
export function LeadTimeline({ e, size = 13 }: { e: Enquiry; size?: number }) {
  const t = useT();
  const { fd } = useFmt();
  const moves = leadHistory(e).slice(-4);
  const day = (at: string) => fd(at.slice(0, 10), { day: 'numeric', month: 'short' });
  // the short stage name ("Trial", not the column's "Trial booked")
  const name = (st: Enquiry['stage']) => (st === 'trial' ? t('enq.hist.trial') : t('enq.stage.' + st));
  const text = moves.map((m) => `${m.undo ? t('enq.hist.back', { stage: name(m.stage) }) : name(m.stage)} ${day(m.at)}`).join(' · ');
  return <span data-timeline={e.id} style={{ fontSize: size, color: '#6B6259', lineHeight: 1.4, overflowWrap: 'anywhere' }}>{text}</span>;
}

function Line({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, minHeight: 28 }}>
      <span style={{ fontSize: 15, lineHeight: '22px' }}>{label}</span>
      <span style={{ fontSize: 15, lineHeight: '22px', fontWeight: 600, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
        {value}{sub ? <span style={{ fontWeight: 500, color: '#6B6259' }}> · {sub}</span> : null}
      </span>
    </div>
  );
}

function MonthGroup({ m, onOpen }: { m: LeadMonth; onOpen: (id: string) => void }) {
  const t = useT();
  const { fmonth } = useFmt();
  const [open, setOpen] = useState(false);
  const f = m.moves, c = m.conversion;
  const rate = (n: number | null) => (n === null ? undefined : `${Math.round(n * 100)}%`);
  const reasons = LOST_REASONS.filter((k) => f.lostReasons[k] > 0).map((k) => `${t('enq.lost.' + k)} ${f.lostReasons[k]}`).join(', ');
  return (
    <Group title={fmonth(m.month, true)} meta={t('enq.hist.opened_n', { n: f.opened })} label={fmonth(m.month, true)} gap={4}>
      {f.opened || f.visit || f.trial || f.joined || f.lost ? (
        <>
          <Line label={t('enq.hist.opened')} value={f.opened} />
          <Line label={t('enq.hist.visited')} value={f.visit} />
          <Line label={t('enq.hist.trial')} value={f.trial} />
          <Line label={t('enq.hist.joined')} value={f.joined} sub={rate(c.toJoined)} />
          <Line label={t('enq.hist.lost')} value={f.lost} sub={reasons || undefined} />
          {c.opened ? <span style={{ fontSize: 12, color: '#6B6259', lineHeight: 1.4 }}>{t('enq.hist.convCaption')}</span> : null}
          {f.leads.length ? <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="cp-press"
            style={{ marginTop: 6, height: 44, border: 'none', borderTop: HAIRLINE, background: 'transparent', color: '#24201C', fontSize: 14, fontWeight: 500, cursor: 'pointer', textAlign: 'left', padding: 0, fontFamily: 'Inter' }}>
            {t('enq.hist.leads', { n: f.leads.length })}
          </button> : null}
          {open ? f.leads.map((e) => (
            <button key={e.id} type="button" data-hist-lead={e.id} onClick={() => onOpen(e.id)} className="cp-press"
              style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-start', textAlign: 'left', padding: '10px 0', border: 'none', borderTop: HAIRLINE, background: 'transparent', color: '#24201C', cursor: 'pointer', fontFamily: 'Inter', minHeight: 44 }}>
              <span style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.35 }}>{seniorName(e)}</span>
              <LeadTimeline e={e} />
            </button>
          )) : null}
        </>
      ) : <span style={{ fontSize: 14, color: '#6B6259', lineHeight: 1.4 }}>{t('enq.hist.none')}</span>}
    </Group>
  );
}

/** The History view: six months, newest first. Phone = one group per month; wide = the same groups in two columns. */
export function LeadHistory({ wide, onOpen }: { wide: boolean; onOpen: (id: string) => void }) {
  const t = useT();
  const s = useClub();
  const { today } = useNow();
  const months = useMemo(() => leadMonths(s, today, 6), [s, today]);
  return (
    <div role="region" aria-label={t('enq.hist.monthsLabel')} style={wide ? { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16, alignItems: 'start' } : { display: 'flex', flexDirection: 'column', gap: 14 }}>
      {months.map((m) => <MonthGroup key={m.month} m={m} onOpen={onOpen} />)}
    </div>
  );
}
