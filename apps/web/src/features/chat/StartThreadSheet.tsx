// "New message" for staff: member -> family contact -> team -> message. Also used by the profile's Family tab (memberId preset).
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { approvedMembers, contactsOfMember, isPendingRow, memberName, memberShort, sortBy, type ThreadTopic } from '@cp/shared';
import { topicsOf } from '@cp/shared/rules/chat';
import { Avatar, Button, ChipGroup, FONT_BODY, Icon, Note, Pager, Sheet, TextField, usePaged } from '../../components/ui';
import { useT } from '../../lib/i18n';
import { useMe } from '../../lib/me';
import { useAct } from '../../lib/act';
import { useClub } from '../../store/replica';
import { Field, relText } from '../lobby/parts';
import { memberPhoto } from '../../lib/media';

/** Members per page in the member picker. */
export const MEMBERS_PER_PAGE = 8;
const label = { fontSize: 12, letterSpacing: '2px', textTransform: 'uppercase' as const, fontWeight: 500, lineHeight: '18px', color: '#6E5A43' };
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const norm = (v: string) => v.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

export function StartThreadSheet({ memberId, open, onClose }: { memberId?: string; open: boolean; onClose: () => void }) {
  if (!open) return null;
  return <Body memberId={memberId} onClose={onClose} />;
}

function Body({ memberId, onClose }: { memberId?: string; onClose: () => void }) {
  const t = useT();
  const s = useClub();
  const { role } = useMe();
  const act = useAct();
  const navigate = useNavigate();
  const topics = topicsOf(role);
  const [mid, setMid] = useState<string | null>(memberId && s.members[memberId] ? memberId : null);
  const [q, setQ] = useState('');
  const [fid, setFid] = useState<string | null>(null);
  const [topic, setTopic] = useState<ThreadTopic | null>(topics.length === 1 ? topics[0] : null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const member = mid ? s.members[mid] : undefined;
  const contacts = useMemo(
    () => (mid ? contactsOfMember(s, mid).filter((x) => x.link.appAccess && !isPendingRow(x.link) && !isPendingRow(x.contact)) : []),
    [s, mid],
  );
  const contactId = fid && contacts.some((c) => c.contact.id === fid) ? fid : contacts.length === 1 ? contacts[0].contact.id : null;
  const matches = useMemo(() => {
    const nq = norm(q);
    const all = sortBy(approvedMembers(s), (m) => m.firstName);
    return nq ? all.filter((m) => norm(memberName(m)).includes(nq) || contactsOfMember(s, m.id).some((c) => norm(c.contact.name).includes(nq))) : all;
  }, [s, q]);

  const paged = usePaged(matches, MEMBERS_PER_PAGE, norm(q));
  const ready = !!mid && !!contactId && !!topic && !!text.trim() && !busy;
  const send = async () => {
    if (!mid || !contactId || !topic) return;
    setBusy(true);
    const r = await act('thread.start', { memberId: mid, familyId: contactId, topic, text }, { ok: t('chat.sentTo', { name: s.familyContacts[contactId]?.firstName || '' }) });
    setBusy(false);
    if (!r.ok) return;
    onClose();
    if (typeof r.result.threadId === 'string') navigate(`/chat?thread=${r.result.threadId}`);
  };

  return (
    <Sheet open onClose={onClose} title={t('chat.startTitle')}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, flex: 'none' }}>
      {!topics.length ? <Note tone="ochre" icon="info">{t('chat.noTopic')}</Note> : null}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span style={label}>{t('chat.stepMember')}</span>
        {member ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 12, background: '#F3EEE8' }}>
            <Avatar name={memberName(member)} tone={member.photoTone} src={memberPhoto(member)} size={44} />
            <span style={{ flex: 1, minWidth: 0, fontSize: 17, fontWeight: 500, lineHeight: 1.35 }}>{memberName(member)}</span>
            {!memberId ? <Button variant="secondary" size={44} onClick={() => { setMid(null); setFid(null); }}>{t('chat.change')}</Button> : null}
          </div>
        ) : (
          <>
            <Field label={t('chat.searchMember')} value={q} onChange={setQ} autoFocus inputMode="search" />
            <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid #EFE7DC', borderRadius: 14, overflow: 'hidden' }}>
              {paged.rows.map((m, i) => (
                <button key={m.id} type="button" onClick={() => { setMid(m.id); setFid(null); }} className="h-row"
                  style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 16px', minHeight: 64, border: 'none', borderTop: i ? '1px solid #F0EAE1' : 'none', background: '#FFFFFF', textAlign: 'left', cursor: 'pointer', color: '#24201C', fontFamily: 'Inter' }}>
                  <Avatar name={memberName(m)} tone={m.photoTone} src={memberPhoto(m)} size={44} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 17, fontWeight: 500, lineHeight: 1.35 }}>{memberName(m)}</span>
                  <Icon name="chevron_right" size={22} color="#5E5852" />
                </button>
              ))}
              {!matches.length ? <div style={{ padding: '20px 16px', fontSize: 16, color: '#5E5852', textAlign: 'center' }}>{t('chat.noMembers')}</div> : null}
              {paged.pages > 1 ? <div style={{ borderTop: '1px solid #F0EAE1' }}><Pager page={paged.page} pages={paged.pages} onPage={paged.setPage} label={t('chat.pagerMembers')} /></div> : null}
            </div>
          </>
        )}
      </div>

      {member ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={label}>{t('chat.stepContact')}</span>
          {contacts.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} role="radiogroup" aria-label={t('chat.stepContact')}>
              {contacts.map(({ link, contact }) => {
                const sel = contactId === contact.id;
                return (
                  <button key={contact.id} type="button" role="radio" aria-checked={sel} onClick={() => setFid(contact.id)}
                    style={{ minHeight: 60, padding: '10px 16px', borderRadius: 14, border: sel ? '2px solid #24201C' : '1px solid #EFE7DC', background: sel ? '#FBF8F4' : '#FFFFFF', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', color: '#24201C', textAlign: 'left', fontFamily: 'Inter' }}>
                    <Icon name={sel ? 'radio_button_checked' : 'radio_button_unchecked'} size={24} color="#75624B" fill={sel ? 1 : 0} />
                    <span style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.4 }}>{contact.name}</span>
                      <span style={{ fontSize: FONT_BODY, color: '#5E5852', lineHeight: 1.4 }}>{`${cap(relText(t, link.relation))}${link.primary ? ' · ' + t('chat.primaryTag') : ''}`}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : <Note tone="ochre" icon="info">{t('chat.noContacts', { n: memberShort(member) })}</Note>}
        </div>
      ) : null}

      {member && contactId && topics.length > 1 ? (
        <ChipGroup label={<span style={label}>{t('chat.stepTeam')}</span>} options={topics.map((k) => ({ value: k, label: t('chat.topic.' + k) }))} value={topic} onChange={(v) => setTopic(v as ThreadTopic)} />
      ) : null}

      {member && contactId && topic ? (
        <>
          <TextField label={<span style={label}>{t('chat.stepText')}</span>} value={text} onChange={setText} multiline rows={4} autoFocus maxLength={2000} />
          <Button full size={56} icon="send" disabled={!ready} onClick={() => void send()}>{t('chat.sendMsg')}</Button>
        </>
      ) : null}
      </div>
    </Sheet>
  );
}
