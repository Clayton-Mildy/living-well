// Super search: the registry (every screen and action declares its keywords here, so a new feature is searchable with one entry)
// and the role-gated index built from it and from the synced club state. Ranking lives in lib/search.ts.
import { approvedMembers, displayName, invoiceTotal, live, memberName, planLabel, rp, type ClubState, type Lang, type Role } from '@cp/shared';
import type { SearchItem } from '../lib/search';
import { NAVS, allowedKeys } from './nav';

export interface ScreenEntry { key: string; label: string; icon: string; keywords: { en: string[]; id: string[] } }
export interface ActionEntry { id: string; label: string; icon: string; roles: Role[]; to: (role: Role) => string; keywords: { en: string[]; id: string[] } }

const sc = (key: string, label: string, icon: string, en: string[], id: string[]): ScreenEntry => ({ key, label: 'nav.' + label, icon, keywords: { en, id } });

/** One row per screen key; the label and icon are the fallback for a role whose own nav has no such item (the role's own nav label wins). */
export const SCREEN_ENTRIES: ScreenEntry[] = [
  sc('today', 'today', 'wb_sunny', ['today', 'home', 'arrivals', 'check in'], ['hari ini', 'beranda', 'kedatangan', 'absen']),
  sc('members', 'members', 'groups', ['members', 'seniors', 'oma', 'opa', 'profile'], ['anggota', 'lansia', 'profil']),
  sc('reviews', 'reviews', 'fact_check', ['approvals', 'review', 'pending'], ['persetujuan', 'setujui']),
  sc('tasks', 'tasks', 'checklist', ['tasks', 'duties', 'to do', 'leave'], ['tugas', 'cuti']),
  sc('report', 'report', 'summarize', ['daily report'], ['laporan harian']),
  sc('monthReport', 'monthReport', 'query_stats', ['month report', 'monthly'], ['laporan bulanan']),
  sc('enquiries', 'enquiries', 'contact_phone', ['enquiries', 'leads', 'prospects', 'trial'], ['prospek', 'calon', 'uji coba']),
  sc('renewals', 'renewals', 'event_repeat', ['next month', 'renewals', 'unpaid', 'overdue'], ['bulan depan', 'perpanjang', 'belum bayar', 'tunggakan']),
  sc('hchecks', 'health', 'monitor_heart', ['health checks', 'blood pressure', 'vitals'], ['cek kesehatan', 'tensi', 'tekanan darah']),
  sc('readings', 'readings', 'monitoring', ['readings', 'trends'], ['hasil cek', 'tren']),
  sc('log', 'log', 'edit_note', ['daily log', 'mood', 'notes'], ['catatan harian', 'suasana hati']),
  sc('camera', 'camera', 'photo_camera', ['camera', 'photos', 'pictures'], ['kamera', 'foto']),
  sc('photos', 'photos', 'photo_library', ['photo library', 'gallery'], ['galeri foto']),
  sc('menu', 'menu', 'restaurant', ['menu', 'dishes', 'food', 'allergy'], ['makanan', 'hidangan', 'alergi']),
  sc('lunch', 'lunch', 'lunch_dining', ['lunch round', 'who ate'], ['makan siang']),
  sc('feedback', 'feedback', 'forum', ['feedback', 'complaints'], ['masukan', 'keluhan']),
  sc('stock', 'stock', 'inventory_2', ['stock', 'supplies', 'inventory'], ['stok', 'persediaan']),
  sc('billing', 'billing', 'payments', ['billing', 'invoice', 'bills'], ['tagihan', 'invoice', 'faktur', 'bayar']),
  sc('payments', 'payments', 'account_balance', ['payments', 'transfer', 'virtual account'], ['pembayaran', 'bayar', 'transfer']),
  sc('budget', 'budget', 'pie_chart', ['budget'], ['anggaran']),
  sc('receipts', 'receipts', 'receipt_long', ['receipts', 'nota', 'purchases'], ['nota', 'kuitansi', 'belanja']),
  sc('spending', 'spending', 'shopping_cart', ['spending', 'expenses', 'purchases', 'items bought'], ['pengeluaran', 'biaya', 'pembelian', 'belanja']),
  sc('calendar', 'calendar', 'calendar_month', ['calendar', 'schedule', 'programme', 'activities'], ['kalender', 'jadwal', 'kegiatan']),
  sc('guests', 'guests', 'co_present', ['guest hosts', 'teachers', 'performers'], ['pengisi acara', 'tamu']),
  sc('insights', 'insights', 'insights', ['insights', 'statistics'], ['statistik', 'wawasan']),
  sc('broadcast', 'broadcast', 'campaign', ['broadcast', 'announcement', 'message'], ['pengumuman', 'siaran']),
  sc('venue', 'venue', 'storefront', ['venue', 'bookings', 'rental'], ['sewa tempat', 'pemesanan']),
  sc('hr', 'people', 'badge', ['people', 'staff', 'team', 'hr'], ['karyawan', 'staf', 'tim']),
  sc('directory', 'directory', 'contacts', ['directory', 'suppliers', 'doctors'], ['direktori', 'pemasok', 'dokter']),
  sc('contacts', 'contacts', 'contacts', ['contacts', 'phone numbers'], ['kontak', 'nomor telepon']),
  sc('surveys', 'surveys', 'rate_review', ['surveys'], ['survei']),
  sc('plans', 'plans', 'sell', ['plans', 'pricing', 'prices'], ['paket', 'harga']),
  sc('requests', 'requests', 'add_shopping_cart', ['requests', 'stock request', 'budget request'], ['permintaan']),
  { key: 'drafts', label: 'drafts.title', icon: 'drafts', keywords: { en: ['drafts'], id: ['draf'] } },
];

const ALL_STAFF: Role[] = ['lobby', 'nurse', 'activity', 'kitchen', 'finance', 'mgmt'];
const act = (id: string, icon: string, roles: Role[], to: ActionEntry['to'], en: string[], idk: string[]): ActionEntry => ({ id, label: 'search.act.' + id, icon, roles, to, keywords: { en, id: idk } });

export const ACTION_ENTRIES: ActionEntry[] = [
  act('addMember', 'person_add', ['lobby', 'mgmt'], () => '/members?do=add', ['add member', 'register', 'new member', 'join'], ['tambah anggota', 'daftar', 'pendaftaran']),
  act('recordPayment', 'account_balance', ['finance', 'mgmt'], () => '/payments', ['record payment', 'paid', 'transfer', 'cash'], ['catat pembayaran', 'bayar', 'lunas', 'tunai']),
  act('requestLeave', 'beach_access', ALL_STAFF, () => '/tasks', ['leave', 'day off', 'holiday'], ['cuti', 'izin', 'libur']),
  act('newCelebration', 'cake', ['lobby', 'activity', 'mgmt'], () => '/celebrations', ['birthday', 'celebration', 'party'], ['ulang tahun', 'perayaan', 'pesta']),
  act('submitReceipt', 'receipt_long', ALL_STAFF, (r) => (r === 'finance' || r === 'mgmt' ? '/receipts?do=snap' : '/requests?do=receipt'), ['receipt', 'nota', 'purchase', 'snap'], ['nota', 'kuitansi', 'belanja', 'foto nota']),
];

/** Which registry row a role's `today` key stands for (its nav label names the screen: Arrivals, Menu, Billing, Health checks). */
const TODAY_ROW: Record<string, string> = { 'nav.menu': 'menu', 'nav.billing': 'billing', 'nav.health': 'hchecks' };

/** Where "Billing" is for a role: finance's Billing is its `today`, management's is `billing`; null when the role has none. */
const billingPath = (role: Role): string | null => {
  const keys = allowedKeys(role);
  return role === 'finance' && keys.has('today') ? '/today' : keys.has('billing') ? '/billing' : null;
};
/** The role's Menu screen: the kitchen reaches it through `today`. */
const menuPath = (role: Role): string | null => (allowedKeys(role).has('menu') ? '/menu' : role === 'kitchen' ? '/today' : null);

const kw = (k: { en: string[]; id: string[] }) => [...k.en, ...k.id];
type T = (k: string, p?: Record<string, string | number>) => string;

export function buildSearchIndex(s: ClubState, role: Role, t: T, lang: Lang = 'en'): SearchItem[] {
  const keys = allowedKeys(role);
  const out: SearchItem[] = [];
  const rows = new Map(SCREEN_ENTRIES.map((e) => [e.key, e]));

  // Screens: the role's own nav label wins ("today" is Arrivals, Menu or Billing); a today key carries its own screen's keywords
  for (const e of SCREEN_ENTRIES) {
    if (!keys.has(e.key)) continue;
    const nav = NAVS[role].find((n) => n.key === e.key);
    const label = nav?.label ?? e.label;
    const row = e.key === 'today' ? rows.get(TODAY_ROW[label] ?? 'today')! : e;
    out.push({ id: 'screen:' + e.key, group: 'screens', label: t(label), icon: nav?.icon ?? row.icon, to: '/' + e.key, terms: kw(row.keywords) });
  }
  for (const a of ACTION_ENTRIES) if (a.roles.includes(role)) out.push({ id: 'action:' + a.id, group: 'actions', label: t(a.label), icon: a.icon, to: a.to(role), terms: kw(a.keywords) });

  // People
  const mName = (id: string) => { const m = s.members[id]; return m ? displayName(m) : ''; };
  if (keys.has('members')) {
    for (const m of approvedMembers(s)) {
      out.push({ id: 'member:' + m.id, group: 'people', label: displayName(m), sub: planLabel(s, m.plans[m.plans.length - 1]?.plan ?? 'flex', lang), icon: 'person', to: '/members/' + m.id, terms: [memberName(m), m.registration?.nickname ?? ''] });
    }
    const links = live(s.familyLinks);
    for (const c of live(s.familyContacts)) {
      const mine = links.filter((l) => l.familyId === c.id && s.members[l.memberId] && !s.members[l.memberId]!.deletedAt);
      const first = mine.find((l) => l.primary) ?? mine[0];
      if (!first) continue;
      out.push({
        id: 'contact:' + c.id, group: 'people', label: c.name, sub: t('search.familyOf', { name: mName(first.memberId) }), icon: 'family_restroom', to: `/members/${first.memberId}/family`,
        terms: mine.flatMap((l) => [`${l.relation} ${mName(l.memberId)}`, `${t('lobby.rel.' + l.relation)} ${mName(l.memberId)}`]),
      });
    }
  }
  if (keys.has('hr')) for (const x of live(s.staff)) out.push({ id: 'staff:' + x.id, group: 'people', label: x.name, sub: x.title, icon: 'badge', to: '/hr?staff=' + x.id, terms: [x.knownAs ?? ''] });
  if (keys.has('guests')) for (const h of live(s.guestHosts)) out.push({ id: 'host:' + h.id, group: 'people', label: h.name, sub: h.what, icon: 'co_present', to: '/guests', terms: [h.what] });

  // Records
  const bill = billingPath(role);
  if (bill) {
    for (const inv of live(s.invoices)) {
      if (inv.voided) continue;
      const who = mName(inv.memberId);
      const m = s.members[inv.memberId];
      out.push({
        id: 'invoice:' + inv.id, group: 'records', label: inv.number, sub: [who, inv.period, rp(invoiceTotal(inv))].filter(Boolean).join(' · '), icon: 'receipt_long',
        to: `${bill}?inv=${inv.id}`, terms: [inv.number, who, m ? memberName(m) : '', inv.period ?? ''],
      });
    }
  }
  if (keys.has('enquiries')) {
    for (const e of live(s.enquiries)) out.push({ id: 'lead:' + e.id, group: 'records', label: e.senior.name, sub: t('enq.stage.' + e.stage), icon: 'contact_phone', to: '/enquiries?e=' + e.id, terms: [e.senior.name, e.contact.name] });
  }
  const menu = menuPath(role);
  if (menu) for (const d of live(s.dishes)) out.push({ id: 'dish:' + d.id, group: 'records', label: d.name, sub: t('kitchen.course.' + d.course), icon: 'restaurant', to: menu, terms: [] });
  if (keys.has('calendar')) {
    for (const a of live(s.activities)) {
      if (!a.active) continue;
      out.push({ id: 'activity:' + a.id, group: 'records', label: lang === 'id' && a.nameId ? a.nameId : a.name, icon: a.icon || 'event', to: '/calendar', terms: [a.name, a.nameId ?? ''] });
    }
  }
  // R-F2: suppliers open the Directory; a role without it (the lobby) reaches the same screen through Contacts, where it may edit (Directory's canEdit)
  const dirPath = keys.has('directory') ? '/directory' : keys.has('contacts') && (role === 'lobby' || role === 'finance' || role === 'mgmt') ? '/contacts' : null;
  if (dirPath) {
    for (const d of live(s.directory)) {
      if (d.kind !== 'supplier') continue;
      out.push({ id: 'supplier:' + d.id, group: 'records', label: d.name, sub: d.category ? t('purchasing.cat.' + d.category) : d.what, icon: 'local_shipping', to: `${dirPath}?q=` + encodeURIComponent(d.name), terms: [d.what] });
    }
  }
  return out.map((i) => ({ ...i, terms: i.terms.filter(Boolean) }));
}
