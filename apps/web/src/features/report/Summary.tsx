// The Summary view of the daily report: one iOS-style grouped section per topic, key numbers first and names only where they matter.
// Who came · Activities · Lunch and tea · Health checks · Mood and notes · Duties · Also this day. On a wide container the sections sit in two columns.
import type { CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Photo } from '@cp/shared';
import { memberName, memberShort } from '@cp/shared';
import { FIXED_SLOTS, LUNCH_AMOUNTS, activityName, roomName } from '@cp/shared/rules/activity';
import { MOODS, type DayReport, type ReportSession } from '@cp/shared/rules/dailyReport';
import { readingSummary } from '@cp/shared/rules/healthStation';
import { Group, Icon, PhotoThumbs, StaffOnlyTag } from '../../components/ui';
import { PendingMark } from '../../components/PendingMark';
import { useFmt, useT, type TFn } from '../../lib/i18n';
import { rowLine } from '../activity/lib';
import { DotItem, MemberAvatar } from '../lobby/parts';
import { Fact, HEALTH_DOT, LUNCH_DOT, LUNCH_KEY, Line, MOOD_DOT, MUTED, MoreRow, OCHRE, RUST, SAGE, Tag, useCap, visitTime } from './parts';

export type OpenPhotos = (photos: Photo[], startId: string) => void;
const plural = (t: TFn, key: string, n: number) => t(`${key}_${n === 1 ? 'one' : 'other'}`, { n });
const sub: CSSProperties = { fontSize: 14, lineHeight: '20px', color: MUTED };

export function Summary({ r, wide, openPhotos }: { r: DayReport; wide: boolean; openPhotos: OpenPhotos }) {
  const col: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 };
  const came = <Came key="came" r={r} />;
  const guests = <Guests key="guests" r={r} />;
  const activities = <Activities key="activities" r={r} openPhotos={openPhotos} />;
  const lunch = <LunchTea key="lunch" r={r} openPhotos={openPhotos} />;
  const health = <Health key="health" r={r} />;
  const mood = <MoodNotes key="mood" r={r} />;
  const duties = <Duties key="duties" r={r} />;
  const other = <Other key="other" r={r} />;
  if (wide) {
    return (
      <div data-testid="report-summary-view" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 28, alignItems: 'start' }}>
        <div style={col}>{[came, guests, mood, duties]}</div>
        <div style={col}>{[activities, lunch, health, other]}</div>
      </div>
    );
  }
  return <div data-testid="report-summary-view" style={col}>{[came, guests, activities, lunch, health, mood, duties, other]}</div>;
}

// ---------- who came ----------
function Came({ r }: { r: DayReport }) {
  const t = useT();
  const go = useNavigate();
  const cap = useCap(r.members, 8);
  if (!r.members.length) return null;
  return (
    <Group title={t('report.came')} meta={t('report.nMembers', { n: r.members.length })} pad={0} gap={0}>
      {cap.shown.map((x, i) => (
        <Line key={x.m.id} first={i === 0} inset={66} onClick={() => go(`/members/${x.m.id}`)}>
          <MemberAvatar m={x.m} size={38} font={14} />
          <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.3 }}>{memberName(x.m)}</span>
            <span style={{ ...sub, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '2px 10px' }}>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{visitTime(t, x)}</span>
              <span>{x.flex ? t('report.flexVisit', { n: x.flex.n, q: x.flex.quota }) : t('report.gold')}</span>
              {x.extra ? <DotItem color={RUST}>{t('report.extraDay')}</DotItem> : null}
            </span>
          </span>
          <Icon name="chevron_right" size={20} color="#A89C8E" />
        </Line>
      ))}
      <MoreRow cap={cap} total={r.members.length} t={t} />
    </Group>
  );
}
function Guests({ r }: { r: DayReport }) {
  const t = useT();
  if (!r.guests.length) return null;
  return (
    <Group title={t('report.guests')} meta={r.guests.length} pad={0} gap={0}>
      {r.guests.map((x, i) => {
        const when = x.came
          ? (x.g.checkOut ? t('report.inOut', { a: x.g.checkIn?.at, l: x.g.checkOut.at }) : x.state === 'in' ? t('report.since', { a: x.g.checkIn?.at }) : x.g.checkIn?.at)
          : x.state === 'noShow' ? t('report.gNoShow') : [t('report.gExpected'), x.g.time].filter(Boolean).join(' ');
        return (
          <Line key={x.g.id} first={i === 0} inset={66}>
            <span aria-hidden="true" style={{ width: 38, height: 38, borderRadius: 999, background: '#F3EEE8', color: '#75624B', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><Icon name={x.g.kind === 'trial' ? 'badge' : 'person'} size={20} /></span>
            <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.3 }}>{x.g.name}</span>
              <span style={sub}>{[t(x.g.kind === 'trial' ? 'report.kindTrial' : 'report.kindVisit'), when].filter(Boolean).join(' · ')}</span>
            </span>
          </Line>
        );
      })}
    </Group>
  );
}

// ---------- activities ----------
function Activities({ r, openPhotos }: { r: DayReport; openPhotos: OpenPhotos }) {
  const t = useT();
  const { lang } = useFmt();
  const empty = !r.sessions.length;
  if (empty && !r.status.open) return null;
  return (
    <Group title={t('report.activities')} meta={r.sessions.length ? r.sessions.length : undefined} pad={0} gap={0}>
      {empty ? <Line first><span style={sub}>{t(r.status.open && r.status.outing ? 'report.outingNoSessions' : 'report.noSessions')}</span></Line> : null}
      {r.sessions.map((x, i) => <SessionLine key={x.slot} x={x} first={i === 0} lang={lang} openPhotos={openPhotos} t={t} />)}
    </Group>
  );
}
function SessionLine({ x, first, lang, openPhotos, t }: { x: ReportSession; first: boolean; lang: 'en' | 'id'; openPhotos: OpenPhotos; t: TFn; }) {
  const name = activityName(x.activity, lang);
  const who = x.guest ? t('report.guestHost', { name: x.guest.host.name }) : x.staff ? (x.staff.knownAs || x.staff.name) : '';
  const place = roomName(x.room, lang);
  return (
    <div data-session={x.slot} style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: '12px 16px', backgroundColor: '#FFFFFF', ...rowLine(first) }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
        <span style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums', color: MUTED, flex: 'none' }}>{x.slot}</span>
        <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.3, minWidth: 0, overflowWrap: 'anywhere' }}>{name}</span>
        {x.changed ? <Tag>{t('report.changed')}</Tag> : null}
      </div>
      {who || place ? <span style={sub}>{[who, place].filter(Boolean).join(' · ')}</span> : null}
      {x.changed && x.note ? <span style={{ ...sub, color: OCHRE }}>{x.note}</span> : null}
      <span style={{ ...sub, color: '#4A4038', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '2px 10px' }}>
        {x.state === 'later' ? <span style={{ color: MUTED }}>{t('report.notStarted')}</span> : (
          <>
            {x.state === 'now' ? <DotItem color={SAGE}>{t('report.running')}</DotItem> : null}
            <span>{x.satOut.length ? `${t('report.joined', { n: x.joined.length })} · ${t('report.satOutWho', { n: x.satOut.length, names: x.satOut.map(memberShort).join(', ') })}` : t('report.joined', { n: x.joined.length })}</span>
            {x.notMarked ? <span style={{ color: OCHRE }}>{t('report.notMarked', { n: x.notMarked })}</span> : null}
          </>
        )}
      </span>
      {x.photos.length ? <PhotoThumbs photos={x.photos} size={52} max={5} onOpen={(p) => openPhotos(x.photos, p.id)} alt={(p) => t('report.photoAria', { a: name, t: p.time })} /> : null}
      {x.photosPending ? <span style={{ ...sub, color: OCHRE }}>{t('report.photosPending', { n: x.photosPending })}</span> : null}
    </div>
  );
}

// ---------- lunch and tea ----------
function LunchTea({ r, openPhotos }: { r: DayReport; openPhotos: OpenPhotos }) {
  const t = useT();
  const l = r.lunch;
  if (!r.status.open && !l.photos.lunch.length && !l.photos.tea.length) return null;
  const rows: { key: 'lunch' | 'soft' | 'tea'; names: string }[] = l.menu
    ? (['lunch', 'soft', 'tea'] as const).map((k) => ({ key: k, names: l.menu![k].map((d) => d.name).join(', ') })).filter((x) => x.names)
    : [];
  const total = LUNCH_AMOUNTS.reduce((n, a) => n + l.eaten[a], 0);
  const photoRow = (kind: 'lunch' | 'tea', first: boolean) => {
    const photos = l.photos[kind];
    if (!photos.length) return null;
    const pending = photos.filter((p) => p.visibility === 'pending').length;
    return (
      <Fact key={kind + 'Photos'} first={first} label={`${t(kind === 'lunch' ? 'report.lunchPhotos' : 'report.teaPhotos')} · ${photos.length}`}>
        <PhotoThumbs photos={photos} size={52} max={5} onOpen={(p) => openPhotos(photos, p.id)} alt={(p) => t('report.photoAria', { a: t(kind === 'lunch' ? 'report.lunch' : 'report.tea'), t: p.time })} />
        {pending ? <div style={{ ...sub, color: OCHRE, marginTop: 4 }}>{t('report.photosPending', { n: pending })}</div> : null}
      </Fact>
    );
  };
  return (
    <Group title={t('report.lunchTea')} meta={l.diners ? plural(t, 'report.nLunches', l.diners) : undefined} pad={0} gap={0}>
      {!rows.length ? <Line first><span style={sub}>{t('report.noMenu')}</span></Line> : null}
      {rows.map((x, i) => <Fact key={x.key} first={i === 0} label={t('report.' + x.key)}>{x.names}</Fact>)}
      {l.alternatives.length ? (
        <Fact label={t('report.alternatives')}>
          {l.alternatives.map((a, i) => <div key={i} style={{ marginTop: i ? 3 : 0 }}>{t('report.altLine', { name: a.name, dish: a.dish, alt: a.alternative })}</div>)}
        </Fact>
      ) : null}
      {photoRow('lunch', false)}
      {photoRow('tea', false)}
      {r.members.length ? (
        <Fact label={t('report.howMuch')}>
          {!l.served ? <span style={{ color: MUTED }}>{t('report.lunchAt', { t: FIXED_SLOTS.find((f) => f.kind === 'lunch')!.time })}</span> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {total ? (
                <div role="img" aria-label={LUNCH_AMOUNTS.filter((a) => l.eaten[a]).map((a) => `${t('report.' + LUNCH_KEY[a])} ${l.eaten[a]}`).join(', ')} style={{ display: 'flex', height: 8, borderRadius: 999, overflow: 'hidden', background: '#F0EAE1' }}>
                  {LUNCH_AMOUNTS.filter((a) => l.eaten[a]).map((a) => <span key={a} style={{ width: `${(l.eaten[a] / total) * 100}%`, background: LUNCH_DOT[a] }} />)}
                </div>
              ) : null}
              {total ? (
                <div data-testid="report-eaten" style={{ ...sub, display: 'flex', flexWrap: 'wrap', gap: '2px 14px' }}>
                  {LUNCH_AMOUNTS.filter((a) => l.eaten[a]).map((a) => <DotItem key={a} color={LUNCH_DOT[a]}><span style={{ color: '#4A4038' }}>{t('report.' + LUNCH_KEY[a])} {l.eaten[a]}</span></DotItem>)}
                </div>
              ) : null}
              {l.low.some((x) => x.amount === 'little') ? <div style={sub}>{t('report.lowLine', { names: l.low.filter((x) => x.amount === 'little').map((x) => memberShort(x.m)).join(', ') })}</div> : null}
              {l.low.some((x) => x.amount === 'none') ? <div style={{ ...sub, color: RUST }}>{t('report.noneLine', { names: l.low.filter((x) => x.amount === 'none').map((x) => memberShort(x.m)).join(', ') })}</div> : null}
              {l.notMarked ? <div style={{ ...sub, color: OCHRE }}>{t('report.lunchNotMarked', { n: l.notMarked })}</div> : null}
            </div>
          )}
        </Fact>
      ) : null}
    </Group>
  );
}

// ---------- health checks ----------
const KIND_KEY = { arrival: 'health.arrivalCheck', departure: 'health.departureCheck', recheck: 'health.recheckL', spot: 'health.spotCheck', monthly: 'health.monthlyCheck' } as const;
function Health({ r }: { r: DayReport }) {
  const t = useT();
  const go = useNavigate();
  const h = r.health;
  const cap = useCap(h.flagged, 6);
  if (!r.status.open && !h.readings) return null;
  return (
    <Group title={t('report.health')} pad={0} gap={0}>
      <Line first>
        {h.readings ? (
          <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '2px 14px', fontSize: 15 }}>
            <span style={{ fontWeight: 500 }}>{plural(t, 'report.nCheck', h.readings)} · {plural(t, 'report.nPerson', h.people)}</span>
            {h.alert ? <DotItem color={RUST}>{t('report.alertN', { n: h.alert })}</DotItem> : null}
            {h.watch ? <DotItem color={HEALTH_DOT.watch}>{t('report.watchN', { n: h.watch })}</DotItem> : null}
            {!h.alert && !h.watch ? <DotItem color={SAGE}>{t('report.allNormal')}</DotItem> : null}
          </span>
        ) : <span style={sub}>{t('report.noChecks')}</span>}
      </Line>
      {cap.shown.map((x) => (
        <Line key={x.r.id} inset={16} onClick={x.memberId ? () => go(`/members/${x.memberId}/health`) : undefined}>
          <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 999, background: HEALTH_DOT[x.r.status], flex: 'none' }} />
          <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '2px 8px', fontSize: 16, fontWeight: 500, lineHeight: 1.3 }}>
              {x.name}
              {!x.memberId ? <span style={{ ...sub, fontWeight: 400 }}>{t('report.guestReading')}</span> : null}
              {x.pending ? <PendingMark row={x.r} /> : null}
            </span>
            <span style={sub}>{[x.r.time, t(KIND_KEY[x.r.kind]), readingSummary(x.r)].filter(Boolean).join(' · ')}</span>
          </span>
          <span style={{ color: HEALTH_DOT[x.r.status], fontSize: 14, fontWeight: 600, flex: 'none' }}>{t('status.' + x.r.status)}</span>
          {x.memberId ? <Icon name="chevron_right" size={20} color="#A89C8E" /> : null}
        </Line>
      ))}
      <MoreRow cap={cap} total={h.flagged.length} t={t} />
    </Group>
  );
}

// ---------- mood and notes ----------
function MoodNotes({ r }: { r: DayReport }) {
  const t = useT();
  const m = r.mood;
  const cap = useCap(m.notes, 4);
  if (!r.members.length) return null;
  const any = MOODS.some((k) => m.counts[k]);
  return (
    <Group title={t('report.mood')} meta={m.notes.length ? plural(t, 'report.notesN', m.notes.length) : undefined} pad={0} gap={0}>
      <Line first>
        <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '2px 14px', fontSize: 15 }}>
          {MOODS.filter((k) => m.counts[k]).map((k) => <DotItem key={k} color={MOOD_DOT[k]}><span style={{ color: '#24201C' }}>{t('activity.opt.mood.' + k)} {m.counts[k]}</span></DotItem>)}
          {!any && !m.notMarked && !m.pendingLogs ? <span style={sub}>—</span> : null}
          {m.notMarked ? <DotItem color={OCHRE}>{t('report.moodNotLogged', { n: m.notMarked })}</DotItem> : null}
          {m.pendingLogs ? <DotItem color={OCHRE}>{t('report.logsPending', { n: m.pendingLogs })}</DotItem> : null}
        </span>
      </Line>
      {!m.notes.length ? <Line><span style={sub}>{t('report.noNotes')}</span></Line> : null}
      {cap.shown.map((n, i) => (
        <div key={n.m.id + (n.staff ? 's' : 'f') + i} style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '10px 16px', backgroundColor: '#FFFFFF', ...rowLine(false) }}>
          <span style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '2px 8px', fontSize: 15, fontWeight: 500 }}>
            {memberName(n.m)}
            {n.staff ? <StaffOnlyTag /> : null}
            <PendingMark row={n.log} />
          </span>
          <q style={{ margin: 0, paddingLeft: 10, borderLeft: '2px solid #DCCFC0', fontSize: 14, lineHeight: '21px', color: '#4A4038', overflowWrap: 'anywhere', quotes: 'none' }}>{n.text}</q>
        </div>
      ))}
      <MoreRow cap={cap} total={m.notes.length} t={t} />
    </Group>
  );
}

// ---------- duties ----------
function Duties({ r }: { r: DayReport }) {
  const t = useT();
  const go = useNavigate();
  if (!r.duties.length) return null;
  const link = (
    <button type="button" onClick={() => go('/tasks?view=team')} className="h-ink"
      style={{ border: 'none', background: 'transparent', padding: 0, color: '#75624B', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter', textDecoration: 'underline', textUnderlineOffset: 3 }}>{t('report.teamView')}</button>
  );
  return (
    <Group title={t('report.duties')} meta={link} pad={0} gap={0}>
      {r.duties.map((d, i) => {
        const useDuties = d.total > 0;
        const done = useDuties ? d.done : d.customDone;
        const total = useDuties ? d.total : d.customTotal;
        const late = d.late + d.customOverdue;
        return (
          <Line key={d.role} first={i === 0} onClick={() => go('/tasks?view=team')}>
            <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.3 }}>{t('roles.' + d.role)}</span>
              {d.people.length ? <span style={sub}>{d.people.join(', ')}</span> : null}
            </span>
            {late ? <DotItem color={RUST}>{t('report.lateN', { n: late })}</DotItem> : null}
            <span style={{ fontSize: 15, fontWeight: 500, fontVariantNumeric: 'tabular-nums', color: total && done >= total ? SAGE : '#24201C', flex: 'none' }}>{total ? t('report.score', { done, total }) : '—'}</span>
            <Icon name="chevron_right" size={20} color="#A89C8E" />
          </Line>
        );
      })}
    </Group>
  );
}

// ---------- also this day ----------
function Other({ r }: { r: DayReport }) {
  const t = useT();
  const go = useNavigate();
  const o = r.other;
  const rows: { key: string; text: string; to: string }[] = [
    ...(o.feedback.length ? [{ key: 'fb', text: plural(t, 'report.feedbackN', o.feedback.length), to: '/feedback' }] : []),
    ...(o.enquiries ? [{ key: 'enq', text: plural(t, 'report.enquiriesN', o.enquiries), to: '/enquiries' }] : []),
    ...o.venue.map((b) => ({ key: b.id, text: t('report.venueLine', { org: b.org, from: b.from, to: b.to }), to: '/venue' })),
  ];
  if (!rows.length) return null;
  return (
    <Group title={t('report.other')} pad={0} gap={0}>
      {rows.map((x, i) => (
        <Line key={x.key} first={i === 0} onClick={() => go(x.to)}>
          <span style={{ flex: 1, minWidth: 0, fontSize: 15, lineHeight: '21px', overflowWrap: 'anywhere' }}>{x.text}</span>
          <Icon name="chevron_right" size={20} color="#A89C8E" />
        </Line>
      ))}
    </Group>
  );
}
