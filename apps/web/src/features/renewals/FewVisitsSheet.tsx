// Few visits, the list (round 17): who came fewer than 5 days this month, not yet called first, each with the billing contact's Call and WhatsApp and a Called tag.
// A tap opens "Log a call". A pushed full screen on phones, a side panel wider. The front desk and management log calls; others only read.
import { useMemo, useState, type CSSProperties } from 'react';
import { contactsOfMember, isPendingRow, listName, memberName, planLabel, planOn, waUrl } from '@cp/shared';
import { fewVisitsState, type FewRow } from '@cp/shared/rules/fewVisits';
import { Avatar, Drawer, Icon, PhoneScreen } from '../../components/ui';
import { useDevice } from '../../hooks/useDevice';
import { useNow } from '../../lib/clock';
import { useFmt, useLang, useT } from '../../lib/i18n';
import { useMe } from '../../lib/me';
import { memberPhoto } from '../../lib/media';
import { useClub } from '../../store/replica';
import { fewLine } from './FewVisitsCard';
import { VisitCallSheet } from './VisitCallSheet';

const INK = '#24201C';
const MUTED = '#6B6259';
const short = { day: 'numeric', month: 'short' } as const;
const round = (size: number): CSSProperties => ({ width: size, height: size, borderRadius: 999, background: 'var(--fill, #F4F4F5)', color: INK, display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', flex: 'none' });

export function FewVisitsSheet({ onClose }: { onClose: () => void }) {
  const s = useClub();
  const t = useT();
  const lang = useLang();
  const { fd } = useFmt();
  const { today } = useNow();
  const { isPhone } = useDevice();
  const { role } = useMe();
  const [open, setOpen] = useState<string | null>(null);
  const st = useMemo(() => fewVisitsState(s, today), [s, today]);
  const canLog = role === 'lobby' || role === 'mgmt';

  /** the billing contact: the primary family member with an approved link first */
  const contactOf = (memberId: string) => {
    const cs = contactsOfMember(s, memberId);
    return (cs.find((x) => !isPendingRow(x.link) && !isPendingRow(x.contact)) ?? cs[0])?.contact;
  };
  const visitsLine = (r: FewRow) => (r.last ? t(r.visits === 1 ? 'renewals.few.row1' : 'renewals.few.row', { n: r.visits, d: fd(r.last, short) }) : t('renewals.few.rowNone'));

  const rowEl = (r: FewRow, i: number) => {
    const m = s.members[r.memberId];
    if (!m) return null;
    const name = listName(m);
    const c = contactOf(m.id);
    const wa = c ? waUrl(c.phone) : null;
    const main = (
      <>
        <Avatar name={memberName(m)} member={m} tone={m.photoTone} src={memberPhoto(m)} size={42} open={false} />
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span style={{ fontSize: 16, lineHeight: '22px', fontWeight: 500, overflowWrap: 'anywhere' }}>{name}</span>
          <span style={{ fontSize: 13, lineHeight: '19px', color: MUTED }}>{planLabel(s, planOn(m, today).plan, lang)}</span>
          <span data-testid="few-visits-line" style={{ fontSize: 14, lineHeight: '20px', fontVariantNumeric: 'tabular-nums' }}>{visitsLine(r)}</span>
        </span>
        {r.called ? <span data-testid="few-called" style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 9px 2px 6px', borderRadius: 999, background: 'var(--press, #EEEEF0)', color: MUTED, fontSize: 12, lineHeight: '18px', fontWeight: 500 }}><Icon name="check" size={14} />{t('renewals.few.called')}</span> : null}
      </>
    );
    const mainStyle = { flex: '1 1 0', minWidth: 0, display: 'flex', alignItems: 'center', gap: 12, padding: 0, border: 'none', background: 'transparent', textAlign: 'left', fontFamily: 'Inter', color: INK, minHeight: 44 } as const;
    return (
      <div key={m.id} data-few={m.id} data-called={r.called || undefined} className={canLog ? 'cp-tap' : undefined}
        style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', minHeight: 68, boxSizing: 'border-box', padding: '8px 12px 8px 16px', backgroundImage: i ? 'linear-gradient(var(--hairline, #E2E2E6), #E2E2E6)' : 'none', backgroundSize: 'calc(100% - 70px) 0.5px', backgroundPosition: 'right top', backgroundRepeat: 'no-repeat' }}>
        {canLog
          ? <button type="button" data-log={m.id} aria-label={`${t('renewals.few.log')}: ${name}`} onClick={() => setOpen(m.id)} className="cp-tap-target" style={{ ...mainStyle, cursor: 'pointer' }}>{main}</button>
          : <div style={mainStyle}>{main}</div>}
        {c ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 'none' }}>
            <a href={`tel:${c.phone}`} data-testid="few-call" aria-label={t('renewals.callWho', { name: c.name })} title={t('renewals.callWho', { name: c.name })} className="cp-press cp-fill" style={round(44)}><Icon name="call" size={19} /></a>
            {wa ? <a href={wa} target="_blank" rel="noreferrer" data-testid="few-wa" aria-label={t('renewals.waWho', { name: c.name })} title={t('renewals.waWho', { name: c.name })} className="cp-press cp-fill" style={round(44)}><Icon name="chat" size={19} /></a> : null}
          </span>
        ) : null}
      </div>
    );
  };

  const title = t('renewals.few.title');
  const body = (
    <>
      {isPhone
        ? <h1 style={{ margin: 0, fontSize: 24, lineHeight: '28px', fontWeight: 400, letterSpacing: '-0.6px', color: '#2B231C' }}>{title}</h1>
        : <h2 className="cp-serif cp-serif-up" style={{ margin: 0, fontSize: 20, lineHeight: '28px', fontWeight: 500, color: INK }}>{title}</h2>}
      <span data-testid="few-summary" style={{ fontSize: 14, lineHeight: '20px', color: MUTED, marginTop: -14 }}>{fewLine(t, fd, st)}</span>
      {st.rows.length
        ? <div data-testid="few-list" className="cp-grey" style={{ background: 'var(--fill, #F4F4F5)', borderRadius: 16, overflow: 'hidden' }}>{st.rows.map(rowEl)}</div>
        : <span style={{ fontSize: 15, color: MUTED }}>{t('renewals.few.none')}</span>}
      {open ? <VisitCallSheet memberId={open} onClose={() => setOpen(null)} /> : null}
    </>
  );
  if (isPhone) return <PhoneScreen open onClose={onClose} label={title} back={t('renewals.title')}>{body}</PhoneScreen>;
  return <Drawer open onClose={onClose} label={title}>{body}</Drawer>;
}
