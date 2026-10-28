// Small pieces the family Health tab, Health history and a parent's profile share: a member's face, the member in the URL, the status colours.
import { useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { initials, memberName, type Health, type Member } from '@cp/shared';
import { familyMembers } from '@cp/shared/rules/family';
import { PictureOpen, TONES } from '../../../components/ui';
import { memberPhoto, photoFill } from '../../../lib/media';
import { useDevice } from '../../../hooks/useDevice';
import { Chips, F } from '../kit';
import { useFamilyCtx } from '../useFamily';

/** A round picture of a member: the profile photo, or their initials on the soft tone (a ring around it for the profile header). */
export function MemberFace({ m, size, ring }: { m: Pick<Member, 'photoTone' | 'photoMediaId' | 'title' | 'firstName' | 'lastName'>; size: number; ring?: boolean }) {
  const [bg, fg] = TONES[(m.photoTone || 0) % 5];
  const photo = memberPhoto(m);
  return (
    <PictureOpen src={photo} name={memberName(m)}>
    <span aria-hidden="true" style={{ width: size, height: size, borderRadius: 999, background: photoFill(photo, bg), color: fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.round(size * 0.36), fontWeight: 500, flex: 'none', boxShadow: ring ? `0 0 0 3px #FFFFFF, 0 0 0 4px ${F.hair}` : undefined }}>
      {photo ? null : initials(m)}
    </span>
    </PictureOpen>
  );
}

/**
 * The member a pushed page is about: `?member=<id>` when it is one of the family's, else their first parent. Unlike the tabs' switcher this
 * leaves the URL alone, so a reload or the back button keeps the page on the same parent.
 */
export function useParamMember() {
  const ctx = useFamilyCtx();
  const { s, user, now } = ctx;
  const [sp, setSp] = useSearchParams();
  const fm = useMemo(() => (user ? familyMembers(s, user.id, now.today) : { all: [] as string[], choices: [] as string[] }), [s, user, now.today]);
  const param = sp.get('member');
  const id = param && fm.all.includes(param) ? param : fm.choices[0] || '';
  return { ...ctx, id, m: id ? s.members[id] : undefined, sp, setSp };
}

/** How a grade reads on a tinted card (the big blood pressure card) and in a list (a dot and a word). */
export const PALETTE: Record<Health, { bg: string; fg: string; ink: string; bar: string; icon: string; dot: string }> = {
  normal: { bg: F.sageBg, fg: F.sage, ink: '#1F3D2B', bar: '#8FB39C', icon: 'check_circle', dot: F.sage },
  watch: { bg: F.ochreBg, fg: F.ochre, ink: '#4A3208', bar: '#D9B97A', icon: 'visibility', dot: F.ochre },
  alert: { bg: F.rustBg, fg: F.rust, ink: '#5E2412', bar: '#D99A86', icon: 'warning', dot: F.rust },
};

/**
 * The kit's pill chips on a phone (a row that scrolls sideways, with the chosen chip scrolled into view); wrapped onto two lines on a wider screen, where a
 * mouse has no sideways scroll and the centred column is narrower than the chips.
 */
export function ChipRow<V extends string>({ items, value, onChange, label, testId }: { items: { value: V; label: string }[]; value: V; onChange: (v: V) => void; label: string; testId?: string }) {
  const { isPhone } = useDevice();
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isPhone) return;
    const row = wrap.current?.firstElementChild as HTMLElement | null;
    const btn = row?.querySelector<HTMLElement>(`[data-value="${value}"]`);
    if (row && btn) row.scrollTo({ left: Math.max(0, btn.offsetLeft - (row.clientWidth - btn.offsetWidth) / 2), behavior: 'smooth' });
  }, [value, isPhone]);
  if (isPhone) return <div ref={wrap}><Chips<V> items={items} value={value} onChange={onChange} label={label} testId={testId} /></div>;
  return (
    <div role="group" aria-label={label} data-testid={testId} style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {items.map((c) => {
        const on = c.value === value;
        return (
          <button key={c.value} type="button" aria-pressed={on} onClick={() => onChange(c.value)} data-value={c.value} className="cp-press"
            style={{ height: 34, padding: '0 13px', border: 'none', borderRadius: 999, background: on ? F.ink : F.fill, color: on ? '#FFFFFF' : F.text, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', whiteSpace: 'nowrap' }}>
            {c.label}
          </button>
        );
      })}
    </div>
  );
}

