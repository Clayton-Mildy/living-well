// Billing (design ScrFin): tiles that filter the lists, Overdue and Due lists whose rows open to call notes and reminders,
// plus the invoice run (preview the 21st's run, then issue), the members on hold for an unpaid invoice (the brochure's terms) and the invoice detail sheet.
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { actorName, fmtPhone, memberName, memberShort, rp, runDone, suspensions, ym } from '@cp/shared';
import { billingBoard, invoicePeriod, nextRunPeriod, runPlan, type InvoiceView } from '@cp/shared/rules/finance';
import { Avatar, Button, EmptyState, Eyebrow, Icon, PageHead, usePaged } from '../../components/ui';
import { padFor, useDevice } from '../../hooks/useDevice';
import { useAct } from '../../lib/act';
import { useNow } from '../../lib/clock';
import { useFmt, useT } from '../../lib/i18n';
import { useClub } from '../../store/replica';
import { InvoiceRunSheet } from './InvoiceRun';
import { InvoiceSheet } from './InvoiceSheet';
import { matches, ordinal, stampOf } from './lib';
import { Badge, HAIR, Hero, HeroHead, NumberTabs, PGroup, PagerBar, PillBtn, SearchField, phoneField, prow, rowSub, rowTitle } from './parts';
import { memberPhoto } from '../../lib/media';

type Filter = 'all' | 'paid' | 'due' | 'overdue' | 'xero';
const FILTERS: Filter[] = ['all', 'paid', 'due', 'overdue', 'xero'];

export function Billing() {
  const s = useClub();
  const t = useT();
  const { lang, fd, fmonth, fdy } = useFmt();
  const { today } = useNow();
  const { device, isPhone, isLaptop } = useDevice();
  const [sp, setSp] = useSearchParams();
  const f: Filter = FILTERS.includes(sp.get('f') as Filter) ? (sp.get('f') as Filter) : 'all';
  const [q, setQ] = useState('');
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [sheetId, setSheetId] = useState<string | null>(null);
  const navigate = useNavigate();
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
  if (f === 'all' || f === 'overdue') if (board.overdue.length || f === 'overdue') add('overdue', t('status.overdue'), '', board.overdue);
  if (f === 'all' || f === 'due') add('due', t('finance.bill.dueTitle', { day: dueDay }), dueMeta, board.due);
  if (f === 'paid') add('paid', t('finance.bill.tilePaid', { month: fmonth(board.month) }), '', board.paid);
  if (f === 'xero') add('xero', t('finance.bill.tileXero'), '', board.xero);

  // KC round 6: members whose unpaid invoice has put the membership on hold (from the 1st; it stops on the 3rd), oldest invoice first
  const holds = useMemo(() => Object.entries(suspensions(s, today)).filter(([id]) => s.members[id]).sort((a, b) => (a[1].dueDate < b[1].dueDate ? -1 : 1)), [s, today]);
  const nextPeriod = nextRunPeriod(s, today);
  const planNext = useMemo(() => runPlan(s, nextPeriod, today), [s, nextPeriod, today]);
  const runDue = +today.slice(8) >= s.club.settings.issueDay && !runDone(s, ym(today));
  const lastRun = [...Object.values(s.invoiceRuns)].filter((r) => !r.deletedAt).sort((a, b) => (a.issueDate < b.issueDate ? 1 : -1))[0];

  const runBlock = (
    <>
      <Eyebrow>{t('finance.run.title')}</Eyebrow>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 19, lineHeight: 1.3, fontWeight: 500, color: '#2B231C' }}>{runDue ? t('finance.run.due', { month: fmonth(nextPeriod, true) }) : t('finance.run.next', { month: fmonth(nextPeriod, true) })}</span>
        <span className="cp-hide-phone" style={{ fontSize: 14, color: '#6B6259', lineHeight: 1.4 }}>
          {t('finance.run.cardSub', { n: planNext.issue.length, total: rp(planNext.total), date: fdy(planNext.dueDate) })}
          {lastRun ? ` · ${t('finance.run.last', { month: fmonth(lastRun.period), n: lastRun.invoiceIds.length })}` : ''}
        </span>
      </div>
    </>
  );
  const runBtn = <Button icon="event_repeat" size={48} onClick={() => setRunOpen(true)}>{t('finance.run.open')}</Button>;
  // round 6, phone: the invoice run is a small group (header outside), the month on the left and a 34px pill on the right
  const phoneRun = (
    <PGroup title={t('finance.run.title')} pad="12px 16px" gap={0}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 16, lineHeight: 1.3, fontWeight: 500, color: '#2B231C' }}>{runDue ? t('finance.run.due', { month: fmonth(nextPeriod, true) }) : t('finance.run.next', { month: fmonth(nextPeriod, true) })}</span>
          <span className="cp-hide-phone" style={{ fontSize: 14, color: '#6B6259', lineHeight: 1.4 }}>
            {t('finance.run.cardSub', { n: planNext.issue.length, total: rp(planNext.total), date: fdy(planNext.dueDate) })}
            {lastRun ? ` · ${t('finance.run.last', { month: fmonth(lastRun.period), n: lastRun.invoiceIds.length })}` : ''}
          </span>
        </div>
        <PillBtn tone="primary" icon="event_repeat" onClick={() => setRunOpen(true)}>{t('finance.run.open')}</PillBtn>
      </div>
    </PGroup>
  );

  return (
    <div className={isPhone ? 'cp-native' : undefined} style={{ padding: padFor(device), display: 'flex', flexDirection: 'column', gap: isPhone ? 18 : 'clamp(18px, 2.8vw, 36px)' }}>
      <PageHead eyebrow={t('finance.bill.eyebrow', { issue: ordinal(lang, s.club.settings.issueDay), due: dueDay })} title={t('nav.billing')} />

      <NumberTabs cols={isPhone ? 2 : 4} maxWidth={isPhone ? 480 : 820} items={tiles.map((x) => ({
        key: x.key, label: x.label, value: x.value, sub: rp(x.sum), subColor: x.key === 'overdue' && x.value ? '#9A3D24' : undefined, selected: f === x.key, onClick: () => setFilter(x.key),
      }))} />

      {isPhone ? phoneRun : !isLaptop ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', borderTop: '1px solid #E6DDD1', borderBottom: '1px solid #E6DDD1', padding: isPhone ? '12px 0' : '16px 0' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0, flex: '1 1 240px' }}>{runBlock}</div>
          {runBtn}
        </div>
      ) : null}

      {holds.length && (f === 'all' || f === 'overdue') ? <HoldList holds={holds} onOpen={(id) => navigate(`/members/${id}/plan`)} /> : null}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'clamp(24px, 4vw, 56px)', alignItems: 'flex-start' }}>
        <div style={{ flex: '1 1 440px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: isPhone ? 18 : 24 }}>
          <SearchField value={q} onChange={setQ} label={t('finance.bill.search')} placeholder={t('finance.bill.search')} />
          {lists.map((l) => (
            <InvoiceList key={l.key} id={l.key} title={l.title} meta={l.meta} rows={l.rows} q={q} openRow={openRow} setOpenRow={setOpenRow} onOpenInvoice={setSheetId} />
          ))}
        </div>
        {isLaptop ? (
          <aside style={{ flex: '0 1 300px', width: '100%', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 8 }}>
            {runBlock}
            <div><Button icon="event_repeat" size={48} onClick={() => setRunOpen(true)}>{t('finance.run.open')}</Button></div>
          </aside>
        ) : null}
      </div>

      <InvoiceRunSheet open={runOpen} onClose={closeRun} />
      {sheetId ? <InvoiceSheet invoiceId={sheetId} open onClose={() => setSheetId(null)} audience="staff" /> : null}
    </div>
  );
}

/** Members on hold for an unpaid invoice: who, which invoice and what is left, and the day the membership stops. A row opens the member's Plan tab. */
function HoldList({ holds, onOpen }: { holds: [string, ReturnType<typeof suspensions>[string]][]; onOpen: (memberId: string) => void }) {
  const s = useClub();
  const t = useT();
  const { fds } = useFmt();
  const { isPhone } = useDevice();
  const rows = holds.map(([id, x], i) => {
    const m = s.members[id];
    return (
      <button key={id} type="button" onClick={() => onOpen(id)} aria-label={`${memberName(m)}, ${t('status.suspended')}`} data-hold={id} className={isPhone ? 'cp-tap-self' : 'h-row cp-bleed'}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', border: 'none', cursor: 'pointer', color: '#24201C', fontFamily: 'Inter', minHeight: 58, ...(isPhone ? { ...prow(i === 0), padding: '10px 12px 10px 16px' } : { ...prow2(i === 0) }) }}>
        <span style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ ...rowTitle, fontSize: isPhone ? 16 : 17 }}>{memberName(m)}</span>
          <span style={{ ...rowSub, fontSize: isPhone ? 13 : 14 }}>{t(x.told ? 'finance.bill.holdRowTold' : 'finance.bill.holdRow', { number: x.number, amount: rp(x.balance), date: fds(x.stopOn) })}</span>
        </span>
        <Badge kind="overdue" label={t('status.suspended')} />
        <Icon name="chevron_right" size={20} color="#B5AA9C" />
      </button>
    );
  });
  const meta = t('finance.bill.holdMeta', { n: t(holds.length === 1 ? 'finance.bill.holdOne' : 'finance.bill.holdMany', { n: holds.length }) });
  if (isPhone) return <div data-testid="billing-hold"><PGroup title={<span style={{ color: '#9A3D24' }}>{t('finance.bill.holdTitle')}</span>} meta={meta} pad={0} gap={0}>{rows}</PGroup></div>;
  return <div data-testid="billing-hold"><Hero><HeroHead title={<span style={{ color: '#9A3D24' }}>{t('finance.bill.holdTitle')}</span>} meta={meta} />{rows}</Hero></div>;
}
const prow2 = (first: boolean): React.CSSProperties => ({ borderTop: first ? 'none' : HAIR, background: 'transparent', padding: 'clamp(11px, 1.8vw, 15px) 0' });

function InvoiceList({ id, title, meta, rows, q, openRow, setOpenRow, onOpenInvoice }: {
  id: 'paid' | 'due' | 'overdue' | 'xero'; title: string; meta: string; rows: InvoiceView[]; q: string; openRow: string | null; setOpenRow: (id: string | null) => void; onOpenInvoice: (id: string) => void;
}) {
  const t = useT();
  const hits = useMemo(
    () => rows.filter((v) => matches(q, v.member ? `${memberName(v.member)} ${memberShort(v.member)}` : '', v.inv.number, v.payer?.name, v.payer?.phone, v.payer?.phone.replace(/^\+62/, '0'))),
    [rows, q],
  );
  const paged = usePaged(hits, 15, q + id);
  const { isPhone } = useDevice();
  // round 6, phone: a grouped list, the title and count over a flat white group of quiet rows
  if (isPhone) {
    return (
      <PGroup title={id === 'overdue' ? <span style={{ color: '#9A3D24' }}>{title}</span> : title} meta={q && hits.length !== rows.length ? t('finance.bill.matches', { n: hits.length, of: rows.length }) : meta || undefined} pad={0} gap={0}>
        {paged.rows.map((v, i) => (
          <InvoiceRow key={v.inv.id} v={v} list={id} first={i === 0} open={openRow === `${id}:${v.inv.id}`} onToggle={() => setOpenRow(openRow === `${id}:${v.inv.id}` ? null : `${id}:${v.inv.id}`)} onOpenInvoice={() => onOpenInvoice(v.inv.id)} />
        ))}
        {!hits.length ? <EmptyState icon={q ? 'search_off' : 'task_alt'} title={q ? t('common.noResults') : t('finance.bill.emptyList')} /> : null}
        <PagerBar paged={paged} label={title} />
      </PGroup>
    );
  }
  return (
    <Hero>
      <HeroHead title={id === 'overdue' ? <span style={{ color: '#9A3D24' }}>{title}</span> : title} meta={q && hits.length !== rows.length ? t('finance.bill.matches', { n: hits.length, of: rows.length }) : meta || undefined} />
      {paged.rows.map((v) => (
        <InvoiceRow key={v.inv.id} v={v} list={id} open={openRow === `${id}:${v.inv.id}`} onToggle={() => setOpenRow(openRow === `${id}:${v.inv.id}` ? null : `${id}:${v.inv.id}`)} onOpenInvoice={() => onOpenInvoice(v.inv.id)} />
      ))}
      {!hits.length ? <div style={{ borderTop: HAIR }}><EmptyState icon={q ? 'search_off' : 'task_alt'} title={q ? t('common.noResults') : t('finance.bill.emptyList')} /></div> : null}
      <PagerBar paged={paged} label={title} />
    </Hero>
  );
}

function InvoiceRow({ v, list, open, onToggle, onOpenInvoice, first }: { v: InvoiceView; list: 'paid' | 'due' | 'overdue' | 'xero'; open: boolean; onToggle: () => void; onOpenInvoice: () => void; first?: boolean }) {
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
    : <span style={{ fontSize: 14, color: '#6B6259', lineHeight: 1.3, whiteSpace: 'nowrap' }}>{t('finance.bill.due', { date: fds(inv.dueDate) })}</span>;
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
  const small: React.CSSProperties = { fontSize: 14, color: '#6B6259', lineHeight: 1.4 };
  // round 6, phone: one meta line (number and month; the family contact and phone stay in the DOM, hidden, and are in the invoice sheet), a quiet status, a chevron
  if (isPhone) {
    return (
      <div style={prow(first, open ? { backgroundColor: '#FBF8F4', boxShadow: 'inset 3px 0 0 #2B231C', padding: 0 } : { padding: 0 })}>
        <button type="button" onClick={onToggle} aria-expanded={open} aria-label={`${name}, ${inv.number}`} className="cp-tap-self"
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px 10px 16px', minHeight: 58, border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', color: '#24201C', fontFamily: 'Inter' }}>
          <span style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ ...rowTitle, fontSize: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
            <span style={{ ...rowSub, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {[inv.number, fmonth(invoicePeriod(inv), true), v.status === 'partial' ? t('finance.bill.dueShort', { date: fds(inv.dueDate) }) : ''].filter(Boolean).join(' · ')}
              {payer ? <span className="cp-hide-phone"> · {payer.name} · {fmtPhone(payer.phone)}</span> : null}
            </span>
          </span>
          <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flex: 'none' }}>
            <span style={{ fontSize: 16, fontWeight: 500, fontVariantNumeric: 'tabular-nums', lineHeight: 1.3 }}>{rp(list === 'paid' || list === 'xero' ? v.total : v.balance)}</span>
            {badge}
          </span>
          <Icon name="chevron_right" size={20} color="#B5AA9C" style={{ transform: open ? 'rotate(90deg)' : undefined, flex: 'none', transition: 'transform .15s' }} />
        </button>
        {open ? (
          <div style={{ padding: '2px 16px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {timeline.length ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {timeline.map((c, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingLeft: 12, borderLeft: '2px solid #E6DDD1' }}>
                    <span style={{ fontSize: 15, lineHeight: '21px' }}>{c.text}</span>
                    <span style={{ ...small, fontSize: 13 }}>{actorName(s, c.by)} · {stampOf(c.at, fds)}</span>
                  </div>
                ))}
              </div>
            ) : null}
            <input value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void saveNote(); }} placeholder={t('finance.bill.notePlaceholder')} aria-label={t('finance.bill.callNote')}
              style={{ ...phoneField, width: '100%' }} />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <PillBtn onClick={saveNote}>{t('finance.bill.saveNote')}</PillBtn>
              {canRemind ? <PillBtn tone="primary" onClick={remind}>{t('finance.bill.sendReminder')}</PillBtn> : null}
            </div>
            {last ? <span style={{ ...small, fontSize: 13 }}>{t('finance.bill.lastReminder', { when: stampOf(last.at, fds) })}</span> : null}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <PillBtn icon="receipt_long" onClick={onOpenInvoice}>{t('finance.bill.openInvoice')}</PillBtn>
              {member ? <PillBtn icon="person" onClick={() => navigate(`/members/${member.id}/plan`)}>{t('finance.bill.openProfile')}</PillBtn> : null}
            </div>
          </div>
        ) : null}
      </div>
    );
  }
  return (
    <div style={{ borderTop: HAIR, ...(open ? { background: '#FBF8F4', margin: '0 calc(var(--hp) * -1)', padding: '0 var(--hp)', boxShadow: 'inset 3px 0 0 #2B231C' } : null) }}>
      <button type="button" onClick={onToggle} aria-expanded={open} aria-label={`${name}, ${inv.number}`}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: isPhone ? 12 : 16, padding: 'clamp(13px, 2.2vw, 18px) 0', minHeight: isPhone ? 60 : 78, border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', color: '#24201C', fontFamily: 'Inter' }}>
        {isPhone ? null : <Avatar name={name} tone={member?.photoTone} src={memberPhoto(member)} size={46} />}
        <span style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={rowTitle}>{name}</span>
          <span style={rowSub}>{sub}</span>
        </span>
        <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flex: 'none' }}>
          <span style={{ fontSize: 17, fontWeight: 500, fontVariantNumeric: 'tabular-nums', lineHeight: 1.3 }}>{rp(list === 'paid' || list === 'xero' ? v.total : v.balance)}</span>
          {badge}
        </span>
        <Icon name="expand_more" size={22} color="#6E5A43" style={{ transform: open ? 'rotate(180deg)' : undefined, flex: 'none' }} />
      </button>
      {open ? (
        <div style={{ padding: '0 0 18px', display: 'flex', flexDirection: 'column', gap: 14, paddingLeft: isPhone ? 0 : 62 }}>
          {timeline.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {timeline.map((c, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingLeft: 12, borderLeft: '2px solid #E6DDD1' }}>
                  <span style={{ fontSize: 15, lineHeight: '21px' }}>{c.text}</span>
                  <span style={small}>{actorName(s, c.by)} · {stampOf(c.at, fds)}</span>
                </div>
              ))}
            </div>
          ) : null}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <input value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void saveNote(); }} placeholder={t('finance.bill.notePlaceholder')} aria-label={t('finance.bill.callNote')}
              style={{ flex: '1 1 240px', minWidth: 0, height: 44, border: 'none', borderBottom: '1px solid #DDD1C2', borderRadius: 0, background: 'transparent', padding: '0 2px', fontSize: 16, fontFamily: 'Inter', color: '#24201C', outline: 'none' }} />
            <Button variant="secondary" size={44} onClick={saveNote} style={{ padding: '0 18px' }}>{t('finance.bill.saveNote')}</Button>
            {canRemind ? <Button size={44} onClick={remind} style={{ padding: '0 20px' }}>{t('finance.bill.sendReminder')}</Button> : null}
          </div>
          {last ? <span style={small}>{t('finance.bill.lastReminder', { when: stampOf(last.at, fds) })}</span> : null}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Button variant="secondary" size={44} icon="receipt_long" onClick={onOpenInvoice} style={{ padding: '0 16px' }}>{t('finance.bill.openInvoice')}</Button>
            {member ? <Button variant="secondary" size={44} icon="person" onClick={() => navigate(`/members/${member.id}/plan`)} style={{ padding: '0 16px' }}>{t('finance.bill.openProfile')}</Button> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
