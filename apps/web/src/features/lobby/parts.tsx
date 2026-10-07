// Small pieces shared by the lobby and messages screens: member avatar, care flags, reading badge, call link, labels.
import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { BADGE, initials, memberName, type DrugAllergy, type Member, type Reading } from '@cp/shared';
import { FONT_BODY, FONT_SMALL, Icon, TONES } from '../../components/ui';
import type { TFn } from '../../lib/i18n';
import { memberPhoto, photoFill } from '../../lib/media';

/** One non-shrinking column for the children of a Sheet / Drawer / Dialog: the overlay scrolls instead of squashing its content. */
export const Stack = ({ gap, children }: { gap: number; children: ReactNode }) => <div style={{ display: 'flex', flexDirection: 'column', gap, flex: 'none' }}>{children}</div>;

/** Single-line text field with the design's input look. (The shared TextField primitive squashes a plain input to 22px tall
 *  inside a column layout because of its `flex: 1`; this keeps the 52px height until that is fixed there.) */
export function Field({ label, value, onChange, hint, autoFocus, inputMode, maxLength, placeholder }: { label?: ReactNode; value: string; onChange: (v: string) => void; hint?: ReactNode; autoFocus?: boolean; inputMode?: 'text' | 'search' | 'tel'; maxLength?: number; placeholder?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  // Sheets and dialogs focus their first button when they open; focus the field a moment later so people can type at once.
  useEffect(() => {
    if (!autoFocus) return;
    const id = setTimeout(() => ref.current?.focus({ preventScroll: true }), 60);
    return () => clearTimeout(id);
  }, [autoFocus]);
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      {label ? <span style={{ fontSize: FONT_BODY, fontWeight: 500, lineHeight: 1.4 }}>{label}</span> : null}
      <input ref={ref} value={value} onChange={(e) => onChange(e.target.value)} inputMode={inputMode} maxLength={maxLength} placeholder={placeholder}
        style={{ height: 52, flex: 'none', border: '1px solid #DDD1C2', borderRadius: 12, background: '#FFFFFF', padding: '0 14px', fontSize: 16, fontFamily: 'Inter', color: '#24201C', outline: 'none', width: '100%', minWidth: 0 }} />
      {hint ? <span style={{ fontSize: FONT_BODY, color: '#5E5852', lineHeight: 1.4 }}>{hint}</span> : null}
    </label>
  );
}

export const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
/** Relationship label ("daughter"); an unknown value reads as "family" instead of showing a raw key. */
export const relText = (t: TFn, rel: string | undefined) => { const k = 'lobby.rel.' + rel; const v = t(k); return v === k ? t('lobby.rel.other') : v; };

/** The club's opening-hours label ("Mon–Fri 08:30–16:30"), with the day names in the viewer's language. */
const DAYS_ID: Record<string, string> = { Mon: 'Sen', Tue: 'Sel', Wed: 'Rab', Thu: 'Kam', Fri: 'Jum', Sat: 'Sab', Sun: 'Min' };
export const localHours = (label: string, lang: string) => (lang === 'id' ? label.replace(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/g, (d) => DAYS_ID[d]) : label);

// ---------- avatar ----------
export function MemberAvatar({ m, size, font, ring }: { m: Pick<Member, 'photoTone' | 'title' | 'firstName' | 'lastName' | 'photoMediaId'>; size: number; font: number; ring?: string }) {
  const [bg, fg] = TONES[(m.photoTone || 0) % 5];
  const photo = memberPhoto(m);
  return (
    <div aria-hidden="true" style={{ width: size, height: size, borderRadius: 999, background: photoFill(photo, bg), color: fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: font, fontWeight: 500, flex: 'none', ...(ring ? { boxShadow: `0 0 0 4px ${ring}` } : {}) }}>
      {photo ? null : initials(memberName(m))}
    </div>
  );
}

// ---------- care flags (allergies, mobility, diet; with `full`: diabetes, drug allergies and lunchtime medicines) ----------
export interface Flag { icon: string; label: string; bg: string; ic: string }
const MOBILITY_ICON = { walkingStick: 'elderly', walker: 'assist_walker', wheelchair: 'accessible' } as const;
export const drugLabel = (t: TFn, d: DrugAllergy) => (d.startsWith('other:') ? d.slice(6) : t('lobby.drug.' + d));
/** `food` = false leaves out food allergies and diets (the Arrivals list rows: the kitchen has them). */
export function memberFlags(t: TFn, m: Member, full = false, food = true): Flag[] {
  const rust = { bg: '#F9E3DB', ic: '#9A3D24' };
  const linen = { bg: '#F3EEE8', ic: '#24201C' };
  const out: Flag[] = food ? m.health.food.map((a) => ({ icon: 'no_food', label: t('lobby.food.' + a), ...rust })) : [];
  if (food && m.health.foodOther) out.push({ icon: 'no_food', label: m.health.foodOther, ...rust });
  if (m.health.mobility) out.push({ icon: MOBILITY_ICON[m.health.mobility], label: t('lobby.mobility.' + m.health.mobility), ...linen });
  if (food) for (const d of m.health.diet) out.push({ icon: 'restaurant', label: t('lobby.diet.' + d), ...linen });
  if (full) {
    if (m.health.diabetic) out.push({ icon: 'water_drop', label: t('lobby.diabetic'), ...linen });
    for (const d of m.health.drugs) out.push({ icon: 'medication', label: t('lobby.drugAllergy', { d: drugLabel(t, d) }), ...rust });
    for (const x of m.health.meds.filter((x) => x.timing === 'lunchClub')) out.push({ icon: 'medication', label: t('lobby.medLunch', { name: x.name, dose: x.dose }), ...linen });
  }
  return out;
}
/** The safety-critical allergies (food and drug) of a member as one line ("Shellfish allergy, Penicillin allergy"), or '' when none.
 *  This is the only care tag a list row shows (v3 quiet rows); the member drawer lists every tag. */
export function allergyLine(t: TFn, m: Member): string {
  const parts = [
    ...m.health.food.map((a) => t('lobby.drugAllergy', { d: t('lobby.food.' + a) })),
    ...(m.health.foodOther ? [t('lobby.drugAllergy', { d: m.health.foodOther })] : []),
    ...m.health.drugs.map((d) => t('lobby.drugAllergy', { d: drugLabel(t, d) })),
  ];
  return parts.join(', ');
}
/** v3 inline status item: a 6px dot plus 14px/500 text (rust allergy, sage / ochre status). */
export function DotItem({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span style={{ color, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: 999, background: color, flex: 'none' }} />
      {children}
    </span>
  );
}
/** `card` = the design's 32px chip (camera card, drawer); `row` = the 28px chip inside list rows. */
export function FlagChip({ f, size = 'card' }: { f: Flag; size?: 'card' | 'row' }) {
  const row = size === 'row';
  return (
    <span style={{ minHeight: row ? 28 : 32, padding: row ? '4px 10px' : '5px 12px', borderRadius: 10, background: f.bg, color: '#24201C', fontSize: row ? FONT_SMALL : FONT_BODY, lineHeight: 1.3, display: 'inline-flex', alignItems: 'center', gap: row ? 4 : 6, maxWidth: '100%', boxSizing: 'border-box' }}>
      <Icon name={f.icon} size={row ? 16 : 18} color={f.ic} />
      {f.label}
    </span>
  );
}

/** The drawer's reading badge: "Normal · 122/73" (30px, as in the design). */
export function ReadingBadge({ t, r }: { t: TFn; r: Reading }) {
  const b = BADGE[r.status];
  return (
    <span style={{ alignSelf: 'flex-start', marginTop: 4, height: 30, padding: '0 12px 0 8px', borderRadius: 8, background: b[2], color: b[1], fontSize: FONT_BODY, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <Icon name={b[0]} size={18} fill={1} />
      {r.sys != null ? `${t('status.' + r.status)} · ${r.sys}/${r.dia}` : t('status.' + r.status)}
    </span>
  );
}

const callStyle: CSSProperties = { width: 44, height: 44, borderRadius: 999, border: '1px solid #E4DACD', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#75624B', textDecoration: 'none', flex: 'none', background: '#FFFFFF' };
/** A real tel: link (44px round button) for any phone number we show. */
export function CallLink({ t, name, phone }: { t: TFn; name: string; phone: string }) {
  return (
    <a href={`tel:${phone}`} aria-label={t('lobby.callAria', { name })} className="h-cream" style={callStyle}>
      <Icon name="call" size={20} />
    </a>
  );
}
