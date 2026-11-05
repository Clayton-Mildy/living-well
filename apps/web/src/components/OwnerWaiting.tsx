// Round 16 (KC): Management's pricing, holiday and weekly-budget changes wait for the Owner. Plans, the calendar day sheet and Budget show each waiting request as a quiet
// "Waiting for owner · …" row; the person who asked can Withdraw it. The Owner decides them in Approvals › Owner.
import type { ChangeRequest, ClubState, ReviewSection } from '@cp/shared';
import { rp } from '@cp/shared';
import { ownerChanges, ownerWhat, pendingOwnerRequests } from '@cp/shared/actions/ownerGate';
import { useState } from 'react';
import { Button, Dialog, TextField } from './ui';
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
export function ownerChangeRows(s: ClubState, cr: Pick<ChangeRequest, 'action' | 'input'>, t: TFn): { label: string; from?: string; to: string }[] {
  const tr = (v: string) => (v.startsWith('approvals.owner.chg.') ? t(v) : v);
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

/** The waiting owner requests of one section (optionally only some, e.g. one day's), each with Withdraw for the person who asked. Nothing when none wait. */
export function OwnerWaiting({ section, only, pad = '10px 16px' }: { section: ReviewSection; only?: (cr: ChangeRequest) => boolean; pad?: string }) {
  const s = useClub();
  const t = useT();
  const fmt = useFmt();
  const act = useAct();
  const { id, realRole } = useMe();
  const [rej, setRej] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const list = pendingOwnerRequests(s, section).filter((c) => !only || only(c));
  if (!list.length) return null;
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
  const btn = { height: 38, padding: '0 16px', borderRadius: 999, border: 'none', fontFamily: 'Inter', fontSize: 14, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' } as const;
  return (
    <div data-testid="owner-waiting" style={{ display: 'flex', flexDirection: 'column' }}>
      {list.map((cr) => {
        const rows = ownerChangeRows(s, cr, t);
        const own = cr.submittedBy === `staff:${id}`;
        return (
          <div key={cr.id} data-owner-request={cr.id} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: pad, minHeight: 44 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: 999, background: '#7A5510', flex: 'none' }} />
              <span style={{ flex: 1, minWidth: 0, fontSize: 14, lineHeight: 1.35, color: '#7A5510', fontWeight: 500, overflowWrap: 'anywhere' }}>{t('approvals.owner.waiting', { what: ownerWhatText(s, cr, t, fmt) })}</span>
              {own && !isOwner ? (
                <button type="button" className="cp-press" onClick={() => void act('review.withdraw', { crId: cr.id }, { ok: t('approvals.owner.withdrawn') })}
                  style={{ flex: 'none', height: 44, padding: '0 6px', border: 'none', background: 'transparent', color: 'var(--accent, #75624B)', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter' }}>{t('approvals.owner.withdraw')}</button>
              ) : null}
            </div>
            {rows.length ? (
              <div data-testid="owner-changes" style={{ display: 'flex', flexDirection: 'column', paddingLeft: 17 }}>
                {rows.map((r, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, padding: '4px 0', fontSize: 14, lineHeight: 1.35 }}>
                    <span style={{ color: '#6B6259' }}>{r.label}</span>
                    <span style={{ textAlign: 'right', overflowWrap: 'anywhere' }}>{r.from !== undefined && r.from !== r.to ? <span style={{ color: '#8A8078' }}>{r.from} → </span> : null}<strong style={{ fontWeight: 600 }}>{r.to}</strong></span>
                  </div>
                ))}
              </div>
            ) : null}
            {isOwner ? (
              <div style={{ display: 'flex', gap: 8, paddingLeft: 17 }}>
                <button type="button" className="cp-press cp-fill" disabled={busy} onClick={() => { setReason(''); setTried(false); setRej(cr.id); }} style={{ ...btn, background: 'transparent', color: '#24201C', boxShadow: 'inset 0 0 0 1px #D8D2CA' }}>{t('reviews.reject')}</button>
                <button type="button" className="cp-press" disabled={busy} onClick={() => void approve(cr.id)} style={{ ...btn, background: '#24201C', color: '#FFFFFF' }}>{t('approvals.approveOne')}</button>
              </div>
            ) : null}
          </div>
        );
      })}
      <Dialog open={!!rej} onClose={() => setRej(null)} eyebrow={t('reviews.reject')} title={t('approvals.rejectTitleOne')} maxWidth={520}
        footer={<><Button variant="secondary" onClick={() => setRej(null)}>{t('common.cancel')}</Button><Button variant="danger" icon="close" disabled={busy} onClick={reject}>{t('reviews.reject')}</Button></>}>
        <TextField label={t('approvals.rejectReasonOne')} value={reason} onChange={setReason} multiline rows={3} autoFocus error={tried && !reason.trim() ? t('err.noteRequired') : false} name="rejectReason" />
      </Dialog>
    </div>
  );
}
