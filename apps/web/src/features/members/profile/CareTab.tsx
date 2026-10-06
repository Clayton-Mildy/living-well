// Care log tab (design ScrProfile care), day by day: cognitive status with its real reviewer and date, mood counts for the last 4 weeks,
// then one card per day the member was in (newest first): when they came and left, that day's health readings with their status, and
// the daily log with every field the teacher recorded, the staff note (staff only) and family comments. The activity team, nurse and
// management write or correct the log right on its day (the last week's days they were in).
import { useState } from 'react';
import { addDays, actorName, attId, live, memberShort, messagesOf, sortBy, staffCall, type Attendance, type DailyLog, type Reading } from '@cp/shared';
import { NORMAL_LOG, logDates, logDeviations } from '@cp/shared/rules/activity';
import { Button, FONT_BODY, FONT_SMALL, Icon, Pager, SectionLabel, StaffOnlyTag, StatusBadge, usePaged } from '../../../components/ui';
import { CHECK_KEY } from '../../health/ReadingCard';
import { LogFieldsForm, logInput, sameLog, type LogEntry } from '../../activity/LogFields';
import { cardStyle, cogText, listCardStyle, logNote } from '../lib';
import { ListHead, PendingBanner } from './parts';
import type { P } from './types';

const DAYS_PER_PAGE = 7;
export function CareTab({ p }: { p: P }) {
  const { s, m, t, fmt, today } = p;
  const logs = sortBy(live(s.dailyLogs).filter((l) => l.memberId === m.id && (l.status === 'saved' || !p.family)), (l) => l.date, -1);
  const readings = sortBy(live(s.readings).filter((r) => r.memberId === m.id && !r.voided), (r) => r.time);
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,300px),1fr))', gap: 16, alignItems: 'start' }}>
        <div style={{ ...cardStyle, gap: 8 }}>
          <SectionLabel>{t('profile.cognitive')}</SectionLabel>
          <div style={{ fontSize: 22, lineHeight: '30px', letterSpacing: '-0.3px' }}>{cogText(t, cog.summary)}</div>
          <div style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>
            {cog.reviewedOn ? t('profile.reviewedBy', { n: reviewer || t('profile.theTeam'), d: fmt.fdy(cog.reviewedOn) }) : t('profile.notReviewed')}
          </div>
        </div>
        <div style={{ ...cardStyle, gap: 10 }}>
          <SectionLabel>{t('profile.moodTitle')}</SectionLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {moods.map((c) => (
              <span key={c.label} style={{ minHeight: 32, maxWidth: '100%', padding: '4px 12px', borderRadius: 999, background: '#F4F0EE', fontSize: FONT_BODY, display: 'inline-flex', alignItems: 'center', gap: 6, lineHeight: 1.3 }}>
                {c.label}
                <strong style={{ fontWeight: 600 }}>{c.n}</strong>
              </span>
            ))}
            {!moods.length ? <span style={{ fontSize: FONT_BODY, color: '#6A6967' }}>{t('profile.noLogsYet')}</span> : null}
          </div>
          <div style={{ fontSize: FONT_BODY, lineHeight: '20px', color: '#6A6967' }}>{behaviour}</div>
        </div>
      </div>
      <div style={listCardStyle} data-testid="care-days">
        <ListHead title={t('profile.byDay')} />
        {paged.rows.map((d) => (
          <DayCard key={d} p={p} date={d} log={logs.find((l) => l.date === d)} readings={readings.filter((r) => r.date === d)} visit={visits.find((a) => a.date === d)}
            comments={(id) => comments(id)} canEdit={editable.has(d)} />
        ))}
        {!days.length ? <div style={{ padding: '14px 20px 20px', borderTop: '1px solid #EFECEA', fontSize: 16, color: '#6A6967', lineHeight: 1.4 }}>{t('profile.noLogsYet')}</div> : null}
        {paged.pages > 1 ? <div style={{ padding: '12px 20px 16px', borderTop: '1px solid #EFECEA' }}><Pager page={paged.page} pages={paged.pages} onPage={paged.setPage} label={t('profile.pagerCare')} /></div> : null}
      </div>
    </div>
  );
}

type Comment = { id: string; who: string; text: string; at: string };
const smallCaps = { fontSize: FONT_SMALL, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 500, color: '#6A6967', lineHeight: '18px' } as const;

/** Every number of a reading, in the station's words. */
function values(r: Reading, t: P['t']): string {
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
    <div data-testid="care-day" data-date={date} style={{ display: 'flex', flexDirection: p.isPhone ? 'column' : 'row', gap: p.isPhone ? 10 : 16, padding: p.isPhone ? '14px' : '16px 20px', borderTop: '1px solid #EFECEA' }}>
      {p.isPhone ? null : (
        <div style={{ width: 56, flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span style={{ fontSize: FONT_SMALL, textTransform: 'uppercase', letterSpacing: '1px', color: '#6A6967', lineHeight: '18px' }}>{date === today ? t('common.today') : fmt.fd(date, { weekday: 'short' })}</span>
          <span style={{ fontSize: 24, lineHeight: '30px', fontWeight: 300 }}>{fmt.fd(date, { day: 'numeric' })}</span>
          <span style={{ fontSize: 'max(13px, var(--cp-body, 0px))', color: '#6A6967', lineHeight: 1.4 }}>{fmt.fd(date, { month: 'short' })}</span>
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {p.isPhone ? <div style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.3 }}>{date === today ? `${t('common.today')} · ` : ''}{fmt.fd(date, { weekday: 'short', day: 'numeric', month: 'short' })}</div> : null}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: FONT_BODY, color: visit ? '#282828' : '#6A6967', lineHeight: 1.4 }}>
          <Icon name={visit ? 'how_to_reg' : 'event_busy'} size={18} color="#75624B" />{where}
        </div>
        {/* health */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={smallCaps}>{t('profile.healthHead')}</span>
          {readings.length ? readings.map((r) => (
            <div key={r.id} data-testid="care-reading" style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 10px', borderRadius: 14, background: '#FBFAF9', border: '1px solid #EFECEA' }}>
              <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: FONT_BODY, fontWeight: 500, lineHeight: 1.4 }}>{t(CHECK_KEY[r.kind])} · {r.time}</span>
                <span style={{ fontSize: FONT_BODY, color: '#282828', lineHeight: 1.4 }}>{values(r, t)}</span>
                {r.note ? <span style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>{r.note}</span> : null}
              </span>
              <StatusBadge kind={r.status} small />
            </div>
          )) : <span style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>{t('profile.noReadingsDay')}</span>}
        </div>
        {/* daily log */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={smallCaps}>{t('profile.logHead')}</span>
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
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {chips.map(([icon, label]) => (
                  <span key={icon + label} style={{ minHeight: 28, maxWidth: '100%', padding: '3px 10px', borderRadius: 999, background: '#F4F0EE', fontSize: FONT_SMALL, display: 'inline-flex', alignItems: 'center', gap: 4, lineHeight: 1.3 }}>
                    <Icon name={icon} size={16} color="#75624B" />
                    {label}
                  </span>
                ))}
                {log.status === 'draft' ? <span style={{ height: 28, padding: '0 10px', borderRadius: 999, background: '#F6ECD6', color: '#7A5510', fontSize: FONT_SMALL, fontWeight: 600, display: 'inline-flex', alignItems: 'center' }}>{t('profile.draft')}</span> : null}
              </div>
              <div style={{ fontSize: 16, lineHeight: '22px', textWrap: 'pretty' }}>{logNote(s, t, p.lang, m, log)}</div>
              {!p.family && log.staffNote ? (
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 16, lineHeight: '22px', padding: '10px 12px', borderRadius: 14, background: '#F4F0EE' }}>
                  <Icon name="lock" size={18} color="#75624B" style={{ marginTop: 2 }} />
                  <span style={{ flex: 1, minWidth: 0 }}><StaffOnlyTag /> {log.staffNote}</span>
                </div>
              ) : null}
              {cs.map((c) => (
                <div key={c.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 16, lineHeight: '22px', padding: '10px 12px', borderRadius: 14, background: '#FBF8F4', border: '1px solid #EFECEA' }}>
                  <Icon name="chat_bubble" size={18} color="#75624B" style={{ marginTop: 2 }} />
                  <span style={{ flex: 1, minWidth: 0 }}><strong style={{ fontWeight: 600 }}>{c.who}</strong> · <span style={{ color: '#6A6967', fontSize: FONT_BODY }}>{c.at.slice(11, 16)}</span><br />{c.text}</span>
                </div>
              ))}
              <div style={{ fontSize: 'max(13px, var(--cp-body, 0px))', color: '#6A6967', lineHeight: 1.4 }}>{t('profile.loggedBy', { n: staffCall(s.staff[log.by]) || actorName(s, log.createdBy) || t('profile.theTeam') })}</div>
            </>
          ) : <span style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>{t('profile.noLogDay')}</span>}
          {canEdit && !editing ? (
            <div><Button variant="secondary" size={44} icon="edit_note" onClick={() => setOpen(true)}>{log ? t('profile.logEdit') : t('profile.logWrite')}</Button></div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
