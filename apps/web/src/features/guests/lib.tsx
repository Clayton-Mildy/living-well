// Small pieces shared by the Guests screens: row layout, status dot, the money field.
import { type CSSProperties, type ReactNode } from 'react';
import { fmtN, parseN, type GuestHostKind, type GuestSession } from '@cp/shared';
import { GUEST_KIND_ICON, payStateOf, type GuestIssue } from '@cp/shared/rules/guests';
import type { ClubState } from '@cp/shared';
import { Icon, TextField } from '../../components/ui';
import type { TFn } from '../../lib/i18n';
import { rowLine } from '../activity/lib';

export const kindLabel = (t: TFn, k: GuestHostKind) => t('guests.k_' + k);
export const kindIcon = (k: GuestHostKind) => GUEST_KIND_ICON[k];

/** A round tile with the host's kind icon. */
export const KindTile = ({ kind, size = 36 }: { kind: GuestHostKind; size?: number }) => (
  <span aria-hidden="true" style={{ width: size, height: size, borderRadius: 999, background: '#F3EEE8', color: '#6E5A43', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><Icon name={kindIcon(kind)} size={Math.round(size * 0.53)} weight={300} /></span>
);

/** Row style of the grouped lists: hairline from the text, comfortable tap height; wide screens get more air. */
export const rowStyle = (first: boolean, phone: boolean): CSSProperties => ({
  width: '100%', display: 'flex', alignItems: 'center', gap: phone ? 12 : 16, padding: phone ? '8px 12px 8px 16px' : '12px 22px', minHeight: phone ? 58 : 68, border: 'none',
  backgroundColor: '#FFFFFF', textAlign: 'left', color: '#24201C', fontFamily: 'Inter', cursor: 'pointer',
  ...(phone ? rowLine(first, 64) : first ? {} : { borderTop: '1px solid #F0EAE1' }),
});

/** The state of a session for its row: booked ones show nothing (the group says it), the others a dot and the word. */
export function stateOf(s: ClubState, g: GuestSession, t: TFn): { color: string; text: string } | null {
  if (g.status === 'cancelled') return { color: '#8A8078', text: t('guests.st_cancelled') };
  const pay = payStateOf(s, g);
  if (pay === 'paid') return { color: '#3D6B4F', text: t('guests.st_paid') };
  if (pay === 'toPay') return { color: '#7A5510', text: t('guests.st_toPay') };
  return null;
}

export const issueText = (t: TFn, i: GuestIssue) => t('guests.issue_' + i);

/** Whole-rupiah field with the "Rp" block in front; `value` holds digits only. */
export function MoneyField({ label, value, onChange, error }: { label: ReactNode; value: string; onChange: (digits: string) => void; error?: string | false }) {
  return <TextField label={label} value={fmtN(value)} onChange={(v) => onChange(String(parseN(v) || ''))} inputMode="numeric" prefix="Rp" error={error} />;
}
