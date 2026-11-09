// Round 21: the address with its map pin. Search runs on Enter or the Search button only (Nominatim forbids type-ahead); picking a place
// moves the pin; tapping the map or dragging the pin sets it and fills the empty area fields from a reverse lookup. Kelurahan and kecamatan
// can be typed over (suggestions from names already used). The address text saves even when the search is down.
import { Suspense, lazy, useId, useRef, useState } from 'react';
import { distanceKm, type GeoHit, type GeoPoint } from '@cp/shared';
import { Button, FONT_SMALL, TextField } from '../ui';
import { useT } from '../../lib/i18n';
import { reversePlace, searchPlaces } from '../../lib/geo';
import { useDevice } from '../../hooks/useDevice';

const MapView = lazy(() => import('./MapView').then((m) => ({ default: m.MapView })));
/** Where the map opens when there is no pin and no club pin: Citra Garden, Kalideres. */
const FALLBACK = { lat: -6.136, lng: 106.731 };

export interface LocationValue { address: string; location?: GeoPoint }
export function LocationPicker({ address, location, onChange, club, areaSuggestions, label }: {
  address: string;
  location: GeoPoint | undefined;
  onChange: (v: LocationValue) => void;
  club: GeoPoint | undefined;
  areaSuggestions: { kelurahan: string[]; kecamatan: string[] };
  label?: string;
}) {
  const t = useT();
  const { isPhone } = useDevice();
  const id = useId();
  const [hits, setHits] = useState<GeoHit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  // the newest props, for answers that come back after the user typed on
  const now = useRef({ address, location });
  now.current = { address, location };
  const emit = (v: LocationValue) => { now.current = { address: v.address, location: v.location }; onChange(v); };

  const search = async () => {
    const q = now.current.address.trim();
    if (q.length < 3) { setErr(t('geo.err.invalid')); return; }
    setBusy(true); setErr('');
    try {
      const r = await searchPlaces(q);
      setHits(r);
    } catch (e) {
      setHits(null);
      const code = (e as { code?: string }).code;
      setErr(t(code === 'geo.err.busy' ? 'geo.err.busy' : 'geo.err.unavailable'));
    } finally { setBusy(false); }
  };
  const pick = (h: GeoHit) => {
    setHits(null);
    emit({ address: now.current.address, location: { lat: h.lat, lng: h.lng, ...(h.kelurahan ? { kelurahan: h.kelurahan } : {}), ...(h.kecamatan ? { kecamatan: h.kecamatan } : {}), ...(h.city ? { city: h.city } : {}) } });
  };
  const pin = async (p: { lat: number; lng: number }) => {
    const prev = now.current.location;
    const at: GeoPoint = { ...prev, lat: Math.round(p.lat * 1e6) / 1e6, lng: Math.round(p.lng * 1e6) / 1e6 };
    emit({ address: now.current.address, location: at });
    try {
      const h = await reversePlace(at.lat, at.lng);
      const cur = now.current.location;
      if (!h || !cur || cur.lat !== at.lat || cur.lng !== at.lng) return; // moved again meanwhile
      emit({ address: now.current.address, location: { ...cur, kelurahan: cur.kelurahan || h.kelurahan, kecamatan: cur.kecamatan || h.kecamatan, city: cur.city || h.city } });
    } catch { /* the pin stays; the area can be typed */ }
  };
  const setArea = (k: 'kelurahan' | 'kecamatan', v: string) => {
    const cur = now.current.location;
    if (!cur) return;
    const next = { ...cur };
    if (v.trim()) next[k] = v.slice(0, 60); else delete next[k];
    emit({ address: now.current.address, location: next });
  };

  const center = location ?? club ?? FALLBACK;
  const markers = [
    ...(club ? [{ id: 'club', lat: club.lat, lng: club.lng, kind: 'club' as const, label: t('geo.clubPin') }] : []),
    ...(location ? [{ id: 'pin', lat: location.lat, lng: location.lng, kind: 'pin' as const }] : []),
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <TextField name="address" label={label ?? t('geo.address')} value={address} onChange={(v) => emit({ address: v, location: now.current.location })} onEnter={search} maxLength={200} />
        </div>
        <Button variant="secondary" size={56} onClick={search} disabled={busy} label={t('geo.search')}>{busy ? t('geo.searching') : t('geo.search')}</Button>
      </div>
      {err ? <div role="status" style={{ fontSize: FONT_SMALL, color: '#9A3D24' }}>{err}</div> : null}
      {hits ? (
        hits.length ? (
          <div role="list" aria-label={t('geo.pickHit')} style={{ display: 'flex', flexDirection: 'column', borderRadius: 12, background: '#F4F3F1', overflow: 'hidden' }}>
            {hits.map((h, i) => (
              <button key={`${h.lat},${h.lng},${i}`} type="button" role="listitem" data-testid="geo-hit" onClick={() => pick(h)} className="cp-row-btn"
                style={{ textAlign: 'left', padding: '10px 14px', border: 'none', borderTop: i ? '0.5px solid #E2E2E6' : 'none', background: 'transparent', fontSize: 14, lineHeight: 1.35, cursor: 'pointer', color: '#24201C' }}>
                {h.label}
              </button>
            ))}
          </div>
        ) : <div style={{ fontSize: FONT_SMALL, color: '#5E5852' }}>{t('geo.noHits')}</div>
      ) : null}
      <Suspense fallback={<div style={{ height: isPhone ? 220 : 260, borderRadius: 12, background: '#EEECE8' }} />}>
        <MapView center={center} markers={markers} height={isPhone ? 220 : 260} onPin={pin} draggable label={t('geo.mapLabel')} zoom={location ? 15 : 13} />
      </Suspense>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: FONT_SMALL, color: '#5E5852' }}>
        <span data-testid="geo-km">{location ? (club ? t('geo.kmFromClub', { km: distanceKm(club, location) }) : t('geo.pinHint')) : t('geo.noPin')}</span>
        {location ? <button type="button" onClick={() => emit({ address: now.current.address, location: undefined })} style={{ border: 'none', background: 'none', padding: 0, color: '#5E5852', textDecoration: 'underline', cursor: 'pointer', fontSize: 'inherit' }}>{t('geo.clearPin')}</button> : null}
      </div>
      {location ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 8 }}>
          <TextField label={t('geo.kelurahan')} value={location.kelurahan ?? ''} onChange={(v) => setArea('kelurahan', v)} list={`${id}-kel`} maxLength={60} />
          <TextField label={t('geo.kecamatan')} value={location.kecamatan ?? ''} onChange={(v) => setArea('kecamatan', v)} list={`${id}-kec`} maxLength={60} />
          <datalist id={`${id}-kel`}>{areaSuggestions.kelurahan.map((x) => <option key={x} value={x} />)}</datalist>
          <datalist id={`${id}-kec`}>{areaSuggestions.kecamatan.map((x) => <option key={x} value={x} />)}</datalist>
        </div>
      ) : null}
    </div>
  );
}
