// Round 21: the field trip's venue. A searchable list of the venues in Contacts (trading name and area), and "+ New venue", which opens the
// Contacts form on Field trip venue and picks the new one when it is saved.
import { useState } from 'react';
import { areaLine, live, sortBy } from '@cp/shared';
import { Select } from '../../components/ui';
import { useT } from '../../lib/i18n';
import { useClub } from '../../store/replica';
import { ContactForm } from '../finance/Directory';

const NEW = '__new';

export function VenuePicker({ value, onChange, error }: { value: string; onChange: (id: string) => void; error?: string | false }) {
  const t = useT();
  const s = useClub();
  const [adding, setAdding] = useState(false);
  const venues = sortBy(live(s.directory).filter((d) => d.kind === 'venue'), (d) => d.name.toLowerCase());
  const options = [
    ...venues.map((v) => ({ value: v.id, label: [v.name, areaLine(v.location)].filter(Boolean).join(' · ') })),
    { value: NEW, label: t('cal.newVenue') },
  ];
  return (
    <>
      <Select label={t('cal.venue')} value={value} placeholder={t('cal.pickVenue')} searchable options={options} error={error || undefined}
        onChange={(v) => { if (v === NEW) setAdding(true); else onChange(v); }} />
      <ContactForm value={adding ? 'new' : null} onClose={() => setAdding(false)} initialKind="venue" onSaved={onChange} />
    </>
  );
}
