// Round 8 (the "CitraPremier Family App" prototype): Contacts, a page pushed from Me. The front desk (WhatsApp and call), the club's emergency line,
// then the doctors and services the club shares with families, each with a round call button.
// Round 8c, on a laptop the front desk is one wide card (logo, name and hours, WhatsApp and Call side by side) and the groups sit in two columns. Round 8d: the
// sidebar has no Contacts item any more (it is pushed from Me), so the "‹ Me" link shows on every width.
import { firstOfRole, fmtPhone, waUrl, type DirectoryContact } from '@cp/shared';
import { staffFirst } from '@cp/shared/rules/family';
import { familyContactGroups } from '@cp/shared/rules/familyMe';
import { Fragment, type CSSProperties, type ReactNode } from 'react';
import { Icon } from '../../components/ui';
import { BackLink, Cap, F, FamPage, FillCard, HAIR, List, PageTitle, useBack, useFamWide } from './kit';
import { useFamilyCtx } from './useFamily';

const telOf = (p: string) => 'tel:' + p.replace(/[^\d+]/g, '');
const GROUP_KEY = { doctor: 'fme.gDoctor', service: 'fme.gService', supplier: 'fme.gSupplier' } as const;
const FONT = 'Inter, system-ui, sans-serif';

export function FamilyContacts() {
  const { s, t, fmt } = useFamilyCtx();
  const back = useBack('/me');
  const wide = useFamWide();
  const desk = firstOfRole(s, 'lobby');
  const phone = desk?.phone || s.club.settings.emergencyPhone;
  const wa = waUrl(phone);
  const emergency = s.club.settings.emergencyPhone;
  // the club is closed at weekends: Monday to Friday, named in the family's language
  const days = `${fmt.fd('2024-01-01', { weekday: 'short' })}–${fmt.fd('2024-01-05', { weekday: 'short' })}`;
  const hours = `${days} ${s.club.settings.open}–${s.club.settings.close}`;
  const sub = [desk ? staffFirst(s, desk.id) : '', hours].filter(Boolean).join(' · ');
  const what = (d: DirectoryContact) => (fmt.lang === 'id' && d.whatId ? d.whatId : d.what);
  const groups = familyContactGroups(s);

  const callBtn = (name: string, number: string) => (
    <a href={telOf(number)} aria-label={t('fme.callName', { n: name })} className="cp-fill cp-press" data-testid="contact-call"
      style={{ flex: 'none', width: 40, height: 40, borderRadius: 999, background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: F.bronze, textDecoration: 'none' }}>
      <Icon name="call" size={20} color={F.bronze} />
    </a>
  );
  const row = (name: string, subline: string, number: string, i: number, testId?: string) => (
    <div key={name + number} data-testid={testId} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 10px 11px 14px', borderTop: i ? HAIR : 'none' }}>
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <span style={{ fontSize: 15, fontWeight: 500, overflowWrap: 'anywhere' }}>{name}</span>
        <span style={{ fontSize: 13, color: F.muted, overflowWrap: 'anywhere' }}>{subline}</span>
      </span>
      {callBtn(name, number)}
    </div>
  );
  const pill: CSSProperties = { height: wide ? 44 : 46, borderRadius: 999, fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, textDecoration: 'none', fontFamily: FONT, boxSizing: 'border-box' };

  const frontDesk = (
    <FillCard pad={wide ? 18 : 16} gap={12} radius={26} testId="front-desk" style={wide ? { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 14 } : undefined}>
      <div style={{ display: 'flex', alignItems: 'center', gap: wide ? 14 : 12, ...(wide ? { flex: '1 1 260px', minWidth: 0 } : {}) }}>
        <img src="/favicon.svg" alt="" width={wide ? 48 : 44} height={wide ? 48 : 44} style={{ width: wide ? 48 : 44, height: wide ? 48 : 44, borderRadius: 12, objectFit: 'cover', flex: 'none' }} />
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span style={{ fontSize: wide ? 17 : 16, fontWeight: 500 }}>{t('fme.frontDesk', { club: s.club.name })}</span>
          <span style={{ fontSize: wide ? 14 : 13, color: F.muted }}>{sub}</span>
        </span>
      </div>
      <div style={wide ? { display: 'flex', gap: 8, flex: 'none' } : { display: 'grid', gridTemplateColumns: wa ? '1fr 1fr' : '1fr', gap: 8 }}>
        {wa ? <a href={wa} target="_blank" rel="noopener" data-testid="wa-club" className="cp-press" style={{ ...pill, background: F.ink, color: '#FFFFFF', ...(wide ? { padding: '0 20px' } : {}) }}><Icon name="chat" size={19} color="#FFFFFF" />{t('fme.whatsapp')}</a> : null}
        <a href={telOf(phone)} data-testid="call-club" className="cp-press" style={{ ...pill, background: '#FFFFFF', color: F.ink, boxShadow: `inset 0 0 0 1px ${F.line}`, ...(wide ? { padding: '0 20px' } : {}) }}><Icon name="call" size={19} color={F.ink} />{t('fme.callClub')}</a>
      </div>
    </FillCard>
  );
  const emergencyBlock = emergency ? (
    <div key="emergency" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <Cap>{t('fme.emergency')}</Cap>
      <List testId="contacts-emergency">{row(t('fme.emergencyLine'), `${t('fme.emergencySub')} · ${fmtPhone(emergency)}`, emergency, 0)}</List>
    </div>
  ) : null;
  const groupBlocks = groups.map((g) => (
    <div key={g.kind} data-testid="contact-group" data-kind={g.kind} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <Cap>{t(GROUP_KEY[g.kind])}</Cap>
      <List>{g.items.map((d, i) => row(d.name, what(d), d.phone, i))}</List>
    </div>
  ));

  // a laptop: the front desk across the top, then the emergency line, the doctors and the services in two columns
  return (
    <FamPage testId="FamilyContacts" gap={wide ? 22 : 14} wide style={wide ? { maxWidth: 1100 } : undefined}>
      <BackLink label={t('nav.me')} onClick={back} />
      <PageTitle>{t('nav.contacts')}</PageTitle>
      {frontDesk}
      {wide ? <TwoColumns>{[emergencyBlock, ...groupBlocks]}</TwoColumns> : <>{emergencyBlock}{groupBlocks}</>}
    </FamPage>
  );
}

/** Blocks dealt out alternately into two columns (so a short block never leaves a hole beside a tall one). */
function TwoColumns({ children }: { children: ReactNode[] }) {
  const blocks = children.filter(Boolean);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 24, alignItems: 'start' }}>
      {[0, 1].map((k) => <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 24, minWidth: 0 }}>{blocks.filter((_, i) => i % 2 === k).map((b, i) => <Fragment key={i}>{b}</Fragment>)}</div>)}
    </div>
  );
}
