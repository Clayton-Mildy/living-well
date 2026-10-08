// Member profile (design ScrProfile): header, status, tabs, a per-tab edit bar and the tab content. Staff open it at /members/:id/:tab;
// the family's Health screen renders it with audience="family" (no History, no edit bars, no staff-only fields).
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { latestBp, live, memberAge, memberName, memberSince, onLeaveOn, planOn, suspensionOf, ym, currentMembership, membershipStatus, type Member, type Role } from '@cp/shared';
import { PROFILE_TABS, endingOn, isNewMember, memberStatus, pendingReviewsFor, tabForSection, type ProfileTab } from '@cp/shared/rules/members';
import { Button, EmptyState, Icon, photoBg, TONES } from '../../components/ui';
import { useDevice, padFor } from '../../hooks/useDevice';
import { useAct } from '../../lib/act';
import { useNow } from '../../lib/clock';
import { useFmt, useT } from '../../lib/i18n';
import { useMe } from '../../lib/me';
import { useClub } from '../../store/replica';
import { initials } from '@cp/shared';
import { canGoBack, endReasonLabel, STATUS_STYLE, statusText } from './lib';
import { MemberDialog } from './dialogs/MemberDialog';
import { ProfilePhotoSheet } from './ProfilePhoto';
import { memberPhoto, photoFill } from '../../lib/media';
import { AttendanceTab } from './profile/AttendanceTab';
import { CareTab } from './profile/CareTab';
import { DocsTab } from './profile/DocsTab';
import { FamilyTab } from './profile/FamilyTab';
import { HealthTab } from './profile/HealthTab';
import { HistoryTab } from './profile/HistoryTab';
import { NotesTab } from './profile/NotesTab';
import { OverviewTab } from './profile/OverviewTab';
import { PhotosTab } from './profile/PhotosTab';
import { PlanTab } from './profile/PlanTab';
import type { DialogKind, P } from './profile/types';
import { ScrollTabs } from './profile/ScrollTabs';

type Audience = 'staff' | 'family';
const EDIT: Partial<Record<ProfileTab, { roles: Role[]; dlg: DialogKind; flagged?: boolean }>> = {
  overview: { roles: ['lobby', 'mgmt'], dlg: 'details' },
  health: { roles: ['nurse', 'mgmt'], dlg: 'health', flagged: true },
  care: { roles: ['nurse', 'activity', 'mgmt'], dlg: 'care', flagged: true },
  docs: { roles: ['lobby', 'mgmt'], dlg: 'consent' },
  plan: { roles: ['finance', 'mgmt'], dlg: 'plan' },
  family: { roles: ['lobby', 'mgmt'], dlg: 'contact' },
};
/** Other areas link to /members/:id/attendance, /documents or /billing; the profile's own keys are att, docs and plan. */
const ALIAS: Record<string, ProfileTab> = { attendance: 'att', documents: 'docs', billing: 'plan', 'care-log': 'care' };
export const tabAlias = (k: string | null | undefined): ProfileTab | null => (k ? (ALIAS[k] ?? ((PROFILE_TABS as string[]).includes(k) ? (k as ProfileTab) : null)) : null);
/** Which tabs a role sees: teachers don't see plan and billing or documents; finance sees what billing needs. */
export function tabsFor(role: Role, audience: Audience): ProfileTab[] {
  if (audience === 'family') return PROFILE_TABS.filter((x) => x !== 'history');
  if (role === 'activity') return PROFILE_TABS.filter((x) => x !== 'plan' && x !== 'docs');
  if (role === 'finance') return ['overview', 'att', 'plan', 'family', 'history'];
  if (role === 'lobby' || role === 'nurse' || role === 'mgmt') return PROFILE_TABS;
  return ['overview', 'att'];
}

export function MemberProfile({ memberId, audience = 'staff' }: { memberId?: string; audience?: Audience }) {
  const params = useParams();
  const id = memberId ?? params.id ?? '';
  const s = useClub();
  const { user } = useMe();
  const t = useT();
  const navigate = useNavigate();
  const m = s?.members[id];
  const visible = !!m && !m.deletedAt && (audience === 'staff' || (user?.kind === 'family' && user.memberIds.includes(id)));
  if (!user || !visible) {
    return (
      <div style={{ padding: 40 }}>
        <EmptyState icon="person_off" title={t('profile.notFound')} action={audience === 'staff' ? <Button onClick={() => navigate('/members')}>{t('profile.toMembers')}</Button> : undefined} />
      </div>
    );
  }
  return <ProfileInner key={id} id={id} audience={audience} />;
}

function ProfileInner({ id, audience }: { id: string; audience: Audience }) {
  const s = useClub();
  const { user, role } = useMe();
  const t = useT();
  const fmt = useFmt();
  const { today, nowMin } = useNow();
  const { device, isPhone } = useDevice();
  const act = useAct();
  const navigate = useNavigate();
  const params = useParams();
  const [sp] = useSearchParams();
  const family = audience === 'family';
  const m = s.members[id];
  const me = user!;
  const myRole = role as Role;
  const allowed = tabsFor(myRole, audience);
  const wanted = tabAlias(family ? sp.get('tab') : params.tab);
  const [famTab, setFamTab] = useState<ProfileTab>(wanted && allowed.includes(wanted) ? wanted : 'health');
  useEffect(() => { if (family && wanted && allowed.includes(wanted)) setFamTab(wanted); }, [wanted]); // eslint-disable-line react-hooks/exhaustive-deps
  const tab: ProfileTab = family ? famTab : wanted && allowed.includes(wanted) ? wanted : 'overview';
  const [dlg, setDlg] = useState<{ kind: DialogKind; familyId?: string } | null>(null);
  const [photoSheet, setPhotoSheet] = useState(false);
  const st = memberStatus(s, m, today);
  const life = membershipStatus(m, today);
  const myActor = me.kind === 'staff' ? `staff:${me.id}` : `family:${me.id}`;
  const pending = useMemo(() => (family ? [] : pendingReviewsFor(s, id)), [s, id, family]);
  const mine = useMemo(() => live(s.changeRequests).filter((c) => c.status === 'pending' && c.submittedBy === myActor && c.target.memberId === id), [s, id, myActor]);
  const mgmt = myRole === 'mgmt';
  const ended = life === 'ended';
  const isPending = st.key === 'pending';
  const editCfg = family ? undefined : EDIT[tab];
  const canEdit = !!editCfg && editCfg.roles.includes(myRole) && !ended && !isPending;
  /** the profile picture is one of the details: the front desk and management change it (tap the avatar) */
  const canPhoto = !family && !!EDIT.overview?.roles.includes(myRole) && !ended && !isPending;
  const ending = endingOn(m, today);
  const cur = currentMembership(m);
  const go = (x: ProfileTab) => { if (family) setFamTab(x); else navigate(`/members/${id}/${x}`, { replace: true }); };
  const p: P = { s, m, today, nowMin, t, fmt, lang: fmt.lang, audience, family, role: myRole, me, mgmt, isPhone, st, pending, mine, act, go, open: (kind, extra) => setDlg({ kind, familyId: extra?.familyId }), canEdit: !family && !ended && !isPending && (EDIT[tab]?.roles.includes(myRole) ?? false) };

  const since = memberSince(m);
  const plan = planOn(m, today).plan;
  const age = memberAge(m, today);
  const tone = TONES[m.photoTone % 5];
  const stl = STATUS_STYLE[st.key];
  const lr = myRole === 'finance' ? undefined : latestBp(s, id);
  const hold = suspensionOf(s, id, today); // KC round 6: on hold for an unpaid invoice, or in a month of leave (the brochure's terms)
  const onLeave = !!m && onLeaveOn(m, today);
  const spouse = m.spouseId ? s.members[m.spouseId] : undefined;
  const pronN = m.gender;
  const sub = [
    age != null ? t('profile.years', { n: age }) : '',
    isPhone ? '' : m.nanny ? t('profile.withNanny_' + pronN, { n: m.nanny.name }) : '',
    isPhone ? '' : spouse && !spouse.deletedAt ? t('profile.marriedTo', { n: spouse ? `${spouse.title} ${spouse.firstName}` : '' }) : '',
  ].filter(Boolean).join(' · ');
  const pendingTabs = new Set((family ? mine : pending).map((c) => tabForSection(c.section)));
  const tabItems = allowed.map((k) => ({ key: k, label: t('profile.tab.' + k), dot: pendingTabs.has(k) }));
  const backLabel = canGoBack() ? t('common.back') : t('nav.members');
  // only the reason there is no edit button is worth saying; why it is read-only while pending or ended is already in the status line
  const editNote = !canEdit && !ended && !isPending ? t('profile.editOnly', { w: t('profile.who.' + tab) }) : '';
  const editLabel = t('profile.edit.' + tab);
  const hasEditBar = !family && !!editCfg;
  /** round 6: the staff profile on a phone gets the native look (a top bar with back, a centred header, sticky tabs) */
  const native = isPhone && !family;
  /** the family's Health on a phone gets the same grouped look, centred header and sticky tabs, but no top bar (it is not a pushed screen there) */
  const phoneUi = isPhone;
  const titleRef = useRef<HTMLHeadingElement>(null);
  const collapsed = useScrolledPast(titleRef, native);
  const goBack = () => (canGoBack() ? navigate(-1) : navigate('/members'));
  const editBtn = hasEditBar && canEdit ? (
    <button type="button" className="dh38 cp-press" aria-label={editLabel} title={editLabel} onClick={() => setDlg({ kind: editCfg!.dlg })} style={{ width: 44, height: 44, borderRadius: 999, border: 'none', background: 'transparent', color: '#24201C', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flex: 'none', padding: 0 }}>
      <Icon name={tab === 'family' ? 'person_add' : 'edit'} size={22} />
    </button>
  ) : null;

  const cancelEnding = async () => { await act('members.cancelEnding', { memberId: id }, { ok: t('profile.endingCancelled', { n: memberName(m) }) }); };
  const statusItem = (dot: string, text: string, fg = '#24201C') => (
    <span key={text} style={{ display: 'inline-flex', alignItems: 'flex-start', gap: 8, fontSize: 14, fontWeight: 500, color: fg, lineHeight: '20px', minWidth: 0 }}>
      <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: 999, background: dot, flex: 'none', marginTop: 7 }} />
      <span style={{ minWidth: 0 }}>{text}</span>
    </span>
  );
  const membershipActions = (
    <>
      {!family && mgmt && !ended && !isPending && !ending ? <button type="button" onClick={() => setDlg({ kind: 'end' })} style={{ height: 40, padding: '0 12px', borderRadius: 12, border: 'none', background: 'transparent', color: '#9A3D24', fontSize: 14, fontWeight: 500, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 4, whiteSpace: 'nowrap', fontFamily: 'Inter' }}>{t('profile.endMembership')}</button> : null}
      {!family && mgmt && ending && !ended ? <button type="button" onClick={cancelEnding} style={{ height: 40, padding: '0 12px', borderRadius: 12, border: 'none', background: 'transparent', color: '#75624B', fontSize: 14, fontWeight: 500, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 4, whiteSpace: 'nowrap', fontFamily: 'Inter' }}>{t('profile.cancelEnding')}</button> : null}
      {!family && mgmt && ended ? <Button variant="secondary" size={44} icon="person_check" onClick={() => setDlg({ kind: 'reactivate' })}>{t('profile.reactivate')}</Button> : null}
    </>
  );
  const Content = { overview: OverviewTab, health: HealthTab, care: CareTab, photos: PhotosTab, att: AttendanceTab, docs: DocsTab, plan: PlanTab, family: FamilyTab, notes: NotesTab, history: HistoryTab }[tab];

  return (
    <div className={phoneUi ? 'cp-native' : undefined} style={{ padding: padFor(device), display: 'flex', flexDirection: 'column', gap: isPhone ? 14 : 24 }}>
      {native ? <TopBar back={backLabel} onBack={goBack} title={memberName(m)} showTitle={collapsed} action={editBtn} /> : null}
      {phoneUi ? (
        <NativeHead m={m} canPhoto={canPhoto} onPhoto={() => setPhotoSheet(true)} titleRef={titleRef}
          sub={[t('profile.eyebrow', { p: plan === 'flex' ? t('profile.planFlex') : t('profile.planGold'), d: since ? fmt.fmonth(ym(since), true) : '—' }), sub].filter(Boolean).join(' · ')} />
      ) : null}
      {!family && !native ? (
        <button type="button" className="dh37" onClick={() => (canGoBack() ? navigate(-1) : navigate('/members'))} style={{ alignSelf: 'flex-start', height: isPhone ? 36 : 44, padding: '0 16px 0 10px', margin: isPhone ? '-6px 0 -6px -10px' : '-6px 0 -8px -10px', borderRadius: 12, border: 'none', background: 'transparent', color: '#75624B', fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontFamily: 'Inter' }}>
          <Icon name="arrow_back" size={19} />
          {backLabel}
        </button>
      ) : null}
      {phoneUi ? null : <div style={{ display: 'flex', alignItems: isPhone ? 'flex-start' : 'center', gap: isPhone ? '10px 14px' : '12px 28px', flexWrap: 'wrap' }}>
        {(() => {
          const size = isPhone ? 68 : 104;
          const look = { width: size, height: size, borderRadius: 999, background: photoFill(memberPhoto(m), photoBg(m.photoTone)), color: tone[1], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: isPhone ? 22 : 34, fontWeight: 400, flex: 'none', boxShadow: `inset 0 0 0 ${isPhone ? 3 : 4}px #FFFFFF, 0 0 0 1px #E4DACD, 0 8px 22px rgba(60,40,20,.10)` } as const;
          const face = m.photoMediaId ? null : initials(memberName(m));
          if (!canPhoto) return <div aria-hidden="true" style={look}>{face}</div>;
          return (
            <button type="button" onClick={() => setPhotoSheet(true)} aria-label={t('profile.photoTitle')} title={t('profile.photoTitle')} data-testid="profile-avatar" style={{ ...look, position: 'relative', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'Inter' }}>
              {face}
              <span aria-hidden="true" style={{ position: 'absolute', right: -2, bottom: -2, width: isPhone ? 24 : 32, height: isPhone ? 24 : 32, borderRadius: 999, background: '#24201C', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 2px #F5F5F3' }}><Icon name="photo_camera" size={isPhone ? 14 : 18} /></span>
            </button>
          );
        })()}
        <div style={{ flex: isPhone ? '1 1 0' : '1 1 300px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: isPhone ? 3 : 6 }}>
          <div className="cp-eyebrow1" style={{ fontSize: 12, letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 500, color: '#6E5A43', lineHeight: '18px' }}>
            {t('profile.eyebrow', { p: plan === 'flex' ? t('profile.planFlex') : t('profile.planGold'), d: since ? fmt.fmonth(ym(since), true) : '—' })}
          </div>
          <h1 style={{ margin: 0, fontSize: isPhone ? 26 : 'clamp(30px, 3.2vw, 40px)', lineHeight: 1.1, fontWeight: 400, letterSpacing: '-1px', color: '#2B231C', overflowWrap: 'anywhere' }}>{memberName(m)}</h1>
          {sub ? <div style={{ fontSize: 14, lineHeight: '20px', color: '#6B6259' }}>{sub}</div> : null}
        </div>
        {isPhone && hasEditBar && canEdit ? (
          <button type="button" className="dh38" aria-label={editLabel} title={editLabel} onClick={() => setDlg({ kind: editCfg!.dlg })} style={{ width: 40, height: 40, borderRadius: 999, border: '1px solid #DCD3C8', background: '#FFFFFF', color: '#24201C', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flex: 'none', padding: 0 }}>
            <Icon name={tab === 'family' ? 'person_add' : 'edit'} size={20} />
          </button>
        ) : null}
        {isPhone ? null : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>{membershipActions}</div>}
      </div>}
      {/* status line: a dot plus text for each state, not a row of boxed badges */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: phoneUi ? '4px 14px' : '6px 18px', justifyContent: phoneUi ? 'center' : undefined, marginTop: phoneUi ? -6 : undefined }}>
        {statusItem(stl.dot, statusText(t, st, fmt.fds))}
        {isNewMember(m, today) && !isPending ? statusItem('#3D6B4F', t('profile.newMember'), '#2F5A40') : null}
        {ending && !ended ? statusItem('#7A5510', t('profile.endingOn', { d: fmt.fds(ending) }), '#7A5510') : null}
        {ended ? statusItem('#5E5852', t('profile.endedText', { d: fmt.fds(cur.lastDay || today), r: cur.endReason ? endReasonLabel(t, cur.endReason) : '' })) : null}
        {!isPending && hold ? statusItem('#9A3D24', t('status.suspended'), '#9A3D24') : null}
        {!isPending && onLeave ? statusItem('#7A5510', t('status.onLeave', { month: fmt.fd(`${ym(today)}-01`, { month: 'short' }) }), '#7A5510') : null}
        {lr && !isPending ? statusItem(lr.status === 'alert' ? '#9A3D24' : lr.status === 'watch' ? '#7A5510' : '#3D6B4F', `${t('status.' + lr.status)} · ${lr.sys}/${lr.dia}`, lr.status === 'alert' ? '#9A3D24' : lr.status === 'watch' ? '#7A5510' : '#24201C') : null}
      </div>
      {isPending && !family ? (
        <div role="status" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px 14px', borderRadius: 14, background: '#F6ECD6', color: '#24201C', fontSize: 15, lineHeight: '22px' }}>
          <Icon name="hourglass_top" size={20} fill={1} color="#7A5510" style={{ marginTop: 1 }} />
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span>{mgmt ? t('profile.pendingBannerMgmt') : t('profile.pendingBanner')}</span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {mgmt ? <Button size={44} icon="fact_check" onClick={() => navigate('/reviews')}>{t('profile.reviewIt')}</Button> : null}
              {pending.filter((c) => c.status === 'pending' && c.submittedBy === myActor).map((c) => (
                <Button key={c.id} size={44} variant="secondary" icon="undo" onClick={async () => { const r = await act('review.withdraw', { crId: c.id }, { ok: t('profile.withdrawn') }); if (r.ok) navigate('/members'); }}>{t('profile.withdraw')}</Button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
      {/* phone: the tabs stick under the top bar (the family has none: they stick to the top) */}
      <div style={phoneUi ? { position: 'sticky', top: native ? BAR_H : 0, zIndex: 5, margin: '0 -16px', padding: '0 16px', background: '#F5F5F3' } : { display: 'contents' }}>
        <ScrollTabs tabs={tabItems} current={tab} onChange={(k) => go(k as ProfileTab)} wrap={false} phone={isPhone} label={t('profile.tabs')} pendingLabel={t('common.pendingReview')} leftLabel={t('profile.scrollLeft')} rightLabel={t('profile.scrollRight')} />
      </div>
      {hasEditBar && !isPhone && (editNote || canEdit) ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginTop: -10 }}>
          {editNote ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#6B6259', lineHeight: 1.4 }}>
              <Icon name="lock" size={17} color="#75624B" />
              {editNote}
            </span>
          ) : <span />}
          {canEdit ? (
            <button type="button" className="dh38" onClick={() => setDlg({ kind: editCfg!.dlg })} style={{ height: 40, padding: '0 16px 0 12px', borderRadius: 12, border: '1px solid #DCD3C8', background: '#FFFFFF', color: '#24201C', fontSize: 14, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'Inter' }}>
              <Icon name={tab === 'family' ? 'person_add' : 'edit'} size={18} />
              {editLabel}
            </button>
          ) : null}
        </div>
      ) : null}
      <div role="tabpanel" aria-label={t('profile.tab.' + tab)} style={{ display: 'flex', flexDirection: 'column', gap: isPhone ? 14 : 20 }}>
        <Content p={p} />
      </div>
      {/* phone: the membership actions sit below the content, not in the header */}
      {isPhone ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>{membershipActions}</div> : null}
      {photoSheet ? <ProfilePhotoSheet m={m} open onClose={() => setPhotoSheet(false)} /> : null}
      {dlg ? <MemberDialog p={p} kind={dlg.kind} familyId={dlg.familyId} onClose={() => setDlg(null)} /> : null}
    </div>
  );
}


/** Height of the phone top bar (the tabs stick right under it). */
const BAR_H = 50;

/** True once `ref` has scrolled up under the phone top bar (the bar then shows the name). */
function useScrolledPast(ref: React.RefObject<HTMLElement>, on: boolean) {
  const [past, setPast] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!on || !el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setPast(!e.isIntersecting && e.boundingClientRect.top < (e.rootBounds?.top ?? 0) + BAR_H), { root: document.getElementById('main'), rootMargin: `-${BAR_H}px 0px 0px 0px` });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, on]);
  return past;
}

/** Round 6, phone: a native top bar, "‹ Members" on the left, the name fading in once the header has scrolled away, the tab's edit on the right. */
function TopBar({ back, onBack, title, showTitle, action }: { back: string; onBack: () => void; title: string; showTitle: boolean; action: ReactNode }) {
  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 6, height: BAR_H, margin: '-14px -16px -14px', padding: '0 6px 0 2px', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)', alignItems: 'center', gap: 4, background: '#F5F5F3' }}>
      <button type="button" className="cp-press" onClick={onBack} aria-label={back} style={{ justifySelf: 'start', maxWidth: '100%', height: 44, padding: '0 8px 0 0', border: 'none', background: 'transparent', color: '#75624B', fontSize: 16, fontWeight: 500, display: 'flex', alignItems: 'center', cursor: 'pointer', fontFamily: 'Inter' }}>
        <Icon name="chevron_left" size={32} weight={300} />
        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{back}</span>
      </button>
      <span aria-hidden={!showTitle} style={{ maxWidth: 'min(200px, 38vw)', fontSize: 16, fontWeight: 600, color: '#24201C', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', opacity: showTitle ? 1 : 0, transition: 'opacity .2s' }}>{title}</span>
      <div style={{ justifySelf: 'end', display: 'flex' }}>{action}</div>
    </div>
  );
}

/** Round 6, phone: a centred header (like a phone's contact card), the photo, the name and one quiet line under it. */
function NativeHead({ m, canPhoto, onPhoto, titleRef, sub }: { m: Member; canPhoto: boolean; onPhoto: () => void; titleRef: React.RefObject<HTMLHeadingElement>; sub: string }) {
  const t = useT();
  const size = 88;
  const look = { width: size, height: size, borderRadius: 999, background: photoFill(memberPhoto(m), photoBg(m.photoTone)), color: TONES[m.photoTone % 5][1], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, fontWeight: 400, flex: 'none', boxShadow: 'inset 0 0 0 3px #FFFFFF, 0 0 0 1px #E4DACD' } as const;
  const face = m.photoMediaId ? null : initials(memberName(m));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 8, paddingTop: 2 }}>
      {canPhoto ? (
        <button type="button" onClick={onPhoto} aria-label={t('profile.photoTitle')} title={t('profile.photoTitle')} data-testid="profile-avatar" className="cp-press" style={{ ...look, position: 'relative', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'Inter' }}>
          {face}
          <span aria-hidden="true" style={{ position: 'absolute', right: -1, bottom: -1, width: 28, height: 28, borderRadius: 999, background: '#24201C', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 2px #F5F5F3' }}><Icon name="photo_camera" size={15} /></span>
        </button>
      ) : <div aria-hidden="true" style={look}>{face}</div>}
      <h1 ref={titleRef} style={{ margin: '2px 0 0', fontSize: 26, lineHeight: 1.15, fontWeight: 400, letterSpacing: '-0.6px', color: '#2B231C', overflowWrap: 'anywhere' }}>{memberName(m)}</h1>
      <div style={{ fontSize: 14, lineHeight: '20px', color: '#6B6259' }}>{sub}</div>
    </div>
  );
}
