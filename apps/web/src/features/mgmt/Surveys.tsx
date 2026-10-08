// Surveys: Live (one family survey and one venue survey can be live together), Drafts, Templates and the Log of every survey ever sent.
// "New survey" starts blank or from a template and opens the editor; a survey opens in full (summary, responses, history).
// Family surveys go to families with the app; venue surveys go to renters through the rating link of their booking (see Venue).
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  draftSurveys, liveSurveys, surveyKind, surveyLog, surveyStats, surveyTemplatesOf, type Survey, type SurveyKind, type SurveyTemplate,
} from '@cp/shared';
import { resolveSurveyAudience, teamCandidates } from '@cp/shared/rules/mgmt';
import { Button, EmptyState, FilterChips, Group, Icon, IconButton, PageHead, Pager, Pin, Sheet, usePaged } from '../../components/ui';
import { useDevice } from '../../hooks/useDevice';
import { useT, useFmt } from '../../lib/i18n';
import { useNow } from '../../lib/clock';
import { useAct } from '../../lib/act';
import { useClub } from '../../store/replica';
import { HPAD, IconBox, ListCard, Page, PillBtn, SegTabs, TONE, heroCard, labelStyle, tn } from './common';
import { audienceText } from './surveys/Fields';
import { SurveyEditor, TemplateEditor, draftOf, newDraft, type SurveyDraft } from './surveys/Editor';
import { SurveyDetail, type DetailTab } from './surveys/Detail';
import { Tiles } from './surveys/Results';

type Tab = 'live' | 'drafts' | 'templates' | 'log';
const TABS: Tab[] = ['live', 'drafts', 'templates', 'log'];
const DETAIL_TABS: DetailTab[] = ['summary', 'responses', 'history'];
const KIND_ICON: Record<SurveyKind, string> = { family: 'groups', venue: 'storefront' };

/** The round icon that says what kind a survey is. */
function KindDot({ kind }: { kind: SurveyKind }) {
  const { isPhone } = useDevice();
  const size = isPhone ? 40 : 46;
  return <span aria-hidden="true" style={{ width: size, height: size, borderRadius: 999, background: '#F3EEE8', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#75624B', flex: 'none' }}><IconBox name={KIND_ICON[kind]} size={isPhone ? 20 : 21} /></span>;
}
/** A tappable list row that fills the line, with a sibling action (never a button inside a button). */
const rowBtn = (isPhone: boolean) => ({ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: isPhone ? 12 : 16, padding: isPhone ? '10px 0' : '16px 0', minHeight: isPhone ? 58 : 64, border: 'none', background: 'transparent', textAlign: 'left' as const, cursor: 'pointer', color: '#24201C', fontFamily: 'Inter' });

export function Surveys() {
  const t = useT();
  const { isPhone } = useDevice();
  const { fds } = useFmt();
  const s = useClub();
  const { today } = useNow();
  const act = useAct();
  const [sp, setSp] = useSearchParams();
  const [tab, setTab] = useState<Tab>(() => TABS.find((k) => k === sp.get('view')) ?? 'live');
  const [picker, setPicker] = useState(false);
  const [editing, setEditing] = useState<SurveyDraft | null>(null);
  const [tplEdit, setTplEdit] = useState<{ tpl?: SurveyTemplate; kind: SurveyKind } | null>(null);
  // /surveys?survey=<id>&tab=responses opens one survey (the Venue page links to a renter's answer this way)
  const [detail, setDetail] = useState<{ id: string; tab: DetailTab } | null>(() => {
    const id = sp.get('survey');
    return id && s.surveys[id] ? { id, tab: DETAIL_TABS.find((k) => k === sp.get('tab')) ?? 'summary' } : null;
  });
  useEffect(() => { if (sp.get('survey')) setSp({}, { replace: true }); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const lives = liveSurveys(s);
  const drafts = draftSurveys(s);
  const templates = surveyTemplatesOf(s);
  const log = surveyLog(s);
  const [kindFilter, setKindFilter] = useState<'all' | SurveyKind>('all');
  const shownLog = kindFilter === 'all' ? log : log.filter((r) => r.kind === kindFilter);
  const logPaged = usePaged(shownLog, 8, kindFilter);
  const draftsPaged = usePaged(drafts, 6);
  const defaultTeam = teamCandidates(s).filter((x) => x.rateable).map((x) => x.id);

  const startBlank = (kind: SurveyKind) => { setPicker(false); setEditing(newDraft(kind, defaultTeam)); };
  const startFrom = (tpl: SurveyTemplate) => { setPicker(false); setEditing(newDraft(tpl.kind, defaultTeam, tpl)); };
  const kindName = (k: SurveyKind) => t('mgmt.svKind_' + k);
  const countLabel = (label: string, n: number) => (n > 0 ? <>{label} <span style={{ opacity: 0.6, fontVariantNumeric: 'tabular-nums' }}>{n}</span></> : label);

  // ----- Live -----
  const liveCard = (sv: Survey) => {
    const kind = surveyKind(sv);
    const st = surveyStats(s, sv);
    const who = kind === 'venue' ? tn(t, 'mgmt.svLinksSent', st.recipients) : `${t('mgmt.svSentTo')}: ${audienceText(t, sv, sv.recipients.length)}`;
    const buttons = isPhone ? (
      <div style={{ display: 'flex', gap: 8 }}>
        <PillBtn tone="primary" icon="analytics" onClick={() => setDetail({ id: sv.id, tab: 'summary' })}>{t('mgmt.svDetails')}</PillBtn>
        <PillBtn icon="lock_clock" onClick={() => act('survey.close', { surveyId: sv.id }, { ok: t('mgmt.svClosed', { title: sv.title }) })}>{t('mgmt.svClose')}</PillBtn>
      </div>
    ) : (
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Button size={44} icon="analytics" onClick={() => setDetail({ id: sv.id, tab: 'summary' })}>{t('mgmt.svDetails')}</Button>
        <Button size={44} variant="secondary" icon="lock_clock" onClick={() => act('survey.close', { surveyId: sv.id }, { ok: t('mgmt.svClosed', { title: sv.title }) })}>{t('mgmt.svClose')}</Button>
      </div>
    );
    const body = (
      <>
        <span style={{ fontSize: 22, lineHeight: '30px', fontWeight: 400, letterSpacing: '-0.3px', color: '#2B231C', overflowWrap: 'anywhere' }}>{sv.title}</span>
        <span style={{ fontSize: 14, lineHeight: 1.4, color: '#6B6259' }}>{who}</span>
        <Tiles s={s} sv={sv} compact={isPhone} />
        {buttons}
      </>
    );
    if (isPhone) return <Group key={sv.id} title={kindName(kind)} meta={t('mgmt.svLiveSent', { date: fds(sv.sentOn) })} gap={10}>{body}</Group>;
    return (
      <div key={sv.id} data-live={sv.id} style={{ ...heroCard, padding: `22px ${HPAD}`, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={labelStyle}>{kindName(kind)}</span>
          <span style={{ height: 26, padding: '0 12px', borderRadius: 8, background: TONE.sage.bg, color: TONE.sage.fg, fontSize: 13, fontWeight: 600, display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap' }}>{t('mgmt.svLiveSent', { date: fds(sv.sentOn) })}</span>
        </div>
        {body}
      </div>
    );
  };
  const liveTab = lives.length ? (
    <div style={isPhone ? { display: 'flex', flexDirection: 'column', gap: 18 } : { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 18, alignItems: 'start' }}>{lives.map(liveCard)}</div>
  ) : (
    <EmptyState icon="rate_review" title={t('mgmt.svLiveNone')} action={<Button size={44} icon="add" onClick={() => setPicker(true)}>{t('mgmt.svNew')}</Button>} />
  );

  // ----- Drafts -----
  const draftsTab = drafts.length ? (
    <ListCard title={t('mgmt.svDrafts')}>
      {draftsPaged.rows.map((x) => {
        const kind = surveyKind(x);
        const parts = [kindName(kind), tn(t, 'mgmt.svQuestionsN', x.questions.length + (x.custom?.length ?? 0)), kind === 'family' ? audienceText(t, x, resolveSurveyAudience(s, x.audience, today).length) : ''].filter(Boolean);
        return (
          <div key={x.id} style={{ display: 'flex', alignItems: 'center', gap: 4, borderTop: '1px solid #F0EAE1' }}>
            <button type="button" data-draft={x.id} onClick={() => setEditing(draftOf(x))} className={isPhone ? 'cp-press' : undefined} style={rowBtn(isPhone)}>
              <KindDot kind={kind} />
              <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: isPhone ? 16 : 17, fontWeight: 500, lineHeight: 1.3, overflowWrap: 'anywhere' }}>{x.title}</span>
                <span data-draft-audience={x.id} style={{ fontSize: 14, lineHeight: '20px', color: '#6B6259', overflowWrap: 'anywhere' }}>{parts.join(' · ')}</span>
              </span>
            </button>
            <IconButton icon="delete" bordered={false} label={`${t('common.delete')}: ${x.title}`} onClick={() => act('survey.delete', { surveyId: x.id }, { ok: t('mgmt.svDeleted') })} />
          </div>
        );
      })}
      <Pager page={draftsPaged.page} pages={draftsPaged.pages} onPage={draftsPaged.setPage} label={t('mgmt.pgDrafts')} />
    </ListCard>
  ) : <EmptyState icon="draft" title={t('mgmt.svDraftsNone')} />;

  // ----- Templates -----
  const templatesTab = (
    <ListCard title={t('mgmt.svTemplates')} right={isPhone ? <PillBtn icon="add" onClick={() => setTplEdit({ kind: 'family' })}>{t('mgmt.svTplNew')}</PillBtn> : <Button size={44} variant="secondary" icon="add" onClick={() => setTplEdit({ kind: 'family' })}>{t('mgmt.svTplNew')}</Button>}>
      {templates.length ? templates.map((x) => (
        <div key={x.id} style={{ display: 'flex', alignItems: 'center', gap: 8, borderTop: '1px solid #F0EAE1' }}>
          <button type="button" data-template={x.id} onClick={() => setTplEdit({ tpl: x, kind: x.kind })} className={isPhone ? 'cp-press' : undefined} style={rowBtn(isPhone)}>
            <KindDot kind={x.kind} />
            <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: isPhone ? 16 : 17, fontWeight: 500, lineHeight: 1.3, overflowWrap: 'anywhere' }}>{x.title}</span>
              <span style={{ fontSize: 14, lineHeight: '20px', color: '#6B6259' }}>{kindName(x.kind)} · {tn(t, 'mgmt.svQuestionsN', x.questions.length + x.custom.length)}{x.builtIn ? <> · <span data-builtin="true">{t('mgmt.svTplBuiltIn')}</span></> : null}</span>
            </span>
            <Icon name="chevron_right" size={20} color="#8A8078" />
          </button>
          {isPhone ? <PillBtn tone="quiet" onClick={() => startFrom(x)}>{t('mgmt.svTplUse')}</PillBtn> : <Button size={44} variant="secondary" onClick={() => startFrom(x)}>{t('mgmt.svTplUse')}</Button>}
        </div>
      )) : <div style={{ padding: '14px 0 16px', borderTop: '1px solid #F0EAE1', fontSize: 15, color: '#6B6259' }}>{t('mgmt.svTplNone')}</div>}
    </ListCard>
  );

  // ----- Log -----
  const logTab = log.length ? (
    <>
      {new Set(log.map((r) => r.kind)).size > 1 ? (
        <FilterChips label={t('mgmt.svFilterKind')} value={kindFilter} onChange={setKindFilter}
          options={[{ value: 'all', label: t('mgmt.svFilterAll'), count: log.length }, ...(['family', 'venue'] as const).map((k) => ({ value: k, label: kindName(k), count: log.filter((r) => r.kind === k).length }))]} />
      ) : null}
      <ListCard title={t('mgmt.svLogTitle')} meta={tn(t, 'mgmt.svLogCount', shownLog.length)}>
        {logPaged.rows.map((r) => {
          const sv = r.survey;
          return (
            <button key={sv.id} type="button" data-survey={sv.id} onClick={() => setDetail({ id: sv.id, tab: 'summary' })} className={isPhone ? 'cp-press' : undefined}
              style={{ ...rowBtn(isPhone), width: '100%', borderTop: '1px solid #F0EAE1' }}>
              <KindDot kind={r.kind} />
              <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: isPhone ? 16 : 17, fontWeight: 500, lineHeight: 1.3, overflowWrap: 'anywhere' }}>{sv.title}</span>
                <span style={{ fontSize: 14, lineHeight: '20px', color: '#6B6259' }}>{kindName(r.kind)} · {fds(r.sentOn)} → {r.closedOn ? fds(r.closedOn) : t('mgmt.svLogNow')}</span>
                <span style={{ fontSize: 14, lineHeight: '20px', color: '#24201C', fontVariantNumeric: 'tabular-nums' }}>{t('mgmt.svLogMeta', { sent: r.sent, answered: r.answered, rate: r.rate })}</span>
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 15, fontWeight: 500, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                {r.avgN ? <><Icon name="star" size={17} fill={1} color="#75624B" />{r.avg.toFixed(1)}</> : '—'}
              </span>
              <Icon name="chevron_right" size={20} color="#8A8078" />
            </button>
          );
        })}
        <Pager page={logPaged.page} pages={logPaged.pages} onPage={logPaged.setPage} label={t('mgmt.svLogTitle')} />
      </ListCard>
    </>
  ) : <EmptyState icon="history" title={t('mgmt.svLogNone')} />;

  return (
    <>
      <Page gap={16}>
        <PageHead eyebrow={isPhone ? undefined : t('mgmt.svEyebrow')} title={t('nav.surveys')} right={!isPhone ? <Button size={48} icon="add" onClick={() => setPicker(true)}>{t('mgmt.svNew')}</Button> : undefined} />
        <div style={{ maxWidth: isPhone ? undefined : 520 }}>
          <SegTabs label={t('nav.surveys')} value={tab} onChange={setTab} items={[
            { value: 'live', label: countLabel(t('mgmt.svTabLive'), lives.length) },
            { value: 'drafts', label: countLabel(t('mgmt.svTabDrafts'), drafts.length) },
            { value: 'templates', label: t('mgmt.svTabTemplates') },
            { value: 'log', label: t('mgmt.svTabLog') },
          ]} />
        </div>
        {tab === 'live' ? liveTab : tab === 'drafts' ? draftsTab : tab === 'templates' ? templatesTab : logTab}
      </Page>
      {isPhone && !picker && !editing && !tplEdit && !detail ? <Pin icon="add" label={t('mgmt.svNew')} onClick={() => setPicker(true)} /> : null}

      <NewSurveySheet open={picker} onClose={() => setPicker(false)} templates={templates} onBlank={startBlank} onTemplate={startFrom} />
      {editing ? <SurveyEditor key={editing.id ?? `new:${editing.templateId ?? editing.kind}`} draft={editing} onClose={(to) => { setEditing(null); if (to) setTab(to); }} /> : null}
      {tplEdit ? <TemplateEditor key={tplEdit.tpl?.id ?? 'new'} tpl={tplEdit.tpl} kind={tplEdit.kind} onClose={() => setTplEdit(null)} /> : null}
      {detail ? <SurveyDetail key={detail.id} id={detail.id} initialTab={detail.tab} onClose={() => setDetail(null)} /> : null}
    </>
  );
}

/** "New survey": blank (family or venue) or from one of the templates. */
function NewSurveySheet({ open, onClose, templates, onBlank, onTemplate }: { open: boolean; onClose: () => void; templates: SurveyTemplate[]; onBlank: (k: SurveyKind) => void; onTemplate: (t: SurveyTemplate) => void }) {
  const t = useT();
  const item = (key: string, kind: SurveyKind, title: string, sub: string, onClick: () => void) => (
    <button key={key} type="button" data-pick-survey={key} onClick={onClick} className="cp-press"
      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, minHeight: 56, padding: '8px 0', border: 'none', borderTop: '1px solid #F0EAE1', background: 'transparent', textAlign: 'left', cursor: 'pointer', color: '#24201C', fontFamily: 'Inter' }}>
      <KindDot kind={kind} />
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.3, overflowWrap: 'anywhere' }}>{title}</span>
        <span style={{ fontSize: 14, lineHeight: '20px', color: '#6B6259' }}>{sub}</span>
      </span>
      <Icon name="chevron_right" size={20} color="#8A8078" />
    </button>
  );
  return (
    <Sheet open={open} onClose={onClose} title={t('mgmt.svNew')}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={labelStyle}>{t('mgmt.svPickScratch')}</span>
        {item('blank-family', 'family', t('mgmt.svPickBlankFamily'), t('mgmt.svPickFamilySub'), () => onBlank('family'))}
        {item('blank-venue', 'venue', t('mgmt.svPickBlankVenue'), t('mgmt.svPickVenueSub'), () => onBlank('venue'))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={labelStyle}>{t('mgmt.svPickTemplates')}</span>
        {templates.length
          ? templates.map((x) => item(x.id, x.kind, x.title, `${t('mgmt.svKind_' + x.kind)} · ${tn(t, 'mgmt.svQuestionsN', x.questions.length + x.custom.length)}`, () => onTemplate(x)))
          : <span style={{ padding: '12px 0', fontSize: 15, color: '#6B6259', borderTop: '1px solid #F0EAE1' }}>{t('mgmt.svTplNone')}</span>}
      </div>
    </Sheet>
  );
}
