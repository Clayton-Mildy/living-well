// One conversation (design ScrChat right card): header with back / profile link, bubbles, quick replies, composer.
// Nurse "tell family" messages (healthAlert) and automatic replies get their own look.
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { fmtPhone, linksOfMember, memberName, memberShort, messagesOf, staffCall, type ClubState, type Message } from '@cp/shared';
import { senderKind, teamStaff, type ThreadRow } from '@cp/shared/rules/chat';
import { Button, Icon } from '../../components/ui';
import type { TFn } from '../../lib/i18n';
import { relText } from '../lobby/parts';
import { messageBody, senderName, teamName, whenOf } from './text';

/** Messages shown when a conversation opens (the newest), and how many more each "Show earlier messages" adds. */
export const MESSAGES_SHOWN = 40;
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

function Bubble({ t, s, m, row, mine, viewerFamilyId, today, fds }: { t: TFn; s: ClubState; m: Message; row: ThreadRow; mine: boolean; viewerFamilyId: string | null; today: string; fds: (d: string) => string }) {
  const kind = senderKind(m);
  const align = mine ? 'flex-end' : 'flex-start';
  const body = messageBody(t, s, m, row.thread);
  const meta = `${senderName(t, s, m, viewerFamilyId)} · ${whenOf(t, fds, today, m.at)}`;
  const refLabel = m.ref ? `${t('chat.ref.' + m.ref.type)}${m.ref.type === 'dailyLog' && s.dailyLogs[m.ref.id] ? ' · ' + fds(s.dailyLogs[m.ref.id].date) : ''}` : '';
  if (m.kind === 'autoAck' && !viewerFamilyId) {
    // a system line: centred and quiet (staff see automatic replies this way)
    return (
      <div role="note" style={{ alignSelf: 'center', maxWidth: '90%', display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
        <div style={{ padding: '8px 14px', borderRadius: 16, background: '#F4F0EE', color: '#282828', fontSize: 'max(14px, var(--cp-body, 0px))', lineHeight: '20px', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <Icon name="smart_toy" size={18} color="#75624B" style={{ marginTop: 1 }} />
          <span><strong style={{ fontWeight: 600 }}>{t('chat.autoReply')}: </strong>{body}</span>
        </div>
        <span style={{ fontSize: 12, color: '#6A6967' }}>{meta}</span>
      </div>
    );
  }
  const alert = m.kind === 'healthAlert';
  const bubble: CSSProperties = alert
    ? { background: '#F6ECD6', color: '#282828', border: '1px solid #E4D3AA' }
    : { background: mine ? '#75624B' : '#F4F0EE', color: mine ? '#FFFFFF' : '#282828' };
  return (
    <div style={{ alignSelf: align, maxWidth: '80%', display: 'flex', flexDirection: 'column', gap: 4 }} data-kind={m.kind} data-from={kind}>
      <div style={{ padding: '10px 14px', borderRadius: 18, fontSize: 16, lineHeight: '22px', display: 'flex', flexDirection: 'column', gap: 6, ...bubble }}>
        {alert ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 'max(13px, var(--cp-small, 0px))', fontWeight: 600, color: '#7A5510', letterSpacing: '0.2px' }}><Icon name="monitor_heart" size={18} fill={1} color="#7A5510" />{t('chat.healthUpdate')}</span> : null}
        {m.kind === 'autoAck' ? <span style={{ fontSize: 'max(13px, var(--cp-small, 0px))', fontWeight: 600, color: '#6A6967' }}>{t('chat.autoReply')}</span> : null}
        {refLabel ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 'max(13px, var(--cp-small, 0px))', opacity: 0.85 }}><Icon name="link" size={16} />{refLabel}</span> : null}
        <span style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{body}</span>
      </div>
      <span style={{ fontSize: 12, color: '#6A6967', alignSelf: align }}>{meta}</span>
    </div>
  );
}

export function ThreadPanel({ t, s, row, audience, meId, today, fds, singlePane, onBack, onSend, onAbout }: {
  t: TFn; s: ClubState; row: ThreadRow; audience: 'staff' | 'family'; meId: string; today: string; fds: (d: string) => string; singlePane: boolean;
  onBack: () => void; onSend: (text: string) => Promise<boolean>; onAbout: (() => void) | null;
}) {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const all = row.thread ? messagesOf(s, row.thread.id) : [];
  const [shown, setShown] = useState(MESSAGES_SHOWN);
  const msgs = all.slice(-shown);
  const earlier = all.length - msgs.length;
  const viewerFamilyId = audience === 'family' ? meId : null;
  useEffect(() => { const el = scroller.current; if (el) el.scrollTop = el.scrollHeight; }, [row.key, all.length]); // the newest message, not after "show earlier"

  const link = linksOfMember(s, row.member.id).find((l) => l.familyId === row.family.id);
  const title = audience === 'staff' ? row.family.name : teamName(t, s, row.topic);
  const nurse = staffCall(teamStaff(s, 'nurse'));
  const n = memberShort(row.member);
  const quick = audience === 'staff'
    ? ['q.staff1', 'q.staff2', 'q.staff3']
    : row.topic === 'nurse' ? ['q.famNurse1', 'q.famNurse2', 'q.famNurse3']
    : row.topic === 'lobby' ? ['q.famLobby1', 'q.famLobby2', 'q.famLobby3'] : ['q.famLobby3'];
  /** Send `text`. A message typed in the composer is cleared at once (so the next one can be typed while this one is on its way)
   *  and put back only if it could not be sent and nothing else has been typed since. */
  const submit = async (text: string, fromComposer = false) => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    if (fromComposer) setDraft('');
    const ok = await onSend(body);
    setSending(false);
    if (!ok && fromComposer) setDraft((d) => d || text);
  };
  const can = !!draft.trim();

  return (
    <section aria-label={t('chat.threadAria', { name: title })} style={{ flex: '1 1 440px', minWidth: 0, minHeight: 0, background: '#FFFFFF', border: '1px solid #DBD7D6', borderRadius: 24, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid #EFECEA', flexWrap: 'wrap', flex: 'none' }}>
        {singlePane ? (
          <button type="button" onClick={onBack} aria-label={t('chat.backAria')} className="h-cream" style={{ width: 44, height: 44, borderRadius: 999, border: 'none', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#282828' }}>
            <Icon name="arrow_back" size={22} />
          </button>
        ) : null}
        <div style={{ flex: '1 1 200px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 17, fontWeight: 500, lineHeight: 1.4 }}>{title}</span>
          <span style={{ fontSize: 'max(13px, var(--cp-body, 0px))', color: '#6A6967', lineHeight: 1.4 }}>
            {audience === 'staff' ? (
              <>
                {t('chat.relOf', { rel: cap(relText(t, link?.relation)), m: memberName(row.member) })} · <a href={`tel:${row.family.phone}`}>{fmtPhone(row.family.phone)}</a>
              </>
            ) : t('chat.aboutReplies', { m: memberName(row.member) })}
          </span>
        </div>
        {onAbout ? (
          <button type="button" onClick={onAbout} className="dh2 cp-chip" style={{ height: 44, padding: '0 14px', borderRadius: 999, border: '1px solid #75624B', background: '#FFFFFF', color: '#75624B', fontSize: 'max(14px, var(--cp-body, 0px))', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'Inter' }}>
            {t('chat.openProfile', { n })}
          </button>
        ) : null}
      </div>
      <div ref={scroller} role="log" aria-live="polite" aria-label={t('chat.logAria')} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10, background: '#FBFAF9' }}>
        {row.feedback ? (
          <div role="note" style={{ alignSelf: 'center', padding: '6px 12px', borderRadius: 999, background: '#F4F0EE', fontSize: 'max(13px, var(--cp-small, 0px))', color: '#6A6967', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Icon name="restaurant" size={16} />{t('chat.feedbackHead', { dish: row.feedback.dish })}
          </div>
        ) : null}
        {earlier > 0 ? (
          <div style={{ alignSelf: 'center', flex: 'none' }}>
            <Button variant="secondary" size={44} icon="history" onClick={() => setShown((n) => n + MESSAGES_SHOWN)}>{t('chat.earlier', { n: earlier })}</Button>
          </div>
        ) : null}
        {msgs.map((m) => (
          <Bubble key={m.id} t={t} s={s} m={m} row={row} viewerFamilyId={viewerFamilyId} today={today} fds={fds}
            mine={audience === 'staff' ? senderKind(m) !== 'family' : m.from === `family:${meId}`} />
        ))}
        {!all.length ? <div style={{ margin: 'auto', color: '#6A6967', fontSize: 16, textAlign: 'center', padding: 16 }}>{t('chat.emptyThread')}</div> : null}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); void submit(draft, true); }} style={{ padding: '12px 16px 16px', borderTop: '1px solid #EFECEA', display: 'flex', flexDirection: 'column', gap: 8, flex: 'none' }}>
        <div className="cp-tabrow" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {quick.map((k) => {
            const label = t('chat.' + k, { n, nurse });
            return <button key={k} type="button" onClick={() => void submit(label)} className="dh2 cp-chip" style={{ height: 44, padding: '0 14px', borderRadius: 999, border: '1px solid #CAB8A2', background: '#FFFFFF', color: '#282828', fontSize: 'max(14px, var(--cp-body, 0px))', cursor: 'pointer', fontFamily: 'Inter', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</button>;
          })}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={t('chat.placeholder')} aria-label={t('chat.messageAria')} maxLength={2000}
            style={{ flex: 1, minWidth: 0, height: 'var(--cp-field-h, 52px)', border: '1px solid #8A755B', borderRadius: 16, padding: '0 14px', fontSize: 16, fontFamily: 'Inter', color: '#282828', outline: 'none', background: '#FFFFFF' }} />
          <button type="submit" aria-label={t('chat.sendAria')} disabled={!can || sending}
            style={{ width: 'var(--cp-field-h, 52px)', height: 'var(--cp-field-h, 52px)', borderRadius: 999, border: 'none', background: can ? '#75624B' : '#E8E1D8', color: can ? '#FFFFFF' : '#6A6967', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: can ? 'pointer' : 'not-allowed', flex: 'none' }}>
            <Icon name="send" size={22} />
          </button>
        </div>
      </form>
    </section>
  );
}
