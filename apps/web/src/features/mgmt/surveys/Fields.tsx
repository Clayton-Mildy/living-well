// The pieces of the survey editor that are not the form itself: who gets it (audience), the survey's own questions and the dialog for one of them.
import { useMemo, useState } from 'react';
import { SURVEY_KINDS, SURVEY_LIMITS, linksOfFamily, memberName, memberShort, parseOptions, questionProblem, type Survey, type SurveyCustomQuestion, type SurveyQuestionKind } from '@cp/shared';
import { appFamilies, surveyMembers, type SurveyAudience } from '@cp/shared/rules/mgmt';
import { Button, Chip, Dialog, Icon, IconButton, Select, TextField, Toggle, usePaged, Pager, FONT_BODY, FONT_SMALL } from '../../../components/ui';
import { useDevice } from '../../../hooks/useDevice';
import { useT } from '../../../lib/i18n';
import { useNow } from '../../../lib/clock';
import { useClub } from '../../../store/replica';
import { IconBox, SearchBar, chipRow, tn, wrapChip } from '../common';

/** Who the survey goes to as picked on screen: all three lists are kept so switching the choice does not lose what was picked. */
export interface AudDraft { mode: SurveyAudience['mode']; memberIds: string[]; contactIds: string[] }
export const audPayload = (a: AudDraft): SurveyAudience => (a.mode === 'members' ? { mode: 'members', memberIds: a.memberIds } : a.mode === 'contacts' ? { mode: 'contacts', contactIds: a.contactIds } : { mode: 'all' });
export const audDraft = (a: Survey['audience']): AudDraft => ({ mode: a?.mode ?? 'all', memberIds: a?.memberIds ?? [], contactIds: a?.contactIds ?? [] });

type TFn = ReturnType<typeof useT>;
/** "All families with the app · 6 families", "Families of 2 members · 3 families", "3 people chosen · 3 families". */
export function audienceText(t: TFn, sv: Pick<Survey, 'audience'>, n: number) {
  const a = sv.audience ?? { mode: 'all' as const };
  const fam = tn(t, 'mgmt.svFamiliesN', n);
  if (a.mode === 'all') return `${t('mgmt.svAudSum_all')} · ${fam}`;
  if (a.mode === 'members') return `${t('mgmt.svAudSum_members', { members: tn(t, 'mgmt.svMembersN', a.memberIds?.length ?? 0) })} · ${fam}`;
  return `${t('mgmt.svAudSum_contacts', { people: tn(t, 'mgmt.svPeopleN', a.contactIds?.length ?? 0) })} · ${fam}`;
}

const MODES: SurveyAudience['mode'][] = ['all', 'members', 'contacts'];
interface PickItem { id: string; title: string; sub: string }

/** Who gets the survey: every family with the app, the families of chosen members, or chosen contacts (searchable). The count is shown before sending. */
export function AudiencePicker({ value, onChange, count }: { value: AudDraft; onChange: (a: AudDraft) => void; count: number }) {
  const t = useT();
  const { isPhone } = useDevice();
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
          {isPhone
            ? <SearchBar value={q} onChange={setQ} label={t(mode === 'members' ? 'mgmt.svSearchMembers' : 'mgmt.svSearchContacts')} placeholder={t('common.search')} />
            : <TextField label={t(mode === 'members' ? 'mgmt.svSearchMembers' : 'mgmt.svSearchContacts')} value={q} onChange={setQ} type="search" inputMode="search" />}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span data-testid="survey-picked" style={{ fontSize: FONT_BODY, lineHeight: 1.4, fontWeight: 500, flex: '1 1 140px' }}>{tn(t, mode === 'members' ? 'mgmt.svPickedMembers' : 'mgmt.svPickedContacts', picked.length)}</span>
            {shown.length ? <Button size={44} variant="secondary" disabled={allShown} onClick={() => setPicked([...new Set([...picked, ...shown.map((x) => x.id)])])}>{t('mgmt.svSelectResults')}</Button> : null}
            {picked.length ? <Button size={44} variant="ghost" onClick={() => setPicked([])}>{t('mgmt.svClearPicked')}</Button> : null}
          </div>
          <div style={isPhone ? { borderRadius: 12, overflow: 'hidden', background: '#F5F5F3' } : { border: '1px solid #EFE7DC', borderRadius: 12, overflow: 'hidden', background: '#FFFFFF' }}>
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
  const { isPhone } = useDevice();
  // round 6, phone: the list sits as a tinted cell inside the white group, so its rows are transparent with a hairline
  return (
    <button type="button" role="checkbox" aria-checked={checked} data-pick={item.id} onClick={onToggle} className="h-row"
      style={{ width: '100%', minHeight: 56, display: 'flex', alignItems: 'center', gap: 12, padding: '8px 14px', border: 'none', borderTop: first ? 'none' : isPhone ? '1px solid #E6E1DA' : '1px solid #F0EAE1', background: isPhone ? (checked ? '#EDE8E1' : 'transparent') : checked ? '#FBF8F4' : '#FFFFFF', textAlign: 'left', cursor: 'pointer', color: '#24201C', fontFamily: 'Inter' }}>
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
export function CustomQuestions({ list, onChange }: { list: SurveyCustomQuestion[]; onChange: (l: SurveyCustomQuestion[]) => void }) {
  const t = useT();
  const { isPhone } = useDevice();
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
        <div key={q.id} data-custom-q={q.id} style={isPhone ? { borderRadius: 12, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6, background: '#F5F5F3' } : { border: '1px solid #EFE7DC', borderRadius: 12, padding: 12, display: 'flex', alignItems: 'flex-start', gap: 12, background: '#FFFFFF' }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '2px 8px', flexWrap: 'wrap', fontSize: FONT_SMALL, lineHeight: '20px', color: '#5E5852' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><IconBox name={KIND_ICON[q.kind]} size={18} />{t('mgmt.svQKind_' + q.kind)}</span>
              <span style={{ height: 22, padding: '0 8px', borderRadius: 8, display: 'inline-flex', alignItems: 'center', fontWeight: 600, background: q.required ? '#F9E3DB' : '#F3EEE8', color: q.required ? '#9A3D24' : '#5E5852' }}>{q.required ? t('mgmt.svQReqTag') : t('mgmt.svQOptTag')}</span>
            </span>
            <span style={{ fontSize: 16, lineHeight: '22px', fontWeight: 500, overflowWrap: 'anywhere' }}>{q.text}</span>
            {q.kind === 'choice' ? <span style={{ fontSize: FONT_BODY, lineHeight: '20px', color: '#5E5852', overflowWrap: 'anywhere' }}>{(q.options ?? []).join(' · ')}</span> : null}
          </div>
          {isPhone ? (
            // round 6, phone: the four icon actions sit in one quiet row under the question
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 2, margin: '0 -6px -4px' }}>
              {i > 0 ? <IconButton icon="arrow_upward" bordered={false} label={`${t('mgmt.svQUp')}: ${q.text}`} onClick={() => move(i, -1)} /> : null}
              {i < list.length - 1 ? <IconButton icon="arrow_downward" bordered={false} label={`${t('mgmt.svQDown')}: ${q.text}`} onClick={() => move(i, 1)} /> : null}
              <IconButton icon="edit" bordered={false} label={`${t('mgmt.svQEdit')}: ${q.text}`} onClick={() => setDlg({ q })} />
              <IconButton icon="delete" bordered={false} label={`${t('mgmt.svQRemove')}: ${q.text}`} onClick={() => onChange(list.filter((x) => x.id !== q.id))} />
            </div>
          ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 44px)', gap: 8, flex: 'none' }}>
            {i > 0 ? <IconButton icon="arrow_upward" label={`${t('mgmt.svQUp')}: ${q.text}`} onClick={() => move(i, -1)} /> : <span aria-hidden="true" />}
            {i < list.length - 1 ? <IconButton icon="arrow_downward" label={`${t('mgmt.svQDown')}: ${q.text}`} onClick={() => move(i, 1)} /> : <span aria-hidden="true" />}
            <IconButton icon="edit" label={`${t('mgmt.svQEdit')}: ${q.text}`} onClick={() => setDlg({ q })} />
            <IconButton icon="delete" label={`${t('mgmt.svQRemove')}: ${q.text}`} onClick={() => onChange(list.filter((x) => x.id !== q.id))} />
          </div>
          )}
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
