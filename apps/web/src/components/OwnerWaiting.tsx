// Round 16 (KC): Management's pricing, holiday and weekly-budget changes wait for the Owner. Plans, the calendar day sheet and Budget show each waiting request as a quiet
// "Waiting for owner · …" row; the person who asked can Withdraw it. The Owner decides them in Approvals › Owner.
import type { ChangeRequest, ClubState, ReviewSection } from '@cp/shared';
import { rp } from '@cp/shared';
import { ownerWhat, pendingOwnerRequests } from '@cp/shared/actions/ownerGate';
import { useAct } from '../lib/act';
import { useFmt, useT, type TFn } from '../lib/i18n';
import { useMe } from '../lib/me';
import { useClub } from '../store/replica';

interface Fmt { fd: (d: string, o: Intl.DateTimeFormatOptions) => string }
/** One line for an owner request: "Close Mon 14 Dec · Staff training day". */
export function ownerWhatText(s: ClubState, cr: Pick<ChangeRequest, 'action' | 'input'>, t: TFn, fmt: Fmt): string {
  const w = ownerWhat(s, cr.action, cr.input);
  const p = w.params;
  return t(w.key, { date: p.date ? fmt.fd(p.date, { weekday: 'short', day: 'numeric', month: 'short' }) : '', title: p.title ?? '', name: p.name ?? '', amount: p.amount !== undefined ? rp(p.amount) : '' });
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
  const { id } = useMe();
  const list = pendingOwnerRequests(s, section).filter((c) => !only || only(c));
  if (!list.length) return null;
  return (
    <div data-testid="owner-waiting" style={{ display: 'flex', flexDirection: 'column' }}>
      {list.map((cr) => (
        <div key={cr.id} data-owner-request={cr.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: pad, minHeight: 44 }}>
          <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: 999, background: '#7A5510', flex: 'none' }} />
          <span style={{ flex: 1, minWidth: 0, fontSize: 14, lineHeight: 1.35, color: '#7A5510', fontWeight: 500, overflowWrap: 'anywhere' }}>{t('approvals.owner.waiting', { what: ownerWhatText(s, cr, t, fmt) })}</span>
          {cr.submittedBy === `staff:${id}` ? (
            <button type="button" className="cp-press" onClick={() => void act('review.withdraw', { crId: cr.id }, { ok: t('approvals.owner.withdrawn') })}
              style={{ flex: 'none', height: 44, padding: '0 6px', border: 'none', background: 'transparent', color: 'var(--accent, #75624B)', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter' }}>{t('approvals.owner.withdraw')}</button>
          ) : null}
        </div>
      ))}
    </div>
  );
}
