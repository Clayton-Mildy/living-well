(function(){
// CitraPremier ops prototype: shared, deterministic mock dataset.
const rng = seed => { let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
const TODAY = '2026-10-21';
const CLOCK_START = 598; // 09:58
const PRICES = { flex: 5500000, gold: 9500000, extra: 650000 };
const iso = d => d.toISOString().slice(0, 10);
const addDays = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const dow = s => new Date(s + 'T00:00:00Z').getUTCDay();
const toMin = hm => { const [h, m] = hm.split(':').map(Number); return h * 60 + m; };
const toHM = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(Math.round(m % 60)).padStart(2, '0');
const rp = n => 'Rp ' + n.toLocaleString('id-ID');

const bpStatus = (s, d) => (s >= 160 || d >= 100 || s < 90) ? 'alert' : (s >= 140 || d >= 90 || s < 100) ? 'watch' : 'normal';
const spo2Status = v => v < 92 ? 'alert' : v < 95 ? 'watch' : 'normal';
const gluStatus = v => (v < 70 || v > 250) ? 'alert' : v > 180 ? 'watch' : 'normal';
const wtStatus = (w, prev) => prev && Math.abs(w - prev) >= 3 ? 'watch' : 'normal';
const tempStatus = v => (v >= 38 || v < 35.5) ? 'alert' : v >= 37.5 ? 'watch' : 'normal';
const worst = a => a.includes('alert') ? 'alert' : a.includes('watch') ? 'watch' : 'normal';

const ROWS = `Oma|Lina|Wijaya|f|81|flex|135|10:05|Shellfish|Walking stick||f|2025-03
Opa|Hendra|Gunawan|m|84|gold|12345|09:40||Walker|Low salt|d|2024-08
Oma|Susanti|Halim|f|78|gold|1235|09:45||||f|2024-11
Opa|Benny|Tanoto|m|80|flex|135|09:50|Penicillin|||f|2025-06
Ibu|Sri|Rahayu|f|76|gold|1345|09:55||||d|2024-09
Bapak|Sutrisno|Hadi|m|82|flex|13|10:10||Walking stick|Soft food|d|2025-01
Oma|Meilani|Kurniawan|f|85|gold|12345|09:35|Peanuts|Wheelchair|Soft food|d|2024-07
Opa|Robert|Salim|m|79|flex|35|10:00||||f|2025-04
Ibu|Endang|Lestari|f|74|flex|135|09:58||||f|2025-07
Bapak|Bambang|Purnomo|m|77|gold|1235|09:48|Seafood|||f|2024-10
Oma|Grace|Tanuwidjaja|f|83|flex|15|10:15||Walking stick||f|2025-02
Opa|Johan|Setiadi|m|86|gold|1345|09:42||Wheelchair|Soft food|d|2024-07
Ibu|Nur|Aisyah|f|72|flex|24|10:00|Dairy|||f|2025-08
Bapak|Harjono|Wibisono|m|81|flex|135|10:20||Walker||d|2025-05
Oma|Lily|Hartono|f|79|gold|12345|09:52|Eggs|||f|2024-12
Opa|Willy|Sugiarto|m|75|flex|24|10:05||||f|2025-09
Ibu|Kartini|Siregar|f|80|flex|35|09:57||Walking stick||f|2025-03
Bapak|Ahmad|Fauzi|m|78|gold|135|09:46|Sulfa drugs||Low salt|d|2024-09
Oma|Yuliana|Chandra|f|82|flex|13|10:12||||f|2025-06
Opa|Tjahjadi|Lim|m|88|gold|1235|09:38||Walker|Soft food|d|2024-07
Ibu|Wahyuni|Pertiwi|f|73|flex|24|10:00||||f|2025-10
Bapak|Darmawan|Saputra|m|76|flex|14|10:08|Peanuts|||f|2025-04
Oma|Rosa|Effendi|f|84|gold|1345|09:50||Walking stick||d|2024-08
Opa|Fransiskus|Lie|m|80|flex|25|10:02||||f|2025-07
Ibu|Ratna|Sasmita|f|77|flex|135|09:59|Shellfish|||f|2025-02
Bapak|Suryadi|Nasution|m|83|gold|12345|09:44||Walker|Low salt|d|2024-10
Oma|Elisabeth|Gozali|f|79|flex|24|10:10||||f|2025-05
Opa|Kurnia|Hidayat|m|77|flex|35|10:03|Seafood|||f|2025-08
Ibu|Siti|Mariam|f|75|gold|1235|09:53||||d|2024-11
Bapak|Wiryono|Atmaja|m|85|flex|13|10:18||Wheelchair|Soft food|d|2025-01
Oma|Herlina|Santoso|f|81|gold|1345|09:47|Dairy|||f|2024-12
Opa|Agustinus|Wenas|m|79|flex|24|10:06||||f|2025-06
Ibu|Dyah|Puspitasari|f|71|flex|15|10:00||||f|2025-09
Bapak|Teguh|Prasetyo|m|74|flex|24|10:09||||f|2025-03
Oma|Juliana|Tirtawinata|f|86|gold|1235|09:41|Penicillin|Walker|Soft food|d|2024-07
Opa|Stefanus|Hartanto|m|82|flex|13|10:14||Walking stick||f|2025-04
Ibu|Rukmini|Sudarsono|f|80|flex|24|10:04||||f|2025-07
Bapak|Made|Wirawan|m|76|gold|1345|09:51||||f|2024-09
Oma|Veronika|Sinaga|f|78|flex|25|10:07|Eggs|||f|2025-05
Opa|Antonius|Liem|m|87|gold|12345|09:39||Wheelchair|Soft food|d|2024-08
Ibu|Tuti|Handayani|f|73|flex|14|10:11||||f|2025-10
Bapak|Hasan|Basri|m|79|flex|35|09:56||||f|2025-02
Oma|Margaretha|Pangestu|f|83|gold|1235|09:49|Shellfish|Walking stick||f|2024-10
Opa|Rudy|Kosasih|m|81|flex|24|10:16||||f|2025-08
Ibu|Lestari|Wulandari|f|75|flex|13|10:01||||f|2025-09
Opa|Budi|Wijaya|m|84|gold|12345|10:05||Walking stick|Low salt|f|2025-03`;

const MEDS = [['Amlodipine', '5 mg', 'Morning, at home'], ['Metformin', '500 mg', 'With lunch'], ['Simvastatin', '20 mg', 'Evening, at home'], ['Aspirin', '80 mg', 'Morning, at home'], ['Calcium + Vitamin D', '1 tablet', 'With lunch'], ['Donepezil', '5 mg', 'Evening, at home'], ['Bisoprolol', '2.5 mg', 'Morning, at home']];
const INTERNAL = ['Gets tired after lunch; offer the recliner by the garden door.', 'Needs a reminder to drink water every hour.', 'Can be anxious on arrival; give a few minutes with tea before the health check.', 'Wears hearing aids; check batteries on arrival.', 'Prefers the same seat near the piano.', 'Ask before helping with the walker; likes to manage alone.', 'Speak slowly and face them; reads lips.', 'Diabetic: offer the sugar-free snack at tea.'];
const SHARED = ['Loves keroncong and old Indonesian songs.', 'Enjoys mahjong with friends after lunch.', 'Talks about the orchids at home; happy in gardening club.', 'Former teacher; enjoys reading aloud to the group.', 'Enjoys batik painting and takes pieces home.', 'Former engineer; loves puzzles and card games.', 'Likes to help set the tables before lunch.'];
const KA = ['Stephanie', 'Kevin', 'Jessica', 'Michael', 'Andreas', 'Felicia', 'Yohana', 'Hendrik', 'Vivian', 'Edward', 'Natalia', 'Steven', 'Cynthia', 'Ivan', 'Patricia', 'William'];
const KB = ['Rizky', 'Ayu', 'Dian', 'Fajar', 'Putri', 'Arief', 'Nadia', 'Bayu', 'Sinta', 'Galih', 'Indah', 'Yoga', 'Laras', 'Hadi'];
const LB = ['Pratama', 'Saputra', 'Nugroho', 'Permata', 'Kusumawati', 'Ramadhan', 'Hidayati', 'Wibowo'];
const RELS = ['Daughter', 'Son', 'Daughter-in-law', 'Granddaughter', 'Grandson', 'Son-in-law'];
const DRUGS = ['Penicillin', 'Sulfa drugs'];
const COND = { Amlodipine: 'High blood pressure', Bisoprolol: 'High blood pressure', Metformin: 'Type 2 diabetes', Simvastatin: 'High cholesterol', Aspirin: 'Heart health, on preventive aspirin', 'Calcium + Vitamin D': 'Osteoporosis', Donepezil: 'Early memory loss' };
const NANNIES = ['Mbak Sari', 'Mbak Wati', 'Mbak Yuni', 'Mbak Rini', 'Mbak Tini'];

const SCHEDULE = {
  1: [['10:30', 'Angklung ensemble', 's5', 'Music room'], ['12:00', 'Lunch', null, 'Dining room'], ['13:30', 'Chair yoga', 's6', 'Garden room'], ['15:00', 'Afternoon tea', null, 'Lounge']],
  2: [['10:30', 'Batik painting', 's6', 'Studio'], ['12:00', 'Lunch', null, 'Dining room'], ['13:30', 'Memory games', 's5', 'Lounge'], ['15:00', 'Afternoon tea', null, 'Lounge']],
  3: [['10:30', 'Keroncong sing-along', 's5', 'Music room'], ['12:00', 'Lunch', null, 'Dining room'], ['13:30', 'Batik painting', 's6', 'Studio'], ['15:00', 'Afternoon tea', null, 'Lounge']],
  4: [['10:30', 'Gardening club', 's6', 'Garden'], ['12:00', 'Lunch', null, 'Dining room'], ['13:30', 'Mahjong and cards', 's5', 'Lounge'], ['15:00', 'Afternoon tea', null, 'Lounge']],
  5: [['10:30', 'Line dancing', 's5', 'Music room'], ['12:00', 'Lunch', null, 'Dining room'], ['13:30', 'Cooking demo with Chef Agus', 's6', 'Kitchen'], ['15:00', 'Afternoon tea', null, 'Lounge']],
};
const MENU = {
  1: { lunch: 'Ayam bakar kecap, sayur asem, nasi merah, semangka', soft: 'Bubur ayam', tea: 'Pisang rebus and teh jahe' },
  2: { lunch: 'Rawon daging, telur asin, nasi putih, melon', soft: 'Sup daging cincang', tea: 'Klepon and teh tawar' },
  3: { lunch: 'Sop ikan kakap, nasi merah, tumis buncis wortel, pepaya', soft: 'Bubur ikan', tea: 'Kue lumpur and teh melati' },
  4: { lunch: 'Semur tahu tempe, sayur bayam, nasi merah, jeruk', soft: 'Tim tahu sayur', tea: 'Bubur kacang hijau' },
  5: { lunch: 'Gado-gado (sauce on the side), soto ayam bening, buah naga', soft: 'Soto ayam halus', tea: 'Lapis legit and kopi susu' },
};

function buildData() {
  const r = rng(20261021);
  const pick = a => a[Math.floor(r() * a.length)];
  const between = (a, b) => a + Math.floor(r() * (b - a + 1));
  const staff = [
    ['s1', 'Rina Kusuma', 'lobby', 'Front of house', true, '+62 811-2201-3345'],
    ['s2', 'Yohanes Pratama', 'kitchen', 'F&B supervisor', true, '+62 811-2201-3346'],
    ['s3', 'Agus Santoso', 'kitchen', 'Chef', true, '+62 811-2201-3347'],
    ['s4', 'Siti Aminah', 'cleaner', 'Housekeeping', false, '+62 811-2201-3348'],
    ['s5', 'Ayu Lestari', 'activity', 'Activity teacher', true, '+62 811-2201-3349'],
    ['s6', 'Dimas Wibowo', 'activity', 'Activity teacher', true, '+62 811-2201-3350'],
    ['s7', 'Joko Susilo', 'driver', 'Driver', false, '+62 811-2201-3351'],
    ['s8', 'Dewi Anggraini', 'nurse', 'Nurse', true, '+62 811-2201-3352'],
    ['s9', 'Christine Halim', 'mgmt', 'Club manager', true, '+62 811-2201-3353'],
    ['s10', 'Fransiska Tan', 'finance', 'Finance (AR)', true, '+62 811-2201-3354'],
  ].map(([id, name, role, title, login, phone]) => ({ id, name, role, title, login, phone, clubhouse: 'citra' }));
  staff.find(s => s.id === 's5').call = 'Kak Ayu'; staff.find(s => s.id === 's6').call = 'Kak Dimas'; staff.find(s => s.id === 's8').call = 'Ns. Dewi'; staff.find(s => s.id === 's7').call = 'Pak Joko'; staff.find(s => s.id === 's3').call = 'Chef Agus';

  const members = []; const family = [];
  ROWS.split('\n').forEach((line, i) => {
    const [title, first, last, g, age, plan, days, usual, allergy, mobility, diet, tr, since] = line.split('|');
    const id = 'm' + (i + 1);
    const meds = []; const n = between(0, 2); const pool = MEDS.slice();
    for (let k = 0; k < n; k++) meds.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
    const m = {
      id, clubhouse: 'citra', title, first, last, gender: g, age: +age, plan, days: days.split('').map(Number), usual,
      name: `${title} ${first} ${last}`, short: `${title} ${first}`, allergies: allergy && !DRUGS.includes(allergy) ? [allergy] : [], drugAllergies: allergy && DRUGS.includes(allergy) ? [allergy] : [], mobility: mobility || null, diet: diet || null,
      transport: tr === 'd' ? 'driver' : 'family', since, tone: i % 5,
      meds: meds.map(([name, dose, when]) => ({ name, dose, when })),
      internal: pick(INTERNAL), shared: pick(SHARED), family: [],
      base: { sys: between(118, 136), dia: between(72, 84), pulse: between(66, 82), spo2: between(95, 98), glu: between(96, 150), wt: between(46, 74) + Math.round(r() * 9) / 10 },
    };
    members.push(m);
    const isA = title === 'Oma' || title === 'Opa';
    const k = between(1, 3);
    for (let j = 0; j < k; j++) {
      const fn = isA ? pick(KA) : pick(KB);
      family.push({ id: 'f' + id + '_' + j, memberIds: [id], name: isA ? `${fn} ${last}` : `${fn} ${pick(LB)}`, first: fn, rel: j === 0 ? pick(RELS.slice(0, 2)) : pick(RELS), primary: j === 0, phone: `+62 81${between(1, 9)}-${between(1000, 9999)}-${between(1000, 9999)}`, role: 'family' });
    }
  });
  // Demo anchor: Oma Lina Wijaya
  const lina = members[0];
  Object.assign(lina, { meds: [{ name: 'Amlodipine', dose: '5 mg', when: 'Morning, at home' }, { name: 'Calcium + Vitamin D', dose: '1 tablet', when: 'With lunch' }], internal: 'Use her right arm for blood pressure (old wrist fracture on the left). Hard of hearing on the left side.', shared: 'Loves keroncong, especially Bengawan Solo. Likes the seat by the garden window.', base: { sys: 128, dia: 80, pulse: 74, spo2: 97, glu: 118, wt: 54.0 } });
  for (let i = family.length - 1; i >= 0; i--) if (family[i].memberIds[0] === 'm1' || family[i].memberIds[0] === 'm46') family.splice(i, 1);
  const budi = members[45]; Object.assign(budi, { spouse: 'm1', internal: 'Sits with Oma Lina at lunch. Likes the newspaper first thing; hard of hearing on the right.', shared: 'Retired pharmacist. Enjoys chess and the morning newspaper.', meds: [{ name: 'Amlodipine', dose: '5 mg', when: 'Morning, at home' }, { name: 'Aspirin', dose: '80 mg', when: 'Morning, at home' }], base: { sys: 134, dia: 82, pulse: 70, spo2: 96, glu: 124, wt: 66.5 } }); lina.spouse = 'm46';
  family.unshift({ id: 'f1', memberIds: ['m1', 'm46'], name: 'Maria Wijaya', first: 'Maria', rel: 'Daughter', primary: true, phone: '+62 812-1090-4471', role: 'family' },
    { id: 'f2', memberIds: ['m1', 'm46'], name: 'Daniel Wijaya', first: 'Daniel', rel: 'Son', primary: false, phone: '+62 813-8820-1156', role: 'family' });
  const hendra = members[1]; hendra.base = { sys: 146, dia: 90, pulse: 78, spo2: 96, glu: 132, wt: 68.4 }; hendra.internal = 'On watch for blood pressure since 14 Oct. dr. Andreas asked for a re-check if over 160.';
  members[4].base.spo2 = 94; // Ibu Sri: low-normal SpO2
  members[19].base.glu = 196; // Opa Tjahjadi
  family.forEach(f => f.memberIds.forEach(id => members.find(m => m.id === id).family.push(f.id)));
  const r2 = rng(4242);
  members.forEach((m, i) => {
    m.base.temp = Math.round((36.3 + r2() * 0.6) * 10) / 10; m.base.grip = Math.round(14 + r2() * 10);
    m.conditions = Array.from(new Set(m.meds.map(x => COND[x.name])));
    m.diabetic = m.meds.some(x => x.name === 'Metformin') || m.base.glu > 180;
    if (m.diabetic && !m.conditions.includes('Type 2 diabetes')) m.conditions.push('Type 2 diabetes');
    m.cognitive = m.meds.some(x => x.name === 'Donepezil') ? 'Mild memory loss; needs gentle reminders of the day’s plan' : 'Alert and oriented';
    m.nanny = r2() < 0.3 ? NANNIES[i % NANNIES.length] : null;
    m.docs = { ktp: true, nannyKtp: !!m.nanny && r2() < 0.8, form: true, health: r2() < 0.85, at: m.since + '-0' + (1 + (i % 8)), via: 'membership form' };
    m.notes = [{ kind: 'internal', text: m.internal, by: 's8', date: '2026-10-14' }, { kind: 'shared', text: m.shared, by: 's5', date: '2026-10-07' }];
    m.status = 'active'; m.log = [{ at: m.docs.at, by: 's1', what: 'Member record created from the membership form' }];
  });
  Object.assign(lina, { nanny: 'Mbak Sari', conditions: ['High blood pressure, controlled', 'Osteoporosis', 'Hard of hearing, left ear', 'Old wrist fracture, left'] });
  lina.docs.nannyKtp = true; lina.docs.health = true;
  lina.notes.push({ kind: 'internal', text: 'Mbak Sari waits in the lounge on Mondays; she prefers to sit near Oma Lina at lunch.', by: 's1', date: '2026-10-19' }, { kind: 'shared', text: 'Asked us to play Bengawan Solo again on Wednesday. Kak Ayu has it on the list.', by: 's5', date: '2026-10-19' });

  // Attendance: members choose their own days.
  const past = []; for (let i = 28; i >= 1; i--) { const d = addDays(TODAY, -i); const w = dow(d); if (w >= 1 && w <= 5) past.push(d); }
  const LINA = ['2026-09-23', '2026-09-28', '2026-09-30', '2026-10-02', '2026-10-05', '2026-10-07', '2026-10-12', '2026-10-14', '2026-10-16', '2026-10-19'];
  const att = {}; past.concat([TODAY]).forEach(d => att[d] = {});
  const primaryOf = m => m.family.find(fid => family.find(f => f.id === fid).primary);
  const famOf = m => m.family;
  past.forEach(d => {
    const w = dow(d);
    members.forEach(m => {
      const p = m.plan === 'gold' ? 0.93 : Math.min(1, 2.3 / m.days.length);
      const go = m.id === 'm1' ? LINA.includes(d) : (m.days.includes(w) && r() < p);
      if (!go) return;
      const inT = toMin(m.usual) + between(-7, 7);
      const outT = between(15 * 60 + 40, 16 * 60 + 25);
      const fam = famOf(m);
      att[d][m.id] = { in: toHM(inT), out: toHM(outT), brought: m.transport === 'driver' ? 'driver' : primaryOf(m), picked: m.transport === 'driver' ? 'driver' : (m.id === 'm1' ? 'f2' : pick(fam)), by: 's1' };
    });
  });
  const cutoff = CLOCK_START - 1;
  members.forEach(m => {
    if (!m.days.includes(3)) return;
    if (m.id === 'm23') { att[TODAY][m.id] = { leave: true, reason: 'Family wedding in Medan' }; return; }
    if (m.plan === 'flex' && m.id !== 'm1' && r() > 0.72) return;
    const a = { expected: true, in: null, out: null, brought: null, picked: null };
    if (m.id !== 'm1' && toMin(m.usual) <= cutoff) { a.in = m.usual; a.brought = m.transport === 'driver' ? 'driver' : primaryOf(m); a.by = 's1'; }
    att[TODAY][m.id] = a;
  });

  // Health readings
  const readings = []; const nz = (v, s) => Math.round(v + (r() - 0.5) * 2 * s);
  const mk = (m, d, time, type, extra) => readings.push(Object.assign({ id: 'h' + readings.length, memberId: m.id, date: d, time, type, by: 's8', notes: [], shared: false }, extra));
  past.forEach(d => Object.entries(att[d]).forEach(([id, a]) => {
    const m = members.find(x => x.id === id); const b = m.base;
    let sys = nz(b.sys, 6), dia = nz(b.dia, 4);
    if (id === 'm2' && d === '2026-10-14') { sys = 164; dia = 98; }
    if (r() < 0.02) sys += 22;
    const spo2 = Math.min(99, nz(b.spo2, 1));
    mk(m, d, toHM(toMin(a.in) + between(6, 14)), 'arrival', { sys, dia, pulse: nz(b.pulse, 5), spo2, temp: Math.round((b.temp + (r2() - 0.5) * 0.4) * 10) / 10, status: [bpStatus(sys, dia), spo2Status(spo2)] });
    const s2 = nz(b.sys - 2, 6), d2 = nz(b.dia - 1, 4);
    mk(m, d, toHM(toMin(a.out) - between(10, 22)), 'departure', { sys: s2, dia: d2, pulse: nz(b.pulse, 5), status: [bpStatus(s2, d2)] });
  }));
  readings.forEach(x => x.status = worst(x.status));
  const dueToday = ['m1', 'm20', 'm29'];
  members.forEach(m => {
    ['2026-09', '2026-10'].forEach((mo, k) => {
      if (k === 1 && dueToday.includes(m.id)) return;
      const d = past.find(x => x.startsWith(mo) && att[x][m.id]); if (!d) return;
      const glu = nz(m.base.glu, 12), wt = Math.round((m.base.wt + (r() - 0.5) * (k ? 0.8 : 1.6)) * 10) / 10;
      mk(m, d, toHM(toMin(att[d][m.id].in) + 16), 'monthly', { glucose: glu, weight: wt, grip: Math.round(m.base.grip + (r2() - 0.5) * 2), status: gluStatus(glu) });
    });
  });
  Object.entries(att[TODAY]).forEach(([id, a]) => {
    if (!a.in || id === 'm2' || toMin(a.in) > 9 * 60 + 48) return;
    const m = members.find(x => x.id === id); const b = m.base; const sys = nz(b.sys, 5), dia = nz(b.dia, 3), spo2 = Math.min(99, nz(b.spo2, 1));
    mk(m, TODAY, toHM(toMin(a.in) + 7), 'arrival', { sys, dia, pulse: nz(b.pulse, 4), spo2, temp: Math.round((b.temp + (r2() - 0.5) * 0.4) * 10) / 10, status: worst([bpStatus(sys, dia), spo2Status(spo2)]) });
  });

  // Daily logs & photos
  const logs = []; const photos = [];
  const NOTES = { quiet: ['Quieter than usual today; sat out of the afternoon session.', 'Seemed tired and dozed after lunch.'], agitated: ['A little unsettled before lunch; calmer after a walk in the garden.'], half: ['Ate about half of lunch; had extra fruit at tea.'] };
  past.forEach(d => {
    const w = dow(d); const sch = SCHEDULE[w].filter(s => s[2]);
    const here = Object.keys(att[d]);
    here.forEach(id => {
      const x = r(); const mood = x < 0.42 ? 'cheerful' : x < 0.88 ? 'calm' : x < 0.97 ? 'quiet' : 'agitated';
      const y = r(); const lunch = y < 0.72 ? 'all' : y < 0.92 ? 'most' : 'half';
      let note = mood === 'quiet' || mood === 'agitated' ? pick(NOTES[mood]) : lunch === 'half' ? NOTES.half[0] : '';
      const sAct = pick(sch);
      logs.push({ memberId: id, date: d, mood, lunch, note, by: sAct[2] });
      photos.push({ id: 'p' + photos.length, date: d, time: toHM(toMin(sAct[0]) + between(5, 50)), activity: sAct[1], kind: 'solo', tags: [id], tone: between(0, 4), by: sAct[2] });
    });
    sch.forEach(s => {
      for (let g = 0; g < 2; g++) {
        const tags = here.slice().sort(() => r() - 0.5).slice(0, between(3, 6));
        photos.push({ id: 'p' + photos.length, date: d, time: toHM(toMin(s[0]) + between(5, 50)), activity: s[1], kind: 'group', tags, tone: between(0, 4), by: s[2] });
      }
    });
  });
  const ll = logs.find(l => l.memberId === 'm1' && l.date === '2026-10-19');
  Object.assign(ll, { mood: 'cheerful', lunch: 'all', by: 's5', note: 'Oma Lina sang Bengawan Solo for the group during angklung practice and the whole room joined in. She asked if we can play it again on Wednesday.' });
  photos.forEach(p => { if (p.date === '2026-10-19' && p.kind === 'group' && p.tags.length && !p.tags.includes('m1') && r() < 0.6) p.tags.push('m1'); });

  photos.filter(p => p.date === '2026-10-19' && p.kind === 'group' && p.tags.includes('m1')).slice(0, 1).forEach(p => { p.media = 'video'; p.dur = '0:14'; });
  photos.filter(p => p.kind === 'group' && p.date >= '2026-10-12').forEach((p, i) => { if (i % 6 === 2 && !p.media) { p.media = 'video'; p.dur = '0:' + (10 + i % 9); } });
  // Invoices (issued 15th, due 27th), paid by DOKU virtual account, synced to Xero
  const invoices = []; const overdue = ['m16', 'm22', 'm39'];
  members.forEach((m, i) => {
    const amt = PRICES[m.plan];
    const va = '8808' + String(1203440000 + i * 7919).padStart(12, '0');
    const sepPaid = !overdue.includes(m.id);
    invoices.push({ id: `INV-2609-${String(i + 1).padStart(3, '0')}`, memberId: m.id, period: 'September 2026', issued: '2026-09-15', due: '2026-09-27', amount: amt + (r() < 0.15 ? PRICES.extra : 0), status: sepPaid ? 'paid' : 'overdue', paidAt: sepPaid ? `2026-09-${between(16, 27)}` : null, method: 'DOKU VA', va, xero: 'synced' });
    const octPaid = m.id !== 'm1' && r() < 0.42;
    invoices.push({ id: `INV-2610-${String(i + 1).padStart(3, '0')}`, memberId: m.id, period: 'October 2026', issued: '2026-10-15', due: '2026-10-27', amount: amt, status: octPaid ? 'paid' : 'outstanding', paidAt: octPaid ? `2026-10-${between(15, 20)}` : null, method: 'DOKU VA', va, xero: octPaid ? 'synced' : 'awaiting payment' });
  });

  const bookings = [{ memberId: 'm1', date: '2026-10-26' }, { memberId: 'm1', date: '2026-10-28' }];
  const requests = [
    { id: 'r1', kind: 'extra', memberId: 'm8', date: '2026-10-23', by: null, created: '2026-10-20' },
    { id: 'r2', kind: 'leave', memberId: 'm23', date: '2026-10-21', reason: 'Family wedding in Medan', created: '2026-10-12' },
    { id: 'r3', kind: 'upgrade', memberId: 'm9', from: 'flex', to: 'gold', start: '2026-11-01', created: '2026-10-18' },
    { id: 'r4', kind: 'extra', memberId: 'm19', date: '2026-10-22', created: '2026-10-19' },
    { id: 'r5', kind: 'leave', memberId: 'm11', date: '2026-10-26', reason: "Doctor's appointment", created: '2026-10-17' },
    { id: 'r6', kind: 'leave', memberId: 'm1', date: '2026-06-15', reason: 'Family trip to Bali', created: '2026-06-02' },
  ];
  requests.forEach(q => { const m = members.find(x => x.id === q.memberId); q.by = m.family[0]; });

  const enquiries = [
    { id: 'e1', senior: 'Oma Siu Lan Tjandra', contact: 'Melinda Tjandra', rel: 'Daughter', phone: '+62 812-7781-2290', source: 'Referral', stage: 'trial', next: 'Trial day today, 10:30', today: '10:30', trialDate: TODAY, form: 'ready', formAt: 'Mon 19 Oct, 20:14',
      formData: { title: 'Oma', name: 'Siu Lan Tjandra', dob: '14/02/1944', address: 'Jl. Kemang Selatan VIII no. 21, Jakarta Selatan', contact: 'Melinda Tjandra', rel: 'Daughter', phone: '+62 812-7781-2290', ktp: true, nanny: true, nannyName: 'Mbak Wati', nannyKtp: true, healthPhoto: true, conditions: 'High blood pressure', meds: [{ name: 'Amlodipine', dose: '5 mg', when: 'Morning' }], food: ['Shellfish'], drug: ['Penicillin'], mobility: 'Walking stick', consentData: true, consentFace: true, signed: true } },
    { id: 'e2', senior: 'Bapak Yusuf Hamid', contact: 'Ilham Hamid', rel: 'Son', phone: '+62 813-5520-1874', source: 'Instagram', stage: 'visit', next: 'Visit today, 14:00', today: '14:00' },
    { id: 'e3', senior: 'Oma Ellen Sutanto', contact: 'Kevin Sutanto', rel: 'Grandson', phone: '+62 811-9034-2215', source: 'Website', stage: 'new', next: 'Call back Thu 22 Oct' },
    { id: 'e4', senior: 'Ibu Sumarni', contact: 'Dian Kartika', rel: 'Daughter', phone: '+62 857-1120-6643', source: 'Walk-in', stage: 'new', next: 'Send price list' },
    { id: 'e5', senior: 'Opa Leo Gunadi', contact: 'Felicia Gunadi', rel: 'Daughter', phone: '+62 812-4410-7781', source: 'Referral', stage: 'visit', next: 'Visit Fri 23 Oct, 11:00', form: 'sent' },
    { id: 'e6', senior: 'Oma Anita Wirjono', contact: 'Hendrik Wirjono', rel: 'Son', phone: '+62 813-2290-4418', source: 'Website', stage: 'visit', next: 'Visited 16 Oct · follow up Mon 26 Oct' },
    { id: 'e7', senior: 'Bapak Slamet Riyadi', contact: 'Putri Riyadi', rel: 'Daughter', phone: '+62 815-6678-0912', source: 'Instagram', stage: 'trial', next: 'Trial day Wed 28 Oct, 10:00', trialDate: '2026-10-28' },
    { id: 'e8', senior: 'Oma Hanna Lukito', contact: 'Steven Lukito', rel: 'Son', phone: '+62 811-3345-8890', source: 'Walk-in', stage: 'new', next: 'Call back today' },
    { id: 'e9', senior: 'Ibu Nyoman Sari', contact: 'Made Arya', rel: 'Son', phone: '+62 812-8831-2201', source: 'Referral', stage: 'lost', next: 'Chose a place closer to family in Bali' },
    { id: 'e10', senior: 'Opa Paulus Rahardjo', contact: 'Cynthia Rahardjo', rel: 'Daughter', phone: '+62 813-7712-5530', source: 'Website', stage: 'joined', next: 'Starts Mon 2 Nov' },
    { id: 'e11', senior: 'Oma Lies Kartono', contact: 'Andreas Kartono', rel: 'Son', phone: '+62 812-0098-1123', source: 'Website', stage: 'lost', next: 'Not ready yet · call again in January' },
  ];
  const calendar = [
    { date: '2026-10-24', kind: 'venue', title: 'Venue booking: PT Arunika Farma caregiver seminar', time: '09:00–13:00' },
    { date: '2026-10-29', kind: 'outing', title: 'Outing: Kebun Raya Bogor botanical garden', time: '08:30–15:00' },
    { date: '2026-10-30', kind: 'closed', title: 'Club closed: staff first-aid training' },
    { date: '2026-10-31', kind: 'venue', title: 'Venue booking: Bank Prima Nusantara retirees’ morning', time: '08:00–12:00' },
    { date: '2026-11-14', kind: 'venue', title: 'Venue booking: Yayasan Kasih Bunda choir rehearsal', time: '13:00–17:00' },
    { date: '2026-11-26', kind: 'outing', title: 'Outing: batik museum and lunch', time: '09:00–14:30' },
    { date: '2026-12-25', kind: 'holiday', title: 'Christmas Day (national holiday)' },
    { date: '2027-01-01', kind: 'holiday', title: 'New Year’s Day (national holiday)' },
  ];
  const suppliers = [{ name: 'Sayur Segar Kemang', what: 'Vegetables and fruit' }, { name: 'Ikan Laut Jaya', what: 'Fish' }, { name: 'Toko Kue Ny. Liem', what: 'Kue for afternoon tea' }, { name: 'Apotek Sehat Selalu', what: 'First-aid and test strips' }, { name: 'Bersih Prima', what: 'Cleaning supplies' }];
  const doctors = [{ name: 'dr. Andreas Wirawan, Sp.PD', what: 'Internal medicine, visits Tuesdays' }, { name: 'dr. Melinda Kusumo', what: 'GP on call' }];
  const budgets = [{ section: 'F&B', week: 9500000, spent: 6120000 }, { section: 'Activities', week: 2000000, spent: 840000 }, { section: 'Operations', week: 2700000, spent: 1170000 }];
  const receipts = [{ date: '2026-10-20', supplier: 'Sayur Segar Kemang', amount: 1840000, section: 'F&B', by: 's2', xero: 'synced' }, { date: '2026-10-20', supplier: 'Ikan Laut Jaya', amount: 2260000, section: 'F&B', by: 's3', xero: 'synced' }, { date: '2026-10-19', supplier: 'Apotek Sehat Selalu', amount: 410000, section: 'Operations', by: 's8', xero: 'synced' }];
  const complaints = [{ id: 'c1', date: '2026-10-19', memberId: 'm8', from: 'fm8_0', dish: 'Sayur asem', text: 'Papa said the soup was too salty on Monday.', status: 'open', reply: null }, { id: 'c2', date: '2026-10-16', memberId: 'm15', from: 'fm15_0', dish: 'Gado-gado', text: 'Mama would like a vegetarian option on Fridays.', status: 'answered', reply: { text: 'Thank you. From next Friday there is a tempeh and vegetable option next to the gado-gado.', by: 's3', at: 'Fri 16 Oct, 14:10' } }, { id: 'c3', date: TODAY, memberId: 'm11', from: 'fm11_0', dish: 'Sop ikan kakap', text: 'Last time Mama found a small bone in the fish soup. Please check before serving.', status: 'open', reply: null }];
  const stock = [{ id: 'k1', item: 'Test strips (glucose)', qty: '2 boxes', section: 'Health', by: 's8', status: 'requested', date: '2026-10-20' }, { id: 'k2', item: 'Teh melati', qty: '5 packs', section: 'Kitchen', by: 's2', status: 'requested', date: '2026-10-20' }, { id: 'k3', item: 'Batik wax', qty: '1 kg', section: 'Activities', by: 's6', status: 'approved', date: '2026-10-19', approvedBy: 's9' }, { id: 'k4', item: 'Beras merah', qty: '25 kg', section: 'Kitchen', by: 's3', status: 'received', date: '2026-10-16', approvedBy: 's2' }, { id: 'k5', item: 'Hand soap refills', qty: '6 bottles', section: 'Housekeeping', by: 's4', status: 'requested', date: '2026-10-21' }];
  const menu = JSON.parse(JSON.stringify(MENU)); const menuPhoto = {};
  const threads = [{ id: 't1', fam: 'f1', memberId: 'm1', team: 'Lobby', msgs: [{ from: 'f1', text: 'Is Mama’s blood pressure okay this week?', at: '2026-10-14 18:02' }, { from: 's8', text: 'Yes, all normal this week, 124/78 to 130/82. She is doing well.', at: '2026-10-14 18:30' }, { from: 'f1', text: 'Mama forgot her cardigan on Monday, is it at the lobby?', at: '2026-10-20 19:12' }], unread: true },
    { id: 't2', fam: 'fm12_0', memberId: 'm12', team: 'Lobby', msgs: [{ from: 'fm12_0', text: 'Papa has a dentist appointment Friday, he will leave at 14:00.', at: '2026-10-21 07:40' }], unread: true },
    { id: 't3', fam: 'fm2_0', memberId: 'm2', team: 'Nurse', msgs: [{ from: 's8', text: 'Opa Hendra’s blood pressure was 164/98 on arrival today. After a rest it was 150/92. dr. Andreas will see him on Tuesday.', at: '2026-10-14 10:40' }, { from: 'fm2_0', text: 'Thank you Ns. Dewi. We will bring his medicine list.', at: '2026-10-14 12:02' }], unread: false },
    { id: 't4', fam: 'fm20_0', memberId: 'm20', team: 'Nurse', msgs: [{ from: 's8', text: 'Opa Tjahjadi’s glucose was 196 this month. Could you ask his doctor about the evening dose?', at: '2026-10-07 11:15' }], unread: false }];
  const clubhouses = [{ id: 'citra', name: 'CitraPremier', full: 'CitraPremier | Premium Seniors Club' }, { id: 'adina', name: 'Adina Seniors Clubhouse', full: 'Adina Seniors Clubhouse', note: 'Opening 2027' }];
  const messages = [{ from: 'f1', memberId: 'm1', text: 'Mama forgot her cardigan on Monday, is it at the lobby?', at: '2026-10-20 19:12', unread: true }, { from: 'fm12_0', memberId: 'm12', text: 'Papa has a dentist appointment Friday, he will leave at 14:00.', at: '2026-10-21 07:40', unread: true }];

  const users = staff.filter(s => s.login).concat(family);
  const dlog = {};
  const SVC = ['Mama is happier on club days.', 'Lunch portions could be a little smaller.', 'Please send more photos of the afternoon sessions.', 'The nurse explains everything clearly.', 'Parking at pick-up time is difficult.', ''];
  const OV = [5,5,4,5,4,5,5,3,5,4,5,5,4,5], T1 = [5,5,5,4,5,5,5,4,5,5,5,5,4,5], T5 = [5,5,5,5,4,5,5,5,5,5,4,5,5,5], T6 = [5,4,5,5,5,4,5,5,4,5,5,5,5,4], T3 = [4,5,4,5,4,4,5,3,4,5,4,5,4,4], T7 = [5,4,4,5,5,4,4,5,4,4,5,4,5,5];
  const surveys = [{ id: 'sv0', title: 'September check-in', sent: 'Mon 21 Sep', status: 'closed', qs: ['overall', 'team', 'recommend', 'comment'], responses: family.filter(f => f.primary && f.id !== 'f1').slice(14, 26).map((f, i) => ({ from: f.id, overall: OV[i], team: { s1: T1[i], s8: 5, s5: T5[i], s3: T3[i] }, recommend: true, comment: '', at: '2026-09-22' })) },
    { id: 'sv1', title: 'October check-in', sent: 'Mon 19 Oct', status: 'live', qs: ['overall', 'team', 'recommend', 'comment'], responses: family.filter(f => f.primary && f.id !== 'f1').slice(0, 14).map((f, i) => ({ from: f.id, overall: OV[i], team: { s1: T1[i], s8: 5, s5: T5[i], s6: T6[i], s3: T3[i], s7: T7[i] }, recommend: i !== 7, comment: SVC[i % 6], at: '2026-10-' + (19 + (i % 3)) })) }];
  const breqs = [{ id: 'b1', section: 'Activities', item: 'Angklung tuning', amount: 450000, by: 's5', date: '2026-10-20', status: 'pending' }, { id: 'b2', section: 'F&B', item: 'Extra fruit for Friday', amount: 300000, by: 's2', date: '2026-10-21', status: 'pending' }, { id: 'b3', section: 'Operations', item: 'Wheelchair tyre repair', amount: 250000, by: 's7', date: '2026-10-19', status: 'approved' }];
  const vinv = [{ supplier: 'Sayur Segar Kemang', number: 'INV/SSK/1023', amount: 7400000, due: '2026-10-31', section: 'F&B', status: 'to approve' }, { supplier: 'Bersih Prima', number: 'BP-2610-118', amount: 1350000, due: '2026-10-28', section: 'Operations', status: 'approved' }];
  const directory = [{ id: 'd1', kind: 'Doctor', name: 'dr. Andreas Wirawan, Sp.PD', what: 'Internal medicine · visits Tuesdays', phone: '+62 812-9001-2234', public: true }, { id: 'd2', kind: 'Doctor', name: 'dr. Melinda Kusumo', what: 'GP on call', phone: '+62 813-4410-9921', public: true }, { id: 'd3', kind: 'Service', name: 'RS Medika Kemang', what: 'Nearest hospital · emergency', phone: '+62 21 7590 0110', public: true }, { id: 'd4', kind: 'Service', name: 'Apotek Sehat Selalu', what: 'Pharmacy · delivers to homes', phone: '+62 21 7590 2231', public: true }, { id: 'd5', kind: 'Service', name: 'Fisio Sehat Home Visit', what: 'Physiotherapy at home', phone: '+62 813-9988-1203', public: true }, { id: 'd6', kind: 'Supplier', name: 'Sayur Segar Kemang', what: 'Vegetables and fruit', phone: '+62 811-8802-4410', public: false }, { id: 'd7', kind: 'Supplier', name: 'Ikan Laut Jaya', what: 'Fish', phone: '+62 812-1180-3321', public: false }, { id: 'd8', kind: 'Supplier', name: 'Toko Kue Ny. Liem', what: 'Kue for afternoon tea', phone: '+62 815-7712-0098', public: false }, { id: 'd9', kind: 'Supplier', name: 'Bersih Prima', what: 'Cleaning supplies', phone: '+62 21 7581 4410', public: false }];
  calendar.push({ date: '2026-10-17', kind: 'venue', title: 'Venue booking: Rotary Club Jakarta Selatan breakfast', time: '08:00–12:00' });
  const VC = { 'PT Arunika Farma caregiver seminar': ['Ibu Santi Wirjo', '+62 812-3300-1180', 40, 'Whole club'], 'Bank Prima Nusantara retirees’ morning': ['Bapak Teddy Haris', '+62 811-2290-4471', 30, 'Garden room'], 'Yayasan Kasih Bunda choir rehearsal': ['Ibu Lusi Tan', '+62 813-6611-2290', 25, 'Music room'], 'Rotary Club Jakarta Selatan breakfast': ['Bapak Arief Sudarmo', '+62 812-5570-8812', 35, 'Garden room'] };
  const venues = calendar.filter(c => c.kind === 'venue').map((c, i) => { const org = c.title.replace('Venue booking: ', ''); const v = VC[org] || ['', '', 20, 'Lounge']; return { id: 'v' + (i + 1), org, contact: v[0], phone: v[1], guests: String(v[2]), room: v[3], date: c.date, time: c.time, review: org.indexOf('Rotary') === 0 ? { stars: 5, text: 'Spotless rooms and the kue were a hit. We will book again in January.' } : null }; });
  const broadcasts = [{ title: 'Club closed: Friday 30 October for staff first-aid training', aud: 'Families', n: 94, when: 'Sent Mon 12 Oct, 10:00', status: 'sent' }];
  const schedule = JSON.parse(JSON.stringify(SCHEDULE)); const schedulePub = { at: 'Mon 19 Oct, 16:10', by: 's9' };
  return { surveys, breqs, vinv, directory, venues, broadcasts, feed: [], comments: [], menu, menuPhoto, threads, dlog, pricing: { sample: { flex: true, gold: true, extra: true } }, schedule, schedulePub, today: TODAY, clubhouses, members, family, staff, users, att, past, readings, logs, photos, invoices, bookings, requests, enquiries, calendar, suppliers, doctors, budgets, receipts, complaints, stock, messages };
}

window.CPData = {TODAY, CLOCK_START, PRICES, iso, addDays, dow, toMin, toHM, rp, bpStatus, spo2Status, gluStatus, wtStatus, tempStatus, worst, SCHEDULE, MENU, buildData};
})();
