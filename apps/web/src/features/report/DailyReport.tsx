// KC round 7: the Daily report (management). One club day in one place, and any earlier day: who came, what was done and eaten, the health checks, how
// everyone was, and how each role did on its duties. A date control (‹ previous open day · date · next open day ›, plus Today) and two views:
// Summary (grouped sections with key numbers) and By member (one row per member who came). Today is live; a closed day, a weekend or an outing says so.
// /report?date=YYYY-MM-DD opens a day, &view=members the By member view.
import { useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ISODate, Photo } from '@cp/shared';
import { dailyReport, firstReportDay, nextReportDay, prevReportDay, reportDateOf } from '@cp/shared/rules/dailyReport';
import { Button, DateField, EmptyState, Icon, Note, PageHead, Segmented } from '../../components/ui';
import { padFor, useDevice } from '../../hooks/useDevice';
import { useNow } from '../../lib/clock';
import { useFmt, useT, type TFn } from '../../lib/i18n';
import { useMe } from '../../lib/me';
import { useClub } from '../../store/replica';
import { PhotoViewer } from '../activity/PhotoViewer';
import { useAtLeast } from '../lobby/useAtLeast';
import { ByMember } from './ByMember';
import { Summary } from './Summary';

type View = 'summary' | 'members';
/** The container width from which the Summary sits in two columns and By member becomes a table. */
const WIDE = 860;
const plural = (t: TFn, key: string, n: number) => t(`${key}_${n === 1 ? 'one' : 'other'}`, { n });

/** ‹ and ›: a round-cornered button that greys out when there is no open day that way. */
function Step({ dir, to, label, onClick }: { dir: 'prev' | 'next'; to: ISODate | null; label: string; onClick: (d: ISODate) => void }) {
  return (
    <button type="button" aria-label={label} title={label} aria-disabled={!to || undefined} onClick={to ? () => onClick(to) : undefined} className={to ? 'h-cream cp-press' : undefined}
      style={{ width: 40, height: 40, flex: 'none', borderRadius: 12, border: '1px solid #E4DACD', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, color: '#24201C', cursor: to ? 'pointer' : 'default', opacity: to ? 1 : 0.4 }}>
      <Icon name={dir === 'prev' ? 'chevron_left' : 'chevron_right'} size={22} />
    </button>
  );
}

export function DailyReport() {
  const t = useT();
  const fmt = useFmt();
  const s = useClub();
  const { role } = useMe();
  const { today, nowMin, now } = useNow();
  const { device, isPhone } = useDevice();
  const [sp, setSp] = useSearchParams();
  const [viewer, setViewer] = useState<{ photos: Photo[]; startId: string } | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const { wide } = useAtLeast(boxRef, WIDE);

  const date = reportDateOf(sp.get('date'), today);
  const view: View = sp.get('view') === 'members' ? 'members' : 'summary';
  const report = useMemo(() => (s ? dailyReport(s, date, today, nowMin) : null), [s, date, today, nowMin]);
  if (!s || !report || role !== 'mgmt') return <div ref={boxRef} />;

  const isToday = date === today;
  const go = (d: ISODate) => setSp((p) => { const n = new URLSearchParams(p); if (d === today) n.delete('date'); else n.set('date', d); return n; }, { replace: true });
  const setView = (v: View) => setSp((p) => { const n = new URLSearchParams(p); if (v === 'summary') n.delete('view'); else n.set('view', v); return n; }, { replace: true });
  const first = firstReportDay(s) ?? undefined;

  const long = fmt.fd(date, isPhone ? { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' } : { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).replace(/,/g, '');
  const c = report.counts;
  const line = [
    t('report.nCame', { n: c.came }),
    c.trials ? plural(t, 'report.nTrial', c.trials) : '',
    c.visits ? plural(t, 'report.nVisit', c.visits) : '',
    plural(t, 'report.nLunch', c.lunches), plural(t, 'report.nCheck', c.checks), plural(t, 'report.nPhoto', c.photos),
  ].filter(Boolean).join(' · ');

  // a closed day, a holiday or an outing says so
  const st = report.status;
  const evTitle = (e?: { title: string; titleId?: string }) => (e ? (fmt.lang === 'id' && e.titleId ? e.titleId : e.title) : '');
  const dayIcon = !st.open ? 'event_busy' : st.outing ? 'directions_bus' : 'event_available';
  const dayNote = !st.open ? (st.reason === 'weekend' ? t('report.closedWeekend') : evTitle(st.event) || t('report.closedDay')) : st.outing ? evTitle(st.outing) : '';

  return (
    <div ref={boxRef} className={isPhone ? 'cp-native' : undefined} style={{ padding: padFor(device), display: 'flex', flexDirection: 'column', gap: isPhone ? 14 : 20 }}>
      <PageHead size={40} eyebrow={isToday ? t('report.live', { date: long, t: now }) : long} title={t('report.title')} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Step dir="prev" to={prevReportDay(s, date)} label={t('report.prev')} onClick={go} />
        <div style={{ flex: '1 1 150px', minWidth: 0, maxWidth: 260 }}>
          <DateField value={date} onChange={(v) => v && go(v)} max={today} min={first} clearable={false} ariaLabel={t('report.date')} compact />
        </div>
        <Step dir="next" to={nextReportDay(s, date, today)} label={t('report.next')} onClick={go} />
        {!isToday ? <Button variant="secondary" size={44} onClick={() => go(today)}>{t('report.today')}</Button> : null}
      </div>
      {!report.empty ? <p data-testid="report-line" style={{ margin: 0, fontSize: 15, lineHeight: '22px', color: '#4A4038', fontVariantNumeric: 'tabular-nums' }}>{line}</p> : null}
      {dayNote && !report.empty ? <Note tone="cream" icon={dayIcon}>{dayNote}</Note> : null}
      {report.empty ? (
        <EmptyState icon={dayIcon} title={dayNote || t(isToday ? 'report.emptyToday' : 'report.emptyDay')} />
      ) : (
        <>
          <Segmented<View> label={t('report.tabs')} value={view} onChange={setView}
            items={[{ value: 'summary', label: t('report.tabSummary') }, { value: 'members', label: t('report.tabMembers'), count: report.members.length }]} />
          {view === 'summary' ? <Summary r={report} wide={wide} openPhotos={(photos, startId) => setViewer({ photos, startId })} /> : <ByMember r={report} wide={wide} />}
        </>
      )}
      {viewer ? <PhotoViewer photos={viewer.photos} startId={viewer.startId} onClose={() => setViewer(null)} audience="staff" /> : null}
    </div>
  );
}
