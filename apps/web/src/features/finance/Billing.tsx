// Billing (design ScrFin): tiles that filter the lists, Overdue and Due lists whose rows open to call notes and reminders,
// plus the invoice run (preview the 15th's run, then issue) and the invoice detail sheet.
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { actorName, fmtPhone, memberName, memberShort, rp, runDone, ym } from '@cp/shared';
import { billingBoard, invoicePeriod, nextRunPeriod, runPlan, type InvoiceView } from '@cp/shared/rules/finance';
import { Avatar, Button, Card, CardHead, EmptyState, Icon, PageHead, usePaged, FONT_BODY, FONT_SMALL } from '../../components/ui';
import { padFor, useDevice } from '../../hooks/useDevice';
import { useAct } from '../../lib/act';
import { useNow } from '../../lib/clock';
import { useFmt, useT } from '../../lib/i18n';
import { useClub } from '../../store/replica';
import { InvoiceRunSheet } from './InvoiceRun';
import { InvoiceSheet } from './InvoiceSheet';
import { matches, ordinal, stampOf } from './lib';
import { Badge, PagerBar, SearchField } from './parts';
import { memberPhoto } from '../../lib/media';

type Filter = 'all' | 'paid' | 'due' | 'overdue' | 'xero';
const FILTERS: Filter[] = ['all', 'paid', 'due', 'overdue', 'xero'];

export function Billing() {
  const s = useClub();
  const t = useT();
  const { lang, fd, fmonth, fdy } = useFmt();
  const { today } = useNow();
  const { device, isPhone } = useDevice();
  const [sp, setSp] = useSearchParams();
  const f: Filter = FILTERS.includes(sp.get('f') as Filter) ? (sp.get('f') as Filter) : 'all';
  const [q, setQ] = useState('');
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [runOpen, setRunOpen] = useState(sp.get('run') === '1');
  useEffect(() => { if (sp.get('run') === '1') setRunOpen(true); }, [sp]);

  const board = useMemo(() => billingBoard(s, today), [s, today]);
  const setFilter = (k: Filter) => setSp((p) => { const n = new URLSearchParams(p); if (k === 'all' || k === f) n.delete('f'); else n.set('f', k); return n; }, { replace: true });
  const closeRun = () => { setRunOpen(false); if (sp.get('run')) setSp((p) => { const n = new URLSearchParams(p); n.delete('run'); return n; }, { replace: true }); };

  const tiles: { key: Filter; label: string; value: number; badge: 'paid' | 'outstanding' | 'overdue' | 'pending'; sum: number }[] = [
    { key: 'paid', label: t('finance.bill.tilePaid', { month: fmonth(board.month) }), value: board.paid.length, badge: 'paid', sum: board.sums.paid },
    { key: 'due', label: board.nextDue ? t('finance.bill.tileDue', { date: fd(board.nextDue, { day: 'numeric', month: 'short' }) }) : t('finance.bill.tileDueNone'), value: board.due.length, badge: 'outstanding', sum: board.sums.due },
    { key: 'overdue', label: t('finance.bill.tileOverdue'), value: board.overdue.length, badge: 'overdue', sum: board.sums.overdue },
    { key: 'xero', label: t('finance.bill.tileXero'), value: board.xero.length, badge: 'pending', sum: board.sums.xero },
  ];
  const dueDay = ordinal(lang, s.club.settings.dueDay);
  const lists: { key: Exclude<Filter, 'all'>; title: string; meta: string; rows: InvoiceView[] }[] = [];
  const add = (key: Exclude<Filter, 'all'>, title: string, meta: string, rows: InvoiceView[]) => lists.push({ key, title, meta, rows });
  const dueMeta = t('finance.bill.dueMeta', { n: board.due.length, total: rp(board.sums.due) });
  if (f === 'all' || f === 'overdue') if (board.overdue.length || f === 'overdue') add('overdue', t('status.overdue'), t('finance.bill.overdueMeta'), board.overdue);
  if (f === 'all' || f === 'due') add('due', t('finance.bill.dueTitle', { day: dueDay }), dueMeta, board.due);
  if (f === 'paid') add('paid', t('finance.bill.tilePaid', { month: fmonth(board.month) }), t('finance.bill.paidMeta', { total: rp(board.sums.paid) }), board.paid);
  if (f === 'xero') add('xero', t('finance.bill.tileXero'), t('finance.bill.xeroMeta'), board.xero);

  const nextPeriod = nextRunPeriod(s, today);
  const planNext = useMemo(() => runPlan(s, nextPeriod, today), [s, nextPeriod, today]);
  const runDue = +today.slice(8) >= s.club.settings.issueDay && !runDone(s, ym(today));
  const lastRun = [...Object.values(s.invoiceRuns)].filter((r) => !r.deletedAt).sort((a, b) => (a.issueDate < b.issueDate ? 1 : -1))[0];

  return (
    <div style={{ padding: padFor(device), display: 'flex', flexDirection: 'column', gap: isPhone ? 12 : 20, maxWidth: 1100 }}>
      <PageHead eyebrow={t('finance.bill.eyebrow', { issue: ordinal(lang, s.club.settings.issueDay), due: dueDay })} title={t('nav.billing')} />
      <div className="cp-desc" style={{ fontSize: 16, lineHeight: '22px', maxWidth: 700 }}>{t('finance.bill.blurb')}</div>

      <div className="cp-tiles" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12 }}>
        {tiles.map((x) => (
          <button key={x.key} type="button" className="dh52 cp-tile" aria-pressed={f === x.key} onClick={() => setFilter(x.key)}
            style={{ minHeight: 104, padding: '16px 18px', borderRadius: 20, border: f === x.key ? '1px solid #75624B' : '1px solid #DBD7D6', boxShadow: f === x.key ? '0 0 0 1px #75624B' : undefined, background: '#FFFFFF', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, color: '#282828', textAlign: 'left', cursor: 'pointer', fontFamily: 'Inter' }}>
            <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.4 }}>{x.label}</span>
            <span className="cp-tile-n" style={{ fontSize: 32, lineHeight: '36px', fontWeight: 300, fontVariantNumeric: 'tabular-nums', letterSpacing: '-1px' }}>{x.value}</span>
            <Badge kind={x.badge} label={rp(x.sum)} />
          </button>
        ))}
      </div>

      <Card pad={isPhone ? '12px 16px' : '18px 20px'} shadow={runDue}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 300px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: FONT_SMALL, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 500, lineHeight: '18px' }}>{t('finance.run.title')}</span>
            <span style={{ fontSize: 20, lineHeight: '28px', letterSpacing: '-0.3px' }}>{runDue ? t('finance.run.due', { month: fmonth(nextPeriod, true) }) : t('finance.run.next', { month: fmonth(nextPeriod, true) })}</span>
            <span className="cp-hide-phone" style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>
              {t('finance.run.cardSub', { n: planNext.issue.length, total: rp(planNext.total), date: fdy(planNext.dueDate) })}
              {lastRun ? ` · ${t('finance.run.last', { month: fmonth(lastRun.period), n: lastRun.invoiceIds.length })}` : ''}
            </span>
          </div>
          <Button icon="event_repeat" onClick={() => setRunOpen(true)}>{t('finance.run.open')}</Button>
        </div>
      </Card>

      <SearchField value={q} onChange={setQ} label={t('finance.bill.search')} placeholder={t('finance.bill.search')} />
      {lists.map((l) => (
        <InvoiceList key={l.key} id={l.key} title={l.title} meta={l.meta} rows={l.rows} q={q} openRow={openRow} setOpenRow={setOpenRow} onOpenInvoice={setSheetId} />
      ))}

      <InvoiceRunSheet open={runOpen} onClose={closeRun} />
      {sheetId ? <InvoiceSheet invoiceId={sheetId} open onClose={() => setSheetId(null)} audience="staff" /> : null}
    </div>
  );
}

function InvoiceList({ id, title, meta, rows, q, openRow, setOpenRow, onOpenInvoice }: {
  id: 'paid' | 'due' | 'overdue' | 'xero'; title: string; meta: string; rows: InvoiceView[]; q: string; openRow: string | null; setOpenRow: (id: string | null) => void; onOpenInvoice: (id: string) => void;
}) {
  const t = useT();
  const hits = useMemo(
    () => rows.filter((v) => matches(q, v.member ? `${memberName(v.member)} ${memberShort(v.member)}` : '', v.inv.number, v.payer?.name, v.payer?.phone, v.payer?.phone.replace(/^\+62/, '0'))),
    [rows, q],
  );
  const paged = usePaged(hits, 15, q + id);
  return (
    <Card>
      <CardHead title={title} meta={q && hits.length !== rows.length ? t('finance.bill.matches', { n: hits.length, of: rows.length }) : meta} />
      {paged.rows.map((v) => (
        <InvoiceRow key={v.inv.id} v={v} list={id} open={openRow === `${id}:${v.inv.id}`} onToggle={() => setOpenRow(openRow === `${id}:${v.inv.id}` ? null : `${id}:${v.inv.id}`)} onOpenInvoice={() => onOpenInvoice(v.inv.id)} />
      ))}
      {!hits.length ? <div style={{ borderTop: '1px solid #EFECEA' }}><EmptyState icon={q ? 'search_off' : 'task_alt'} title={q ? t('common.noResults') : t('finance.bill.emptyList')} /></div> : null}
      <PagerBar paged={paged} label={title} />
    </Card>
  );
}

function InvoiceRow({ v, list, open, onToggle, onOpenInvoice }: { v: InvoiceView; list: 'paid' | 'due' | 'overdue' | 'xero'; open: boolean; onToggle: () => void; onOpenInvoice: () => void }) {
  const s = useClub();
  const t = useT();
  const act = useAct();
  const navigate = useNavigate();
  const { fds, fmonth } = useFmt();
  const { isPhone } = useDevice();
  const [note, setNote] = useState('');
  const { inv, member, payer } = v;
  const name = member ? memberName(member) : inv.memberId;
  const sub = [inv.number, fmonth(invoicePeriod(inv), true), payer ? `${payer.name} · ${fmtPhone(payer.phone)}` : '', v.status === 'partial' ? t('finance.bill.dueShort', { date: fds(inv.dueDate) }) : ''].filter(Boolean).join(' · ');
  const badge =
    v.status === 'overdue' ? <Badge kind="overdue" label={t(v.late === 1 ? 'finance.bill.dayLate' : 'finance.bill.daysLate', { n: v.late })} />
    : v.status === 'partial' ? <Badge kind="partial" label={t('status.partial')} />
    : v.status === 'paid' ? <Badge kind={list === 'xero' ? 'pending' : 'paid'} label={t(list === 'xero' ? 'finance.xero.pending' : 'status.paid')} />
    : <Badge kind="outstanding" label={t('finance.bill.due', { date: fds(inv.dueDate) })} />;
  const timeline = [
    ...inv.callNotes.map((c) => ({ at: c.at, by: c.by, text: c.text })),
    ...inv.reminders.map((r) => ({ at: r.at, by: r.by, text: t('finance.bill.reminderSent') })),
  ].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  const last = inv.reminders.length ? inv.reminders[inv.reminders.length - 1] : undefined;
  const canRemind = v.balance > 0;
  const saveNote = async () => {
    if (!note.trim()) return;
    const r = await act('invoice.callNote', { invoiceId: inv.id, text: note.trim() }, { ok: t('finance.toast.noteSaved') });
    if (r.ok) setNote('');
  };
  const remind = () => act('invoice.remind', { invoiceId: inv.id }, { ok: (r) => t('finance.toast.reminder', { name: String(r.to || payer?.name || '') }) });
  return (
    <div style={{ borderTop: '1px solid #EFECEA' }}>
      <button type="button" className="dh53" onClick={onToggle} aria-expanded={open} aria-label={`${name}, ${inv.number}`}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: isPhone ? '4px 10px' : 12, flexWrap: 'wrap', padding: isPhone ? '9px 14px' : '12px 20px', minHeight: isPhone ? 56 : 68, border: 'none', background: '#FFFFFF', textAlign: 'left', cursor: 'pointer', color: '#282828', fontFamily: 'Inter' }}>
        {isPhone ? null : <Avatar name={name} tone={member?.photoTone} src={memberPhoto(member)} size={44} />}
        <span style={{ flex: isPhone ? '1 1 100%' : '1 1 260px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.4 }}>{name}</span>
          <span style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>{sub}</span>
        </span>
        <span style={{ fontSize: 16, fontVariantNumeric: 'tabular-nums', lineHeight: 1.4 }}>{rp(list === 'paid' || list === 'xero' ? v.total : v.balance)}</span>
        {badge}
        <Icon name="expand_more" size={22} color="#75624B" style={{ transform: open ? 'rotate(180deg)' : undefined }} />
      </button>
      {open ? (
        <div style={{ padding: '0 20px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {timeline.map((c, i) => (
            <div key={i} style={{ padding: '10px 12px', borderRadius: 14, background: '#F4F0EE', display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 16, lineHeight: '22px' }}>{c.text}</span>
              <span style={{ fontSize: 'max(13px, var(--cp-body, 0px))', color: '#6A6967', lineHeight: 1.4 }}>{actorName(s, c.by)} · {stampOf(c.at, fds)}</span>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void saveNote(); }} placeholder={t('finance.bill.notePlaceholder')} aria-label={t('finance.bill.callNote')}
              style={{ flex: '1 1 280px', minWidth: 0, height: 52, border: '1px solid #8A755B', borderRadius: 16, background: '#FFFFFF', padding: '0 14px', fontSize: 16, fontFamily: 'Inter', color: '#282828', outline: 'none' }} />
            <Button variant="secondary" size={48} onClick={saveNote} style={{ padding: '0 18px' }}>{t('finance.bill.saveNote')}</Button>
            {canRemind ? <Button size={48} onClick={remind} style={{ padding: '0 20px' }}>{t('finance.bill.sendReminder')}</Button> : null}
          </div>
          {last ? <span style={{ fontSize: 'max(13px, var(--cp-body, 0px))', color: '#6A6967', lineHeight: 1.4 }}>{t('finance.bill.lastReminder', { when: stampOf(last.at, fds) })}</span> : null}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button variant="quiet" size={44} icon="receipt_long" onClick={onOpenInvoice} style={{ padding: '0 16px' }}>{t('finance.bill.openInvoice')}</Button>
            {member ? <Button variant="quiet" size={44} icon="person" onClick={() => navigate(`/members/${member.id}/plan`)} style={{ padding: '0 16px' }}>{t('finance.bill.openProfile')}</Button> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
