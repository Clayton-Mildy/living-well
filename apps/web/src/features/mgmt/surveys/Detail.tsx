// One survey in full: Summary (the numbers, team ratings, answers to its own questions, comments), Responses (who answered, with their stars,
// comment and answers) and History (what was done to the survey, and by whom). A pushed screen on phones, a dialog on wider screens.
import { useState, type ReactNode } from 'react';
import { actorName, customOf, live, memberShort, staffCall, surveyKind, surveyHistory, surveyStats, responseRows, responseWho, type Survey, type SurveyCustomQuestion, type SurveyResponse } from '@cp/shared';
import { Button, Dialog, Group, Icon, PhoneScreen, Pager, usePaged } from '../../../components/ui';
import { useDevice } from '../../../hooks/useDevice';
import { useT, useFmt } from '../../../lib/i18n';
import { useAct } from '../../../lib/act';
import { useClub } from '../../../store/replica';
import { BadgePill, IconBox, Pill, PillBtn, SegTabs, labelStyle, tn } from '../common';
import { audienceText } from './Fields';
import { Comments, CustomResults, TeamBars, Tiles } from './Results';

export type DetailTab = 'summary' | 'responses' | 'history';
const TABS: DetailTab[] = ['summary', 'responses', 'history'];
const LOG_ICON: Record<NonNullable<Survey['log']>[number]['what'], string> = { created: 'edit_note', edited: 'edit', sent: 'send', closed: 'lock_clock', reopened: 'lock_open' };

export function SurveyDetail({ id, initialTab = 'summary', onClose }: { id: string; initialTab?: DetailTab; onClose: () => void }) {
  const t = useT();
  const { isPhone } = useDevice();
  const { fdy } = useFmt();
  const s = useClub();
  const act = useAct();
  const [tab, setTab] = useState<DetailTab>(initialTab);
  const sv = s.surveys[id];
  if (!sv || sv.deletedAt) return null;
  const st = surveyStats(s, sv);
  const venue = surveyKind(sv) === 'venue';
  const staffName = (sid: string) => staffCall(s.staff[sid]) || sid;
  const staffRole = (sid: string) => (s.staff[sid] ? t('roles.' + s.staff[sid].role) : '');
  const hasTeam = !venue && sv.questions.includes('team');

  const pills = (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <Pill icon={venue ? 'storefront' : 'groups'} fg="#24201C" bg="#E8E1D8" label={t('mgmt.svKind_' + surveyKind(sv))} />
      <BadgePill kind={sv.status === 'live' ? 'pending' : 'paid'} label={sv.status === 'live' ? t('mgmt.svLive') : t('mgmt.svClosedBadge', { date: sv.closedOn ? fdy(sv.closedOn) : '' })} />
      <Pill icon="how_to_reg" fg="#24201C" bg="#E8E1D8" label={t('mgmt.svAnsweredOf', { n: st.answered, total: st.recipients })} />
    </div>
  );
  const meta = (
    <span style={{ fontSize: 14, lineHeight: 1.4, color: '#5E5852' }}>
      {venue ? `${t('mgmt.svSentOn', { date: fdy(sv.sentOn) })} · ${tn(t, 'mgmt.svLinksSent', st.recipients)}` : `${t('mgmt.svSentOn', { date: fdy(sv.sentOn) })} · ${audienceText(t, sv, sv.recipients.length)}`}
    </span>
  );
  const saveAsTemplate = () => act('surveyTemplate.save', {
    title: sv.title, kind: surveyKind(sv), questions: sv.questions, custom: customOf(sv).map((c) => ({ id: c.id, kind: c.kind, text: c.text, ...(c.options ? { options: c.options } : {}), required: c.required })),
    teamStaffIds: hasTeam ? sv.teamStaffIds : [],
  }, { ok: t('mgmt.svTplSaved') });
  const actions: { key: string; icon: string; label: string; run: () => void; show: boolean }[] = [
    { key: 'close', icon: 'lock_clock', label: t('mgmt.svClose'), show: sv.status === 'live', run: () => { void act('survey.close', { surveyId: sv.id }, { ok: t('mgmt.svClosed', { title: sv.title }) }); } },
    { key: 'reopen', icon: 'lock_open', label: t('mgmt.svReopen'), show: sv.status === 'closed', run: () => { void act('survey.reopen', { surveyId: sv.id }, { ok: t('mgmt.svReopened', { title: sv.title }) }); } },
    { key: 'tpl', icon: 'bookmark_add', label: t('mgmt.svTplSaveAs'), show: sv.status !== 'draft', run: () => { void saveAsTemplate(); } },
  ];
  const buttons = (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {actions.filter((a) => a.show).map((a) => (isPhone
        ? <PillBtn key={a.key} icon={a.icon} onClick={a.run}>{a.label}</PillBtn>
        : <Button key={a.key} size={44} variant="secondary" icon={a.icon} onClick={a.run}>{a.label}</Button>))}
    </div>
  );
  const tabs = <SegTabs items={TABS.map((k) => ({ value: k, label: t('mgmt.svDet_' + k) }))} value={tab} onChange={setTab} label={sv.title} />;
  const phone = isPhone;
  const content = tab === 'summary' ? (
    <>
      {phone ? <Group gap={10}><Tiles s={s} sv={sv} compact /></Group> : <Tiles s={s} sv={sv} />}
      <TeamBars sv={sv} staffName={staffName} staffRole={staffRole} native={phone} />
      <CustomResults sv={sv} native={phone} />
      <Comments sv={sv} native={phone} />
    </>
  ) : tab === 'responses' ? <Responses sv={sv} /> : <History sv={sv} />;

  if (phone) {
    return (
      <PhoneScreen open onClose={onClose} label={sv.title} back={t('nav.surveys')}>
        <Group title={t('mgmt.svSentOn', { date: fdy(sv.sentOn) })} gap={10}>
          <span style={{ fontSize: 22, lineHeight: '30px', letterSpacing: '-0.3px', color: '#2B231C', overflowWrap: 'anywhere' }}>{sv.title}</span>
          {pills}
          {meta}
          {buttons}
        </Group>
        {tabs}
        {content}
      </PhoneScreen>
    );
  }
  return (
    <Dialog open onClose={onClose} eyebrow={t('mgmt.svDetailEyebrow', { date: fdy(sv.sentOn) })} title={sv.title} maxWidth={760} footer={<Button variant="secondary" onClick={onClose}>{t('common.close')}</Button>}>
      {pills}
      {meta}
      {buttons}
      {tabs}
      {content}
    </Dialog>
  );
}

// ---------- responses ----------
/** "4/5", "Yes", "Saturday", or the written answer. */
function answerText(t: ReturnType<typeof useT>, q: SurveyCustomQuestion, v: unknown): string {
  if (q.kind === 'rating') return `${v}/5`;
  if (q.kind === 'yesno') return v === true ? t('common.yes') : t('common.no');
  return String(v);
}

function Responses({ sv }: { sv: Survey }) {
  const t = useT();
  const { isPhone } = useDevice();
  const s = useClub();
  const venue = surveyKind(sv) === 'venue';
  const rows = responseRows(s, sv);
  const paged = usePaged(rows, 6, sv.id);
  const answered = new Set(rows.map((r) => r.familyId));
  const waiting = venue ? [] : sv.recipients.filter((fid) => !answered.has(fid));
  const wPaged = usePaged(waiting, 8, `${sv.id}:w`);
  const frame = (title: string, children: ReactNode) => (isPhone
    ? <Group title={title} pad="0 16px" gap={0}><div style={{ marginTop: -1 }}>{children}</div></Group>
    : <div style={{ display: 'flex', flexDirection: 'column' }}><span style={labelStyle}>{title}</span>{children}</div>);
  return (
    <>
      {frame(t('mgmt.svDet_responses'), rows.length ? (
        <>
          {paged.rows.map((r) => <ResponseRow key={r.id} sv={sv} r={r} />)}
          <Pager page={paged.page} pages={paged.pages} onPage={paged.setPage} label={t('mgmt.pgFamilies')} />
        </>
      ) : <div style={{ padding: '14px 0 16px', borderTop: '1px solid #F0EAE1', fontSize: 15, color: '#6B6259' }}>{t('mgmt.svResNone')}</div>)}
      {waiting.length ? frame(tn(t, 'mgmt.svWaitingFor', waiting.length), (
        <>
          {wPaged.rows.map((fid) => {
            const members = live(s.familyLinks).filter((l) => l.familyId === fid && l.primary && s.members[l.memberId]).map((l) => memberShort(s.members[l.memberId]));
            return (
              <div key={fid} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: '1px solid #F0EAE1' }}>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 16, lineHeight: '22px', fontWeight: 500 }}>{s.familyContacts[fid]?.name || fid}</span>
                  {members.length ? <span style={{ fontSize: 14, lineHeight: '20px', color: '#5E5852' }}>{members.join(', ')}</span> : null}
                </div>
                <BadgePill kind="pending" label={t('mgmt.svWaiting')} />
              </div>
            );
          })}
          <Pager page={wPaged.page} pages={wPaged.pages} onPage={wPaged.setPage} label={t('mgmt.pgFamilies')} />
        </>
      )) : null}
    </>
  );
}

function ResponseRow({ sv, r }: { sv: Survey; r: SurveyResponse }) {
  const t = useT();
  const { fds } = useFmt();
  const s = useClub();
  const venue = surveyKind(sv) === 'venue';
  const b = r.venueBookingId ? s.venueBookings[r.venueBookingId] : undefined;
  const members = venue ? [] : live(s.familyLinks).filter((l) => l.familyId === r.familyId && l.primary && s.members[l.memberId]).map((l) => memberShort(s.members[l.memberId]));
  const sub = [venue ? b?.org : members.join(', '), fds(r.on)].filter(Boolean).join(' · ');
  const own = customOf(sv).filter((q) => r.answers && r.answers[q.id] !== undefined);
  return (
    <div data-response={r.id} style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '12px 0', borderTop: '1px solid #F0EAE1' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <span style={{ flex: 1, minWidth: 0, fontSize: 16, lineHeight: '22px', fontWeight: 500, overflowWrap: 'anywhere' }}>{responseWho(s, r)}</span>
        {r.overall > 0 ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 15, fontWeight: 500, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}><Icon name="star" size={17} fill={1} color="#75624B" />{r.overall}/5</span> : null}
      </div>
      <span style={{ fontSize: 14, lineHeight: '20px', color: '#5E5852', overflowWrap: 'anywhere' }}>{sub}</span>
      {r.comment.trim() ? <span style={{ fontSize: 15, lineHeight: '22px', overflowWrap: 'anywhere' }}>“{r.comment}”</span> : null}
      {own.map((q) => (
        <span key={q.id} style={{ fontSize: 14, lineHeight: '20px', color: '#24201C', overflowWrap: 'anywhere' }}>
          <span style={{ color: '#5E5852' }}>{q.text}</span> · {answerText(t, q, r.answers![q.id])}
        </span>
      ))}
    </div>
  );
}

// ---------- history ----------
function History({ sv }: { sv: Survey }) {
  const t = useT();
  const { isPhone } = useDevice();
  const { fds } = useFmt();
  const s = useClub();
  const entries = [...surveyHistory(sv)].reverse(); // newest first
  const paged = usePaged(entries, 8, sv.id);
  const who = (a: string) => (a === 'system' ? t('mgmt.whoSystem') : a === 'doorCamera' ? t('mgmt.whoDoor') : actorName(s, a));
  const text = (e: (typeof entries)[number]) => {
    if (e.what === 'created') return e.note ? t('mgmt.svLog_createdFrom', { who: who(e.by), tpl: e.note }) : t('mgmt.svLog_created', { who: who(e.by) });
    if (e.what === 'sent') return surveyKind(sv) === 'venue' || e.note === undefined ? t('mgmt.svLog_sentV', { who: who(e.by) }) : tn(t, 'mgmt.svLog_sent', Number(e.note), { who: who(e.by) });
    if (e.what === 'closed') return e.note === 'replaced' ? t('mgmt.svLog_closedReplaced') : t('mgmt.svLog_closed', { who: who(e.by) });
    return t('mgmt.svLog_' + e.what, { who: who(e.by) });
  };
  const list = (
    <>
      {paged.rows.map((e, i) => (
        <div key={`${e.at}${e.what}${i}`} data-log={e.what} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: '1px solid #F0EAE1' }}>
          <span aria-hidden="true" style={{ width: 32, height: 32, borderRadius: 999, background: '#F3EEE8', color: '#75624B', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><IconBox name={LOG_ICON[e.what]} size={18} /></span>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 15, lineHeight: '21px', overflowWrap: 'anywhere' }}>{text(e)}</span>
            <span style={{ fontSize: 13, lineHeight: '18px', color: '#6B6259' }}>{fds(e.at.slice(0, 10))} · {e.at.slice(11, 16)}</span>
          </div>
        </div>
      ))}
      <Pager page={paged.page} pages={paged.pages} onPage={paged.setPage} label={t('mgmt.svDet_history')} />
    </>
  );
  return isPhone
    ? <Group title={t('mgmt.svDet_history')} pad="0 16px" gap={0}><div style={{ marginTop: -1 }}>{list}</div></Group>
    : <div style={{ display: 'flex', flexDirection: 'column' }}><span style={labelStyle}>{t('mgmt.svDet_history')}</span>{list}</div>;
}
