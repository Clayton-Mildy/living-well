// The survey editor (a pushed screen on phones, a dialog on tablet and laptop) and the template editor. Both share one form: title, the preset
// questions that are switched on, the team to rate (family surveys), the survey's own questions and, for a family survey, who gets it.
// A venue survey has no audience: renters answer through the rating link of their booking.
import { useMemo, useState, type ReactNode } from 'react';
import { SURVEY_BUILTINS, liveSurvey, presetsFor, staffCall, surveyKind, type Survey, type SurveyCustomQuestion, type SurveyKind, type SurveyTemplate } from '@cp/shared';
import { appFamilies, resolveSurveyAudience, teamCandidates } from '@cp/shared/rules/mgmt';
import { Button, Chip, Dialog, Group, Note, PhoneScreen, TextField } from '../../../components/ui';
import { useDevice } from '../../../hooks/useDevice';
import { useT } from '../../../lib/i18n';
import { useNow } from '../../../lib/clock';
import { useAct } from '../../../lib/act';
import { useClub } from '../../../store/replica';
import { chipRow, tn, wrapChip } from '../common';
import { AudiencePicker, CustomQuestions, audDraft, audPayload, type AudDraft } from './Fields';

/** What is typed in the editor. `id` is set once the draft is saved. */
export interface SurveyDraft { id?: string; kind: SurveyKind; templateId?: string; title: string; questions: Survey['questions']; custom: SurveyCustomQuestion[]; team: string[]; aud: AudDraft }

const cloneCustom = (list: SurveyCustomQuestion[]) => list.map((c) => ({ ...c, options: c.options ? [...c.options] : undefined }));
/** A new draft: blank, from a template, or from a saved draft. */
export function newDraft(kind: SurveyKind, defaultTeam: string[], from?: SurveyTemplate): SurveyDraft {
  const questions = from ? [...from.questions] : [...presetsFor(kind)];
  const team = kind === 'venue' ? [] : from?.teamStaffIds?.length ? [...from.teamStaffIds] : defaultTeam;
  return { kind, ...(from ? { templateId: from.id } : {}), title: from?.title ?? '', questions, custom: from ? cloneCustom(from.custom) : [], team, aud: audDraft(undefined) };
}
export const draftOf = (x: Survey): SurveyDraft => ({
  id: x.id, kind: surveyKind(x), ...(x.templateId ? { templateId: x.templateId } : {}), title: x.title, questions: [...x.questions], custom: cloneCustom(x.custom ?? []), team: [...x.teamStaffIds], aud: audDraft(x.audience),
});

const customPayload = (list: SurveyCustomQuestion[]) => list.map((c) => ({ id: c.id, kind: c.kind, text: c.text.trim(), ...(c.kind === 'choice' ? { options: c.options } : {}), required: c.required }));

/** Closing a dialog opened from this editor (a question) with Escape must not also close the editor under it. */
const guardClose = (close: () => void) => () => { if (document.querySelectorAll('[role="dialog"][aria-modal="true"]').length > 1) return; close(); };

/** The shared form fields. `audience` is shown for family surveys only (not for templates). */
function SurveyForm({ f, setF, audience, titleLabel, recipients }: { f: SurveyDraft; setF: (d: SurveyDraft) => void; audience: boolean; titleLabel: string; recipients: number }) {
  const t = useT();
  const s = useClub();
  const { today } = useNow();
  const venue = f.kind === 'venue';
  const cands = teamCandidates(s);
  const defaultTeam = cands.filter((x) => x.rateable).map((x) => x.id);
  const hasTeam = f.questions.includes('team');
  const asksNothing = !f.questions.length && !f.custom.length;
  const anyFamily = useMemo(() => appFamilies(s, today).length > 0, [s, today]);
  const toggleQ = (q: Survey['questions'][number]) => {
    const on = f.questions.includes(q);
    const questions = SURVEY_BUILTINS.filter((x) => (x === q ? !on : f.questions.includes(x)));
    setF({ ...f, questions, team: q === 'team' && !on && !f.team.length ? defaultTeam : f.team });
  };
  return (
    <>
      <TextField label={titleLabel} value={f.title} onChange={(v) => setF({ ...f, title: v })} placeholder={t(venue ? 'mgmt.svTitlePhV' : 'mgmt.svTitlePh')} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 15, lineHeight: '22px', fontWeight: 500 }}>{t('mgmt.svQuestions')}</span>
        <div style={chipRow}>
          {presetsFor(f.kind).map((k) => <Chip key={k} selected={f.questions.includes(k)} onClick={() => toggleQ(k)} size={44} style={wrapChip}>{t('mgmt.svq_' + k)}</Chip>)}
        </div>
        {venue && !f.questions.includes('overall') ? <span style={{ fontSize: 14, color: '#9A3D24', lineHeight: '20px' }} role="alert">{t('mgmt.err.venueNeedsOverall')}</span> : null}
      </div>
      {hasTeam && !venue ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 16, lineHeight: '22px', fontWeight: 500 }}>{t('mgmt.svTeam')}</span>
          <div style={chipRow}>
            {cands.map((x) => (
              <Chip key={x.id} selected={f.team.includes(x.id)} onClick={() => setF({ ...f, team: f.team.includes(x.id) ? f.team.filter((y) => y !== x.id) : [...f.team, x.id] })} style={wrapChip}>{`${staffCall(x)} · ${t('roles.' + x.role)}`}</Chip>
            ))}
          </div>
          {!f.team.length && audience ? <span style={{ fontSize: 14, color: '#9A3D24', lineHeight: '20px' }} role="alert">{t('mgmt.err.teamRequired')}</span> : null}
        </div>
      ) : null}
      <CustomQuestions list={f.custom} onChange={(custom) => setF({ ...f, custom })} />
      {asksNothing ? <span style={{ fontSize: 14, color: '#9A3D24', lineHeight: '20px' }} role="alert">{t('mgmt.err.noQuestions')}</span> : null}
      {audience && !venue ? (
        <>
          <AudiencePicker value={f.aud} onChange={(aud) => setF({ ...f, aud })} count={recipients} />
          {!anyFamily ? <Note icon="info">{t('mgmt.svNoFamilies')}</Note> : !recipients ? <Note icon="info">{t('mgmt.svNoneChosen')}</Note> : null}
        </>
      ) : null}
    </>
  );
}

/** One overlay for both editors: a pushed screen with the actions pinned under it on phones, a dialog on wider screens. */
function Overlay({ title, eyebrow, back, onClose, footer, children }: { title: string; eyebrow?: string; back: string; onClose: () => void; footer: ReactNode; children: ReactNode }) {
  const { isPhone } = useDevice();
  const close = guardClose(onClose);
  if (isPhone) {
    return (
      <PhoneScreen open onClose={close} label={title} back={back} footer={footer}>
        <Group title={title} gap={16}>{children}</Group>
      </PhoneScreen>
    );
  }
  return <Dialog open onClose={close} eyebrow={eyebrow} title={title} maxWidth={760} footer={footer}>{children}</Dialog>;
}

/** Edit a survey draft and send it (or save it as a draft, or as a template). */
export function SurveyEditor({ draft, onClose }: { draft: SurveyDraft; onClose: (to?: 'live' | 'drafts') => void }) {
  const t = useT();
  const { isPhone } = useDevice();
  const s = useClub();
  const { today } = useNow();
  const act = useAct();
  const [f, setF] = useState<SurveyDraft>(draft);
  const [busy, setBusy] = useState(false);
  const venue = f.kind === 'venue';
  const hasTeam = f.questions.includes('team');
  const recipients = useMemo(() => (venue ? [] : resolveSurveyAudience(s, audPayload(f.aud), today)), [s, venue, f.aud, today]);
  const asksNothing = !f.questions.length && !f.custom.length;
  const ok = !!f.title.trim() && (venue || !hasTeam || f.team.length > 0) && !asksNothing && (!venue || f.questions.includes('overall'));
  const replaced = liveSurvey(s, f.kind);
  const payload = () => ({
    title: f.title.trim(), kind: f.kind, ...(f.templateId ? { templateId: f.templateId } : {}), questions: f.questions, custom: customPayload(f.custom),
    teamStaffIds: hasTeam && !venue ? f.team : [], ...(venue ? {} : { audience: audPayload(f.aud) }),
  });
  /** Save the draft: create it, or update it once it has an id. Returns its id. */
  const save = async (okText?: string): Promise<string | null> => {
    const r = f.id ? await act('survey.update', { surveyId: f.id, ...payload() }, okText ? { ok: okText } : { silent: true }) : await act('survey.create', payload(), okText ? { ok: okText } : { silent: true });
    if (!r.ok) return null;
    return f.id || String(r.result.surveyId);
  };
  const run = async (fn: () => Promise<void>) => { if (!ok || busy) return; setBusy(true); try { await fn(); } finally { setBusy(false); } };
  const sendNow = () => run(async () => {
    const id = await save();
    if (!id) return;
    const r2 = await act('survey.send', { surveyId: id }, { ok: venue ? t('mgmt.svLiveToast', { title: f.title.trim() }) : tn(t, 'mgmt.svSent', recipients.length) });
    if (r2.ok) onClose('live');
    else setF({ ...f, id });
  });
  const saveDraft = () => run(async () => { if (await save(t('mgmt.svDraftSaved'))) onClose('drafts'); });
  const saveTemplate = () => run(async () => {
    await act('surveyTemplate.save', { title: f.title.trim(), kind: f.kind, questions: f.questions, custom: customPayload(f.custom), teamStaffIds: hasTeam && !venue ? f.team : [] }, { ok: t('mgmt.svTplSaved') });
  });
  const sendLabel = venue ? t('mgmt.svGoLive') : tn(t, 'mgmt.svSendTo', recipients.length);
  const footer = isPhone ? (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Button size={48} full disabled={!ok || (!venue && !recipients.length) || busy} onClick={sendNow}>{sendLabel}</Button>
      <div style={{ display: 'flex', gap: 8 }}>
        <Button size={44} variant="secondary" full disabled={!ok || busy} onClick={saveDraft}>{t('mgmt.svSaveDraft')}</Button>
        <Button size={44} variant="secondary" full disabled={!ok || busy} onClick={saveTemplate}>{t('mgmt.svTplSaveAs')}</Button>
      </div>
    </div>
  ) : (
    <>
      <Button variant="ghost" disabled={!ok || busy} onClick={saveTemplate}>{t('mgmt.svTplSaveAs')}</Button>
      <Button variant="secondary" disabled={!ok || busy} onClick={saveDraft}>{t('mgmt.svSaveDraft')}</Button>
      <Button disabled={!ok || (!venue && !recipients.length) || busy} onClick={sendNow}>{sendLabel}</Button>
    </>
  );
  const title = f.id ? t('mgmt.svEditDraft') : t('mgmt.svNew');
  return (
    <Overlay title={title} eyebrow={t('mgmt.svKind_' + f.kind)} back={t('nav.surveys')} onClose={() => onClose()} footer={footer}>
      {isPhone ? <span style={{ fontSize: 13, lineHeight: '18px', color: '#6B6259' }}>{t('mgmt.svKind_' + f.kind)}</span> : null}
      <SurveyForm f={f} setF={setF} audience titleLabel={t('mgmt.svTitle')} recipients={recipients.length} />
      {replaced && replaced.id !== f.id ? <Note icon="info">{t(venue ? 'mgmt.svReplacesV' : 'mgmt.svReplaces', { title: replaced.title })}</Note> : null}
    </Overlay>
  );
}

/** Create or change a template, or delete it. */
export function TemplateEditor({ tpl, kind, onClose }: { tpl?: SurveyTemplate; kind: SurveyKind; onClose: () => void }) {
  const t = useT();
  const { isPhone } = useDevice();
  const s = useClub();
  const act = useAct();
  const [f, setF] = useState<SurveyDraft>(() => (tpl ? { ...newDraft(tpl.kind, [], tpl), id: tpl.id, templateId: undefined, team: [...(tpl.teamStaffIds ?? [])] } : newDraft(kind, teamCandidates(s).filter((x) => x.rateable).map((x) => x.id))));
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const venue = f.kind === 'venue';
  const hasTeam = f.questions.includes('team');
  const asksNothing = !f.questions.length && !f.custom.length;
  const ok = !!f.title.trim() && !asksNothing && (!venue || f.questions.includes('overall'));
  const save = async () => {
    if (!ok || busy) return;
    setBusy(true);
    try {
      const r = await act('surveyTemplate.save', { ...(tpl ? { id: tpl.id } : {}), title: f.title.trim(), kind: f.kind, questions: f.questions, custom: customPayload(f.custom), teamStaffIds: hasTeam && !venue ? f.team : [] }, { ok: t('mgmt.svTplSaved') });
      if (r.ok) onClose();
    } finally { setBusy(false); }
  };
  const del = async () => {
    if (!tpl) return;
    const r = await act('surveyTemplate.delete', { id: tpl.id }, { ok: t('mgmt.svTplDeleted') });
    if (r.ok) onClose();
  };
  const footer = isPhone ? (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Button size={48} full disabled={!ok || busy} onClick={save}>{t('mgmt.svTplSave')}</Button>
      {tpl && !tpl.builtIn ? <Button size={44} variant="secondary" full onClick={() => setConfirm(true)}>{t('mgmt.svTplDelete')}</Button> : null}
    </div>
  ) : (
    <>
      {tpl && !tpl.builtIn ? <Button variant="ghost" onClick={() => setConfirm(true)}>{t('mgmt.svTplDelete')}</Button> : null}
      <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
      <Button disabled={!ok || busy} onClick={save}>{t('mgmt.svTplSave')}</Button>
    </>
  );
  return (
    <>
      <Overlay title={tpl ? t('mgmt.svTplEdit') : t('mgmt.svTplNew')} eyebrow={t('mgmt.svKind_' + f.kind)} back={t('nav.surveys')} onClose={onClose} footer={footer}>
        {isPhone ? <span style={{ fontSize: 13, lineHeight: '18px', color: '#6B6259' }}>{t('mgmt.svKind_' + f.kind)}</span> : null}
        <SurveyForm f={f} setF={setF} audience={false} titleLabel={t('mgmt.svTplName')} recipients={0} />
      </Overlay>
      {confirm && tpl && !tpl.builtIn ? (
        <Dialog open onClose={() => setConfirm(false)} title={t('mgmt.svTplDelete')} maxWidth={480}
          footer={<><Button variant="secondary" onClick={() => setConfirm(false)}>{t('common.cancel')}</Button><Button variant="danger" onClick={del}>{t('common.delete')}</Button></>}>
          <div style={{ fontSize: 16, lineHeight: '24px' }}>{t('mgmt.svTplDeleteText', { title: tpl.title })}</div>
        </Dialog>
      ) : null}
    </>
  );
}
