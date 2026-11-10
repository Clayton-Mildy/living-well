// Round 21: Admin › Settings › Pick-up. The club's pin (applies at once), the monthly pick-up price per km and the free distance (Management's
// change waits for the Owner, like the other prices). A member's pick-up is ceil(km) × the price, nothing within the free distance.
import { useState } from 'react';
import { fmtN, ownerApprovalOn, parseN, pickupRateOf, type GeoPoint } from '@cp/shared';
import { Button, Group, HAIRLINE, Icon, Sheet, FONT_SMALL } from '../../components/ui';
import { OwnerWaiting } from '../../components/OwnerWaiting';
import { LocationPicker } from '../../components/geo/LocationPicker';
import { areaSuggestions } from '../../lib/geo';
import { useAct } from '../../lib/act';
import { useT } from '../../lib/i18n';
import { useMe } from '../../lib/me';
import { useClub } from '../../store/replica';

const ROW = { display: 'flex', alignItems: 'center', gap: 12, minHeight: 60, padding: '8px 16px', fontSize: 15, lineHeight: 1.4, color: '#24201C' } as const;
const SUB = { fontSize: FONT_SMALL, lineHeight: 1.35, color: '#6B6259' } as const;
const FIELD = { height: 44, border: 'none', borderRadius: 12, background: 'var(--fill, #F4F4F5)', padding: '0 10px', fontSize: 16, fontFamily: 'Inter', color: '#24201C', textAlign: 'right', fontVariantNumeric: 'tabular-nums', flex: 'none' } as const;
const okFree = (v: string) => { const n = Number(v); return v.trim() !== '' && Number.isFinite(n) && n >= 0 && n <= 50 && Number.isInteger(n * 2); };
const okPer = (n: number) => Number.isInteger(n) && n >= 1000 && n <= 1_000_000;

export function PickupSettings() {
  const t = useT();
  const s = useClub();
  const act = useAct();
  const { role, realRole } = useMe();
  const rate = pickupRateOf(s);
  const club = s.club.settings.location;
  const [per, setPer] = useState<string | null>(null);
  const [free, setFree] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [pin, setPin] = useState<{ address: string; location?: GeoPoint }>({ address: '', location: club });

  const perV = per ?? fmtN(rate.perKm);
  const freeV = free ?? String(rate.freeKm);
  const perBad = !okPer(parseN(perV));
  const freeBad = !okFree(freeV);
  const dirty = parseN(perV) !== rate.perKm || Number(freeV) !== rate.freeKm;
  const needsOwner = realRole !== 'owner' && ownerApprovalOn(s, role as 'mgmt', 'pricing');
  const reset = () => { setPer(null); setFree(null); setTried(false); };

  const save = async () => {
    setTried(true);
    if (perBad || freeBad || busy) return;
    setBusy(true);
    try {
      const r = await act('club.updateSettings', { pickupRate: { perKm: parseN(perV), freeKm: Number(freeV) } }, { ok: t('mgmt.settings.saved') });
      if (r.ok) reset();
    } finally { setBusy(false); }
  };
  const savePin = async () => {
    if (!pin.location || busy) return;
    setBusy(true);
    try {
      const r = await act('club.updateSettings', { location: pin.location }, { ok: t('mgmt.settings.saved') });
      if (r.ok) setPinOpen(false);
    } finally { setBusy(false); }
  };
  const area = club ? [club.kelurahan, club.kecamatan].filter(Boolean).join(', ') || `${club.lat.toFixed(4)}, ${club.lng.toFixed(4)}` : t('mgmt.settings.pickupNoPin');

  return (
    <Group title={t('mgmt.settings.pickup')} label={t('mgmt.settings.pickup')} pad={0} gap={0}>
      <button type="button" data-row="clubPin" className="h-row cp-press" onClick={() => { setPin({ address: '', location: club }); setPinOpen(true); }}
        style={{ ...ROW, width: '100%', border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', fontFamily: 'Inter' }}>
        <span style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--track, #E8E8EB)', display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name="location_on" size={18} color="#4A433D" /></span>
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontWeight: 500 }}>{t('mgmt.settings.pickupClub')}</span>
          <span style={SUB}>{area}</span>
        </span>
        <Icon name="chevron_right" size={20} color="#8A8078" />
      </button>
      <div data-setting="perKm" style={{ ...ROW, borderTop: HAIRLINE }}>
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontWeight: 500 }}>{t('mgmt.settings.pickupPerKm')}</span>
          <span style={SUB}>{t('mgmt.settings.pickupPerKmSub')}</span>
        </span>
        <span style={SUB}>Rp</span>
        <input data-field="perKm" aria-label={t('mgmt.settings.pickupPerKm')} aria-invalid={(tried && perBad) || undefined} value={perV} inputMode="numeric" className="cp-input cp-fill"
          onChange={(e) => setPer(e.target.value.replace(/\D/g, '') ? fmtN(parseN(e.target.value)) : '')} style={{ ...FIELD, width: 104, boxShadow: tried && perBad ? 'inset 0 0 0 2px #9A3D24' : undefined }} />
      </div>
      {tried && perBad ? <div role="alert" style={{ padding: '0 16px 10px', fontSize: FONT_SMALL, color: '#9A3D24' }}>{t('mgmt.settings.err.perKm')}</div> : null}
      <div data-setting="freeKm" style={{ ...ROW, borderTop: HAIRLINE }}>
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontWeight: 500 }}>{t('mgmt.settings.pickupFree')}</span>
          <span style={SUB}>{t('mgmt.settings.pickupFreeSub')}</span>
        </span>
        <input data-field="freeKm" aria-label={t('mgmt.settings.pickupFree')} aria-invalid={(tried && freeBad) || undefined} value={freeV} inputMode="decimal" maxLength={4} className="cp-input cp-fill"
          onChange={(e) => setFree(e.target.value.replace(',', '.').replace(/[^\d.]/g, ''))} style={{ ...FIELD, width: 56, boxShadow: tried && freeBad ? 'inset 0 0 0 2px #9A3D24' : undefined }} />
        <span style={SUB}>km</span>
      </div>
      {tried && freeBad ? <div role="alert" style={{ padding: '0 16px 10px', fontSize: FONT_SMALL, color: '#9A3D24' }}>{t('mgmt.settings.err.freeKm')}</div> : null}
      <OwnerWaiting section="pricing" pad="4px 16px" only={(c) => c.action === 'club.updateSettings' && !!(c.input as { pickupRate?: unknown } | undefined)?.pickupRate} />
      {dirty ? (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', padding: '8px 16px 12px', borderTop: HAIRLINE }}>
          <Button variant="secondary" size={48} onClick={reset}>{t('mgmt.settings.cancel')}</Button>
          <Button size={48} disabled={busy} onClick={save}>{needsOwner ? t('mgmt.settings.sendOwner') : t('mgmt.settings.save')}</Button>
        </div>
      ) : null}
      <Sheet open={pinOpen} onClose={() => setPinOpen(false)} title={t('mgmt.settings.pickupClub')}
        footer={<Button full disabled={!pin.location || busy} onClick={savePin}>{t('mgmt.settings.save')}</Button>}>
        <LocationPicker address={pin.address} location={pin.location} onChange={setPin} club={undefined} areaSuggestions={areaSuggestions(s)} />
      </Sheet>
    </Group>
  );
}
