// Round 21: one contact on a sheet (tap a row in Contacts): the phone, the person to ask for, the address with its pin, a venue's pictures
// (staff only, tap for full size) and the field trips held there. Task 9 adds the ratings here.
import { Suspense, lazy, useState, type ReactNode } from 'react';
import { areaLine, fmtPhone, type DirectoryContact } from '@cp/shared';
import { tripsAt } from '@cp/shared/rules/directory';
import { Button, FONT_SMALL, HAIRLINE, Icon, Sheet } from '../../components/ui';
import { mediaUrl } from '../../lib/media';
import { useFmt, useT } from '../../lib/i18n';
import { useClub } from '../../store/replica';

const MapView = lazy(() => import('../../components/geo/MapView').then((m) => ({ default: m.MapView })));
const telOf = (p: string) => 'tel:' + p.replace(/[^\d+]/g, '');

function Line({ icon, children }: { icon: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 0', borderTop: HAIRLINE, fontSize: 15, lineHeight: 1.4, color: '#24201C' }}>
      <Icon name={icon} size={19} color="#6B6259" style={{ flex: 'none', marginTop: 1 }} />
      <span style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{children}</span>
    </div>
  );
}

/** The pictures of a venue as a row of tiles; a tap opens one full size. */
export function VenuePics({ ids, onOpen, onRemove, removeLabel }: { ids: string[]; onOpen?: (id: string) => void; onRemove?: (id: string) => void; removeLabel?: string }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {ids.map((id) => (
        <span key={id} style={{ position: 'relative', width: 76, height: 76, flex: 'none' }}>
          <button type="button" data-testid="venue-pic" onClick={() => onOpen?.(id)} aria-label={id}
            style={{ width: 76, height: 76, borderRadius: 12, border: 'none', padding: 0, cursor: onOpen ? 'zoom-in' : 'default', background: `center / cover no-repeat url("${mediaUrl(id)}"), #EEECE8` }} />
          {onRemove ? (
            <button type="button" aria-label={removeLabel} onClick={() => onRemove(id)}
              style={{ position: 'absolute', top: -6, right: -6, width: 24, height: 24, borderRadius: 999, border: '2px solid #fff', background: '#24201C', color: '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer', padding: 0 }}>
              <Icon name="close" size={14} color="#fff" />
            </button>
          ) : null}
        </span>
      ))}
    </div>
  );
}

export function ContactSheet({ contact, onClose, onEdit, extra }: { contact: DirectoryContact | null; onClose: () => void; onEdit?: () => void; /** Task 9: the ratings */ extra?: ReactNode }) {
  const t = useT();
  const s = useClub();
  const { lang, fd } = useFmt();
  const [big, setBig] = useState<string | null>(null);
  if (!contact) return null;
  const c = s.directory[contact.id] ?? contact;
  const venue = c.kind === 'venue';
  const what = lang === 'id' && c.whatId ? c.whatId : c.what;
  const trips = venue ? tripsAt(s, c.id) : [];
  const club = s.club.settings.location;
  return (
    <>
      <Sheet open onClose={onClose} title={c.name} footer={onEdit ? <Button full variant="secondary" icon="edit" onClick={onEdit}>{t('common.edit')}</Button> : undefined}>
        <div data-contact-sheet={c.id} style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: FONT_SMALL, color: '#6B6259', paddingBottom: 8 }}>{t('finance.kind.' + c.kind)}{what ? ` · ${what}` : ''}</div>
          <Line icon="call"><a href={telOf(c.phone)} style={{ color: 'inherit', fontVariantNumeric: 'tabular-nums' }}>{fmtPhone(c.phone)}</a></Line>
          {c.contactPerson ? <Line icon="person">{c.contactPerson}</Line> : null}
          {c.address ? <Line icon="location_on">{c.address}{areaLine(c.location) ? <span style={{ display: 'block', fontSize: FONT_SMALL, color: '#6B6259' }}>{areaLine(c.location)}</span> : null}</Line> : null}
          {c.location ? (
            <div style={{ padding: '4px 0 10px' }}>
              <Suspense fallback={<div style={{ height: 160, borderRadius: 12, background: '#EEECE8' }} />}>
                <MapView center={c.location} height={160} zoom={14} label={t('geo.mapLabel')}
                  markers={[{ id: 'pin', lat: c.location.lat, lng: c.location.lng, kind: 'pin' }, ...(club ? [{ id: 'club', lat: club.lat, lng: club.lng, kind: 'club' as const, label: t('geo.clubPin') }] : [])]} />
              </Suspense>
            </div>
          ) : null}
          {venue && c.photoMediaIds?.length ? (
            <div style={{ padding: '10px 0', borderTop: HAIRLINE, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#6B6259' }}>{t('finance.dir.pics')}</span>
              <VenuePics ids={c.photoMediaIds} onOpen={setBig} />
            </div>
          ) : null}
          {venue ? (
            <div style={{ padding: '10px 0', borderTop: HAIRLINE, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#6B6259' }}>{t('finance.dir.tripsHere')}</span>
              {trips.length ? trips.map((e) => (
                <div key={e.id} data-trip={e.id} style={{ display: 'flex', gap: 10, fontSize: 15, lineHeight: 1.4 }}>
                  <span style={{ color: '#6B6259', fontVariantNumeric: 'tabular-nums', flex: 'none', minWidth: 88 }}>{fd(e.date, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>{lang === 'id' && e.titleId ? e.titleId : e.title}</span>
                </div>
              )) : <span style={{ fontSize: 14, color: '#6B6259' }}>{t('finance.dir.noTrips')}</span>}
            </div>
          ) : null}
          {extra}
        </div>
      </Sheet>
      {big ? (
        <Sheet open onClose={() => setBig(null)} title={c.name} maxWidth={900}>
          <img src={mediaUrl(big)} alt={c.name} style={{ width: '100%', height: 'auto', borderRadius: 12, display: 'block' }} />
        </Sheet>
      ) : null}
    </>
  );
}
