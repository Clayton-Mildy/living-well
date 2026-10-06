// family strings (ID).
import type { Same } from '../ns';
import type { family as EN } from '../en/family';
export const family: Same<typeof EN> = {
  // ----- headings, plan and billing words from the design -----
  goodMorning: 'Selamat pagi, {n}', goodAfternoon: 'Selamat siang, {n}', todayAtClub: 'Hari ini di klub', now: 'SEKARANG', photos: 'Foto', notesTeam: 'Dari tim', used: 'Terpakai', payVA: 'Bayar via virtual account',
  messageClub: 'Kirim pesan ke klub', bank: 'Bank', vaNumber: 'Virtual account', autoConfirm: 'Pembayaran dikonfirmasi otomatis, biasanya dalam beberapa menit. Kuitansi dikirim lewat WhatsApp.',
  simPay: 'Demo: simulasikan pembayaran diterima', invL: 'Tagihan {p}', dueOn: 'Jatuh tempo {d} · virtual account DOKU', paidOn: 'Dibayar {d} · kuitansi terkirim', billingBy: '{n} mengurus tagihan untuk {m}.',
  sharedNote: 'Catatan dari klub: {n}', sPay: 'Bayar via virtual account', paidT: 'Pembayaran diterima. Kuitansi dikirim ke {n} lewat WhatsApp.', copied: 'Nomor virtual account disalin.', mood_cheerful: 'Ceria',
  mood_calm: 'Tenang', mood_quiet: 'Pendiam', mood_agitated: 'Gelisah', lunch_all: 'Makan siang habis', lunch_most: 'Makan siang hampir habis', lunch_half: 'Makan siang setengah', lunch_little: 'Makan sedikit',
  calmDay: '{n} melewati hari yang tenang dan ikut {a}.', sinceL: 'anggota sejak {d}',

  // ----- member switcher, member card, where the member is today (drop-in: at the club since, went home, or not at the club) -----
  switcher: 'Pilih anggota', both: 'Keduanya', everyone: 'Semua', profile: 'Profil', planFlex: 'Flex', planGold: 'Gold', endsOn: 'Keanggotaan berakhir {d}', atSince: 'Di klub sejak {t}', checkedInBy: 'Check-in oleh {s}',
  wentHome: 'Pulang pukul {t}', visitSpan: 'Di klub dari {a} sampai {b}', notToday: 'Tidak ke klub hari ini', notNow: 'Sedang tidak di klub', famUsually: 'Biasanya tiba sekitar {t}', stClosed: 'Klub tutup hari ini', stEnded: 'Keanggotaan berakhir {d}',
  stUpcoming: 'Keanggotaan mulai {d}', endedSub: 'Keanggotaan {n} berakhir pada {d}. Tagihan dan foto tetap bisa dilihat di sini.',

  // ----- today: timeline -----
  tArrived: 'Tiba', tArrivedD: 'Check-in oleh {s}', tHealth: 'Cek kesehatan', tHealthUp: 'Cek kesehatan saat tiba', tHealthUpD: 'Tekanan darah, oksigen dan suhu dengan {n}', tLunch: 'Makan siang', tTea: 'Teh sore',
  tHome: 'Waktu pulang', tHomeD: 'Cek tekanan darah sebelum {s} pulang', tHomeDoneD: 'Check-out oleh {s}', tHomeBp: 'Tekanan darah sebelum pulang {b}', lunchPhoto: 'Foto makan siang dari dapur',
  lunchFeedback: 'Masukan untuk makan siang', tLunchSafe: 'Dapur mencatat alergi {a} {n}; menu hari ini aman.', tLunchAlt: '{d} hari ini tidak aman untuk alergi {a} {n}, jadi dapur menyiapkan {x} sebagai gantinya.',
  theLobby: 'lobi', forMember: 'Untuk {n}', pronS_f: 'ia', pronS_m: 'ia', pronO_f: 'dia', pronO_m: 'dia', tempLine: 'Suhu {t} °C', food_shellfish: 'kerang-kerangan', food_seafood: 'makanan laut', food_fish: 'ikan',
  food_peanuts: 'kacang', food_eggs: 'telur', food_dairy: 'susu', food_gluten: 'gluten', badgeNormal: 'Normal', badgeWatch: 'Sedikit di luar batas biasa · perawat memantau',
  badgeAlert: 'Di luar batas aman · perawat menindaklanjuti',

  // ----- today: both-parents cards -----
  bpArrival: 'Saat tiba · {t}', bpDeparture: 'Sebelum pulang · {t}', oxygen: ' · oksigen {o}%', healthSoon: 'Cek kesehatan sebentar lagi dengan {n}.', noHealthToday: 'Tidak ada cek kesehatan hari ini.', healthOnArrival: 'Perawat mengecek tekanan darah saat tiba.',
  planUsedLine: 'Flex · {n} dari {q} kunjungan terpakai', planGoldLine: 'Gold · datang di hari buka mana saja', payAmount: 'Bayar {a}', plansTitle: 'Paket dan tagihan',
  plansBoth: 'Setiap orang tua punya paket, kunjungan dan tagihan sendiri. Semua tagihan terbuka bisa dibayar sekaligus dari Tagihan.', openBillingBoth: 'Buka tagihan keduanya',

  // ----- today: survey -----
  surveyEyebrow: 'Survei singkat · 1 menit', surveyAsk: 'Ceritakan bagaimana pengalaman Anda dan nilai tim kami. Hanya sekitar satu menit.', surveyThanks: 'Terima kasih. Jawaban Anda sudah sampai ke tim klub.',
  surveyBtn: 'Isi survei', surveyQ1: 'Seberapa puas Anda dengan CitraPremier secara keseluruhan?', surveyTeam: 'Nilai tim', surveyRec: 'Apakah Anda akan merekomendasikan CitraPremier ke teman?', surveyNotYet: 'Belum',
  surveyCmt: 'Apa yang bisa kami tingkatkan?', surveySend: 'Kirim jawaban', starsAria: '{n} dari 5', surveyOverall: 'Keseluruhan', surveyNeed: 'Jawab pertanyaan yang bertanda Wajib untuk mengirim.', surveyPick: 'Pilih satu',

  // ----- photos -----
  soloPhotos: 'Foto {n}', groupWith: 'Foto kelompok bersama {n}', groupWithBoth: 'Foto kelompok bersama keduanya', groupOther: 'Foto kelompok lainnya', photoAria: '{a}, {t}', photoAriaGroup: '{a}, {t}, foto kelompok',
  photoAriaVideo: '{a}, {t}, video', clubPhoto: 'Foto klub', phEyebrow: '{n} · per hari', phEyebrowBoth: 'Kedua orang tua · per hari', phCountOne: '1 foto', phCountN: '{n} foto', phEmpty: 'Belum ada foto.',
  phEmptySub: 'Foto dari hari-hari di klub muncul di sini.', phNote: 'Foto sendiri tampil lebih dulu setiap hari, lalu foto kelompok.',
  phNoteBoth: 'Foto sendiri tampil lebih dulu setiap hari, lalu foto kelompok. Foto yang memuat keduanya hanya tampil sekali.',

  // ----- team log and comments -----
  logCommentPh: 'Komentar untuk tim', logSend: 'Kirim', commentLabel: 'Komentar', commentSent: 'Komentar dikirim ke {n}.', dayLine: '{n} melewati hari yang {m}.', dayLineJoined: '{n} melewati hari yang {m} dan ikut {a}.',
  dayLineSat: '{n} melewati hari yang {m} dan tidak ikut kegiatan.', sharedNoteFor: 'Catatan bersama tentang {m}: {n}', calendarBtn: 'Kalender klub', contactsBtn: 'Kontak penting',

  // ----- plan card: Flex visits this month (counted from check-ins, extra visits billed next month) and Gold -----
  planLabel: 'Paket Flex · {m}', planGoldLabel: 'Paket Gold · {m}', visitsUsed: '{n} dari {q} kunjungan terpakai di {m}', goldTitle: 'Paket Gold · datang di hari buka mana saja',
  goldVisits: 'Kunjungan di {m}: {n}. Tanpa batas dan tanpa biaya tambahan.', visitsExtra: '{n} kunjungan tambahan bulan ini · {p} di tagihan {m}', visitsExtraN: '{n} kunjungan tambahan bulan ini · {p} di tagihan {m}',
  extraDates: 'Tanggal kunjungan tambahan: {d}', extraRule: 'Kunjungan tambahan {p} per kunjungan, ditagih bulan depan di tagihan {m}.',
  planAskGold: 'Minta pindah ke paket Gold', planAskFlex: 'Minta pindah ke paket Flex', planAskTitle: 'Pindahkan {name} ke paket {plan}?',
  planAskBodyGold: 'Gold: datang di hari buka mana pun seharga {p} per bulan, tanpa biaya hari tambahan. Mulai {d} setelah klub mengonfirmasi.',
  planAskBodyFlex: 'Flex: {q} kunjungan per bulan seharga {p}; kunjungan tambahan {x} per kunjungan. Mulai {d} setelah klub mengonfirmasi.',
  planAskSend: 'Kirim permintaan', planAskSent: 'Permintaan terkirim. Klub akan mengonfirmasinya.', planAsked: 'Pindah ke paket {plan} mulai {d} sudah diminta · menunggu konfirmasi klub', planWithdraw: 'Batalkan permintaan', planWithdrawn: 'Permintaan dibatalkan.', endedPlan: 'Keanggotaan sudah berakhir. Paket ditutup.',

  // ----- invoice card and billing -----
  invOpen: 'Tagihan terbuka', invOpenSub: '{n} untuk dibayar · jatuh tempo terlama {d}', invOverdueSub: 'Terlambat sejak {d}', invNone: 'Belum ada tagihan', invNoneSub: 'Tagihan pertama terbit pada tanggal {d} ({date}).',
  invAllPaid: 'Semua lunas', invAllPaidSub: 'Tidak ada yang perlu dibayar saat ini.', partPaid: 'Dibayar sebagian · {a} dari {t}', seeBilling: 'Lihat semua tagihan', viewDetails: 'Rincian', payOne: 'Bayar tagihan ini',
  billEyebrowMulti: 'Satu tagihan per orang tua', billTotal: 'Total yang harus dibayar', billTotalSub: '{n} terbuka · {o} terlambat', billTotalSubOk: '{n} terbuka', payTogether: 'Bayar semuanya sekaligus',
  payTogetherNote: '{list}. Satu transfer melunasi semua tagihan.', comboVa: 'Virtual account gabungan · DOKU', history: 'Riwayat', histDue: '{no} · jatuh tempo {d}', histPaid: '{no} · dibayar {d}',
  payerNote: '{n} mengurus tagihan, jadi tombol pembayaran muncul di ponselnya. Anda tetap bisa melihat semua tagihan di sini.', viewInvoice: 'Buka tagihan {no}', payTotal: 'Total',

  // ----- sheet: lunch feedback -----
  fbTitle: 'Masukan untuk makan siang', fbMember: 'Untuk siapa?', fbDay: 'Hari apa?', fbDish: 'Hidangan yang mana?', fbWhole: 'Seluruh hidangan', fbText: 'Apa yang ingin Anda sampaikan ke dapur?',
  fbPh: 'Ceritakan yang sudah baik atau yang perlu diubah', fbSend: 'Kirim masukan', fbSent: 'Terima kasih. Tim dapur akan membalas di Pesan.',
};
