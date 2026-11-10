// Round 21: Insights › Where from. Who lives where: members active today and the leads made in the period (Who: Members / Enquiries / Both) on a
// map (View: exact pins, or one circle per kelurahan / kecamatan sized by count), with the table under it. Tap an area for its people; people with no
// pin are counted and listed so the front desk can add them.
import { Suspense, lazy, useMemo, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { wherePoints, whereAreas, type WhereArea, type WhereLevel, type WhereMissing, type WherePoint, type WhereWho } from '@cp/shared/rules/whereFrom';
import type { InsightPeriod } from '@cp/shared/rules/insights';
import { FONT_SMALL, HAIRLINE, Pager, Select, Sheet, usePaged } from '../../components/ui';
import { useDevice } from '../../hooks/useDevice';
import { useT } from '../../lib/i18n';
import { useClub } from '../../store/replica';

const MapView = lazy(() => import('../../components/geo/MapView').then((m) => ({ default: m.MapView })));
const FALLBACK = { lat: -6.136, lng: 106.731 };
const WHO: WhereWho[] = ['both', 'members', 'enquiries'];
const VIEW: WhereLevel[] = ['kecamatan', 'kelurahan', 'pins'];
const WHO_KEY: Record<WhereWho, string> = { both: 'insights.whoBoth', members: 'insights.whoMembers', enquiries: 'insights.whoEnquiries' };
const VIEW_KEY: Record<WhereLevel, string> = { pins: 'insights.viewPins', kelurahan: 'insights.viewKel', kecamatan: 'insights.viewKec' };
const linkOf = (p: { kind: 'member' | 'enquiry'; id: string }) => (p.kind === 'member' ? `/members/${p.id}` : `/enquiries?e=${p.id}`);
const cell: CSSProperties = { fontVariantNumeric: 'tabular-nums', textAlign: 'right', flex: 'none', width: 72 };
const head: CSSProperties = { fontSize: 12, fontWeight: 600, letterSpacing: '0.02em', color: '#6B6259' };

export function WhereFrom({ period, today }: { period: InsightPeriod; today: string }) {
  const t = useT();
  const s = useClub();
  const { isPhone } = useDevice();
  const [who, setWho] = useState<WhereWho>('both');
  const [view, setView] = useState<WhereLevel>('kecamatan');
  const [area, setArea] = useState<WhereArea | null>(null);
  const [missingOpen, setMissingOpen] = useState(false);
  const data = useMemo(() => wherePoints(s, who, period, today), [s, who, period, today]);
  const areas = useMemo(() => (view === 'pins' ? [] : whereAreas(data.points, view)), [data, view]);
  const paged = usePaged(data.points, 20, who + view);
  const club = s.club.settings.location;
  const center = club ?? data.points[0] ?? FALLBACK;
  const areaName = (a: { name: string }) => a.name || t('insights.unknownArea');
  const kindLabel = (p: { kind: 'member' | 'enquiry' }) => t(p.kind === 'member' ? 'insights.kindMember' : 'insights.kindEnquiry');
  const clubMarker = club ? [{ id: 'club', lat: club.lat, lng: club.lng, kind: 'club' as const, label: t('geo.clubPin') }] : [];
  const markers = view === 'pins' ? [...data.points.map((p) => ({ id: `${p.kind}:${p.id}`, lat: p.lat, lng: p.lng, kind: p.kind, label: p.name })), ...clubMarker] : clubMarker;
  const circles = areas.map((a) => ({ id: a.key || '_', lat: a.lat, lng: a.lng, count: a.total, label: `${areaName(a)} · ${a.total}`, onClick: () => setArea(a) }));
  const showM = who !== 'enquiries';
  const showE = who !== 'members';

  const personRow = (p: WherePoint | WhereMissing, i: number, detail?: string) => (
    <Link key={`${p.kind}:${p.id}`} to={linkOf(p)} data-person={p.id} className="h-row"
      style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 48, padding: '6px 0', borderTop: i ? HAIRLINE : undefined, color: '#24201C', textDecoration: 'none', fontSize: 15 }}>
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontWeight: 500, overflowWrap: 'anywhere' }}>{p.name}</span>
        <span style={{ fontSize: FONT_SMALL, color: '#6B6259' }}>{[kindLabel(p), detail].filter(Boolean).join(' · ')}</span>
      </span>
      {'km' in p && p.km !== null ? <span style={{ ...cell, width: 'auto', color: '#4A433D' }}>{t('insights.km', { km: p.km })}</span> : null}
    </Link>
  );

  return (
    <div data-testid="where-from" style={{ display: 'flex', flexDirection: 'column', gap: isPhone ? 12 : 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 8, maxWidth: isPhone ? undefined : 460 }}>
        <Select ariaLabel={t('insights.who')} value={who} onChange={setWho} options={WHO.map((k) => ({ value: k, label: t(WHO_KEY[k]) }))} />
        <Select ariaLabel={t('insights.view')} value={view} onChange={setView} options={VIEW.map((k) => ({ value: k, label: t(VIEW_KEY[k]) }))} />
      </div>
      {showE ? <div style={{ fontSize: 13, color: '#6B6259', marginTop: -4 }}>{t('insights.periodEnquiries')}</div> : null}
      <Suspense fallback={<div style={{ height: isPhone ? 240 : 420, borderRadius: 12, background: '#EEECE8' }} />}>
        <MapView center={center} markers={markers} circles={circles} height={isPhone ? 240 : 420} zoom={12} label={t('insights.tabWhere')} />
      </Suspense>
      {data.missing.length ? (
        <button type="button" data-testid="where-missing" onClick={() => setMissingOpen(true)}
          style={{ alignSelf: 'flex-start', border: 'none', background: 'none', padding: 0, color: 'var(--accent, #75624B)', fontSize: 14, fontWeight: 500, textDecoration: 'underline', cursor: 'pointer', fontFamily: 'Inter' }}>
          {t('insights.missing', { n: data.missing.length })}
        </button>
      ) : null}

      <div style={{ background: 'var(--card, #FFFFFF)', borderRadius: 14, padding: isPhone ? '4px 14px' : '8px 18px' }}>
        {view === 'pins' ? (
          <>
            {!isPhone ? (
              <div style={{ display: 'flex', gap: 10, padding: '8px 0', ...head }}>
                <span style={{ flex: 2, minWidth: 0 }}>{t('insights.colName')}</span><span style={{ flex: 1, minWidth: 0 }}>{t('insights.colType')}</span>
                <span style={{ flex: 1.4, minWidth: 0 }}>{t('insights.viewKel')}</span><span style={{ flex: 1.4, minWidth: 0 }}>{t('insights.viewKec')}</span><span style={cell}>{t('insights.colKm')}</span>
              </div>
            ) : null}
            {paged.rows.map((p, i) => (isPhone ? personRow(p, i, [p.kelurahan, p.kecamatan].filter(Boolean).join(', ')) : (
              <Link key={`${p.kind}:${p.id}`} to={linkOf(p)} data-person={p.id} className="h-row" style={{ display: 'flex', gap: 10, alignItems: 'center', minHeight: 44, borderTop: HAIRLINE, color: '#24201C', textDecoration: 'none', fontSize: 14 }}>
                <span style={{ flex: 2, minWidth: 0, fontWeight: 500, overflowWrap: 'anywhere' }}>{p.name}</span><span style={{ flex: 1, minWidth: 0, color: '#6B6259' }}>{kindLabel(p)}</span>
                <span style={{ flex: 1.4, minWidth: 0 }}>{p.kelurahan || '—'}</span><span style={{ flex: 1.4, minWidth: 0 }}>{p.kecamatan || '—'}</span>
                <span style={cell}>{p.km === null ? '—' : t('insights.km', { km: p.km })}</span>
              </Link>
            )))}
            {paged.pages > 1 ? <div style={{ padding: '8px 0' }}><Pager page={paged.page} pages={paged.pages} onPage={paged.setPage} label={t('insights.tabWhere')} /></div> : null}
            {!data.points.length ? <div style={{ padding: '14px 0', color: '#6B6259' }}>{t('insights.whereEmpty')}</div> : null}
          </>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 10, padding: '8px 0', ...head }}>
              <span style={{ flex: 1, minWidth: 0 }}>{t(view === 'kelurahan' ? 'insights.viewKel' : 'insights.viewKec')}</span>
              {showM ? <span style={cell}>{t('insights.colMembers')}</span> : null}
              {showE ? <span style={cell}>{t('insights.colEnquiries')}</span> : null}
            </div>
            {areas.map((a) => (
              <button key={a.key || '_'} type="button" data-area={a.name} onClick={() => setArea(a)} className="h-row"
                style={{ display: 'flex', gap: 10, alignItems: 'center', width: '100%', minHeight: 48, borderTop: HAIRLINE, border: 'none', borderTopStyle: 'solid', background: 'transparent', padding: 0, textAlign: 'left', cursor: 'pointer', fontFamily: 'Inter', fontSize: 15, color: '#24201C' }}>
                <span style={{ flex: 1, minWidth: 0, fontWeight: 500, overflowWrap: 'anywhere' }}>{areaName(a)}</span>
                {showM ? <span data-col="members" style={cell}>{a.members}</span> : null}
                {showE ? <span data-col="enquiries" style={cell}>{a.enquiries}</span> : null}
              </button>
            ))}
            {!areas.length ? <div style={{ padding: '14px 0', color: '#6B6259' }}>{t('insights.whereEmpty')}</div> : null}
          </>
        )}
      </div>

      {area ? (
        <Sheet open onClose={() => setArea(null)} title={`${areaName(area)} · ${area.total}`}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>{area.people.map((p, i) => personRow(p, i))}</div>
        </Sheet>
      ) : null}
      {missingOpen ? (
        <Sheet open onClose={() => setMissingOpen(false)} title={t('insights.missing', { n: data.missing.length })}>
          <div style={{ fontSize: 14, color: '#6B6259', paddingBottom: 6 }}>{t('insights.missingSub')}</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>{data.missing.map((p, i) => personRow(p, i))}</div>
        </Sheet>
      ) : null}
    </div>
  );
}
