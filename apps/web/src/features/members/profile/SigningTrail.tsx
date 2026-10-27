// Round 14 (D): where the membership form stands. A status badge (Draft → Sent → Signed by family → Countersigned → Stamped; a physical-meterai form
// reads Stamped · Physical meterai) that opens its timeline (who, when; a sent-back note under its step). Shared by the staff and the family profile.
import { useState } from 'react';
import { actorName, type BadgeKey, type ClubState, type Signing, type SignStatus } from '@cp/shared';
import { signTrail } from '@cp/shared/rules/signing';
import { Icon, StatusBadge } from '../../../components/ui';
import { useFmt, useT } from '../../../lib/i18n';
import { useClub } from '../../../store/replica';

const KIND: Record<SignStatus, BadgeKey> = { draft: 'pending', sent: 'outstanding', signed: 'paid', countersigned: 'paid', stamped: 'paid' };

/** Who did a step. A staff member the family cannot see by name reads as the club, never a raw id. */
function who(s: ClubState, by: string, club: string): string {
  const name = actorName(s, by);
  return by.startsWith('staff:') && name === by.slice(6) ? club : name;
}

export function SigningTrail({ sig }: { sig: Signing }) {
  const t = useT();
  const fmt = useFmt();
  const s = useClub();
  const [open, setOpen] = useState(false);
  const label = sig.meterai === 'physical' ? `${t('sign.status.stamped')} · ${t('sign.physicalDone')}` : t('sign.status.' + sig.status);
  const note = (st: SignStatus) => [...sig.steps].reverse().find((x) => x.status === st)?.note;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
      <button type="button" data-testid="sign-badge" aria-expanded={open} aria-label={`${label} · ${t('sign.timeline')}`} onClick={() => setOpen(!open)}
        style={{ minHeight: 40, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 2, fontFamily: 'Inter', color: '#6B6259' }}>
        <StatusBadge kind={KIND[sig.status]} label={label} small />
        <Icon name={open ? 'expand_less' : 'expand_more'} size={20} />
      </button>
      {sig.meteraiSerial ? <div style={{ fontSize: 13, lineHeight: 1.4, color: '#6B6259' }}>{t('sign.eMeterai')} · {t('sign.serial', { s: sig.meteraiSerial })}</div> : null}
      {open ? (
        <ol data-testid="sign-trail" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
          {signTrail(sig).map((x, i) => {
            const done = !!x.at;
            const hint = x.status === 'draft' ? note('draft') : undefined; // why a countersign was rejected
            return (
              <li key={x.status + i} data-status={x.status} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 14, lineHeight: '20px', color: done ? '#24201C' : '#8A8078' }}>
                <Icon name={done ? 'check_circle' : 'radio_button_unchecked'} size={18} fill={done ? 1 : 0} color={done ? 'var(--accent, #75624B)' : '#B8B0A6'} />
                <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <span><span style={{ fontWeight: 500 }}>{t('sign.status.' + x.status)}</span>{x.at ? ` · ${fmt.fds(x.at.slice(0, 10))}, ${x.at.slice(11)}` : ''}{x.by ? ` · ${who(s, x.by, t('activity.theClub'))}` : ''}</span>
                  {hint && done ? <span style={{ fontSize: 13, color: '#6B6259', overflowWrap: 'anywhere' }}>{hint}</span> : null}
                </span>
              </li>
            );
          })}
        </ol>
      ) : null}
    </div>
  );
}
