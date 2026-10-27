// Round 8 (the "CitraPremier Family App" prototype): the Me tab. Who is signed in, the parents with where they are today, Billing and Contacts,
// health alerts per parent, then language, your details, password and sign out.
// Round 8c, on a laptop it is ONE column, 640px at most, the same groups as the phone. Round 8d: the sidebar says "Me" again, so the title is "Me" on every width
// (Billing and Contacts are pushed from here and have their "‹ Me" link on every width too).
import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { initials, isPrimaryFor, live, displayName, rp, type Member } from '@cp/shared';
import { dayStateOf } from '@cp/shared/rules/family';
import { familyBill } from '@cp/shared/rules/familyMe';
import { canSign, signingOf } from '@cp/shared/rules/signing';
import { useAct } from '../../lib/act';
import { useSession } from '../../store/session';
import { useTextSize } from '../../shell/FamilyShell';
import { F, FamPage, FillCard, LargeTitle, List, ListRow, Cap, Switch, useFamWide } from './kit';
import { useFamilyCtx, useFamilySel } from './useFamily';
import { DetailsSheet, PasswordSheet } from './MeSheets';

export function FamilyMe() {
  const { s, t, fmt, now, user } = useFamilyCtx();
  const { all, choices } = useFamilySel();
  const navigate = useNavigate();
  const act = useAct();
  const lang = useSession((x) => x.lang);
  const [textSize, setTextSize] = useTextSize();
  const setLang = useSession((x) => x.setLang);
  const signOut = useSession((x) => x.signOut);
  const [sheet, setSheet] = useState<null | 'details' | 'password'>(null);
  const wide = useFamWide();
  if (!user) return null;
  const { today } = now;
  const members = all.map((id) => s.members[id]).filter(Boolean) as Member[];
  const links = live(s.familyLinks).filter((l) => l.familyId === user.id && all.includes(l.memberId));
  const rel = Array.from(new Set(links.map((l) => t('enq.rel_' + l.relation)))).join(' / ');
  const pays = all.some((id) => isPrimaryFor(s, user.id, id));
  const role = pays ? t('fme.rolePays', { rel }) : rel;

  // where each parent is today, from the club's own day rules (checked in = at the club, checked out = went home, else home)
  const where = (m: Member): { v: string; color: string; weight: number } => {
    const st = dayStateOf(s, m, today);
    if (st.kind === 'here') return { v: t('fme.atClub'), color: F.sage, weight: 500 };
    if (st.kind === 'home') return { v: t('fme.wentHome', { t: st.at }), color: F.muted, weight: 400 };
    if (st.kind === 'ended') return { v: t('fme.memEnded'), color: F.muted, weight: 400 };
    if (st.kind === 'upcoming') return { v: t('fme.memStarts', { d: fmt.fds(st.start) }), color: F.muted, weight: 400 };
    return { v: t('fme.homeToday'), color: F.muted, weight: 400 };
  };

  // Billing: what this contact has to pay, or who pays when it is not them
  const bill = familyBill(s, user.id, all, today);
  const billing = !bill.pays
    ? { v: bill.payers[0] ? t('fme.someonePays', { n: bill.payers[0].firstName }) : '', color: F.muted, weight: 400 }
    : bill.total > 0
      ? { v: bill.overdue ? t('status.overdue') : t('fme.dueAmt', { a: rp(bill.total) }), color: F.rust, weight: 500 }
      : { v: t('family.invAllPaid'), color: F.sage, weight: 500 };

  // round 14 (D): membership forms the club sent for this contact to sign. The row opens the first parent's Documents (with the sign sheet when one waits).
  const toSign = members.filter((m) => signingOf(m)?.status === 'sent' && canSign(s, m.id, user.id));
  const docsTo = toSign.length ? `/profile?member=${toSign[0].id}&sign=1` : members[0] ? `/profile?member=${members[0].id}&sec=docs` : '';

  const alertMembers = (choices.length ? choices : all).map((id) => s.members[id]).filter(Boolean) as Member[];
  const alertOn = (id: string) => links.find((l) => l.memberId === id)?.healthAlerts ?? true;

  const toggleLang = () => {
    const next = lang === 'en' ? 'id' : 'en';
    setLang(next);
    void act('account.updateFamily', { familyId: user.id, lang: next }, { silent: true });
  };
  const out = () => { signOut(); navigate('/login'); };

  // one row per parent: the health-alerts switch (they sit with Billing and Contacts on a phone, with the settings on a laptop)
  const alertRows = alertMembers.map((m) => {
    const on = alertOn(m.id);
    const label = alertMembers.length > 1 ? t('fme.healthAlertsFor', { n: displayName(m) }) : t('fme.healthAlerts');
    return <ListRow key={m.id} icon="notifications" label={label} testId={`me-alerts-${m.id}`} right={<Switch on={on} label={label} onClick={() => void act('family.setHealthAlerts', { memberId: m.id, on: !on }, { silent: true })} />} />;
  });

  const accountCard = (
    <FillCard pad={wide ? 16 : 14} gap={wide ? 14 : 12} style={{ flexDirection: 'row', alignItems: 'center' }} testId="me-account">
      <span aria-hidden="true" style={{ width: wide ? 56 : 52, height: wide ? 56 : 52, borderRadius: 999, background: F.ink, color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: wide ? 18 : 17, fontWeight: 500, flex: 'none' }}>{initials(user.contact.name)}</span>
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <span style={{ fontSize: wide ? 19 : 18, fontWeight: 500, overflowWrap: 'anywhere' }}>{user.contact.name}</span>
        {role ? <span style={{ fontSize: wide ? 14 : 13, color: F.muted }}>{role}</span> : null}
      </span>
    </FillCard>
  );
  const family = members.length ? (
    <Group title={t(members.length > 1 ? 'fme.yourFamily' : 'fme.yourParent')} testId="me-parents">
      {members.map((m, i) => {
        const w = where(m);
        return <ListRow key={m.id} first={!i} icon="person" label={displayName(m)} value={w.v} valueColor={w.color} valueWeight={w.weight} onClick={() => navigate('/profile?member=' + m.id)} testId={`me-parent-${m.id}`} />;
      })}
    </Group>
  ) : null;
  const linksList = (
    <List testId="me-links">
      <ListRow first icon="receipt_long" label={t('nav.billing')} value={billing.v} valueColor={billing.color} valueWeight={billing.weight} onClick={() => navigate('/billing')} testId="me-billing" />
      <ListRow icon="contacts" label={t('nav.contacts')} onClick={() => navigate('/contacts')} testId="me-contacts" />
      {docsTo ? <ListRow icon="description" label={t('sign.docs')} value={toSign.length ? t('sign.toSign', { n: toSign.length }) : ''} valueColor={F.rust} valueWeight={500} onClick={() => navigate(docsTo)} testId="me-docs" /> : null}
      {alertRows}
    </List>
  );
  const account = (
    <List testId="me-account-list">
      <ListRow first icon="translate" label={t('shell.language')} value={lang === 'id' ? 'Bahasa Indonesia' : 'English'} onClick={toggleLang} testId="me-language" />
      {/* KC round 10: "Larger" text for family members who find the default small */}
      <ListRow icon="format_size" label={t('fme.textSize')} value={t(textSize === 'large' ? 'fme.textLarge' : 'fme.textNormal')} onClick={() => setTextSize(textSize === 'large' ? 'normal' : 'large')} testId="me-text-size" />
      <ListRow icon="badge" label={t('fme.details')} onClick={() => setSheet('details')} testId="me-details" />
      <ListRow icon="lock" label={t('fme.password')} onClick={() => setSheet('password')} testId="me-password" />
      <ListRow icon="logout" label={t('shell.signOut')} danger chevron={false} onClick={out} testId="me-signout" />
    </List>
  );

  // a laptop: one column of at most 640px under the page's left edge
  const body = (
    <>
      {accountCard}
      {family}
      {linksList}
      {account}
    </>
  );
  return (
    <FamPage testId="FamilyMe" gap={wide ? 0 : 14} wide>
      <LargeTitle>{t('nav.me')}</LargeTitle>
      {wide ? <div style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 18, marginTop: 18 }}>{body}</div> : body}
      {sheet === 'details' ? <DetailsSheet onClose={() => setSheet(null)} /> : null}
      {sheet === 'password' ? <PasswordSheet onClose={() => setSheet(null)} /> : null}
    </FamPage>
  );
}

/** A titled group: a caps label over a grey list. */
function Group({ title, children, testId }: { title: string; children: ReactNode; testId?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <Cap>{title}</Cap>
      <List testId={testId}>{children}</List>
    </div>
  );
}
