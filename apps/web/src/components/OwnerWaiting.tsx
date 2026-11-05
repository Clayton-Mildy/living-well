// Owner approvals (KC): one quiet "● n waiting for owner" marker; the details, change rows and buttons open in a sheet. Round 16 (KC): Management's pricing, holiday and weekly-budget changes wait for the Owner. Plans, the calendar day sheet and Budget show each waiting request as a quiet
// "Waiting for owner · …" row; the person who asked can Withdraw it. The Owner decides them in Approvals › Owner.
import type { ChangeRequest, ClubState, ReviewSection } from '@cp/shared';
import { rp } from '@cp/shared';
import { ownerChanges, ownerWhat, pendingOwnerRequests } from '@cp/shared/actions/ownerGate';
import { useEffect, useState } from 'react';
import { actorName } from '@cp/shared';
import { Button, Dialog, Icon, Sheet, TextField } from './ui';
import { useNow } from '../lib/clock';
import { say } from '../store/ui';
import { useAct } from '../lib/act';
import { useFmt, useT, type TFn } from '../lib/i18n';
import { useMe } from '../lib/me';
import { useClub } from '../store/replica';

interface Fmt { fd: (d: string, o: Intl.DateTimeFormatOptions) => string }
/** One line for an owner request: "Close Mon 14 Dec · Staff training day". */
export function ownerWhatText(s: ClubState, cr: Pick<ChangeRequest, 'action' | 'input'>, t: TFn, fmt: Fmt): string {
  const w = ownerWhat(s, cr.action, cr.input);
  const p = w.params;
  return t(w.key, { date: p.date ? fmt.fd(p.date, { weekday: 'short', day: 'numeric', month: 'short' }) : '', title: p.title ?? '', name: p.name ?? '', amount: p.amount !== undefined ? rp(p.amount) : '', n: p.n ?? '', a: p.a ?? '', b: p.b ?? '', c: p.c ?? '' });
}

/** What an owner request changes as translated label / old / new rows; a price request with nothing different says so. Shown in Approvals › Owner and under each "Waiting for owner" row. */
export function ownerChangeRows(s: ClubState, cr: Pick<ChangeRequest, 'action' | 'input'>, t: TFn, fmt: Fmt): { label: string; from?: string; to: string }[] {
  const day = (d: string) => fmt.fd(d, { weekday: 'short', day: 'numeric', month: 'short' });
  const span = (v: string) => v.slice(5).split('~').map(day).join(' – ');
  const tr = (v: string) => (v.includes('|date:') ? v.split('|').map((x, k) => (k === 0 ? t(x) : x.startsWith('date:') ? span(x) : x)).join(' · ') // a removed event: kind | date | title
    : v.startsWith('approvals.owner.chg.') || v.startsWith('cal.t_') ? t(v) : v.startsWith('date:') ? span(v) : v);
  const rows = ownerChanges(s, cr.action, cr.input).map((r) => ({ label: tr(r.label), ...(r.from !== undefined ? { from: tr(r.from) } : {}), to: tr(r.to) }));
  return !rows.length && cr.action === 'prices.set' ? [{ label: t('approvals.kind.owner'), to: t('approvals.owner.noChanges') }] : rows;
}

/** A holiday request touches this day: the day it asks for (or a day in its range), or the day of the event it changes or removes. */
export function ownerRequestOn(s: ClubState, cr: Pick<ChangeRequest, 'input'>, date: string): boolean {
  const i = (cr.input ?? {}) as { date?: string; endDate?: string | null; eventId?: string };
  const ev = i.eventId ? s.calendarEvents[i.eventId] : undefined;
  const on = (from?: string, to?: string | null) => !!from && from <= date && date <= (to || from);
  return on(i.date, i.endDate ?? (i.date ? undefined : ev?.endDate)) || on(ev?.date, ev?.endDate);
}

/** The waiting owner requests of one section (optionally only some, e.g. one day's) as one tappable marker; the sheet lists each with its change rows and Reject / Approve (Owner) or Withdraw (the asker). Nothing when none wait. */
export function OwnerWaiting({ section, only, pad = '0 16px' }: { section: ReviewSection; only?: (cr: ChangeRequest) => boolean; pad?: string }) {
  const s = useClub();
  const t = useT();
  const fmt = useFmt();
  const act = useAct();
  const { today } = useNow();
  const { id, realRole } = useMe();
  const [openSheet, setOpenSheet] = useState(false);
  const [rej, setRej] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const list = pendingOwnerRequests(s, section).filter((c) => !only || only(c));
  const n = list.length;
  useEffect(() => { if (!n) setOpenSheet(false); }, [n]);
  if (!n) return null;
  const isOwner = realRole === 'owner';
  const approve = async (crId: string) => { setBusy(true); await act('review.approve', { crId }, { ok: t('reviews.approved') }); setBusy(false); };
  const reject = async () => {
    setTried(true);
    if (!rej || !reason.trim() || busy) return;
    setBusy(true);
    const r = await act('approval.reject', { type: 'owner', ids: [rej], reason: reason.trim() }, { silent: true });
    setBusy(false);
    if (r.ok) { say(t('approvals.rejectedOne'), { icon: 'task_alt' }); setRej(null); setReason(''); setTried(false); }
  };
  const when = (dt: string) => (dt.slice(0, 10) === today ? t('common.today') : fmt.fds(dt.slice(0, 10))) + ' ' + dt.slice(11, 16);
  const btn = { height: 38, padding: '0 16px', borderRadius: 999, border: 'none', fontFamily: 'Inter', fontSize: 14, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' } as const;
  return (
    <div data-testid="owner-waiting" style={{ padding: pad }}>
      <button type="button" className="cp-press" data-testid="owner-marker" onClick={() => setOpenSheet(true)}
        style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', minHeight: 44, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'Inter', textAlign: 'left' }}>
        <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: 999, background: '#7A5510', flex: 'none' }} />
        <span style={{ flex: 1, minWidth: 0, fontSize: 14, lineHeight: 1.35, color: '#7A5510', fontWeight: 500 }}>{t(isOwner ? 'approvals.owner.toApprove' : 'approvals.owner.waitingN', { n })}</span>
        <Icon name="chevron_right" size={20} color="#7A5510" />
      </button>
      <Sheet open={openSheet} onClose={() => setOpenSheet(false)} title={t(isOwner ? 'approvals.owner.toApproveTitle' : 'approvals.owner.waitingTitle', { n })}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {list.map((cr, k) => {
            const rows = ownerChangeRows(s, cr, t, fmt);
            const own = cr.submittedBy === `staff:${id}`;
            return (
              <div key={cr.id} data-owner-request={cr.id} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '12px 0', borderTop: k ? '1px solid var(--hairline, #E2E2E6)' : 'none' }}>
                <span style={{ fontSize: 15, lineHeight: 1.35, color: '#24201C', fontWeight: 500, overflowWrap: 'anywhere' }}>{ownerWhatText(s, cr, t, fmt)}</span>
                <span style={{ fontSize: 13, lineHeight: '18px', color: '#6B6259' }}>{actorName(s, cr.submittedBy)} · {when(cr.createdAt)}</span>
                {rows.length ? (
                  <div data-testid="owner-changes" style={{ display: 'flex', flexDirection: 'column' }}>
                    {rows.map((r, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, padding: '4px 0', fontSize: 14, lineHeight: 1.35 }}>
                        <span style={{ color: '#6B6259' }}>{r.label}</span>
                        <span style={{ textAlign: 'right', overflowWrap: 'anywhere' }}>{r.from !== undefined && r.from !== r.to ? <span style={{ color: '#8A8078' }}>{r.from} → </span> : null}<strong style={{ fontWeight: 600 }}>{r.to}</strong></span>
                      </div>
                    ))}
                  </div>
                ) : null}
                {isOwner ? (
                  <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
                    <button type="button" className="cp-press cp-fill" disabled={busy} onClick={() => { setReason(''); setTried(false); setRej(cr.id); }} style={{ ...btn, background: 'transparent', color: '#24201C', boxShadow: 'inset 0 0 0 1px #D8D2CA' }}>{t('reviews.reject')}</button>
                    <button type="button" className="cp-press" disabled={busy} onClick={() => void approve(cr.id)} style={{ ...btn, background: '#24201C', color: '#FFFFFF' }}>{t('approvals.approveOne')}</button>
                  </div>
                ) : own ? (
                  <div style={{ display: 'flex', paddingTop: 4 }}>
                    <button type="button" className="cp-press cp-fill" onClick={() => void act('review.withdraw', { crId: cr.id }, { ok: t('approvals.owner.withdrawn') })} style={{ ...btn, background: 'transparent', color: '#24201C', boxShadow: 'inset 0 0 0 1px #D8D2CA' }}>{t('approvals.owner.withdraw')}</button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </Sheet>
      <Dialog open={!!rej} onClose={() => setRej(null)} eyebrow={t('reviews.reject')} title={t('approvals.rejectTitleOne')} maxWidth={520}
        footer={<><Button variant="secondary" onClick={() => setRej(null)}>{t('common.cancel')}</Button><Button variant="danger" icon="close" disabled={busy} onClick={reject}>{t('reviews.reject')}</Button></>}>
        <TextField label={t('approvals.rejectReasonOne')} value={reason} onChange={setReason} multiline rows={3} autoFocus error={tried && !reason.trim() ? t('err.noteRequired') : false} name="rejectReason" />
      </Dialog>
    </div>
  );
}
