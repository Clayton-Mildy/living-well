// Daily log (design ScrDlog): one accordion per member who was here, chips for what differed, a note for the family, Save log.
// Fixes: every mood / lunch amount / observation is stored as entered, the last 7 days are editable, family comments show under each log with a staff reply,
// and "Save everyone else as normal" only covers members present and not yet logged. A search finds a member by name and the list is paged.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { actorName, addDays, memberName, memberShort, staffCall } from '@cp/shared';
import { PendingMark } from '../../components/PendingMark';
import { approvalState } from '@cp/shared/rules/approvals';
import { NORMAL_LOG, attendedOn, cogSummary, logComments, logDateOk, logDates, logDeviations, logOf, pendingLogMembers, searchMembers } from '@cp/shared/rules/activity';
import { Chip, Icon, Note, PageHead, Pager, SectionLabel, TextField, usePaged, FONT_SMALL } from '../../components/ui';
import { useDevice, padFor } from '../../hooks/useDevice';
import { useT, useFmt } from '../../lib/i18n';
import { useAct } from '../../lib/act';
import { useNow } from '../../lib/clock';
import { useClub } from '../../store/replica';
import { say } from '../../store/ui';
import { Av, StatusDot, cogLine, plural } from './lib';
import { LogFieldsForm, logInput, sameLog, type LogEntry } from './LogFields';

type Entry = LogEntry;
const LOG_PAGE = 8;
const same = sameLog;

export function DailyLog() {
  const t = useT();
  const { fdl, fds } = useFmt();
  const { device, isPhone } = useDevice();
  const s = useClub();
  const { today } = useNow();
  const act = useAct();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState<string | null>(params.get('member'));
  const [drafts, setDrafts] = useState<Record<string, Entry>>({});
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  const pageRef = useRef<HTMLDivElement>(null);

  const qd = params.get('date');
  const date = qd && logDateOk(today, qd) ? qd : today;
  const dates = useMemo(() => logDates(s, today), [s, today]);
  const people = useMemo(() => attendedOn(s, date), [s, date]);
  const pending = useMemo(() => pendingLogMembers(s, date), [s, date]);
  const isToday = date === today;
  const found = useMemo(() => searchMembers(people, q), [people, q]);
  const paged = usePaged(found, LOG_PAGE, q + '|' + date);

  const key = (id: string) => `${date}:${id}`;
  const baseOf = (id: string): Entry => {
    const l = logOf(s, id, date);
    return l ? { mood: l.mood, lunch: l.lunch, joined: l.joined, communicative: l.communicative, content: l.content, note: l.note, staffNote: l.staffNote || '' } : { ...NORMAL_LOG, note: '', staffNote: '' };
  };
  const entry = (id: string) => drafts[key(id)] ?? baseOf(id);
  const dirty = (id: string) => !!drafts[key(id)] && !same(drafts[key(id)], baseOf(id));
  const edit = (id: string, patch: Partial<Entry>) => setDrafts((d) => ({ ...d, [key(id)]: { ...(d[key(id)] ?? baseOf(id)), ...patch } }));
  const clear = (id: string) => setDrafts((d) => { const n = { ...d }; delete n[key(id)]; return n; });
  const what = (e: Entry) => logDeviations(e).map((k) => t('activity.opt.' + k)).join(', ');

  // deep link: /log?member=m10 opens that member's card and scrolls to it
  const handled = useRef<string | null>(null);
  useEffect(() => {
    const id = params.get('member');
    if (!id || handled.current === id || !people.some((m) => m.id === id)) return;
    handled.current = id;
    setOpen(id);
    setQ('');
    paged.setPage(Math.floor(people.findIndex((m) => m.id === id) / LOG_PAGE) + 1);
    requestAnimationFrame(() => requestAnimationFrame(() => document.getElementById('log-card-' + id)?.scrollIntoView({ block: 'start' })));
  }, [params.get('member'), people.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const pickDate = (d: string) => { setOpen(null); setParams(d === today ? {} : { date: d }, { replace: true }); };
  const savedN = people.filter((m) => !!logOf(s, m.id, date)).length;
  const allDone = people.length > 0 && !pending.length;

  const save = async (id: string) => {
    if (busy) return;
    const e = entry(id);
    const was = !!logOf(s, id, date);
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
  const saveRest = async () => {
    if (busy || !pending.length) return;
    setBusy(true);
    let n = 0;
    let waiting = false;
    for (const m of pending.filter((x) => dirty(x.id))) { // somebody changed chips but did not save: keep what they entered
      const e = entry(m.id);
      const r = await act('log.save', logInput(m.id, date, e), { silent: true });
      if (r.ok) { n++; clear(m.id); waiting = waiting || !!r.result.pending; }
    }
    if (pending.some((x) => !dirty(x.id))) {
      const r = await act('log.saveAllNormal', { date }, { silent: true });
      if (r.ok) { n += Number(r.result.saved || 0); waiting = waiting || !!r.result.pending; }
    }
    setBusy(false);
    setOpen(null);
    if (n) say(waiting ? `${plural(t, 'activity.bulkSaved', n)} ${t('approvals.waitingShort')}` : plural(t, 'activity.bulkSaved', n));
  };
  const reply = async (logRowId: string, threadId: string) => {
    const text = (replies[logRowId] || '').trim();
    if (!text) return;
    const r = await act('message.send', { threadId, text, ref: { type: 'dailyLog', id: logRowId } }, { ok: t('activity.replySent') });
    if (r.ok) setReplies((x) => ({ ...x, [logRowId]: '' }));
  };

  return (
    <div ref={pageRef} style={{ padding: padFor(device), display: 'flex', flexDirection: 'column', gap: isPhone ? 10 : 'clamp(14px, 2vw, 22px)', maxWidth: 760 }}>
      <PageHead eyebrow={`${fdl(date)} · ${t('activity.savedOf', { n: savedN, total: people.length })}`} title={t('nav.log')}
        right={allDone ? <span style={{ color: '#3D6B4F', fontSize: 14, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}><span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: 999, background: '#3D6B4F' }} />{t('activity.allSaved')}</span> : undefined} />

      <div className="scroll-x" style={{ display: 'flex', gap: 8, paddingBottom: 4 }} role="group" aria-label={t('activity.pickDay')}>
        {dates.map((d) => <Chip key={d} selected={d === date} onClick={() => pickDate(d)}>{d === today ? t('common.today') : d === addDays(today, -1) ? t('common.yesterday') : fds(d)}</Chip>)}
      </div>
      {isToday ? null : <Note tone="ochre" icon="history">{t('activity.editingPast', { date: fdl(date) })}</Note>}

      {people.length ? (
        <TextField label={t('activity.searchMember')} value={q} onChange={setQ} placeholder={t('activity.searchMemberPh')} inputMode="search" />
      ) : null}
      {paged.rows.map((m) => {
        const e = entry(m.id);
        const log = logOf(s, m.id, date);
        const isOpen = open === m.id;
        const dev = what(e);
        const isDirty = dirty(m.id);
        const savedNow = !!log && !isDirty;
        const status = savedNow ? (dev ? t('activity.stSaved', { what: dev }) : t('activity.stSavedNormal')) : dev ? t('activity.stDraft', { what: dev }) : t('activity.stDraftNormal');
        const comments = log ? logComments(s, log.id) : [];
        const threadId = comments.length ? comments[comments.length - 1].threadId : '';
        const lastEdit = log?.edits.length ? log.edits[log.edits.length - 1] : null;
        return (
          <div key={m.id} id={'log-card-' + m.id} style={{ background: '#FFFFFF', border: '1px solid #EFE7DC', borderRadius: 16, boxShadow: 'var(--card-shadow)', overflow: 'hidden', scrollMarginTop: 12 }}>
            <button type="button" onClick={() => setOpen(isOpen ? null : m.id)} aria-expanded={isOpen} aria-controls={'log-body-' + m.id} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: isPhone ? '12px 16px' : '16px 22px', minHeight: isPhone ? 60 : 72, border: 'none', background: '#FFFFFF', textAlign: 'left', cursor: 'pointer', color: '#24201C', fontFamily: 'Inter' }}>
              <Av m={m} size={isPhone ? 40 : 48} fs={isPhone ? 14 : 16} />
              <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 17, fontWeight: 500, lineHeight: 1.4 }}>{memberName(m)}</span>
                <span style={{ fontSize: 'max(13px, var(--cp-body, 0px))', lineHeight: '18px', color: '#6B6259' }}>{cogLine(t, cogSummary(s, m))}</span>
                <span style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 14px' }}>
                  <StatusDot color={savedNow ? '#3D6B4F' : '#8A8078'}>{status}</StatusDot>
                  {log && approvalState(log) ? <PendingMark row={log} /> : null}
                  {comments.length ? <StatusDot color="#7A5510">{plural(t, 'activity.commentsN', comments.length)}</StatusDot> : null}
                </span>
              </span>
              <Icon name="expand_more" size={24} color="#75624B" style={{ transform: isOpen ? 'rotate(180deg)' : 'none' }} />
            </button>
            {isOpen ? (
              <div id={'log-body-' + m.id} style={{ padding: '8px 22px 20px', margin: isPhone ? 0 : undefined, display: 'flex', flexDirection: 'column', gap: 12, borderTop: '1px solid #F0EAE1' }}>
                <LogFieldsForm e={e} onChange={(patch) => edit(m.id, patch)} />
                {comments.length ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <SectionLabel>{t('activity.familyComments')}</SectionLabel>
                    {comments.map((c) => (
                      <div key={c.id} style={{ alignSelf: c.fromFamily ? 'flex-start' : 'flex-end', maxWidth: '92%', background: c.fromFamily ? '#F3EEE8' : '#EAF1EC', borderRadius: 12, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontSize: FONT_SMALL, color: '#5E5852', lineHeight: 1.4 }}>{actorName(s, c.from)} · {c.at.slice(0, 10) === today ? c.at.slice(11, 16) : fds(c.at.slice(0, 10)) + ' ' + c.at.slice(11, 16)}</span>
                        <span style={{ fontSize: 16, lineHeight: '22px' }}>{c.text}</span>
                      </div>
                    ))}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                      <div style={{ flex: 1, minWidth: 0 }}><TextField label={t('activity.replyLabel')} value={replies[log!.id] || ''} onChange={(v) => setReplies((x) => ({ ...x, [log!.id]: v }))} placeholder={t('activity.replyPh')} onEnter={() => reply(log!.id, threadId)} /></div>
                      <button type="button" onClick={() => reply(log!.id, threadId)} aria-disabled={!(replies[log!.id] || '').trim()} style={{ height: 52, padding: '0 18px', borderRadius: 12, border: '1px solid #DCD3C8', background: '#FFFFFF', color: '#24201C', fontSize: 16, fontWeight: 500, cursor: 'pointer', flex: 'none', fontFamily: 'Inter' }}>{t('activity.reply')}</button>
                    </div>
                  </div>
                ) : null}
                {log ? (
                  <div style={{ fontSize: FONT_SMALL, color: '#5E5852', lineHeight: 1.4 }}>
                    {t('activity.savedBy', { name: staffCall(s.staff[log.by]) || actorName(s, log.createdBy) })}
                    {lastEdit ? ` · ${t('activity.editedBy', { name: staffCall(s.staff[lastEdit.by]) || lastEdit.by, when: (lastEdit.at.slice(0, 10) === today ? '' : fds(lastEdit.at.slice(0, 10)) + ' ') + lastEdit.at.slice(11, 16) })}` : ''}
                  </div>
                ) : null}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" className="dh44 cp-btn" onClick={() => save(m.id)} aria-disabled={busy} style={{ flex: '1 1 180px', height: 52, borderRadius: 999, border: 'none', background: '#24201C', color: '#FFFFFF', fontSize: 16, fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter' }}>{log ? t('activity.saveChanges') : t('activity.saveLog')}</button>
                  <button type="button" className="cp-btn" onClick={() => navigate(`/members/${m.id}`)} style={{ height: 52, padding: '0 20px', borderRadius: 12, border: '1px solid #DCD3C8', background: '#FFFFFF', color: '#24201C', fontSize: 16, fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <Icon name="person" size={20} />{t('activity.openProfile')}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
      {people.length && !found.length ? <div role="status" style={{ padding: '28px 20px', borderRadius: 16, background: '#FFFFFF', border: '1px solid #EFE7DC', boxShadow: 'var(--card-shadow)', textAlign: 'center', fontSize: 16, color: '#5E5852', lineHeight: 1.4 }}>{t('activity.noMemberMatch', { q: q.trim() })}</div> : null}
      <Pager page={paged.page} pages={paged.pages} onPage={paged.setPage} label={t('activity.logPager')} />
      {!people.length ? <div style={{ padding: '40px 20px', borderRadius: 16, background: '#FFFFFF', border: '1px solid #EFE7DC', boxShadow: 'var(--card-shadow)', textAlign: 'center', fontSize: 16, color: '#5E5852', lineHeight: 1.4 }}>{t(isToday ? 'activity.nobodyYet' : 'activity.nobodyThatDay')}</div> : null}
      {pending.length ? (
        <button type="button" className="cp-btn" onClick={saveRest} aria-disabled={busy} style={{ position: 'sticky', bottom: 12, zIndex: 3, boxShadow: '0 8px 24px rgba(60,40,20,0.14)', height: 52, borderRadius: 999, border: '1px solid #DCD3C8', background: '#FFFFFF', color: '#24201C', fontSize: 16, fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter' }}>{t('activity.saveRest')}</button>
      ) : null}
    </div>
  );
}
