// Family area hooks: the signed-in family contact, the member switcher (kept per user), small formatting helpers.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Member } from '@cp/shared';
import { familyMembers, resolveSel, selWho } from '@cp/shared/rules/family';
import { useClub } from '../../store/replica';
import { useMe } from '../../lib/me';
import { useNow } from '../../lib/clock';
import { useT, useFmt } from '../../lib/i18n';
import { readPref, writePref } from '../../store/session';

const PREF = 'fam.sel';

/** The family contact signed in (null for staff, who only use the sheets). */
export function useFamilyUser() {
  const { user } = useMe();
  return user && user.kind === 'family' ? user : null;
}

/**
 * The member switcher shared by Today, Photos, Health and Billing.
 * The choice is stored per user (member id or 'both'); a deep link `?member=<id>` selects that member once and is then dropped.
 */
export function useFamilySel() {
  const s = useClub();
  const user = useFamilyUser();
  const { today } = useNow();
  const [sp, setSp] = useSearchParams();
  const fm = useMemo(() => (user ? familyMembers(s, user.id, today) : { all: [] as string[], choices: [] as string[] }), [s, user, today]);
  const [stored, setStored] = useState<string>(() => readPref(user?.id, PREF, 'both'));
  const urlMember = sp.get('member');
  useEffect(() => {
    if (!user || !urlMember) return;
    if (fm.all.includes(urlMember)) { setStored(urlMember); writePref(user.id, PREF, urlMember); }
    const next = new URLSearchParams(sp);
    next.delete('member');
    setSp(next, { replace: true });
  }, [urlMember]); // eslint-disable-line react-hooks/exhaustive-deps
  const sel = resolveSel(urlMember && fm.all.includes(urlMember) ? urlMember : stored, fm.choices);
  const setSel = useCallback((v: string) => { setStored(v); writePref(user?.id, PREF, v); }, [user?.id]);
  return { all: fm.all, choices: fm.choices, sel, who: selWho(sel, fm.choices), setSel, multi: fm.choices.length > 1 };
}

/** Pronouns follow the member's gender; Indonesian uses ia / dia. Pass `n` too so templates can use the name instead. */
export function usePron() {
  const t = useT();
  return useCallback((m: Pick<Member, 'gender' | 'title' | 'firstName'>) => ({
    n: `${m.title} ${m.firstName}`,
    s: t('family.pronS_' + m.gender),
    o: t('family.pronO_' + m.gender),
  }), [t]);
}

/** Today's date and time formatting in one place for the family screens. */
export function useFamilyCtx() {
  const s = useClub();
  const t = useT();
  const fmt = useFmt();
  const now = useNow();
  const user = useFamilyUser();
  const pron = usePron();
  return { s, t, fmt, now, user, pron };
}

/** Page padding the design uses for the family pages. */
export const famPad = (isPhone: boolean) => (isPhone ? '16px 16px 24px' : '28px 24px 40px');

/** A stable callback that always calls the latest function (the overlay primitives re-run their focus effect when `onClose` changes). */
export function useStableFn(fn: () => void): () => void {
  const ref = useRef(fn);
  ref.current = fn;
  return useCallback(() => ref.current(), []);
}
