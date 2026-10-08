// Daily log in rounds (KC round 7): the teacher goes through the club once per round instead of filling one long form per person.
//   Lunch            one tap per person: All / Most / Half / Little / None   (at lunch the teacher marks who is eating)
//   10:30 · Batik    one tap per person per activity session: Joined / Sat out
//   Mood & notes     the existing form per person (mood, communicative, content, note for the family, staff note)
// Date chips on top (today + the last 7 days that had anyone), then a switch of rounds that opens on the one the clock says, a progress line,
// and the day's attendees (people still in the club first). A pin marks the rest of a round at once. Marks save as you tap (the replica applies them at once).
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { actorName, addDays, attId, memberName, memberShort, staffCall, type DailyLog as LogRow, type Member } from '@cp/shared';
import { PendingMark } from '../../components/PendingMark';
import { approvalState } from '@cp/shared/rules/approvals';
import {
  LUNCH_AMOUNTS, SESSION_MARKS, activityName, attendedOn, cogSummary, defaultRound, logDateOk, logDates, logDeviations, logsOn, roundMarked, roundsOf, searchMembers, type Round, type RoundId,
} from '@cp/shared/rules/activity';
import { Button, Card, Chip, GROUP_HEAD, Group, Icon, Note, PageHead, Pin, Sheet, TextField, FONT_SMALL } from '../../components/ui';
import { useDevice, padFor } from '../../hooks/useDevice';
import { useT, useFmt, useLang } from '../../lib/i18n';
import { useAct } from '../../lib/act';
import { useNow } from '../../lib/clock';
import { useClub } from '../../store/replica';
import { say } from '../../store/ui';
import { Av, SearchBar, StatusDot, cogLine, plural, rowLine } from './lib';
import { LogFieldsForm, RoundChips, baseEntry, logInput, sameLog, type LogEntry, type RoundChoice } from './LogFields';

const HAIR = '1px solid #F0EAE1';
const rowStyle = (first: boolean, phone: boolean, inset = 68) => (phone ? rowLine(first, inset) : first ? {} : { borderTop: HAIR });

export function DailyLog() {
  const t = useT();
  const lang = useLang();
  const { fdl, fds } = useFmt();
  const { device, isPhone } = useDevice();
  const s = useClub();
  const { today, nowMin } = useNow();
  const act = useAct();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState<string | null>(params.get('member'));
  const [drafts, setDrafts] = useState<Record<string, LogEntry>>({});
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  const [ask, setAsk] = useState(false);

  const qd = params.get('date');
  const date = qd && logDateOk(today, qd) ? qd : today;
  const isToday = date === today;
  const dates = useMemo(() => logDates(s, today), [s, today]);
  const people = useMemo(() => attendedOn(s, date), [s, date]);
  const logs = useMemo(() => logsOn(s, date), [s, date]);
  const rounds = useMemo(() => roundsOf(s, date), [s, date]);
  const markedIn = (r: Round) => people.filter((m) => roundMarked(logs.get(m.id), r)).length;

  // the round opens by the clock (or, on an earlier day, the first one with people left); chosen once per day so it does not jump while someone works
  const auto = useMemo<RoundId>(() => (isToday ? defaultRound(rounds, nowMin) : (rounds.find((r) => markedIn(r) < people.length) ?? rounds[0]).id), [date]); // eslint-disable-line react-hooks/exhaustive-deps
  const wantMember = params.get('member');
  const asked = params.get('round') ?? (wantMember ? 'mood' : null);
  const round: Round = rounds.find((r) => r.id === asked) ?? rounds.find((r) => r.id === auto) ?? rounds[0];
  const marked = markedIn(round);
  const left = people.filter((m) => !roundMarked(logs.get(m.id), round));

  const nameOf = (r: Round) => (r.kind === 'session' ? (activityName(r.session?.activity, lang) ? t('activity.round.session', { time: r.time, name: activityName(r.session?.activity, lang) }) : r.time) : t('activity.round.' + r.kind));
  const query = (patch: Record<string, string | null>) => setParams((p) => { const n = new URLSearchParams(p); for (const [k, v] of Object.entries(patch)) { if (v === null) n.delete(k); else n.set(k, v); } return n; }, { replace: true });
  const pickDate = (d: string) => { setOpen(null); setQ(''); query({ date: d === today ? null : d, member: null }); };
  const pickRound = (id: RoundId) => { setOpen(null); setQ(''); query({ round: id, member: null }); };

  // ----- Mood & notes: the form per person -----
  const key = (id: string) => `${date}:${id}`;
  const baseOf = (id: string) => baseEntry(logs.get(id));
  const entry = (id: string) => drafts[key(id)] ?? baseOf(id);
  const dirty = (id: string) => !!drafts[key(id)] && !sameLog(drafts[key(id)], baseOf(id));
  const edit = (id: string, patch: Partial<LogEntry>) => setDrafts((d) => ({ ...d, [key(id)]: { ...(d[key(id)] ?? baseOf(id)), ...patch } }));
  const clear = (id: string) => setDrafts((d) => { const n = { ...d }; delete n[key(id)]; return n; });
  const what = (e: LogEntry) => logDeviations(e).map((k) => t('activity.opt.' + k)).join(', ');
  const saveMood = async (id: string) => {
    if (busy) return;
    const e = entry(id);
    const was = logs.get(id)?.mood !== undefined;
    setBusy(true);
    const r = await act('log.save', logInput(id, date, e), { silent: true });
    setBusy(false);
    if (!r.ok) return;
    clear(id);
    setOpen(null);
    const name = s.members[id] ? memberShort(s.members[id]) : '';
    const dev = what(e).toLowerCase();
    const msg = was ? t('activity.logUpdated', { name }) : dev ? t('activity.logSavedWhat', { name, what: dev }) : t('activity.logSavedNormal', { name });
    say(r.result.pending ? `${msg} ${t('approvals.waitingShort')}` : msg);
  };
  // deep link: /log?member=m10 opens that member's Mood & notes card and scrolls to it
  const handled = useRef<string | null>(null);
  useEffect(() => {
    if (!wantMember || handled.current === wantMember || !people.some((m) => m.id === wantMember)) return;
    handled.current = wantMember;
    setOpen(wantMember);
    setQ('');
    requestAnimationFrame(() => requestAnimationFrame(() => document.getElementById('log-card-' + wantMember)?.scrollIntoView({ block: 'start' })));
  }, [wantMember, people.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // ----- marking rounds (lunch, sessions) -----
  const lunchChoices: RoundChoice[] = LUNCH_AMOUNTS.map((v) => ({ value: v, label: t('activity.lunchShort.' + v), tone: v === 'all' ? 'normal' : v === 'none' ? 'alert' : 'other' }));
  const sessionChoices: RoundChoice[] = SESSION_MARKS.map((v) => ({ value: v, label: t('activity.opt.session.' + v), tone: v === 'joined' ? 'normal' : 'other' }));
  const choices = round.kind === 'lunch' ? lunchChoices : sessionChoices;
  const markOne = (id: string, v: string | null) => {
    const part = round.kind === 'lunch' ? { lunch: v } : { session: { slot: round.id, value: v } };
    void act('log.mark', { date, memberIds: [id], ...part }, { silent: true }); // the replica shows the mark at once; a failure toasts and rolls it back
  };
  const restWhat = t('activity.restWhat.' + round.kind);
  const markRest = async () => {
    setAsk(false);
    if (busy || !left.length) return;
    const ids = left.map((m) => m.id);
    const part = round.kind === 'lunch' ? { lunch: 'all' } : round.kind === 'mood' ? { mood: 'calm', communicative: 'normal', content: 'normal' } : { session: { slot: round.id, value: 'joined' } };
    setBusy(true);
    const r = await act('log.mark', { date, memberIds: ids, onlyEmpty: true, ...part }, { silent: true });
    setBusy(false);
    if (!r.ok) return;
    const msg = plural(t, 'activity.restMarked', Number(r.result.marked || 0));
    say(r.result.pending ? `${msg} ${t('approvals.waitingShort')}` : msg);
  };

  // ----- the list -----
  const found = useMemo(() => searchMembers(people, q), [people, q]);
  const wentHome = (m: Member) => isToday && !!s.attendance[attId(date, m.id)]?.checkOut;
  const inClub = found.filter((m) => !wentHome(m));
  const gone = found.filter(wentHome);
  const allDone = people.length > 0 && !left.length;
  const restLabel = t(round.kind === 'lunch' ? 'activity.markRestLunch' : round.kind === 'mood' ? 'activity.markRestMood' : 'activity.markRestSession');
  const block = (title: ReactNode, meta: ReactNode, list: Member[]) => {
    const rows = list.map((m, i) => (round.kind === 'mood'
      ? <MoodRow key={m.id} m={m} i={i} log={logs.get(m.id)} entry={entry(m.id)} dirty={dirty(m.id)} open={open === m.id} busy={busy} s={s} today={today}
          onToggle={() => setOpen(open === m.id ? null : m.id)} onEdit={(patch) => edit(m.id, patch)} onSave={() => void saveMood(m.id)} onProfile={() => navigate(`/members/${m.id}`)} />
      : <MarkRow key={m.id} m={m} i={i} log={logs.get(m.id)} stacked={isPhone && round.kind === 'lunch'} choices={choices} value={round.kind === 'lunch' ? logs.get(m.id)?.lunch : logs.get(m.id)?.sessions?.[round.id as '10:30' | '13:30']}
          onPick={(v) => markOne(m.id, v)} label={nameOf(round)} lunch={round.kind === 'lunch'} />));
    return isPhone ? <Group key={String(title)} title={title} meta={meta} pad="0" gap={0}>{rows}</Group> : (
      <section key={String(title)} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {title ? <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, padding: '0 4px' }}><h2 style={GROUP_HEAD}>{title}</h2><span style={{ fontSize: 13, color: '#6B6259' }}>{meta}</span></div> : null}
        <Card>{rows}</Card>
      </section>
    );
  };
  const split = isToday && inClub.length > 0 && gone.length > 0;

  return (
    <div className={isPhone ? 'cp-native' : undefined} style={{ padding: padFor(device), display: 'flex', flexDirection: 'column', gap: isPhone ? 10 : 'clamp(14px, 2vw, 22px)' }}>
      <PageHead eyebrow={fdl(date)} title={t('nav.log')} />

      <div className="scroll-x" style={{ display: 'flex', gap: 8, paddingBottom: 4 }} role="group" aria-label={t('activity.pickDay')}>
        {dates.map((d) => <Chip key={d} selected={d === date} onClick={() => pickDate(d)}>{d === today ? t('common.today') : d === addDays(today, -1) ? t('common.yesterday') : fds(d)}</Chip>)}
      </div>
      {isToday ? null : <Note tone="ochre" icon="history">{t('activity.editingPast', { date: fdl(date) })}</Note>}

      <RoundTabs rounds={rounds} value={round.id} onChange={pickRound} label={t('activity.rounds')} nameOf={nameOf} doneOf={(r) => people.length > 0 && markedIn(r) === people.length} />

      {people.length ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, minHeight: 28 }}>
            <span data-testid="round-progress" style={{ fontSize: 14, fontWeight: 500, color: allDone ? '#3D6B4F' : '#5E5852', display: 'inline-flex', alignItems: 'center', gap: 6, fontVariantNumeric: 'tabular-nums' }}>
              {allDone ? <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: 999, background: '#3D6B4F' }} /> : null}
              {allDone ? t('activity.allMarked') : t('activity.markedOf', { n: marked, total: people.length })}
            </span>
            {!isPhone && left.length ? <Button variant="secondary" size={44} icon="done_all" disabled={busy} onClick={() => setAsk(true)}>{restLabel}</Button> : null}
          </div>
          {isPhone ? <SearchBar value={q} onChange={setQ} label={t('activity.searchMember')} placeholder={t('activity.searchMemberPh')} /> : <TextField label={t('activity.searchMember')} value={q} onChange={setQ} placeholder={t('activity.searchMemberPh')} inputMode="search" />}
        </>
      ) : null}

      <div data-testid="round-list" data-round={round.id} style={{ display: 'flex', flexDirection: 'column', gap: isPhone ? 14 : 18 }}>
        {split ? (
          <>
            {block(t('activity.inClub'), inClub.length, inClub)}
            {block(t('activity.wentHome'), gone.length, gone)}
          </>
        ) : found.length ? block(undefined, null, found) : null}
      </div>
      {people.length && !found.length ? <div role="status" style={{ padding: '28px 20px', borderRadius: isPhone ? 14 : 16, background: '#FFFFFF', border: isPhone ? 'none' : '1px solid #EFE7DC', textAlign: 'center', fontSize: 16, color: '#5E5852', lineHeight: 1.4 }}>{t('activity.noMemberMatch', { q: q.trim() })}</div> : null}
      {!people.length ? <div style={{ padding: '40px 20px', borderRadius: isPhone ? 14 : 16, background: '#FFFFFF', border: isPhone ? 'none' : '1px solid #EFE7DC', boxShadow: 'var(--card-shadow)', textAlign: 'center', fontSize: 16, color: '#5E5852', lineHeight: 1.4 }}>{t(isToday ? 'activity.nobodyYet' : 'activity.nobodyThatDay')}</div> : null}

      {isPhone && left.length && !(round.kind === 'mood' && open) ? <Pin icon="done_all" label={restLabel} onClick={() => setAsk(true)} /> : null}
      <Sheet open={ask} onClose={() => setAsk(false)} title={plural(t, 'activity.markRestTitle', left.length, { what: restWhat })}
        footer={<div style={{ display: 'flex', gap: 8 }}><Button full variant="secondary" onClick={() => setAsk(false)}>{t('common.cancel')}</Button><Button full onClick={() => void markRest()}>{t('activity.markRestGo')}</Button></div>}>
        {null}
      </Sheet>
    </div>
  );
}

/** The switch of rounds. It scrolls sideways when the labels do not fit and keeps the chosen round in view; a round everyone is marked in shows a tick. */
function RoundTabs({ rounds, value, onChange, label, nameOf, doneOf }: { rounds: Round[]; value: RoundId; onChange: (id: RoundId) => void; label: string; nameOf: (r: Round) => string; doneOf: (r: Round) => boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest' }); }, [value]);
  return (
    <div ref={ref} role="tablist" aria-label={label} style={{ display: 'flex', gap: 2, padding: 3, borderRadius: 11, background: '#EAE6E0', overflowX: 'auto', scrollbarWidth: 'none', maxWidth: '100%' }}>
      {rounds.map((r) => {
        const on = r.id === value;
        return (
          <button key={r.id} type="button" role="tab" aria-selected={on} data-round={r.id} onClick={() => onChange(r.id)} className="cp-press"
            style={{ flex: '1 0 auto', height: 36, padding: '0 12px', borderRadius: 9, border: 'none', background: on ? '#FFFFFF' : 'transparent', boxShadow: on ? '0 1px 3px rgba(40,30,20,0.14)' : 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, cursor: 'pointer', fontFamily: 'Inter', fontSize: 14, fontWeight: on ? 600 : 500, color: on ? '#1E1A16' : '#5E5852', whiteSpace: 'nowrap' }}>
            {nameOf(r)}
            {doneOf(r) ? <Icon name="check_circle" size={16} fill={1} color="#3D6B4F" /> : null}
          </button>
        );
      })}
    </div>
  );
}

/** The red dot of an approval that waits (the full text only when management sent it back). */
function PendingDot({ log }: { log: LogRow | undefined }) {
  const t = useT();
  const st = log ? approvalState(log) : null;
  if (!st) return null;
  if (st === 'rejected') return <PendingMark row={log} />;
  return <span data-testid="approval-mark" data-state="pending" role="img" aria-label={t('approvals.pending')} title={t('approvals.pending')} style={{ width: 7, height: 7, borderRadius: 999, background: '#7A5510', flex: 'none' }} />;
}

/** One person in a lunch or activity round: name (with the allergy dot and diet hint at lunch) and the one-tap choices. Unmarked rows carry a faint tint. */
function MarkRow({ m, i, log, stacked, choices, value, onPick, label, lunch }: { m: Member; i: number; log: LogRow | undefined; stacked: boolean; choices: RoundChoice[]; value: string | undefined; onPick: (v: string | null) => void; label: string; lunch: boolean }) {
  const t = useT();
  const { isPhone } = useDevice();
  const allergies = lunch ? [...m.health.food.map((a) => t('lobby.food.' + a)), ...(m.health.foodOther ? [m.health.foodOther] : [])] : [];
  const diets = lunch ? m.health.diet.map((d) => t('lobby.diet.' + d)) : [];
  const chips = <RoundChips choices={choices} value={value} onPick={onPick} label={`${memberName(m)} · ${label}`} />;
  return (
    <div data-testid="log-row" data-member={m.id} data-marked={value !== undefined ? '1' : '0'}
      style={{ backgroundColor: value !== undefined ? '#FFFFFF' : '#FAF6EF', padding: isPhone ? '10px 14px 10px 16px' : '12px 22px', display: 'flex', flexDirection: stacked ? 'column' : 'row', alignItems: stacked ? 'stretch' : 'center', gap: stacked ? 8 : 12, ...rowStyle(i === 0, isPhone) }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: stacked ? 'none' : 1, minWidth: 0 }}>
        <Av m={m} size={isPhone ? 40 : 44} fs={isPhone ? 14 : 15} />
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.35, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{memberName(m)}</span>
            <PendingDot log={log} />
          </span>
          {allergies.length || diets.length ? (
            <span style={{ fontSize: FONT_SMALL, lineHeight: '18px', color: '#6B6259', display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              {allergies.length ? <span data-testid="allergy-hint" style={{ color: '#9A3D24', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 5 }}><span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: 999, background: '#9A3D24', flex: 'none' }} />{t('lobby.drugAllergy', { d: allergies.join(', ') })}</span> : null}
              {diets.length ? <span>{diets.join(', ')}</span> : null}
            </span>
          ) : null}
        </span>
      </div>
      {chips}
    </div>
  );
}

/** One person in the Mood & notes round: a row that opens the form in place. */
function MoodRow({ m, i, log, entry, dirty, open, busy, s, today, onToggle, onEdit, onSave, onProfile }: {
  m: Member; i: number; log: LogRow | undefined; entry: LogEntry; dirty: boolean; open: boolean; busy: boolean; s: ReturnType<typeof useClub>; today: string;
  onToggle: () => void; onEdit: (patch: Partial<LogEntry>) => void; onSave: () => void; onProfile: () => void;
}) {
  const t = useT();
  const { fds } = useFmt();
  const { isPhone } = useDevice();
  const saved = log?.mood !== undefined;
  const dev = logDeviations(entry).map((k) => t('activity.opt.' + k)).join(', ');
  const status = saved && !dirty ? (dev ? t('activity.stSaved', { what: dev }) : t('activity.stSavedNormal')) : dev ? t('activity.stDraft', { what: dev }) : t('activity.stDraftNormal');
  const lastEdit = log?.edits.length ? log.edits[log.edits.length - 1] : null;
  return (
    <div id={'log-card-' + m.id} data-testid="log-row" data-member={m.id} data-marked={saved ? '1' : '0'} style={{ background: open ? '#FBF9F6' : saved ? '#FFFFFF' : '#FAF6EF', scrollMarginTop: 12, ...rowStyle(i === 0 || open, isPhone) }}>
      <button type="button" className={isPhone ? 'cp-tap-self' : undefined} onClick={onToggle} aria-expanded={open} aria-controls={'log-body-' + m.id} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: isPhone ? '10px 14px 10px 16px' : '12px 22px', minHeight: isPhone ? 60 : 68, border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', color: '#24201C', fontFamily: 'Inter' }}>
        <Av m={m} size={isPhone ? 40 : 44} fs={isPhone ? 14 : 15} />
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.35 }}>{memberName(m)}</span>
          <span className="cp-hide-phone" style={{ fontSize: 'max(13px, var(--cp-body, 0px))', lineHeight: '18px', color: '#6B6259' }}>{cogLine(t, cogSummary(s, m))}</span>
          <span style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 14px' }}>
            <StatusDot color={saved && !dirty ? '#3D6B4F' : '#8A8078'}>{status}</StatusDot>
            {log && approvalState(log) ? <PendingMark row={log} /> : null}
          </span>
        </span>
        <Icon name="expand_more" size={24} color="#75624B" style={{ transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>
      {open ? (
        <div id={'log-body-' + m.id} style={{ padding: isPhone ? '2px 16px 16px' : '8px 22px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <LogFieldsForm e={entry} onChange={onEdit} />
          {saved && log ? (
            <div style={{ fontSize: FONT_SMALL, color: '#5E5852', lineHeight: 1.4 }}>
              {t('activity.savedBy', { name: staffCall(s.staff[log.by]) || actorName(s, log.createdBy) })}
              {lastEdit ? ` · ${t('activity.editedBy', { name: staffCall(s.staff[lastEdit.by]) || lastEdit.by, when: (lastEdit.at.slice(0, 10) === today ? '' : fds(lastEdit.at.slice(0, 10)) + ' ') + lastEdit.at.slice(11, 16) })}` : ''}
            </div>
          ) : null}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="dh44 cp-btn" onClick={onSave} aria-disabled={busy} style={{ flex: '1 1 180px', height: 52, borderRadius: 999, border: 'none', background: '#24201C', color: '#FFFFFF', fontSize: 16, fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter' }}>{saved ? t('activity.saveChanges') : t('activity.saveLog')}</button>
            <button type="button" className="cp-btn" onClick={onProfile} style={{ height: 52, padding: '0 20px', borderRadius: 12, border: '1px solid #DCD3C8', background: '#FFFFFF', color: '#24201C', fontSize: 16, fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Icon name="person" size={20} />{t('activity.openProfile')}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
