// Kitchen feedback (design ScrKfeed): meal feedback from families and staff-logged calls, a reply that reaches the family on WhatsApp
// (simulated in the demo; the replies are kept on the card), edit a reply, reopen or close an item.
import { useState } from 'react';
import { actorName, memberName } from '@cp/shared';
import { feedbackReplies, replyTarget } from '@cp/shared/rules/kitchenOps';
import type { Feedback } from '@cp/shared';
import { Avatar, Button, EmptyState, GROUP_HEAD, Icon, Note, PageHead, Pager, Pin, usePaged, FONT_SMALL } from '../../components/ui';
import { useDevice, padFor } from '../../hooks/useDevice';
import { useT, useFmt } from '../../lib/i18n';
import { useAct } from '../../lib/act';
import { useNow } from '../../lib/clock';
import { useClub } from '../../store/replica';
import { LogFeedbackSheet } from './LogFeedbackSheet';
import { FeedbackBadge, OutlineButton, PillButton, RowPill, TextButton, bronzeInput } from './parts';
import { useFeedbackList } from './vals';
import { memberPhoto } from '../../lib/media';

export function KitchenFeedback() {
  const t = useT();
  const { device, isPhone } = useDevice();
  const list = useFeedbackList();
  // KC round 6: closed feedback is kept out of the way, behind a button at the bottom of the page
  const active = list.filter((f) => f.status !== 'closed');
  const closed = list.filter((f) => f.status === 'closed');
  const paged = usePaged(active, 8);
  const pagedClosed = usePaged(closed, 8);
  const [showClosed, setShowClosed] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const open = list.filter((f) => f.status === 'open').length;
  return (
    <>
      <div className={isPhone ? 'cp-native' : undefined} style={{ padding: padFor(device), display: 'flex', flexDirection: 'column', gap: isPhone ? 14 : 16 }}>
        <PageHead eyebrow={t('kitchen.fb.open', { n: open })} title={t('kitchen.fb.title')}
          right={!isPhone ? <Button icon="call" onClick={() => setLogOpen(true)}>{t('kitchen.log.open')}</Button> : undefined} />
        {paged.rows.map((f) => <FeedbackCard key={f.id} f={f} />)}
        <Pager page={paged.page} pages={paged.pages} onPage={paged.setPage} label={t('kitchen.fb.title')} />
        {!list.length ? <EmptyState icon="forum" title={t('kitchen.fb.empty')} /> : !active.length ? <EmptyState icon="task_alt" title={t('kitchen.fb.noneOpen')} /> : null}
        {closed.length ? (
          <>
            <Button variant="secondary" size={44} icon={showClosed ? 'expand_less' : 'expand_more'} onClick={() => setShowClosed((v) => !v)} style={{ alignSelf: 'center', marginTop: 8 }}>
              {showClosed ? t('kitchen.fb.hideClosed') : t('kitchen.fb.showClosed', { n: closed.length })}
            </Button>
            {showClosed ? (
              <section aria-label={t('kitchen.fb.closedTitle', { n: closed.length })} data-testid="closed-feedback" style={{ display: 'flex', flexDirection: 'column', gap: isPhone ? 14 : 16 }}>
                <h2 style={{ ...GROUP_HEAD, padding: isPhone ? '0 16px' : 0 }}>{t('kitchen.fb.closedTitle', { n: closed.length })}</h2>
                {pagedClosed.rows.map((f) => <FeedbackCard key={f.id} f={f} />)}
                <Pager page={pagedClosed.page} pages={pagedClosed.pages} onPage={pagedClosed.setPage} label={t('kitchen.fb.closedTitle', { n: closed.length })} />
              </section>
            ) : null}
          </>
        ) : null}
      </div>
      {isPhone ? <Pin icon="call" label={t('kitchen.log.open')} onClick={() => setLogOpen(true)} /> : null}
      <LogFeedbackSheet open={logOpen} onClose={() => setLogOpen(false)} />
    </>
  );
}

function FeedbackCard({ f }: { f: Feedback }) {
  const t = useT();
  const { isPhone } = useDevice();
  const { fd, fds } = useFmt();
  const s = useClub();
  const act = useAct();
  const { today } = useNow();
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);
  const m = s.members[f.memberId];
  const contact = f.familyId ? s.familyContacts[f.familyId] : undefined;
  const link = f.familyId ? Object.values(s.familyLinks).find((l) => l.familyId === f.familyId && l.memberId === f.memberId) : undefined;
  // the family's own words are the quote above; the kitchen's replies follow it (an edited reply is another one)
  const replies = feedbackReplies(f);
  const lastReply = replies[replies.length - 1];
  const target = replyTarget(s, f);
  const canReply = f.status !== 'closed' && !!target && (f.status === 'open' || editing);
  const when = f.createdAt.slice(0, 10) === today ? t('common.today').toLocaleLowerCase() : fds(f.createdAt.slice(0, 10));
  const from = f.source === 'staff'
    ? t('kitchen.fb.fromStaff', { who: actorName(s, f.createdBy), when })
    : link ? t('kitchen.fb.from', { who: contact ? contact.name : t('kitchen.fb.theFamily'), rel: t('kitchen.rel.' + link.relation).toLocaleLowerCase(), when }) : t('kitchen.fb.fromNoRel', { who: contact ? contact.name : t('kitchen.fb.theFamily'), when });
  const day = fd(f.mealDate, { weekday: 'long' });
  const ok = draft.trim().length > 0;
  const send = async () => {
    if (!ok) return;
    // clear at once: the reply shows immediately, and "Edit reply" may be tapped before the server answers
    const text = draft;
    const wasEditing = editing;
    setDraft('');
    setEditing(false);
    const r = await act('feedback.reply', { feedbackId: f.id, text }, { ok: t('kitchen.fb.sent', { name: contact?.firstName ?? t('kitchen.fb.theFamily') }) });
    if (!r.ok) { setDraft((d) => d || text); if (wasEditing) setEditing(true); }
  };
  const setStatus = (status: Feedback['status'], msg: string) => act('feedback.setStatus', { feedbackId: f.id, status }, { ok: msg });
  const metaOf = (x: { by: string; at: string }) => `${actorName(s, x.by)} · ${x.at.slice(0, 10) === today ? t('common.today') : fds(x.at.slice(0, 10))}, ${x.at.slice(11, 16)}`;
  return (
    // round 6, phone: one flat white card per feedback (no outline), the row actions as small pills
    <div data-testid="feedback-card" data-status={f.status} className="cp-card-pad" style={{ background: '#FFFFFF', border: isPhone ? 'none' : '1px solid #EFE7DC', borderRadius: isPhone ? 14 : 16, boxShadow: 'var(--card-shadow)', padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {m ? <Avatar name={memberName(m)} tone={m.photoTone} src={memberPhoto(m)} size={44} /> : null}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 17, fontWeight: 500, lineHeight: 1.4 }}>{m ? memberName(m) : '—'}</span>
          <span style={{ fontSize: 'max(13px, var(--cp-body, 0px))', color: '#5E5852', lineHeight: 1.4 }}>{from}</span>
        </div>
        <FeedbackBadge status={f.status} />
      </div>
      <span style={{ alignSelf: 'flex-start', fontSize: FONT_SMALL, color: '#6B6259', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <Icon name="restaurant" size={16} color="#75624B" />
        {f.dish ? t('kitchen.fb.dishLine', { dish: f.dish, day }) : t('kitchen.fb.dayOnly', { day })}
      </span>
      <p style={{ margin: 0, fontSize: 16, lineHeight: '24px' }}>“{f.text}”</p>

      {replies.map((x) => (
        <div key={x.id} data-testid="reply" style={{ padding: '12px 16px', borderRadius: 12, background: '#EAF1EC', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 16, lineHeight: '22px' }}>{x.text}</span>
          <span style={{ fontSize: 'max(13px, var(--cp-body, 0px))', color: '#5E5852', lineHeight: 1.4 }}>{metaOf(x)}</span>
        </div>
      ))}
      {f.status === 'answered' && !replies.length ? <Note tone="cream" icon="call">{t('kitchen.fb.byPhone')}</Note> : null}

      {canReply ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void send(); }} placeholder={t(editing ? 'kitchen.fb.editPh' : 'kitchen.fb.replyPh')} aria-label={t('kitchen.fb.replyLabel')} maxLength={1000}
            style={{ ...bronzeInput, flex: isPhone ? '1 1 160px' : '1 1 260px' }} />
          <PillButton height={52} on={ok} onClick={send}>{t(editing ? 'kitchen.fb.sendEdit' : 'kitchen.fb.send')}</PillButton>
          {editing ? <Button variant="secondary" size={48} style={{ height: 52 }} onClick={() => { setEditing(false); setDraft(''); }}>{t('common.cancel')}</Button> : null}
        </div>
      ) : null}
      {f.status === 'open' && !target ? <Note tone="cream" icon="phone_disabled">{t('kitchen.fb.noApp')}</Note> : null}

      {isPhone ? (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {f.status === 'answered' && lastReply && !editing ? <RowPill icon="edit" onClick={() => { setEditing(true); setDraft(lastReply.text); }}>{t('kitchen.fb.editReply')}</RowPill> : null}
          {f.status !== 'open' ? <RowPill tone="quiet" onClick={() => setStatus('open', t('kitchen.fb.reopened'))}>{t('kitchen.fb.reopen')}</RowPill> : null}
          {f.status === 'open' && !target ? <RowPill tone="ink" icon="check" onClick={() => setStatus('answered', t('kitchen.fb.markedAnswered'))}>{t('kitchen.fb.markAnswered')}</RowPill> : null}
          {f.status === 'open' || f.status === 'answered' ? <RowPill tone="quiet" onClick={() => setStatus('closed', t('kitchen.fb.closed'))}>{t('kitchen.fb.close')}</RowPill> : null}
        </div>
      ) : null}
      {!isPhone ? (
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
        {f.status === 'answered' && lastReply && !editing ? <OutlineButton icon="edit" onClick={() => { setEditing(true); setDraft(lastReply.text); }}>{t('kitchen.fb.editReply')}</OutlineButton> : null}
        {f.status !== 'open' ? <TextButton onClick={() => setStatus('open', t('kitchen.fb.reopened'))}>{t('kitchen.fb.reopen')}</TextButton> : null}
        {f.status === 'open' && !target ? <OutlineButton icon="check" onClick={() => setStatus('answered', t('kitchen.fb.markedAnswered'))}>{t('kitchen.fb.markAnswered')}</OutlineButton> : null}
        {f.status === 'open' ? <TextButton onClick={() => setStatus('closed', t('kitchen.fb.closed'))} color="#5E5852">{t('kitchen.fb.close')}</TextButton> : null}
        {f.status === 'answered' ? <TextButton onClick={() => setStatus('closed', t('kitchen.fb.closed'))} color="#5E5852">{t('kitchen.fb.close')}</TextButton> : null}
      </div>
      ) : null}
    </div>
  );
}
