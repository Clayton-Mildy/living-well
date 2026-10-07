// Notes tab (design ScrProfile notes): staff-only notes (never shown to family) and notes shared with family. The author or management can
// edit or delete a note; every change is logged. The pinned shared note is the one the family sees on their Today page.
import { useState } from 'react';
import { actorName, live, sortBy, type MemberNote } from '@cp/shared';
import { Button, Icon, IconButton, Pager, SectionLabel, Sheet, TextField, usePaged } from '../../../components/ui';
import { noteForFamily } from '@cp/shared/rules/approvals';
import { PendingMark } from '../../../components/PendingMark';
import { cardStyle, HAIR, listCardStyle } from '../lib';
import type { P } from './types';

export function NotesTab({ p }: { p: P }) {
  const { s, m, t, fmt } = p;
  const [draft, setDraft] = useState('');
  const [kind, setKind] = useState<'staff' | 'family'>('staff');
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [del, setDel] = useState<string | null>(null);
  const myActor = p.me.kind === 'staff' ? `staff:${p.me.id}` : `family:${p.me.id}`;
  const open = p.st.key !== 'ended' && p.st.key !== 'pending';
  const writer = !p.family && open && (p.role === 'lobby' || p.role === 'nurse' || p.role === 'activity' || p.role === 'mgmt');
  const notes = sortBy(live(s.memberNotes).filter((n) => n.memberId === m.id), (n) => n.on + n.createdAt, -1);
  const internal = p.family ? [] : notes.filter((n) => n.visibility === 'staff');
  const shared = notes.filter((n) => n.visibility === 'family').map((n) => (p.family ? noteForFamily(n) : n)).filter((n): n is MemberNote => !!n); // a note waiting for approval is for staff only
  const pagedInternal = usePaged(internal, 6, m.id);
  const pagedShared = usePaged(shared, 6, m.id);
  const ok = !!draft.trim();
  const add = async () => {
    if (!ok) return;
    const r = await p.act('note.add', { memberId: m.id, visibility: kind, text: draft.trim() }, { ok: kind === 'family' ? t('profile.noteShared', { n: s.familyContacts[Object.values(s.familyLinks).find((l) => l.memberId === m.id && l.primary && !l.deletedAt)?.familyId || '']?.firstName || t('profile.theFamily') }) : t('profile.noteSaved') });
    if (r.ok) setDraft('');
  };
  const save = async (n: MemberNote) => {
    const r = await p.act('note.edit', { noteId: n.id, text: editText.trim() }, { ok: t('profile.noteUpdated') });
    if (r.ok) setEditing(null);
  };
  const row = (n: MemberNote, ri: number) => {
    const mine = writer && (p.mgmt || n.createdBy === myActor);
    const isEditing = editing === n.id;
    return (
      <div key={n.id} data-note={n.id} style={{ padding: '16px 0', borderTop: ri ? HAIR : 'none', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {isEditing ? (
            <>
              <TextField label={t('profile.editNote')} value={editText} onChange={setEditText} multiline rows={3} autoFocus />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Button size={44} disabled={!editText.trim()} onClick={() => save(n)}>{t('common.save')}</Button>
                <Button size={44} variant="secondary" onClick={() => setEditing(null)}>{t('common.cancel')}</Button>
              </div>
            </>
          ) : (
            <>
              <span style={{ fontSize: 15, lineHeight: '23px', whiteSpace: 'pre-line' }}>{n.text}</span>
              <span style={{ fontSize: 13, color: '#6B6259', lineHeight: 1.4 }}>
                {actorName(s, n.createdBy)} · {fmt.fds(n.on)}
                {n.editedAt ? ` · ${t('profile.edited', { n: actorName(s, n.editedBy), d: fmt.fds(n.editedAt.slice(0, 10)) })}` : ''}
              </span>
              {!p.family ? <PendingMark row={n} /> : null}
              {n.pinned ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#75624B', fontWeight: 600 }}><Icon name="push_pin" size={16} fill={1} />{t('profile.pinnedNote')}</span> : null}
            </>
          )}
        </div>
        {mine && !isEditing ? (
          <div style={{ display: 'flex', gap: 4, flex: 'none' }}>
            {n.visibility === 'family' ? <IconButton icon="push_pin" fill={n.pinned ? 1 : 0} bordered={false} label={n.pinned ? t('profile.unpin') : t('profile.pin')} onClick={() => p.act('note.edit', { noteId: n.id, pinned: !n.pinned }, { ok: n.pinned ? t('profile.unpinned') : t('profile.pinned') })} /> : null}
            <IconButton icon="edit" bordered={false} label={t('profile.editNote')} onClick={() => { setEditing(n.id); setEditText(n.text); }} />
            <IconButton icon="delete" bordered={false} label={t('profile.deleteNote')} onClick={() => setDel(n.id)} />
          </div>
        ) : null}
      </div>
    );
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(18px, 2.8vw, 28px)', maxWidth: 860 }}>
      {writer ? (
        <div style={cardStyle}>
          <SectionLabel>{t('profile.addNote')}</SectionLabel>
          <TextField label={<span className="sr-only">{t('profile.noteLabel')}</span>} value={draft} onChange={setDraft} multiline rows={3} placeholder={t('profile.notePlaceholder')} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} role="radiogroup" aria-label={t('profile.whoCanSee')}>
              {([['staff', t('common.staffOnly'), 'lock'], ['family', t('common.sharedFam'), 'group']] as const).map(([k, label, icon]) => (
                <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)} style={{ height: 40, padding: '0 16px 0 12px', borderRadius: 12, border: kind === k ? '1px solid #24201C' : '1px solid #DCD3C8', background: kind === k ? '#24201C' : '#FFFFFF', color: kind === k ? '#FFFFFF' : '#24201C', fontSize: 14, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'Inter' }}>
                  <Icon name={icon} size={18} />{label}
                </button>
              ))}
            </div>
            <Button disabled={!ok} onClick={add}>{t('profile.addNoteBtn')}</Button>
          </div>
        </div>
      ) : null}
      {!p.family ? (
        <div style={listCardStyle}>
          <div style={{ padding: '20px 0 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="lock" size={20} color="#75624B" />
            <span style={{ flex: 1 }}><SectionLabel>{t('common.staffOnly')}</SectionLabel></span>
          </div>
          {pagedInternal.rows.map((n, i) => row(n, i))}
          {!internal.length ? <div style={{ padding: '4px 0 20px', fontSize: 15, color: '#6B6259' }}>{t('profile.noNotes')}</div> : null}
          {pagedInternal.pages > 1 ? <div style={{ padding: '12px 0 16px', borderTop: HAIR }}><Pager page={pagedInternal.page} pages={pagedInternal.pages} onPage={pagedInternal.setPage} label={`${t('profile.pagerNotes')} · ${t('common.staffOnly')}`} /></div> : null}
        </div>
      ) : null}
      <div style={listCardStyle}>
        <div style={{ padding: '20px 0 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="group" size={20} color="#75624B" />
          <span style={{ flex: 1 }}><SectionLabel>{t('common.sharedFam')}</SectionLabel></span>
          {p.family ? <span style={{ fontSize: 13, color: '#6B6259', lineHeight: 1.4 }}>{t('profile.fromClubTeam')}</span> : null}
        </div>
        {pagedShared.rows.map((n, i) => row(n, i))}
        {!shared.length ? <div style={{ padding: '4px 0 20px', fontSize: 15, color: '#6B6259' }}>{t('profile.noNotes')}</div> : null}
        {pagedShared.pages > 1 ? <div style={{ padding: '12px 0 16px', borderTop: HAIR }}><Pager page={pagedShared.page} pages={pagedShared.pages} onPage={pagedShared.setPage} label={`${t('profile.pagerNotes')} · ${t('common.sharedFam')}`} /></div> : null}
      </div>
      <Sheet open={!!del} onClose={() => setDel(null)} title={t('profile.deleteNote')}
        footer={<div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}><Button variant="secondary" onClick={() => setDel(null)}>{t('common.cancel')}</Button><Button variant="danger" icon="delete" onClick={async () => { if (del) await p.act('note.delete', { noteId: del }, { ok: t('profile.noteDeleted') }); setDel(null); }}>{t('common.delete')}</Button></div>}>
        <div style={{ fontSize: 15, lineHeight: '22px' }}>{t('profile.deleteNoteSub')}</div>
      </Sheet>
    </div>
  );
}
