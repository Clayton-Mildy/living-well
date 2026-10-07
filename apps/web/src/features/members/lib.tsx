// Members area: shared labels, status styles and small helpers used by the list, the profile and the reviews screen.
import type { CSSProperties } from 'react';
import { memberName, memberShort, sessionsOn, type ChangeRequest, type ClubState, type DailyLog, type Diet, type DocType, type DrugAllergy, type EndReason, type FoodAllergen, type Health, type Lang, type Member, type MedTiming, type Mobility, type Relation } from '@cp/shared';
import { plainName, type MemberStatus } from '@cp/shared/rules/members';
import type { TFn } from '../../lib/i18n';

// ---------- enum labels (stored data keeps keys; text comes from i18n) ----------
export const foodLabel = (t: TFn, a: FoodAllergen) => t(`profile.food.${a}`);
export const drugLabel = (t: TFn, d: DrugAllergy) => (d.startsWith('other:') ? d.slice(6) : t(`profile.drug.${d}`));
export const mobLabel = (t: TFn, m: Mobility | null | undefined) => (m ? t(`profile.mobility.${m}`) : t('profile.mobility.none'));
export const dietLabel = (t: TFn, d: Diet) => t(`profile.diet.${d}`);
export const timingLabel = (t: TFn, x: MedTiming) => t(`profile.timing.${x}`);
export const relLabel = (t: TFn, r: Relation) => t(`profile.rel.${r}`);
export const docLabel = (t: TFn, d: DocType) => t(`profile.doc.${d}`);
/** Cognitive status: free text, except the standard phrase, which is shown in the reader's language. */
export const cogText = (t: TFn, summary: string | undefined) => (!summary ? t('profile.cognitiveTbd') : summary === 'Alert and oriented' ? t('activity.cogAlert') : summary);
export const endReasonLabel = (t: TFn, r: EndReason) => t(`profile.endReason.${r}`);
export const MOB_ICON: Record<Mobility, string> = { walkingStick: 'elderly', walker: 'assist_walker', wheelchair: 'accessible' };
export const foodList = (t: TFn, m: Pick<Member, 'health'>) => [...m.health.food.map((a) => foodLabel(t, a)), ...(m.health.foodOther ? [m.health.foodOther] : [])];

/** Allergy, mobility, diet and lunchtime-medicine chips (design flags()). */
export interface FlagChip { icon: string; label: string; bg: string; ic: string }
export function flagChips(t: TFn, m: Member, withMeds: boolean): FlagChip[] {
  const out: FlagChip[] = foodList(t, m).map((label) => ({ icon: 'no_food', label, bg: '#F9E3DB', ic: '#9A3D24' }));
  if (m.health.mobility) out.push({ icon: MOB_ICON[m.health.mobility], label: mobLabel(t, m.health.mobility), bg: '#F3EEE8', ic: '#24201C' });
  for (const d of m.health.diet) out.push({ icon: 'restaurant', label: dietLabel(t, d), bg: '#F3EEE8', ic: '#24201C' });
  if (m.health.diabetic) out.push({ icon: 'water_drop', label: t('profile.diabetic'), bg: '#F3EEE8', ic: '#24201C' });
  if (withMeds) {
    for (const a of m.health.drugs) out.push({ icon: 'medication', label: t('profile.drugAllergy', { d: drugLabel(t, a) }), bg: '#F9E3DB', ic: '#9A3D24' });
    for (const x of m.health.meds.filter((q) => q.timing === 'lunchClub')) out.push({ icon: 'medication', label: t('profile.lunchMed', { m: `${x.name} ${x.dose}`.trim() }), bg: '#F3EEE8', ic: '#24201C' });
  }
  return out;
}

// ---------- status ----------
export interface StatusStyle { icon: string; bg: string; fg: string; dot: string }
export const STATUS_STYLE: Record<MemberStatus['key'], StatusStyle> = {
  pending: { icon: 'hourglass_top', bg: '#F6ECD6', fg: '#7A5510', dot: '#7A5510' },
  ended: { icon: 'archive', bg: '#F0EAE1', fg: '#24201C', dot: '#5E5852' },
  upcoming: { icon: 'event_upcoming', bg: '#F3EEE8', fg: '#24201C', dot: '#8A755B' },
  home: { icon: 'home', bg: '#F3EEE8', fg: '#24201C', dot: '#5E5852' },
  in: { icon: 'check_circle', bg: '#E3EFE6', fg: '#3D6B4F', dot: '#3D6B4F' },
  closed: { icon: 'event', bg: '#F3EEE8', fg: '#24201C', dot: '#E4DACD' },
  off: { icon: 'schedule', bg: '#F3EEE8', fg: '#24201C', dot: '#CAB8A2' },
};
export function statusText(t: TFn, st: MemberStatus, fds: (d: string) => string): string {
  switch (st.key) {
    case 'pending': return t('common.pendingApproval');
    case 'ended': return t('members.st.ended', { d: fds(st.on) });
    case 'upcoming': return t('members.st.upcoming', { d: fds(st.on) });
    case 'home': return t('members.st.home', { t: st.at });
    case 'in': return t('members.st.in', { t: st.at });
    case 'closed': return t('common.clubClosed');
    // not here (yet) today: nobody is expected, so the usual arrival is shown as information only
    default: return st.usual ? t('members.st.usually', { t: st.usual }) : t('members.st.off');
  }
}
/** The status line of a compact list row: where the member is now ("In the club since 09:48"), or when they last came. */
export function rowStatusText(t: TFn, st: MemberStatus, last: string | undefined, fds: (d: string) => string): string {
  if (st.key === 'off' || st.key === 'closed') return last ? t('members.lastVisit', { d: fds(last) }) : t('members.neverVisited');
  return statusText(t, st, fds);
}
export const healthLabel = (t: TFn, h: Health) => t('status.' + h);

// ---------- text helpers ----------
export const fullName = (m: Member) => memberName(m);
export const nameField = (m: Member) => plainName(m);
export const mmss = (sec?: number) => (sec == null ? '' : `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`);
/** Today shows only the time; other days show date and time. */
export function whenText(fds: (d: string) => string, today: string, dt: string, t: TFn) {
  const day = dt.slice(0, 10);
  return day === today ? `${t('common.today')} ${dt.slice(11, 16)}` : `${fds(day)} · ${dt.slice(11, 16)}`;
}
/** The nav the profile came from: navigate(-1) when there is history to go back to. */
export const canGoBack = () => { try { return ((window.history.state as { idx?: number } | null)?.idx ?? 0) > 0; } catch { return false; } };

// ---------- style atoms from the design ----------
/** Horizontal inset of a v3 card: rows and hairlines sit inside it, never edge to edge. */
export const CARD_PX = 'clamp(18px, 3vw, 28px)';
export const HAIR = '1px solid #F0EAE1';
export const cardStyle: CSSProperties = { background: '#FFFFFF', border: '1px solid #EFE7DC', borderRadius: 16, boxShadow: 'var(--card-shadow)', padding: `20px ${CARD_PX}`, display: 'flex', flexDirection: 'column', gap: 16 };
/** A card whose rows carry their own hairlines: rows use `padding: 'Ypx 0'` and a top hairline, the card supplies the side inset. */
export const listCardStyle: CSSProperties = { background: '#FFFFFF', border: '1px solid #EFE7DC', borderRadius: 16, boxShadow: 'var(--card-shadow)', padding: `0 ${CARD_PX}`, overflow: 'hidden' };
export const pillBtn: CSSProperties = { height: 40, padding: '0 16px', borderRadius: 12, border: '1px solid #DCD3C8', background: '#FFFFFF', color: '#24201C', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, whiteSpace: 'nowrap' };
/** Quiet underlined link (bronze), used for small secondary actions. */
export const linkBtn: CSSProperties = { border: 'none', background: 'transparent', padding: 0, color: '#75624B', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter', textDecoration: 'underline', textUnderlineOffset: 4 };
export const sectionOf = (cr: ChangeRequest) => cr.section;
/** Who a request is about: the member, or for a lead that is joining, the lead. */
export function crMemberName(s: ClubState, cr: ChangeRequest) {
  if (cr.target.memberId && s.members[cr.target.memberId]) return memberName(s.members[cr.target.memberId]);
  const lead = cr.target.type === 'enquiry' ? s.enquiries[cr.target.id] : undefined;
  return lead ? `${lead.senior.title} ${lead.senior.name}` : '';
}

/** The family-visible note of a daily log, or the design's calm-day sentence naming the day's first activity. */
export function logNote(s: ClubState, t: TFn, lang: Lang, m: Member, l: DailyLog) {
  if (l.note) return l.note;
  const cell = sessionsOn(s, l.date)[0]?.cell;
  const a = cell ? s.activities[cell.activityId] : undefined;
  const name = a ? (lang === 'id' && a.nameId ? a.nameId : a.name).toLowerCase() : t('profile.theActivities');
  return t('family.calmDay', { n: memberShort(m), a: name });
}
/** An activity name stored as English text, shown in the current language when the catalog knows it. */
export function activityLabel(s: ClubState, lang: Lang, name: string | undefined) {
  if (!name) return '';
  const a = Object.values(s.activities).find((x) => x.name === name);
  return a ? (lang === 'id' && a.nameId ? a.nameId : a.name) : name;
}
