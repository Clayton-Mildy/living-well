// Family tab (design ScrProfile family): contacts with real app-access tags, `tel:` links, who is the primary billing contact for
// this member, each contact's sign-in username (read-only; a family member sees only their own), management's "Reset password",
// "Message on WhatsApp" (a wa.me link per contact: the club talks to families on WhatsApp, there is no in-app inbox) and (lobby, management) edit / add / link / remove contacts.
import { useState } from 'react';
import { contactsOfMember, fmtPhone, hasKey, isPendingRow, linksOfFamily, memberShort, waUrl, type FamilyContact, type Member } from '@cp/shared';
import { Avatar, Button, Icon, Sheet } from '../../../components/ui';
import { api, ApiError } from '../../../lib/api';
import { say } from '../../../store/ui';
import { HAIR, relLabel } from '../lib';
import { ListCard, PendingBanner, Tag28 } from './parts';
import type { P } from './types';

export function FamilyTab({ p }: { p: P }) {
  const { s, m, t } = p;
  const [reset, setReset] = useState<FamilyContact | null>(null);
  const [busy, setBusy] = useState(false);
  const rows = contactsOfMember(s, m.id);
  const canEdit = !p.family && (p.role === 'lobby' || p.role === 'mgmt') && p.canEdit;
  const canReset = !p.family && p.mgmt;
  const doReset = async () => {
    if (!reset || busy) return;
    setBusy(true);
    try {
      await api('/api/account/reset-password', { body: { userId: reset.id } });
      say(t('profile.resetDone', { n: reset.name }));
      setReset(null);
    } catch (e) {
      say(e instanceof ApiError && hasKey(e.code) ? t(e.code, e.params) : t('profile.resetFailed'), { tone: 'error', icon: 'error' });
    } finally {
      setBusy(false);
    }
  };
  const other = (familyId: string): Member[] => linksOfFamily(s, familyId).filter((l) => l.memberId !== m.id && !isPendingRow(l) && s.members[l.memberId] && !s.members[l.memberId].deletedAt).map((l) => s.members[l.memberId]);
  const ph = p.isPhone; // round 6, phone (staff and family): the list card is an iOS grouped section
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: ph ? 14 : 'clamp(18px, 2.8vw, 28px)', maxWidth: 860 }}>
      <PendingBanner p={p} tab="family" />
      <ListCard phone={ph} title={t('profile.familyTitle')}>
        {rows.map(({ link, contact }, idx) => {
          const pending = isPendingRow(link) || isPendingRow(contact);
          const access = link.appAccess && !pending;
          return (
            <div key={link.id} style={{ display: 'flex', alignItems: 'center', gap: '10px 14px', padding: '18px 0', borderTop: idx ? HAIR : 'none', flexWrap: 'wrap' }}>
              <Avatar name={contact.name} size={46} />
              <div style={{ flex: '1 1 200px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 17, fontWeight: 500, lineHeight: 1.4 }}>{contact.name}</span>
                <span style={{ fontSize: 14, color: '#6B6259', lineHeight: 1.4 }}>{relLabel(t, link.relation)} · {fmtPhone(contact.phone)}</span>
                {!p.family || contact.id === p.me.id ? <span data-username={contact.username || ''} style={{ fontSize: 14, color: '#6B6259', lineHeight: 1.4 }}>{contact.username ? t('profile.usernameValue', { u: contact.username }) : t('profile.noLogin')}</span> : null}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {link.primary && !pending ? <Tag28 icon="receipt_long" label={t('profile.primaryBilling')} bg="#24201C" fg="#FFFFFF" /> : null}
                {pending ? <Tag28 icon="hourglass_top" label={link.primary ? t('profile.pendingPrimary') : t('common.pendingApproval')} bg="#F6ECD6" fg="#7A5510" /> : null}
                {access ? <Tag28 icon="smartphone" label={t('profile.usesApp')} bg="#F3EEE8" /> : !pending ? <Tag28 icon="phonelink_erase" label={t('profile.noApp')} bg="#F0EAE1" fg="#5E5852" /> : null}
                {other(contact.id).map((x) => <Tag28 key={x.id} icon="link" label={t('profile.alsoFamilyOf', { n: memberShort(x) })} bg="#E8E1D8" />)}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
                {canEdit && !pending ? <Button variant="secondary" size={44} icon="edit" onClick={() => p.open('contact', { familyId: contact.id })} label={t('profile.editContact', { n: contact.name })}>{t('common.edit')}</Button> : null}
                {canReset && !pending && contact.username ? <Button variant="secondary" size={44} icon="lock_reset" onClick={() => setReset(contact)} label={t('profile.resetPasswordFor', { n: contact.name })}>{t('profile.resetPassword')}</Button> : null}
                {!p.family && !pending && waUrl(contact.phone) ? (
                  <a href={waUrl(contact.phone)} target="_blank" rel="noopener" data-testid="wa-link" aria-label={`${t('profile.messageFamily')} · ${contact.name}`} className="h-cream cp-press"
                    style={{ height: 40, padding: '0 14px', borderRadius: 10, border: '1px solid #DCD3C8', background: '#FFFFFF', color: '#24201C', fontFamily: 'Inter', fontSize: 14, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none', whiteSpace: 'nowrap', flex: 'none' }}>
                    <Icon name="chat" size={19} weight={300} />{t('profile.messageFamily')}
                  </a>
                ) : null}
                <a href={`tel:${contact.phone}`} aria-label={t('profile.callName', { n: contact.name })} style={{ width: 44, height: 44, borderRadius: 999, border: '1px solid #DCD3C8', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#75624B', textDecoration: 'none', flex: 'none' }}>
                  <Icon name="call" size={20} />
                </a>
              </div>
            </div>
          );
        })}
      </ListCard>
      <Sheet open={!!reset} onClose={() => setReset(null)} title={t('profile.resetTitle')}
        footer={<div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}><Button variant="secondary" onClick={() => setReset(null)}>{t('common.cancel')}</Button><Button icon="lock_reset" disabled={busy} onClick={doReset}>{t('profile.resetPassword')}</Button></div>}>
        <div style={{ fontSize: 15, lineHeight: '22px' }}>{t('profile.resetSub', { n: reset?.name || '' })}</div>
      </Sheet>
    </div>
  );
}
