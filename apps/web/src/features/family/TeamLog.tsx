// "Daily log" on Today (round 8b; round 8d: every round): the team's approved log of the day, right below the timeline. One soft card per parent who came (named
// when there are several), always the same rounds in the same order: Lunch (how much was eaten), Activities (each session of the day: joined, sat out, or not
// logged), Mood (a coloured dot and a word) and the team's note as a quote with its writer and time. A round nobody has approved yet reads "Not logged yet"
// (today) or "Not logged" (an earlier day) instead of disappearing. Families only ever read approved log data (the day's story is built from it). A day nobody came
// has no section, except today before a parent arrives, which keeps the newest written note, labelled with its day.
import type { ReactNode } from 'react';
import { memberName, displayName, staffCall, type DailyLog, type ISODate, type Member } from '@cp/shared';
import { activityLabel, latestNote, type DayStory } from '@cp/shared/rules/family';
import { dailyLogBlocks, dayDigest, type DayDigest, type LogBlock } from '@cp/shared/rules/famToday';
import { Avatar } from '../../components/ui';
import { memberPhoto } from '../../lib/media';
import { Cap, F, FillCard, HAIR, TextLink } from './kit';
import { MOOD_COLOR } from './storyBits';
import { useFamilyCtx } from './useFamily';

const REST_DOT = '#BBA88F';

/** A fact of the day: a quiet label on the left, the answer on the right (a coloured dot before it for the mood and the sessions). `none`: the round is not logged, so the answer is quiet. */
function Fact({ k, v, dot, none, first, testId, attrs }: { k: string; v: ReactNode; dot?: string; none?: boolean; first?: boolean; testId: string; attrs?: Record<string, string> }) {
  return (
    <div data-testid={testId} {...attrs} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 14, padding: '10px 16px', borderTop: first ? 'none' : HAIR, fontSize: 15, lineHeight: 1.4 }}>
      <span style={{ flex: 'none', color: F.muted, fontSize: 14 }}>{k}</span>
      <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 7, minWidth: 0, textAlign: 'right', justifyContent: 'flex-end', color: none ? F.muted : F.text, fontWeight: none ? 400 : 500, overflowWrap: 'anywhere' }}>
        {dot && !none ? <span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: 999, background: dot, flex: 'none', alignSelf: 'center' }} /> : null}
        <span style={{ minWidth: 0 }}>{v}</span>
      </span>
    </div>
  );
}

/** Activities: a label, then each session of the day with its time and how the parent took part. */
function Activities({ d, none, first }: { d: DayDigest; none: string; first: boolean }) {
  const { s, t, fmt } = useFamilyCtx();
  if (!d.sessions.length) return null;
  return (
    <div data-testid="log-activities" style={{ padding: '10px 16px 6px', borderTop: first ? 'none' : HAIR }}>
      <span style={{ color: F.muted, fontSize: 14, lineHeight: 1.4 }}>{t('ftoday.dlActivities')}</span>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column' }}>
        {d.sessions.map((x) => {
          const took = x.took;
          const state = took ?? 'none';
          return (
            <li key={x.id} data-testid="log-session" data-activity={x.activityId} data-took={state} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 14, padding: '5px 0', fontSize: 15, lineHeight: 1.4 }}>
              <span style={{ minWidth: 0, color: F.text, fontWeight: 500, overflowWrap: 'anywhere' }}>
                {activityLabel(s, x.activityId, fmt.lang)}<span style={{ color: F.muted, fontWeight: 400, fontSize: 13, marginLeft: 6 }}>{x.time}</span>
              </span>
              <span style={{ flex: 'none', display: 'inline-flex', alignItems: 'baseline', gap: 7, textAlign: 'right', color: took ? F.text : F.muted, fontWeight: took ? 500 : 400 }}>
                {took ? <span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: 999, background: took === 'joined' ? F.sageDot : REST_DOT, flex: 'none', alignSelf: 'center' }} /> : null}
                {took === 'joined' ? t('ftoday.dlJoinedS') : took === 'satOut' ? t('ftoday.dlSatOutS') : none}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** The team's note as a quote with the writer's face, name, role and the time. `own`: the note is the day's own (else it is an older one, with a way to open that day). */
export function TeamNote({ m, log, own, border, onOpenDay }: { m: Member; log: DailyLog; own: boolean; border: boolean; onOpenDay: (d: ISODate) => void }) {
  const { s, t, fmt, now } = useFamilyCtx();
  const author = s.staff[log.by];
  const name = staffCall(author) || t('family.theLobby');
  const at = log.edits?.length ? log.edits[log.edits.length - 1].at : log.createdAt;
  const time = at && at.slice(0, 10) === log.date ? at.slice(11, 16) : '';
  const day = log.date === now.today ? t('common.today') : fmt.fds(log.date);
  const when = [day, time].filter(Boolean).join(' · ');
  return (
    <div data-testid="team-note" data-own={own} data-member={m.id} style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '14px 16px 16px', borderTop: border ? HAIR : 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Avatar name={name} src={memberPhoto(author)} size={32} />
        <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.35, color: F.text }}>{[name, author?.title].filter(Boolean).join(' · ')}</span>
          <span style={{ fontSize: 12, lineHeight: 1.35, color: F.muted }}>{when}</span>
        </span>
      </div>
      <figure data-testid="team-log" data-member={m.id} style={{ margin: 0 }}>
        <blockquote style={{ margin: 0, fontSize: 16, lineHeight: '24px', color: F.ink, overflowWrap: 'anywhere' }}>{'“'}{log.note}{'”'}</blockquote>
      </figure>
      {!own ? <TextLink size={14} onClick={() => onOpenDay(log.date)} style={{ alignSelf: 'flex-start' }} testId="note-open-day">{t('family.memOpenDay', { d: fmt.fds(log.date) })}</TextLink> : null}
    </div>
  );
}

/** One parent who came: Lunch, Activities, Mood, then the team's note (each says "not logged" when nothing is approved for it yet). */
function Rounds({ d, m, multi, past, onOpenDay }: { d: DayDigest; m: Member; multi: boolean; past: boolean; onOpenDay: (d: ISODate) => void }) {
  const { t } = useFamilyCtx();
  const none = t(past ? 'ftoday.dlNonePast' : 'ftoday.dlNone');
  const first = !multi;
  return (
    <>
      <Fact k={t('ftoday.dlLunch')} v={d.lunch ? t('ftoday.dlAte_' + d.lunch) : none} none={!d.lunch} first={first} testId="log-lunch" attrs={d.lunch ? { 'data-amount': d.lunch, 'data-logged': '1' } : { 'data-logged': '0' }} />
      <Activities d={d} none={none} first={false} />
      <Fact k={t('ftoday.dlMood')} v={d.mood ? t('family.mood_' + d.mood) : none} none={!d.mood} dot={d.mood ? MOOD_COLOR[d.mood] : undefined} first={false} testId="log-mood" attrs={d.mood ? { 'data-mood': d.mood, 'data-logged': '1' } : { 'data-logged': '0' }} />
      {d.note ? <TeamNote m={m} log={d.note} own border onOpenDay={onOpenDay} /> : <Fact k={t('ftoday.dlNote')} v={none} none first={false} testId="log-note-none" attrs={{ 'data-logged': '0' }} />}
    </>
  );
}

function Block({ b, m, multi, past, onOpenDay }: { b: LogBlock; m: Member; multi: boolean; past: boolean; onOpenDay: (d: ISODate) => void }) {
  return (
    <div data-testid="log-block" data-member={m.id} data-kind={b.kind}>
      <FillCard radius={22} pad={0} gap={0} style={{ overflow: 'hidden' }}>
        {multi ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px 6px' }}>
            <Avatar name={memberName(m)} src={memberPhoto(m)} tone={m.photoTone} size={28} />
            <span style={{ fontSize: 15, fontWeight: 600, color: F.text }}>{displayName(m)}</span>
          </div>
        ) : null}
        {b.kind === 'day' ? <Rounds d={b.digest} m={m} multi={multi} past={past} onOpenDay={onOpenDay} /> : null}
        {b.kind === 'older' ? <TeamNote m={m} log={b.log} own={false} border={multi} onOpenDay={onOpenDay} /> : null}
      </FillCard>
    </div>
  );
}

/**
 * The "Daily log" section: a card per parent who came, nothing at all when nobody did.
 * `stories[i]` is `members[i]`'s day (family-visible data only).
 */
export function DailyLogSection({ members, stories, date, onOpenDay }: { members: Member[]; stories: DayStory[]; date: ISODate; onOpenDay: (d: ISODate) => void }) {
  const { s, t, now } = useFamilyCtx();
  const isToday = date === now.today;
  // before a parent arrives today, the newest written note stands in (labelled with its own day)
  const older = members.map((m, i) => (isToday && !stories[i].visited && !dayDigest(stories[i]).any ? latestNote(s, m.id, now.today) : undefined));
  const blocks = dailyLogBlocks(stories, isToday, older);
  if (!blocks.length) return null;
  const byId = new Map(members.map((m) => [m.id, m]));
  return (
    <section data-testid="daily-log" data-day={date} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Cap>{t('ftoday.dlTitle')}</Cap>
      {blocks.map((b) => <Block key={b.memberId} b={b} m={byId.get(b.memberId)!} multi={members.length > 1} past={!isToday} onOpenDay={onOpenDay} />)}
    </section>
  );
}
