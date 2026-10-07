// Surveys (design ScrSurveys): the live survey with ratings and comments, a new-survey form (preset questions, questions of your own,
// team picked from staff, saved as a draft and edited before sending), drafts, and earlier surveys with a full detail view
// (ratings, comments, a summary per question of your own, response per family).
import { Fragment, useMemo, useState } from 'react';
import {
  SURVEY_BUILTINS, SURVEY_KINDS, SURVEY_LIMITS, linksOfFamily, live, liveSurvey, memberName, memberShort, parseOptions, questionProblem, staffCall, surveyStats,
  type CustomResult, type Survey, type SurveyCustomQuestion, type SurveyQuestionKind,
} from '@cp/shared';
import { appFamilies, recommendPct, resolveSurveyAudience, surveyMembers, teamCandidates, type SurveyAudience } from '@cp/shared/rules/mgmt';
import { Button, Chip, Dialog, Icon, IconButton, Note, PageHead, Pager, SectionLabel, Select, TextField, Toggle, usePaged, FONT_BODY, FONT_SMALL } from '../../components/ui';
import { useT, useFmt } from '../../lib/i18n';
import { useNow } from '../../lib/clock';
import { useAct } from '../../lib/act';
import { useClub } from '../../store/replica';
import { BadgePill, HPAD, IconBox, ListCard, Page, Pill, TONE, heroCard, labelStyle, chipRow, tn, wrapChip } from './common';

const QUESTIONS = SURVEY_BUILTINS;
/** Who the survey goes to as picked on screen: all three lists are kept so switching the choice does not lose what was picked. */
interface AudDraft { mode: SurveyAudience['mode']; memberIds: string[]; contactIds: string[] }
interface Draft { id?: string; title: string; questions: Survey['questions']; custom: SurveyCustomQuestion[]; team: string[]; aud: AudDraft }
const audPayload = (a: AudDraft): SurveyAudience => (a.mode === 'members' ? { mode: 'members', memberIds: a.memberIds } : a.mode === 'contacts' ? { mode: 'contacts', contactIds: a.contactIds } : { mode: 'all' });
const audDraft = (a: Survey['audience']): AudDraft => ({ mode: a?.mode ?? 'all', memberIds: a?.memberIds ?? [], contactIds: a?.contactIds ?? [] });

export function Surveys() {
  const t = useT();
  const { fds } = useFmt();
  const s = useClub();
  const { today } = useNow();
  const act = useAct();
  const lv = liveSurvey(s);
  const cands = teamCandidates(s);
  const defaultTeam = cands.filter((x) => x.rateable).map((x) => x.id);
  const blank = (): Draft => ({ title: '', questions: [...SURVEY_BUILTINS], custom: [], team: defaultTeam, aud: audDraft(undefined) });
  const [f, setF] = useState<Draft>(blank);
  const [detail, setDetail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const recipients = useMemo(() => resolveSurveyAudience(s, audPayload(f.aud), today), [s, f.aud, today]);
  const anyFamily = useMemo(() => appFamilies(s, today).length > 0, [s, today]);
  const all = live(s.surveys);
  const drafts = all.filter((x) => x.status === 'draft');
  const past = all.filter((x) => x.status === 'closed').sort((a, b) => (a.sentOn < b.sentOn ? 1 : a.sentOn > b.sentOn ? -1 : 0));
  const draftsPaged = usePaged(drafts, 5);
  const pastPaged = usePaged(past, 6);
  const hasTeam = f.questions.includes('team');
  const asksNothing = !f.questions.length && !f.custom.length;
  const ok = !!f.title.trim() && (!hasTeam || f.team.length > 0) && !asksNothing;
  const toggleQ = (q: Survey['questions'][number]) => {
    const on = f.questions.includes(q);
    const questions = QUESTIONS.filter((x) => (x === q ? !on : f.questions.includes(x)));
    setF({ ...f, questions, team: q === 'team' && !on && !f.team.length ? defaultTeam : f.team });
  };
  const payload = () => ({ title: f.title.trim(), questions: f.questions, custom: f.custom.map((c) => ({ id: c.id, kind: c.kind, text: c.text.trim(), ...(c.kind === 'choice' ? { options: c.options } : {}), required: c.required })), teamStaffIds: hasTeam ? f.team : [], audience: audPayload(f.aud) });
  const sendNow = async () => {
    if (!ok || busy) return;
    setBusy(true);
    try {
      const r = f.id ? await act('survey.update', { surveyId: f.id, ...payload() }, { silent: true }) : await act('survey.create', payload(), { silent: true });
      if (!r.ok) return;
      const id = f.id || String(r.result.surveyId);
      const r2 = await act('survey.send', { surveyId: id }, { ok: tn(t, 'mgmt.svSent', recipients.length) });
      if (r2.ok) setF(blank());
      else setF({ ...f, id });
    } finally { setBusy(false); }
  };
  const saveDraftOnly = async () => {
    if (!ok || busy) return;
    setBusy(true);
    try {
      const r = f.id ? await act('survey.update', { surveyId: f.id, ...payload() }, { ok: t('mgmt.svDraftSaved') }) : await act('survey.create', payload(), { ok: t('mgmt.svDraftSaved') });
      if (r.ok) setF(blank());
    } finally { setBusy(false); }
  };
  const edit = (x: Survey) => setF({ id: x.id, title: x.title, questions: x.questions, custom: (x.custom ?? []).map((c) => ({ ...c, options: c.options ? [...c.options] : undefined })), team: x.teamStaffIds, aud: audDraft(x.audience) });
  const q = (k: Survey['questions'][number]) => t('mgmt.svq_' + k);
  const staffName = (id: string) => staffCall(s.staff[id]) || id;
  const staffRole = (id: string) => (s.staff[id] ? t('roles.' + s.staff[id].role) : '');

  const liveStats = lv ? surveyStats(s, lv) : null;

  return (
    <Page gap={18}>
      <PageHead eyebrow={t('mgmt.svEyebrow')} title={t('nav.surveys')} />

      {lv && liveStats ? (
        <div style={{ ...heroCard, padding: `22px ${HPAD}`, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={labelStyle}>{t('mgmt.svLiveSent', { date: fds(lv.sentOn) })}</span>
              <span style={{ fontSize: 22, lineHeight: '30px', fontWeight: 400, letterSpacing: '-0.3px', color: '#2B231C' }}>{lv.title}</span>
              <span style={{ fontSize: 14, lineHeight: 1.4, color: '#6B6259' }}>{t('mgmt.svSentTo')}: {audienceText(t, lv, lv.recipients.length)}</span>
            </div>
            <span style={{ height: 26, padding: '0 12px', borderRadius: 8, background: TONE.sage.bg, color: TONE.sage.fg, fontSize: 13, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
              {tn(t, 'mgmt.svRespOf', liveStats.recipients, { n: liveStats.answered, total: liveStats.recipients })}
            </span>
          </div>
          <Tiles s={s} sv={lv} />
          <TeamBars sv={lv} staffName={staffName} staffRole={staffRole} />
          <Comments sv={lv} max={5} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button size={44} variant="secondary" icon="analytics" onClick={() => setDetail(lv.id)}>{t('mgmt.svDetails')}</Button>
            <Button size={44} variant="secondary" icon="lock_clock" onClick={() => act('survey.close', { surveyId: lv.id }, { ok: t('mgmt.svClosed', { title: lv.title }) })}>{t('mgmt.svClose')}</Button>
          </div>
        </div>
      ) : null}

      <div style={{ ...heroCard, padding: `22px ${HPAD}`, display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 760 }}>
        <span style={labelStyle}>{f.id ? t('mgmt.svEditDraft') : t('mgmt.svNew')}</span>
        <TextField label={t('mgmt.svTitle')} value={f.title} onChange={(v) => setF({ ...f, title: v })} placeholder={t('mgmt.svTitlePh')} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 15, lineHeight: '22px', fontWeight: 500 }}>{t('mgmt.svQuestions')}</span>
          <div style={chipRow}>
            {QUESTIONS.map((k) => <Chip key={k} selected={f.questions.includes(k)} onClick={() => toggleQ(k)} size={44} style={wrapChip}>{q(k)}</Chip>)}
          </div>
        </div>
        {hasTeam ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 16, lineHeight: '22px', fontWeight: 500 }}>{t('mgmt.svTeam')}</span>
            <div style={chipRow}>
              {cands.map((x) => (
                <Chip key={x.id} selected={f.team.includes(x.id)} onClick={() => setF({ ...f, team: f.team.includes(x.id) ? f.team.filter((y) => y !== x.id) : [...f.team, x.id] })} style={wrapChip}>{`${staffCall(x)} · ${t('roles.' + x.role)}`}</Chip>
              ))}
            </div>
            {!f.team.length ? <span style={{ fontSize: 14, color: '#9A3D24', lineHeight: '20px' }} role="alert">{t('mgmt.err.teamRequired')}</span> : null}
          </div>
        ) : null}
        <CustomQuestions list={f.custom} onChange={(custom) => setF({ ...f, custom })} />
        {asksNothing ? <span style={{ fontSize: 14, color: '#9A3D24', lineHeight: '20px' }} role="alert">{t('mgmt.err.noQuestions')}</span> : null}
        <AudiencePicker value={f.aud} onChange={(aud) => setF({ ...f, aud })} count={recipients.length} />
        <span style={{ fontSize: 14, lineHeight: '20px', color: '#5E5852' }}>{t('mgmt.svHint')}</span>
        {!anyFamily ? <Note icon="info">{t('mgmt.svNoFamilies')}</Note> : !recipients.length ? <Note icon="info">{t('mgmt.svNoneChosen')}</Note> : null}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button size={56} full disabled={!ok || !recipients.length || busy} onClick={sendNow}>{tn(t, 'mgmt.svSendTo', recipients.length)}</Button>
          <Button size={56} variant="secondary" disabled={!ok || busy} onClick={saveDraftOnly}>{t('mgmt.svSaveDraft')}</Button>
          {f.id ? <Button size={56} variant="ghost" onClick={() => setF(blank())}>{t('mgmt.stopEditing')}</Button> : null}
        </div>
      </div>

      {drafts.length ? (
        <ListCard title={t('mgmt.svDrafts')}>
          {draftsPaged.rows.map((x) => (
            <Fragment key={x.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '16px 0', borderTop: '1px solid #F0EAE1' }}>
                <div style={{ flex: '1 1 200px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 16, lineHeight: '22px', fontWeight: 500 }}>{x.title}</span>
                  <span style={{ fontSize: 14, lineHeight: '20px', color: '#5E5852' }}>{[...x.questions.map(q), ...(x.custom?.length ? [tn(t, 'mgmt.svCustomCount', x.custom.length)] : [])].join(' · ')}</span>
                  <span data-draft-audience={x.id} style={{ fontSize: 14, lineHeight: '20px', color: '#5E5852' }}>{audienceText(t, x, resolveSurveyAudience(s, x.audience, today).length)}</span>
                </div>
                <Button size={44} variant="secondary" icon="edit" onClick={() => edit(x)}>{t('common.edit')}</Button>
                <Button size={44} variant="secondary" icon="delete" onClick={() => act('survey.delete', { surveyId: x.id }, { ok: t('mgmt.svDeleted') })}>{t('common.delete')}</Button>
              </div>
            </Fragment>
          ))}
          <Pager page={draftsPaged.page} pages={draftsPaged.pages} onPage={draftsPaged.setPage} label={t('mgmt.pgDrafts')} />
        </ListCard>
      ) : null}

      {past.length ? (
        <ListCard title={t('mgmt.svEarlier')}>
          {pastPaged.rows.map((x) => {
            const st = surveyStats(s, x);
            const rec = recommendPct(s, x);
            return (
              <Fragment key={x.id}>
                <button type="button" data-survey={x.id} onClick={() => setDetail(x.id)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 16, padding: '16px 0', minHeight: 64, border: 'none', borderTop: '1px solid #F0EAE1', background: 'transparent', textAlign: 'left', cursor: 'pointer', color: '#24201C', fontFamily: 'Inter' }}>
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <span style={{ fontSize: 17, lineHeight: '22px', fontWeight: 500 }}>{x.title}</span>
                    <span style={{ fontSize: 14, lineHeight: '20px', color: '#5E5852' }}>{rec === null ? tn(t, 'mgmt.svPastPlain', st.answered, { date: fds(x.sentOn) }) : tn(t, 'mgmt.svPastSub', st.answered, { date: fds(x.sentOn), rec })}</span>
                  </div>
                  <span style={{ fontSize: 15, fontWeight: 500, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{st.overallN ? `${st.overall.toFixed(1)} / 5` : '—'}</span>
                  <Icon name="chevron_right" size={20} color="#8A8078" />
                </button>
              </Fragment>
            );
          })}
          <Pager page={pastPaged.page} pages={pastPaged.pages} onPage={pastPaged.setPage} label={t('mgmt.pgSurveys')} />
        </ListCard>
      ) : null}

      <SurveyDetail id={detail} onClose={() => setDetail(null)} staffName={staffName} staffRole={staffRole} />
    </Page>
  );
}

function Tiles({ s, sv }: { s: ReturnType<typeof useClub>; sv: Survey }) {
  const t = useT();
  const st = surveyStats(s, sv);
  const rec = recommendPct(s, sv);
  const asks = (k: Survey['questions'][number]) => sv.questions.includes(k);
  const tiles = [
    ...(asks('overall') ? [{ label: t('mgmt.svOverall'), value: st.overallN ? `${st.overall.toFixed(1)} / 5` : '—', sub: tn(t, 'mgmt.svAnswers', st.overallN) }] : []),
    ...(asks('recommend') ? [{ label: t('mgmt.svRecommend'), value: rec === null ? '—' : `${rec}%`, sub: t('mgmt.svOfAnswered') }] : []),
    { label: t('mgmt.svRate'), value: `${st.rate}%`, sub: tn(t, 'mgmt.svRateSub', st.recipients, { n: st.answered, total: st.recipients }) },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(tiles.length, 3)}, minmax(0, 1fr))`, gap: 'clamp(10px, 2.4vw, 32px)', maxWidth: 640 }}>
      {tiles.map((x) => (
        <div key={x.label} style={{ padding: '0 0 12px', borderBottom: '2px solid #E6DDD1', display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
          <span style={{ fontSize: 'clamp(28px, 3.4vw, 40px)', lineHeight: 1, fontWeight: 300, letterSpacing: '-1px', fontVariantNumeric: 'tabular-nums' }}>{x.value}</span>
          <span style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3 }}>{x.label}</span>
          <span style={{ fontSize: 13, lineHeight: '18px', color: '#6B6259' }}>{x.sub}</span>
        </div>
      ))}
    </div>
  );
}

function TeamBars({ sv, staffName, staffRole }: { sv: Survey; staffName: (id: string) => string; staffRole: (id: string) => string }) {
  const t = useT();
  const s = useClub();
  if (!sv.questions.includes('team') || !sv.teamStaffIds.length) return null;
  const st = surveyStats(s, sv);
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <span style={labelStyle}>{t('mgmt.svTeamRatings')}</span>
      {st.team.map((r) => (
        <div key={r.staffId} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '12px 0', borderTop: '1px solid #F0EAE1' }}>
          <div style={{ flex: '1 1 160px', display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 16, lineHeight: '22px', fontWeight: 500 }}>{staffName(r.staffId)}</span>
            <span style={{ fontSize: 14, lineHeight: '20px', color: '#5E5852' }}>{staffRole(r.staffId)} · {r.n ? tn(t, 'mgmt.svRatings', r.n) : t('mgmt.svNoRatings')}</span>
          </div>
          <div style={{ flex: '0 1 140px', height: 8, borderRadius: 999, background: '#F0EAE1', overflow: 'hidden' }} role="img" aria-label={r.n ? `${r.avg.toFixed(1)} / 5` : '—'}>
            <div style={{ height: '100%', width: r.n ? `${Math.round((r.avg / 5) * 100)}%` : '0%', background: '#3D6B4F' }} />
          </div>
          <span style={{ fontSize: 16, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{r.n ? `${r.avg.toFixed(1)} / 5` : '—'}</span>
        </div>
      ))}
    </div>
  );
}

function Comments({ sv, max }: { sv: Survey; max?: number }) {
  const t = useT();
  const { fds } = useFmt();
  const s = useClub();
  const st = surveyStats(s, sv);
  const list = max ? st.comments.slice(0, max) : st.comments;
  const paged = usePaged(list, 5, sv.id);
  if (!list.length) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={labelStyle}>{t('mgmt.svComments')}</span>
      {paged.rows.map((c) => (
        <div key={c.id} style={{ padding: '10px 14px', borderRadius: 10, background: '#F5F5F3', display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ fontSize: 15, lineHeight: '22px', overflowWrap: 'anywhere' }}>“{c.comment}”</span>
          <span style={{ fontSize: 14, lineHeight: '20px', color: '#5E5852' }}>{s.familyContacts[c.familyId]?.name || c.familyId} · {fds(c.on)}</span>
        </div>
      ))}
      <Pager page={paged.page} pages={paged.pages} onPage={paged.setPage} label={t('mgmt.pgComments')} />
    </div>
  );
}

/** A survey in full: ratings, comments, and which families have answered (also for closed surveys). */
function SurveyDetail({ id, onClose, staffName, staffRole }: { id: string | null; onClose: () => void; staffName: (id: string) => string; staffRole: (id: string) => string }) {
  const t = useT();
  const { fdy } = useFmt();
  const s = useClub();
  const sv = id ? s.surveys[id] : undefined;
  const st = sv ? surveyStats(s, sv) : null;
  const answered = new Set(st?.responses.map((r) => r.familyId));
  const famPaged = usePaged(sv?.recipients ?? [], 8, id ?? '');
  return (
    <Dialog open={!!sv} onClose={onClose} eyebrow={sv ? t('mgmt.svDetailEyebrow', { date: fdy(sv.sentOn) }) : ''} title={sv?.title || ''} maxWidth={720}
      footer={<Button variant="secondary" onClick={onClose}>{t('common.close')}</Button>}>
      {sv && st ? (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <BadgePill kind={sv.status === 'live' ? 'pending' : 'paid'} label={sv.status === 'live' ? t('mgmt.svLive') : t('mgmt.svClosedBadge', { date: sv.closedOn ? fdy(sv.closedOn) : '' })} />
            <Pill icon="groups" fg="#24201C" bg="#E8E1D8" label={tn(t, 'mgmt.svRespOf', st.recipients, { n: st.answered, total: st.recipients })} />
          </div>
          <span style={{ fontSize: FONT_BODY, lineHeight: 1.4, color: '#5E5852' }}>{t('mgmt.svSentTo')}: {audienceText(t, sv, sv.recipients.length)}</span>
          <Tiles s={s} sv={sv} />
          <TeamBars sv={sv} staffName={staffName} staffRole={staffRole} />
          <CustomResults sv={sv} />
          <Comments sv={sv} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <SectionLabel>{t('mgmt.svFamilies')}</SectionLabel>
            {famPaged.rows.map((fid) => {
              const c = s.familyContacts[fid];
              const members = live(s.familyLinks).filter((l) => l.familyId === fid && l.primary && s.members[l.memberId]).map((l) => memberShort(s.members[l.memberId]));
              const r = st.responses.find((x) => x.familyId === fid);
              return (
                <div key={fid} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid #F0EAE1' }}>
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: 16, lineHeight: '22px', fontWeight: 500 }}>{c?.name || fid}</span>
                    <span style={{ fontSize: 14, lineHeight: '20px', color: '#5E5852' }}>{members.join(', ')}</span>
                  </div>
                  {answered.has(fid) ? <BadgePill kind="paid" label={r && r.overall > 0 ? `${t('mgmt.svAnswered')} · ${r.overall}/5` : t('mgmt.svAnswered')} /> : <BadgePill kind="pending" label={t('mgmt.svWaiting')} />}
                </div>
              );
            })}
            <Pager page={famPaged.page} pages={famPaged.pages} onPage={famPaged.setPage} label={t('mgmt.pgFamilies')} />
          </div>
        </>
      ) : null}
    </Dialog>
  );
}

type TFn = ReturnType<typeof useT>;
/** "All families with the app · 6 families", "Families of 2 members · 3 families", "3 people chosen · 3 families". */
function audienceText(t: TFn, sv: Pick<Survey, 'audience'>, n: number) {
  const a = sv.audience ?? { mode: 'all' as const };
  const fam = tn(t, 'mgmt.svFamiliesN', n);
  if (a.mode === 'all') return `${t('mgmt.svAudSum_all')} · ${fam}`;
  if (a.mode === 'members') return `${t('mgmt.svAudSum_members', { members: tn(t, 'mgmt.svMembersN', a.memberIds?.length ?? 0) })} · ${fam}`;
  return `${t('mgmt.svAudSum_contacts', { people: tn(t, 'mgmt.svPeopleN', a.contactIds?.length ?? 0) })} · ${fam}`;
}

const MODES: SurveyAudience['mode'][] = ['all', 'members', 'contacts'];
interface PickItem { id: string; title: string; sub: string }

/** Who gets the survey: every family with the app, the families of chosen members, or chosen contacts (searchable). The count is shown before sending. */
function AudiencePicker({ value, onChange, count }: { value: AudDraft; onChange: (a: AudDraft) => void; count: number }) {
  const t = useT();
  const s = useClub();
  const { today } = useNow();
  const [q, setQ] = useState('');
  const mode = value.mode;
  const members = useMemo(() => surveyMembers(s, today), [s, today]);
  const families = useMemo(() => appFamilies(s, today), [s, today]);
  const memberItems: PickItem[] = useMemo(() => members.map((m) => ({
    id: m.id, title: memberName(m),
    sub: t('mgmt.svMemberFamily', { names: families.filter((c) => linksOfFamily(s, c.id).some((l) => l.memberId === m.id && l.appAccess)).map((c) => c.firstName).join(', ') }),
  })), [members, families, s, t]);
  const contactItems: PickItem[] = useMemo(() => families.map((c) => ({
    id: c.id, title: c.name,
    sub: linksOfFamily(s, c.id).filter((l) => l.appAccess && s.members[l.memberId] && !s.members[l.memberId].deletedAt).map((l) => memberShort(s.members[l.memberId])).join(', '),
  })), [families, s]);
  const items = mode === 'members' ? memberItems : contactItems;
  const needle = q.trim().toLowerCase();
  const shown = needle ? items.filter((x) => `${x.title} ${x.sub}`.toLowerCase().includes(needle)) : items;
  const picked = mode === 'members' ? value.memberIds : value.contactIds;
  const setPicked = (ids: string[]) => onChange(mode === 'members' ? { ...value, memberIds: ids } : { ...value, contactIds: ids });
  const toggle = (id: string) => setPicked(picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id]);
  const setMode = (m: SurveyAudience['mode']) => { setQ(''); onChange({ ...value, mode: m }); };
  const allShown = shown.length > 0 && shown.every((x) => picked.includes(x.id));
  const paged = usePaged(shown, 5, `${mode}:${q}`);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-testid="survey-audience">
      <span style={{ fontSize: 16, lineHeight: '22px', fontWeight: 500 }}>{t('mgmt.svAudience')}</span>
      <div style={chipRow} role="radiogroup" aria-label={t('mgmt.svAudience')}>
        {MODES.map((m) => (
          <Chip key={m} selected={mode === m} onClick={() => setMode(m)} style={wrapChip}>{t('mgmt.svAud_' + m)}</Chip>
        ))}
      </div>
      <span style={{ fontSize: 14, lineHeight: '20px', color: '#5E5852' }}>{t('mgmt.svAudHint_' + mode)}</span>
      {mode !== 'all' ? (
        <>
          <TextField label={t(mode === 'members' ? 'mgmt.svSearchMembers' : 'mgmt.svSearchContacts')} value={q} onChange={setQ} type="search" inputMode="search" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span data-testid="survey-picked" style={{ fontSize: FONT_BODY, lineHeight: 1.4, fontWeight: 500, flex: '1 1 140px' }}>{tn(t, mode === 'members' ? 'mgmt.svPickedMembers' : 'mgmt.svPickedContacts', picked.length)}</span>
            {shown.length ? <Button size={44} variant="secondary" disabled={allShown} onClick={() => setPicked([...new Set([...picked, ...shown.map((x) => x.id)])])}>{t('mgmt.svSelectResults')}</Button> : null}
            {picked.length ? <Button size={44} variant="ghost" onClick={() => setPicked([])}>{t('mgmt.svClearPicked')}</Button> : null}
          </div>
          <div style={{ border: '1px solid #EFE7DC', borderRadius: 12, overflow: 'hidden', background: '#FFFFFF' }}>
            {shown.length ? paged.rows.map((x, i) => (
              <PickRow key={x.id} item={x} checked={picked.includes(x.id)} first={i === 0} onToggle={() => toggle(x.id)} />
            )) : <div style={{ padding: '14px 16px', fontSize: 16, lineHeight: 1.4, color: '#5E5852' }}>{t('mgmt.svNoMatch')}</div>}
          </div>
          <Pager page={paged.page} pages={paged.pages} onPage={paged.setPage} label={t('mgmt.pgPick')} />
        </>
      ) : null}
      <span data-testid="survey-count" style={{ fontSize: 16, lineHeight: '22px', fontWeight: 600 }}>{tn(t, 'mgmt.svGoesTo', count)}</span>
    </div>
  );
}
function PickRow({ item, checked, first, onToggle }: { item: PickItem; checked: boolean; first: boolean; onToggle: () => void }) {
  return (
    <button type="button" role="checkbox" aria-checked={checked} data-pick={item.id} onClick={onToggle} className="h-row"
      style={{ width: '100%', minHeight: 56, display: 'flex', alignItems: 'center', gap: 12, padding: '8px 14px', border: 'none', borderTop: first ? 'none' : '1px solid #F0EAE1', background: checked ? '#FBF8F4' : '#FFFFFF', textAlign: 'left', cursor: 'pointer', color: '#24201C', fontFamily: 'Inter' }}>
      <Icon name={checked ? 'check_box' : 'check_box_outline_blank'} size={24} color={checked ? '#75624B' : '#5E5852'} fill={checked ? 1 : 0} />
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.4, overflowWrap: 'anywhere' }}>{item.title}</span>
        {item.sub ? <span style={{ fontSize: FONT_BODY, lineHeight: '20px', color: '#5E5852', overflowWrap: 'anywhere' }}>{item.sub}</span> : null}
      </span>
    </button>
  );
}

// ---------- questions of your own ----------
const KIND_ICON: Record<SurveyQuestionKind, string> = { rating: 'star', yesno: 'thumbs_up_down', choice: 'radio_button_checked', text: 'notes' };
/** Ids for questions that have not been saved yet; the server gives them their real ones (q1, q2, …) when the draft is saved. */
let tmpSeq = 0;
const tmpId = () => `new${++tmpSeq}`;

/** The draft's own questions: added, edited, moved up and down, and removed here; they are saved with the draft. */
function CustomQuestions({ list, onChange }: { list: SurveyCustomQuestion[]; onChange: (l: SurveyCustomQuestion[]) => void }) {
  const t = useT();
  const [dlg, setDlg] = useState<{ q: SurveyCustomQuestion | null } | null>(null);
  const full = list.length >= SURVEY_LIMITS.custom;
  const move = (i: number, by: -1 | 1) => {
    const next = [...list];
    [next[i], next[i + by]] = [next[i + by], next[i]];
    onChange(next);
  };
  const save = (q: Omit<SurveyCustomQuestion, 'id'>) => {
    const was = dlg?.q;
    onChange(was ? list.map((x) => (x.id === was.id ? { ...q, id: was.id } : x)) : [...list, { ...q, id: tmpId() }]);
    setDlg(null);
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-testid="survey-custom">
      <span style={{ fontSize: 16, lineHeight: '22px', fontWeight: 500 }}>{t('mgmt.svCustom')}</span>
      {list.length ? null : <span style={{ fontSize: 14, lineHeight: '20px', color: '#5E5852' }}>{t('mgmt.svCustomNone')}</span>}
      {list.map((q, i) => (
        <div key={q.id} data-custom-q={q.id} style={{ border: '1px solid #EFE7DC', borderRadius: 12, padding: 12, display: 'flex', alignItems: 'flex-start', gap: 12, background: '#FFFFFF' }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '2px 8px', flexWrap: 'wrap', fontSize: FONT_SMALL, lineHeight: '20px', color: '#5E5852' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><IconBox name={KIND_ICON[q.kind]} size={18} />{t('mgmt.svQKind_' + q.kind)}</span>
              <span style={{ height: 22, padding: '0 8px', borderRadius: 8, display: 'inline-flex', alignItems: 'center', fontWeight: 600, background: q.required ? '#F9E3DB' : '#F3EEE8', color: q.required ? '#9A3D24' : '#5E5852' }}>{q.required ? t('mgmt.svQReqTag') : t('mgmt.svQOptTag')}</span>
            </span>
            <span style={{ fontSize: 16, lineHeight: '22px', fontWeight: 500, overflowWrap: 'anywhere' }}>{q.text}</span>
            {q.kind === 'choice' ? <span style={{ fontSize: FONT_BODY, lineHeight: '20px', color: '#5E5852', overflowWrap: 'anywhere' }}>{(q.options ?? []).join(' · ')}</span> : null}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 44px)', gap: 8, flex: 'none' }}>
            {i > 0 ? <IconButton icon="arrow_upward" label={`${t('mgmt.svQUp')}: ${q.text}`} onClick={() => move(i, -1)} /> : <span aria-hidden="true" />}
            {i < list.length - 1 ? <IconButton icon="arrow_downward" label={`${t('mgmt.svQDown')}: ${q.text}`} onClick={() => move(i, 1)} /> : <span aria-hidden="true" />}
            <IconButton icon="edit" label={`${t('mgmt.svQEdit')}: ${q.text}`} onClick={() => setDlg({ q })} />
            <IconButton icon="delete" label={`${t('mgmt.svQRemove')}: ${q.text}`} onClick={() => onChange(list.filter((x) => x.id !== q.id))} />
          </div>
        </div>
      ))}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Button size={44} variant="secondary" icon="add" disabled={full} onClick={() => setDlg({ q: null })}>{t('mgmt.svAddQ')}</Button>
        {full ? <span style={{ fontSize: 14, lineHeight: '20px', color: '#5E5852' }}>{t('mgmt.svQLimit', { n: SURVEY_LIMITS.custom })}</span> : null}
      </div>
      {dlg ? <QuestionDialog key={dlg.q?.id ?? 'new'} initial={dlg.q} onSave={save} onClose={() => setDlg(null)} /> : null}
    </div>
  );
}

/** One question: the text, what kind of answer, the options of a choice, and whether families must answer. Mistakes show when Save is tapped. */
function QuestionDialog({ initial, onSave, onClose }: { initial: SurveyCustomQuestion | null; onSave: (q: Omit<SurveyCustomQuestion, 'id'>) => void; onClose: () => void }) {
  const t = useT();
  const [kind, setKind] = useState<SurveyQuestionKind>(initial?.kind ?? 'rating');
  const [text, setText] = useState(initial?.text ?? '');
  const [opts, setOpts] = useState((initial?.options ?? []).join('\n'));
  const [required, setRequired] = useState(initial?.required ?? false);
  const [tried, setTried] = useState(false);
  const options = parseOptions(opts);
  const problem = questionProblem({ kind, text, options: kind === 'choice' ? options : undefined });
  const save = () => {
    if (problem) { setTried(true); return; }
    onSave({ kind, text: text.trim(), ...(kind === 'choice' ? { options } : {}), required });
  };
  const kinds = SURVEY_KINDS.map((k) => ({ value: k, label: t('mgmt.svQKind_' + k), hint: t('mgmt.svQKindHint_' + k) }));
  const optErr = tried && (problem === 'options' || problem === 'optionLong') ? (problem === 'optionLong' ? t('mgmt.err.qOptionLong', { n: SURVEY_LIMITS.option }) : t('mgmt.err.qOptions')) : false;
  return (
    <Dialog open onClose={onClose} title={initial ? t('mgmt.svEditQ') : t('mgmt.svNewQ')} maxWidth={560}
      footer={<><Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button><Button onClick={save}>{initial ? t('mgmt.svQSave') : t('mgmt.svQAdd')}</Button></>}>
      <TextField label={t('mgmt.svQText')} value={text} onChange={setText} multiline rows={3} maxLength={SURVEY_LIMITS.text} placeholder={t('mgmt.svQTextPh')} error={tried && problem === 'text' ? t('mgmt.err.qText', { n: SURVEY_LIMITS.text }) : false} />
      <Select label={t('mgmt.svQKind')} value={kind} onChange={setKind} options={kinds} searchable={false} />
      {kind === 'choice' ? (
        <TextField label={t('mgmt.svQOptions')} value={opts} onChange={setOpts} multiline rows={4} placeholder={t('mgmt.svQOptionsPh')} error={optErr}
          hint={`${tn(t, 'mgmt.svQOptionsN', options.length)} · ${t('mgmt.svQOptionsHint')}`} />
      ) : null}
      <Toggle on={required} onClick={() => setRequired(!required)} label={t('mgmt.svQRequired')} />
    </Dialog>
  );
}

/** What families answered to each question of your own: average stars, yes and no, options with bars, and the written answers (paged). */
function CustomResults({ sv }: { sv: Survey }) {
  const t = useT();
  const s = useClub();
  const st = surveyStats(s, sv);
  if (!st.custom.length) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} data-testid="survey-results">
      <span style={labelStyle}>{t('mgmt.svCustomResults')}</span>
      {st.custom.map((r) => <ResultBlock key={`${sv.id}:${r.q.id}`} r={r} />)}
    </div>
  );
}
function ResultBlock({ r }: { r: CustomResult }) {
  const t = useT();
  const q = r.q;
  return (
    <div data-result={q.id} style={{ padding: '14px 16px', borderRadius: 12, background: '#F5F5F3', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 16, lineHeight: '22px', fontWeight: 500, overflowWrap: 'anywhere' }}>{q.text}</span>
        <span style={{ fontSize: 14, lineHeight: '20px', color: '#5E5852' }}>{t('mgmt.svQKind_' + q.kind)} · {tn(t, 'mgmt.svAnswers', r.n)}{q.required ? ` · ${t('mgmt.svQReqTag')}` : ''}</span>
      </div>
      {r.n === 0 ? <span style={{ fontSize: 16, lineHeight: '22px', color: '#5E5852' }}>{t('mgmt.svResNone')}</span> : null}
      {r.n > 0 && q.kind === 'rating' ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Icon name="star" size={24} fill={1} color="#75624B" />
          <span style={{ fontSize: 24, lineHeight: '30px', fontWeight: 300, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{r.avg.toFixed(1)} / 5</span>
          <Bar grow pct={Math.round((r.avg / 5) * 100)} label={`${r.avg.toFixed(1)} / 5`} />
        </div>
      ) : null}
      {r.n > 0 && q.kind === 'yesno' ? (
        <>
          <CountRow label={t('common.yes')} n={r.yes} total={r.n} />
          <CountRow label={t('common.no')} n={r.no} total={r.n} />
        </>
      ) : null}
      {r.n > 0 && q.kind === 'choice' ? r.counts.map((c) => <CountRow key={c.option} label={c.option} n={c.n} total={r.n} />) : null}
      {r.n > 0 && q.kind === 'text' ? <TextAnswers r={r} /> : null}
    </div>
  );
}
/** A share bar. `grow` lets it fill the rest of a row; otherwise it is the full width of its column. */
function Bar({ pct, label, grow }: { pct: number; label: string; grow?: boolean }) {
  return (
    <div style={{ flex: grow ? 1 : 'none', width: grow ? undefined : '100%', minWidth: 60, height: 8, borderRadius: 999, background: '#E3DCD3', overflow: 'hidden' }} role="img" aria-label={label}>
      <div style={{ height: '100%', width: `${pct}%`, background: '#3D6B4F' }} />
    </div>
  );
}
/** An option with how many picked it, and a bar for its share of the answers. */
function CountRow({ label, n, total }: { label: string; n: number; total: number }) {
  const pct = total ? Math.round((n / total) * 100) : 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
        <span style={{ fontSize: 16, lineHeight: '22px', overflowWrap: 'anywhere' }}>{label}</span>
        <span style={{ fontSize: 16, lineHeight: '22px', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{n} · {pct}%</span>
      </div>
      <Bar pct={pct} label={`${label}: ${n}`} />
    </div>
  );
}
function TextAnswers({ r }: { r: CustomResult }) {
  const t = useT();
  const { fds } = useFmt();
  const s = useClub();
  const paged = usePaged(r.texts, 5, r.q.id);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {paged.rows.map((a) => (
        <div key={a.id} style={{ padding: '10px 12px', borderRadius: 10, background: '#FFFFFF', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 16, lineHeight: '24px', overflowWrap: 'anywhere' }}>“{a.text}”</span>
          <span style={{ fontSize: 14, lineHeight: '20px', color: '#5E5852' }}>{s.familyContacts[a.familyId]?.name || a.familyId} · {fds(a.on)}</span>
        </div>
      ))}
      <Pager page={paged.page} pages={paged.pages} onPage={paged.setPage} label={t('mgmt.pgTextAnswers')} />
    </div>
  );
}
