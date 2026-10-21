// The title of a senior: Oma, Opa, Ibu or Bapak, or "Other" with a short free text (e.g. Tante). Shared by Add member / Join (Person step),
// New lead and the family's online form, so every path writes the same title.
import { useState } from 'react';
import { TITLES, TITLE_MAX } from '@cp/shared/rules/members';
import { ChipGroup } from '../../../components/ui';
import { useT } from '../../../lib/i18n';
import { TextField } from './forms';

const OTHER = '__other';

export function TitleField({ value, onChange, error }: { value: string; onChange: (v: string) => void; error?: string }) {
  const t = useT();
  const isPreset = (TITLES as string[]).includes(value);
  // Stays on Other while its text is typed (even if the text happens to equal a preset), and opens on Other for a title that is not a preset.
  const [tapped, setTapped] = useState(false);
  const other = tapped || !isPreset;
  return (
    <>
      <ChipGroup
        label={t('profile.f.title')}
        value={other ? OTHER : value}
        onChange={(v) => {
          if (v === OTHER) { setTapped(true); if (isPreset) onChange(''); return; }
          setTapped(false);
          onChange(v as string);
        }}
        options={[...TITLES.map((x) => ({ value: x as string, label: x as string })), { value: OTHER, label: t('profile.f.titleOther') }]}
      />
      {other ? <TextField value={value} onChange={onChange} maxLength={TITLE_MAX} placeholder={t('profile.f.titleOtherHint')} error={error} autoFocus={tapped} name="title" /> : null}
    </>
  );
}
