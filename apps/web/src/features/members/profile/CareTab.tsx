// Care log tab (design ScrProfile care), day by day: cognitive status with its real reviewer and date, mood counts for the last 4 weeks,
// then one card per day the member was in (newest first): when they came and left, that day's health readings with their status, and
// the daily log with every field the teacher recorded, the staff note (staff only) and family comments. The activity team, nurse and
// management write or correct the log right on its day (the last week's days they were in).
import { useState } from 'react';
import { addDays, actorName, attId, live, memberShort, messagesOf, sortBy, staffCall, type Attendance, type DailyLog, type Reading } from '@cp/shared';
import { NORMAL_LOG, logDates, logDeviations } from '@cp/shared/rules/activity';
import { logForFamily, readingForFamily } from '@cp/shared/rules/approvals';
import { PendingMark } from '../../../components/PendingMark';
import { Button, FONT_BODY, Icon, Pager, StaffOnlyTag, StatusBadge, usePaged } from '../../../components/ui';
import { CHECK_KEY } from '../../health/ReadingCard';
import { LogFieldsForm, logInput, sameLog, type LogEntry } from '../../activity/LogFields';
import { cardStyle, cogText, HAIR, listCardStyle, logNote } from '../lib';
import { Block, ListHead, PendingBanner } from './parts';
import type { P } from './types';

const DAYS_PER_PAGE = 7;
export function CareTab({ p }: { p: P }) {
  const { s, m, t, fmt, today } = p;
  // entries by staff wait for management's approval: families get only approved ones (their snapshot has none; this guards the full state), staff see them marked
  const logs = sortBy(live(s.dailyLogs).filter((l) => l.memberId === m.id && (l.status === 'saved' || !p.family)).map((l) => (p.family ? logForFamily(l) : l)).filter((l): l is DailyLog => !!l), (l) => l.date, -1);
  const readings = sortBy(live(s.readings).filter((r) => r.memberId === m.id && !r.voided).map((r) => (p.family ? readingForFamily(r) : r)).filter((r): r is Reading => !!r), (r) => r.time);
  const visits = live(s.attendance).filter((a) => a.memberId === m.id && !!a.checkIn);
  const days = Array.from(new Set([...logs.map((l) => l.date), ...readings.map((r) => r.date), ...visits.map((a) => a.date)])).filter((d) => d <= today).sort().reverse();
  const paged = usePaged(days, DAYS_PER_PAGE, m.id);
  const writer = !p.family && (['activity', 'nurse', 'mgmt'] as string[]).includes(p.role);
  const editable = new Set(writer ? logDates(s, today).filter((d) => !!s.attendance[attId(d, m.id)]?.checkIn) : []);
  const recent = logs.filter((l) => l.date >= addDays(today, -28));
  const cnt = (k: DailyLog['mood']) => recent.filter((l) => l.mood === k).length;
  const moods = (['cheerful', 'calm', 'quiet', 'agitated'] as const).filter((k) => cnt(k)).map((k) => ({ label: t('family.mood_' + k), n: cnt(k) }));
  const behaviour = cnt('agitated') ? t('profile.unsettledOn', { n: cnt('agitated') }) : t('profile.settled');
  const cog = m.health.cognitive;
  const reviewer = cog.reviewedBy ? staffCall(s.staff[cog.reviewedBy]) || cog.reviewedBy : '';
  const comments = (logId: string) => {
    const out: { id: string; who: string; text: string; at: string }[] = [];
    for (const th of live(s.threads).filter((x) => x.memberId === m.id)) {
      for (const msg of messagesOf(s, th.id)) if (msg.ref?.type === 'dailyLog' && msg.ref.id === logId) out.push({ id: msg.id, who: actorName(s, msg.from), text: msg.text, at: msg.at });
    }
    return sortBy(out, (x) => x.at);
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PendingBanner p={p} tab="care" />
      <div style={{ ...cardStyle, gap: 18, maxWidth: 760 }}>
        <Block first title={t('profile.cognitive')} gap={6}>
          <div style={{ fontSize: 22, lineHeight: '30px', letterSpacing: '-0.3px', color: '#2B231C' }}>{cogText(t, cog.summary)}</div>
          <div style={{ fontSize: 14, color: '#6B6259', lineHeight: 1.4 }}>
            {cog.reviewedOn ? t('profile.reviewedBy', { n: reviewer || t('profile.theTeam'), d: fmt.fdy(cog.reviewedOn) }) : t('profile.notReviewed')}
          </div>
        </Block>
        <Block title={t('profile.moodTitle')} gap={8}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 20px' }}>
            {moods.map((c) => (
              <span key={c.label} style={{ fontSize: 15, display: 'inline-flex', alignItems: 'baseline', gap: 6, lineHeight: 1.3 }}>
                {c.label}
                <span style={{ fontWeight: 500 }}>{c.n}</span>
              </span>
            ))}
            {!moods.length ? <span style={{ fontSize: 14, color: '#6B6259' }}>{t('profile.noLogsYet')}</span> : null}
          </div>
          <div style={{ fontSize: 14, lineHeight: '20px', color: '#6B6259' }}>{behaviour}</div>
        </Block>
      </div>
      <div style={listCardStyle} data-testid="care-days">
        <ListHead title={t('profile.byDay')} />
        {paged.rows.map((d) => (
          <DayCard key={d} p={p} date={d} log={logs.find((l) => l.date === d)} readings={readings.filter((r) => r.date === d)} visit={visits.find((a) => a.date === d)}
            comments={(id) => comments(id)} canEdit={editable.has(d)} />
        ))}
        {!days.length ? <div style={{ padding: '14px 0 20px', borderTop: HAIR, fontSize: 15, color: '#6B6259', lineHeight: 1.4 }}>{t('profile.noLogsYet')}</div> : null}
        {paged.pages > 1 ? <div style={{ padding: '12px 0 16px', borderTop: HAIR }}><Pager page={paged.page} pages={paged.pages} onPage={paged.setPage} label={t('profile.pagerCare')} /></div> : null}
      </div>
    </div>
  );
}

type Comment = { id: string; who: string; text: string; at: string };
const smallCaps = { fontSize: 12, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 500, color: '#6E5A43', lineHeight: '18px' } as const;

/** Every number of a reading, in the station's words. */
export function values(r: Reading, t: P['t']): string {
  return [
    r.sys != null && r.dia != null ? `${t('health.bp')} ${r.sys}/${r.dia}` : '',
    r.pulse != null ? `${t('health.pulse')} ${r.pulse}` : '',
    r.spo2 != null ? `SpO₂ ${r.spo2}%` : '',
    r.temp != null ? `${r.temp} °C` : '',
    r.glucose != null ? `${t('health.glucose')} ${r.glucose} mg/dL` : '',
    r.weight != null ? `${t('health.weight')} ${r.weight} kg` : '',
    r.grip != null ? `${t('health.grip')} ${r.grip} kg` : '',
  ].filter(Boolean).join(' · ');
}

/** One day: when they came and left, the health readings, the daily log (written or corrected here on the days that allow it). */
function DayCard({ p, date, log, readings, visit, comments, canEdit }: { p: P; date: string; log?: DailyLog; readings: Reading[]; visit?: Attendance; comments: (logId: string) => Comment[]; canEdit: boolean }) {
  const { s, m, t, fmt, today, act } = p;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<LogEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const base: LogEntry = log ? { mood: log.mood, lunch: log.lunch, joined: log.joined, communicative: log.communicative, content: log.content, note: log.note, staffNote: log.staffNote || '' } : { ...NORMAL_LOG, note: '', staffNote: '' };
  const e = draft ?? base;
  const editing = open || (!!draft && !sameLog(draft, base));
  const name = memberShort(m);
  const save = async () => {
    if (busy) return;
    setBusy(true);
    const what = logDeviations(e).map((k) => t('activity.opt.' + k)).join(', ').toLowerCase();
    const r = await act('log.save', logInput(m.id, date, e), { ok: log ? t('activity.logUpdated', { name }) : what ? t('activity.logSavedWhat', { name, what }) : t('activity.logSavedNormal', { name }) });
    setBusy(false);
    if (!r.ok) return;
    setDraft(null);
    setOpen(false);
  };
  const where = visit?.checkIn ? (visit.checkOut ? t('profile.dayInOut', { a: visit.checkIn.at, b: visit.checkOut.at }) : t('profile.dayIn', { a: visit.checkIn.at })) : t('profile.dayAway');
  const cs = log ? comments(log.id) : [];
  const chips: [string, string][] = log ? [
    ['sentiment_satisfied', t('family.mood_' + log.mood)],
    ['restaurant', t('family.lunch_' + log.lunch)],
    [log.joined === 'yes' ? 'groups' : 'chair', t('profile.joined_' + log.joined)],
    [log.communicative === 'normal' ? 'forum' : 'speaker_notes_off', t('profile.comm_' + log.communicative)],
    [log.content === 'normal' ? 'mood' : 'mood_bad', t('profile.content_' + log.content)],
  ] : [];
  return (
    <div data-testid="care-day" data-date={date} style={{ display: 'flex', flexDirection: p.isPhone ? 'column' : 'row', gap: p.isPhone ? 10 : 16, padding: p.isPhone ? '18px 0' : '20px 0', borderTop: HAIR }}>
      {p.isPhone ? null : (
        <div style={{ width: 56, flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '1px', color: '#6B6259', lineHeight: '18px' }}>{date === today ? t('common.today') : fmt.fd(date, { weekday: 'short' })}</span>
          <span style={{ fontSize: 24, lineHeight: '30px', fontWeight: 300 }}>{fmt.fd(date, { day: 'numeric' })}</span>
          <span style={{ fontSize: 13, color: '#6B6259', lineHeight: 1.4 }}>{fmt.fd(date, { month: 'short' })}</span>
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {p.isPhone ? <div style={{ fontSize: 17, fontWeight: 500, lineHeight: 1.3 }}>{date === today ? `${t('common.today')} · ` : ''}{fmt.fd(date, { weekday: 'short', day: 'numeric', month: 'short' })}</div> : null}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: FONT_BODY, color: visit ? '#24201C' : '#5E5852', lineHeight: 1.4 }}>
          <Icon name={visit ? 'how_to_reg' : 'event_busy'} size={18} color="#75624B" />{where}
        </div>
        {/* health */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={smallCaps}>{t('profile.healthHead')}</span>
          {readings.length ? readings.map((r) => (
            <div key={r.id} data-testid="care-reading" style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '4px 0' }}>
              <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: FONT_BODY, fontWeight: 500, lineHeight: 1.4 }}>{t(CHECK_KEY[r.kind])} · {r.time}</span>
                {!p.family ? <PendingMark row={r} /> : null}
                <span style={{ fontSize: FONT_BODY, color: '#24201C', lineHeight: 1.4 }}>{values(r, t)}</span>
                {r.note ? <span style={{ fontSize: FONT_BODY, color: '#5E5852', lineHeight: 1.4 }}>{r.note}</span> : null}
              </span>
              <StatusBadge kind={r.status} small />
            </div>
          )) : <span style={{ fontSize: FONT_BODY, color: '#5E5852', lineHeight: 1.4 }}>{t('profile.noReadingsDay')}</span>}
        </div>
        {/* daily log */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}><span style={smallCaps}>{t('profile.logHead')}</span>{!p.family ? <PendingMark row={log} /> : null}</span>
          {editing ? (
            <>
              <LogFieldsForm e={e} onChange={(patch) => setDraft({ ...e, ...patch })} />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Button icon="check" size={44} disabled={busy} onClick={() => void save()}>{log ? t('activity.saveChanges') : t('activity.saveLog')}</Button>
                <Button variant="ghost" size={44} onClick={() => { setDraft(null); setOpen(false); }}>{t('common.cancel')}</Button>
              </div>
            </>
          ) : log ? (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px' }}>
                {chips.map(([icon, label]) => (
                  <span key={icon + label} style={{ fontSize: 14, color: '#6B6259', display: 'inline-flex', alignItems: 'center', gap: 5, lineHeight: 1.3 }}>
                    <Icon name={icon} size={17} color="#75624B" />
                    {label}
                  </span>
                ))}
                {log.status === 'draft' ? <span style={{ height: 26, padding: '0 10px', borderRadius: 8, background: '#F6ECD6', color: '#7A5510', fontSize: 13, fontWeight: 600, display: 'inline-flex', alignItems: 'center' }}>{t('profile.draft')}</span> : null}
              </div>
              <div style={{ fontSize: 15, lineHeight: '23px', textWrap: 'pretty' }}>{logNote(s, t, p.lang, m, log)}</div>
              {!p.family && log.staffNote ? (
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 15, lineHeight: '22px', padding: '10px 14px', borderRadius: 10, background: '#F3EEE8' }}>
                  <Icon name="lock" size={18} color="#75624B" style={{ marginTop: 2 }} />
                  <span style={{ flex: 1, minWidth: 0 }}><StaffOnlyTag /> {log.staffNote}</span>
                </div>
              ) : null}
              {cs.map((c) => (
                <div key={c.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 15, lineHeight: '22px', padding: '2px 0' }}>
                  <Icon name="chat_bubble" size={18} color="#75624B" style={{ marginTop: 2 }} />
                  <span style={{ flex: 1, minWidth: 0 }}><strong style={{ fontWeight: 500 }}>{c.who}</strong> · <span style={{ color: '#5E5852', fontSize: FONT_BODY }}>{c.at.slice(11, 16)}</span><br />{c.text}</span>
                </div>
              ))}
              <div style={{ fontSize: 13, color: '#6B6259', lineHeight: 1.4 }}>{t('profile.loggedBy', { n: staffCall(s.staff[log.by]) || actorName(s, log.createdBy) || t('profile.theTeam') })}</div>
            </>
          ) : <span style={{ fontSize: FONT_BODY, color: '#5E5852', lineHeight: 1.4 }}>{t('profile.noLogDay')}</span>}
          {canEdit && !editing ? (
            <div><Button variant="secondary" size={44} icon="edit_note" onClick={() => setOpen(true)}>{log ? t('profile.logEdit') : t('profile.logWrite')}</Button></div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
