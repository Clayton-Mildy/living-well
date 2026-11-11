// Round 21: the field trip's venue. A searchable list of the venues in Contacts (trading name and area), and "+ New venue", which opens the
// Contacts form on Field trip venue and picks the new one when it is saved. 11 Nov (KC): the picked venue's pictures, address and person to ask
// for show under the list (staff only; a tap opens a picture full size).
import { useState } from 'react';
import { areaLine, live, sortBy } from '@cp/shared';
import { Icon, Select, Sheet } from '../../components/ui';
import { useT } from '../../lib/i18n';
import { mediaUrl } from '../../lib/media';
import { useClub } from '../../store/replica';
import { ContactForm } from '../finance/Directory';
import { VenuePics } from '../finance/ContactSheet';

const NEW = '__new';

export function VenuePicker({ value, onChange, error }: { value: string; onChange: (id: string) => void; error?: string | false }) {
  const t = useT();
  const s = useClub();
  const [adding, setAdding] = useState(false);
  const [big, setBig] = useState<string | null>(null);
  const venues = sortBy(live(s.directory).filter((d) => d.kind === 'venue'), (d) => d.name.toLowerCase());
  const options = [
    ...venues.map((v) => ({ value: v.id, label: [v.name, areaLine(v.location)].filter(Boolean).join(' · ') })),
    { value: NEW, label: t('cal.newVenue') },
  ];
  const v = value ? s.directory[value] : undefined;
  const pics = v?.photoMediaIds ?? [];
  const where = v ? [v.address, v.contactPerson].filter(Boolean) : [];
  return (
    <>
      <Select label={t('cal.venue')} value={value} placeholder={t('cal.pickVenue')} searchable options={options} error={error || undefined}
        onChange={(x) => { if (x === NEW) setAdding(true); else onChange(x); }} />
      {v && (pics.length || where.length) ? (
        <div data-testid="venue-preview" style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: -4 }}>
          {pics.length ? <VenuePics ids={pics} onOpen={setBig} /> : null}
          {where.length ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 12px', fontSize: 13, lineHeight: '19px', color: '#5E5852' }}>
              {v.address ? <span style={{ display: 'inline-flex', gap: 4, alignItems: 'flex-start', minWidth: 0, overflowWrap: 'anywhere' }}><Icon name="location_on" size={16} color="#6B6259" style={{ flex: 'none', marginTop: 1 }} />{v.address}</span> : null}
              {v.contactPerson ? <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><Icon name="person" size={16} color="#6B6259" />{v.contactPerson}</span> : null}
            </div>
          ) : null}
        </div>
      ) : null}
      <ContactForm value={adding ? 'new' : null} onClose={() => setAdding(false)} initialKind="venue" onSaved={onChange} />
      {big && v ? (
        <Sheet open onClose={() => setBig(null)} title={v.name} maxWidth={900}>
          <img src={mediaUrl(big)} alt={v.name} style={{ width: '100%', height: 'auto', borderRadius: 12, display: 'block' }} />
        </Sheet>
      ) : null}
    </>
  );
}
