// "From the team": the latest daily log, the family's comments on it (posted to the care thread) and staff replies.
import { useState, type CSSProperties } from 'react';
import { actorName, initials, memberShort, sessionsOn, staffCall, type DailyLog, type Member } from '@cp/shared';
import { activityLabel, careThread, latestLog, logComments } from '@cp/shared/rules/family';
import { Button, FONT_BODY, Icon } from '../../components/ui';
import { useAct } from '../../lib/act';
import { useFamilyCtx } from './useFamily';
import { H2, fcard } from './parts';

/** The log text, its comments and the comment box (no card around it, so Both mode can place it inside each parent's card). */
export function LogBlock({ m, log }: { m: Member; log: DailyLog }) {
  const { s, t, fmt, now, user } = useFamilyCtx();
  const act = useAct();
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const author = s.staff[log.by];
  const authorCall = staffCall(author) || t('family.theLobby');
  const thread = user ? careThread(s, user.id, m.id) : undefined;
  const comments = logComments(s, thread, log.id);
  const first = sessionsOn(s, log.date).find((x) => x.cell)?.cell;
  const mood = t('family.mood_' + log.mood).toLowerCase();
  const n = memberShort(m);
  const activity = first ? activityLabel(s, first.activityId, fmt.lang).toLowerCase() : '';
  const fallback = log.joined === 'satOut' ? t('family.dayLineSat', { n, m: mood }) : activity ? t('family.dayLineJoined', { n, m: mood, a: activity }) : t('family.dayLine', { n, m: mood });
  const when = (at: string) => (at.slice(0, 10) === now.today ? at.slice(11, 16) : `${fmt.fds(at.slice(0, 10))} ${at.slice(11, 16)}`);
  const send = async () => {
    const text = draft.trim();
    if (!text || busy) return;
    setBusy(true);
    const r = await act('message.send', { memberId: m.id, topic: 'care', text, ref: { type: 'dailyLog', id: log.id } }, { ok: t('family.commentSent', { n: authorCall }) });
    setBusy(false);
    if (r.ok) setDraft('');
  };
  const chips = [{ icon: 'sentiment_satisfied', label: t('family.mood_' + log.mood) }, { icon: 'restaurant', label: t('family.lunch_' + log.lunch) }];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }} data-testid="team-log" data-member={m.id}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div aria-hidden="true" style={{ width: 36, height: 36, borderRadius: 999, background: '#E8E1D8', color: '#75624B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: FONT_BODY, fontWeight: 500, whiteSpace: 'nowrap', flex: 'none' }}>{initials(author?.name || authorCall)}</div>
        <span style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>{authorCall} · {fmt.fds(log.date)}</span>
      </div>
      <p style={{ margin: 0, fontSize: 16, lineHeight: '24px', textWrap: 'pretty' } as CSSProperties}>{log.note || fallback}</p>
      {comments.map((c) => (
        <div key={c.id} data-testid="log-comment" style={{ padding: '10px 12px', borderRadius: 14, background: '#F4F0EE', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 16, lineHeight: '22px', overflowWrap: 'anywhere' }}>{c.text}</span>
          <span style={{ fontSize: `max(13px, var(--cp-body, 0px))`, color: '#6A6967', lineHeight: 1.4 }}>{actorName(s, c.from)} · {when(c.at)}</span>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void send(); }} placeholder={t('family.logCommentPh')} aria-label={`${t('family.commentLabel')} · ${n}`} maxLength={500}
          style={{ flex: 1, minWidth: 0, height: 48, border: '1px solid #8A755B', borderRadius: 14, padding: '0 12px', fontSize: 16, fontFamily: 'Inter', color: '#282828', outline: 'none', background: '#FFFFFF' }} />
        <Button variant="secondary" size={48} disabled={!draft.trim() || busy} onClick={send} style={{ padding: '0 16px' }}>{t('family.logSend')}</Button>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {chips.map((c) => (
          <span key={c.icon} style={{ height: 32, padding: '0 12px', borderRadius: 999, background: '#F4F0EE', color: '#282828', fontSize: FONT_BODY, display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
            <Icon name={c.icon} size={18} color="#75624B" />{c.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** The "From the team" card of a single member (hidden when there is no saved log yet). */
export function TeamLogCard({ m }: { m: Member }) {
  const { s, t, now } = useFamilyCtx();
  const log = latestLog(s, m.id, now.today);
  if (!log) return null;
  return (
    <div style={fcard('20px 18px', 12)}>
      <H2>{t('family.notesTeam')}</H2>
      <LogBlock m={m} log={log} />
    </div>
  );
}
