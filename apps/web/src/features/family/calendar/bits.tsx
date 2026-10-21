// Family Calendar bits shared by the List and Month views: the round ‹ › step buttons and "A, B or C" name lists.
import type { Lang } from '@cp/shared';
import { Icon } from '../../../components/ui';
import { F } from '../kit';

/** The mark of the selected day in the Calendar (a month cell, a week tile or row): a 2px white gap, then a 2.5px ink ring, so the day keeps its own look underneath. */
export const SELECT_RING = `0 0 0 2px #FFFFFF, 0 0 0 4.5px ${F.ink}`;

/** A round ‹ or › button (34px, soft grey); faded and inert at the end of the range. */
export function Step({ dir, label, onClick, disabled, testId, bg = F.fill }: { dir: 'prev' | 'next'; label: string; onClick: () => void; disabled?: boolean; testId?: string; bg?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} data-testid={testId} className="cp-press"
      style={{ width: 36, height: 36, borderRadius: 999, border: 'none', background: bg, color: F.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, flex: 'none', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.35 : 1 }}>
      <Icon name={dir === 'prev' ? 'chevron_left' : 'chevron_right'} size={24} color={F.ink} />
    </button>
  );
}

/** "Oma Lina", "Oma Lina and Opa Budi" / "Oma Lina or Opa Budi" in the language. */
export function nameList(lang: Lang, names: string[], type: 'conjunction' | 'disjunction' = 'conjunction'): string {
  return new Intl.ListFormat(lang === 'id' ? 'id' : 'en', { style: 'long', type }).format(names);
}
