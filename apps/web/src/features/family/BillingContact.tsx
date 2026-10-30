// Round 16 (KC): who looks after each parent's bills. Two sisters take turns paying their mother's invoices, so the billing contact passes it on here
// (family.setPrimary: at once, no approval; the unpaid invoices follow her). The contact's own email, where invoices go, can be changed too (it goes to the club).
import { useState } from 'react';
import { contactsOfMember, displayName, isPendingRow, type Member } from '@cp/shared';
import { billingContactOf } from '@cp/shared/rules/family';
import { isEmail } from '@cp/shared/rules/emails';
import { TextField } from '../../components/ui';
import { useAct } from '../../lib/act';
import { Chips, F, FamSheet, HAIR, List, TextLink } from './kit';
import { useFamilyCtx } from './useFamily';

export function BillingContacts({ members }: { members: Member[] }) {
  const { s, t, user } = useFamilyCtx();
  const act = useAct();
  const [passFor, setPassFor] = useState<Member | null>(null);
  const [to, setTo] = useState('');
  const [mailOpen, setMailOpen] = useState(false);
  const [mail, setMail] = useState('');
  const [tried, setTried] = useState(false);
  if (!user) return null;
  const me = s.familyContacts[user.id];
  const others = (m: Member) => contactsOfMember(s, m.id).filter((c) => c.contact.id !== user.id && !isPendingRow(c.link) && !isPendingRow(c.contact));
  const line = { fontSize: 14, lineHeight: '20px', color: F.muted } as const;

  const pass = async () => {
    if (!passFor || !to) return;
    const r = await act('family.setPrimary', { memberId: passFor.id, familyId: to }, { ok: t('family.passedT', { n: s.familyContacts[to]?.firstName || '' }) });
    if (r.ok) setPassFor(null);
  };
  const saveMail = async () => {
    setTried(true);
    const v = mail.trim().toLowerCase();
    if (v && !isEmail(v)) return;
    const r = await act('family.updateContact', { familyId: user.id, email: v }, { ok: t('family.emailSaved'), reviewText: t('family.emailSent') });
    if (r.ok) setMailOpen(false);
  };

  return (
    <>
      <List testId="billing-contacts">
        {members.map((m, i) => {
          const payer = billingContactOf(s, m.id);
          const mine = payer?.id === user.id;
          const can = mine && others(m).length > 0;
          return (
            <div key={m.id} data-testid="billing-contact" data-member={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderTop: i ? HAIR : 'none', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 160px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 15, fontWeight: 500, color: F.text }}>{displayName(m)}</span>
                <span style={line}>{mine ? t('family.billingYou') : t('family.billingWho', { n: payer?.firstName || '—' })}</span>
              </div>
              {can ? <TextLink testId="pass-billing" onClick={() => { setTo(others(m)[0].contact.id); setPassFor(m); }}>{t('family.passTo')}</TextLink> : null}
            </div>
          );
        })}
        <div data-testid="billing-email" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderTop: HAIR, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 160px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 15, fontWeight: 500, color: F.text }}>{t('email.label')}</span>
            <span style={{ ...line, overflowWrap: 'anywhere' }}>{me?.email ? t('family.invoicesTo', { e: me.email }) : t('family.noEmail')}</span>
          </div>
          <TextLink testId="edit-email" onClick={() => { setMail(me?.email ?? ''); setTried(false); setMailOpen(true); }}>{me?.email ? t('common.edit') : t('common.add')}</TextLink>
        </div>
      </List>
      <FamSheet open={!!passFor} onClose={() => setPassFor(null)} title={t('family.passTitle', { name: passFor ? displayName(passFor) : '' })} testId="pass-sheet" action={{ label: t('family.passGo'), onClick: () => void pass(), disabled: !to }}>
        {passFor ? <Chips label={t('family.passTo')} items={others(passFor).map((c) => ({ value: c.contact.id, label: c.contact.name }))} value={to} onChange={setTo} /> : null}
        <div style={{ fontSize: 15, lineHeight: '22px', color: F.soft }}>{t('family.passBody', { n: s.familyContacts[to]?.firstName || '' })}</div>
      </FamSheet>
      <FamSheet open={mailOpen} onClose={() => setMailOpen(false)} title={t('email.label')} testId="email-sheet" action={{ label: t('common.save'), onClick: () => void saveMail() }}>
        <TextField label={t('email.label')} value={mail} onChange={setMail} type="email" inputMode="email" placeholder={t('email.ph')} error={tried && mail.trim() && !isEmail(mail.trim().toLowerCase()) ? t('err.emailInvalid') : ''} />
      </FamSheet>
    </>
  );
}
