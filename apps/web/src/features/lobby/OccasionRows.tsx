// Birthdays and anniversaries as rows (round 14): a cake or a party popper, one line, a tap opens the member. A birthday row also carries Prepare for the people
// who can ask for a celebration (front desk, activity, management): it opens the request form on that member and day, and once a request is live the row shows
// its status instead (Requested / Confirmed). Used by Arrivals' "Also today" and by the activity team's Today.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listName, live, type ISODate } from '@cp/shared';
import type { Occasion } from '@cp/shared/rules/occasions';
import { Icon } from '../../components/ui';
import { PillBtn } from '../mgmt/common';
import { CelebrationSheet, type CelebrationPrefill } from '../mgmt/CelebrationSheet';
import { useT, useLang } from '../../lib/i18n';
import { occasionLine } from '../../lib/occasions';
import { useNow } from '../../lib/clock';
import { useMe } from '../../lib/me';
import { useClub } from '../../store/replica';

/** Who can ask for a celebration (the server's rule for celebration.request). */
export const canPrepare = (role: string | null | undefined) => role === 'lobby' || role === 'activity' || role === 'mgmt';

export function OccasionRows({ items, testId }: { items: Occasion[]; testId?: string }) {
  const t = useT();
  const lang = useLang();
  const navigate = useNavigate();
  const s = useClub();
  const { today } = useNow();
  const { role } = useMe();
  const [prefill, setPrefill] = useState<CelebrationPrefill | null>(null);
  const mayPrepare = canPrepare(role);
  /** The live celebration for this member on this day: requested or confirmed (a declined or cancelled one leaves the row open to prepare again). */
  const liveFor = (memberId: string, date: ISODate) => live(s.celebrations || {}).find((c) => c.memberId === memberId && c.date === date && (c.status === 'requested' || c.status === 'confirmed'));
  return (
    <>
      <div data-testid={testId} style={{ display: 'flex', flexDirection: 'column' }}>
        {items.map((o) => {
          const cel = o.kind === 'birthday' && mayPrepare ? liveFor(o.member.id, o.date) : undefined;
          return (
            <div key={o.kind + o.member.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button type="button" data-occasion={o.kind} data-member={o.member.id} onClick={() => navigate(`/members/${o.member.id}`)} aria-label={t('occasions.open', { name: listName(o.member) })}
                style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'flex-start', gap: 8, minHeight: 44, padding: '6px 0', border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', fontFamily: 'Inter', color: '#24201C' }}>
                <Icon name={o.kind === 'birthday' ? 'cake' : 'celebration'} size={18} weight={300} color="var(--eyebrow, #6E5A43)" style={{ marginTop: 2 }} />
                <span style={{ flex: 1, minWidth: 0, fontSize: 15, lineHeight: '22px', overflowWrap: 'anywhere' }}>{occasionLine(t, lang, o, today, listName(o.member))}</span>
              </button>
              {o.kind === 'birthday' && mayPrepare ? (
                cel
                  ? <span data-testid={`celebration-status-${o.member.id}`} data-status={cel.status} className="cp-fill" style={{ flex: 'none', height: 28, padding: '0 10px', borderRadius: 999, background: 'var(--fill, #F4F4F5)', color: '#24201C', fontSize: 13, fontWeight: 500, display: 'inline-flex', alignItems: 'center' }}>{t(cel.status === 'confirmed' ? 'occ.confirmed' : 'occ.requested')}</span>
                  : <span data-testid={`prepare-${o.member.id}`} style={{ flex: 'none', display: 'inline-flex' }}><PillBtn tone="secondary" icon="celebration" label={`${t('occ.prepare')}: ${listName(o.member)}`} onClick={() => setPrefill({ memberId: o.member.id, kind: 'birthday', date: o.date })}>{t('occ.prepare')}</PillBtn></span>
              ) : null}
            </div>
          );
        })}
      </div>
      <CelebrationSheet open={!!prefill} onClose={() => setPrefill(null)} prefill={prefill ?? undefined} />
    </>
  );
}
