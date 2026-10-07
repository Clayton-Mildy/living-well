// Demo roster: 40 more members (m51 to m90) so CitraPremier looks like a busy club (45 in all). The 5 hand-made members in
// index.ts carry the scripted stories and stay as they are; these 40 are background: complete profiles, family contacts,
// 4 weeks of visits, a few readings and logs, last month's invoices. Fully deterministic (fixed tables + a seeded PRNG),
// and every date moves with the anchor, like the rest of the seed. Opt-in: buildSeed(anchor, nowMin, { roster: true }).
import type {
  Actor, ActivityEntry, Attendance, Bank, ClubState, CollectionName, DailyLog, Diet, DrugAllergy, EndReason, FamilyContact, FamilyLink, FoodAllergen,
  HM, Invoice, ISODate, Member, MedTiming, Membership, Mobility, Payment, Plan, PlanEntry, Reading, Relation, Row, Title, Vitals,
} from '../types';
import { addDays, addMonths, dow, e164, rng, toHM, toMin, ym } from '../util';
import { activeOn, isOpen, openDaysInMonth, planOn } from '../rules/core';
import { flexQuota } from '../rules/attendance';
import { dueDateFor, invoiceTotal, runLinesFor } from '../rules/billing';
import { evaluateReading } from '../rules/health';

const FIRST_NO = 51; // m51 … m90 (idx 50 … 89: the digits keep invoice numbers and virtual accounts apart from m1 … m46)
const VA = (i: number) => '8808' + String(1203440000 + i * 7919).padStart(12, '0');

type Row5 = [Title, string, string, ISODate, 'f' | 'g', HM, string, string];
/** title, first name, last name, date of birth, plan now, usual arrival, start ('M1' / 'M3' = first open day this month / two open days later), health profile codes */
const ROWS: Row5[] = [
  ['Opa', 'Hartono', 'Salim', '1944-03-11', 'g', '08:45', '2024-07-01', 'htn chol'],
  ['Oma', 'Lieni', 'Salim', '1947-09-02', 'g', '08:45', '2024-07-01', 'oa osteo'],
  ['Ibu', 'Sri', 'Raharjo', '1951-06-21', 'f', '09:10', '2024-08-05', 'thy gerd'],
  ['Bapak', 'Slamet', 'Raharjo', '1946-01-30', 'f', '09:10', '2024-08-05', 'htn hear'],
  ['Oma', 'Meiling', 'Tanujaya', '1949-11-08', 'g', '08:55', '2024-09-02', 'dm oa'],
  ['Opa', 'Johan', 'Kusuma', '1941-05-17', 'g', '09:30', '2024-07-15', 'heart htn'],
  ['Ibu', 'Endang', 'Suryani', '1953-02-25', 'f', '10:05', '2024-10-14', 'gerd'],
  ['Bapak', 'Ahmad', 'Hidayat', '1950-10-09', 'f', '09:00', '2025-01-06', 'gout htn'],
  ['Oma', 'Yenny', 'Halim', '1948-04-14', 'g', '09:15', '2024-11-04', 'osteo cat'],
  ['Opa', 'Eddy', 'Setiawan', '1939-12-03', 'g', '09:20', '2024-07-22', 'htn hear heart'],
  ['Ibu', 'Rina', 'Siregar', '1955-07-19', 'f', '10:15', '2025-02-10', 'dm'],
  ['Bapak', 'Hasan', 'Nasution', '1947-08-26', 'f', '08:35', '2025-03-17', 'chol gout'],
  ['Oma', 'Susi', 'Hartanto', '1952-03-05', 'f', '09:40', '2025-04-07', 'oa osteo'],
  ['Opa', 'Gunawan', 'Gozali', '1943-10-21', 'g', '09:30', '2024-09-16', 'htn dm'],
  ['Ibu', 'Dewi', 'Wibowo', '1958-01-12', 'f', '10:20', '2025-05-12', 'thy'],
  ['Bapak', 'Made', 'Wirawan', '1949-05-28', 'f', '10:05', '2025-06-02', 'chol'],
  ['Oma', 'Angela', 'Chandra', '1945-08-07', 'g', '09:35', '2024-12-02', 'oa htn'],
  ['Opa', 'Paulus', 'Gondokusumo', '1940-02-16', 'g', '08:50', '2025-07-14', 'stroke htn'],
  ['Ibu', 'Yuliana', 'Hadiwijaya', '1956-11-30', 'f', '10:30', '2025-08-04', 'asthma'],
  ['Bapak', 'Joko', 'Prasetyo', '1952-09-13', 'f', '09:25', '2025-09-15', 'htn'],
  ['Oma', 'Hana', 'Lukito', '1946-12-22', 'g', '09:45', '2025-10-06', 'osteo gerd'],
  ['Opa', 'Budiman', 'Kurniawan', '1938-06-05', 'g', '09:50', '2024-08-19', 'heart htn hear'],
  ['Ibu', 'Margaretha', 'Sitompul', '1954-04-02', 'f', '10:10', '2025-11-03', 'oa dm'],
  ['Bapak', 'Rudy', 'Tanoto', '1945-07-24', 'f', '09:05', '2025-12-01', 'htn chol'],
  ['Oma', 'Aisyah', 'Harahap', '1950-01-18', 'f', '08:30', '2026-01-12', 'thy osteo'],
  ['Opa', 'Frans', 'Lumentut', '1944-09-29', 'g', '10:15', '2025-01-20', 'park'],
  ['Ibu', 'Tuti', 'Kartika', '1957-05-09', 'f', '09:55', '2026-02-02', 'mem'],
  ['Bapak', 'Darmawan', 'Kho', '1942-03-27', 'g', '09:50', '2024-10-28', 'htn hear'],
  ['Oma', 'Lani', 'Setiawan', '1937-10-14', 'g', '09:20', '2024-07-22', 'oa osteo mem'],
  ['Opa', 'Ferry', 'Winata', '1948-02-06', 'f', '10:00', '2026-03-16', 'gout'],
  ['Ibu', 'Christina', 'Pangestu', '1951-12-11', 'f', '09:35', '2026-04-13', 'htn asthma'],
  ['Bapak', 'Wayan', 'Suardana', '1955-06-03', 'f', '10:25', '2026-05-04', 'chol'],
  ['Oma', 'Rosalina', 'Tedjo', '1943-08-19', 'g', '08:40', '2025-03-03', 'stroke fracture'],
  ['Opa', 'Handoko', 'Gani', '1940-11-25', 'f', '09:45', '2024-08-12', 'htn dm'],
  ['Ibu', 'Nurhayati', 'Lubis', '1953-09-07', 'f', '10:10', 'M1', 'gerd htn'],
  ['Bapak', 'Agung', 'Nugroho', '1949-03-15', 'f', '09:15', '2026-07-06', 'chol htn'],
  ['Oma', 'Giok Lan', 'Sutedja', '1941-01-26', 'g', '09:10', '2025-04-14', 'stroke dm'],
  ['Opa', 'Tony', 'Hermanto', '1946-06-30', 'f', '10:00', '2026-08-03', 'chol'],
  ['Ibu', 'Maya', 'Sari', '1961-02-04', 'f', '09:30', 'M3', 'thy'],
  ['Bapak', 'Hendrik', 'Wongso', '1934-07-12', 'g', '09:00', '2024-07-01', 'mem htn hear'],
];
const SPOUSE: Record<number, number> = { 1: 0, 3: 2, 28: 9 }; // second spouse -> first (couples share an address, family and visit days)
/** plan changes: the date it took effect ('M' = first open day this month) and the plan from then on (the plan before it is the other one) */
const PLAN_CHANGE: Record<number, string> = { 4: '2025-09-01', 8: '2026-03-02', 17: '2026-07-01', 36: 'M', 33: '2026-01-05' };
const ENDING: Record<number, [number, EndReason, string]> = { 12: [0, 'careHome', 'Moving to a care home near family'], 21: [3, 'careNeeds', 'Needs more care than a day club can give'], 29: [6, 'movedAway', 'Moving to Bandung to live with his daughter'] };
const ENDED: Record<number, [string, EndReason, string]> = { 19: ['-12', 'movedAway', 'Moved to Surabaya'], 26: ['2026-08-28', 'careHome', 'Moved into a care home'], 7: ['2026-07-31', 'familyDecision', 'Family decided to stay home'] };
/** members in the club today: arrival time (a person arrives only once that time has passed) */
const TODAY_IN: Record<number, HM> = { 0: '08:42', 1: '08:43', 2: '09:07', 3: '09:07', 4: '08:56', 8: '09:14', 9: '09:18', 28: '09:19', 13: '09:28', 16: '09:36', 20: '09:44', 21: '09:49', 27: '09:51', 15: '10:08', 25: '10:20' };
const TODAY_OUT: Record<number, HM> = { 8: '13:50', 21: '14:20', 4: '14:40' }; // gone home in the afternoon; everyone else leaves 15:35 to 16:25
const FOOD: Record<number, FoodAllergen[]> = { 0: ['shellfish'], 6: ['peanuts'], 11: ['seafood'], 14: ['eggs'], 17: ['fish'], 24: ['dairy'], 30: ['shellfish'] };
const DRUGS: Record<number, DrugAllergy[]> = { 8: ['penicillin'], 29: ['sulfa'], 34: ['aspirin'], 30: ['penicillin'] };
const MOBILITY: Record<number, Mobility> = { 3: 'walkingStick', 4: 'walkingStick', 5: 'walker', 9: 'walkingStick', 12: 'walkingStick', 16: 'walkingStick', 21: 'walker', 22: 'walkingStick', 25: 'walker', 27: 'walkingStick', 28: 'walker', 32: 'walker', 36: 'wheelchair', 39: 'walker' };
const SOFT = new Set([28, 36, 39]);
const VEG = new Set([8, 20, 32]);
const NANNY: Record<number, string> = { 9: 'Mbak Wati', 21: 'Mbak Yanti', 28: 'Mbak Wati', 36: 'Mbak Lastri', 39: 'Pak Maman' };
const NO_HEALTH_FORM = new Set([37, 38]); // the newest members: health form still requested
const FLEX3 = new Set([10, 22, 24]); // Flex members who come 3 days a week and use up their quota
const LATE_PAYERS: Record<number, 'cur' | 'both'> = { 14: 'cur', 5: 'cur', 23: 'both' };

const COND: Record<string, { text: string; med?: [string, string, MedTiming][] }> = {
  htn: { text: 'High blood pressure, controlled' }, chol: { text: 'High cholesterol', med: [['Simvastatin', '20 mg', 'eveningHome']] },
  dm: { text: 'Type 2 diabetes', med: [['Metformin', '500 mg', 'lunchClub']] }, oa: { text: 'Osteoarthritis, knees' },
  osteo: { text: 'Osteoporosis', med: [['Calcium + Vitamin D', '1 tablet', 'lunchClub']] }, gout: { text: 'Gout', med: [['Allopurinol', '100 mg', 'morningHome']] },
  gerd: { text: 'Acid reflux', med: [['Omeprazole', '20 mg', 'morningHome']] }, thy: { text: 'Underactive thyroid', med: [['Levothyroxine', '50 mcg', 'morningHome']] },
  mem: { text: 'Early memory loss', med: [['Donepezil', '5 mg', 'eveningHome']] }, park: { text: 'Parkinson’s disease, early stage', med: [['Levodopa + Carbidopa', '100/25 mg', 'lunchClub']] },
  heart: { text: 'Heart health, on preventive aspirin', med: [['Aspirin', '80 mg', 'morningHome']] }, stroke: { text: 'Past stroke, mild weakness on one side', med: [['Clopidogrel', '75 mg', 'morningHome']] },
  hear: { text: 'Hard of hearing' }, cat: { text: 'Cataract, one eye operated' }, fracture: { text: 'Old hip fracture' }, asthma: { text: 'Mild asthma', med: [['Salbutamol inhaler', '2 puffs', 'asPrescribed']] },
};
const BP_MEDS: [string, string][] = [['Amlodipine', '5 mg'], ['Candesartan', '8 mg'], ['Bisoprolol', '2.5 mg']];
const FLAVOUR = ['Likes the seat by the window.', 'Enjoys a cup of tea on arrival.', 'Likes to chat with the volunteers before lunch.', 'Prefers the quieter table.', 'Loves the morning newspaper.', 'Happy to join any singing session.', 'Likes to help set the tables.', 'Enjoys the garden after lunch.'];
const CHILD = {
  cn: { f: ['Jessica', 'Stefani', 'Melissa', 'Livia', 'Cindy', 'Vivian', 'Angelina', 'Grace', 'Natalia', 'Felicia', 'Irene', 'Sandra', 'Veronica'], m: ['Kevin', 'Andre', 'Jonathan', 'Michael', 'Steven', 'Rico', 'Albert', 'Ferdinand', 'William', 'Benny', 'Christian', 'Daniel'] },
  jv: { f: ['Ratna', 'Putri', 'Wulan', 'Indah', 'Fitri', 'Rini', 'Dian', 'Nadia', 'Lestari', 'Ayu'], m: ['Rizky', 'Adi', 'Bayu', 'Eko', 'Fajar', 'Arief', 'Yoga', 'Taufik', 'Reza', 'Wahyu'] },
  bali: { f: ['Putu', 'Kadek', 'Komang', 'Ayu'], m: ['Gede', 'Made', 'Nyoman', 'Agus'] },
  bt: { f: ['Marlina', 'Rosmaida', 'Esther', 'Grace', 'Debora'], m: ['Samuel', 'Rudolf', 'Boy', 'Daniel', 'Jonathan'] },
};
const GROUP_OF = (last: string): keyof typeof CHILD =>
  ['Wirawan', 'Suardana'].includes(last) ? 'bali' : ['Siregar', 'Nasution', 'Sitompul', 'Lumentut', 'Harahap'].includes(last) ? 'bt'
  : ['Salim', 'Tanujaya', 'Kusuma', 'Halim', 'Setiawan', 'Hartanto', 'Gozali', 'Chandra', 'Gondokusumo', 'Hadiwijaya', 'Lukito', 'Kurniawan', 'Tanoto', 'Kho', 'Winata', 'Pangestu', 'Tedjo', 'Gani', 'Sutedja', 'Hermanto', 'Wongso'].includes(last) ? 'cn' : 'jv';
const IN_LAW_LAST = { cn: ['Tan', 'Lim', 'Wijaya', 'Gunadi', 'Susanto', 'Hartono'], jv: ['Wibisono', 'Pratama', 'Santoso', 'Saputra', 'Firmansyah'], bali: ['Pratama', 'Wijaya'], bt: ['Panjaitan', 'Simanjuntak', 'Manurung'] };
const STREETS: [string, string][] = [
  ['Jl. Kemang Selatan', 'Kemang'], ['Jl. Cipete Raya', 'Cipete'], ['Jl. Wijaya II', 'Kebayoran Baru'], ['Jl. Gandaria Tengah', 'Kebayoran Baru'], ['Jl. Pangeran Antasari', 'Cilandak'],
  ['Jl. Fatmawati Raya', 'Cilandak'], ['Jl. Cilandak KKO', 'Cilandak'], ['Jl. Senopati', 'Senopati'], ['Jl. Darmawangsa', 'Kebayoran Baru'], ['Jl. Prapanca Raya', 'Kebayoran Baru'],
  ['Jl. Kemang Raya', 'Kemang'], ['Jl. Tebet Barat', 'Tebet'], ['Jl. Pejaten Raya', 'Pejaten'], ['Jl. Ampera Raya', 'Cilandak'], ['Jl. Brawijaya', 'Kebayoran Baru'], ['Jl. Hang Lekir', 'Senayan'],
];

/** Adds m51 … m90 with their family, visits, readings, logs and invoices to a Citra state that already has the 5 hand-made members. */
export function addRoster(s: ClubState, T: ISODate, nowMin: number): void {
  const C = s.clubId;
  const done = (hm: string) => toMin(hm) <= nowMin;
  const base = (id: string, createdAt: string, createdBy: Actor = 'staff:s1'): Row => ({ id, clubId: C, createdAt, createdBy });
  const r = rng(20260606);
  const between = (a: number, b: number) => a + Math.floor(r() * (b - a + 1));
  const nz = (v: number, sp: number) => Math.round(v + (r() - 0.5) * 2 * sp);
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const put = <K extends CollectionName>(k: K, row: ClubState[K][string]) => { ((s[k] as unknown) as Record<string, unknown>)[(row as { id: string }).id] = row; };
  const month = ym(T);
  const prevOpen = (d: ISODate) => { let x = d; for (let i = 0; i < 10 && !isOpen(s, x); i++) x = addDays(x, -1); return x; };
  const monthOpen = openDaysInMonth(s, month);
  const firstOpen = monthOpen.find((d) => d <= T) ?? T;
  const startOf = (v: string): ISODate => (v === 'M1' ? firstOpen : v === 'M3' ? (monthOpen.filter((d) => d <= T)[2] ?? T) : v);
  const id = (i: number) => `m${FIRST_NO + i}`;
  const usedPhones = new Set<string>([...Object.values(s.staff).map((x) => x.phone), ...Object.values(s.familyContacts).map((x) => x.phone)]);
  const phone = () => {
    for (;;) {
      const p = e164(`+62 8${['11', '12', '13', '15', '16', '17', '18', '19', '21', '52', '57', '78'][between(0, 11)]}-${between(1000, 9999)}-${between(1000, 9999)}`);
      if (!usedPhones.has(p)) { usedPhones.add(p); return p; }
    }
  };

  // ----- who they are, health, family -----
  const spouseOf = (i: number) => Object.entries(SPOUSE).flatMap(([b, a]) => (+b === i ? [a] : a === i ? [+b] : []))[0];
  const addr: string[] = [];
  const primary: string[] = []; // family contact id of each member's primary contact
  const patterns: Set<number>[] = [];
  ROWS.forEach((row, i) => {
    const [title, first, last, dob, planNow, usual, startRaw, prof] = row;
    const mid = id(i);
    const f = title === 'Oma' || title === 'Ibu';
    const lead = SPOUSE[i] ?? i;
    const start = startOf(startRaw);
    addr[i] = lead !== i ? addr[lead] : (() => { const [st, area] = STREETS[between(0, STREETS.length - 1)]; return `${st} no. ${between(1, 88)}, ${area}, Jakarta Selatan`; })();
    // plans
    const chg = PLAN_CHANGE[i];
    const nowPlan: Plan = planNow === 'g' ? 'gold' : 'flex';
    const plans: PlanEntry[] = chg
      ? [{ from: start, plan: nowPlan === 'gold' ? 'flex' : 'gold', by: 'staff:s1' }, { from: chg === 'M' ? firstOpen : chg, plan: nowPlan, by: 'staff:s9' }]
      : [{ from: start, plan: nowPlan, by: 'staff:s1' }];
    // membership
    const ms: Membership = { start };
    if (ENDING[i]) {
      const [k, reason, note] = ENDING[i];
      const last2 = monthOpen[Math.max(0, monthOpen.length - 1 - k)];
      ms.lastDay = last2 < T ? T : last2; ms.endReason = reason; ms.endNote = note; ms.endedBy = 'staff:s9'; ms.endedAt = `${addDays(T, -4 - k)}T10:30`;
    } else if (ENDED[i]) {
      const [when, reason, note] = ENDED[i];
      ms.lastDay = when.startsWith('-') ? prevOpen(addDays(T, +when)) : prevOpen(when); ms.endReason = reason; ms.endNote = note; ms.endedBy = 'staff:s9'; ms.endedAt = `${addDays(ms.lastDay, -6)}T10:30`;
    }
    // health
    const codes = prof.split(' ');
    const conditions = codes.map((c) => COND[c].text);
    const diabetic = codes.includes('dm');
    const food = FOOD[i] ?? [];
    const drugs = DRUGS[i] ?? [];
    const mobility = MOBILITY[i] ?? null;
    const diet: Diet[] = [];
    if (codes.includes('htn') && i % 2 === 0) diet.push('lowSalt');
    if (diabetic) diet.push('sugarFree');
    if (SOFT.has(i)) diet.push('softFood');
    if (VEG.has(i)) diet.push('vegetarian');
    const meds: Member['health']['meds'] = [];
    const addMed = (name: string, dose: string, timing: MedTiming) => meds.push({ id: `${mid}-med${meds.length + 1}`, name, dose, timing });
    for (const c of codes) {
      if (c === 'htn') addMed(...BP_MEDS[i % 3], 'morningHome');
      else if (c === 'oa') { if (i % 2 === 0) addMed('Glucosamine', '1 capsule', 'lunchClub'); }
      else if (c === 'heart' && drugs.includes('aspirin')) continue;
      else for (const m of COND[c].med ?? []) addMed(...m);
    }
    const mem = codes.includes('mem');
    const her = f ? 'her' : 'his', him = f ? 'her' : 'him';
    const care: string[] = [];
    if (mobility === 'walkingStick') care.push(`Walks with a stick; offer ${her} an arm on the stairs.`);
    if (mobility === 'walker') care.push('Uses a walker; keep the way to the dining room clear.');
    if (mobility === 'wheelchair') care.push('Uses a wheelchair; seat at the end of the table with room to turn.');
    if (diabetic) care.push('Diabetic: offer the sugar-free snack at tea.');
    if (codes.includes('hear')) care.push(`Hard of hearing; speak clearly and face ${him}.`);
    if (mem) care.push('Gentle reminders of the plan for the day help.');
    if (codes.includes('stroke')) care.push('Offer help with cutlery on the weaker side.');
    if (food.length) care.push(`Allergic to ${food.join(' and ')}: check every dish with the kitchen.`);
    if (drugs.length) care.push(`Drug allergy (${drugs.join(', ')}): tell the nurse before any medicine.`);
    if (care.length < 2) care.push(FLAVOUR[i % FLAVOUR.length]);
    // family: primary (with app access, for chat and billing) and sometimes a second contact (no app access)
    const gm = GROUP_OF(last);
    let fid0: string;
    if (lead !== i) fid0 = primary[lead];
    else {
      fid0 = `fm${FIRST_NO + i}_0`;
      const rel = ((x) => (x < 0.4 ? 'daughter' : x < 0.75 ? 'son' : x < 0.85 ? 'daughterInLaw' : x < 0.9 ? 'sonInLaw' : x < 0.95 ? 'granddaughter' : 'grandson'))(r()) as Relation;
      const girl = ['daughter', 'daughterInLaw', 'granddaughter'].includes(rel);
      const pool = CHILD[gm][girl ? 'f' : 'm'];
      const given = pool[between(0, pool.length - 1)];
      const surname = rel === 'daughterInLaw' || rel === 'sonInLaw' ? IN_LAW_LAST[gm][between(0, IN_LAW_LAST[gm].length - 1)] : last;
      const mkContact = (cid: string, name: string, firstName: string, access: boolean) =>
        put('familyContacts', { ...base(cid, `${start}T10:00`), name, firstName, phone: phone(), lang: gm === 'cn' && i % 2 === 0 ? 'en' : 'id', ...(access ? { activatedAt: `${start}T10:00` } : {}) } satisfies FamilyContact);
      mkContact(fid0, `${given} ${surname}`, given, true);
      const links: [string, Relation, boolean][] = [[fid0, rel, true]];
      if (r() < 0.6) {
        const rel2: Relation = girl ? 'son' : 'daughter';
        const pool2 = CHILD[gm][girl ? 'm' : 'f'];
        const given2 = pool2[between(0, pool2.length - 1)];
        mkContact(`fm${FIRST_NO + i}_1`, `${given2} ${last}`, given2, false);
        links.push([`fm${FIRST_NO + i}_1`, rel2, false]);
      }
      for (const [cid, relation, prim] of links) for (const who of [i, ...(Object.entries(SPOUSE).filter(([, a]) => a === i).map(([b]) => +b))])
        put('familyLinks', { ...base(`${cid}:${id(who)}`, `${start}T10:00`), familyId: cid, memberId: id(who), relation, primary: prim, appAccess: prim, healthAlerts: true } satisfies FamilyLink);
    }
    primary[i] = fid0;
    const fname = s.familyContacts[fid0].name;
    const byFam: Actor = `family:${fid0}`;
    // sim baseline: a quiet, healthy-looking set of numbers (the same ones readings are drawn around)
    const htn = codes.includes('htn');
    const sim: Vitals = {
      sys: htn ? between(126, 136) : between(112, 126), dia: htn ? between(76, 84) : between(68, 78), pulse: between(64, 78), spo2: between(96, 98),
      glucose: diabetic ? between(136, 168) : between(94, 114), weight: f ? between(44, 64) : between(54, 76), temp: Math.round((36.4 + r() * 0.4) * 10) / 10, grip: f ? between(12, 20) : between(18, 30),
    };
    const m: Member = {
      ...base(mid, start + 'T10:00'), title, firstName: first, lastName: last, gender: f ? 'f' : 'm', dob, ageYears: null, address: addr[i], photoTone: between(0, 4),
      memberships: [ms], plans, usualArrival: usual, nanny: NANNY[i] ? { name: NANNY[i] } : null, spouseId: spouseOf(i) !== undefined ? id(spouseOf(i)) : null,
      health: { conditions, diabetic, food, drugs, mobility, diet, meds,
        cognitive: { summary: mem ? 'Mild memory loss; needs gentle reminders of the day’s plan' : codes.includes('park') ? 'Alert and oriented; slow to start movements' : 'Alert and oriented', reviewedBy: 's8', reviewedOn: start > addDays(T, -25) ? start : addDays(T, -25) } },
      care: { instructions: care.join(' '), by: 'staff:s8', at: `${start > addDays(T, -20) ? start : addDays(T, -20)}T10:45` },
      consents: [{ kind: 'data', granted: true, by: byFam, byName: fname, at: start + 'T09:00', via: 'paper' }, { kind: 'face', granted: true, by: byFam, byName: fname, at: start + 'T09:00', via: 'paper' }],
      documents: [
        { id: `${mid}-doc-ktp`, type: 'ktp', status: 'onFile', fileName: 'ktp.jpg', on: start, via: 'staff', by: byFam },
        ...(NANNY[i] ? [{ id: `${mid}-doc-nktp`, type: 'nannyKtp' as const, status: 'onFile' as const, fileName: 'ktp-nanny.jpg', on: start, via: 'staff' as const, by: byFam }] : []),
        { id: `${mid}-doc-form`, type: 'membershipForm', status: 'onFile', fileName: 'membership-form.pdf', on: start, via: 'staff', by: byFam },
        NO_HEALTH_FORM.has(i) ? { id: `${mid}-doc-health`, type: 'healthInfo', status: 'requested', on: start, by: 'staff:s1' } : { id: `${mid}-doc-health`, type: 'healthInfo', status: 'onFile', fileName: 'health-info.jpg', on: start, via: 'staff', by: byFam },
      ],
      face: { enrolled: true, at: start + 'T10:00' }, billing: { va: VA(FIRST_NO - 1 + i) }, sim,
    };
    put('members', m);
    put('activity', { id: `act-${mid}-created`, clubId: C, at: start + 'T10:00', actor: 'staff:s1', action: 'members.create', memberId: mid, icon: 'person_add', key: 'feed.memberCreatedForm', params: {} } satisfies ActivityEntry);
    // visit days of the week: Flex 2 (a few 3), Gold 2 to 4; couples come together, today's group includes today's weekday
    if (lead !== i) patterns[i] = patterns[lead];
    else {
      const days = [1, 2, 3, 4, 5];
      for (let k = days.length - 1; k > 0; k--) { const j = between(0, k); [days[k], days[j]] = [days[j], days[k]]; }
      const n = nowPlan === 'gold' ? 2 + (i % 3) : FLEX3.has(i) ? 3 : 2;
      const p = new Set(days.slice(0, n));
      if (TODAY_IN[i] && !p.has(dow(T))) { p.delete(days[0]); p.add(dow(T)); }
      patterns[i] = p;
    }
  });

  // ----- the last 4 weeks of visits (Flex never above the monthly quota) -----
  const PAST: ISODate[] = [];
  for (let d = addDays(T, -28); d < T; d = addDays(d, 1)) if (isOpen(s, d)) PAST.push(d);
  const rawDays: ISODate[][] = [];
  const visits: ISODate[][] = [];
  ROWS.forEach((_, i) => {
    const lead = SPOUSE[i] ?? i;
    const cand = lead !== i ? rawDays[lead] : PAST.filter((d) => patterns[i].has(dow(d)) && r() >= 0.1);
    rawDays[i] = cand;
    const m = s.members[id(i)];
    const count: Record<string, number> = {};
    const out: ISODate[] = [];
    const todayFlex = !!TODAY_IN[i] && activeOn(m, T) && planOn(m, T).plan === 'flex';
    for (const d of cand) {
      if (!activeOn(m, d)) continue;
      if (planOn(m, d).plan === 'flex') {
        const q = flexQuota(s, m, ym(d)) - (todayFlex && ym(d) === month ? 1 : 0);
        if ((count[ym(d)] || 0) >= q) continue;
        count[ym(d)] = (count[ym(d)] || 0) + 1;
      }
      out.push(d);
    }
    visits[i] = out;
  });

  // ----- attendance, readings, logs -----
  const attRow = (date: ISODate, memberId: string, inAt: HM, outAt?: HM): Attendance => ({
    ...base(`${date}:${memberId}`, `${date}T${inAt}`), memberId, date,
    checkIn: { at: inAt, by: 'staff:s1', method: 'face' }, ...(outAt ? { checkOut: { at: outAt, by: 'staff:s1', method: 'manual' } } : {}),
    queueAdds: [], dismissed: [], edits: [{ at: `${date}T${inAt}`, by: 'staff:s1', what: 'checkIn' }, ...(outAt ? [{ at: `${date}T${outAt}`, by: 'staff:s1' as Actor, what: 'checkOut' as const }] : [])],
  });
  let rid = 0;
  const reading = (memberId: string, date: ISODate, time: HM, kind: Reading['kind'], v: Partial<Reading>) => {
    const row: Reading = { ...base(`hr${++rid}`, `${date}T${time}`, 'staff:s8'), memberId, date, time, kind, status: 'normal', takenBy: 's8', source: 'device', noteKeys: [], shared: false, edits: [], ...v };
    row.status = evaluateReading(row);
    put('readings', row);
    return row;
  };
  const bp = (b: Vitals, down = 0) => ({ sys: clamp(nz(b.sys - down, 5), 104, 136), dia: clamp(nz(b.dia - down / 2, 4), 62, 86), pulse: clamp(nz(b.pulse, 5), 62, 96) });
  const arrivalReading = (memberId: string, date: ISODate, inAt: HM) => {
    const b = s.members[memberId].sim;
    return reading(memberId, date, toHM(toMin(inAt) + between(6, 14)), 'arrival', { ...bp(b), spo2: clamp(nz(b.spo2, 1), 95, 99), temp: Math.min(37.2, Math.round((b.temp + (r() - 0.5) * 0.4) * 10) / 10) });
  };
  const MOOD = (x: number): DailyLog['mood'] => (x < 0.42 ? 'cheerful' : x < 0.88 ? 'calm' : x < 0.97 ? 'quiet' : 'agitated');
  const LUNCH = (y: number): DailyLog['lunch'] => (y < 0.72 ? 'all' : y < 0.92 ? 'most' : 'half');
  const NOTES = { quiet: 'Quieter than usual today; sat out of the afternoon session.', agitated: 'A little unsettled before lunch; calmer after a walk in the garden.', half: 'Ate about half of lunch; had extra fruit at tea.' };
  const NICE = ['Joined the singing and stayed for the whole afternoon.', 'Enjoyed the garden after lunch and chatted with friends.', 'Helped a new member find the way to the music room.', 'Took part in the memory games and won a round.'];
  const lastTwo = PAST.slice(-2);
  const times: Record<string, { inAt: HM; outAt: HM }> = {};
  ROWS.forEach((row, i) => {
    const mid = id(i);
    const vis = visits[i];
    for (const d of vis) {
      const inAt = toHM(Math.max(toMin('08:30'), toMin(row[5]) + between(-7, 7)));
      const outAt = toHM(between(15 * 60 + 35, 16 * 60 + 25));
      times[`${d}:${mid}`] = { inAt, outAt };
      put('attendance', attRow(d, mid, inAt, outAt));
    }
    // readings: arrival on the last 3 visits (the last one missing now and then), departure on the last, a monthly check on the first visit of each month
    vis.slice(-3).forEach((d, k, arr) => {
      if (k === arr.length - 1 && r() < 0.08) return;
      arrivalReading(mid, d, times[`${d}:${mid}`].inAt);
    });
    const last = vis[vis.length - 1];
    if (last && Object.values(s.readings).some((x) => x.memberId === mid && x.date === last && x.kind === 'arrival')) {
      const b = s.members[mid].sim;
      reading(mid, last, toHM(toMin(times[`${last}:${mid}`].outAt) - between(10, 22)), 'departure', bp(b, 2));
    }
    for (const mo of [...new Set(vis.map(ym))]) {
      const d = vis.find((x) => ym(x) === mo)!;
      const b = s.members[mid].sim;
      reading(mid, d, toHM(toMin(times[`${d}:${mid}`].inAt) + 16), 'monthly', {
        glucose: b.glucose > 130 ? clamp(nz(b.glucose, 10), 120, 175) : clamp(nz(b.glucose, 8), 85, 125), weight: Math.round((b.weight + (r() - 0.5) * 1.2) * 10) / 10, grip: Math.round(b.grip + (r() - 0.5) * 2),
      });
    }
    // a few daily logs on the last two club days
    for (const d of lastTwo) {
      if (!vis.includes(d) || r() >= 0.35) continue;
      const mood = MOOD(r()), lunch = LUNCH(r()), by = r() < 0.5 ? 's5' : 's6';
      const note = mood === 'quiet' || mood === 'agitated' ? NOTES[mood] : lunch === 'half' ? NOTES.half : r() < 0.5 ? NICE[between(0, NICE.length - 1)] : '';
      put('dailyLogs', { ...base(`log-${mid}-${d}`, `${d}T15:10`, `staff:${by}`), memberId: mid, date: d, mood, lunch, joined: mood === 'quiet' ? 'satOut' : 'yes', communicative: mood === 'quiet' ? 'withdrawn' : 'normal', content: 'normal', note, status: 'saved', by, edits: [] } satisfies DailyLog);
    }
  });

  // ----- today: arrivals appear once their time has passed -----
  ROWS.forEach((row, i) => {
    const inAt = TODAY_IN[i];
    const mid = id(i);
    if (!inAt || !done(inAt) || !activeOn(s.members[mid], T)) return;
    const outAt = TODAY_OUT[i] ?? toHM(15 * 60 + 35 + ((i * 11) % 51));
    const gone = done(outAt);
    put('attendance', attRow(T, mid, inAt, gone ? outAt : undefined));
    const nm = `${row[0]} ${row[1]}`;
    put('activity', { id: `act-${T}-${mid}-in`, clubId: C, at: `${T}T${inAt}`, actor: 'staff:s1', action: 'attendance.checkIn', memberId: mid, icon: 'how_to_reg', key: 'feed.checkedIn', params: { name: nm, how: 'face' } } satisfies ActivityEntry);
    const feedReading = (x: Reading) => put('activity', { id: `act-${x.id}`, clubId: C, at: `${T}T${x.time}`, actor: 'staff:s8', action: 'health.reading.save', memberId: mid, icon: 'monitor_heart', key: 'feed.reading', params: { name: nm, value: `${x.sys}/${x.dia}`, status: x.status } } satisfies ActivityEntry);
    const arr = arrivalReading(mid, T, inAt);
    if (done(arr.time)) feedReading(arr); else delete s.readings[arr.id]; // the nurse has not got to this one yet
    if (gone && s.readings[arr.id]) feedReading(reading(mid, T, toHM(toMin(outAt) - between(10, 20)), 'departure', bp(s.members[mid].sim, 2)));
  });

  // ----- invoices: the two latest runs, like the 5 hand-made members; a few families are late with payment -----
  const late = +T.slice(8) >= s.club.settings.issueDay;
  const cur = late ? month : addMonths(month, -1);
  const prev = addMonths(cur, -1);
  const bank = ['BCA', 'Mandiri', 'BNI', 'BRI'] as Bank[];
  ROWS.forEach((_, i) => {
    const m = s.members[id(i)];
    const fid = primary[i];
    for (const p of [prev, cur]) {
      const lines = runLinesFor(s, m, p, T);
      if (!lines.length) continue;
      const number = `INV-${p.slice(2, 4)}${p.slice(5, 7)}-${String(FIRST_NO + i).padStart(3, '0')}`;
      const issue = `${p}-15`;
      const due = dueDateFor(s, p);
      const day = p === cur ? 16 + ((i * 3) % 5) : 16 + ((i * 5) % 11); // families pay within days of the 15th
      const ended = !!ENDED[i];
      const unpaid = !ended && ((LATE_PAYERS[i] === 'both') || (LATE_PAYERS[i] === 'cur' && p === cur));
      const paidOn = unpaid ? null : `${p}-${String(day).padStart(2, '0')}`;
      const paid = paidOn && paidOn < T ? paidOn : null;
      const overdue = !paid && due < T;
      const inv: Invoice = { ...base(number, issue + 'T08:00', 'system'), number, memberId: m.id, payerFamilyId: fid, kind: 'monthly', period: p, issueDate: issue, dueDate: due, lines, va: m.billing.va,
        xero: paid ? 'synced' : 'awaitingPayment',
        reminders: overdue && addDays(due, 3) < T ? [{ at: `${addDays(due, 3)}T10:00`, by: 'staff:s10' }] : [],
        callNotes: overdue && LATE_PAYERS[i] === 'both' && addDays(due, 6) < T ? [{ at: `${addDays(due, 6)}T11:00`, by: 'staff:s10', text: `Called ${s.familyContacts[fid].firstName}; the family will transfer after the 5th.` }] : [] };
      put('invoices', inv);
      if (paid) put('payments', { ...base(`pay-${number}`, paid + 'T11:20', `family:${fid}`), memberId: m.id, method: 'dokuVa', amount: invoiceTotal(inv), bank: bank[(i + (p === cur ? 1 : 0)) % 4], receivedOn: paid, receivedAt: '11:20', allocations: [{ invoiceId: number, amount: invoiceTotal(inv) }], xero: 'synced', by: `family:${fid}` } satisfies Payment);
      const run = s.invoiceRuns[`run-${p}`];
      if (run) run.invoiceIds.push(number);
    }
  });
}
