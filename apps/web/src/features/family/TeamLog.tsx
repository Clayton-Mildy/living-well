// "From the team": a day's log as a quote with the writer's face and name. (Families answer the club on WhatsApp, not here.)
import type { CSSProperties } from 'react';
import { staffCall, type DailyLog, type Member } from '@cp/shared';
import { latestLog } from '@cp/shared/rules/family';
import { Avatar } from '../../components/ui';
import { memberPhoto } from '../../lib/media';
import { useFamilyCtx } from './useFamily';
import { H2, fcard } from './parts';

/** The log text and who wrote it (no card around it, so Both mode can place it inside each parent's card). `compact`: a smaller quote. */
export function LogBlock({ m, log, compact }: { m: Member; log: DailyLog; compact?: boolean }) {
  const { s, t, fmt } = useFamilyCtx();
  const author = s.staff[log.by];
  const authorCall = staffCall(author) || t('family.theLobby');
  const mood = log.mood ? t('family.mood_' + log.mood).toLowerCase() : ''; // KC round 7: a log can hold only lunch or sessions until the Mood & notes round is saved
  const lunch = !log.lunch ? '' : ['all', 'most', 'half', 'little'].includes(log.lunch) ? t('family.lunch_' + log.lunch) : t('family.storyAte_none');
  const meta = [authorCall, fmt.fdl(log.date), mood, lunch.toLowerCase()].filter(Boolean).join(' · ');
  return (
    <figure style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: compact ? 10 : 14 }} data-testid="team-log" data-member={m.id}>
      {/* KC round 7: only what the team wrote is quoted; a day without a note shows its mood and lunch in this line only */}
      {log.note ? <blockquote style={{ margin: 0, fontSize: compact ? 'clamp(17px, 4.4vw, 20px)' : 'clamp(20px, 5.2vw, 26px)', lineHeight: 1.4, fontWeight: 300, letterSpacing: '-0.3px', color: '#2B231C', textWrap: 'pretty' } as CSSProperties}>{'“'}{log.note}{'”'}</blockquote> : null}
      <figcaption style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <Avatar name={authorCall} src={memberPhoto(author)} size={28} />
        <span style={{ fontSize: 14, color: '#6B6259', lineHeight: 1.4, minWidth: 0 }}>{meta}</span>
      </figcaption>
    </figure>
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
