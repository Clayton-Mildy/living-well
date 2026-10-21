// Round 8 (the prototype's parent profile): a long page about one parent. Jump chips scroll to a section and light up the one in view. The page scrolls
// inside #main (the shell's scroller). KC round 9: a phone and tablet open it like Today — the parent's picture fills the top (profile/ProfileCover.tsx) with
// ‹ back and Edit floating on it, and the white panel slides up over it; the chips ride on the panel's top edge, and once the panel reaches the top a slim
// bar (‹ back · short name · Edit) joins them. A family reads only what the club
// approved; Edit sends the personal and contact details to the club for approval (see profile/EditSheet.tsx).
// On a laptop (round 8c, the prototype's desktop) there is no top bar: a sticky 260px column on the left (back, the 96px face, name, the sections as a vertical
// list, "Suggest a change" = Edit), the sections a 720px column beside it (plan and team side by side, the personal details and the documents in two columns).
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { displayName, membershipStatus } from '@cp/shared';
import { Icon } from '../../components/ui';
import { useDevice } from '../../hooks/useDevice';
import { useAct } from '../../lib/act';
import { BackLink, F, FamPage, useBack, useFamWide } from './kit';
import { ProfileEditSheet, PendingDetailsCard, pendingDetails } from './profile/EditSheet';
import { CareSection, DocsSection, FamilySection, HealthSection, NotesSection, Overview, PlanSection, ProfileHead, VisitsSection, type PCtx } from './profile/sections';
import { ChipRow, useParamMember } from './health/bits';
import { JumpList } from './profile/JumpList';
import { ProfileCover } from './profile/ProfileCover';
import { FrostChip, PANEL_OVERLAP } from './StoryHero';

const SECS = ['overview', 'health', 'care', 'visits', 'plan', 'family', 'docs', 'notes'] as const;
type Sec = (typeof SECS)[number];
/** The slim bar's row (‹ back · name · Edit) that joins the chips once the panel is at the top. */
const SLIM_H = 44;
const FROM: Record<string, { label: string; path: string }> = { health: { label: 'fhealth.title', path: '/health' }, today: { label: 'nav.today', path: '/today' } };

export function FamilyProfile() {
  const { s, t, fmt, now, user, id, m, sp } = useParamMember();
  const act = useAct();
  const navigate = useNavigate();
  const from = FROM[sp.get('from') || ''];
  const back = useBack(from?.path || '/me');
  const wide = useFamWide();
  const { isLaptop, isPhone } = useDevice();
  const bar = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  // the panel has slid up to the top: the slim bar with ‹ back, the name and Edit shows over the chips
  const [docked, setDocked] = useState(false);
  const lock = useRef(0);
  const [active, setActive] = useState<Sec>('overview');
  const [edit, setEdit] = useState(false);

  // the sticky bar's height: sections stop below it when a chip scrolls to them
  useLayoutEffect(() => {
    const el = bar.current;
    if (wide) { document.documentElement.style.setProperty('--pf-bar', '24px'); return () => document.documentElement.style.removeProperty('--pf-bar'); }
    if (!el) return;
    // a section a chip scrolls to stops below the docked bar (the slim row joins the chips once the panel is at the top)
    const set = () => document.documentElement.style.setProperty('--pf-bar', `${el.offsetHeight + (docked ? 0 : SLIM_H) + 4}px`);
    set();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(set) : null;
    ro?.observe(el);
    return () => { ro?.disconnect(); document.documentElement.style.removeProperty('--pf-bar'); };
  }, [!!m, wide, docked]);

  // the chip of the section in view lights up while the page scrolls (not while a chip's own scroll is under way)
  useEffect(() => {
    const main = document.getElementById('main');
    if (!main) return;
    let raf = 0;
    const compute = () => {
      raf = 0;
      if (!wide && panel.current) setDocked(panel.current.getBoundingClientRect().top <= 1);
      if (Date.now() < lock.current) return;
      const edge = wide ? 64 : (bar.current?.getBoundingClientRect().bottom ?? 0) + 8;
      let cur: Sec = SECS[0];
      for (const k of SECS) { const el = document.getElementById('pf-' + k); if (el && el.getBoundingClientRect().top <= edge) cur = k; }
      setActive(cur);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(compute); };
    const release = () => { lock.current = 0; };
    main.addEventListener('scroll', onScroll, { passive: true });
    main.addEventListener('wheel', release, { passive: true });
    main.addEventListener('touchstart', release, { passive: true });
    return () => { if (raf) cancelAnimationFrame(raf); main.removeEventListener('scroll', onScroll); main.removeEventListener('wheel', release); main.removeEventListener('touchstart', release); };
  }, [wide]);

  if (!user || !m) return null;
  const p: PCtx = { s, m, t, fmt, today: now.today, userId: user.id, act, go: (path) => navigate(path) };
  const waiting = pendingDetails(s, m.id, user.id);
  const jump = (k: Sec) => {
    setActive(k);
    lock.current = Date.now() + 1600;
    document.getElementById('pf-' + k)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const canEdit = user.memberIds.includes(m.id) && membershipStatus(m, now.today) !== 'ended';
  const barBtn = { display: 'flex', alignItems: 'center', border: 'none', background: 'transparent', color: F.bronze, fontSize: 17, cursor: 'pointer', padding: 0, minHeight: 44, fontFamily: 'Inter, system-ui, sans-serif', minWidth: 0 } as const;

  const items = SECS.map((k) => ({ value: k, label: t('fhealth.jump.' + k) }));
  const sections = (
    <div key="r" data-member-id={id} style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: wide ? 0 : 4, ...(wide ? { maxWidth: 720, minWidth: 0 } : {}) }}>
      <Overview p={p} id="overview" notice={<PendingDetailsCard requests={waiting} t={t} />} />
      <HealthSection p={p} id="health" />
      <CareSection p={p} id="care" />
      <VisitsSection p={p} id="visits" />
      <PlanSection p={p} id="plan" />
      <FamilySection p={p} id="family" />
      <DocsSection p={p} id="docs" />
      <NotesSection p={p} id="notes" />
    </div>
  );
  const sheet = edit ? <ProfileEditSheet m={m} s={s} t={t} userId={user.id} onClose={() => setEdit(false)} /> : null;

  if (wide) {
    return (
      <FamPage testId="family-profile" gap={12} wide>
        <div style={{ display: 'grid', gridTemplateColumns: `${isLaptop ? 260 : 212}px minmax(0, 1fr)`, gap: isLaptop ? 32 : 24, alignItems: 'start' }}>
          <div data-testid="pf-bar" style={{ position: 'sticky', top: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <BackLink label={from ? t(from.label) : t('fam.me')} onClick={back} />
            <ProfileHead p={p} column />
            <JumpList<Sec> label={t('fhealth.jumpAria')} value={active} onChange={jump} testId="pf-jump" items={items} />
            {canEdit ? (
              <button type="button" onClick={() => setEdit(true)} data-testid="pf-edit" className="cp-fam-press"
                style={{ alignSelf: 'flex-start', height: 38, padding: '0 16px', border: 'none', borderRadius: 999, background: F.fill, color: F.text, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', marginTop: 4 }}>{t('fhealth.suggest')}</button>
            ) : null}
          </div>
          {sections}
        </div>
        {sheet}
      </FamPage>
    );
  }

  const backLabel = from ? t(from.label) : t('fam.me');
  return (
    <div data-testid="family-profile" style={{ width: '100%', maxWidth: 600, margin: '0 auto', padding: isPhone ? 0 : '24px 16px 0', boxSizing: 'border-box' }}>
      <ProfileCover p={p} top={(
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <FrostChip testId="fam-back" icon="chevron_left" onClick={back}>{backLabel}</FrostChip>
          {canEdit ? <FrostChip testId="pf-edit" onClick={() => setEdit(true)}>{t('fhealth.edit')}</FrostChip> : null}
        </div>
      )} />
      <div ref={panel} data-testid="pf-panel" style={{ position: 'relative', zIndex: 1, marginTop: -PANEL_OVERLAP, background: '#FFFFFF', borderRadius: '28px 28px 0 0', padding: '0 16px 24px', minHeight: '60vh' }}>
        <div ref={bar} data-testid="pf-bar" data-docked={docked || undefined} style={{ position: 'sticky', top: 0, zIndex: 4, margin: '0 -16px', padding: docked ? '6px 16px 10px' : '8px 16px 10px', paddingTop: docked ? 'calc(6px + env(safe-area-inset-top, 0px))' : 8, background: docked ? 'rgba(255,255,255,.96)' : '#FFFFFF', backdropFilter: docked ? 'blur(16px)' : undefined, WebkitBackdropFilter: docked ? 'blur(16px)' : undefined, borderRadius: docked ? 0 : '28px 28px 0 0', boxShadow: docked ? '0 0.5px 0 rgba(0,0,0,.08)' : 'none', display: 'flex', flexDirection: 'column', gap: docked ? 2 : 10 }}>
          {docked ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto minmax(0,1fr)', alignItems: 'center', gap: 8, height: SLIM_H }}>
              <button type="button" onClick={back} data-testid="pf-bar-back" className="cp-press" style={{ ...barBtn, marginLeft: -6, justifySelf: 'start', maxWidth: '100%' }}>
                <Icon name="chevron_left" size={30} weight={300} color={F.bronze} />
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{backLabel}</span>
              </button>
              <span style={{ fontSize: 17, fontWeight: 600, color: '#1E1A16', textAlign: 'center', whiteSpace: 'nowrap' }}>{displayName(m)}</span>
              {canEdit ? <button type="button" onClick={() => setEdit(true)} data-testid="pf-bar-edit" className="cp-press" style={{ ...barBtn, justifySelf: 'end', fontWeight: 500 }}>{t('fhealth.edit')}</button> : <span />}
            </div>
          ) : <span aria-hidden="true" style={{ alignSelf: 'center', width: 36, height: 5, borderRadius: 999, background: '#D4D4D8', flex: 'none' }} />}
          <ChipRow<Sec> label={t('fhealth.jumpAria')} value={active} onChange={jump} testId="pf-jump" items={items} />
        </div>
        {sections}
      </div>
      {sheet}
    </div>
  );
}
