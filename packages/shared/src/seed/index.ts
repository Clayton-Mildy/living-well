// Deterministic demo seed: 5 members at CitraPremier on the demo day (09:58). Adina starts empty.
// Written for Wed 21 Oct 2026 (DEMO_TODAY): every date is relative to the anchor, so buildSeed('2026-10-21') gives exactly
// the data the tests expect, and buildSeed(today) tells the same story around today.
// Values follow design/data.js (same names, phones, baselines, menu, schedule) trimmed to the 5-member cast.
import type {
  Actor, Attendance, ClubSettings, ClubState, DailyLog, Dish, DishAllergen, DT, FamilyContact, FamilyLink,
  Invoice, ISODate, Member, MemberNote, Payment, Photo, Reading, Row, ScheduleCell, Slot, Staff, StaffRole, Thread, Message, Weekday,
  ChangeRequest, Notification, ActivityEntry, Relation, Bank,
} from '../types';
import { COLLECTIONS } from '../types';
import type { CollectionName } from '../types';
import { addDays, addMonths, daysBetween, dow, rng, toHM, toMin, ym, DEMO_TODAY, DEMO_START_MIN, isWeekday, e164 } from '../util';
import { evaluateReading } from '../rules/health';
import { addRoster } from './roster';

type Coll<K extends keyof ClubState> = ClubState[K];

export function emptyClub(clubId: string, club: ClubState['club']): ClubState {
  const s = { clubId, rev: 0, club } as ClubState;
  for (const c of COLLECTIONS) (s as unknown as Record<string, unknown>)[c] = {};
  return s;
}
const base = (clubId: string, id: string, createdAt: DT, createdBy: Actor = 'system'): Row => ({ id, clubId, createdAt, createdBy });

export const SETTINGS: ClubSettings = {
  open: '08:30', close: '16:30', departureFrom: '15:30', recheckMin: 15, flexQuota: 10, issueDay: 15, dueDay: 27, finalDueDays: 14,
  emergencyPhone: '+62 21 7590 1188', hoursLabel: 'Mon–Fri 08:30–16:30',
  broadcastTemplates: [
    { id: 'tpl-update', key: 'update', title: 'Club update', text: 'Hello {name}, news from CitraPremier: {msg}' },
    { id: 'tpl-closure', key: 'closure', title: 'Club closed', text: 'Hello {name}, a reminder that CitraPremier is closed on {msg}. We open again on the next working day at 08:30.' },
    { id: 'tpl-event', key: 'event', title: 'Event invitation', text: 'Hello {name}, you are invited: {msg}. Reply YES to save a place.' },
  ],
};

// ---------------- staff ----------------
const STAFF: [string, string, StaffRole, string, boolean, string, string?][] = [
  ['s1', 'Caca', 'lobby', 'Front of house', true, '+62 811-2201-3345'],
  ['s2', 'Yohanes Pratama', 'kitchen', 'F&B supervisor', true, '+62 811-2201-3346', 'Pak Yohanes'],
  ['s3', 'Agus Santoso', 'kitchen', 'Chef', true, '+62 811-2201-3347', 'Chef Agus'],
  ['s4', 'Siti Aminah', 'housekeeping', 'Housekeeping', false, '+62 811-2201-3348', 'Bu Siti'],
  ['s5', 'Dinar', 'activity', 'Activity teacher', true, '+62 811-2201-3349', 'Dinar'],
  ['s6', 'Dimas Wibowo', 'activity', 'Activity teacher', true, '+62 811-2201-3350', 'Kak Dimas'],
  ['s7', 'Joko Susilo', 'driver', 'Driver', false, '+62 811-2201-3351', 'Pak Joko'],
  ['s8', 'Dewi Anggraini', 'nurse', 'Nurse', true, '+62 811-2201-3352', 'Ns. Dewi'],
  ['s9', 'Ega', 'mgmt', 'Club manager', true, '+62 811-2201-3353', 'Ega'],
  ['s10', 'Fransiska Tan', 'finance', 'Finance (AR)', true, '+62 811-2201-3354', 'Bu Fransiska'],
];
const SALARY: Record<string, number> = { lobby: 6500000, kitchen: 7200000, housekeeping: 4800000, activity: 6800000, driver: 5200000, nurse: 8900000, mgmt: 18500000, finance: 9800000 };
const STARTS = ['2024-07-01', '2024-07-01', '2024-08-01', '2024-09-01', '2024-07-15', '2025-01-06', '2024-07-01', '2024-07-01', '2024-06-01', '2025-02-03'];
const QUOTES: Record<string, string> = { s1: 'Always greets Mama by name.', s3: 'The soto tastes just like home.', s5: 'Dinar makes Papa laugh every day.', s6: 'So patient with Mama during batik.', s8: 'Ns. Dewi explains everything clearly.', s7: 'Careful driver, always on time.' };

function staffRows(clubId: string, T: ISODate): Staff[] {
  return STAFF.map(([id, name, role, title, login, phone, knownAs], i) => {
    const r = (n: number) => ((i * 7919 + n * 104729) % 1000) / 1000;
    let end: string | null = i < 3 ? null : '2026-' + String(6 + (i % 6)).padStart(2, '0') + '-30';
    if (end && end < T) end = String(+end.slice(0, 4) + 1) + end.slice(4); // roll expired fixed-term contracts to the next anniversary
    const sal = SALARY[role] || 6000000;
    return {
      ...base(clubId, id, STARTS[i] + 'T09:00'), username: name.split(' ')[0].toLowerCase(), name, knownAs, role, title, phone: e164(phone), supervisor: id === 's2', rateable: ['s1', 's3', 's5', 's6', 's7', 's8'].includes(id),
      appAccess: login, active: true, extraClubIds: id === 's9' ? ['adina'] : [],
      hr: { contract: i < 3 ? 'pkwtt' : 'pkwt', start: STARTS[i], end, signed: i !== 6, ktpLast4: String(1000 + Math.round(r(1) * 8999)), ktpOnFile: i !== 3, salary: sal, allowance: Math.round((sal * 0.1) / 50000) * 50000, bank: (['BCA', 'Mandiri', 'BNI', 'BRI'] as Bank[])[i % 4], account: String(1000000000 + Math.round(r(2) * 8999999999)).slice(0, 10), quote: QUOTES[id] },
    } satisfies Staff;
  });
}

// ---------------- schedule, rooms, activities, menu ----------------
const ROOMS: [string, string, string, boolean][] = [
  ['room-music', 'Music room', 'Ruang musik', true], ['room-studio', 'Studio', 'Studio', false], ['room-garden-room', 'Garden room', 'Ruang taman', true],
  ['room-garden', 'Garden', 'Taman', false], ['room-lounge', 'Lounge', 'Lounge', true], ['room-kitchen', 'Kitchen', 'Dapur', false],
  ['room-dining', 'Dining room', 'Ruang makan', false], ['room-whole', 'Whole club', 'Seluruh klub', true],
];
const ACTS: [string, string, string, string, string][] = [
  ['act-angklung', 'Angklung ensemble', 'Ansambel angklung', 'room-music', 'music_note'],
  ['act-keroncong', 'Keroncong sing-along', 'Bernyanyi keroncong', 'room-music', 'music_note'],
  ['act-line', 'Line dancing', 'Line dance', 'room-music', 'music_note'],
  ['act-batik', 'Batik painting', 'Melukis batik', 'room-studio', 'palette'],
  ['act-yoga', 'Chair yoga', 'Yoga kursi', 'room-garden-room', 'self_improvement'],
  ['act-garden', 'Gardening club', 'Klub berkebun', 'room-garden', 'yard'],
  ['act-memory', 'Memory games', 'Permainan memori', 'room-lounge', 'extension'],
  ['act-mahjong', 'Mahjong and cards', 'Mahjong dan kartu', 'room-lounge', 'style'],
  ['act-cooking', 'Cooking demo with Chef Agus', 'Demo masak bersama Chef Agus', 'room-kitchen', 'skillet'],
  ['act-reading', 'Reading circle', 'Lingkar membaca', 'room-lounge', 'menu_book'],
];
const SCHED: Record<Weekday, [string, string][]> = {
  1: [['act-angklung', 's5'], ['act-yoga', 's6']],
  2: [['act-batik', 's6'], ['act-memory', 's5']],
  3: [['act-keroncong', 's5'], ['act-batik', 's6']],
  4: [['act-garden', 's6'], ['act-mahjong', 's5']],
  5: [['act-line', 's5'], ['act-cooking', 's6']],
};
const actRoom = (id: string) => ACTS.find((a) => a[0] === id)![3];
const actName = (id: string) => ACTS.find((a) => a[0] === id)![1];

const DISHES: [string, string, 'lunch' | 'soft' | 'tea', DishAllergen[], ('soft' | 'lowSalt' | 'sugarFree' | 'vegetarian')[]][] = [
  ['dish-ayam-bakar', 'Ayam bakar kecap', 'lunch', ['soy'], []], ['dish-sayur-asem', 'Sayur asem', 'lunch', ['peanuts'], ['vegetarian']],
  ['dish-nasi-merah', 'Nasi merah', 'lunch', [], ['vegetarian']], ['dish-semangka', 'Semangka', 'lunch', [], ['vegetarian']],
  ['dish-bubur-ayam', 'Bubur ayam', 'soft', [], ['soft']], ['dish-pisang-rebus', 'Pisang rebus', 'tea', [], ['vegetarian']], ['dish-teh-jahe', 'Teh jahe', 'tea', [], ['sugarFree']],
  ['dish-rawon', 'Rawon daging', 'lunch', [], []], ['dish-telur-asin', 'Telur asin', 'lunch', ['eggs'], []], ['dish-nasi-putih', 'Nasi putih', 'lunch', [], ['vegetarian']],
  ['dish-melon', 'Melon', 'lunch', [], ['vegetarian']], ['dish-sup-daging', 'Sup daging cincang', 'soft', [], ['soft']], ['dish-klepon', 'Klepon', 'tea', [], ['vegetarian']], ['dish-teh-tawar', 'Teh tawar', 'tea', [], ['sugarFree']],
  ['dish-sop-ikan', 'Sop ikan kakap', 'lunch', ['fish'], []], ['dish-tumis-buncis', 'Tumis buncis wortel', 'lunch', [], ['vegetarian']], ['dish-pepaya', 'Pepaya', 'lunch', [], ['vegetarian']],
  ['dish-bubur-ikan', 'Bubur ikan', 'soft', ['fish'], ['soft']], ['dish-kue-lumpur', 'Kue lumpur', 'tea', ['eggs', 'dairy', 'gluten'], []], ['dish-teh-melati', 'Teh melati', 'tea', [], ['sugarFree']],
  ['dish-semur-tahu', 'Semur tahu tempe', 'lunch', ['soy'], ['vegetarian']], ['dish-sayur-bayam', 'Sayur bayam', 'lunch', [], ['vegetarian']], ['dish-jeruk', 'Jeruk', 'lunch', [], ['vegetarian']],
  ['dish-tim-tahu', 'Tim tahu sayur', 'soft', ['soy'], ['soft', 'vegetarian']], ['dish-kacang-hijau', 'Bubur kacang hijau', 'tea', [], ['vegetarian']],
  ['dish-gado-gado', 'Gado-gado (sauce on the side)', 'lunch', ['peanuts', 'eggs'], ['vegetarian']], ['dish-soto-bening', 'Soto ayam bening', 'lunch', [], []], ['dish-buah-naga', 'Buah naga', 'lunch', [], ['vegetarian']],
  ['dish-soto-halus', 'Soto ayam halus', 'soft', [], ['soft']], ['dish-lapis-legit', 'Lapis legit', 'tea', ['eggs', 'dairy', 'gluten'], []], ['dish-kopi-susu', 'Kopi susu', 'tea', ['dairy'], []],
];
const MENU_DAYS: Record<Weekday, { lunch: string[]; soft: string[]; tea: string[] }> = {
  1: { lunch: ['dish-ayam-bakar', 'dish-sayur-asem', 'dish-nasi-merah', 'dish-semangka'], soft: ['dish-bubur-ayam'], tea: ['dish-pisang-rebus', 'dish-teh-jahe'] },
  2: { lunch: ['dish-rawon', 'dish-telur-asin', 'dish-nasi-putih', 'dish-melon'], soft: ['dish-sup-daging'], tea: ['dish-klepon', 'dish-teh-tawar'] },
  3: { lunch: ['dish-sop-ikan', 'dish-nasi-merah', 'dish-tumis-buncis', 'dish-pepaya'], soft: ['dish-bubur-ikan'], tea: ['dish-kue-lumpur', 'dish-teh-melati'] },
  4: { lunch: ['dish-semur-tahu', 'dish-sayur-bayam', 'dish-nasi-merah', 'dish-jeruk'], soft: ['dish-tim-tahu'], tea: ['dish-kacang-hijau'] },
  5: { lunch: ['dish-gado-gado', 'dish-soto-bening', 'dish-buah-naga'], soft: ['dish-soto-halus'], tea: ['dish-lapis-legit', 'dish-kopi-susu'] },
};

// ---------------- members & family ----------------
const VA = (i: number) => '8808' + String(1203440000 + i * 7919).padStart(12, '0');

interface CastRow {
  id: string; idx: number; title: Member['title']; first: string; last: string; gender: 'f' | 'm'; dob: ISODate; address: string; start: ISODate;
  plan: 'flex' | 'gold'; usual: string;
  food: Member['health']['food']; mobility: Member['health']['mobility']; diet: Member['health']['diet']; diabetic: boolean; conditions: string[];
  meds: [string, string, Member['health']['meds'][number]['timing']][]; cognitive: string; care: string; nanny: string | null; spouse: string | null;
  sim: Member['sim']; tone: number; healthInfo: boolean;
}
const CAST: CastRow[] = [
  { id: 'm1', idx: 0, title: 'Oma', first: 'Lina', last: 'Wijaya', gender: 'f', dob: '1945-05-14', address: 'Jl. Bangka Raya no. 18, Kemang, Jakarta Selatan', start: '2025-03-03',
    plan: 'flex', usual: '10:05', food: ['shellfish'], mobility: 'walkingStick', diet: [], diabetic: false,
    conditions: ['High blood pressure, controlled', 'Osteoporosis', 'Hard of hearing, left ear', 'Old wrist fracture, left'],
    meds: [['Amlodipine', '5 mg', 'morningHome'], ['Calcium + Vitamin D', '1 tablet', 'lunchClub']], cognitive: 'Alert and oriented',
    care: 'Use her right arm for blood pressure (old wrist fracture on the left). Hard of hearing on the left side.', nanny: 'Mbak Sari', spouse: 'm46',
    sim: { sys: 128, dia: 80, pulse: 74, spo2: 97, glucose: 118, weight: 54, temp: 36.6, grip: 17, script: { demoHigh: { sys: 152, dia: 94, pulse: 82 } } }, tone: 0, healthInfo: true },
  { id: 'm46', idx: 45, title: 'Opa', first: 'Budi', last: 'Wijaya', gender: 'm', dob: '1942-02-03', address: 'Jl. Bangka Raya no. 18, Kemang, Jakarta Selatan', start: '2025-03-03',
    plan: 'gold', usual: '10:05', food: [], mobility: 'walkingStick', diet: ['lowSalt'], diabetic: false,
    conditions: ['High blood pressure', 'Heart health, on preventive aspirin', 'Hard of hearing, right ear'],
    meds: [['Amlodipine', '5 mg', 'morningHome'], ['Aspirin', '80 mg', 'morningHome']], cognitive: 'Alert and oriented',
    care: 'Sits with Oma Lina at lunch. Likes the newspaper first thing; hard of hearing on the right.', nanny: null, spouse: 'm1',
    sim: { sys: 134, dia: 82, pulse: 70, spo2: 96, glucose: 124, weight: 66.5, temp: 36.5, grip: 23 }, tone: 1, healthInfo: false },
  { id: 'm2', idx: 1, title: 'Opa', first: 'Hendra', last: 'Gunawan', gender: 'm', dob: '1942-07-19', address: 'Jl. Kemang Timur no. 7, Jakarta Selatan', start: '2024-08-05',
    plan: 'gold', usual: '09:40', food: [], mobility: 'walker', diet: ['lowSalt'], diabetic: false,
    conditions: ['High blood pressure'], meds: [], cognitive: 'Alert and oriented',
    care: 'On watch for blood pressure since 14 Oct. dr. Andreas asked for a re-check if over 160.', nanny: null, spouse: null,
    sim: { sys: 146, dia: 90, pulse: 78, spo2: 96, glucose: 132, weight: 68.4, temp: 36.7, grip: 17, script: { arrival: { sys: 164, dia: 98, pulse: 84 }, recheck: { sys: 152, dia: 92, pulse: 78 } } }, tone: 1, healthInfo: true },
  { id: 'm20', idx: 19, title: 'Opa', first: 'Tjahjadi', last: 'Lim', gender: 'm', dob: '1938-04-02', address: 'Jl. Cipete Raya no. 42, Jakarta Selatan', start: '2024-07-01',
    plan: 'gold', usual: '09:38', food: [], mobility: 'walker', diet: ['softFood'], diabetic: true,
    conditions: ['Type 2 diabetes'], meds: [['Metformin', '500 mg', 'lunchClub']], cognitive: 'Alert and oriented',
    care: 'Diabetic: offer the sugar-free snack at tea. Prefers the same seat near the piano.', nanny: null, spouse: null,
    sim: { sys: 129, dia: 72, pulse: 71, spo2: 96, glucose: 196, weight: 54.6, temp: 36.8, grip: 16 }, tone: 4, healthInfo: true },
  { id: 'm10', idx: 9, title: 'Bapak', first: 'Bambang', last: 'Purnomo', gender: 'm', dob: '1949-08-17', address: 'Jl. Wijaya I no. 30, Kebayoran Baru, Jakarta Selatan', start: '2024-10-07',
    plan: 'flex', usual: '09:48', food: ['seafood'], mobility: null, diet: [], diabetic: false,
    conditions: ['High blood pressure', 'Early memory loss'], meds: [['Bisoprolol', '2.5 mg', 'morningHome'], ['Donepezil', '5 mg', 'eveningHome']],
    cognitive: 'Mild memory loss; needs gentle reminders of the day’s plan', care: 'Speak slowly and face him. Gentle reminders of the plan for the day help.', nanny: null, spouse: null,
    sim: { sys: 118, dia: 73, pulse: 67, spo2: 97, glucose: 106, weight: 50.8, temp: 36.3, grip: 24 }, tone: 4, healthInfo: true },
];
const FAMILY: [string, string, string, string, [string, Relation, boolean][]][] = [
  ['f1', 'Maria Wijaya', 'Maria', '+62 812-1090-4471', [['m1', 'daughter', true], ['m46', 'daughter', true]]],
  ['f2', 'Daniel Wijaya', 'Daniel', '+62 813-8820-1156', [['m1', 'son', false], ['m46', 'son', false]]],
  ['fm2_0', 'Cynthia Gunawan', 'Cynthia', '+62 815-1294-4718', [['m2', 'daughter', true]]],
  ['fm2_1', 'Stephanie Gunawan', 'Stephanie', '+62 818-4128-3915', [['m2', 'daughterInLaw', false]]],
  ['fm10_0', 'Laras Saputra', 'Laras', '+62 816-1436-6582', [['m10', 'daughter', true]]],
  ['fm20_0', 'Yohana Lim', 'Yohana', '+62 814-2182-3624', [['m20', 'daughter', true]]],
];
const PRIMARY: Record<string, string> = { m1: 'f1', m46: 'f1', m2: 'fm2_0', m10: 'fm10_0', m20: 'fm20_0' };

// Visits as written for 21 Oct 2026: Oma Lina (Flex, 10 visits a month) has used all 10 October visits by the 20th,
// so that day's face check-in is an extra day; Bambang is at 7 of 10.
const LINA_21OCT = ['2026-09-23', '2026-09-28', '2026-09-30', '2026-10-02', '2026-10-05', '2026-10-07', '2026-10-09', '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-16', '2026-10-19', '2026-10-20'];
const BAMBANG_21OCT = ['2026-09-23', '2026-09-28', '2026-09-30', '2026-10-02', '2026-10-05', '2026-10-07', '2026-10-09', '2026-10-12', '2026-10-14', '2026-10-19'];
const MON_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const weekdaysIn = (from: ISODate, to: ISODate) => { const out: ISODate[] = []; for (let d = from; d <= to; d = addDays(d, 1)) if (isWeekday(d)) out.push(d); return out; };
/** n days spread evenly over a list, always keeping the first and the last. */
const spread = (days: ISODate[], n: number) => (n >= days.length ? days.slice() : Array.from({ length: n }, (_, i) => days[Math.round((i * (days.length - 1)) / Math.max(1, n - 1))]));

export function buildCitra(anchor: ISODate = DEMO_TODAY, nowMin: number = DEMO_START_MIN, opts: { roster?: boolean } = {}): ClubState {
  const C = 'citra';
  const T = anchor;
  /** today's events exist only once their time has passed (the demo clock is real time; 09:58 for the tests) */
  const done = (hm: string) => toMin(hm) <= nowMin;
  const closed = nowMin >= toMin(SETTINGS.close);
  // ----- dates relative to the anchor (identity for 21 Oct 2026) -----
  const off = daysBetween(DEMO_TODAY, T);
  const canon = off === 0;
  const sh = (d: ISODate) => addDays(d, off); // a seed date, moved with the anchor
  const at = (dt: DT) => sh(dt.slice(0, 10)) + dt.slice(10);
  const isClubDay = (d: ISODate) => isWeekday(d) && !['12-25', '01-01'].includes(d.slice(5)); // the seed's holidays
  const openOn = (d: ISODate) => { let x = d; while (!isClubDay(x)) x = addDays(x, 1); return x; };
  const op = (d: ISODate) => openOn(sh(d)); // moved, then onto an open club day
  const lastDow = (w: number) => { let x = addDays(T, -1); while (dow(x) !== w) x = addDays(x, -1); return x; };
  const nextDow = (w: number) => { let x = addDays(T, 1); while (dow(x) !== w) x = addDays(x, 1); return x; };
  const monday = addDays(T, -((dow(T) + 6) % 7));
  const month = ym(T);
  const dm = (d: ISODate) => `${+d.slice(8)} ${MON_EN[+d.slice(5, 7) - 1]}`;
  const longDay = (d: ISODate) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' }).replace(',', '');
  // history: the 4 weeks before the anchor (20 club days)
  const PAST: ISODate[] = weekdaysIn(addDays(T, -28), addDays(T, -1));
  const openBefore = weekdaysIn(`${month}-01`, addDays(T, -1));
  const prevOpen = weekdaysIn(`${addMonths(month, -1)}-01`, addDays(`${month}-01`, -1));
  const mwf = (d: ISODate) => [1, 3, 5].includes(dow(d));
  // Flex visits: from mid-month, Lina's 10 visits are used before today, so today's check-in is her 11th (live);
  // earlier in a month that can't be, so last month had 11 visits and its extra day is on this month's invoice.
  const liveExtra = openBefore.length >= SETTINGS.flexQuota;
  const LINA = canon ? LINA_21OCT : liveExtra
    ? [...prevOpen.filter((d) => d >= PAST[0] && mwf(d)), ...spread(openBefore, SETTINGS.flexQuota)]
    : [...spread(prevOpen, SETTINGS.flexQuota + 1), ...openBefore.filter(mwf)];
  const BAMBANG = canon ? BAMBANG_21OCT : [...prevOpen.filter((d) => d >= PAST[0] && mwf(d)), ...spread(openBefore, Math.min(7, openBefore.length))];
  const attends = (id: string, d: ISODate) =>
    id === 'm1' ? LINA.includes(d) : id === 'm10' ? BAMBANG.includes(d) : id === 'm20' ? [1, 2, 3, 5].includes(dow(d)) : true;
  const PHOTO_DAYS = PAST.slice(-5);
  const HENDRA_DAY = PAST[PAST.length - 5]; // his 164/98 (Watch) day
  const linaInPast = LINA.filter((d) => d >= PAST[0]);
  const LINA_LOG_DAY = linaInPast[linaInPast.length - 2] ?? linaInPast[0] ?? PAST[PAST.length - 1]; // the "sang Bengawan Solo" log
  const FIRST_THIS_MONTH = openBefore.find((d) => d >= PAST[0]);
  /** a member's first visit in the 4-week history (their monthly check day) */
  const firstVisit = (id: string) => PAST.find((d) => attends(id, d)) ?? PAST[0];
  const BAMBANG_FIRST = BAMBANG.find((d) => ym(d) === month);
  const s = emptyClub(C, { ...base(C, C, '2024-06-01T09:00'), name: 'CitraPremier', fullName: 'CitraPremier | Premium Seniors Club', status: 'open', settings: SETTINGS });
  const r = rng(20261021);
  const between = (a: number, b: number) => a + Math.floor(r() * (b - a + 1));
  const nz = (v: number, sp: number) => Math.round(v + (r() - 0.5) * 2 * sp);
  const put = <K extends CollectionName>(k: K, row: ClubState[K][string]) => { ((s[k] as unknown) as Record<string, unknown>)[(row as { id: string }).id] = row; };

  put('prices', { ...base(C, 'price-2024', '2024-06-01T09:00'), from: '2024-01-01', flex: 5500000, gold: 9500000, extra: 650000, sample: { flex: true, gold: true, extra: true } });
  staffRows(C, T).forEach((x) => put('staff', x));
  put('hrNotes', { ...base(C, 'hr-s4-1', at('2026-08-12T10:00'), 'staff:s9'), staffId: 's4', kind: 'warning', on: sh('2026-08-12'), text: 'Verbal warning: arrived 40 minutes late twice in one week. Agreed a new bus route.' });
  for (const d of PAST) for (const [id] of STAFF) put('staffTime', { ...base(C, `st-${id}-${d}`, d + 'T17:00'), staffId: id, date: d, kind: 'worked', from: id === 's7' ? '07:30' : '08:00', to: id === 's7' ? '16:45' : '17:00' });

  ROOMS.forEach(([id, name, nameId, venue]) => put('rooms', { ...base(C, id, '2024-06-01T09:00'), name, nameId, venue }));
  ACTS.forEach(([id, name, nameId, roomId, icon]) => put('activities', { ...base(C, id, '2024-06-01T09:00'), name, nameId, icon, roomId, active: true }));
  const days = {} as Record<Weekday, Record<Slot, ScheduleCell | null>>;
  ([1, 2, 3, 4, 5] as Weekday[]).forEach((w) => { const [a, b] = SCHED[w]; days[w] = { '10:30': { activityId: a[0], staffId: a[1], roomId: actRoom(a[0]) }, '13:30': { activityId: b[0], staffId: b[1], roomId: actRoom(b[0]) } }; });
  put('scheduleVersions', { ...base(C, 'sched-2024-07', at('2026-10-19T16:10'), 'staff:s9'), effectiveFrom: '2024-07-01', status: 'published', days, publishedBy: 'staff:s9', publishedAt: at('2026-10-19T16:10') });
  DISHES.forEach(([id, name, course, allergens, tags]) => put('dishes', { ...base(C, id, '2024-06-01T09:00', 'staff:s3'), name, course, allergens, tags, reviewedBy: 's3', reviewedAt: at('2026-10-01T10:00') } satisfies Dish));
  put('menuVersions', { ...base(C, 'menu-2024-07', '2024-06-20T10:00', 'staff:s3'), effectiveFrom: '2024-07-01', status: 'published', days: MENU_DAYS, publishedBy: 'staff:s3' });
  // the demo day always serves Wednesday's fish soup (Bambang's seafood allergy, the fish-bone feedback)
  if (dow(T) !== 3) put('dayMenus', { ...base(C, T, `${T}T07:00`, 'staff:s3'), date: T, lunch: MENU_DAYS[3].lunch, soft: MENU_DAYS[3].soft, tea: MENU_DAYS[3].tea, photoIds: [], allergyPlans: [] });

  // members
  for (const c of CAST) {
    const m: Member = {
      ...base(C, c.id, c.start + 'T10:00', 'staff:s1'), title: c.title, firstName: c.first, lastName: c.last, gender: c.gender, dob: c.dob, ageYears: null, address: c.address, photoTone: c.tone,
      memberships: [{ start: c.start }], plans: [{ from: c.start, plan: c.plan, by: 'staff:s1' }], usualArrival: c.usual,
      nanny: c.nanny ? { name: c.nanny } : null, spouseId: c.spouse,
      health: { conditions: c.conditions, diabetic: c.diabetic, food: c.food, drugs: [], mobility: c.mobility, diet: c.diet, meds: c.meds.map(([name, dose, timing], i) => ({ id: `${c.id}-med${i + 1}`, name, dose, timing })),
        cognitive: { summary: c.cognitive, reviewedBy: 's8', reviewedOn: sh('2026-10-01') } },
      care: { instructions: c.id === 'm2' ? c.care.replace('14 Oct', dm(HENDRA_DAY)) : c.care, by: 'staff:s8', at: `${HENDRA_DAY}T10:45` },
      consents: [{ kind: 'data', granted: true, by: `family:${PRIMARY[c.id]}`, byName: FAMILY.find((f) => f[0] === PRIMARY[c.id])![1], at: c.start + 'T09:00', via: 'paper' }, { kind: 'face', granted: true, by: `family:${PRIMARY[c.id]}`, byName: FAMILY.find((f) => f[0] === PRIMARY[c.id])![1], at: c.start + 'T09:00', via: 'paper' }],
      documents: [
        { id: `${c.id}-doc-ktp`, type: 'ktp', status: 'onFile', fileName: 'ktp.jpg', on: c.start, via: 'staff', by: `family:${PRIMARY[c.id]}` },
        ...(c.nanny ? [{ id: `${c.id}-doc-nktp`, type: 'nannyKtp' as const, status: 'onFile' as const, fileName: 'ktp-nanny.jpg', on: c.start, via: 'staff' as const, by: `family:${PRIMARY[c.id]}` as Actor }] : []),
        { id: `${c.id}-doc-form`, type: 'membershipForm', status: 'onFile', fileName: 'membership-form.pdf', on: c.start, via: 'staff', by: `family:${PRIMARY[c.id]}` },
        c.healthInfo ? { id: `${c.id}-doc-health`, type: 'healthInfo', status: 'onFile', fileName: 'health-info.jpg', on: c.start, via: 'staff', by: `family:${PRIMARY[c.id]}` } : { id: `${c.id}-doc-health`, type: 'healthInfo', status: 'requested', on: sh('2026-10-12'), by: 'staff:s1' },
      ],
      face: { enrolled: true, at: c.start + 'T10:00' }, billing: { va: VA(c.idx) }, sim: c.sim,
    };
    put('members', m);
    put('activity', { id: `act-${c.id}-created`, clubId: C, at: c.start + 'T10:00', actor: 'staff:s1', action: 'members.create', memberId: c.id, icon: 'person_add', key: 'feed.memberCreatedForm', params: {} } satisfies ActivityEntry);
  }
  for (const [id, name, first, phone, links] of FAMILY) {
    put('familyContacts', { ...base(C, id, '2025-03-03T10:00', 'staff:s1'), username: first.toLowerCase(), name, firstName: first, phone: e164(phone), lang: id === 'f1' ? 'en' : 'id', activatedAt: '2025-03-03T10:00' } satisfies FamilyContact);
    for (const [mid, rel, primary] of links) put('familyLinks', { ...base(C, `${id}:${mid}`, '2025-03-03T10:00', 'staff:s1'), familyId: id, memberId: mid, relation: rel, primary, appAccess: true, healthAlerts: true } satisfies FamilyLink);
  }

  // notes (staff-only and shared with family)
  const note = (id: string, memberId: string, visibility: 'staff' | 'family', text: string, by: string, on: ISODate, pinned = false) =>
    put('memberNotes', { ...base(C, id, on + 'T15:00', `staff:${by}`), memberId, visibility, text, on, pinned } satisfies MemberNote);
  note('n-m1-1', 'm1', 'family', 'Loves keroncong, especially Bengawan Solo. Likes the seat by the garden window.', 's5', sh('2026-10-07'), true);
  note('n-m1-2', 'm1', 'staff', 'Mbak Sari waits in the lounge on Mondays; she prefers to sit near Oma Lina at lunch.', 's1', LINA_LOG_DAY);
  note('n-m1-3', 'm1', 'family', 'Asked us to play Bengawan Solo again on Wednesday. Dinar has it on the list.', 's5', LINA_LOG_DAY);
  note('n-m46-1', 'm46', 'family', 'Retired pharmacist. Enjoys chess and the morning newspaper.', 's5', sh('2026-10-07'), true);
  note('n-m2-1', 'm2', 'family', 'Former engineer; loves puzzles and card games.', 's5', sh('2026-10-07'), true);
  note('n-m2-2', 'm2', 'staff', 'Ask before helping with the walker; likes to manage alone.', 's8', HENDRA_DAY);
  note('n-m20-1', 'm20', 'family', 'Enjoys mahjong with friends after lunch.', 's5', sh('2026-10-07'), true);
  note('n-m10-1', 'm10', 'family', 'Former teacher; enjoys reading aloud to the group.', 's5', sh('2026-10-07'), true);
  note('n-m10-2', 'm10', 'staff', 'Can be anxious on arrival; give a few minutes with tea before the health check.', 's8', HENDRA_DAY);

  // attendance, readings, logs (history)
  const memById = (id: string) => s.members[id];
  const attRow = (date: ISODate, memberId: string, inAt: string, outAt?: string): Attendance => {
    return { ...base(C, `${date}:${memberId}`, `${date}T${inAt}`, 'staff:s1'), memberId, date,
      checkIn: { at: inAt, by: 'staff:s1', method: 'face' },
      ...(outAt ? { checkOut: { at: outAt, by: 'staff:s1', method: 'manual' } } : {}),
      queueAdds: [], dismissed: [], edits: [{ at: `${date}T${inAt}`, by: 'staff:s1', what: 'checkIn' }, ...(outAt ? [{ at: `${date}T${outAt}`, by: 'staff:s1' as Actor, what: 'checkOut' as const }] : [])] };
  };
  let rid = 0;
  const reading = (memberId: string, date: ISODate, time: string, kind: Reading['kind'], v: Partial<Reading>) => {
    const row: Reading = { ...base(C, `h${++rid}`, `${date}T${time}`, 'staff:s8'), memberId, date, time, kind, status: 'normal', takenBy: 's8', source: 'device', noteKeys: [], shared: false, edits: [], ...v };
    row.status = evaluateReading(row);
    put('readings', row);
    return row;
  };
  const MOOD = (x: number): DailyLog['mood'] => (x < 0.42 ? 'cheerful' : x < 0.88 ? 'calm' : x < 0.97 ? 'quiet' : 'agitated');
  const LUNCH = (y: number): DailyLog['lunch'] => (y < 0.72 ? 'all' : y < 0.92 ? 'most' : 'half');
  const NOTES = { quiet: 'Quieter than usual today; sat out of the afternoon session.', agitated: 'A little unsettled before lunch; calmer after a walk in the garden.', half: 'Ate about half of lunch; had extra fruit at tea.' };
  let pid = 0;
  for (const d of PAST) {
    const w = dow(d) as Weekday;
    const here = CAST.filter((c) => attends(c.id, d));
    for (const c of here) {
      const m = memById(c.id);
      const inAt = toHM(toMin(c.usual) + between(-7, 7));
      const outAt = toHM(between(15 * 60 + 40, 16 * 60 + 25));
      put('attendance', attRow(d, c.id, inAt, outAt));
      // readings
      const b = m.sim;
      let sys = nz(b.sys, 6), dia = nz(b.dia, 4);
      if (c.id === 'm1') { sys = 124 + between(0, 6); dia = 78 + between(0, 4); }
      else if (c.id !== 'm2') { sys = Math.min(sys, 136); dia = Math.min(dia, 86); }
      if (c.id === 'm2' && d === HENDRA_DAY) {
        reading('m2', d, '09:48', 'arrival', { sys: 164, dia: 98, pulse: 84, spo2: 96, temp: 36.7, shared: true, familyTold: { at: `${d}T10:40`, by: 's8', familyIds: ['fm2_0'] } });
        reading('m2', d, '10:20', 'recheck', { sys: 150, dia: 92, pulse: 79 });
        reading('m2', d, '16:10', 'departure', { sys: 144, dia: 91, pulse: 76 });
        continue_logs(d, c, w);
        continue;
      }
      const spo2 = Math.max(c.id === 'm2' ? 94 : 95, Math.min(99, nz(b.spo2, 1)));
      reading(c.id, d, toHM(toMin(inAt) + between(6, 14)), 'arrival', { sys, dia, pulse: Math.max(60, Math.min(98, nz(b.pulse, 5))), spo2, temp: Math.round((b.temp + (r() - 0.5) * 0.4) * 10) / 10 });
      let s2 = nz(b.sys - 2, 6), d2 = nz(b.dia - 1, 4);
      if (c.id !== 'm2') { s2 = Math.min(s2, 136); d2 = Math.min(d2, 86); }
      if (c.id === 'm1') { s2 = 122 + between(0, 6); d2 = 76 + between(0, 4); }
      reading(c.id, d, toHM(toMin(outAt) - between(10, 22)), 'departure', { sys: s2, dia: d2, pulse: Math.max(60, Math.min(98, nz(b.pulse, 5))) });
      continue_logs(d, c, w);
    }
    // monthly checks: the first history day for everyone; this month's first day for m46 and m2; Bambang's first visit this month
    for (const c of here) {
      const due = d === firstVisit(c.id) || (d === FIRST_THIS_MONTH && ['m46', 'm2'].includes(c.id)) || (d === BAMBANG_FIRST && c.id === 'm10');
      if (!due) continue;
      const a = s.attendance[`${d}:${c.id}`];
      const m = memById(c.id);
      const glucose = c.id === 'm20' && d === firstVisit('m20') ? 196 : Math.min(175, nz(m.sim.glucose, 10));
      reading(c.id, d, toHM(toMin(a.checkIn!.at) + 16), 'monthly', { glucose, weight: Math.round((m.sim.weight + (r() - 0.5) * 1.2) * 10) / 10, grip: Math.round(m.sim.grip + (r() - 0.5) * 2) });
    }
  }
  function continue_logs(d: ISODate, c: CastRow, w: Weekday) {
    const sessions = SCHED[w];
    const sAct = sessions[Math.floor(r() * sessions.length)];
    const mood = MOOD(r()); const lunch = LUNCH(r());
    let note = mood === 'quiet' || mood === 'agitated' ? NOTES[mood] : lunch === 'half' ? NOTES.half : '';
    let log: DailyLog = { ...base(C, `log-${c.id}-${d}`, `${d}T15:10`, `staff:${sAct[1]}`), memberId: c.id, date: d, mood, lunch, joined: mood === 'quiet' ? 'satOut' : 'yes', communicative: mood === 'quiet' ? 'withdrawn' : 'normal', content: 'normal', note, status: 'saved', by: sAct[1], edits: [] };
    if (c.id === 'm1' && d === LINA_LOG_DAY) { log = { ...log, mood: 'cheerful', lunch: 'all', joined: 'yes', communicative: 'normal', by: 's5', createdBy: 'staff:s5', note: 'Oma Lina sang Bengawan Solo for the group during angklung practice and the whole room joined in. She asked if we can play it again on Wednesday.' }; note = log.note; }
    put('dailyLogs', log);
  }
  // photos for the last 5 club days
  for (const d of PHOTO_DAYS) {
    const w = dow(d) as Weekday;
    const here = CAST.filter((c) => attends(c.id, d)).map((c) => c.id);
    const sessions = SCHED[w].map(([act, by], i) => ({ act, by, time: i === 0 ? '10:30' : '13:30' }));
    for (const id of here) {
      const sx = sessions[Math.floor(r() * sessions.length)];
      put('photos', { ...base(C, `p${++pid}`, `${d}T${sx.time}`, `staff:${sx.by}`), date: d, time: toHM(toMin(sx.time) + between(5, 50)), kind: 'solo', media: 'photo', activity: actName(sx.act), memberIds: [id], tone: between(0, 4), takenBy: sx.by, visibility: 'visible' } satisfies Photo);
    }
    sessions.forEach((sx, si) => {
      for (let g = 0; g < 2; g++) {
        const n = Math.max(2, Math.min(here.length, between(2, 4)));
        let tags = here.slice().sort(() => r() - 0.5).slice(0, n);
        if (d === LINA_LOG_DAY && here.includes('m1') && !tags.includes('m1')) tags = ['m1', ...tags].slice(0, Math.max(n, 2));
        const video = d === LINA_LOG_DAY && si === 0 && g === 0;
        put('photos', { ...base(C, `p${++pid}`, `${d}T${sx.time}`, `staff:${sx.by}`), date: d, time: toHM(toMin(sx.time) + between(5, 50)), kind: 'group', media: video ? 'video' : 'photo', ...(video ? { durationSec: 14 } : {}), activity: actName(sx.act), memberIds: tags, tone: between(0, 4), takenBy: sx.by, visibility: 'visible' } satisfies Photo);
      }
    });
  }

  // last month's visits older than the 4-week history (early in a month: Lina's 11 visits last month)
  for (const d of LINA) if (d < PAST[0]) put('attendance', attRow(d, 'm1', '10:03', '15:52'));

  // today (09:58): Tjahjadi 09:38, Hendra 09:40 and Bambang 09:48 are in (+ Bambang's arrival reading 09:55)
  // (after closing time they have gone home)
  const OUT_AT: Record<string, string> = { m20: '16:05', m2: '16:10', m10: '16:15' };
  for (const [id, inAt] of [['m20', '09:38'], ['m2', '09:40'], ['m10', '09:48']] as const) if (done(inAt)) put('attendance', attRow(T, id, inAt, closed ? OUT_AT[id] : undefined));
  if (done('09:55')) reading('m10', T, '09:55', 'arrival', { sys: 122, dia: 73, pulse: 67, spo2: 97, temp: 36.4 });
  for (const [id, at] of [['m20', '09:38'], ['m2', '09:40'], ['m10', '09:48']] as const) {
    if (!done(at)) continue;
    const m = memById(id);
    put('activity', { id: `act-${T}-${id}-in`, clubId: C, at: `${T}T${at}`, actor: 'staff:s1', action: 'attendance.checkIn', memberId: id, icon: 'how_to_reg', key: 'feed.checkedIn', params: { name: `${m.title} ${m.firstName}`, how: 'face' } } satisfies ActivityEntry);
  }
  if (done('09:55')) put('activity', { id: `act-${T}-m10-reading`, clubId: C, at: `${T}T09:55`, actor: 'staff:s8', action: 'health.reading.save', memberId: 'm10', icon: 'monitor_heart', key: 'feed.reading', params: { name: 'Bapak Bambang', value: '122/73', status: 'normal' } } satisfies ActivityEntry);

  // plan change request: Bambang's family asks for Gold from November
  put('planChangeRequests', { ...base(C, 'pcr-m10', at('2026-10-18T20:00'), 'family:fm10_0'), memberId: 'm10', to: 'gold', from: `${addMonths(month, 1)}-01`, status: 'pending' });

  // invoices + DOKU payments
  const inv = (period: string, c: CastRow, paidOn: ISODate | null) => {
    const id = `INV-${period.slice(2, 4)}${period.slice(5, 7)}-${String(c.idx + 1).padStart(3, '0')}`;
    const amount = c.plan === 'gold' ? 9500000 : 5500000;
    const issue = `${period}-15`;
    const due = openOn(`${period}-27`); // a weekend due date moves to the next weekday
    put('invoices', { ...base(C, id, issue + 'T08:00', 'system'), number: id, memberId: c.id, payerFamilyId: PRIMARY[c.id], kind: 'monthly', period, issueDate: issue, dueDate: due,
      lines: [{ id: `plan-${period}`, kind: 'plan', label: c.plan === 'gold' ? 'inv.line.gold' : 'inv.line.flex', params: { month: period }, qty: 1, unit: amount, amount, refMonth: period }],
      va: VA(c.idx), xero: paidOn ? 'synced' : 'awaitingPayment', reminders: [], callNotes: [] } satisfies Invoice);
    if (paidOn) put('payments', { ...base(C, `pay-${id}`, paidOn + 'T11:20', `family:${PRIMARY[c.id]}`), memberId: c.id, method: 'dokuVa', amount, bank: 'BCA', receivedOn: paidOn, receivedAt: '11:20', allocations: [{ invoiceId: id, amount }], xero: 'synced', by: `family:${PRIMARY[c.id]}` } satisfies Payment);
  };
  // the two latest runs: this month's once the issue day has passed (as on 21 Oct), else last month's.
  // Tjahjadi's older invoice is overdue; in the late case the latest run is still open for Lina, Budi and Tjahjadi.
  const late = +T.slice(8) >= SETTINGS.issueDay;
  const cur = late ? month : addMonths(month, -1);
  const prev = addMonths(cur, -1);
  // once the latest run is past its due date, families have paid it; only Tjahjadi's latest stays open (overdue)
  const settled = T > openOn(`${cur}-27`);
  const PREV_PAID: Record<string, ISODate> = { m1: `${prev}-21`, m46: `${prev}-21`, m2: `${prev}-17`, m10: `${prev}-24`, ...(settled ? { m20: `${prev}-22` } : {}) };
  const CUR_PAID: Record<string, ISODate> = settled ? { m1: `${cur}-21`, m46: `${cur}-21`, m2: `${cur}-17`, m10: `${cur}-24` } : { m2: `${cur}-16`, m10: `${cur}-18` };
  const paidBy = (d: ISODate | undefined) => (d && d < T ? d : null);
  for (const c of CAST) inv(prev, c, paidBy(PREV_PAID[c.id]));
  for (const c of CAST) inv(cur, c, paidBy(CUR_PAID[c.id]));
  const invNo = (p: string, c: CastRow) => `INV-${p.slice(2, 4)}${p.slice(5, 7)}-${String(c.idx + 1).padStart(3, '0')}`;
  for (const p of [prev, cur]) put('invoiceRuns', { ...base(C, `run-${p}`, `${p}-15T00:00`), period: p, issueDate: `${p}-15`, invoiceIds: CAST.map((c) => invNo(p, c)), skipped: [] });
  const bambangPaid = paidBy(CUR_PAID.m10) ? { on: CUR_PAID.m10, period: cur } : { on: PREV_PAID.m10, period: prev };

  // threads & messages
  const thread = (id: string, fid: string, mid: string, topic: Thread['topic'], msgs: [Actor, string, DT, Message['kind']?][], readStaff: number, readFam: number, feedbackId?: string) => {
    put('threads', { ...base(C, id, msgs[0][2], msgs[0][0]), memberId: mid, familyId: fid, topic, ...(feedbackId ? { feedbackId } : {}), lastSeq: msgs.length, staffReadSeq: readStaff, familyReadSeq: readFam } satisfies Thread);
    msgs.forEach(([from, text, at, kind], i) => put('messages', { ...base(C, `${id}-${i + 1}`, at, from), threadId: id, seq: i + 1, from, at, text, kind: kind || 'text' } satisfies Message));
  };
  thread('t1', 'f1', 'm1', 'lobby', [['family:f1', 'Is Mama’s blood pressure okay this week?', at('2026-10-14T18:02')], ['staff:s8', 'Yes, all normal this week, 124/78 to 130/82. She is doing well.', at('2026-10-14T18:30')], ['family:f1', 'Mama forgot her cardigan on Monday, is it at the lobby?', at('2026-10-20T19:12')]], 2, 3);
  if (done('07:40')) thread('t2', 'fm10_0', 'm10', 'lobby', [['family:fm10_0', 'Papa has a dentist appointment Friday, he will leave at 14:00.', `${T}T07:40`]], 0, 1);
  thread('t3', 'fm2_0', 'm2', 'nurse', [['staff:s8', 'Opa Hendra’s blood pressure was 164/98 on arrival today. After a rest it was 150/92. dr. Andreas will see him on Tuesday.', `${HENDRA_DAY}T10:40`, 'healthAlert'], ['family:fm2_0', 'Thank you Ns. Dewi. We will bring his medicine list.', `${HENDRA_DAY}T12:02`]], 2, 2);
  thread('t4', 'fm20_0', 'm20', 'nurse', [['staff:s8', 'Opa Tjahjadi’s glucose was 196 this month. Could you ask his doctor about the evening dose?', `${firstVisit('m20')}T11:15`]], 1, 1);
  // meal feedback (+ kitchen threads)
  const fb = (id: string, memberId: string, familyId: string, mealDate: ISODate, dish: string, text: string, at: DT, reply?: [string, DT]) => {
    const tid = `tk-${id}`;
    thread(tid, familyId, memberId, 'kitchen', [[`family:${familyId}`, text, at], ...(reply ? [[`staff:s3`, reply[0], reply[1]] as [Actor, string, DT]] : [])], 1, reply ? 2 : 1, id);
    put('feedback', { ...base(C, id, at, `family:${familyId}`), memberId, familyId, mealDate, dish, text, status: reply ? 'answered' : 'open', threadId: tid, source: 'family' });
  };
  const lastMon = lastDow(1), lastFri = lastDow(5);
  fb('c1', 'm10', 'fm10_0', lastMon, 'Sayur asem', 'Papa said the soup was too salty on Monday.', `${lastMon}T19:30`);
  fb('c2', 'm2', 'fm2_0', lastFri, 'Gado-gado', 'Papa would like a vegetarian option on Fridays.', `${lastFri}T08:15`, ['Thank you. From next Friday there is a tempeh and vegetable option next to the gado-gado.', `${lastFri}T14:10`]);
  if (done('07:55')) fb('c3', 'm20', 'fm20_0', T, 'Sop ikan kakap', 'Last time Papa found a small bone in the fish soup. Please check before serving.', `${T}T07:55`);

  // enquiries and guest visits
  put('enquiries', { ...base(C, 'e1', at('2026-10-08T11:00'), 'staff:s1'), senior: { title: 'Oma', name: 'Siu Lan Tjandra' }, contact: { name: 'Melinda Tjandra', relation: 'daughter', phone: e164('+62 812-7781-2290') }, source: 'referral', stage: 'trial', next: { kind: 'trial', date: T } });
  put('guestVisits', { ...base(C, 'g-e1', at('2026-10-12T10:05'), 'staff:s1'), enquiryId: 'e1', kind: 'trial', date: T, name: 'Oma Siu Lan Tjandra', escortName: 'Melinda Tjandra', lunch: true, healthCheck: true, food: ['shellfish'], drugs: ['penicillin'], mobility: 'walkingStick', diet: [], status: 'booked' });
  put('enquiries', { ...base(C, 'e2', at('2026-10-17T15:00'), 'staff:s1'), senior: { title: 'Bapak', name: 'Yusuf Hamid' }, contact: { name: 'Ilham Hamid', relation: 'son', phone: e164('+62 813-5520-1874') }, source: 'instagram', stage: 'visit', next: { kind: 'visit', date: T, time: '14:00' } });
  put('guestVisits', { ...base(C, 'g-e2', at('2026-10-17T15:05'), 'staff:s1'), enquiryId: 'e2', kind: 'visit', date: T, time: '14:00', name: 'Bapak Yusuf Hamid', escortName: 'Ilham Hamid', lunch: false, healthCheck: false, food: null, drugs: [], mobility: null, diet: [], status: 'booked' });
  put('enquiries', { ...base(C, 'e3', at('2026-10-20T09:30'), 'staff:s1'), senior: { title: 'Oma', name: 'Ellen Sutanto' }, contact: { name: 'Kevin Sutanto', relation: 'grandson', phone: e164('+62 811-9034-2215') }, source: 'website', stage: 'new', next: { kind: 'callBack', date: op('2026-10-22') } });
  put('enquiries', { ...base(C, 'e5', at('2026-10-13T10:00'), 'staff:s1'), senior: { title: 'Opa', name: 'Leo Gunadi' }, contact: { name: 'Felicia Gunadi', relation: 'daughter', phone: e164('+62 812-4410-7781') }, source: 'referral', stage: 'visit', next: { kind: 'visit', date: op('2026-10-23'), time: '11:00' } });
  put('enquiries', { ...base(C, 'e9', at('2026-09-28T10:00'), 'staff:s1'), senior: { title: 'Ibu', name: 'Nyoman Sari' }, contact: { name: 'Made Arya', relation: 'son', phone: e164('+62 812-8831-2201') }, source: 'referral', stage: 'lost', lost: { reason: 'otherPlace', note: 'Chose a place closer to family in Bali', prevStage: 'visit' } });

  // calendar & venue bookings
  const ev = (id: string, date: ISODate, kind: 'closed' | 'holiday' | 'outing', title: string, titleId: string, from?: string, to?: string) =>
    put('calendarEvents', { ...base(C, id, at('2026-09-01T10:00'), 'staff:s9'), date, kind, title, titleId, ...(from ? { from, to } : {}) });
  const taken = new Set<ISODate>();
  const freeDay = (d: ISODate) => { let x = openOn(d); while (taken.has(x)) x = openOn(addDays(x, 1)); taken.add(x); return x; };
  const outingDay = freeDay(sh('2026-10-29'));
  const closedDay = freeDay(sh('2026-10-30'));
  ev('ev-closed-1030', closedDay, 'closed', 'Club closed: staff first-aid training', 'Klub tutup: pelatihan P3K staf');
  ev('ev-outing-1029', outingDay, 'outing', 'Outing: Kebun Raya Bogor botanical garden', 'Jalan-jalan: Kebun Raya Bogor', '08:30', '15:00');
  ev('ev-outing-1126', freeDay(sh('2026-11-26')), 'outing', 'Outing: batik museum and lunch', 'Jalan-jalan: museum batik dan makan siang', '09:00', '14:30');
  ev('ev-hol-1225', '2026-12-25', 'holiday', 'Christmas Day (national holiday)', 'Hari Natal (libur nasional)');
  ev('ev-hol-0101', '2027-01-01', 'holiday', 'New Year’s Day (national holiday)', 'Tahun Baru (libur nasional)');
  const venue = (id: string, org: string, contactName: string, phone: string, guests: number, roomId: string, date: ISODate, from: string, to: string, review?: { stars: number; text: string }) =>
    put('venueBookings', { ...base(C, id, at('2026-09-20T10:00'), 'staff:s9'), org, contactName, phone: e164(phone), guests, roomId, date, from, to, status: 'confirmed', price: 3500000, deposit: 1000000, ...(review ? { review, reviewAskedAt: `${date}T13:00` } : {}) });
  venue('v4', 'Rotary Club Jakarta Selatan breakfast', 'Bapak Arief Sudarmo', '+62 812-5570-8812', 35, 'room-garden-room', lastDow(6), '08:00', '12:00', { stars: 5, text: 'Spotless rooms and the kue were a hit. We will book again in January.' });
  venue('v1', 'PT Arunika Farma caregiver seminar', 'Ibu Santi Wirjo', '+62 812-3300-1180', 40, 'room-whole', nextDow(6), '09:00', '13:00');
  venue('v2', 'Bank Prima Nusantara retirees’ morning', 'Bapak Teddy Haris', '+62 811-2290-4471', 30, 'room-garden-room', addDays(nextDow(6), 7), '08:00', '12:00');

  // directory
  const dir = (id: string, kind: 'doctor' | 'service' | 'supplier', name: string, what: string, whatId: string, phone: string, pub: boolean) =>
    put('directory', { ...base(C, id, '2024-07-01T10:00', 'staff:s9'), kind, name, what, whatId, phone: e164(phone), public: pub });
  dir('d1', 'doctor', 'dr. Andreas Wirawan, Sp.PD', 'Internal medicine · visits Tuesdays', 'Penyakit dalam · berkunjung tiap Selasa', '+62 812-9001-2234', true);
  dir('d2', 'doctor', 'dr. Melinda Kusumo', 'GP on call', 'Dokter umum siaga', '+62 813-4410-9921', true);
  dir('d3', 'service', 'RS Medika Kemang', 'Nearest hospital · emergency', 'Rumah sakit terdekat · gawat darurat', '+62 21 7590 0110', true);
  dir('d4', 'service', 'Apotek Sehat Selalu', 'Pharmacy · delivers to homes', 'Apotek · antar ke rumah', '+62 21 7590 2231', true);
  dir('d6', 'supplier', 'Sayur Segar Kemang', 'Vegetables and fruit', 'Sayur dan buah', '+62 811-8802-4410', false);
  dir('d7', 'supplier', 'Ikan Laut Jaya', 'Fish', 'Ikan', '+62 812-1180-3321', false);
  dir('d9', 'supplier', 'Bersih Prima', 'Cleaning supplies', 'Perlengkapan kebersihan', '+62 21 7581 4410', false);

  // stock, budget, receipts, vendor invoices
  const stock = (id: string, item: string, qty: number, unit: string, area: 'kitchen' | 'health' | 'activities' | 'housekeeping', sectionId: string, by: string, status: 'requested' | 'approved' | 'received', date: ISODate, decidedBy?: string) =>
    put('stockRequests', { ...base(C, id, at(date + 'T09:00'), `staff:${by}`), item, qty, unit, area, sectionId, status, requestedBy: by, ...(decidedBy ? { decidedBy: `staff:${decidedBy}` as Actor, decidedAt: at(date + 'T11:00') } : {}), ...(status === 'received' ? { receivedBy: `staff:${by}` as Actor } : {}) });
  stock('k1', 'Test strips (glucose)', 2, 'boxes', 'health', 'operations', 's8', 'requested', '2026-10-20');
  stock('k2', 'Teh melati', 5, 'packs', 'kitchen', 'fnb', 's2', 'requested', '2026-10-20');
  stock('k3', 'Batik wax', 1, 'kg', 'activities', 'activities', 's6', 'approved', '2026-10-19', 's9');
  stock('k4', 'Beras merah', 25, 'kg', 'kitchen', 'fnb', 's3', 'received', '2026-10-16', 's2');
  if (done('09:00')) stock('k5', 'Hand soap refills', 6, 'bottles', 'housekeeping', 'operations', 's4', 'requested', DEMO_TODAY); // today
  put('budgetSections', { ...base(C, 'fnb', '2024-07-01T10:00', 'staff:s10'), name: 'F&B', nameId: 'Makanan & minuman', limits: [{ fromWeek: '2026-01-05', weekly: 9500000 }] });
  put('budgetSections', { ...base(C, 'activities', '2024-07-01T10:00', 'staff:s10'), name: 'Activities', nameId: 'Aktivitas', limits: [{ fromWeek: '2026-01-05', weekly: 2000000 }] });
  put('budgetSections', { ...base(C, 'operations', '2024-07-01T10:00', 'staff:s10'), name: 'Operations', nameId: 'Operasional', limits: [{ fromWeek: '2026-01-05', weekly: 2700000 }] });
  put('budgetRequests', { ...base(C, 'b1', at('2026-10-20T10:00'), 'staff:s5'), sectionId: 'activities', item: 'Angklung tuning', amount: 450000, weekStart: monday, requestedBy: 's5', status: 'pending' });
  if (done('08:30')) put('budgetRequests', { ...base(C, 'b2', `${T}T08:30`, 'staff:s2'), sectionId: 'fnb', item: 'Extra fruit for Friday', amount: 300000, weekStart: monday, requestedBy: 's2', status: 'pending' });
  put('budgetRequests', { ...base(C, 'b3', `${monday}T09:00`, 'staff:s7'), sectionId: 'operations', item: 'Wheelchair tyre repair', amount: 250000, weekStart: monday, requestedBy: 's7', status: 'approved', decidedBy: 'staff:s10', decidedAt: `${monday}T13:00` });
  put('budgetAdjustments', { ...base(C, 'adj-fnb-1019', `${monday}T08:00`, 'staff:s10'), sectionId: 'fnb', weekStart: monday, amount: 2020000, note: 'Opening balance' });
  put('budgetAdjustments', { ...base(C, 'adj-act-1019', `${monday}T08:00`, 'staff:s10'), sectionId: 'activities', weekStart: monday, amount: 840000, note: 'Opening balance' });
  put('budgetAdjustments', { ...base(C, 'adj-ops-1019', `${monday}T08:00`, 'staff:s10'), sectionId: 'operations', weekStart: monday, amount: 760000, note: 'Opening balance' });
  const rcpt = (id: string, date: ISODate, supplier: string, directoryId: string, amount: number, sectionId: string, by: string) =>
    put('receipts', { ...base(C, id, date + 'T12:00', `staff:${by}`), date, supplier, directoryId, amount, sectionId, fileName: `nota_${date.slice(8)}${date.slice(5, 7)}.jpg`, by, status: 'approved', xero: 'synced' });
  const rcDay = addDays(T, -1) >= monday ? addDays(T, -1) : T; // receipts this week
  rcpt('rc1', rcDay, 'Sayur Segar Kemang', 'd6', 1840000, 'fnb', 's2');
  rcpt('rc2', rcDay, 'Ikan Laut Jaya', 'd7', 2260000, 'fnb', 's3');
  rcpt('rc3', monday, 'Apotek Sehat Selalu', 'd4', 410000, 'operations', 's8');
  put('vendorInvoices', { ...base(C, 'vi1', at('2026-10-20T10:00'), 'staff:s10'), supplier: 'Sayur Segar Kemang', directoryId: 'd6', number: 'INV/SSK/1023', amount: 7400000, due: sh('2026-10-31'), sectionId: 'fnb', status: 'toApprove', xero: 'notSent' });
  put('vendorInvoices', { ...base(C, 'vi2', at('2026-10-15T10:00'), 'staff:s10'), supplier: 'Bersih Prima', directoryId: 'd9', number: 'BP-2610-118', amount: 1350000, due: sh('2026-10-28'), sectionId: 'operations', status: 'approved', xero: 'synced' });

  // surveys
  const RECIP = ['f1', 'fm2_0', 'fm10_0', 'fm20_0'];
  put('surveys', { ...base(C, 'sv0', at('2026-09-21T10:00'), 'staff:s9'), title: `${MONTH_FULL[+addMonths(month, -1).slice(5) - 1]} check-in`, questions: ['overall', 'team', 'recommend', 'comment'], teamStaffIds: ['s1', 's8', 's5', 's3'], recipients: RECIP, sentOn: sh('2026-09-21'), status: 'closed', closedOn: sh('2026-10-19') });
  put('surveys', { ...base(C, 'sv1', at('2026-10-19T10:00'), 'staff:s9'), title: `${MONTH_FULL[+month.slice(5) - 1]} check-in`, questions: ['overall', 'team', 'recommend', 'comment'], teamStaffIds: ['s1', 's8', 's5', 's6', 's3', 's7'], recipients: RECIP, sentOn: sh('2026-10-19'), status: 'live' });
  const OV = [5, 5, 4], T1 = [5, 5, 5], T5 = [5, 5, 5], T6 = [5, 4, 5], T3 = [4, 5, 4], T7 = [5, 4, 4];
  const SVC = ['Papa is happier on club days.', 'Lunch portions could be a little smaller.', 'Please send more photos of the afternoon sessions.'];
  ['fm2_0', 'fm10_0', 'fm20_0'].forEach((fid, i) => {
    put('surveyResponses', { ...base(C, `sr0-${fid}`, at('2026-09-22T19:00'), `family:${fid}`), surveyId: 'sv0', familyId: fid, overall: OV[i], team: { s1: T1[i], s8: 5, s5: T5[i], s3: T3[i] }, recommend: true, comment: '', on: sh('2026-09-22') });
    put('surveyResponses', { ...base(C, `sr1-${fid}`, at(`2026-10-${19 + i}T19:00`), `family:${fid}`), surveyId: 'sv1', familyId: fid, overall: OV[i], team: { s1: T1[i], s8: 5, s5: T5[i], s6: T6[i], s3: T3[i], s7: T7[i] }, recommend: true, comment: SVC[i], on: sh(`2026-10-${19 + i}`) });
  });
  put('broadcasts', { ...base(C, 'bc1', at('2026-10-12T10:00'), 'staff:s9'), template: 'closure', message: `${longDay(closedDay)} for staff first-aid training`, audiences: ['families'], recipients: 6, sendAt: at('2026-10-12T10:00'), status: 'sent', sentAt: at('2026-10-12T10:00') });

  // one pending review so the Reviews screen has something on first load
  if (done('09:05')) put('changeRequests', { ...base(C, 'cr-seed-1', `${T}T09:05`, 'staff:s1'), kind: 'approval', op: 'update', action: 'members.updateDetails', input: { memberId: 'm10', patch: { usualArrival: '09:30' } }, section: 'details',
    target: { type: 'member', id: 'm10', memberId: 'm10' }, changes: [{ field: 'usualArrival', from: '09:48', to: '09:30' }], status: 'pending', submittedBy: 'staff:s1', note: 'Laras says Papa will come earlier from next week.' } satisfies ChangeRequest);

  // Round 5: a few things the team entered that wait for management's approval (families don't see them until then)
  {
    const lastDay = PAST[PAST.length - 1];
    const log = s.dailyLogs[`log-m46-${lastDay}`];
    if (log) { // an edit of an approved log: the family keeps seeing the earlier values
      const prev = { mood: log.mood, lunch: log.lunch, joined: log.joined, communicative: log.communicative, content: log.content, note: log.note };
      Object.assign(log, { mood: 'cheerful', lunch: 'all', note: 'Joined the angklung group and finished all of his lunch.', edits: [{ at: `${lastDay}T15:40`, by: 's5' }], by: 's5' });
      log.approval = { status: 'pending', by: 'staff:s5', at: `${lastDay}T15:40`, prev };
    }
    const noteRow = { ...base(C, 'n-m2-3', `${lastDay}T15:30`, 'staff:s5'), memberId: 'm2', visibility: 'family' as const, text: 'Beat the volunteers at chess today and taught two of them a new opening.', on: lastDay, pinned: false, approval: { status: 'pending' as const, by: 'staff:s5' as Actor, at: `${lastDay}T15:30` } };
    put('memberNotes', noteRow satisfies MemberNote);
    const rd = Object.values(s.readings).find((x) => x.memberId === 'm46' && x.date === lastDay && x.kind === 'arrival');
    if (rd) rd.approval = { status: 'pending', by: 'staff:s8', at: `${lastDay}T${toHM(toMin(rd.time) + 2)}`, defer: { tell: false, share: false, overall: rd.status } };
    const planned = openOn(addDays(T, 14)); // a lunch the kitchen plans two weeks ahead
    const base4 = MENU_DAYS[dow(planned) as Weekday]?.lunch;
    if (base4 && !s.dayMenus[planned]) {
      const swap = base4[base4.length - 1] === 'dish-jeruk' ? 'dish-melon' : 'dish-jeruk';
      put('dayMenus', { ...base(C, planned, `${T}T08:10`, 'staff:s3'), date: planned, lunch: [...base4.slice(0, -1), swap], allergyPlans: [], approval: { status: 'pending', by: 'staff:s3', at: `${T}T08:10`, prev: {} } });
    }
    // allergy and care edits by the nurse are applied at once and reviewed afterwards (families see the earlier care values until management has looked)
    const m2 = s.members['m2'];
    if (m2 && done('08:50')) {
      const from = JSON.parse(JSON.stringify(m2.care));
      m2.care = { instructions: `${from.instructions} Offer a short rest after the morning exercise.`, by: 'staff:s8', at: `${T}T08:50` };
      put('changeRequests', { ...base(C, 'cr-seed-2', `${T}T08:50`, 'staff:s8'), kind: 'postReview', op: 'update', action: 'members.setCareInstructions', input: { memberId: 'm2', text: m2.care.instructions }, section: 'care',
        target: { type: 'member', id: 'm2', memberId: 'm2' }, changes: [{ field: 'care', from, to: JSON.parse(JSON.stringify(m2.care)) }], status: 'pending', submittedBy: 'staff:s8' } satisfies ChangeRequest);
    }
  }

  // a few stored "updates" so the bell's Updates tab isn't empty
  const notif = (id: string, at: DT, toUsers: string[], toRoles: StaffRole[], kind: string, params: Record<string, string | number>, link: string, memberId?: string) =>
    put('notifications', { ...base(C, id, at), toUsers, toRoles, kind, params, severity: 'info', action: false, link, memberId, readBy: [] } satisfies Notification);
  notif('nt-1', `${LINA_LOG_DAY}T15:20`, ['f1'], [], 'notif.logSaved', { name: 'Oma Lina', mood: 'cheerful' }, '/today', 'm1');
  notif('nt-2', `${LINA_LOG_DAY}T15:25`, ['f1', 'f2'], [], 'notif.newPhotos', { name: 'Oma Lina', n: 3 }, '/photos', 'm1');
  notif('nt-3', `${bambangPaid.on}T11:20`, [], ['finance', 'mgmt'], 'notif.paymentReceived', { name: 'Laras Saputra', amount: 5500000, invoice: invNo(bambangPaid.period, CAST.find((c) => c.id === 'm10')!) }, '/payments', 'm10');
  if (done('09:40')) notif('nt-4', `${T}T09:40`, ['fm2_0', 'fm2_1'], [], 'notif.checkedIn', { name: 'Opa Hendra', time: '09:40' }, '/today', 'm2');
  if (done('09:48')) notif('nt-5', `${T}T09:48`, ['fm10_0'], [], 'notif.checkedIn', { name: 'Bapak Bambang', time: '09:48' }, '/today', 'm10');
  if (opts.roster) addRoster(s, T, nowMin); // 40 more members (roster.ts); off by default so the tests keep the 5-member world
  return s;
}

export function buildAdina(): ClubState {
  const A = 'adina';
  const s = emptyClub(A, { ...base(A, A, '2026-09-01T09:00'), name: 'Adina Seniors Clubhouse', fullName: 'Adina Seniors Clubhouse', status: 'opening', note: 'Opening 2027', settings: SETTINGS });
  s.prices['price-adina'] = { ...base(A, 'price-adina', '2026-09-01T09:00'), from: '2027-01-01', flex: 5500000, gold: 9500000, extra: 650000, sample: { flex: true, gold: true, extra: true } };
  return s;
}

/** Full seed: one ClubState per clubhouse. */
export function buildSeed(anchor: ISODate = DEMO_TODAY, nowMin: number = DEMO_START_MIN, opts: { roster?: boolean } = {}): Record<string, ClubState> {
  return { citra: buildCitra(anchor, nowMin, opts), adina: buildAdina() };
}
export type { Coll };
