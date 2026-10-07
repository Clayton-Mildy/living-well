
const TONES = [['#E8E1D8', '#2B231C'], ['#DCCFC0', '#3E3326'], ['#EADFD3', '#6B5640'], ['#CAB8A2', '#2E261D'], ['#F1E7DC', '#2B231C']];
const n = (key, label, glyph, count) => ({ key, label, glyph, count: count || 0 });
const NAV = {
  lobby: [[null, [n('today', 'Arrivals', 'how_to_reg'), n('enquiries', 'Enquiries', 'contact_phone', 1), n('chat', 'Messages', 'chat', 2), n('members', 'Members', 'groups'), n('contacts', 'Contacts', 'contacts'), n('requests', 'Requests', 'add_shopping_cart')]]],
  nurse: [[null, [n('today', 'Health checks', 'monitor_heart', 2), n('readings', 'Readings', 'monitoring'), n('members', 'Members', 'groups'), n('chat', 'Messages', 'chat'), n('requests', 'Requests', 'add_shopping_cart')]]],
  activity: [[null, [n('today', 'Today', 'wb_sunny'), n('camera', 'Camera', 'photo_camera'), n('log', 'Daily log', 'edit_note'), n('members', 'Members', 'groups'), n('calendar', 'Calendar', 'calendar_month'), n('requests', 'Requests', 'add_shopping_cart')]]],
  kitchen: [[null, [n('today', 'Menu', 'restaurant'), n('feedback', 'Feedback', 'forum'), n('stock', 'Stock', 'inventory_2', 1), n('requests', 'Requests', 'add_shopping_cart')]]],
  finance: [[null, [n('today', 'Billing', 'payments'), n('payments', 'Payments', 'account_balance'), n('budget', 'Budget', 'pie_chart', 2), n('receipts', 'Receipts', 'receipt_long', 1), n('stock', 'Stock', 'inventory_2', 3), n('members', 'Members', 'groups'), n('chat', 'Messages', 'chat'), n('directory', 'Directory', 'contacts')]]],
  mgmt: [
    [null, [n('today', 'Arrivals', 'how_to_reg'), n('members', 'Members', 'groups'), n('reviews', 'Reviews', 'fact_check')]],
    ['Front desk', [n('enquiries', 'Enquiries', 'contact_phone', 1), n('chat', 'Messages', 'chat', 2)]],
    ['Care', [n('hchecks', 'Health checks', 'monitor_heart', 2), n('readings', 'Readings', 'monitoring'), n('log', 'Daily log', 'edit_note'), n('camera', 'Camera', 'photo_camera')]],
    ['Kitchen', [n('menu', 'Menu', 'restaurant'), n('feedback', 'Feedback', 'forum'), n('stock', 'Stock', 'inventory_2')]],
    ['Finance', [n('billing', 'Billing', 'payments'), n('payments', 'Payments', 'account_balance'), n('budget', 'Budget', 'pie_chart'), n('receipts', 'Receipts', 'receipt_long')]],
    ['Club', [n('calendar', 'Calendar and schedule', 'calendar_month'), n('broadcast', 'Broadcast', 'campaign'), n('venue', 'Venue', 'storefront'), n('hr', 'People', 'badge'), n('directory', 'Directory', 'contacts'), n('surveys', 'Surveys', 'rate_review'), n('plans', 'Plans and pricing', 'sell')]],
  ],
  family: [[null, [n('today', 'Today', 'wb_sunny'), n('photos', 'Photos', 'photo_library'), n('health', 'Health', 'favorite'), n('billing', 'Billing', 'receipt_long'), n('chat', 'Messages', 'chat')]]],
};
const PHONE_MGMT = ['today', 'members', 'calendar'];
const SHORT = { Arrivals: 'Arrivals', Enquiries: 'Leads', Messages: 'Chat', 'Health checks': 'Checks', Readings: 'Trends', 'Daily log': 'Log', Billing: 'Bills', Payments: 'Pay', Directory: 'Contacts', 'Calendar and schedule': 'Calendar' };
const USERS = {
  lobby: { name: 'Caca', ini: 'CA', role: 'Lobby', bell: 2, lands: 'Arrivals board' },
  nurse: { name: 'Dewi Anggraini', ini: 'DA', role: 'Nurse', bell: 1, lands: 'Health station' },
  activity: { name: 'Dinar', ini: 'DI', role: 'Activity teacher', bell: 0, lands: "Today's activity" },
  kitchen: { name: 'Yohanes Pratama', ini: 'YP', role: 'Kitchen & F&B', bell: 4, lands: 'Menu of the day' },
  finance: { name: 'Fransiska Tan', ini: 'FT', role: 'Finance', bell: 9, lands: 'Billing board' },
  mgmt: { name: 'Ega', ini: 'EG', role: 'Management', bell: 5, lands: 'Arrivals board' },
  family: { name: 'Maria Wijaya', ini: 'MW', role: 'Family', bell: 6, lands: 'Today page', sub: 'Family · Oma Lina, Opa Budi · billing' },
};
const TODAY = { lobby: 'arrivals', nurse: 'health', activity: 'activity', kitchen: 'kitchen', finance: 'finance', mgmt: 'arrivals', family: 'family' };
const KEYMAP = { hchecks: 'health', menu: 'kitchen', billing: 'finance', members: 'members', chat: 'chat', enquiries: 'enq', contacts: 'dir', directory: 'dir', requests: 'requests', readings: 'readings', camera: 'camera', log: 'dlog', calendar: 'cal', feedback: 'kfeed', stock: 'kstock', payments: 'pay', budget: 'budget', receipts: 'rcpt', reviews: 'reviews', broadcast: 'bc', venue: 'venue', hr: 'hr', surveys: 'surveys', plans: 'plans' };
const FAM_MAP = { photos: 'fphotos', health: 'fhealth', billing: 'fbill', chat: 'chat', contacts: 'dir', calendar: 'cal' };
const SCREENS = ['arrivals', 'health', 'activity', 'kitchen', 'finance', 'family', 'placeholder', 'members', 'chat', 'enq', 'dir', 'requests', 'readings', 'camera', 'dlog', 'cal', 'kfeed', 'kstock', 'pay', 'budget', 'rcpt', 'reviews', 'bc', 'venue', 'hr', 'surveys', 'plans', 'fphotos', 'fhealth', 'fbill'];
const chip = (on) => ({ bg: on ? '#24201C' : '#FFFFFF', fg: on ? '#FFFFFF' : '#24201C', bd: on ? '1px solid #24201C' : '1px solid #DCD3C8' });
const MEM = [
  { id: 'bp', name: 'Bapak Bambang Purnomo', ini: 'BP', tone: 4, sub: '77 years · no mobility aid', plan: 'Flex · 8 of 10 visits', flex: true, flag: ['no_food', 'Seafood', '#F9E3DB', '#9A3D24'] },
  { id: 'bw', name: 'Opa Budi Wijaya', ini: 'BW', tone: 1, sub: '84 years · walking stick', plan: 'Gold · unlimited', usual: '10:05' },
  { id: 'hg', name: 'Opa Hendra Gunawan', ini: 'HG', tone: 1, sub: '84 years · walker', plan: 'Gold · unlimited', attention: true, flag: ['visibility', 'Watch · BP 142/89', '#F6ECD6', '#7A5510'] },
  { id: 'lw', name: 'Oma Lina Wijaya', ini: 'LW', tone: 4, sub: '81 years · walking stick', plan: 'Flex · 10 of 10 visits', flex: true, usual: '10:05', flag: ['no_food', 'Shellfish', '#F9E3DB', '#9A3D24'] },
  { id: 'tl', name: 'Opa Tjahjadi Lim', ini: 'TL', tone: 4, sub: '88 years · walker', plan: 'Gold · unlimited', attention: true, flag: ['error', 'Payment overdue', '#9A3D24', '#FFFFFF'] },
];
const THREADS = {
  laras: { name: 'Laras Saputra', ini: 'LS', about: 'About Bapak Bambang', rel: 'Daughter of Bapak Bambang Purnomo', phone: '+62 816-1436-6582', profile: 'Bapak Bambang’s profile', time: 'Today 07:40' },
  maria: { name: 'Maria Wijaya', ini: 'MW', about: 'About Oma Lina', rel: 'Daughter of Oma Lina Wijaya', phone: '+62 812-1090-4471', profile: 'Oma Lina’s profile', time: 'Tue 20 Oct 19:12' },
};
const QUICK = ['Thank you, noted.', 'Yes, it’s at the lobby.', 'We’ll check and get back to you.'];
const ENQ = [
  { k: 'new', title: 'New', color: '#5E4E3B', cards: [{ name: 'Oma Ellen Sutanto', contact: 'Kevin Sutanto, grandson', source: 'Website', next: 'Call back Thu 22 Oct', nextIcon: 'call', btn: 'Book visit' }] },
  { k: 'visit', title: 'Visit', color: '#5E4E3B', cards: [
    { name: 'Bapak Yusuf Hamid', contact: 'Ilham Hamid, son', source: 'Instagram', next: 'Visit Wed 21 Oct, 14:00', nextIcon: 'meeting_room', btn: 'Book trial' },
    { name: 'Opa Leo Gunadi', contact: 'Felicia Gunadi, daughter', source: 'Referral', next: 'Visit Fri 23 Oct, 11:00', nextIcon: 'meeting_room', btn: 'Book trial', tag: ['schedule', 'Form sent', '#F3EEE8', '#5E4E3B'] }] },
  { k: 'trial', title: 'Trial booked', color: '#3D6B4F', cards: [{ name: 'Oma Siu Lan Tjandra', contact: 'Melinda Tjandra, daughter', source: 'Referral', next: 'Trial day Wed 21 Oct, 10:30', nextIcon: 'waving_hand', btn: 'Review form and join', tag: ['assignment_turned_in', 'Form ready to review', '#F6ECD6', '#7A5510'] }] },
  { k: 'joined', title: 'Joined', color: '#3D6B4F', cards: [] },
  { k: 'lost', title: 'Lost', color: '#9A3D24', cards: [{ name: 'Ibu Nyoman Sari', contact: 'Made Arya, son', source: 'Referral', next: 'Chose a place closer to family in Bali', nextIcon: 'block', btn: 'Reopen' }] },
];
const DIR = [
  { name: 'Apotek Sehat Selalu', sub: 'Service · pharmacy · delivers to homes', t: 'services', icon: 'medical_services', phone: '+62 21 7590 2231', pub: true },
  { name: 'Bersih Prima', sub: 'Supplier · cleaning supplies', t: 'suppliers', icon: 'local_shipping', phone: '+62 21 7581 4410', pub: false },
  { name: 'Ikan Laut Jaya', sub: 'Supplier · fish', t: 'suppliers', icon: 'local_shipping', phone: '+62 812-1180-3321', pub: false },
  { name: 'RS Medika Kemang', sub: 'Service · nearest hospital · emergency', t: 'services', icon: 'medical_services', phone: '+62 21 7590 0110', pub: true },
  { name: 'Sayur Segar Kemang', sub: 'Supplier · vegetables and fruit', t: 'suppliers', icon: 'local_shipping', phone: '+62 811-8802-4410', pub: false },
  { name: 'dr. Andreas Wirawan, Sp.PD', sub: 'Doctor · internal medicine · visits Tuesdays', t: 'doctors', icon: 'stethoscope', phone: '+62 812-9001-2234', pub: true },
  { name: 'dr. Melinda Kusumo', sub: 'Doctor · GP on call', t: 'doctors', icon: 'stethoscope', phone: '+62 813-4410-9921', pub: true },
];
const HEADS = {
  arrivals: { eyebrow: 'Wednesday 21 October', title: 'Arrivals' },
  health: { eyebrow: 'Health station · Wed 21 Oct', title: 'Health checks' },
  activity: { eyebrow: 'Wednesday 21 October', title: 'Hello, Dinar' },
  kitchen: { eyebrow: 'Wednesday 21 October', title: 'Menu of the day' },
  finance: { eyebrow: 'Invoices on the 15th · due on the 27th', title: 'Billing' },
  family: { eyebrow: 'Wednesday 21 October', title: 'Good morning, Maria' },
};
const STATUS = { normal: ['check_circle', 'Normal', '#E3EFE6', '#2F5A40'], pending: ['schedule', 'Check pending', '#F6ECD6', '#7A5510'], watch: ['visibility', 'Watch', '#F6ECD6', '#7A5510'] };
const MEMBERS = [
  { id: 'bw', name: 'Opa Budi Wijaya', ini: 'BW', tone: 1, usual: '10:05', care: 'Walking stick · low salt' },
  { id: 'lw', name: 'Oma Lina Wijaya', ini: 'LW', tone: 4, usual: '10:05', care: 'Walking stick', allergy: 'Shellfish' },
  { id: 'bp', name: 'Bapak Bambang Purnomo', ini: 'BP', tone: 4, care: '', allergy: 'Seafood' },
  { id: 'hg', name: 'Opa Hendra Gunawan', ini: 'HG', tone: 1, care: 'Walker · low salt' },
  { id: 'tl', name: 'Opa Tjahjadi Lim', ini: 'TL', tone: 4, care: 'Walker · soft food' },
];
const NQ = {
  tl: { name: 'Opa Tjahjadi Lim', ini: 'TL', tone: 4, at: '09:38', wait: '20 min', sub: 'BP, SpO₂, temperature · glucose and weight due', meta: '88 · Gold · arrived 09:38', care: 'Walker · soft food · Metformin 500 mg at lunch', note: 'Diabetic: offer the sugar-free snack at tea. Prefers the same seat near the piano.', lastBp: 'Last 127/69 · Tue 20 Oct', lastOx: 'Last 95% · 36.6 °C · Tue 20 Oct', read: { sys: '128', dia: '72', pulse: '74', spo2: '96', temp: '36.7' } },
  hg: { name: 'Opa Hendra Gunawan', ini: 'HG', tone: 1, at: '09:40', wait: '18 min', sub: 'BP, SpO₂ and temperature', meta: 'Arrived 09:40', care: 'Walker · low salt', badge: 'watch', badgeText: 'Watch · 142/89 on Tue 20 Oct', lastBp: 'Last 142/89 · Tue 20 Oct', lastOx: 'No earlier reading', read: { sys: '138', dia: '84', pulse: '78', spo2: '97', temp: '36.5' } },
  bp: { name: 'Bapak Bambang Purnomo', ini: 'BP', tone: 4, at: '09:48', wait: '', sub: 'Arrival check done', meta: '', care: '', done: true },
};
const FIELDS = { sys: ['Sys', 'mmHg'], dia: ['Dia', 'mmHg'], pulse: ['Pulse', 'bpm'], spo2: ['SpO₂', '%'], temp: ['Temp', '°C'] };

class Component extends DCLogic {
  state = this.initial();
  componentDidUpdate(prev) {
    if (prev.resetKey !== this.props.resetKey) this.setState(this.initial());
    else if (prev.startRole !== this.props.startRole) {
      if (this.props.startRole === 'login') this.setState({ signedIn: false, demoOpen: false, moreOpen: false });
      else this.signInAs(this.props.startRole);
    }
  }
  initial() {
    return {
      signedIn: this.props.startRole !== 'login', role: this.props.startRole && this.props.startRole !== 'login' ? this.props.startRole : 'lobby', key: 'today', demoOpen: false, moreOpen: false,
      mode: 'in', att: { bp: { at: '09:48', st: 'normal' }, hg: { at: '09:40', st: 'pending' }, tl: { at: '09:38', st: 'pending' } }, gone: {}, lastScan: null,
      nTab: 'todo', nOrder: ['tl', 'hg'], nDone: ['bp'], nSel: 'tl', nActive: 'sys', nVals: {}, kAlt: false, fTab: 'both',
      memF: 'active', chSel: 'laras', chOpen: false, chDraft: '', chRead: { laras: true },
      chMsgs: { laras: [{ me: false, text: 'Papa has a dentist appointment Friday, he will leave at 14:00.', meta: 'Laras · Today 07:40' }], maria: [{ me: false, text: 'Mama forgot her cardigan on Monday.', meta: 'Maria · Tue 20 Oct 19:12' }], lobby: [{ me: true, text: 'Mama forgot her cardigan on Monday.', meta: 'You · Tue 20 Oct 19:12' }] },
      enqStage: 'new', dirF: 'all', rqMine: [],
      rdF: 'all', rdSel: 'hg', cmTab: 'cam', cmShots: 0, dlDay: 0, dlVals: {}, dlSaved: {}, dlOpen: null, calView: 'list',
      fbF: 'open', fbDrafts: {}, fbReplies: {}, skF: 'all', skSt: {}, pyInv: 0, pyM: 'SGD bank transfer', bgSt: {}, rcSt: {},
      rvTab: 'todo', rvState: 'pending', bcAud: 'fam', bcTpl: 'Club update', bcWhen: 'Send now', bcMsg: '', bcSent: [{ title: 'Club closed: Friday 30 October for staff first-aid training', sub: 'Families · 6 people · sent Mon 12 Oct, 10:00' }],
      ppSel: 's3', ppTab: 'Profile', ppAccess: {}, plPrice: { flex: '5.500.000', gold: '9.500.000', extra: '650.000' }, plMem: 'lw',
      fpF: 'all', fhSel: 'lw', fbPaid: {}, fbBank: 'BCA',
    };
  }
  batch2Vals(st, isPhone) {
    const SB = { normal: ['check_circle', 'Normal', '#E3EFE6', '#2F5A40'], watch: ['visibility', 'Watch', '#F6ECD6', '#7A5510'], alert: ['warning', 'Alert', '#9A3D24', '#FFFFFF'] };
    // readings
    const R = [
      { id: 'hg', name: 'Opa Hendra Gunawan', ini: 'HG', tone: 1, meta: '84 · high blood pressure', bp: '142/89', when: 'Tue 20 Oct', s: 'alert', v: { bp: ['150/93', 'watch'], pulse: ['78', 'normal'], spo2: ['96%', 'normal'], temp: ['36.7 °C', 'normal'], glu: ['123 mg/dL', 'normal'], wt: ['68.5 kg', 'normal'] } },
      { id: 'tl', name: 'Opa Tjahjadi Lim', ini: 'TL', tone: 4, meta: '88 · diabetic', bp: '132/68', when: 'Tue 20 Oct', s: 'watch', v: { bp: ['132/68', 'watch'], pulse: ['72', 'normal'], spo2: ['95%', 'normal'], temp: ['36.6 °C', 'normal'], glu: ['168 mg/dL', 'watch'], wt: ['61.2 kg', 'normal'] } },
      { id: 'bp', name: 'Bapak Bambang Purnomo', ini: 'BP', tone: 4, meta: '77 · mild memory loss', bp: '122/73', when: 'today', s: 'normal', v: { bp: ['122/73', 'normal'], pulse: ['70', 'normal'], spo2: ['97%', 'normal'], temp: ['36.5 °C', 'normal'], glu: ['104 mg/dL', 'normal'], wt: ['72.0 kg', 'normal'] } },
      { id: 'bw', name: 'Opa Budi Wijaya', ini: 'BW', tone: 1, meta: '84', bp: '132/83', when: 'Tue 20 Oct', s: 'normal', v: { bp: ['132/83', 'normal'], pulse: ['74', 'normal'], spo2: ['96%', 'normal'], temp: ['36.6 °C', 'normal'], glu: ['110 mg/dL', 'normal'], wt: ['66.4 kg', 'normal'] } },
      { id: 'lw', name: 'Oma Lina Wijaya', ini: 'LW', tone: 4, meta: '81', bp: '124/76', when: 'Tue 20 Oct', s: 'normal', v: { bp: ['124/76', 'normal'], pulse: ['76', 'normal'], spo2: ['97%', 'normal'], temp: ['36.4 °C', 'normal'], glu: ['98 mg/dL', 'normal'], wt: ['54.8 kg', 'normal'] } },
    ];
    const rf = st.rdF;
    const rlist = R.filter(m => rf === 'all' || m.s === rf);
    const sel = R.find(m => m.id === st.rdSel) || R[0];
    const bars = (seed, hi) => Array.from({ length: 14 }, (_, i) => { const h = 45 + ((seed * 37 + i * 53) % 35) + (hi && i === 11 ? 18 : 0); return { h: Math.min(96, h), c: hi && i >= 10 ? '#C9A35A' : '#8FB39C' }; });
    const MET = [['bp', 'Blood pressure', 'Arrival · shaded: normal range'], ['pulse', 'Pulse', 'Arrival · normal 60–100'], ['spo2', 'SpO₂', 'Watch under 95, alert under 92'], ['temp', 'Temperature', 'Watch from 37.5, alert from 38.0'], ['glu', 'Glucose', 'Monthly · normal 70–180'], ['wt', 'Weight', 'Monthly · watch on a 3 kg change']];
    const rd = {
      chips: [['all', 'All'], ['watch', 'Watch'], ['alert', 'Alert']].map(([k, label]) => ({ label, n: k === 'all' ? R.length : R.filter(m => m.s === k).length, onClick: () => this.setState({ rdF: k }), ...chip(rf === k) })),
      list: rlist.map(m => { const b = SB[m.s]; const on = m.id === sel.id; return { ...m, avBg: TONES[m.tone][0], avFg: TONES[m.tone][1], last: `Last BP ${m.bp} · ${m.when}`, sIcon: b[0], sText: b[1], sBg: b[2], sFg: b[3], bg: on ? '#FBF8F4' : '#FFFFFF', bar: on ? '#2B231C' : 'transparent', onClick: () => this.setState({ rdSel: m.id }) }; }),
      sel: { ...sel, avBg: TONES[sel.tone][0], avFg: TONES[sel.tone][1] },
      metrics: MET.map(([k, label, note], i) => { const [value, s] = sel.v[k]; const b = SB[s]; return { label, value, note, sIcon: b[0], sText: b[1], sBg: b[2], sFg: b[3], bars: bars(i + sel.ini.charCodeAt(0), s !== 'normal') }; }),
    };
    // camera
    const tab = (on, onClick, label, icon) => ({ label, icon, onClick, bg: on ? '#FFFFFF' : 'transparent', shadow: on ? '0 1px 3px rgba(40,30,20,0.14)' : 'none', weight: on ? 600 : 500 });
    const PB = ['#E8E1D8', '#DCCFC0', '#EADFD3', '#D9CDBF', '#F1E7DC'], PD = ['#C9B49C', '#B9A28A', '#CDB9A3', '#BFA88F', '#D4C2AE'];
    const cm = {
      tabs: [tab(st.cmTab === 'cam', () => this.setState({ cmTab: 'cam' }), 'Camera'), tab(st.cmTab === 'lib', () => this.setState({ cmTab: 'lib' }), `Library · ${st.cmShots}`)],
      isCam: st.cmTab === 'cam', isLib: st.cmTab === 'lib', noPhotos: !st.cmShots,
      title: st.cmShots ? `Photo ${st.cmShots} sent for approval` : 'Group photo', sub: st.cmShots ? '3 faces matched: Bapak Bambang, Opa Hendra, Opa Tjahjadi.' : 'Faces are matched to today’s attendees. You confirm who is in it before it is sent.',
      take: () => this.setState(s => ({ cmShots: s.cmShots + 1 })),
      photos: Array.from({ length: st.cmShots }, (_, i) => ({ title: `Keroncong · 10:3${i}`, bg: `radial-gradient(120% 95% at 28% 22%, #FBF6F0 0%, ${PB[i % 5]} 50%, ${PD[i % 5]} 100%)` })),
    };
    // daily log
    const LOGM = [{ id: 'bp', ini: 'BP', tone: 4, name: 'Bapak Bambang Purnomo', base: 'Mild memory loss · settled on the last 10 days' }, { id: 'hg', ini: 'HG', tone: 1, name: 'Opa Hendra Gunawan', base: 'Alert and oriented · unsettled on 1 of the last 10 days' }, { id: 'tl', ini: 'TL', tone: 4, name: 'Opa Tjahjadi Lim', base: 'Alert and oriented · quiet on 1 of the last 10 days' }];
    const MOOD = ['Cheerful', 'Calm', 'Quiet', 'Unsettled'], LUNCH = ['Ate all', 'Ate most', 'Ate half', 'Ate a little'];
    const savedN = LOGM.filter(m => st.dlSaved[m.id]).length;
    const setLog = (id, k, v) => this.setState(s => ({ dlVals: { ...s.dlVals, [id]: { ...(s.dlVals[id] || {}), [k]: v } } }));
    const dl = {
      days: ['Today', 'Yesterday', 'Mon 19 Oct', 'Fri 16 Oct', 'Thu 15 Oct', 'Wed 14 Oct'].map((label, i) => ({ label, onClick: () => this.setState({ dlDay: i }), ...chip(st.dlDay === i) })),
      rows: LOGM.map(m => {
        const v = st.dlVals[m.id] || {}; const saved = st.dlSaved[m.id]; const open = st.dlOpen === m.id;
        const changed = [v.mood, v.lunch].filter(Boolean).join(' · ');
        return { ...m, avBg: TONES[m.tone][0], avFg: TONES[m.tone][1], open, chev: open ? 'expand_less' : 'expand_more', bd: open ? '#2B231C' : '#DCD3C8',
          summary: changed || m.base, sIcon: saved ? 'check' : 'edit_note', sText: saved ? 'Saved' : 'Not saved', sBg: saved ? '#E3EFE6' : '#F3EEE8', sFg: saved ? '#2F5A40' : '#5E4E3B',
          toggle: () => this.setState({ dlOpen: open ? null : m.id }),
          fields: [['Mood', 'mood', MOOD], ['Lunch', 'lunch', LUNCH]].map(([label, k, opts]) => ({ label, opts: opts.map(o => ({ label: o, onClick: () => setLog(m.id, k, o), ...chip(v[k] === o) })) })),
          save: () => this.setState(s => ({ dlSaved: { ...s.dlSaved, [m.id]: true }, dlOpen: null })) };
      }),
      saveAllLabel: savedN === LOGM.length ? 'All 3 logs saved' : 'Save everyone else as normal',
      saveAll: () => this.setState({ dlSaved: { bp: true, hg: true, tl: true }, dlOpen: null }),
      savedN,
    };
    // calendar
    const ev = (time, icon, title, sub, kind) => ({ time, icon, title, sub, bg: kind === 'guest' ? '#F6ECD6' : '#F3EEE8', fg: kind === 'guest' ? '#7A5510' : '#2B231C' });
    const DAYS = [
      { title: 'Wednesday 21 October', today: true, events: [ev('10:30', 'waving_hand', 'Oma Siu Lan Tjandra', 'Trial day', 'guest'), ev('10:30', 'music_note', 'Keroncong sing-along', 'Music room · Dinar'), ev('13:30', 'palette', 'Batik painting', 'Studio · Kak Dimas'), ev('14:00', 'meeting_room', 'Bapak Yusuf Hamid', 'Visit', 'guest')] },
      { title: 'Thursday 22 October', events: [ev('10:30', 'yard', 'Gardening club', 'Garden · Kak Dimas'), ev('13:30', 'playing_cards', 'Mahjong and cards', 'Lounge · Dinar')] },
      { title: 'Friday 23 October', events: [ev('10:30', 'music_note', 'Line dancing', 'Music room · Dinar'), ev('11:00', 'meeting_room', 'Opa Leo Gunadi', 'Visit', 'guest')] },
    ];
    const EVN = { 21: 4, 22: 2, 23: 2 };
    const cells = [];
    for (let i = 0; i < 3; i++) cells.push({ n: '', bg: 'transparent', bd: 'none', op: 1, fg: '#24201C', weight: 400, has: false, dots: [] });
    for (let d = 1; d <= 31; d++) {
      const dow = (d + 2) % 7; const weekend = dow === 5 || dow === 6; const isToday = d === 21;
      const nE = weekend ? 0 : (EVN[d] || 2);
      cells.push({ n: String(d), bg: isToday ? '#EAF1EC' : weekend ? '#F6F1EA' : '#FFFFFF', bd: isToday ? '2px solid #3D6B4F' : '1px solid #F0EAE1', op: weekend ? 0.6 : 1, fg: isToday ? '#2F5A40' : '#24201C', weight: isToday ? 700 : 500, has: nE > 0, dots: Array.from({ length: nE }, () => 1) });
    }
    const cal = {
      tabs: [tab(st.calView === 'list', () => this.setState({ calView: 'list' }), 'List', 'view_agenda'), tab(st.calView === 'month', () => this.setState({ calView: 'month' }), 'Month', 'calendar_month')],
      isList: st.calView === 'list', isMonth: st.calView === 'month', days: DAYS, dow: isPhone ? ['M', 'T', 'W', 'T', 'F', 'S', 'S'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], cells,
    };
    const heads = {
      readings: { eyebrow: 'Health station · last 4 weeks', title: 'Readings' },
      camera: { eyebrow: 'Next · 10:30 · keroncong sing-along', title: 'Camera' },
      dlog: { eyebrow: `Wednesday 21 October · ${savedN} of 3 saved`, title: 'Daily log' },
      cal: { eyebrow: 'Open Monday to Friday · 08:30–16:30', title: 'Calendar and schedule' },
    };
    return { rd, cm, dl, cal, heads };
  }
  batch3Vals(st, isPhone, role) {
    const tag = (k) => ({ open: ['visibility', 'Open', '#F6ECD6', '#7A5510'], answered: ['check_circle', 'Answered', '#E3EFE6', '#2F5A40'], requested: ['schedule', 'Requested', '#F6ECD6', '#7A5510'], approved: ['visibility', 'Approved · to order', '#EAF1EC', '#2F5A40'], received: ['check_circle', 'Received', '#E3EFE6', '#2F5A40'], declined: ['cancel', 'Declined', '#F9E3DB', '#9A3D24'], waiting: ['schedule', 'Waiting', '#F6ECD6', '#7A5510'], ok: ['check_circle', 'Approved', '#E3EFE6', '#2F5A40'], rejected: ['cancel', 'Rejected', '#F9E3DB', '#9A3D24'], xero: ['check_circle', 'Approved · in Xero', '#E3EFE6', '#2F5A40'], toapprove: ['visibility', 'To approve', '#F6ECD6', '#7A5510'], paid: ['check_circle', 'Paid', '#E3EFE6', '#2F5A40'] }[k]);
    const T4 = (b) => ({ sIcon: b[0], sText: b[1], sBg: b[2], sFg: b[3] });
    // feedback
    const FB = [
      { id: 'f1', ini: 'TL', tone: 4, member: 'Opa Tjahjadi Lim', from: 'From Yohana Lim, daughter · today', dish: 'Sop ikan kakap · Wednesday’s menu', text: 'Last time Papa found a small bone in the fish soup. Please check before serving.' },
      { id: 'f2', ini: 'BP', tone: 4, member: 'Bapak Bambang Purnomo', from: 'From Laras Saputra, daughter · Mon 19 Oct', dish: 'Sayur asem · Monday’s menu', text: 'Papa said the soup was too salty on Monday.' },
      { id: 'f3', ini: 'HG', tone: 1, member: 'Opa Hendra Gunawan', from: 'From Cynthia Gunawan, daughter · Fri 16 Oct', dish: 'Gado-gado · Friday’s menu', text: 'Papa would like a vegetarian option on Fridays.' },
    ];
    const replies = { f3: { text: 'Thank you. From next Friday there is a tempeh and vegetable option next to the gado-gado.', by: 'Chef Agus · Fri 16 Oct' }, ...st.fbReplies };
    const fbItems = FB.map(f => { const r = replies[f.id]; const d = st.fbDrafts[f.id] || ''; return { ...f, avBg: TONES[f.tone][0], avFg: TONES[f.tone][1], answered: !!r, open: !r, reply: r && r.text, replyBy: r && r.by, ...T4(tag(r ? 'answered' : 'open')), draft: d,
      onDraft: (e) => { const v = e.target.value; this.setState(s => ({ fbDrafts: { ...s.fbDrafts, [f.id]: v } })); },
      send: () => d.trim() && this.setState(s => ({ fbReplies: { ...s.fbReplies, [f.id]: { text: d, by: `${USERS[role].name} · just now` } } })), sendBg: d.trim() ? '#2B231C' : '#E9E3DB', sendFg: d.trim() ? '#FFFFFF' : '#5E5852' }; });
    const fbF = [['open', 'Open', f => f.open], ['answered', 'Answered', f => f.answered], ['all', 'All', () => true]];
    const fbFn = (fbF.find(x => x[0] === st.fbF) || fbF[0])[2];
    const fb = { chips: fbF.map(([k, label, fn]) => ({ label, n: fbItems.filter(fn).length, onClick: () => this.setState({ fbF: k }), ...chip(st.fbF === k) })), items: fbItems.filter(fbFn) };
    // stock
    const SK = [
      { id: 's1', title: 'Hand soap refills · 6 bottles', sub: 'Housekeeping · Bu Siti · Wed 21 Oct', sec: 'Housekeeping', st: 'requested' },
      { id: 's2', title: 'Test strips (glucose) · 2 boxes', sub: 'Health · Ns. Dewi · Tue 20 Oct', sec: 'Health', st: 'requested' },
      { id: 's3', title: 'Teh melati · 5 packs', sub: 'Kitchen · Pak Yohanes · Tue 20 Oct', sec: 'Kitchen', st: 'requested', mine: true },
      { id: 's4', title: 'Batik wax · 1 kg', sub: 'Activities · Kak Dimas · Mon 19 Oct · approved by Ega', sec: 'Activities', st: 'approved' },
      { id: 's5', title: 'Beras merah · 25 kg', sub: 'Kitchen · Chef Agus · Fri 16 Oct · approved by Pak Yohanes', sec: 'Kitchen', st: 'received' },
    ].map(x => ({ ...x, st: st.skSt[x.id] || x.st }));
    const canApprove = role === 'finance' || role === 'mgmt' || role === 'kitchen';
    const skF = [['all', 'All', () => true], ['requested', 'Requested', x => x.st === 'requested'], ['approved', 'To order', x => x.st === 'approved'], ['received', 'Received', x => x.st === 'received']];
    const skFn = (skF.find(x => x[0] === st.skF) || skF[0])[2];
    const sk = {
      chips: skF.map(([k, label, fn]) => ({ label, n: SK.filter(fn).length, onClick: () => this.setState({ skF: k }), ...chip(st.skF === k) })),
      rows: SK.filter(skFn).map((x, i) => {
        const next = x.st === 'requested' && canApprove ? ['Approve', 'approved'] : x.st === 'approved' ? ['Mark received', 'received'] : null;
        return { ...x, bt: i ? '1px solid #F0EAE1' : 'none', ...T4(tag(x.st)), canAct: !!next, act: next && next[0], onAct: () => next && this.setState(s => ({ skSt: { ...s.skSt, [x.id]: next[1] } })) };
      }),
    };
    // payments
    const PAY = [['Bapak Bambang Purnomo', 'INV-2610-010 · October 2026 · DOKU VA · BCA', 'Rp 5.500.000', 'Sun 18 Oct, 11:20'], ['Opa Hendra Gunawan', 'INV-2610-002 · October 2026 · DOKU VA · BCA', 'Rp 9.500.000', 'Fri 16 Oct, 11:20'], ['Bapak Bambang Purnomo', 'INV-2609-010 · September 2026 · DOKU VA · BCA', 'Rp 5.500.000', 'Thu 24 Sept, 11:20'], ['Opa Budi Wijaya', 'INV-2609-046 · September 2026 · DOKU VA · BCA', 'Rp 9.500.000', 'Mon 21 Sept, 11:20'], ['Oma Lina Wijaya', 'INV-2609-001 · September 2026 · DOKU VA · BCA', 'Rp 5.500.000', 'Mon 21 Sept, 11:20'], ['Opa Hendra Gunawan', 'INV-2609-002 · September 2026 · DOKU VA · BCA', 'Rp 9.500.000', 'Thu 17 Sept, 11:20']];
    const INVS = [['Opa Budi · October', 'Rp 9.500.000'], ['Oma Lina · October', 'Rp 5.500.000'], ['Opa Tjahjadi · September', 'Rp 9.500.000'], ['Opa Tjahjadi · October', 'Rp 9.500.000']];
    const py = {
      tiles: [{ label: 'Today · DOKU', n: '0', sub: 'Rp 0' }, { label: 'October so far', n: '2', sub: 'Rp 15.000.000' }, { label: 'Xero pending', n: '0', sub: 'Syncs a few minutes after each payment' }, { label: 'Refunds', n: '0', sub: 'Rp 0 · sent to Xero as credit notes' }],
      rows: PAY.map(([name, sub, amount, when]) => ({ name, sub, amount, when })),
      invs: INVS.map(([label, amount], i) => ({ label, amount, onClick: () => this.setState({ pyInv: i }), bg: st.pyInv === i ? '#F3EEE8' : '#FFFFFF', bd: st.pyInv === i ? '2px solid #75624B' : '1px solid #DCD3C8' })),
      methods: ['SGD bank transfer', 'Revolut', 'Cash', 'Other'].map(label => ({ label, onClick: () => this.setState({ pyM: label }), ...chip(st.pyM === label) })),
    };
    // budget
    const BUD = [
      { name: 'F&B', budget: 'Rp 9.500.000', pct: 64, cpct: 0, spent: 'Rp 6.120.000 spent', left: 'Rp 3.380.000 left', items: [{ id: 'b1', title: 'Extra fruit for Friday · Rp 300.000', sub: 'Pak Yohanes · Wed 21 Oct', st: 'waiting' }] },
      { name: 'Activities', budget: 'Rp 2.000.000', pct: 42, cpct: 0, spent: 'Rp 840.000 spent', left: 'Rp 1.160.000 left', items: [{ id: 'b2', title: 'Angklung tuning · Rp 450.000', sub: 'Dinar · Tue 20 Oct', st: 'waiting' }] },
      { name: 'Operations', budget: 'Rp 2.700.000', pct: 43, cpct: 9, spent: 'Rp 1.170.000 spent · Rp 250.000 committed', left: 'Rp 1.280.000 left', items: [{ id: 'b3', title: 'Wheelchair tyre repair · Rp 250.000', sub: 'Pak Joko · Mon 19 Oct', st: 'ok' }] },
    ];
    const bg = { sections: BUD.map(b => { const items = b.items.map(i => { const s = st.bgSt[i.id] || i.st; return { ...i, ...T4(tag(s)), waiting: s === 'waiting', approve: () => this.setState(x => ({ bgSt: { ...x.bgSt, [i.id]: 'ok' } })), reject: () => this.setState(x => ({ bgSt: { ...x.bgSt, [i.id]: 'rejected' } })) }; }); return { ...b, items, hasWaiting: items.some(i => i.waiting) }; }) };
    // receipts
    const rc = {
      receipts: [['Ikan Laut Jaya', 'F&B · Chef Agus · Tue 20 Oct', 'Rp 2.260.000'], ['Sayur Segar Kemang', 'F&B · Pak Yohanes · Tue 20 Oct', 'Rp 1.840.000'], ['Apotek Sehat Selalu', 'Operations · Ns. Dewi · Mon 19 Oct', 'Rp 410.000']].map(([vendor, sub, amount]) => ({ vendor, sub, amount })),
      vendors: [
        { id: 'v1', title: 'Bersih Prima · BP-2610-118', sub: 'Rp 1.350.000 · due Wed 28 Oct · Operations', st: 'xero', next: ['Mark paid', 'paid'] },
        { id: 'v2', title: 'Sayur Segar Kemang · INV/SSK/1023', sub: 'Rp 7.400.000 · due Sat 31 Oct · F&B', st: 'toapprove', next: ['Approve', 'xero'] },
      ].map(v => { const s = st.rcSt[v.id] || v.st; const next = s === v.st ? v.next : s === 'xero' ? ['Mark paid', 'paid'] : null; return { ...v, ...T4(tag(s)), hasAct: !!next, act: next && next[0], onAct: () => next && this.setState(x => ({ rcSt: { ...x.rcSt, [v.id]: next[1] } })) }; }),
    };
    const heads = {
      kfeed: { eyebrow: `${fbItems.filter(f => f.open).length} open · from families`, title: 'Feedback', hasAction: true, action: isPhone ? 'Log call' : 'Log a call', actionIcon: 'call' },
      kstock: { eyebrow: 'Request · approve · receive', title: 'Stock requests' },
      pay: { eyebrow: 'DOKU virtual accounts · Xero', title: 'Payments', hasAction: true, action: isPhone ? 'Sync' : 'Sync Xero now', actionIcon: 'sync' },
      budget: { eyebrow: 'Week of Mon 19 Oct · resets on Monday', title: 'Budget', hasAction: true, action: isPhone ? 'Section' : 'Add a section', actionIcon: 'add' },
      rcpt: { eyebrow: 'Snap · tag · send to finance and Xero', title: 'Receipts', hasAction: true, action: isPhone ? 'Snap' : 'Snap a receipt', actionIcon: 'photo_camera' },
    };
    return { fb, sk, py, bg, rc, heads };
  }
  batch4Vals(st, isPhone) {
    const tabOf = (on) => ({ bg: on ? '#FFFFFF' : 'transparent', shadow: on ? '0 1px 3px rgba(40,30,20,0.14)' : 'none', weight: on ? 600 : 500 });
    // reviews
    const rvState = st.rvState; // 'pending' | 'approved' | 'rejected'
    const rvTabs = [['todo', 'To approve', rvState === 'pending' ? 1 : 0], ['applied', 'Applied, review', 0], ['history', 'History', rvState === 'pending' ? 0 : 1]];
    const showItem = (st.rvTab === 'todo' && rvState === 'pending') || (st.rvTab === 'history' && rvState !== 'pending');
    const rvTag = rvState === 'pending' ? ['hourglass_top', 'Waiting', '#F6ECD6', '#7A5510'] : rvState === 'approved' ? ['check_circle', 'Approved', '#E3EFE6', '#2F5A40'] : ['cancel', 'Rejected', '#F9E3DB', '#9A3D24'];
    const rv = {
      chips: rvTabs.map(([k, label, n]) => ({ label, n, onClick: () => this.setState({ rvTab: k }), ...chip(st.rvTab === k) })),
      items: showItem ? [{ pending: rvState === 'pending', sIcon: rvTag[0], sText: rvTag[1], sBg: rvTag[2], sFg: rvTag[3] }] : [], empty: !showItem,
      approve: () => this.setState({ rvState: 'approved' }), reject: () => this.setState({ rvState: 'rejected' }),
    };
    // broadcast
    const AUD = [['fam', 'Families · 6', 6], ['enq', 'Enquiries · 4', 4], ['staff', 'Staff · 10', 10]];
    const TPL = ['Club update', 'Club closed', 'Event invitation'];
    const WHEN = ['Send now', 'Tomorrow, 08:00', 'Fri 23 Oct, 15:00'];
    const aud = AUD.find(a => a[0] === st.bcAud);
    const msg = st.bcMsg;
    const bcv = {
      groups: [
        { label: 'Audience', opts: AUD.map(([k, label]) => ({ label, onClick: () => this.setState({ bcAud: k }), ...chip(st.bcAud === k) })) },
        { label: 'Template', opts: TPL.map(t => ({ label: t, onClick: () => this.setState({ bcTpl: t }), ...chip(st.bcTpl === t) })) },
        { label: 'When', opts: WHEN.map(w => ({ label: w, onClick: () => this.setState({ bcWhen: w }), ...chip(st.bcWhen === w) })) },
      ],
      msg, onMsg: (e) => this.setState({ bcMsg: e.target.value }), tpl: st.bcTpl,
      preview: `Hello Cynthia, news from CitraPremier: ${msg.trim() || '…'}`,
      sendLabel: `${st.bcWhen === 'Send now' ? 'Send' : 'Schedule'} to ${aud[2]} people`, sendBg: msg.trim() ? '#2B231C' : '#E9E3DB', sendFg: msg.trim() ? '#FFFFFF' : '#5E5852',
      send: () => msg.trim() && this.setState(s => ({ bcMsg: '', bcSent: [{ title: `${s.bcTpl}: ${msg}`, sub: `${aud[1].split(' · ')[0]} · ${aud[2]} people · ${s.bcWhen === 'Send now' ? 'sent just now' : 'scheduled ' + s.bcWhen}` }, ...s.bcSent] })),
      sent: st.bcSent,
    };
    // venue
    const vn = { groups: [
      { title: 'Upcoming', meta: 'On the club calendar', rows: [
        { title: 'PT Arunika Farma caregiver seminar', when: 'Saturday 24 October · 09:00–13:00 · 40 guests · whole club', who: 'Ibu Santi Wirjo · +62 812-3300-1180', status: 'Confirmed' },
        { title: 'Bank Prima Nusantara retirees’ morning', when: 'Saturday 31 October · 08:00–12:00 · 30 guests · garden room', who: 'Bapak Teddy Haris · +62 811-2290-4471', status: 'Confirmed' }] },
      { title: 'Past and cancelled', meta: 'Send the guest a review link afterwards', rows: [
        { title: 'Rotary Club Jakarta Selatan breakfast', when: 'Saturday 17 October · 08:00–12:00 · 35 guests · garden room', who: 'Bapak Arief Sudarmo · +62 812-5570-8812', status: 'Reviewed 5/5', hasQuote: true, quote: 'Spotless rooms and the kue were a hit. We will book again in January.' }] },
    ] };
    // people
    const STAFF = [
      ['s3', 'Agus Santoso', 'Chef', '+62 811-2201-3347', 'Kitchen & F&B', 'Chef Agus', true, 'No'],
      ['s1', 'Caca', 'Front of house', '+62 811-2201-3345', 'Lobby', 'Caca', true, 'No'],
      ['s8', 'Dewi Anggraini', 'Nurse', '+62 811-2201-3352', 'Nurse', 'Ns. Dewi', true, 'No'],
      ['s6', 'Dimas Wibowo', 'Activity teacher', '+62 811-2201-3350', 'Activity teacher', 'Kak Dimas', true, 'No'],
      ['s5', 'Dinar', 'Activity teacher', '+62 811-2201-3349', 'Activity teacher', 'Dinar', true, 'No'],
      ['s9', 'Ega', 'Club manager', '+62 811-2201-3353', 'Management', 'Ega', true, 'Yes'],
      ['s10', 'Fransiska Tan', 'Finance (AR)', '+62 811-2201-3354', 'Finance', 'Bu Fransiska', true, 'No'],
      ['s7', 'Joko Susilo', 'Driver', '+62 811-2201-3351', 'Driver', 'Pak Joko', false, 'No'],
      ['s4', 'Siti Aminah', 'Housekeeping', '+62 811-2201-3348', 'Housekeeping', 'Bu Siti', false, 'No'],
      ['s2', 'Yohanes Pratama', 'F&B supervisor', '+62 811-2201-3346', 'Kitchen & F&B', 'Pak Yohanes', true, 'Yes'],
    ].map(([id, name, title, phone, roleL, known, access, sup]) => ({ id, name, title, phone, roleL, known, access: st.ppAccess[id] ?? access, sup, ini: name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() }));
    const sel = STAFF.find(p => p.id === st.ppSel) || STAFF[0];
    const PT = ['Profile', 'Contract and KTP', 'Salary and bank', 'Notes and ratings', 'Attendance'];
    const rowsFor = st.ppTab === 'Profile'
      ? [['Role', sel.roleL], ['Mobile (WhatsApp)', sel.phone], ['App access', sel.access ? 'Yes' : 'No'], ['Clubhouse', 'CitraPremier'], ['Known as', sel.known], ['Supervisor', sel.sup]]
      : [[st.ppTab, 'Nothing recorded yet']];
    const pp = {
      list: STAFF.map((p, i) => ({ ...p, bt: i ? '1px solid #F0EAE1' : 'none', noAccess: !p.access, bg: p.id === sel.id ? '#FBF8F4' : '#FFFFFF', bar: p.id === sel.id ? '#2B231C' : 'transparent', onClick: () => this.setState({ ppSel: p.id, ppTab: 'Profile' }) })),
      sel, tabs: PT.map(label => ({ label, onClick: () => this.setState({ ppTab: label }), ...tabOf(st.ppTab === label) })),
      rows: rowsFor.map(([k, v], i) => ({ k, v, bt: i ? '1px solid #F0EAE1' : 'none' })),
      track: sel.access ? '#3D6B4F' : '#8C857E', knob: sel.access ? 21 : 3, toggle: () => this.setState(s => ({ ppAccess: { ...s.ppAccess, [sel.id]: !sel.access } })),
    };
    // surveys
    const sv = {
      stats: [{ label: 'Overall', value: '4.7 / 5', sub: '3 answers' }, { label: 'Would recommend', value: '100%', sub: 'of families who answered' }, { label: 'Response rate', value: '75%', sub: '3 of 4 families' }],
      team: [['Caca', 'Lobby', 5.0], ['Ns. Dewi', 'Nurse', 5.0], ['Dinar', 'Activity teacher', 5.0], ['Kak Dimas', 'Activity teacher', 4.7], ['Chef Agus', 'Kitchen & F&B', 4.3], ['Pak Joko', 'Driver', 4.3]].map(([name, role, s]) => ({ name, role, score: `${s.toFixed(1)} / 5`, pct: Math.round(s / 5 * 100) })),
      comments: [{ text: 'Please send more photos of the afternoon sessions.', by: 'Yohana Lim · Wed 21 Oct' }, { text: 'Lunch portions could be a little smaller.', by: 'Laras Saputra · Tue 20 Oct' }],
    };
    // plans
    const fmt = (n) => 'Rp ' + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    const num = (s) => parseInt(String(s).replace(/\D/g, ''), 10) || 0;
    const pr = st.plPrice;
    const setP = (k) => (e) => { const v = e.target.value; this.setState(s => ({ plPrice: { ...s.plPrice, [k]: v } })); };
    const PM = [['lw', 'Oma Lina Wijaya', 'flex', 1], ['bw', 'Opa Budi Wijaya', 'gold', 0], ['hg', 'Opa Hendra Gunawan', 'gold', 0], ['tl', 'Opa Tjahjadi Lim', 'gold', 0], ['bp', 'Bapak Bambang Purnomo', 'flex', 0]];
    const pm = PM.find(m => m[0] === st.plMem) || PM[0];
    const lines = [{ k: `${pm[2] === 'flex' ? 'Flex' : 'Gold'} plan · November`, v: fmt(num(pm[2] === 'flex' ? pr.flex : pr.gold)) }];
    if (pm[3]) lines.push({ k: `Extra days · October (${pm[3]})`, v: fmt(num(pr.extra) * pm[3]) });
    const pl = {
      plans: [
        { k: 'flex', name: 'Flex', desc: '10 visits a month. A visit counts when the member checks in.', per: 'Per month', rows: [{ k: 'Visits', v: '10 a month' }, { k: 'Unused visits', v: 'Do not roll over' }] },
        { k: 'gold', name: 'Gold', desc: 'Come on any open day, as often as you like.', per: 'Per month', rows: [{ k: 'Visits', v: 'Unlimited' }, { k: 'Extra day', v: 'None' }] },
        { k: 'extra', name: 'Extra day', desc: 'Charged for each Flex visit beyond 10 in a month.', per: 'Per day', rows: [{ k: 'Billed', v: 'On next month’s invoice' }, { k: 'Counted from', v: 'Check-ins at the door' }] },
      ].map(p => ({ ...p, price: pr[p.k], onPrice: setP(p.k) })),
      members: PM.map(([k, label]) => ({ label, onClick: () => this.setState({ plMem: k }), ...chip(st.plMem === k) })),
      lines, total: fmt(lines.reduce((a, l) => a + num(l.v), 0)),
    };
    const heads = {
      reviews: { eyebrow: 'Front desk', title: 'Reviews' },
      bc: { eyebrow: 'WhatsApp templates', title: 'Broadcast' },
      venue: { eyebrow: 'Outside events', title: 'Venue bookings', hasAction: true, action: isPhone ? 'New' : 'New booking', actionIcon: 'add' },
      hr: { eyebrow: 'Staff records', title: 'People', hasAction: true, action: isPhone ? 'Add' : 'Add staff member', actionIcon: 'person_add' },
      surveys: { eyebrow: 'Families · satisfaction', title: 'Surveys' },
      plans: { eyebrow: 'Club settings', title: 'Plans and pricing' },
    };
    return { rv, bcv, vn, pp, sv, pl, heads };
  }
  batch5Vals(st, isPhone) {
    const tabOf = (on) => ({ bg: on ? '#FFFFFF' : 'transparent', shadow: on ? '0 1px 3px rgba(40,30,20,0.14)' : 'none', weight: on ? 600 : 500 });
    const key = st.key;
    const isHealth = key === 'health';
    const f = isHealth ? st.fhSel : st.fpF;
    const opts = isHealth ? [['lw', 'Oma Lina'], ['bw', 'Opa Budi']] : [['lw', 'Oma Lina'], ['bw', 'Opa Budi'], ['all', 'Both']];
    const setF = (k) => () => this.setState(isHealth ? { fhSel: k } : { fpF: k });
    const fx = { show: st.role === 'family' && ['photos', 'health', 'billing'].includes(key), tabs: opts.map(([k, label]) => ({ label, onClick: setF(k), ...tabOf(f === k) })) };
    const PB = ['#E8E1D8', '#DCCFC0', '#EADFD3', '#D9CDBF', '#F1E7DC'], PD = ['#C9B49C', '#B9A28A', '#CDB9A3', '#BFA88F', '#D4C2AE'];
    const ph = (t, i) => ({ time: t, bg: `radial-gradient(120% 95% at 28% 22%, #FBF6F0 0%, ${PB[i % 5]} 50%, ${PD[i % 5]} 100%)` });
    const G = [['lw', 'Oma Lina', [ph('13:35', 0)]], ['bw', 'Opa Budi', [ph('10:39', 1)]], ['all', 'Group photos with both', [ph('10:46', 2), ph('13:45', 3)]], ['any', 'Other group photos', [ph('11:02', 4)]]];
    const shownG = G.filter(g => f === 'all' || g[0] === f || g[0] === 'any');
    const fp = { groups: shownG.map(([, label, photos]) => ({ label, photos })), count: `${shownG.reduce((a, g) => a + g[2].length, 0)} photos` };
    const HD = {
      lw: { ini: 'LW', tone: 4, name: 'Oma Lina Wijaya', meta: 'Flex member since March 2025 · 81 years · usually arrives around 10:05', m: [['Blood pressure', '124/76', 'mmHg', 'Tue 20 Oct · 15:54'], ['Pulse', '71', 'bpm', 'Tue 20 Oct · 15:54'], ['SpO₂', '96', '%', 'Tue 20 Oct · 10:12'], ['Temp', '36.6', '°C', 'Tue 20 Oct · 10:12'], ['Glucose', '108', 'mg/dL', 'Wed 23 Sept · 10:22'], ['Weight', '54.3', 'kg', 'Wed 23 Sept · 10:22', true], ['Grip', '17', 'kg', 'Wed 23 Sept · 10:22', true]] },
      bw: { ini: 'BW', tone: 1, name: 'Opa Budi Wijaya', meta: 'Gold member · 84 years · usually arrives around 10:05', m: [['Blood pressure', '132/83', 'mmHg', 'Tue 20 Oct · 15:50'], ['Pulse', '74', 'bpm', 'Tue 20 Oct · 15:50'], ['SpO₂', '96', '%', 'Tue 20 Oct · 10:15'], ['Temp', '36.6', '°C', 'Tue 20 Oct · 10:15'], ['Glucose', '110', 'mg/dL', 'Wed 23 Sept · 10:25'], ['Weight', '66.4', 'kg', 'Wed 23 Sept · 10:25', true]] },
    };
    const h = HD[st.fhSel] || HD.lw;
    const fh = { ...h, avBg: TONES[h.tone][0], avFg: TONES[h.tone][1], metrics: h.m.map(([label, value, unit, when, noS]) => ({ label, value, unit, when, hasS: !noS })), bars: Array.from({ length: 13 }, (_, i) => ({ h: 52 + ((i * 29 + h.ini.charCodeAt(0)) % 22) })) };
    const BL = [
      { k: 'lw', ini: 'LW', tone: 4, name: 'Oma Lina Wijaya', plan: 'Flex · 10 of 10 visits used', amount: 'Rp 5.500.000', n: 5500000, inv: 'INV-2610-001 · due Tue 27 Oct', sept: 'INV-2609-001 · paid Mon 21 Sept' },
      { k: 'bw', ini: 'BW', tone: 1, name: 'Opa Budi Wijaya', plan: 'Gold · come any open day', amount: 'Rp 9.500.000', n: 9500000, inv: 'INV-2610-046 · due Tue 27 Oct', sept: 'INV-2609-046 · paid Mon 21 Sept' },
    ].filter(b => st.fpF === 'all' || st.fpF === b.k);
    const paidTag = ['check_circle', 'Paid', '#E3EFE6', '#2F5A40'], outTag = ['schedule', 'Outstanding', '#F6ECD6', '#7A5510'];
    const open = BL.filter(b => !st.fbPaid[b.k]);
    const total = open.reduce((a, b) => a + b.n, 0);
    const fbl = {
      total: 'Rp ' + String(total).replace(/\B(?=(\d{3})+(?!\d))/g, '.'), openText: open.length ? `${open.length} open` : 'All paid', totalBd: open.length ? '#2B231C' : '#3D6B4F',
      cards: BL.map(b => { const paid = !!st.fbPaid[b.k]; const t = paid ? paidTag : outTag; return { ...b, avBg: TONES[b.tone][0], avFg: TONES[b.tone][1], open: !paid, sIcon: t[0], sText: t[1], sBg: t[2], sFg: t[3], pay: () => this.setState(s => ({ fbPaid: { ...s.fbPaid, [b.k]: true } })) }; }),
      history: BL.flatMap(b => { const paid = !!st.fbPaid[b.k]; const t = paid ? paidTag : outTag; return [
        { title: `October 2026 · ${b.name.split(' ')[1]}`, sub: paid ? b.inv.replace(/due .*/, 'paid just now') : b.inv, amount: b.amount, sIcon: t[0], sText: t[1], sBg: t[2], sFg: t[3] },
        { title: `September 2026 · ${b.name.split(' ')[1]}`, sub: b.sept, amount: b.amount, sIcon: paidTag[0], sText: paidTag[1], sBg: paidTag[2], sFg: paidTag[3] }]; }),
    };
    const who = { lw: 'Oma Lina', bw: 'Opa Budi', all: 'Both parents' }[st.fpF];
    const heads = {
      fphotos: { eyebrow: `${who} · by day`, title: 'Photos' },
      fhealth: { eyebrow: 'Shared by the club nurse', title: 'Health' },
      fbill: { eyebrow: who, title: 'Billing' },
    };
    return { fx, fp, fh, fbl, heads };
  }
  moreVals(st, isPhone, role) {
    const T = (tone) => TONES[tone];
    // members
    const memChips = [['active', 'Active', () => true], ['in', 'In the club', m => st.att[m.id] && !st.gone[m.id]], ['att', 'Needs attention', m => m.attention], ['flex', 'Flex', m => m.flex], ['gold', 'Gold', m => !m.flex], ['ended', 'Ended', () => false]];
    const memFn = (memChips.find(c => c[0] === st.memF) || memChips[0])[2];
    const memRows = MEM.filter(memFn).map((m, i) => {
      const a = st.att[m.id], out = st.gone[m.id];
      const where = a && !out ? `In the club since ${a.at}` : out ? `Went home ${out}` : `Usually arrives around ${m.usual}`;
      return { ...m, avBg: T(m.tone)[0], avFg: T(m.tone)[1], bt: i ? '1px solid #F0EAE1' : 'none', where, dot: a && !out ? '#3D6B4F' : '#CAB8A2',
        hasFlag: !!m.flag, fIcon: m.flag && m.flag[0], flag: m.flag && m.flag[1], fBg: m.flag && m.flag[2], fFg: m.flag && m.flag[3] };
    });
    const mem = { chips: memChips.map(([k, label, fn]) => ({ label, n: MEM.filter(fn).length, onClick: () => this.setState({ memF: k }), ...chip(st.memF === k) })), rows: memRows, empty: !memRows.length };
    // messages
    const famChat = role === 'family';
    const TH = famChat ? { lobby: { name: 'Club lobby', ini: 'CP', about: 'About Oma Lina and Opa Budi', rel: 'Caca · front of house', phone: '+62 811-2201-3345', profile: 'Call the club', time: 'Tue 20 Oct 19:12' } } : THREADS;
    const sel = famChat ? 'lobby' : st.chSel, cur = TH[sel];
    const threads = Object.entries(TH).map(([k, t]) => {
      const msgs = st.chMsgs[k] || [{ text: '' }]; const last = msgs[msgs.length - 1];
      const unread = !st.chRead[k]; const on = k === sel && !isPhone;
      return { ...t, last: last.text, unread, weight: unread ? 600 : 500, bg: on ? '#FBF8F4' : '#FFFFFF', bar: on ? '#2B231C' : 'transparent',
        onClick: () => this.setState(s => ({ chSel: k, chOpen: true, chRead: { ...s.chRead, [k]: true }, chDraft: '' })) };
    });
    const sendText = (text) => { if (!text.trim()) return; this.setState(s => ({ chDraft: '', chMsgs: { ...s.chMsgs, [sel]: [...(s.chMsgs[sel] || []), { me: true, text, meta: `${famChat ? 'You' : USERS[role].name} · just now` }] } })); };
    const ch = {
      threads, cur, showList: !isPhone || !st.chOpen, showThread: !isPhone || st.chOpen, listMax: isPhone ? '100%' : '360px',
      msgs: (st.chMsgs[sel] || []).map(m => ({ text: m.text, meta: m.meta, align: m.me ? 'flex-end' : 'flex-start', bg: m.me ? '#2B231C' : '#F3EEE8', fg: m.me ? '#FFFFFF' : '#24201C' })),
      quick: (famChat ? ['Thank you!', 'Running late today.', 'Please call me.'] : QUICK).map(q => ({ label: q, onClick: () => sendText(q) })),
      draft: st.chDraft, onDraft: (e) => this.setState({ chDraft: e.target.value }), send: () => sendText(st.chDraft),
      sendBg: st.chDraft.trim() ? '#2B231C' : '#E9E3DB', sendFg: st.chDraft.trim() ? '#FFFFFF' : '#5E5852',
      back: () => this.setState({ chOpen: false }),
    };
    // enquiries
    const cols = ENQ.map(c => ({ ...c, n: c.cards.length, empty: !c.cards.length, onPick: () => this.setState({ enqStage: c.k }), ...chip(st.enqStage === c.k),
      cards: c.cards.map(e => ({ ...e, hasTag: !!e.tag, tIcon: e.tag && e.tag[0], tag: e.tag && e.tag[1], tBg: e.tag && e.tag[2], tFg: e.tag && e.tag[3], hasBtn: !!e.btn, onBtn: () => {} })) }));
    const enq = { cols, shown: isPhone ? cols.filter(c => c.k === st.enqStage) : cols, colW: isPhone ? '100%' : '240px' };
    // directory
    const dirChips = [['all', 'All', () => true], ['suppliers', 'Suppliers', d => d.t === 'suppliers'], ['doctors', 'Doctors', d => d.t === 'doctors'], ['services', 'Services', d => d.t === 'services'], ['public', 'Public', d => d.pub], ['internal', 'Internal', d => !d.pub]];
    const famView = role === 'family';
    const dirSrc = famView ? DIR.filter(d => d.pub) : DIR;
    const dfn = (dirChips.find(c => c[0] === st.dirF) || dirChips[0])[2];
    const dir = {
      chips: (famView ? dirChips.slice(0, 4) : dirChips).map(([k, label, fn]) => ({ label, n: dirSrc.filter(fn).length, onClick: () => this.setState({ dirF: k }), ...chip(st.dirF === k) })),
      rows: dirSrc.filter(dfn).map((d, i) => ({ ...d, bt: i ? '1px solid #F0EAE1' : 'none', vis: d.pub ? 'Public' : 'Internal', vIcon: d.pub ? 'public' : 'lock', vBg: d.pub ? '#E3EFE6' : '#F3EEE8', vFg: d.pub ? '#2F5A40' : '#5E4E3B' })),
    };
    // requests
    const addRq = (title, icon) => this.setState(s => ({ rqMine: [{ title, icon, sub: 'Sent just now · waiting for approval' }, ...s.rqMine] }));
    const rq = {
      kinds: [['inventory_2', 'Stock request', 'Supplies for your section'], ['pie_chart', 'Budget request', 'Money for something your section needs'], ['photo_camera', 'Snap a receipt (nota)', 'A photo of the nota, sent to finance']].map(([icon, title, sub]) => ({ icon, title, sub, onClick: () => addRq(title, icon) })),
      mine: st.rqMine, empty: !st.rqMine.length,
    };
    const heads = {
      members: { eyebrow: '5 active members · Wed 21 Oct', title: 'Members', hasAction: true, action: isPhone ? 'Add' : 'Add member', actionIcon: 'person_add' },
      chat: famChat ? { eyebrow: 'Club lobby · WhatsApp', title: 'Messages', hasAction: false } : { eyebrow: 'Families · WhatsApp', title: 'Messages', hasAction: true, action: isPhone ? 'New' : 'New message', actionIcon: 'add_comment' },
      enq: { eyebrow: 'Wednesday 21 October', title: 'Enquiries', hasAction: true, action: isPhone ? 'New' : 'New lead', actionIcon: 'add' },
      dir: { eyebrow: famView ? 'Useful numbers' : 'Contacts', title: famView ? 'Contacts' : 'Directory', hasAction: !famView, action: isPhone ? 'Add' : 'Add a contact', actionIcon: 'add' },
      requests: { eyebrow: 'Ask for what your section needs', title: 'Requests' },
    };
    return { mem, ch, enq, dir, rq, heads };
  }
  go(key) { this.setState({ key, moreOpen: false, demoOpen: false }); }
  signInAs(role) { this.setState({ signedIn: true, role, key: 'today', demoOpen: false, moreOpen: false }); }
  checkIn(id) { this.setState(s => ({ att: { ...s.att, [id]: { at: '09:58', st: 'pending' } }, lastScan: id })); }
  checkOut(id) { this.setState(s => ({ gone: { ...s.gone, [id]: '09:58' } })); }
  nKey(k) {
    this.setState(s => {
      const cur = s.nVals[s.nActive] || '';
      const v = k === 'back' ? cur.slice(0, -1) : (cur + k).slice(0, 5);
      return { nVals: { ...s.nVals, [s.nActive]: v } };
    });
  }
  nSave() {
    this.setState(s => {
      const order = s.nOrder.filter(x => x !== s.nSel);
      return { nOrder: order, nDone: [...s.nDone, s.nSel], nSel: order[0] || null, nVals: {}, nActive: 'sys' };
    });
  }
  nSkip() {
    this.setState(s => {
      const order = [...s.nOrder.filter(x => x !== s.nSel), s.nSel];
      return { nOrder: order, nSel: order[0], nVals: {}, nActive: 'sys' };
    });
  }

  renderVals() {
    const device = this.props.device ?? 'laptop';
    const isPhone = device === 'phone';
    const st = { ...this.initial(), ...this.state };
    const role = st.role;
    const u = USERS[role];
    const groups = NAV[role];
    const all = groups.flatMap(g => g[1]);
    const cur = all.find(x => x.key === st.key) || all[0];
    const scrId = st.key === 'today' ? TODAY[role] : (role === 'family' && FAM_MAP[st.key]) || KEYMAP[st.key] || 'placeholder';
    const scr = {}; SCREENS.forEach(id => { scr[id] = scrId === id; });

    const navItem = (x) => {
      const on = x.key === st.key;
      return { ...x, hasCount: !!x.count, onClick: () => this.go(x.key), h: role === 'mgmt' ? 40 : 44,
        bg: on ? '#F6F1EA' : 'transparent', ink: on ? '#1E1A16' : '#4A4038', fill: on ? 1 : 0, weight: on ? 600 : 400,
        cBg: 'transparent', cFg: '#6E5A43' };
    };
    const navGroups = groups.map(([title, items]) => ({ title, hasTitle: !!title, items: items.map(navItem) }));

    let barKeys;
    if (role === 'mgmt') barKeys = PHONE_MGMT;
    else barKeys = all.length > 5 ? all.slice(0, 4).map(x => x.key) : all.map(x => x.key);
    const hasMore = role === 'mgmt' || all.length > 5;
    const pItem = (x, on, onClick, label) => ({ glyph: x.glyph, label, count: x.count, hasCount: !!x.count, onClick, bg: on ? '#F6F1EA' : 'transparent', icon: on ? '#2B231C' : '#6B6259', fill: on ? 1 : 0, weight: on ? 600 : 400 });
    const pnav = barKeys.map(k => { const x = all.find(i => i.key === k); return pItem(x, k === st.key, () => this.go(k), SHORT[x.label] || x.label); });
    if (hasMore) {
      const rest = all.filter(x => !barKeys.includes(x.key));
      const restCount = rest.reduce((a, x) => a + x.count, 0);
      pnav.push(pItem({ glyph: 'menu', count: restCount }, !barKeys.includes(st.key), () => this.setState({ moreOpen: true }), 'More'));
    }

    // header
    const baseHead = HEADS[scrId] || { eyebrow: 'Wednesday 21 October', title: cur.label };
    const head = { eyebrow: baseHead.eyebrow, title: scrId === 'placeholder' ? cur.label : baseHead.title, glyph: cur.glyph, hasPill: false, showClock: false, maxW: ['family', 'fphotos', 'fbill', 'fhealth'].includes(scrId) ? '600px' : 'none' };
    if (scr.arrivals) Object.assign(head, { eyebrow: isPhone ? 'Wed 21 Oct · 09:58' : 'Wednesday 21 October', hasPill: true, pill: 'Club open until 16:30', pillIcon: 'storefront', pillBg: '#E3EFE6', pillFg: '#2F5A40', pillBd: 'none', showClock: !isPhone });
    if (scr.health) Object.assign(head, { hasPill: true, pill: isPhone ? 'PC-303' : 'LEPU PC-303 · connected', pillIcon: 'bluetooth_connected', pillBg: '#FFFFFF', pillFg: '#24201C', pillBd: '1px solid #DCD3C8', showClock: !isPhone });

    // arrivals
    const notIn = MEMBERS.filter(m => !st.att[m.id]);
    const inClub = MEMBERS.filter(m => st.att[m.id] && !st.gone[m.id]);
    const src = st.mode === 'in' ? notIn : inClub;
    const lbRows = src.map(m => {
      const [avBg, avFg] = TONES[m.tone];
      const a = st.att[m.id];
      const b = a ? STATUS[a.st] : null;
      const base = a ? `Arrived ${a.at}` : (isPhone ? `Usually ~${m.usual}` : `Usually arrives around ${m.usual}`);
      return { ini: m.ini, avBg, avFg, name: m.name, sub: m.care ? `${base} · ${m.care}` : base, hasAllergy: !!m.allergy, allergy: m.allergy,
        hasBadge: !!b, bIcon: b && b[0], bText: b && b[1], bBg: b && b[2], bFg: b && b[3],
        btn: a ? 'Check out' : 'Check in', btnBg: a ? '#FFFFFF' : '#2B231C', btnFg: a ? '#2B231C' : '#FFFFFF',
        onBtn: () => (a ? this.checkOut(m.id) : this.checkIn(m.id)) };
    });
    const lbTab = (k, label, glyph, count) => { const on = st.mode === k; return { label, glyph, count, onClick: () => this.setState({ mode: k }), bg: on ? '#FFFFFF' : 'transparent', shadow: on ? '0 1px 3px rgba(40,30,20,0.14)' : 'none', weight: on ? 600 : 500, icon: on ? '#3D6B4F' : '#5E5852', countBg: on ? '#EAF1EC' : 'transparent' }; };
    const scanned = st.lastScan && MEMBERS.find(m => m.id === st.lastScan);
    const lb = {
      tabs: [lbTab('in', 'Check in', 'login', notIn.length), lbTab('out', 'Check out', 'logout', inClub.length)],
      rows: lbRows, empty: !lbRows.length, goneCount: MEMBERS.filter(m => st.gone[m.id]).length,
      list: st.mode === 'in' ? { title: 'Check in a member', hint: 'Not recognised at the door? Find them here and tap Check in.', count: notIn.length, empty: 'Everyone is in.' }
        : { title: 'In the club', hint: 'Tap Check out when a member goes home.', count: inClub.length, empty: 'Nobody is in the club right now.' },
      cam: scanned ? { glyph: 'verified', text: `${scanned.name} checked in at 09:58 · family told` } : { glyph: 'face', text: 'Standing by · members are recognised as they come through the door' },
      simulate: () => { const nx = MEMBERS.find(m => !this.state.att[m.id]); if (nx) this.checkIn(nx.id); },
    };

    // health checks
    const hTab = (k, label) => { const on = st.nTab === k; return { label, onClick: () => this.setState({ nTab: k }), bg: on ? '#FFFFFF' : 'transparent', shadow: on ? '0 1px 3px rgba(40,30,20,0.14)' : 'none', weight: on ? 600 : 500 }; };
    const qIds = st.nTab === 'todo' ? st.nOrder : st.nDone;
    const queue = qIds.map(id => {
      const q = NQ[id]; const [avBg, avFg] = TONES[q.tone]; const on = st.nTab === 'todo' && id === st.nSel;
      const b = q.badge && st.nTab === 'todo' ? STATUS[q.badge] : null;
      return { ini: q.ini, avBg, avFg, name: q.name, time: st.nTab === 'todo' ? `${q.at} · ${q.wait}` : q.at, sub: st.nTab === 'todo' ? q.sub : 'Arrival check done', bg: on ? '#FBF8F4' : '#FFFFFF', bar: on ? '#2B231C' : 'transparent',
        hasBadge: !!b, bIcon: b && b[0], bText: q.badgeText, bBg: b && b[2], bFg: b && b[3], onClick: () => st.nTab === 'todo' && this.setState({ nSel: id, nVals: {}, nActive: 'sys' }) };
    });
    const sq = st.nSel && NQ[st.nSel];
    const fld = (k) => ({ label: FIELDS[k][0], unit: FIELDS[k][1], value: st.nVals[k] || '—', bd: st.nActive === k ? '2px solid #75624B' : '1px solid #DCD3C8', onClick: () => this.setState({ nActive: k }) });
    const fill = (keys) => () => this.setState(s => { const v = { ...s.nVals }; keys.forEach(k => { v[k] = NQ[s.nSel].read[k]; }); return { nVals: v }; });
    const missing = [];
    if (!['sys', 'dia', 'pulse'].every(k => st.nVals[k])) missing.push('Blood pressure');
    if (!['spo2', 'temp'].every(k => st.nVals[k])) missing.push('Oxygen and temperature');
    const ready = !missing.length;
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'back'].map(k => ({ label: k === 'back' ? 'backspace' : k, font: k === 'back' ? "'Material Symbols Rounded'" : 'Inter', size: k === 'back' ? 22 : 20, onClick: () => this.nKey(k) }));
    const hc = {
      tabs: [hTab('todo', `To do · ${st.nOrder.length}`), hTab('done', `Done · ${st.nDone.length}`)], queue,
      hasSel: !!sq, noSel: !sq,
      sel: sq ? { ini: sq.ini, avBg: TONES[sq.tone][0], avFg: TONES[sq.tone][1], name: sq.name, meta: sq.meta, care: sq.care, hasNote: !!sq.note, note: sq.note } : {},
      blocks: sq ? [
        { glyph: 'ecg_heart', title: 'Blood pressure', last: sq.lastBp, onRead: fill(['sys', 'dia', 'pulse']), fields: ['sys', 'dia', 'pulse'].map(fld) },
        { glyph: 'air', title: 'Oxygen and temperature', last: sq.lastOx, onRead: fill(['spo2', 'temp']), fields: ['spo2', 'temp'].map(fld) },
      ] : [],
      activeLabel: FIELDS[st.nActive][0], keys,
      needed: ready ? 'All readings in. Save to share with the family.' : `Still needed: ${missing.join(', ')}. Tap Read PC-303 or type the values.`,
      saveBg: ready ? '#2B231C' : '#E9E3DB', saveFg: ready ? '#FFFFFF' : '#5E5852',
      save: () => ready && this.nSave(), skip: () => this.nSkip(),
    };

    // activity
    const act = {
      members: [
        { ini: 'BP', tone: 4, name: 'Bapak Bambang Purnomo', sub: 'Mild memory loss · settled on the last 10 days' },
        { ini: 'HG', tone: 1, name: 'Opa Hendra Gunawan', sub: 'Alert and oriented · unsettled on 1 of the last 10 days' },
        { ini: 'TL', tone: 4, name: 'Opa Tjahjadi Lim', sub: 'Alert and oriented · quiet on 1 of the last 10 days' },
      ].map(m => ({ ...m, avBg: TONES[m.tone][0], avFg: TONES[m.tone][1] })),
      later: [
        { glyph: 'restaurant', title: 'Lunch', sub: 'Dining room', time: '12:00' },
        { glyph: 'palette', title: 'Batik painting', sub: 'Studio · Kak Dimas', time: '13:30' },
        { glyph: 'local_cafe', title: 'Afternoon tea', sub: 'Lounge', time: '15:00' },
      ],
    };

    // kitchen
    const kt = st.kAlt
      ? { count: '0 to sort · 1 done', bd: '#DCD3C8', iconBg: '#E3EFE6', iconFg: '#2F5A40', glyph: 'check', bIcon: 'check_circle', bText: 'Alternative ready', bBg: '#E3EFE6', bFg: '#2F5A40', btn: 'Undo', btnIcon: 'undo', btnBg: '#FFFFFF', btnFg: '#2B231C' }
      : { count: '1 to sort · 0 done', bd: '#E9B8A8', iconBg: '#9A3D24', iconFg: '#FFFFFF', glyph: 'no_food', bIcon: 'warning', bText: 'Needs an alternative', bBg: '#F9E3DB', bFg: '#9A3D24', btn: 'Alternative prepared', btnIcon: 'check', btnBg: '#2B231C', btnFg: '#FFFFFF' };
    kt.toggle = () => this.setState(s => ({ kAlt: !s.kAlt }));
    const rust = ['#F9E3DB', '#9A3D24'], lin = ['#F3EEE8', '#2B231C'];
    kt.diet = [
      ['no_food', 'Seafood allergy', 'Bapak Bambang', rust], ['no_food', 'Shellfish allergy', 'Oma Siu Lan Tjandra (guest)', rust],
      ['restaurant', 'Low salt', 'Opa Hendra', lin], ['restaurant', 'Soft food', 'Opa Tjahjadi', lin], ['water_drop', 'Diabetic · sugar-free tea', 'Opa Tjahjadi', lin],
    ].map(([glyph, title, who, c]) => ({ glyph, title, who, bg: c[0], fg: c[1] }));

    // finance
    const fin = {
      tiles: [
        { label: 'Paid · October', n: '2', amount: 'Rp 15.000.000', fg: '#2F5A40', bar: '#3D6B4F' },
        { label: 'Outstanding · due 27 Oct', n: '3', amount: 'Rp 24.500.000', fg: '#7A5510', bar: '#C9A35A' },
        { label: 'Overdue', n: '1', amount: 'Rp 9.500.000', fg: '#9A3D24', bar: '#AF4B2F' },
        { label: 'Xero pending', n: '0', amount: 'Rp 0', fg: '#5E5852', bar: '#DCD3C8' },
      ],
      groups: [
        { title: 'Overdue', color: '#9A3D24', meta: 'Tap a row for call notes and reminders', rows: [
          { ini: 'TL', tone: 4, name: 'Opa Tjahjadi Lim', sub: 'INV-2609-020 · September 2026 · Yohana Lim · +62 814-2182-3624', amount: 'Rp 9.500.000', b: ['error', '23 days late', '#F9E3DB', '#9A3D24'] }] },
        { title: 'Due on the 27th', color: '#3D6B4F', meta: 'Open: 3 · Rp 24.500.000', rows: [
          { ini: 'BW', tone: 1, name: 'Opa Budi Wijaya', sub: 'INV-2610-046 · October 2026 · Maria Wijaya · +62 812-1090-4471', amount: 'Rp 9.500.000', b: ['schedule', 'Due Tue 27 Oct', '#F6ECD6', '#7A5510'] },
          { ini: 'LW', tone: 4, name: 'Oma Lina Wijaya', sub: 'INV-2610-001 · October 2026 · Maria Wijaya · +62 812-1090-4471', amount: 'Rp 5.500.000', b: ['schedule', 'Due Tue 27 Oct', '#F6ECD6', '#7A5510'] }] },
      ].map(g => ({ ...g, rows: g.rows.map(r => ({ ...r, avBg: TONES[r.tone][0], avFg: TONES[r.tone][1], bIcon: r.b[0], bText: r.b[1], bBg: r.b[2], bFg: r.b[3] })) })),
    };

    // family
    const fTab = (k, label) => { const on = st.fTab === k; return { label, onClick: () => this.setState({ fTab: k }), bg: on ? '#FFFFFF' : 'transparent', shadow: on ? '0 1px 3px rgba(40,30,20,0.14)' : 'none', weight: on ? 600 : 500 }; };
    const famCards = [
      { k: 'lina', ini: 'LW', tone: 4, name: 'Oma Lina Wijaya', plan: 'Flex · 10 of 10 visits used', hasLog: true, pay: 'Pay Rp 5.500.000', amount: 'Rp 5.500.000' },
      { k: 'budi', ini: 'BW', tone: 1, name: 'Opa Budi Wijaya', plan: 'Gold · come any open day', hasLog: false, pay: 'Pay Rp 9.500.000', amount: 'Rp 9.500.000' },
    ].filter(c => st.fTab === 'both' || st.fTab === c.k).map(c => ({ ...c, avBg: TONES[c.tone][0], avFg: TONES[c.tone][1] }));
    const fam = { tabs: [fTab('lina', 'Oma Lina'), fTab('budi', 'Opa Budi'), fTab('both', 'Both')], cards: famCards };

    const goneList = MEMBERS.filter(m => st.gone[m.id]);
    const t3 = (k, label, n) => { const on = st.mode === k; return { n, label, onClick: () => this.setState({ mode: k }), line: on ? '#2B231C' : 'transparent', numColor: on ? '#2B231C' : '#857767', labelColor: on ? '#1E1A16' : '#6B6259', weight: on ? 600 : 400 }; };
    const src3 = st.mode === 'in' ? notIn : st.mode === 'out' ? inClub : goneList;
    const rows3 = src3.map(m => {
      const [avBg, avFg] = TONES[m.tone]; const a = st.att[m.id]; const b = a && st.mode === 'out' ? STATUS[a.st] : null;
      const sub = st.mode === 'in' ? 'Usually around ' + m.usual : st.mode === 'out' ? 'Arrived ' + a.at : a.at + ' – ' + st.gone[m.id];
      const primary = st.mode === 'in';
      return { ini: m.ini, avBg, avFg, name: m.name, sub, hasAllergy: !!m.allergy, allergy: m.allergy, hasStatus: !!b, status: b && b[1], stFg: b && (b[0] === 'check_circle' ? '#3F7A55' : '#8A6216'),
        btn: primary ? 'Check in' : st.mode === 'out' ? 'Check out' : 'Undo', btnBg: primary ? '#2B231C' : 'transparent', btnFg: primary ? '#F7F3EE' : '#2B231C', btnBd: primary ? '#2B231C' : '#D9CCBC',
        onBtn: () => primary ? this.checkIn(m.id) : st.mode === 'out' ? this.checkOut(m.id) : this.setState(s => { const g = { ...s.gone }; delete g[m.id]; return { gone: g }; }) };
    });
    const lb3 = {
      tabs: [t3('in', 'Not in yet', notIn.length), t3('out', 'In the club', inClub.length), t3('gone', 'Gone home', goneList.length)],
      rows: rows3, empty: !rows3.length,
      list: { in: { title: 'Not in yet', empty: 'Everyone is here.' }, out: { title: 'In the club', empty: 'Nobody is in yet.' }, gone: { title: 'Gone home', empty: 'Nobody has gone home yet.' } }[st.mode],
      camText: scanned ? 'Door camera: ' + scanned.name + ' checked in' : 'Door camera standing by · simulate arrival',
      simulate: (e) => { if (e && e.preventDefault) e.preventDefault(); lb.simulate(); },
    };
    const famTabs3 = [['lina', 'Oma Lina'], ['budi', 'Opa Budi'], ['both', 'Both']].map(([k, label]) => ({ label, onClick: () => this.setState({ fTab: k }), line: st.fTab === k ? '#2B231C' : 'transparent', weight: st.fTab === k ? 600 : 400, color: st.fTab === k ? '#1E1A16' : '#6B6259' }));
    const accounts = Object.entries(USERS).map(([r, x]) => ({ ini: x.ini, name: x.name, sub: x.sub || `${x.role} · ${x.lands}`, bg: r === role && st.signedIn ? '#F3EEE8' : 'transparent', onClick: () => this.signInAs(r) }));

    const more = this.moreVals(st, isPhone, role);
    const b2 = this.batch2Vals(st, isPhone);
    const b3 = this.batch3Vals(st, isPhone, role);
    const b4 = this.batch4Vals(st, isPhone);
    const b5 = this.batch5Vals(st, isPhone);
    Object.assign(more, b2, b3, b4, b5, { heads: { ...more.heads, ...b2.heads, ...b3.heads, ...b4.heads, ...b5.heads } });
    if (more.heads[scrId]) Object.assign(head, more.heads[scrId]);
    if (head.hasAction && !head.onAction) head.onAction = () => {};
    return {
      ...more,
      isPhone, isLaptop: !isPhone, showLogin: !st.signedIn, showApp: st.signedIn,
      me: { ...u, hasBell: !!u.bell }, navGroups, pnav, head, scr, lb, lb3, famTabs3, hc, act, kt, fin, fam, accounts,
      moreOpen: st.moreOpen, closeMore: () => this.setState({ moreOpen: false }),
      demoOpen: st.demoOpen, toggleDemo: () => this.setState(s => ({ demoOpen: !s.demoOpen })),
      demoRight: isPhone ? 12 : 24, demoBottom: isPhone ? (st.signedIn ? 96 : 24) : 24, demoPanelBottom: isPhone ? (st.signedIn ? 146 : 74) : 76,
      signOut: () => this.setState({ signedIn: false, demoOpen: false, moreOpen: false }),
      signInDefault: () => this.signInAs('lobby'),
      goChat: () => this.go('chat'), goCamera: () => this.go('camera'), goLog: () => this.go('log'),
    };
  }
}
