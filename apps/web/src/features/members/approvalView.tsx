// What one entry waiting for approval looks like in the Approvals screen: a short summary line and the full view (old → new for edits).
// Pure view-model: the screen renders the pieces. Profile changes use describeCr (reviewDiff.ts).
import { memberName, memberShort, type ClubState, type DailyLog, type Lang, type MemberNote, type Reading, type Slot } from '@cp/shared';
import type { ApprovalItem, ApprovalType, HistoryItem } from '@cp/shared/rules/approvals';
import { APPROVAL_TYPES, DAYMENU_KEYS, isWaiting } from '@cp/shared/rules/approvals';
import { diffTemplates, templateOn, weekDate, type WeekTemplate } from '@cp/shared/rules/kitchenOps';
import type { TFn } from '../../lib/i18n';
import { activityName, roundsOf } from '@cp/shared/rules/activity';
import { CHECK_KEY } from '../health/ReadingCard';
import { values as readingValues } from './profile/CareTab';
import { describeCr, type Described, type DiffRow } from './reviewDiff';

interface Fmt { fdy: (d: string) => string; fds: (d: string) => string; fd: (d: string, o: Intl.DateTimeFormatOptions) => string; lang?: Lang }
type Entry = Pick<ApprovalItem, 'id' | 'sub' | 'memberId'>;

export interface ItemView {
  /** the member's name (empty for the menu and stock) */
  who: string;
  /** what it is: "Daily log", "Weekly menu" … */
  kind: string;
  /** one line: what was entered */
  summary: string;
  /** the full view */
  detail: Described;
  /** an edit of something already approved */
  edit: boolean;
}

const dash = '—';
const dishList = (s: ClubState, ids: string[] | undefined, t: TFn) => (ids && ids.length ? ids.map((id) => s.dishes[id]?.name || id).join(', ') : t('approvals.none'));

function logView(s: ClubState, l: DailyLog, t: TFn, fmt: Fmt): ItemView {
  const prev = l.approval?.prev as Partial<DailyLog> | undefined;
  const mem = (k: string, o: Partial<DailyLog> | undefined) => (o && (o as Record<string, unknown>)[k] !== undefined ? t(`activity.opt.${k}.${(o as Record<string, string>)[k]}`) : undefined);
  // KC round 7: a log is filled in rounds (lunch, each session, mood and notes): one row per part that is marked now or was before
  const rounds = roundsOf(s, l.date);
  const slots = Array.from(new Set([...Object.keys(l.sessions ?? {}), ...Object.keys(prev?.sessions ?? {})])).sort() as Slot[];
  const sessionName = (slot: Slot) => `${slot} · ${activityName(rounds.find((r) => r.id === slot)?.session?.activity, fmt.lang ?? 'en') || t('activity.row.joined')}`;
  const side = (o: Partial<DailyLog> | undefined, slot: Slot) => (o?.sessions?.[slot] ? t(`activity.opt.session.${o.sessions[slot]}`) : undefined);
  const part = (label: string, from: string | undefined, to: string | undefined): DiffRow[] => (from === undefined && to === undefined ? [] : [{ label, ...(prev ? { from: from ?? dash } : {}), to: to ?? dash }]);
  const legacyJoined = !l.sessions && !prev?.sessions ? part(t('activity.row.joined'), mem('joined', prev), mem('joined', l)) : [];
  const rows: DiffRow[] = [
    ...part(t('activity.row.mood'), mem('mood', prev), mem('mood', l)), ...part(t('activity.row.lunch'), mem('lunch', prev), mem('lunch', l)),
    ...slots.flatMap((slot) => part(sessionName(slot), side(prev, slot), side(l, slot))), ...legacyJoined,
    ...part(t('activity.row.communicative'), mem('communicative', prev), mem('communicative', l)), ...part(t('activity.row.content'), mem('content', prev), mem('content', l)),
  ];
  rows.push({ label: t('approvals.noteLabel'), ...(prev ? { from: prev.note || dash } : {}), to: l.note || dash });
  const sessionBits = slots.filter((slot) => l.sessions?.[slot]).map((slot) => `${activityName(rounds.find((r) => r.id === slot)?.session?.activity, fmt.lang ?? 'en') || slot} ${t(`activity.opt.session.${l.sessions![slot]}`).toLowerCase()}`);
  const summary = [fmt.fds(l.date), mem('mood', l), mem('lunch', l), ...sessionBits, l.note].filter(Boolean).join(' · ');
  return { who: s.members[l.memberId] ? memberName(s.members[l.memberId]) : '', kind: t('approvals.kind.log'), summary, detail: { title: t('approvals.kind.log'), rows: prev ? rows : [], summary: prev ? [] : rows }, edit: !!prev };
}
function noteView(s: ClubState, n: MemberNote, t: TFn): ItemView {
  const prev = n.approval?.prev as Partial<MemberNote> | undefined;
  const rows: DiffRow[] = [{ label: t('approvals.noteLabel'), ...(prev ? { from: prev.text || dash } : {}), to: n.text }];
  if (n.pinned || prev?.pinned) rows.push({ label: t('approvals.pinned'), ...(prev ? { from: prev.pinned ? t('common.yes') : t('common.no') } : {}), to: n.pinned ? t('common.yes') : t('common.no') });
  return { who: s.members[n.memberId] ? memberName(s.members[n.memberId]) : '', kind: t('approvals.kind.note'), summary: n.text, detail: { title: t('approvals.kind.note'), rows: prev ? rows : [], summary: prev ? [] : rows }, edit: !!prev };
}
function readingView(s: ClubState, r: Reading, t: TFn, fmt: Fmt): ItemView {
  const prev = r.approval?.prev as Partial<Reading> | undefined;
  const now = readingValues(r, t) || dash;
  const blank = { sys: undefined, dia: undefined, pulse: undefined, spo2: undefined, temp: undefined, glucose: undefined, weight: undefined, grip: undefined };
  const rows: DiffRow[] = [{ label: t(CHECK_KEY[r.kind]), ...(prev ? { from: readingValues({ ...r, ...blank, ...prev } as Reading, t) || dash } : {}), to: now }];
  if (r.note) rows.push({ label: t('common.note'), to: r.note });
  const m = r.memberId ? s.members[r.memberId] : undefined;
  return { who: m ? memberName(m) : '', kind: t('approvals.kind.reading'), summary: `${fmt.fds(r.date)} ${r.time} · ${now}`, detail: { title: t('approvals.kind.reading'), rows: prev ? rows : [], summary: prev ? [] : rows }, edit: !!prev };
}
/** The approved weekly menu in force when a pending version starts (what the version changes). */
function approvedTemplate(s: ClubState, from: string): WeekTemplate {
  const sub = { ...s, menuVersions: Object.fromEntries(Object.values(s.menuVersions).filter((v) => !isWaiting(v) && v.approval?.status !== 'rejected').map((v) => [v.id, v])) } as ClubState;
  return templateOn(sub, from).days;
}
function versionView(s: ClubState, id: string, t: TFn, fmt: Fmt): ItemView {
  const v = s.menuVersions[id];
  if (!v) return { who: '', kind: t('approvals.kind.version'), summary: '', detail: { title: '', rows: [], summary: [] }, edit: false };
  const changes = diffTemplates(approvedTemplate(s, v.effectiveFrom), v.days);
  const rows: DiffRow[] = changes.map((c) => ({
    label: `${fmt.fd(weekDate('2024-01-01', c.weekday), { weekday: 'long' })} · ${t('kitchen.course.' + c.course)}`,
    to: [c.added.length ? `${t('approvals.plus')}: ${dishList(s, c.added, t)}` : '', c.removed.length ? `${t('approvals.minus')}: ${dishList(s, c.removed, t)}` : ''].filter(Boolean).join('\n'),
  }));
  const head = t('approvals.sum.menuVersion', { date: fmt.fdy(v.effectiveFrom) });
  return { who: '', kind: t('approvals.kind.version'), summary: `${head} · ${changes.length ? t('approvals.sum.menuChanges', { n: changes.length }) : t('approvals.sum.menuSame')}`, detail: { title: head, rows: [], summary: rows }, edit: false };
}
function dayMenuView(s: ClubState, id: string, t: TFn, fmt: Fmt): ItemView {
  const o = s.dayMenus[id];
  if (!o) return { who: '', kind: t('approvals.kind.dayMenu'), summary: '', detail: { title: '', rows: [], summary: [] }, edit: false };
  const prev = (o.approval?.prev || {}) as Record<string, string[] | undefined>;
  const rows: DiffRow[] = [];
  for (const c of DAYMENU_KEYS) {
    const now = (o as unknown as Record<string, string[] | undefined>)[c];
    if (!now && !prev[c]) continue;
    rows.push({ label: t('kitchen.course.' + c), from: prev[c] ? dishList(s, prev[c], t) : t('approvals.fromTemplate'), to: now ? dishList(s, now, t) : t('approvals.fromTemplate') });
  }
  const head = t('approvals.sum.dayMenu', { date: fmt.fds(o.date) });
  const first = DAYMENU_KEYS.map((c) => (o as unknown as Record<string, string[] | undefined>)[c]).find(Boolean);
  return { who: '', kind: t('approvals.kind.dayMenu'), summary: `${head}${first ? ' · ' + dishList(s, first, t) : ''}`, detail: { title: head, rows, summary: [] }, edit: DAYMENU_KEYS.some((c) => prev[c]) };
}
function stockView(s: ClubState, id: string, t: TFn): ItemView {
  const k = s.stockRequests[id];
  if (!k) return { who: '', kind: t('approvals.kind.stock'), summary: '', detail: { title: '', rows: [], summary: [] }, edit: false };
  const rows: DiffRow[] = [
    { label: t('approvals.area'), to: t('kitchen.area.' + k.area) },
    { label: t('approvals.requestedBy'), to: s.staff[k.requestedBy]?.name || k.requestedBy },
    ...(k.note ? [{ label: t('common.note'), to: k.note }] : []),
  ];
  const summary = t('approvals.sum.stock', { item: k.item, qty: k.qty, unit: k.unit });
  return { who: '', kind: t('approvals.kind.stock'), summary, detail: { title: summary, rows: [], summary: rows }, edit: false };
}

/** KC round 7: a renewal change recorded by the front desk: what the family decided, from which month, with the reason for a stop and the note. */
function renewalView(s: ClubState, id: string, t: TFn, fmt: Fmt): ItemView {
  const f = s.followUps?.[id];
  const blank = { who: '', kind: t('approvals.kind.renewal'), summary: '', detail: { title: '', rows: [], summary: [] }, edit: false };
  if (!f?.outcome) return blank;
  const m = s.members[f.memberId];
  const monthName = (x: string) => fmt.fd(`${x}-01`, { month: 'long' });
  const summary = f.outcome === 'upgrade' ? t('approvals.sum.renewalUpgrade', { month: fmt.fd(`${f.month}-01`, { month: 'long', year: 'numeric' }) })
    : f.outcome === 'downgrade' ? t('approvals.sum.renewalDowngrade', { month: fmt.fd(`${f.month}-01`, { month: 'long', year: 'numeric' }) })
    : f.outcome === 'leave' ? t('approvals.sum.renewalLeave', { months: (f.leaveMonths ?? []).map(monthName).join(', ') })
    : f.outcome === 'stop' ? t('approvals.sum.renewalStop', { date: fmt.fds(f.lastDay ?? '') })
    : t(`renewals.outcome.${f.outcome}`);
  const rows: DiffRow[] = [
    { label: t('approvals.renewalChange'), to: summary },
    { label: t('approvals.renewalMonth'), to: fmt.fd(`${f.month}-01`, { month: 'long', year: 'numeric' }) },
    ...(f.outcome === 'stop' ? [{ label: t('approvals.renewalReason'), to: t(`profile.endReason.${f.endReason ?? 'familyDecision'}`) }] : []),
    ...(f.note ? [{ label: t('common.note'), to: f.note }] : []),
  ];
  return { who: m ? memberName(m) : '', kind: t('approvals.kind.renewal'), summary: f.note ? `${summary} · ${f.note}` : summary, detail: { title: t('approvals.kind.renewal'), rows: [], summary: rows }, edit: false };
}

/** The view of one entry: pending (ApprovalItem) or handled (HistoryItem). Profile changes are described by describeCr. */
export function itemView(s: ClubState, it: Entry, t: TFn, fmt: Fmt): ItemView {
  switch (it.sub) {
    case 'log': { const l = s.dailyLogs[it.id]; if (l) return logView(s, l, t, fmt); break; }
    case 'note': { const n = s.memberNotes[it.id]; if (n) return noteView(s, n, t); break; }
    case 'reading': { const r = s.readings[it.id]; if (r) return readingView(s, r, t, fmt); break; }
    case 'version': return versionView(s, it.id, t, fmt);
    case 'dayMenu': return dayMenuView(s, it.id, t, fmt);
    case 'stock': return stockView(s, it.id, t);
    case 'renewal': return renewalView(s, it.id, t, fmt);
    case 'cr': case 'flag': {
      const cr = s.changeRequests[it.id];
      if (cr) {
        const d = describeCr(cr, s, t, fmt);
        const m = cr.target.memberId ? s.members[cr.target.memberId] : undefined;
        return { who: m ? memberName(m) : '', kind: d.title, summary: [...d.summary, ...d.rows].map((r) => (r.from !== undefined && r.to !== undefined && r.from !== r.to ? `${r.label}: ${r.from} → ${r.to}` : `${r.label}: ${r.to ?? r.from ?? ''}`)).join(' · '), detail: d, edit: cr.op !== 'create' };
      }
      break;
    }
    default: break;
  }
  return { who: '', kind: t('approvals.kind.' + it.sub), summary: '', detail: { title: '', rows: [], summary: [] }, edit: false };
}
export type { HistoryItem };

// ---------- KC round 6: the per-person view of Approvals ----------
export interface PersonGroup { memberId: string; items: ApprovalItem[] }
/** Everything waiting, grouped by the member it is about: profile changes, care logs and notes, health readings and solo photos.
 *  Group photos, activity pictures (of a session, no members) and other multi-member photos get their own section ("Group & activity photos"); menu and stock are not about a member, so they go to "Other". */
export function groupByPerson(s: ClubState, items: Record<ApprovalType, ApprovalItem[]>): { people: PersonGroup[]; groupPhotos: ApprovalItem[]; other: ApprovalItem[] } {
  const by = new Map<string, ApprovalItem[]>();
  const groupPhotos: ApprovalItem[] = [];
  const other: ApprovalItem[] = [];
  for (const type of APPROVAL_TYPES) {
    for (const it of items[type] || []) {
      if (type === 'menu' || type === 'stock') { other.push(it); continue; }
      let mid = it.memberId;
      if (type === 'photos') {
        const ph = s.photos[it.id];
        mid = ph && ph.kind === 'solo' && ph.memberIds.length === 1 ? ph.memberIds[0] : undefined;
        if (!mid) { groupPhotos.push(it); continue; }
      }
      if (type === 'profile' && !mid) mid = s.changeRequests[it.id]?.target.memberId;
      if (!mid || !s.members[mid]) { other.push(it); continue; }
      by.set(mid, [...(by.get(mid) || []), it]);
    }
  }
  const people = [...by].map(([memberId, list]) => ({ memberId, items: list }))
    .sort((a, b) => (s.members[a.memberId].firstName || '').localeCompare(s.members[b.memberId].firstName || '') || memberShort(s.members[a.memberId]).localeCompare(memberShort(s.members[b.memberId]))); // by first name, not by title (Bapak / Ibu / Oma)
  return { people, groupPhotos, other };
}
