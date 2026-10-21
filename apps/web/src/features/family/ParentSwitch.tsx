// Round 11 (KC: "improve the case with 2 parents … the navigation to view each of the parent"): ONE parent switch for the whole family app, the same
// pill on Today (frosted, on the picture), Photos, Calendar and Health (grey, on the title row). "Both" (or everyone) and each parent's face; one tap goes
// straight from Oma to Opa, or back to both; the one shown has a white disc. The choice is the stored family selection (`useFamilySel`), so Photos
// and Calendar follow what Today shows. Health has no "both" (`both={false}`: it shows one parent at a time).
// KC round 9 ("when we have chosen one of them it should not be a back button… easier without clicking 2 times") is where the pill comes from.
import type { CSSProperties } from 'react';
import { memberName, type Member } from '@cp/shared';
import { Icon } from '../../components/ui';
import { MemberFace } from './health/bits';
import { useFamilyCtx } from './useFamily';

export function ParentSwitch({ members, sel, onPick, tone = 'frost', both = true }: {
  members: Member[]; sel: string; onPick: (id: string) => void;
  /** frost: on a picture (Today's hero); page: on the white page (a grey pill with the cp-fill edge) */
  tone?: 'frost' | 'page'; both?: boolean;
}) {
  const { t } = useFamilyCtx();
  const frost = tone === 'frost';
  const item = (on: boolean): CSSProperties => ({
    pointerEvents: 'auto', width: 32, height: 32, borderRadius: 999, border: 'none', padding: 0, flex: 'none', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: on ? '#FFFFFF' : 'transparent', color: on ? '#24201C' : frost ? '#FFFFFF' : '#6B6560',
    boxShadow: on ? (frost ? '0 0 0 2px #FFFFFF' : '0 1px 3px rgba(36,32,28,.18)') : 'none',
    opacity: on || !frost ? 1 : 0.85, transition: 'background-color .15s, opacity .15s, box-shadow .15s',
  });
  const shell: CSSProperties = frost
    ? { background: 'rgba(255,255,255,.22)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }
    : { background: 'var(--fill, #F4F4F5)' };
  return (
    <div role="group" aria-label={t('ftoday.whoAria')} data-testid="parent-switch" data-tone={tone} className={frost ? undefined : 'cp-fill'}
      style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 4, padding: 2, height: 36, boxSizing: 'border-box', borderRadius: 999, flex: 'none', ...shell }}>
      {both ? (
        <button type="button" onClick={() => onPick('both')} aria-pressed={sel === 'both'} data-testid="all-parents" className="cp-press" style={item(sel === 'both')}
          aria-label={members.length > 2 ? t('ftoday.everyone') : t('ftoday.bothParents')}>
          <Icon name="group" size={19} />
        </button>
      ) : null}
      {members.map((m) => (
        <button key={m.id} type="button" onClick={() => onPick(m.id)} aria-pressed={sel === m.id} data-member={m.id} aria-label={memberName(m)} className="cp-press" style={{ ...item(sel === m.id), padding: 1 }}>
          <MemberFace m={m} size={sel === m.id ? 28 : 30} />
        </button>
      ))}
    </div>
  );
}

/** Tiny faces for a calendar day: who came (in the parents' order), for a family with more than one parent. */
export function CameFaces({ members, size = 14 }: { members: Member[]; size?: number }) {
  if (!members.length) return null;
  return (
    <span aria-hidden="true" style={{ display: 'flex', gap: 2, flex: 'none' }}>
      {members.map((m) => <MemberFace key={m.id} m={m} size={size} />)}
    </span>
  );
}
