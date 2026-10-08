// What a survey got back: the key numbers, ratings per team member, comments, and a summary of each question of its own.
import { responseWho, surveyKind, surveyStats, type CustomResult, type Survey } from '@cp/shared';
import { recommendPct } from '@cp/shared/rules/mgmt';
import { Group, Icon, Pager, usePaged } from '../../../components/ui';
import { useT, useFmt } from '../../../lib/i18n';
import { useClub } from '../../../store/replica';
import { labelStyle, tn } from '../common';

export function Tiles({ s, sv, compact }: { s: ReturnType<typeof useClub>; sv: Survey; compact?: boolean }) {
  const t = useT();
  const st = surveyStats(s, sv);
  const rec = recommendPct(s, sv);
  const asks = (k: Survey['questions'][number]) => sv.questions.includes(k);
  const venue = surveyKind(sv) === 'venue';
  const tiles = [
    ...(asks('overall') ? [{ label: t('mgmt.svOverall'), value: st.overallN ? `${st.overall.toFixed(1)} / 5` : '—', sub: tn(t, 'mgmt.svAnswers', st.overallN) }] : []),
    ...(asks('recommend') ? [{ label: t('mgmt.svRecommend'), value: rec === null ? '—' : `${rec}%`, sub: t(venue ? 'mgmt.svOfAnsweredV' : 'mgmt.svOfAnswered') }] : []),
    { label: t('mgmt.svRate'), value: `${st.rate}%`, sub: t('mgmt.svAnsweredOf', { n: st.answered, total: st.recipients }) },
  ];
  // round 6, phone (compact): plain numbers in the summary group, no underlines
  if (compact) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(tiles.length, 3)}, minmax(0, 1fr))`, gap: 12, paddingTop: 6, borderTop: '1px solid #F0EAE1' }}>
        {tiles.map((x) => (
          <div key={x.label} style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, paddingTop: 8 }}>
            <span style={{ fontSize: 26, lineHeight: '30px', fontWeight: 300, letterSpacing: '-0.5px', fontVariantNumeric: 'tabular-nums' }}>{x.value}</span>
            <span style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3 }}>{x.label}</span>
            <span style={{ fontSize: 12, lineHeight: '16px', color: '#6B6259' }}>{x.sub}</span>
          </div>
        ))}
      </div>
    );
  }
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

export function TeamBars({ sv, staffName, staffRole, native }: { sv: Survey; staffName: (id: string) => string; staffRole: (id: string) => string; native?: boolean }) {
  const t = useT();
  const s = useClub();
  if (!sv.questions.includes('team') || !sv.teamStaffIds.length) return null;
  const st = surveyStats(s, sv);
  // round 6, phone: a group of rows (name and role, the score on the right, the bar under them)
  if (native) {
    return (
      <Group title={t('mgmt.svTeamRatings')} pad="0 16px" gap={0}>
        <div style={{ marginTop: -1 }}>
          {st.team.map((r) => (
            <div key={r.staffId} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 0', borderTop: '1px solid #F0EAE1' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 16, lineHeight: '22px', fontWeight: 500 }}>{staffName(r.staffId)}</span>
                  <span style={{ fontSize: 14, lineHeight: '20px', color: '#5E5852' }}>{staffRole(r.staffId)} · {r.n ? tn(t, 'mgmt.svRatings', r.n) : t('mgmt.svNoRatings')}</span>
                </div>
                <span style={{ fontSize: 16, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{r.n ? `${r.avg.toFixed(1)} / 5` : '—'}</span>
              </div>
              <div style={{ height: 6, borderRadius: 999, background: '#F0EAE1', overflow: 'hidden' }} role="img" aria-label={r.n ? `${r.avg.toFixed(1)} / 5` : '—'}>
                <div style={{ height: '100%', width: r.n ? `${Math.round((r.avg / 5) * 100)}%` : '0%', background: '#3D6B4F' }} />
              </div>
            </div>
          ))}
        </div>
      </Group>
    );
  }
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

export function Comments({ sv, max, native }: { sv: Survey; max?: number; native?: boolean }) {
  const t = useT();
  const { fds } = useFmt();
  const s = useClub();
  const st = surveyStats(s, sv);
  const list = max ? st.comments.slice(0, max) : st.comments;
  const paged = usePaged(list, 5, sv.id);
  if (!list.length) return null;
  const items = (
    <>
      {paged.rows.map((c) => (
        <div key={c.id} style={{ padding: '10px 14px', borderRadius: 10, background: '#F5F5F3', display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ fontSize: 15, lineHeight: '22px', overflowWrap: 'anywhere' }}>“{c.comment}”</span>
          <span style={{ fontSize: 14, lineHeight: '20px', color: '#5E5852' }}>{responseWho(s, c)} · {fds(c.on)}</span>
        </div>
      ))}
      <Pager page={paged.page} pages={paged.pages} onPage={paged.setPage} label={t('mgmt.pgComments')} />
    </>
  );
  // round 6, phone: the comments are a group under a small header
  if (native) return <Group title={t('mgmt.svComments')} gap={8}>{items}</Group>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={labelStyle}>{t('mgmt.svComments')}</span>
      {items}
    </div>
  );
}

/** What was answered to each question of your own: average stars, yes and no, options with bars, and the written answers (paged). */
export function CustomResults({ sv, native }: { sv: Survey; native?: boolean }) {
  const t = useT();
  const s = useClub();
  const st = surveyStats(s, sv);
  if (!st.custom.length) return null;
  const blocks = st.custom.map((r) => <ResultBlock key={`${sv.id}:${r.q.id}`} r={r} />);
  // phone: a group under a small header, like the other parts of the summary
  if (native) return <div data-testid="survey-results"><Group title={t('mgmt.svCustomResults')} gap={10}>{blocks}</Group></div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} data-testid="survey-results">
      <span style={labelStyle}>{t('mgmt.svCustomResults')}</span>
      {blocks}
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
          <span style={{ fontSize: 14, lineHeight: '20px', color: '#5E5852' }}>{(s.surveyResponses[a.id] ? responseWho(s, s.surveyResponses[a.id]) : a.familyId)} · {fds(a.on)}</span>
        </div>
      ))}
      <Pager page={paged.page} pages={paged.pages} onPage={paged.setPage} label={t('mgmt.pgTextAnswers')} />
    </div>
  );
}
