// "From the team": the latest daily log, the family's comments on it (posted to the care thread) and staff replies.
import { useState, type CSSProperties } from 'react';
import { actorName, memberShort, sessionsOn, staffCall, type DailyLog, type Member } from '@cp/shared';
import { activityLabel, careThread, latestLog, logComments } from '@cp/shared/rules/family';
import { useAct } from '../../lib/act';
import { useFamilyCtx } from './useFamily';
import { H2, fcard, linkBtn } from './parts';

/** The log text, its comments and the comment box (no card around it, so Both mode can place it inside each parent's card). */
export function LogBlock({ m, log }: { m: Member; log: DailyLog }) {
  const { s, t, fmt, now, user } = useFamilyCtx();
  const act = useAct();
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const authorCall = staffCall(s.staff[log.by]) || t('family.theLobby');
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
  const meta = [authorCall, fmt.fdl(log.date), mood, t('family.lunch_' + log.lunch).toLowerCase()].join(' · ');
  const can = !!draft.trim() && !busy;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }} data-testid="team-log" data-member={m.id}>
      <p style={{ margin: 0, fontSize: 'clamp(19px, 4.8vw, 24px)', lineHeight: 1.4, fontWeight: 300, letterSpacing: '-0.3px', color: '#2B231C', textWrap: 'pretty' } as CSSProperties}>{'\u201C'}{log.note || fallback}{'\u201D'}</p>
      <span style={{ fontSize: 14, color: '#6B6259', lineHeight: 1.4 }}>{meta}</span>
      {comments.map((c) => (
        <div key={c.id} data-testid="log-comment" style={{ paddingLeft: 12, borderLeft: '2px solid #E6DDD1', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 15, lineHeight: '21px', overflowWrap: 'anywhere' }}>{c.text}</span>
          <span style={{ fontSize: 13, color: '#6B6259', lineHeight: 1.4 }}>{actorName(s, c.from)} · {when(c.at)}</span>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', borderBottom: '1px solid #DDD1C2', padding: '2px 0' }}>
        <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void send(); }} placeholder={t('family.logCommentPh')} aria-label={`${t('family.commentLabel')} · ${n}`} maxLength={500}
          style={{ flex: 1, minWidth: 0, height: 44, border: 'none', outline: 'none', background: 'transparent', fontSize: 16, fontFamily: 'Inter', color: '#24201C', padding: 0 }} />
        <button type="button" onClick={send} aria-disabled={!can || undefined} style={{ ...linkBtn, color: can ? '#75624B' : '#B5A998', cursor: can ? 'pointer' : 'default' }}>{t('family.logSend')}</button>
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
