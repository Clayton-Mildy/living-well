// KC round 7: six months of demo history behind the 4 weeks that index.ts (the 5 hand-made members) and roster.ts (the 40 background members) already seed.
// It adds, for everyone, in this order: visits (usual weekdays, Flex never above its monthly quota, holidays and leave months skipped, a holiday or a
// sick spell now and then), an arrival reading on every visit (departure on some, a monthly check), a daily log for every visit with a mark per activity
// session, session pictures and the kitchen's lunch photo for every club day (real free Unsplash scenes), and a paid monthly invoice (with its DOKU payment and invoice run) for every month before the two latest runs.
//
// Everything here is deterministic and independent of the main seed's random stream: each member, day and reading draws from its own `rng(hash(key))`, so the
// near-T data the tests and the demo story depend on stays exactly as it was. Couples share a key (they come together and arrive within minutes of each other).
import type { Actor, Bank, ClubState, CollectionName, DailyLog, DT, HM, Invoice, InvoiceLine, ISODate, Member, Payment, Photo, Reading, Row, Slot } from '../types';
import { addDays, addMonths, daysBetween, daysInMonth, dow, rng, toHM, toMin, ym } from '../util';
import { activeOn, currentMembership, isOpen, isPendingRow, planOn, primaryContact, pron } from '../rules/core';
import { attId, flexQuota } from '../rules/attendance';
import { dueDateFor, feeOf, invoiceTotal, issueDateOf, nextInvoiceNumber, priceOn, runLinesFor } from '../rules/billing';
import { evaluateReading, limitsFor } from '../rules/health';
import { pictureSessions } from '../rules/activity';
import { menuOn, sessionsOn } from '../rules/kitchen';
import { lunchPicIds, sessionPicId } from './demoMedia';
import { leaveDeadline, onLeaveOn } from '../rules/leave';

/** How far back the history reaches (26 weeks: about 130 club days). */
const HIST_DAYS = 182;
/** The window the hand-made seed and the roster already cover (they stay as written). */
const WINDOW_DAYS = 28;

const hash32 = (str: string): number => {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
};
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const unit = (str: string) => (hash32(str) % 10000) / 10000;
const pick = <T,>(a: readonly T[], x: number): T => a[Math.min(a.length - 1, Math.floor(x * a.length))];

// ---------- who comes when ----------
interface Prof { key: string; order: number[]; nGold: number; nFlex: number; regGold: number; regFlex: number; sigma: number }
/** The hand-made members: usual weekdays in order (Mon = 1), days a week on Gold / on Flex, and how regular they are. */
const ANCHORS: Record<string, { order: number[]; nGold: number; nFlex: number; reg: number }> = {
  m1: { order: [1, 3, 5, 2, 4], nGold: 4, nFlex: 3, reg: 0.96 }, // Oma Lina: Mon, Wed, Fri, so she runs out of her 10 Flex visits before the month ends
  m46: { order: [1, 3, 5, 2, 4], nGold: 5, nFlex: 3, reg: 0.88 }, // Opa Budi comes with her, and on most Tuesdays and Thursdays
  m2: { order: [2, 4, 1, 3, 5], nGold: 5, nFlex: 3, reg: 0.9 },
  m20: { order: [1, 2, 3, 5, 4], nGold: 4, nFlex: 3, reg: 0.96 },
  m10: { order: [1, 3, 5, 2, 4], nGold: 3, nFlex: 2, reg: 0.92 }, // Bapak Bambang: two days a week, 7 to 8 of his 10 visits
};
/** Flex members who come 3 days a week and use up their 10 visits early in the month (Lina is the first). */
const HEAVY_FLEX = new Set(['m1', 'm61', 'm73', 'm75']);
/** Flex members who come rarely (about 3 visits a month), so some of the 10 go unused. */
const VERY_LIGHT_FLEX = new Set(['m62', 'm69']);
/** A month where this member used one visit more than the quota (the extra day is on the next month's invoice): months before the latest, so those invoices are in the history. */
const OVER_QUOTA: Record<string, number> = { m61: -4, m73: -4, m75: -4 };
/** Absences that are part of the story: [days before the 4-week window, length in days]. Everyone else gets random ones. */
const FIXED_ABSENCE: Record<string, [number, number][]> = {
  m1: [[-62, 14]], // the Wijayas: two weeks away with the family
  m2: [[-80, 5]], // Opa Hendra: a week with the flu
  m20: [[-45, 4]], // Opa Tjahjadi: a hospital check-up
  m10: [],
};
/** A month of leave (cuti) in the past: no visits, and the leave fee on that month's invoice instead of the plan. [member, months before this one] */
const LEAVES: [string, number, string][] = [['m56', -3, 'Visiting family abroad'], ['m65', -5, 'Staying with a daughter in Bandung']];
/** Tuesday and Thursday are the busy days. */
const DOW_FACTOR: Record<number, number> = { 1: 0.97, 2: 1.03, 3: 1, 4: 1.03, 5: 0.94 };

// ---------- notes ----------
const NOTE_ACT: Record<string, string[]> = {
  'act-angklung': ['Played the angklung with the group and kept the rhythm all the way through.', 'Led the do-re-mi round on the angklung.', 'Stayed after the angklung session to practise one more song.', 'Learned a new angklung piece today and was proud of it.', 'Counted the beats out loud for the whole angklung group.'],
  'act-keroncong': ['Sang along to every keroncong song.', 'Asked for Bengawan Solo and the whole room joined in.', 'Tapped along to the keroncong and hummed on the way to lunch.', 'Sang a solo verse of Rayuan Pulau Kelapa for the group.', 'Knew every word of the old keroncong favourites.'],
  'act-batik': ['Helped {friend} with {his} batik.', 'Finished a small batik piece to take home.', 'Chose bright blue and gold for {his} batik today.', 'Concentrated on the batik for the whole session.', 'Painted a flower pattern and showed it to everyone at tea.'],
  'act-yoga': ['Did all the chair yoga stretches and felt good afterwards.', 'Said the breathing exercises helped {him} relax.', 'Reached higher in the chair yoga than last week.'],
  'act-garden': ['Watered the herbs and picked a few chillies for the kitchen.', 'Planted two new pots of basil.', 'Spent the gardening hour in the sun, happy and busy.', 'Pointed out which seedlings needed more water.'],
  'act-memory': ['Won a round of the memory game.', 'Remembered every picture card in the second round.', 'Enjoyed the memory games and cheered the others on.'],
  'act-mahjong': ['Won two hands of mahjong after lunch.', 'Taught {friend} a new mahjong trick.', 'Enjoyed cards with {friend} and the volunteers.', 'Kept the score at the mahjong table all afternoon.'],
  'act-line': ['Danced every song of the line dance, with a big smile.', 'Kept up with the steps and clapped for the others.', 'Sat out the fast songs but clapped along to the rhythm.', 'Taught {friend} the new line dance step.'],
  'act-cooking': ['Helped Chef Agus stir the sambal during the cooking demo.', 'Tasted everything at the cooking demo and gave Chef Agus a thumbs up.', 'Shared a family recipe for sayur lodeh with the group.', 'Peeled the shallots for the cooking demo.'],
};
const NOTE_ANY = [
  'Chatted happily with the volunteers before lunch.', 'Enjoyed the garden after lunch and watched the koi.', 'Had a second helping of fruit at tea.', 'Made a new member feel at home at lunch.',
  'Asked for a cup of ginger tea in the afternoon and shared a joke with the team.', 'Read the newspaper aloud to the table after lunch.', 'Took a short rest in the lounge and woke up refreshed for the afternoon.',
  'Walked a full lap of the garden today.', 'Laughed a lot at lunch with {friend}.', 'Showed everyone photos of the grandchildren.', 'Wore a lovely batik outfit today and got many compliments.',
  'Sat by the window and watched the rain with a warm cup of tea.', 'Helped set the tables before lunch.', 'In good spirits all day.', 'Asked after {friend} and was glad to see them today.',
  'Had a long chat with Ns. Dewi about the garden at home.', 'Enjoyed the soup at lunch and asked for the recipe.', 'Hummed a favourite song while waiting for the car.',
  'Shared the story of how {his} family first came to Jakarta.', 'Helped fold the napkins and chatted with Bu Siti.',
];
const NOTE_QUIET = [
  'Quieter than usual today; sat out of the afternoon session.', 'Quieter than usual today; stayed close to the team and rested after lunch.', 'Felt a little tired after lunch and had a rest in the lounge.',
  'A quiet day; happy to watch the others and sip tea by the window.', 'Not very talkative today, but smiled when the team stopped to chat.', 'Rested in the lounge for most of the afternoon; the team checked in often.',
];
const NOTE_AGITATED = [
  'A little unsettled before lunch; calmer after a walk in the garden.', 'Was a bit unsettled in the morning; calmer after tea and a quiet chat.', 'Restless in the morning; settled once the music started.',
  'Looked for home a few times today; reassured by the team and happier after lunch.',
];
const NOTE_HALF = [
  'Ate about half of lunch; had extra fruit at tea.', 'Ate about half of lunch; enjoyed a warm tea at 3 pm.', 'Only half of the rice today; the soup was finished.', 'Ate about half of lunch and asked for a banana at tea.',
  'Ate about half of lunch; we will offer smaller portions next time.',
];
const NOTE_NONE = ['Skipped lunch today but enjoyed a banana and a warm tea at 3 pm.', 'Did not feel like lunch; the team kept a plate aside and {he} had some at tea.'];
const NOTE_LITTLE = [
  'Ate only a little at lunch; a lighter portion and a warm tea helped.', 'Not very hungry today; had a little soup and some fruit at tea.', 'Ate very little at lunch; the team offered a snack at tea and {he} took it.',
  'Small appetite today; enjoyed the pudding and a cup of tea.',
];
const STAFF_NOTES = [
  'Walker brakes felt loose; checked with Pak Joko.', 'Family brought the monthly medicine box; stored with the nurse.', 'Asked for an extra cushion on the chair; added to the care plan.',
  'Needed an arm on the stairs after lunch.', 'The car was late at pick-up; front desk told the family.', 'Hearing aid battery ran out at 2 pm; the spare was used.',
  'Declined the afternoon walk; nurse knows.', 'Likes the tea warm, not hot.', 'Changed into a spare shirt after lunch; the family has been told.',
];

// ---------- the history ----------
export function addHistory(s: ClubState, T: ISODate, opts: { patterns?: Record<string, number[]> } = {}): void {
  const C = s.clubId;
  const H0 = addDays(T, -HIST_DAYS);
  const WIN = addDays(T, -WINDOW_DAYS); // the first day the main seed covers
  const base = (id: string, createdAt: DT, createdBy: Actor = 'staff:s1'): Row => ({ id, clubId: C, createdAt, createdBy });
  const put = <K extends CollectionName>(k: K, row: ClubState[K][string]) => { ((s[k] as unknown) as Record<string, unknown>)[(row as { id: string }).id] = row; };
  const members = Object.values(s.members).filter((m) => !m.deletedAt && !isPendingRow(m));
  const lastMem = (m: Member) => m.memberships[m.memberships.length - 1];
  const histDays: ISODate[] = [];
  for (let d = H0; d < WIN; d = addDays(d, 1)) if (isOpen(s, d)) histDays.push(d);
  const famOf = (m: Member) => primaryContact(s, m.id)?.id;

  // ----- leave months (a few members were away for a month) -----
  for (const [id, off, note] of LEAVES) {
    const m = s.members[id];
    if (!m) continue;
    const month = addMonths(ym(T), off);
    const cur = lastMem(m);
    if (cur.start > `${month}-01`) continue;
    const by: Actor = famOf(m) ? `family:${famOf(m)}` : 'staff:s1';
    cur.leaves = [...(cur.leaves ?? []), { month, at: `${addDays(leaveDeadline(month), -3)}T10:00`, by, note }];
  }

  // ----- profiles -----
  const num = (id: string) => +id.replace(/\D/g, '');
  const leadKey = (m: Member) => (m.spouseId && s.members[m.spouseId] && num(m.spouseId) < num(m.id) ? s.members[m.spouseId].id : m.id);
  const profs = new Map<string, Prof>();
  for (const m of members) {
    const key = leadKey(m);
    const sigma = 17 + 10 * unit(key + ':s');
    const a = ANCHORS[m.id];
    if (a) { profs.set(m.id, { key, order: a.order, nGold: a.nGold, nFlex: a.nFlex, regGold: a.reg, regFlex: a.reg, sigma }); continue; }
    const pat = opts.patterns?.[m.id] ?? [];
    const rr = rng(hash32(key + ':o'));
    const rest = [1, 2, 3, 4, 5].filter((w) => !pat.includes(w));
    for (let k = rest.length - 1; k > 0; k--) { const j = Math.floor(rr() * (k + 1)); [rest[k], rest[j]] = [rest[j], rest[k]]; }
    const k = pat.length || 2;
    const nowGold = planOn(m, T).plan === 'gold';
    const h = unit(key + ':p');
    const light = !nowGold && hash32(key + ':l') % 5 === 0;
    profs.set(m.id, {
      key, order: [...pat, ...rest], nGold: nowGold ? k : Math.min(5, k + 2), nFlex: nowGold ? Math.min(2, k) : k, sigma,
      regGold: 0.9 + 0.09 * h, regFlex: HEAVY_FLEX.has(m.id) ? 0.96 : VERY_LIGHT_FLEX.has(m.id) ? 0.36 + 0.1 * h : light ? 0.6 + 0.12 * h : 0.88 + 0.1 * h,
    });
  }
  /** Absence spells: one story absence each for the hand-made members, else a holiday (30%) and a sick spell (40%) at random. Couples share them. */
  const absCache = new Map<string, [ISODate, ISODate][]>();
  const absences = (key: string): [ISODate, ISODate][] => {
    const hit = absCache.get(key);
    if (hit) return hit;
    const out: [ISODate, ISODate][] = [];
    const fixed = FIXED_ABSENCE[key];
    if (fixed) {
      for (const [off, len] of fixed) { let from = addDays(WIN, off); while (dow(from) !== 1) from = addDays(from, 1); out.push([from, addDays(from, len - 1)]); }
    } else if (histDays.length > 40) {
      const r = rng(hash32(key + ':a'));
      const span = histDays.length - 30;
      const a1 = 8 + Math.floor(r() * span), l1 = 7 + Math.floor(r() * 8), a2 = 8 + Math.floor(r() * span), l2 = 2 + Math.floor(r() * 4);
      if (r() < 0.3) out.push([histDays[a1], addDays(histDays[a1], l1)]);
      if (r() < 0.4) out.push([histDays[a2], addDays(histDays[a2], l2)]);
    }
    absCache.set(key, out);
    return out;
  };

  // ----- visits -----
  const flexCount = new Map<string, Record<string, number>>(); // visits on Flex days a member already has, by month
  for (const a of Object.values(s.attendance)) {
    const m = s.members[a.memberId];
    if (!a.checkIn || !m || planOn(m, a.date).plan !== 'flex') continue;
    const c = flexCount.get(m.id) ?? {};
    c[ym(a.date)] = (c[ym(a.date)] ?? 0) + 1;
    flexCount.set(m.id, c);
  }
  const quotaOf = new Map<string, number>();
  const quota = (m: Member, month: string) => { const k = `${m.id}:${month}`; let q = quotaOf.get(k); if (q === undefined) { q = flexQuota(s, m, month); quotaOf.set(k, q); } return q; };
  for (const m of members) {
    const pr = profs.get(m.id)!;
    const rv = rng(hash32(pr.key + ':v'));
    const abs = absences(pr.key);
    const over = OVER_QUOTA[m.id] !== undefined ? addMonths(ym(T), OVER_QUOTA[m.id]) : null;
    const cnt = flexCount.get(m.id) ?? {};
    const usualMin = toMin(m.usualArrival || '09:30');
    for (const d of histDays) {
      const w = dow(d);
      const u = rv(), a1 = rv(), a2 = rv(), d1 = rv(), d2 = rv(), uf = rv(); // the same draws every open day, so a couple stays in step
      if (!activeOn(m, d) || onLeaveOn(m, d)) continue;
      const month = ym(d);
      const inOver = over === month;
      if (!inOver && abs.some(([f, t]) => d >= f && d <= t)) continue;
      const plan = planOn(m, d).plan;
      const usual = (plan === 'gold' ? pr.order.slice(0, pr.nGold) : pr.order.slice(0, pr.nFlex)).includes(w);
      const p = usual ? Math.min(0.99, (inOver ? 0.99 : plan === 'gold' ? pr.regGold : pr.regFlex) * DOW_FACTOR[w]) : (plan === 'gold' ? 0.05 : 0.06) * (w === 2 || w === 4 ? 1.5 : 1);
      if (u >= p) continue;
      if (s.attendance[attId(d, m.id)]) continue; // already there (counted above)
      if (plan === 'flex') {
        if ((cnt[month] ?? 0) >= quota(m, month) + (inOver ? 1 : 0)) continue;
        cnt[month] = (cnt[month] ?? 0) + 1;
      }
      // morning peak 09:00 to 10:00: usual arrival give or take 17 to 27 minutes; leaving 14:45 to 16:15, mostly around 15:35
      let inRaw = usualMin + Math.round((a1 + a2 - 1) * pr.sigma) + (hash32(m.id + d) % 5) - 2;
      if (inRaw < 8 * 60 + 30) inRaw = 8 * 60 + 30 + Math.round((8 * 60 + 30 - inRaw) * 0.6); // the club opens at 08:30: early birds are reflected, not piled up on the minute
      const inMin = clamp(inRaw, 8 * 60 + 30, 11 * 60 + 15);
      const outMin = Math.max(inMin + 240, clamp(Math.round(15 * 60 + 35 + (d1 + d2 - 1) * 50), 14 * 60 + 45, 16 * 60 + 15) + (hash32(d + m.id + 'o') % 3) - 1);
      const inAt = toHM(inMin), outAt = toHM(outMin);
      put('attendance', {
        ...base(attId(d, m.id), `${d}T${inAt}`), memberId: m.id, date: d, checkIn: { at: inAt, by: 'staff:s1', method: uf < 0.07 ? 'manual' : 'face' }, checkOut: { at: outAt, by: 'staff:s1', method: 'manual' },
        queueAdds: [], dismissed: [], edits: [],
      });
    }
    flexCount.set(m.id, cnt);
  }

  // ----- who was in on each past day (for the notes that name a friend), and each member's visits -----
  const visitsOf = new Map<string, { date: ISODate; inAt: HM; outAt: HM | undefined }[]>();
  const inOn = new Map<ISODate, string[]>();
  for (const a of Object.values(s.attendance)) {
    if (!a.checkIn || a.date >= T) continue;
    const v = visitsOf.get(a.memberId) ?? [];
    v.push({ date: a.date, inAt: a.checkIn.at, outAt: a.checkOut?.at });
    visitsOf.set(a.memberId, v);
    const day = inOn.get(a.date) ?? [];
    day.push(a.memberId);
    inOn.set(a.date, day);
  }
  for (const v of visitsOf.values()) v.sort((x, y) => (x.date < y.date ? -1 : 1));
  for (const v of inOn.values()) v.sort();

  // ----- readings -----
  const firstArrival = new Map<string, ISODate>(); // the earliest arrival reading each member already has (the main seed covers everything from there on)
  const haveMonthly = new Set<string>();
  for (const r of Object.values(s.readings)) {
    if (!r.memberId) continue;
    if (r.kind === 'arrival' && (!firstArrival.has(r.memberId) || r.date < firstArrival.get(r.memberId)!)) firstArrival.set(r.memberId, r.date);
    if (r.kind === 'monthly') haveMonthly.add(`${r.memberId}:${ym(r.date)}`);
  }
  let rid = 0;
  const reading = (memberId: string, date: ISODate, time: HM, kind: Reading['kind'], v: Partial<Reading>): Reading => {
    const row: Reading = { ...base(`hh${++rid}`, `${date}T${time}`, 'staff:s8'), memberId, date, time, kind, status: 'normal', takenBy: 's8', source: 'device', noteKeys: [], shared: false, edits: [], ...v };
    row.status = evaluateReading(row, undefined, limitsFor(s, memberId));
    put('readings', row);
    return row;
  };
  const since = (d: ISODate) => daysBetween(H0, d);
  const span = Math.max(1, daysBetween(H0, WIN));
  for (const m of members) {
    const visits = visitsOf.get(m.id);
    if (!visits) continue;
    const before = firstArrival.get(m.id) ?? T;
    const b = m.sim;
    const free = m.id === 'm2'; // Hendra and Tjahjadi may be flagged (the story); the others of the 5 never are
    const anchor = !!ANCHORS[m.id];
    const rr = rng(hash32(m.id + ':r'));
    const per = 70 + (hash32(m.id + ':w') % 60), ph = (hash32(m.id + ':f') % 628) / 100;
    const fam = famOf(m);
    const monthlyDone = new Set<string>();
    for (const v of visits) {
      if (v.date >= before) continue;
      const t = clamp(since(v.date) / span, 0, 1);
      const wave = Math.sin((2 * Math.PI * since(v.date)) / per + ph);
      const creep = free ? (1 - t) ** 2 : 0; // Opa Hendra's pressure creeps up over the months, to where the story picks it up
      let sysM = b.sys + 3 * wave - 14 * creep, diaM = b.dia + 1.8 * wave - 7 * creep;
      if (!free) { sysM = Math.min(sysM, 131); diaM = Math.min(diaM, 79); }
      const noise = (n: number) => (rr() - 0.5) * n;
      const bp = (down: number) => ({
        sys: clamp(Math.round(sysM - down + noise(10)), 104, free ? 154 : 136), dia: clamp(Math.round(diaM - down / 2 + noise(7)), 64, free ? 98 : 86),
        pulse: clamp(Math.round(b.pulse + noise(10)), 62, free ? 98 : 96),
      });
      const at = toMin(v.inAt) + 6 + Math.floor(rr() * 9);
      let vals: Partial<Reading> = { ...bp(0), spo2: clamp(Math.round(b.spo2 + noise(2)), free ? 94 : 95, 99), temp: Math.min(37.2, Math.round((b.temp + noise(0.4)) * 10) / 10) };
      // now and then a background member has a Watch value (never in the last 3 weeks: the nurse's re-check list looks 2 weeks back)
      const flag = !anchor && v.date <= addDays(T, -21) && rr() < 0.011;
      const kind = flag ? rr() : 0;
      if (flag) {
        if (kind < 0.55) vals = { ...vals, sys: 141 + Math.floor(rr() * 7), dia: 82 + Math.floor(rr() * 9) };
        else if (kind < 0.7) vals = { ...vals, pulse: 101 + Math.floor(rr() * 6) };
        else if (kind < 0.85) vals = { ...vals, spo2: 94 };
        else vals = { ...vals, temp: 37.5 + Math.floor(rr() * 4) / 10 };
      }
      const arr = reading(m.id, v.date, toHM(at), 'arrival', vals);
      if (flag && arr.status !== 'normal') {
        arr.shared = true;
        if (fam) arr.familyTold = { at: `${v.date}T${toHM(at + 8)}`, by: 's8', familyIds: [fam] };
        reading(m.id, v.date, toHM(at + 25 + Math.floor(rr() * 10)), 'recheck', { sys: 130 + Math.floor(rr() * 6), dia: 78 + Math.floor(rr() * 6), pulse: clamp(Math.round(b.pulse + noise(6)), 62, 90), spo2: 96, temp: Math.min(37.2, b.temp) });
      }
      if (v.outAt && rr() < (anchor ? 0.65 : 0.35)) reading(m.id, v.date, toHM(toMin(v.outAt) - 10 - Math.floor(rr() * 13)), 'departure', bp(2));
      // the monthly check on the first visit of each month (weight, glucose, grip)
      const mo = ym(v.date);
      if (!monthlyDone.has(mo) && !haveMonthly.has(`${m.id}:${mo}`)) {
        monthlyDone.add(mo);
        const glucose = m.id === 'm20' ? Math.min(179, Math.round(150 + 26 * t ** 1.6 + noise(8))) : b.glucose > 130 ? clamp(Math.round(b.glucose + noise(20)), 120, 175) : clamp(Math.round(b.glucose + noise(16)), 85, 125);
        const wTrend = m.id === 'm20' ? 1.6 : (hash32(m.id + ':wt') % 7 - 3) * 0.3; // Opa Tjahjadi has been losing weight
        const gTrend = m.id === 'm20' ? 2 : 1 + (hash32(m.id + ':gt') % 3) * 0.5;
        reading(m.id, v.date, toHM(toMin(v.inAt) + 16), 'monthly', { glucose, weight: Math.round((b.weight + wTrend * (1 - t) + noise(1)) * 10) / 10, grip: Math.round(b.grip + gTrend * (1 - t) + noise(2)) });
      }
    }
  }

  // ----- daily logs: one per visit, saved and approved (no mark); the background members' day before yesterday stays open for the teachers -----
  const recent: ISODate[] = [];
  for (let d = addDays(T, -1); recent.length < 2 && d > addDays(T, -14); d = addDays(d, -1)) if (isOpen(s, d)) recent.push(d);
  const planCache = new Map<ISODate, { slot: Slot; act: string; by: string }[]>();
  const planOf = (d: ISODate) => {
    let p = planCache.get(d);
    if (!p) {
      p = sessionsOn(s, d).flatMap((x) => (x.cell ? [{ slot: x.slot, act: x.cell.activityId, by: x.cell.staffId }] : []));
      planCache.set(d, p);
    }
    return p;
  };
  const nameOf = (id: string) => { const f = s.members[id]; return f ? `${f.title} ${f.firstName}` : ''; };
  for (const m of members) {
    const visits = visitsOf.get(m.id);
    if (!visits) continue;
    const memory = /memory/i.test(m.health.cognitive.summary);
    const pn = pron(m);
    const recentNotes: string[] = [];
    for (const v of visits) {
      if (s.dailyLogs[`log-${m.id}-${v.date}`]) continue; // already written by the main seed (its session marks are added below)
      if (!ANCHORS[m.id] && v.date === recent[1]) continue; // only the day before yesterday stays open for the teachers; yesterday is complete, so the daily report reads well
      const rl = rng(hash32(`${m.id}:${v.date}:L`));
      const x = rl(), y = rl(), z = rl(), pickA = rl(), pickN = rl(), sa = rl(), sb = rl(), cm = rl(), ct = rl(), sn = rl(), fr = rl(), tm = rl(), by = rl();
      const pq = memory ? 0.12 : 0.09, pa = memory ? 0.08 : 0.03, pc = memory ? 0.32 : 0.4;
      const mood: DailyLog['mood'] = x < pc ? 'cheerful' : x < 1 - pq - pa ? 'calm' : x < 1 - pa ? 'quiet' : 'agitated';
      const lunch: DailyLog['lunch'] = y < 0.7 ? 'all' : y < 0.9 ? 'most' : y < 0.965 ? 'half' : y < 0.995 ? 'little' : 'none';
      const plan = planOf(v.date);
      const sessions: NonNullable<DailyLog['sessions']> = {};
      plan.forEach((p, i) => {
        const last = i === plan.length - 1;
        const out = mood === 'quiet' ? (last ? 0.7 : 0.15) : mood === 'agitated' ? 0.35 : 0.03;
        sessions[p.slot] = (last ? sb : sa) < out ? 'satOut' : 'joined';
      });
      const allOut = plan.length > 0 && Object.values(sessions).every((x) => x === 'satOut'); // the log's `joined`: 'satOut' only when every session was sat out
      // a note on about one visit in three: the odd days always have one, the rest are warm and specific
      const friends = (inOn.get(v.date) ?? []).filter((id) => id !== m.id);
      const friend = friends.length ? nameOf(friends[Math.floor(fr * friends.length)]) : '';
      const fill = (t: string) => t.replace('{friend}', friend).replace('{his}', pn.p).replace('{him}', pn.o).replace('{he}', pn.s);
      const fresh = (list: string[]) => { const ok = list.filter((t) => !recentNotes.includes(t) && (friend || !t.includes('{friend}'))); return pick(ok.length ? ok : list, pickN); };
      let note = '';
      const noteIt = mood === 'quiet' || mood === 'agitated' || lunch === 'half' || lunch === 'little' || lunch === 'none' ? z < 0.85 : z < 0.17;
      if (noteIt) {
        const acts = plan.map((p) => NOTE_ACT[p.act]).filter((l): l is string[] => !!l);
        const tpl = mood === 'quiet' ? fresh(NOTE_QUIET) : mood === 'agitated' ? fresh(NOTE_AGITATED) : lunch === 'none' ? fresh(NOTE_NONE) : lunch === 'little' ? fresh(NOTE_LITTLE) : lunch === 'half' ? fresh(NOTE_HALF)
          : acts.length && pickA < 0.65 ? fresh(acts[Math.floor(pickA * 100) % acts.length]) : fresh(NOTE_ANY);
        recentNotes.push(tpl);
        if (recentNotes.length > 12) recentNotes.shift();
        note = fill(tpl);
      }
      const teacher = plan.length ? plan[by < 0.7 ? plan.length - 1 : 0].by : 's5';
      const at = toHM(clamp(toMin(`15:00`) + Math.floor(tm * 70), toMin('14:40'), toMin(v.outAt ?? '16:10') - 5));
      const log: DailyLog = {
        ...base(`log-${m.id}-${v.date}`, `${v.date}T${at}`, `staff:${teacher}`), memberId: m.id, date: v.date, mood, lunch, joined: allOut ? 'satOut' : 'yes',
        communicative: mood === 'quiet' || cm < 0.03 ? 'withdrawn' : 'normal', content: mood === 'quiet' ? (ct < 0.55 ? 'low' : 'normal') : ct < 0.015 ? 'low' : 'normal', note,
        ...(sn < 0.025 ? { staffNote: pick(STAFF_NOTES, sn * 40) } : {}), status: 'saved', by: teacher, edits: [], ...(plan.length ? { sessions } : {}),
      };
      put('dailyLogs', log);
    }
  }
  // the logs from before this file get their session marks too: a quiet day's note says the afternoon session was sat out, so the last session is, and
  // `joined` follows the marks ('yes' when any session was joined)
  for (const l of Object.values(s.dailyLogs)) {
    if (l.sessions || l.approval || l.status !== 'saved' || l.date >= T) continue;
    const plan = planOf(l.date);
    if (!plan.length) continue;
    l.sessions = Object.fromEntries(plan.map((p, i) => [p.slot, l.joined === 'satOut' && i === plan.length - 1 ? 'satOut' : 'joined'])) as NonNullable<DailyLog['sessions']>;
    if (plan.length > 1) l.joined = 'yes';
  }

  // ----- session pictures for every club day of the history (the families' day story, day strip and monthly memories show them for the days their member came) -----
  // KC round 7: each is a real picture of its activity (a free Unsplash scene from seed/demoMedia.ts, rotating so the same session on other days looks different).
  // Solo and group photos are tagged to made-up members, so they keep the tone placeholders.
  const haveSession = new Set(Object.values(s.photos).filter((p) => p.kind === 'activity').map((p) => `${p.date}:${p.activity}`));
  for (let d = H0; d < T; d = addDays(d, 1)) {
    if (!isOpen(s, d)) continue;
    for (const x of pictureSessions(s, d)) {
      const name = x.activity!.name;
      const h = hash32(`${d}:${name}:pic`);
      if (haveSession.has(`${d}:${name}`) || h % 100 >= 88) continue; // most sessions have a picture
      const n = 1 + (h % 7 === 0 ? 2 : h % 3 === 0 ? 1 : 0);
      for (let k = 0; k < n; k++) {
        const time = toHM(toMin(x.slot) + 8 + ((h >>> (k * 3)) % 40) + k * 6);
        const by = x.cell.staffId;
        const mediaId = sessionPicId(x.activity!.id, (h >>> 5) + k);
        put('photos', {
          ...base(`pa${d.slice(2).replace(/-/g, '')}${x.slot === '10:30' ? 'a' : 'b'}${k + 1}`, `${d}T${time}`, `staff:${by}`), date: d, time, kind: 'activity', media: 'photo', activity: name, memberIds: [],
          tone: (h >>> (k + 2)) % 5, takenBy: by, visibility: 'visible', ...(d >= addDays(T, -7) ? { approved: { at: `${d}T16:10`, by: 's9' } } : {}), ...(mediaId ? { mediaId } : {}), // only the last week's approvals show in Approvals → History
        } satisfies Photo);
      }
    }
  }

  // ----- the kitchen's lunch photo of each past club day (a free Unsplash picture of the day's main dish; today's is still to be taken at 12:00) -----
  for (let d = H0; d < T; d = addDays(d, 1)) {
    if (!isOpen(s, d) || s.dayMenus[d]?.photoIds?.length) continue;
    const h = hash32(`${d}:lunch:pic`);
    if (h % 100 >= 90) continue; // the odd day nobody took one
    const dishes = menuOn(s, d)?.lunch ?? [];
    const pics = lunchPicIds(dishes, h >>> 4).slice(0, h % 3 === 0 ? 2 : 1);
    if (!pics.length) continue;
    const by = h % 2 ? 's3' : 's2';
    const ids = pics.map((mediaId, k) => {
      const id = `pl${d.slice(2).replace(/-/g, '')}${k + 1}`;
      const time = toHM(12 * 60 + 4 + (h >>> 8) % 26 + k * 7);
      put('photos', {
        ...base(id, `${d}T${time}`, `staff:${by}`), date: d, time, kind: 'lunch', media: 'photo', activity: 'lunch', memberIds: [],
        tone: (3 + k) % 5, takenBy: by, visibility: 'visible', ...(d >= addDays(T, -7) ? { approved: { at: `${d}T${time}`, by: 's9' } } : {}), mediaId,
      } satisfies Photo);
      return id;
    });
    const row = s.dayMenus[d] ?? { ...base(d, `${d}T07:00`, 'staff:s3'), date: d, allergyPlans: [] };
    row.photoIds = ids;
    s.dayMenus[d] = row;
  }

  // ----- paid monthly invoices for every month before the two latest runs (issued on the 21st, due on the 28th), with their DOKU payments -----
  const issueDay = s.club.settings.issueDay;
  const latest = +T.slice(8) >= issueDay ? ym(T) : addMonths(ym(T), -1);
  const prevRun = addMonths(latest, -1);
  const bank: Bank[] = ['BCA', 'Mandiri', 'BNI', 'BRI'];
  for (let p = issueDateOf(s, ym(H0)) >= H0 ? ym(H0) : addMonths(ym(H0), 1); p < prevRun; p = addMonths(p, 1)) {
    if (Object.values(s.invoiceRuns).some((r) => r.period === p)) continue;
    const issue = issueDateOf(s, p);
    const due = dueDateFor(s, p);
    const price = priceOn(s, issue);
    const ids: string[] = [];
    for (const m of members) {
      const lines: InvoiceLine[] = runLinesFor(s, m, p, T).filter((l) => !l.id.startsWith('reg-'));
      if (!lines.some((l) => l.kind === 'plan')) continue;
      const cur = currentMembership(m);
      if (cur.start > issueDateOf(s, addMonths(p, -1))) { // the one-time registration fee is on a member's first invoice
        const fee = feeOf(price, 'registration');
        lines.splice(1, 0, { id: `reg-${cur.start}`, kind: 'adjustment', label: 'inv.line.registration', qty: 1, unit: fee, amount: fee });
      }
      const payer = famOf(m) ?? '';
      const number = nextInvoiceNumber(s, p, m.id);
      const inv: Invoice = { ...base(number, `${issue}T08:00`, 'system'), number, memberId: m.id, payerFamilyId: payer, kind: 'monthly', period: p, issueDate: issue, dueDate: due, lines, va: m.billing.va, xero: 'synced', reminders: [], callNotes: [] };
      put('invoices', inv);
      ids.push(number);
      // the family pays within a week of the issue day; about 1 in 13 pays a few days after the due date
      const h = hash32(`${m.id}:${p}:pay`);
      const cash = h % 53 === 7;
      const day = cash ? +due.slice(8) : h % 13 === 0 ? +due.slice(8) + 1 + ((h >>> 5) % 3) : issueDay + (h % 7);
      const paidOn = `${p}-${String(Math.min(day, daysInMonth(p))).padStart(2, '0')}`;
      const at = toHM(8 * 60 + 5 + ((h >>> 3) % 500));
      const amount = invoiceTotal(inv);
      put('payments', {
        ...base(`pay-${number}`, `${paidOn}T${at}`, cash ? 'staff:s10' : `family:${payer}`), memberId: m.id, method: cash ? 'cash' : 'dokuVa', amount, ...(cash ? {} : { bank: bank[(h >>> 7) % 4] }),
        receivedOn: paidOn, receivedAt: at, allocations: [{ invoiceId: number, amount }], xero: 'synced', by: cash ? 'staff:s10' : `family:${payer}`,
      } satisfies Payment);
    }
    put('invoiceRuns', { ...base(`run-${p}`, `${issue}T08:00`, 'system'), period: p, issueDate: issue, invoiceIds: ids, skipped: [] });
  }
}
