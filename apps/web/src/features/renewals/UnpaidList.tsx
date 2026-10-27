// Next month, Unpaid tab (round 14): the overdue invoices, one row each. Name, what is owed and how late, the next date (hold or stop), the last call, and
// Call / WhatsApp for the family that pays. A tap opens the sheet to note a call or record a payment. The ones that need a call first are on top.
import { useMemo, useState, type CSSProperties } from 'react';
import { fmtPhone, listName, memberName, waUrl, type FamilyContact } from '@cp/shared';
import { renewalContact } from '@cp/shared/rules/renewals';
import { unpaidRows, type UnpaidRow } from '@cp/shared/rules/unpaid';
import { Avatar, EmptyState, Icon } from '../../components/ui';
import { useDevice } from '../../hooks/useDevice';
import { useNow } from '../../lib/clock';
import { useFmt, useT } from '../../lib/i18n';
import { memberPhoto } from '../../lib/media';
import { useClub } from '../../store/replica';
import { whenText } from '../members/lib';
import { UnpaidSheet } from './UnpaidSheet';
import { lateLine, nextDateText } from './lib';

const dm = { day: 'numeric', month: 'short' } as const;
const round: CSSProperties = { width: 44, height: 44, borderRadius: 999, border: 'none', background: 'var(--fill, #F4F4F5)', color: '#24201C', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none', cursor: 'pointer', textDecoration: 'none' };

/** The person to call: the family contact that pays the invoice, else the member's primary contact. */
function useUnpaidContact() {
  const s = useClub();
  return (r: UnpaidRow): FamilyContact | undefined => s.familyContacts[r.invoice.payerFamilyId] ?? renewalContact(s, r.member.id)?.contact;
}
export function UnpaidList() {
  const s = useClub();
  const t = useT();
  const fmt = useFmt();
  const { today } = useNow();
  const { isPhone } = useDevice();
  const contactOf = useUnpaidContact();
  const rows = useMemo(() => unpaidRows(s, today), [s, today]);
  const [open, setOpen] = useState<string | null>(null);

  const rowEl = (r: UnpaidRow, i: number) => {
    const name = listName(r.member);
    const c = contactOf(r);
    const last = r.last
      ? r.promisedOn ? t('unpaid.promisedFor', { d: fmt.fd(r.promisedOn, dm) }) : t('unpaid.lastCall', { outcome: t(`unpaid.outcome.${r.last.outcome}`), when: whenText(fmt.fds, today, r.last.at, t) })
      : t('unpaid.noCall');
    return (
      <div key={r.invoice.id} data-unpaid={r.invoice.id} data-called={r.last ? '1' : '0'}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: isPhone ? '4px 12px 4px 0' : '4px 0', fontFamily: 'Inter', color: '#24201C', borderTop: i && !isPhone ? '0.5px solid var(--hairline, #E2E2E6)' : 'none', backgroundImage: i && isPhone ? 'linear-gradient(var(--hairline, #E2E2E6), #E2E2E6)' : 'none', backgroundSize: 'calc(100% - 70px) 0.5px', backgroundPosition: 'right top', backgroundRepeat: 'no-repeat' }}>
        <button type="button" aria-label={t('unpaid.openSheet', { name })} onClick={() => setOpen(r.invoice.id)} className="cp-tap"
          style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 12, padding: isPhone ? '8px 0 8px 16px' : '8px 0', border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', fontFamily: 'Inter', color: 'inherit' }}>
          <Avatar name={memberName(r.member)} member={r.member} tone={r.member.photoTone} src={memberPhoto(r.member)} size={42} />
          <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span style={{ fontSize: 16, lineHeight: '22px', fontWeight: 500, overflowWrap: 'anywhere' }}>{name}</span>
            <span data-testid="unpaid-late" style={{ fontSize: 14, lineHeight: '20px', fontVariantNumeric: 'tabular-nums' }}>{lateLine(t, r)}</span>
            <span data-testid="unpaid-next" style={{ fontSize: 14, lineHeight: '20px' }}>{nextDateText(t, fmt.fd, r, today, r.invoice.callNotes.length > 0)}</span>
            <span data-testid="unpaid-last" style={{ fontSize: 13, lineHeight: '19px', color: '#6B6259' }}>{last}</span>
          </span>
        </button>
        {c ? (
          <>
            <a href={`tel:${c.phone}`} aria-label={`${t('common.call')} ${c.name} ${fmtPhone(c.phone)}`} className="cp-press cp-fill" style={round}><Icon name="call" size={20} /></a>
            <a href={waUrl(c.phone)} target="_blank" rel="noreferrer" aria-label={`${t('renewals.whatsapp')} ${c.name}`} className="cp-press cp-fill" style={round}><Icon name="chat" size={20} /></a>
          </>
        ) : null}
      </div>
    );
  };

  return (
    <div data-testid="unpaid-list" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {rows.length
        ? <div className="cp-grey" style={{ background: 'var(--fill, #F4F4F5)', borderRadius: 16, overflow: 'hidden', padding: isPhone ? 0 : '4px clamp(18px, 3vw, 28px)' }}>{rows.map(rowEl)}</div>
        : <EmptyState icon="payments" title={t('unpaid.none')} />}
      {open ? <UnpaidSheet invoiceId={open} onClose={() => setOpen(null)} /> : null}
    </div>
  );
}
