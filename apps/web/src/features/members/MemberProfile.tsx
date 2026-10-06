// Member profile (design ScrProfile): header, status, tabs, a per-tab edit bar and the tab content. Staff open it at /members/:id/:tab;
// the family's Health screen renders it with audience="family" (no History, no edit bars, no staff-only fields).
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { latestBp, live, memberAge, memberName, memberSince, planOn, ym, currentMembership, membershipStatus, type Role } from '@cp/shared';
import { PROFILE_TABS, endingOn, isNewMember, memberStatus, pendingReviewsFor, tabForSection, type ProfileTab } from '@cp/shared/rules/members';
import { Button, EmptyState, FONT_BODY, FONT_SMALL, Icon, photoBg, TONES } from '../../components/ui';
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
        <EmptyState icon="person_off" title={t('profile.notFound')} sub={t('profile.notFoundSub')} action={audience === 'staff' ? <Button onClick={() => navigate('/members')}>{t('profile.toMembers')}</Button> : undefined} />
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
  const editNote = ended ? t('profile.editEnded') : isPending ? t('profile.editPending') : canEdit ? (mgmt ? t('common.changesLogged') : editCfg?.flagged ? t('profile.editFlagged') : t('profile.editGated')) : t('profile.editOnly', { w: t('profile.who.' + tab) });
  const editLabel = t('profile.edit.' + tab);
  const hasEditBar = !family && !!editCfg;

  const cancelEnding = async () => { await act('members.cancelEnding', { memberId: id }, { ok: t('profile.endingCancelled', { n: memberName(m) }) }); };
  const pill = { minHeight: isPhone ? 32 : 36, maxWidth: '100%', padding: isPhone ? '3px 12px 3px 8px' : '5px 14px 5px 10px', borderRadius: 999, fontSize: isPhone ? 14 : 'max(14px, var(--cp-body, 0px))', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6, lineHeight: 1.3 };
  const membershipActions = (
    <>
      {!family && mgmt && !ended && !isPending && !ending ? <button type="button" onClick={() => setDlg({ kind: 'end' })} style={{ height: isPhone ? 40 : 44, padding: '0 14px', borderRadius: 999, border: 'none', background: 'transparent', color: '#AF4B2F', fontSize: isPhone ? 15 : 16, fontWeight: 500, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 4, whiteSpace: 'nowrap', fontFamily: 'Inter' }}>{t('profile.endMembership')}</button> : null}
      {!family && mgmt && ending && !ended ? <button type="button" onClick={cancelEnding} style={{ height: isPhone ? 40 : 44, padding: '0 14px', borderRadius: 999, border: 'none', background: 'transparent', color: '#75624B', fontSize: isPhone ? 15 : 16, fontWeight: 500, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 4, whiteSpace: 'nowrap', fontFamily: 'Inter' }}>{t('profile.cancelEnding')}</button> : null}
      {!family && mgmt && ended ? <Button variant="secondary" size={44} icon="person_check" onClick={() => setDlg({ kind: 'reactivate' })}>{t('profile.reactivate')}</Button> : null}
    </>
  );
  const Content = { overview: OverviewTab, health: HealthTab, care: CareTab, photos: PhotosTab, att: AttendanceTab, docs: DocsTab, plan: PlanTab, family: FamilyTab, notes: NotesTab, history: HistoryTab }[tab];

  return (
    <div style={{ padding: padFor(device), display: 'flex', flexDirection: 'column', gap: isPhone ? 10 : 20, maxWidth: 1180 }}>
      {!family ? (
        <button type="button" className="dh37" onClick={() => (canGoBack() ? navigate(-1) : navigate('/members'))} style={{ alignSelf: 'flex-start', height: isPhone ? 36 : 44, padding: '0 16px 0 10px', margin: isPhone ? '-6px 0 -6px -10px' : '-6px 0 -8px -10px', borderRadius: 999, border: 'none', background: 'transparent', color: '#75624B', fontSize: 16, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontFamily: 'Inter' }}>
          <Icon name="arrow_back" size={20} />
          {backLabel}
        </button>
      ) : null}
      <div style={{ display: 'flex', alignItems: 'center', gap: isPhone ? '8px 12px' : 18, flexWrap: 'wrap' }}>
        {(() => {
          const look = { width: isPhone ? 52 : 88, height: isPhone ? 52 : 88, borderRadius: 999, background: photoFill(memberPhoto(m), photoBg(m.photoTone)), color: tone[1], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: isPhone ? 18 : 30, fontWeight: 500, flex: 'none', boxShadow: isPhone ? 'inset 0 0 0 2px #FFFFFF, 0 0 0 1px #CAB8A2' : 'inset 0 0 0 3px #FFFFFF, 0 0 0 1px #CAB8A2' } as const;
          const face = m.photoMediaId ? null : initials(memberName(m));
          if (!canPhoto) return <div aria-hidden="true" style={look}>{face}</div>;
          return (
            <button type="button" onClick={() => setPhotoSheet(true)} aria-label={t('profile.photoTitle')} title={t('profile.photoTitle')} data-testid="profile-avatar" style={{ ...look, position: 'relative', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'Inter' }}>
              {face}
              <span aria-hidden="true" style={{ position: 'absolute', right: -2, bottom: -2, width: isPhone ? 22 : 30, height: isPhone ? 22 : 30, borderRadius: 999, background: '#75624B', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 2px #FFFFFF' }}><Icon name="photo_camera" size={isPhone ? 14 : 18} /></span>
            </button>
          );
        })()}
        <div style={{ flex: isPhone ? '1 1 0' : '1 1 260px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: isPhone ? 2 : 4 }}>
          <div className="cp-eyebrow1" style={{ fontSize: FONT_SMALL, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 500, color: '#6A6967', lineHeight: '18px' }}>
            {t('profile.eyebrow', { p: plan === 'flex' ? t('profile.planFlex') : t('profile.planGold'), d: since ? fmt.fmonth(ym(since), true) : '—' })}
          </div>
          <h1 style={{ margin: 0, fontSize: 36, lineHeight: '44px', fontWeight: 400, letterSpacing: '-0.5px', color: '#9A836C' }}>{memberName(m)}</h1>
          {sub ? <div style={{ fontSize: isPhone ? 15 : 16, lineHeight: '22px', color: '#6A6967' }}>{sub}</div> : null}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: isPhone ? 6 : 8, alignItems: 'center', ...(isPhone ? { flex: '1 1 100%' } : {}) }}>
          <span style={{ ...pill, background: stl.bg, color: stl.fg }}>
            <Icon name={stl.icon} size={20} fill={1} />
            {statusText(t, st, fmt.fds)}
          </span>
          {isNewMember(m, today) && !isPending ? <span style={{ ...pill, background: '#E6EFE8', color: '#3D6B4F' }}><Icon name="fiber_new" size={20} fill={1} />{t('profile.newMember')}</span> : null}
          {ending && !ended ? <span style={{ ...pill, background: '#282828', color: '#FFFFFF' }}><Icon name="event_busy" size={20} />{t('profile.endingOn', { d: fmt.fds(ending) })}</span> : null}
          {ended ? <span style={{ ...pill, background: '#282828', color: '#FFFFFF' }}><Icon name="archive" size={20} />{t('profile.endedText', { d: fmt.fds(cur.lastDay || today), r: cur.endReason ? endReasonLabel(t, cur.endReason) : '' })}</span> : null}
          {isPhone ? null : membershipActions}
          {lr && !isPending ? (
            <span style={{ ...pill, background: lr.status === 'alert' ? '#AF4B2F' : lr.status === 'watch' ? '#F6ECD6' : '#E6EFE8', color: lr.status === 'alert' ? '#FFFFFF' : lr.status === 'watch' ? '#7A5510' : '#3D6B4F' }}>
              <Icon name={lr.status === 'alert' ? 'warning' : lr.status === 'watch' ? 'visibility' : 'check_circle'} size={20} fill={1} />
              {t('status.' + lr.status)} · {lr.sys}/{lr.dia}
            </span>
          ) : null}
          {isPhone && hasEditBar && canEdit ? (
            <button type="button" className="dh38" aria-label={editLabel} title={editLabel} onClick={() => setDlg({ kind: editCfg!.dlg })} style={{ marginLeft: 'auto', width: 40, height: 40, borderRadius: 999, border: '1px solid #75624B', background: '#FFFFFF', color: '#75624B', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flex: 'none', padding: 0 }}>
              <Icon name={tab === 'family' ? 'person_add' : 'edit'} size={20} />
            </button>
          ) : null}
        </div>
      </div>
      {isPending && !family ? (
        <div role="status" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px 14px', borderRadius: 16, background: '#F6ECD6', color: '#282828', fontSize: 16, lineHeight: '22px' }}>
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
      <ScrollTabs tabs={tabItems} current={tab} onChange={(k) => go(k as ProfileTab)} wrap={false} phone={isPhone} label={t('profile.tabs')} pendingLabel={t('common.pendingReview')} leftLabel={t('profile.scrollLeft')} rightLabel={t('profile.scrollRight')} />
      {hasEditBar && !isPhone ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginTop: -6 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>
            <Icon name={canEdit ? 'history' : 'lock'} size={18} color="#75624B" />
            {editNote}
          </span>
          {canEdit ? (
            <button type="button" className="dh38" onClick={() => setDlg({ kind: editCfg!.dlg })} style={{ height: 44, padding: '0 18px 0 14px', borderRadius: 999, border: '1px solid #75624B', background: '#FFFFFF', color: '#75624B', fontSize: 16, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'Inter' }}>
              <Icon name={tab === 'family' ? 'person_add' : 'edit'} size={18} />
              {editLabel}
            </button>
          ) : null}
        </div>
      ) : null}
      <div role="tabpanel" aria-label={t('profile.tab.' + tab)} style={{ display: 'flex', flexDirection: 'column', gap: isPhone ? 12 : 16 }}>
        <Content p={p} />
      </div>
      {/* phone: the membership actions sit below the content, not in the header */}
      {isPhone ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>{membershipActions}</div> : null}
      {photoSheet ? <ProfilePhotoSheet m={m} mgmt={mgmt} open onClose={() => setPhotoSheet(false)} /> : null}
      {dlg ? <MemberDialog p={p} kind={dlg.kind} familyId={dlg.familyId} onClose={() => setDlg(null)} /> : null}
    </div>
  );
}

