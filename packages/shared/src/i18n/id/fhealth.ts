// fhealth strings (ID): family Health, history and the parent profile (round 8).
import type { Same } from '../ns';
import type { fhealth as EN } from '../en/fhealth';

export const fhealth: Same<typeof EN> = {
  // ----- tab Kesehatan -----
  title: 'Kesehatan', heroAria: 'Riwayat tekanan darah {n}', notFound: 'Kami tidak menemukan orang ini.',
  weeksAgo: '{n} minggu lalu', monthsAgo: '{n} bulan lalu',
  bpWhen_arrival: 'Tekanan darah {n} saat tiba', bpWhen_departure: 'Tekanan darah {n} sebelum pulang', bpWhen_recheck: 'Tekanan darah {n} saat pemeriksaan ulang',
  bpWhen_spot: 'Tekanan darah {n} saat pemeriksaan sewaktu-waktu', bpWhen_monthly: 'Tekanan darah {n} saat pemeriksaan bulanan',
  heroWatch: 'Sedikit di luar rentang biasanya.', heroAlert: 'Jauh di luar rentang biasanya.',
  historyRow: 'Riwayat kesehatan', profileRow: 'Profil dan perawatan {n}',
  emptyTitle: 'Belum ada pemeriksaan kesehatan', emptyBody: 'Perawat memeriksa tekanan darah, nadi, dan oksigen saat {n} tiba. Hasilnya muncul di sini setelah pemeriksaan pertama.',
  notMeasured: 'Belum diukur',
  m_bp: 'Tekanan darah', m_pulse: 'Nadi', m_spo2: 'Oksigen', m_temp: 'Suhu', m_glucose: 'Gula darah', m_weight: 'Berat badan', m_grip: 'Genggam',
  recentTitle: 'Hasil terbaru', openFull: 'Buka halaman penuh',
  s_bp: 'TD', s_temp: 'Suhu',

  // ----- riwayat kesehatan -----
  histTitle: 'Riwayat kesehatan', chooseMetric: 'Pengukuran', rangeAria: 'Rentang waktu',
  spanLine: '{a} – {b} · {n} hasil', spanLineOne: '{a} – {b} · 1 hasil', spanLineNone: '{a} – {b} · tidak ada hasil',
  avgUnit: 'rata-rata {u}', listTitle: 'Hasil pada rentang ini', noneInRange: 'Tidak ada hasil pada rentang ini.',
  kind_arrival: 'saat tiba', kind_departure: 'sebelum pulang', kind_recheck: 'periksa ulang', kind_spot: 'pemeriksaan sewaktu-waktu', kind_monthly: 'pemeriksaan bulanan',
  recorded: 'Tercatat', showMore: 'Tampilkan lagi',
  dateRange: 'Rentang tanggal', pickDay: 'Pilih tanggal', hintFrom: 'Ketuk hari pertama.', hintTo: 'Sekarang ketuk hari terakhir.', pickBoth: 'Pilih hari pertama dan terakhir',
  qThisMonth: 'Bulan ini', qLastMonth: 'Bulan lalu', qTwoWeeks: '2 minggu terakhir', qSince: 'Sejak {m}',

  // ----- profil orang tua -----
  'jump.overview': 'Ringkasan', 'jump.health': 'Kesehatan', 'jump.care': 'Perawatan', 'jump.visits': 'Kunjungan', 'jump.plan': 'Paket', 'jump.family': 'Keluarga', 'jump.docs': 'Dokumen', 'jump.notes': 'Catatan',
  jumpAria: 'Loncat ke bagian', edit: 'Ubah', suggest: 'Usulkan perubahan',
  eyebrow: '{p} · sejak {d}', nextInvoice: 'Tagihan berikutnya {d}', visitsGold: '{n} kunjungan sejauh ini, di hari buka mana pun',
  extraLine: '{n} hari tambahan bulan ini · {p} di tagihan bulan depan', extraLineOne: '1 hari tambahan bulan ini · {p} di tagihan bulan depan',
  born: 'Lahir', married: 'Menikah',
  history: 'Riwayat', foodAllergy: 'Alergi makanan', drugAllergy: 'Alergi obat', mobility: 'Mobilitas', diet: 'Diet', noDiet: 'Tanpa diet khusus',
  last10: '10 catatan terakhir', noMood: 'Belum ada catatan suasana hati.',
  visitsIn: 'Kunjungan · {m}',
  tUsed: 'Terpakai', tLeft: 'Sisa', tLeftSub: 'Hari tambahan {p}', tExtra: 'Hari tambahan', tExtraNone: 'Tidak ada bulan ini', tExtraBill: '{p} tagihan berikutnya',
  tVisits: 'Kunjungan', tPlan: 'Paket', tGoldSub: 'Hari buka mana pun', tUsual: 'Biasanya', tArrival: 'Tiba',
  lgVisited: 'Hadir', lgExtra: 'Hari tambahan', lgClosed: 'Tutup',
  perMonth: '{p} per bulan', coupleVal: 'Ditagih bersama {n}', monthly: 'Bulan ke bulan · tagihan berikutnya {d}',
  paysBills: 'membayar tagihan', usesApp: 'memakai aplikasi', noApp: 'belum memakai aplikasi', you: 'Anda', waAria: 'Kirim WhatsApp ke {n}',
  stOnFile: 'Tersimpan', stPaper: 'Salinan kertas tersimpan', stRequested: 'Diminta oleh klub', stWaiting: 'Menunggu klub',
  consents: 'Persetujuan', consentLine: '{n} · {d} · {v}',
  notesTitle: 'Catatan dari tim klub', pinned: 'Disematkan', sharedBy: '{n} · dibagikan {d}',

  // ----- ubah data -----
  editTitle: 'Ubah data', editNote: 'Klub memeriksa perubahan sebelum tampil. Sampai saat itu data yang sekarang tetap berlaku.',
  sentToast: 'Dikirim ke klub untuk disetujui', errEmail: 'Periksa alamat email.',
  pendingTitle: 'Perubahan Anda menunggu klub', pendingFields: 'Perubahan: {f}',
};
