// health strings (ID).
import type { Same } from '../ns';
import type { health as EN } from '../en/health';
export const health: Same<typeof EN> = {
  healthStation: 'Pos kesehatan', healthChecks: 'Cek kesehatan', arrivalCheck: 'Cek kedatangan', departureCheck: 'Cek pulang', recheckL: 'Cek ulang',
  spotCheck: 'Cek tambahan', bp: 'Tekanan darah', systolic: 'Sis', diastolic: 'Dia', pulse: 'Nadi', spo2: 'Oksigen · SpO₂', glucose: 'Gula darah', weight: 'Berat badan', temp: 'Suhu', grip: 'Genggam',
  takeReading: 'Ukur', measuring: 'Mengukur…', readOxi: 'Baca oksimeter', saveNext: 'Simpan dan lanjut', shareNotes: 'Bagikan catatan ke keluarga', cuff: 'Tensimeter',
  oximeter: 'Oksimeter', connected: 'terhubung', choose: 'Pilih anggota dari daftar',
  last4w: 'Sistolik, 4 minggu terakhir', allNormal: 'Semua hasil dalam batas normal.', alertCall: 'Di atas batas waspada. Biarkan istirahat, cek ulang, dan kabari keluarga.', watchCall: 'Sedikit di luar batas biasa. Sebaiknya dicek ulang hari ini.',
  quickNotes: 'Catatan cepat', keypad: 'Papan angka · {f}', device: 'LEPU PC-303', readDevice: 'Baca PC-303', keypadNote: 'Hasil dari LEPU PC-303 terisi otomatis. Papan angka dipakai jika monitor terputus, dan untuk berat serta genggaman.',
  vitals: 'Oksigen dan suhu', gluMonthly: 'Gula darah', wtGrip: 'Berat dan genggaman',
  lastL: 'Terakhir {v} · {d}', lastToday: 'Hari ini {t} · {v}', fromDevices: 'Baca alat & timbangan',
  readingAt: 'Hasil ukur {t}', savedBy: 'Disimpan {t} oleh {n}', tellFam: 'Kabari {n} sekarang', recheck15: 'Cek ulang {m} menit lagi', saved: 'Tersimpan untuk {n}: {v}, {s}.', famTold: ' {f} sudah dikabari lewat WhatsApp (demo).',
  'note.rested': 'Istirahat 5 menit dulu', 'note.medsTaken': 'Sudah minum obat pagi di rumah', 'note.dizzy': 'Merasa pusing', 'note.headache': 'Sakit kepala', 'note.rightArm': 'Diukur di lengan kanan',
  healthD: 'Tekanan darah {b} · SpO₂ {o}%',

  // the list
  ageSub: '{a} · {p} · tiba {t}', ageSubPlain: '{a} · {p}', inClubN: '{n} di klub', membersN: '{n} anggota', foundN: '{n} ditemukan', posOf: '{i} dari {n}',
  searchL: 'Cari anggota', searchPh: 'Cari nama atau nama keluarga', grpIn: 'Di klub hari ini', grpOther: 'Tidak hadir hari ini', listEmpty: 'Belum ada anggota aktif.', noMatchSub: 'Periksa ejaannya, atau cari dengan nama depan atau nama keluarga.',
  presIn: 'Di klub sejak {t}', presGone: 'Pulang pukul {t}', presNo: 'Belum check-in hari ini', rowSince: 'Tiba {t}', rowLeft: 'Pulang {t}',
  chipArrival: 'Perlu cek kedatangan', chipRecheck: 'Cek ulang pukul {t}', chipDeparture: 'Perlu cek pulang', chipSpot: 'Cek tambahan diminta', chipMonthly: 'Perlu cek gula darah dan berat', chipGlucose: 'Perlu cek gula darah', chipWeight: 'Perlu cek berat badan',
  dueHead: 'Yang perlu dicek untuk {n}', dueClear: 'Hapus', dueClearL: 'Hapus: {c}', dueNowL: 'sekarang', dueLaterL: 'nanti hari ini',
  guestTrial: 'Tamu uji coba', guestVisit: 'Tamu berkunjung', guestSub: '{k} · tiba {t}', monthlyCheck: 'Cek bulanan',
  kArrival: 'Kedatangan', kDeparture: 'Pulang', kRecheck: 'Cek ulang', kSpot: 'Cek tambahan', kMonthly: 'Bulanan',
  todayHead: 'Hasil ukur hari ini · {n}', todayNone: 'Belum ada hasil ukur yang tersimpan hari ini.', cardOpen: '{k} pukul {t}',
  healthRecord: 'Rekam kesehatan', trends: 'Tren',

  // care flags
  allergyUnknown: 'Alergi belum diketahui', lunchMed: '{n} {d} · makan siang', drugAllergy: 'Alergi {d}',
  'food.shellfish': 'Kerang-kerangan', 'food.seafood': 'Makanan laut', 'food.fish': 'Ikan', 'food.peanuts': 'Kacang tanah', 'food.eggs': 'Telur', 'food.dairy': 'Susu dan olahannya', 'food.gluten': 'Gluten',
  'drug.penicillin': 'Penisilin', 'drug.sulfa': 'Sulfa', 'drug.aspirin': 'Aspirin', 'drug.ibuprofen': 'Ibuprofen',
  'mob.walkingStick': 'Tongkat', 'mob.walker': 'Walker', 'mob.wheelchair': 'Kursi roda',
  'diet.softFood': 'Makanan lunak', 'diet.lowSalt': 'Rendah garam', 'diet.vegetarian': 'Vegetarian', 'diet.sugarFree': 'Bebas gula',

  // the form
  byHand: 'Isi manual', optionalTag: 'Opsional', monthlyLater: 'Isi bulanan nanti', monthlyNow: 'Isi sekarang',
  monthlyHead: 'Cek bulanan · opsional', monthlyLaterNote: 'Gula darah dan berat masih harus dicek bulan ini. Keduanya tampil sebagai pengingat di baris anggota.',
  whyMissingShort: 'Masih diperlukan: {g}.', whyRangeShort: 'Periksa angka yang ditandai.', whyMonthlyShort: 'Isi minimal satu angka.',
  whyMeasuring: 'Menunggu hasil PC-303…', whyMissing: 'Masih diperlukan: {g}. Ketuk Baca PC-303 atau ketik angkanya.', whyMonthly: 'Isi minimal satu angka.',
  whyRange: 'Periksa angka yang ditandai: sepertinya terlalu tinggi atau terlalu rendah untuk benar.', rangeHint: 'Antara {lo} dan {hi}', notePh: 'Tambahkan catatan singkat untuk arsip (opsional)',
  noFamily: 'Tidak ada kontak keluarga yang menerima pesan kesehatan untuk {n}.',
  kindL: 'Cek apa?', kindSuggest: 'Disarankan: {k}', kindTaken: '{k} (sudah tersimpan hari ini)', kindNotDue: '{k} (tidak perlu bulan ini)', saveOnly: 'Simpan hasil ukur',
  savedOnlyMonthly: 'Cek bulanan tersimpan untuk {n}.', savedDeferred: ' Gula darah dan berat masih harus dicek bulan ini.', savedRecheck: ' Cek ulang pukul {t}.',

  // hasil ukur hari ini: koreksi atau hapus
  editBtn: 'Ubah hasil ukur', voidBtn: 'Hapus hasil ukur', toldAt: 'Keluarga dikabari pukul {t}: {f}', editedAt: 'Dikoreksi pukul {t} oleh {n} · {r}', editedNoReason: 'Dikoreksi pukul {t} oleh {n}',
  editTitle: 'Ubah hasil ukur', editWhy: 'Mengapa diubah?', editSave: 'Simpan koreksi', editHint: 'Angka lama tetap tercatat dengan nama Anda dan alasannya.', edited: 'Hasil ukur dikoreksi.',
  'er.typo': 'Salah ketik', 'er.deviceError': 'Alat memberi angka yang salah', 'er.remeasured': 'Diukur ulang', 'er.other': 'Lainnya',
  voidTitle: 'Hapus hasil ukur ini?', voidSub: 'Tetap tercatat di jejak audit, tetapi tidak dihitung lagi untuk status, tren, atau peringatan.', voidMonthly: 'Hapus juga gula darah dan berat yang disimpan bersamanya',
  voidFamily: 'Keluarga sudah dikabari soal hasil ukur ini. Koreksinya dikirim lewat WhatsApp (demo).', voidConfirm: 'Hapus hasil ukur', voided: 'Hasil ukur dihapus.',
  'vr.wrongPerson': 'Salah orang', 'vr.deviceError': 'Kesalahan alat', 'vr.duplicate': 'Ganda', 'vr.other': 'Lainnya',

  // hapus pengingat
  dismissTitle: 'Hapus pengingat ini untuk {n}?', dismissSub: 'Alasannya tetap tercatat. Pengingat muncul lagi jika cek ini diminta kembali.', dismissConfirm: 'Hapus pengingat', removed: 'Pengingat untuk {n} dihapus.',
  'dr.declined': 'Menolak dicek', 'dr.notNeeded': 'Tidak perlu hari ini', 'dr.leftEarly': 'Pulang lebih awal', 'dr.other': 'Lainnya',

  // errors
  'err.alreadyTaken': 'Cek ini sudah tersimpan hari ini. Buka hasil ukur hari ini untuk mengoreksinya.', 'err.bpRequired': 'Tekanan darah diperlukan untuk cek ini.', 'err.bpPair': 'Isi kedua angka tekanan darah.',
  'err.diaSys': 'Angka tekanan darah bawah harus lebih kecil dari angka atas.', 'err.needValue': 'Isi minimal satu angka.', 'err.monthlyDone': 'Cek bulanan bulan ini sudah tersimpan.',
  'err.noArrival': 'Lakukan cek kedatangan dulu.', 'err.alreadyQueued': 'Sudah ada di antrean.', 'err.alreadyVoided': 'Hasil ukur ini sudah dihapus.', 'err.reasonRequired': 'Pilih alasannya dulu.',
  'err.notInQueue': 'Pengingat itu sudah tidak berlaku.', 'err.guestKind': 'Cek itu tidak bisa disimpan untuk tamu.',
  'err.range.sys': 'Tekanan sistolik harus antara 50 dan 260 mmHg.', 'err.range.dia': 'Tekanan diastolik harus antara 30 dan 160 mmHg.', 'err.range.pulse': 'Nadi harus antara 25 dan 220 bpm.',
  'err.range.spo2': 'SpO₂ harus antara 50 dan 100 %.', 'err.range.temp': 'Suhu harus antara 30 dan 43 °C.', 'err.range.glucose': 'Gula darah harus antara 20 dan 700 mg/dL.',
  'err.range.weight': 'Berat badan harus antara 20 dan 250 kg.', 'err.range.grip': 'Kekuatan genggam harus antara 1 dan 99 kg.',

  // updates to the family’s bell (the club tells them on WhatsApp; simulated in the demo)
  'notif.fam.normal': '{name}: cek kesehatan pukul {time}, {value}. Semuanya dalam batas normal.',
  'notif.fam.watch': '{name}: cek kesehatan pukul {time}, {value}. Sedikit di luar batas biasa; perawat terus memantaunya.',
  'notif.fam.alert': '{name}: cek kesehatan pukul {time}, {value}. Di atas batas waspada; perawat sedang menanganinya.',
  'notif.fam.void': 'Koreksi: hasil ukur {name} yang dibagikan tercatat keliru.', 'notif.alert': 'Hasil ukur waspada: {name} · {value}', 'notif.guestAlert': 'Hasil ukur waspada untuk {name} (tamu): {value}',
  'feed.normal': '{name} · {value} · Normal', 'feed.watch': '{name} · {value} · Pantau', 'feed.alert': '{name} · {value} · Waspada',
  'feed.normalTold': '{name} · {value} · Normal · keluarga dikabari', 'feed.watchTold': '{name} · {value} · Pantau · keluarga dikabari', 'feed.alertTold': '{name} · {value} · Waspada · keluarga dikabari',
  'feed.edited': 'Hasil ukur {name} dikoreksi', 'feed.voided': 'Hasil ukur {name} dihapus', 'feed.queueAdd': '{name} masuk antrean pos kesehatan', 'feed.dismissed': '{name}: pengingat kesehatan dihapus',

  // readings (trends)
  filterL: 'Filter', readingsEyebrow: 'Pos kesehatan · {n} minggu terakhir', nobodyGroup: 'Tidak ada anggota di kelompok ini.', lastBp: 'Tensi terakhir {v} · {d}', todayL: 'hari ini', noConditions: 'tidak ada penyakit jangka panjang',
  openRecord: 'Buka rekam kesehatan', posList: '{i} dari {n}',
  modeL: 'Tampilan', modeTrends: 'Tren', modeDay: 'Per hari', dayL: 'Hari', dayPrev: 'Hari sebelumnya', dayNext: 'Hari berikutnya', dayToday: 'Hari ini', daySum: 'Hasil ukur: {r} · Orang: {p}', dayEmpty: 'Tidak ada hasil ukur pada {d}.', dayEmptySub: 'Pilih tanggal lain, atau mundur satu hari.',
  histDayL: 'Hari hasil ukur', histEarlier: 'Hari hasil ukur sebelumnya', histLater: 'Hari hasil ukur berikutnya', histLatest: 'Terbaru', histPos: 'Hari hasil ukur {i} dari {n}', histEmpty: 'Tidak ada hasil ukur pada {d}.', histEmptySub: 'Pakai tanda panah untuk loncat ke hari terdekat yang ada hasil ukurnya.', histNone: 'Belum ada hasil ukur.', trendsSearchPh: 'Cari nama atau nama keluarga', cSpo2: 'SpO₂', cTemp: 'Suhu', noReadingsYet: 'Belum ada hasil ukur', history: 'Riwayat',
  lgBp: 'Garis penuh: kedatangan · putus-putus: pulang · area berwarna: batas normal', lgPulse: 'Kedatangan · area berwarna: {lo}–{hi}', lgSpo2: 'Kedatangan · pantau di bawah {w}, waspada di bawah {a}',
  lgTemp: 'Kedatangan · pantau mulai {w}, waspada mulai {a}', lgGlu: 'Sejak {m} · area berwarna: {lo}–{hi}', lgWt: 'Sejak {m} · pantau jika berubah {w} kg',
  // grafik tren (KC putaran 7): arahkan atau ketuk grafik untuk melihat tanggal dan nilainya; rentang waktu yang dilihat
  rangeL: 'Rentang waktu', 'range.1w': '1Mg', 'range.1m': '1B', 'range.3m': '3B', 'range.6m': '6B', 'range.all': 'Semua', 'range.custom': 'Kustom', rangeFrom: 'Dari', rangeTo: 'Sampai',
  readingsIn: '{n} hasil ukur dari {a} sampai {b}', readingsInOne: '1 hasil ukur dari {a} sampai {b}',
  trendOf: 'Tren {n}', latestOn: 'Terbaru: {d}', noInRange: 'Tidak ada hasil ukur di rentang ini',
  waiting: 'Menunggu…', stopWaitingL: 'Berhenti menunggu PC-303 dan ketik sendiri',
  whyWaiting: 'Menunggu hasil PC-303. Ketuk kotak angka untuk mengetik sendiri.', whyWaitingShort: 'Menunggu PC-303. Ketuk kotak untuk mengetik.',
  whyPartial: 'Lengkapi atau kosongkan: {g}.', whyPartialShort: 'Lengkapi atau kosongkan: {g}.',
  whyNone: 'Isi satu pengukuran lengkap, misalnya ketiga angka tekanan darah.', whyNoneShort: 'Isi satu pengukuran lengkap.',
  limitsBtn: 'Batas', limitsTitle: 'Batas Pantau dan Waspada', limitsNote: 'Melewati batas Pantau, hasil ukur ditandai Pantau; melewati batas Waspada, ditandai Waspada. Kosongkan kotak jika tidak dipakai. Hasil ukur yang sudah tersimpan dinilai ulang dengan batas baru.',
  limReset: 'Pakai batas standar', limSaved: 'Batas disimpan. Semua hasil ukur kini memakainya.', limBadOrder: 'Waspada harus melewati Pantau.', limBadRange: 'Antara {lo} dan {hi}.', limOneNeeded: 'Isi Pantau atau Waspada.',
  'limW.from': 'Pantau mulai', 'limA.from': 'Waspada mulai', 'limW.above': 'Pantau di atas', 'limA.above': 'Waspada di atas', 'limW.below': 'Pantau di bawah', 'limA.below': 'Waspada di bawah',
  'lim.sysHigh': 'Tekanan darah, angka atas tinggi', 'lim.diaHigh': 'Tekanan darah, angka bawah tinggi', 'lim.sysLow': 'Tekanan darah, angka atas rendah',
  'lim.pulseHigh': 'Nadi tinggi', 'lim.pulseLow': 'Nadi rendah', 'lim.spo2Low': 'Oksigen (SpO₂) rendah', 'lim.tempHigh': 'Suhu tinggi', 'lim.tempLow': 'Suhu rendah',
  'lim.gluHigh': 'Gula darah tinggi', 'lim.gluLow': 'Gula darah rendah', 'lim.weightChange': 'Perubahan berat sejak bulan lalu',
  'err.limitRange': 'Ada batas di luar rentang yang wajar.', 'err.limitOrder': 'Waspada harus melewati Pantau, dan tiap baris perlu Pantau atau Waspada.', 'feed.limits': '{name} mengubah batas Pantau dan Waspada',
  // batas khusus per anggota (KC putaran 7): catatan di pos, lembar batas anggota, umpan aktivitas
  ownLimits: 'Batas khusus', ownLimitsTip: 'Dinilai dengan batas khusus {n}: {k}.',
  limitsForTitle: 'Batas untuk {n}', limMemberNote: 'Ubah satu baris untuk memberi {n} batas sendiri. Baris yang tidak diubah mengikuti batas klub.', limOwn: 'Khusus', limOwnCount: 'Anggota dengan batas khusus: {n}',
  limResetClub: 'Kembalikan ke batas klub', limSavedMember: 'Batas untuk {n} disimpan. Hasil ukurnya dinilai ulang.', limClearedMember: '{n} kini mengikuti batas klub.',
  'feed.memberLimits': '{name} menetapkan batas Pantau dan Waspada khusus untuk {member}', 'feed.memberLimitsClear': '{name} mengembalikan {member} ke batas klub',
};
