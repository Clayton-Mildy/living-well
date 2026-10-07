// enq strings (ID).
import type { Same } from '../ns';
import type { enq as EN } from '../en/enq';

export const enq: Same<typeof EN> = {
  'stage.new': 'Baru', 'stage.visit': 'Kunjungan', 'stage.trial': 'Percobaan terjadwal', 'stage.joined': 'Bergabung', 'stage.lost': 'Batal',
  'next.none': 'Belum ada langkah berikutnya', 'next.callBack': 'Telepon balik', 'next.sendPrices': 'Kirim daftar harga', 'next.visit': 'Kunjungan', 'next.trial': 'Hari percobaan', 'next.followUp': 'Tindak lanjut', 'next.starts': 'Mulai', 'next.custom': 'Langkah berikutnya',
  'lost.price': 'Harga', 'lost.distance': 'Terlalu jauh', 'lost.notReady': 'Belum siap', 'lost.otherPlace': 'Memilih tempat lain', 'lost.health': 'Kebutuhan perawatan terlalu tinggi', 'lost.other': 'Alasan lain',
  src_referral: 'Rekomendasi', src_instagram: 'Instagram', src_website: 'Situs web', src_walkIn: 'Datang langsung', src_other: 'Lainnya',
  rel_daughter: 'Anak perempuan', rel_son: 'Anak laki-laki', rel_daughterInLaw: 'Menantu perempuan', rel_sonInLaw: 'Menantu laki-laki', rel_granddaughter: 'Cucu perempuan', rel_grandson: 'Cucu laki-laki', rel_grandchild: 'Cucu',
  rel_spouse: 'Pasangan', rel_sibling: 'Kakak atau adik', rel_other: 'Lainnya',

  // ----- papan -----
  intro: 'Pindahkan kartu dengan tombolnya, atau seret. Percobaan dipesan paling lambat sehari sebelumnya. Saat bergabung, semua data disalin ke catatan anggota baru.',
  stageLabel: 'Tahap',
  pgColumn: 'Halaman {stage}', pgArchived: 'Halaman calon yang diarsipkan', newLead: 'Calon baru', archivedN: 'Diarsipkan · {n}', archivedTitle: 'Calon yang diarsipkan', restore: 'Pulihkan', restored: '{name} kembali ke papan.', archive: 'Arsipkan', archived: '{name} diarsipkan.',
  nobody: 'Tidak ada orang di tahap ini.', dropHere: 'Letakkan kartu di sini', trialHint: 'Dipesan paling lambat 1 hari sebelumnya', moveTo: 'Pindahkan ke', reschedule: 'Ubah jam {stage}', alreadyMember: '{name} sudah menjadi anggota.',
  moved: '{name} dipindahkan ke {stage}.', reopened: '{name} kembali menjadi calon yang terbuka.',
  bookVisit: 'Jadwalkan kunjungan', bookTrial: 'Jadwalkan percobaan', join: 'Bergabung', openProfile: 'Buka profil', reopen: 'Buka kembali',
  changeTime: 'Ubah jam', changeDay: 'Ubah hari', searchLabel: 'Cari berdasarkan nama', searchPh: 'Nama calon anggota atau narahubung', noMatch: 'Tidak ada calon yang cocok dengan “{q}”.', noMatchShort: 'Tidak cocok', lostAction: 'Batal', editLead: 'Ubah data calon',

  // ----- dialog calon -----
  newEyebrow: 'Calon baru', editEyebrow: 'Ubah data calon', fSenior: 'Untuk siapa?', fSeniorTitle: 'Sapaan', fSeniorName: 'Nama', fContact: 'Siapa yang bertanya?', fContactName: 'Narahubung',
  fRelation: 'Hubungan', fSource: 'Dari mana mereka tahu tentang kami?', fNotes: 'Catatan', addLead: 'Tambah calon', leadCreated: 'Calon ditambahkan: {name}.', leadSaved: 'Data calon tersimpan.',

  // ----- kunjungan dan percobaan -----
  visitTitle: 'Jadwalkan kunjungan', visitChange: 'Ubah kunjungan', trialTitle: 'Jadwalkan hari percobaan', trialChange: 'Ubah hari percobaan',
  visitText: '{contact} menerima rinciannya lewat WhatsApp (demo).',
  trialText: 'Pesan paling lambat sehari sebelumnya. {contact} menerima konfirmasi WhatsApp (demo).',
  pickDay: 'Hari', otherDate: 'Tanggal lain', pickTime: 'Jam', otherTime: 'Jam lain', pickDayTime: 'Pilih hari dan jam', bookVisitFor: 'Jadwalkan kunjungan · {date}, {time}', bookTrialFor: 'Jadwalkan percobaan · {date}', pickADay: 'Pilih hari', trialPass: 'Makan siang dan cek kesehatan sudah termasuk.',
  visitBooked: 'Kunjungan untuk {name} dijadwalkan: {date}, {time}. {contact} sudah menerima rinciannya lewat WhatsApp (demo).', trialBooked: 'Percobaan untuk {name} dijadwalkan: {date}. {contact} sudah menerima rinciannya lewat WhatsApp (demo).',
  foodAllergies: 'Alergi makanan', notKnown: 'Belum diketahui', foodHint: 'Jika belum tahu, dapur diminta mencari tahu sebelum makan siang.',
  mobility: 'Alat bantu jalan', diet: 'Pola makan',

  // ----- bergabung -----
  jn_eyebrow: 'Bergabung sebagai anggota', jn_fromEnquiry: 'Dari data calon', jn_member: 'Anggota', jn_contact: 'Penanggung tagihan', jn_allergies: 'Alergi',
  plan: 'Paket', jn_visits: '{n} kunjungan sebulan', jn_visitsOne: '{n} kunjungan sebulan', start: 'Mulai',
  createMember: 'Buat anggota · {plan}', sendForApproval: 'Kirim ke manajemen · {plan}', joinReviewNote: 'Permintaan Anda diteruskan ke manajemen. Anggota menjadi aktif, dan keluarga bisa masuk, setelah manajemen menyetujui.',
  joined: '{name} kini menjadi anggota, mulai {date}. Akun masuk keluarga dibuat untuk {contact}.', joinSent: '{name} menunggu persetujuan manajemen. Keluarga bisa masuk setelah disetujui.',

  // ----- batal -----
  lostEyebrow: 'Tandai batal', reason: 'Alasan', lostBtn: 'Tandai batal', markedLost: '{name} dipindahkan ke Batal.',

  // ----- galat -----
  'err.tooSoon': 'Percobaan dipesan paling lambat sehari sebelumnya.', 'err.past': 'Hari itu sudah lewat.', 'err.pastTime': 'Jam itu sudah lewat hari ini.', 'err.outing': 'Hari itu jalan-jalan, jadi tidak ada orang di klub.',
  'err.hours': 'Pilih jam saat klub buka ({open}–{close}).', 'err.alreadyMember': 'Calon ini sudah menjadi anggota.', 'err.notOpen': 'Buka kembali calon ini terlebih dahulu.',
  'err.reopenFirst': 'Buka kembali calon ini sebelum memindahkannya.', 'err.notLost': 'Hanya calon yang batal yang bisa dibuka kembali.',

  'err.startPast': 'Tanggal mulai tidak boleh di masa lalu.',

  // ----- catatan kegiatan -----
  'feed.leadAdded': 'Calon baru · {name}', 'feed.moved_new': '{name} dikembalikan ke Baru', 'feed.moved_visit': '{name} dipindahkan ke Kunjungan', 'feed.moved_trial': '{name} dipindahkan ke Percobaan terjadwal',
  'feed.visitBooked': 'Kunjungan dijadwalkan · {name} · {date} {time}', 'feed.trialBooked': 'Percobaan dijadwalkan · {name} · {date}', 'feed.lost': '{name} ditandai batal', 'feed.reopened': '{name} dibuka kembali',
  'feed.archived': '{name} diarsipkan',
  'feed.joined': '{name} bergabung sebagai anggota ({plan}), mulai {date}',
  'feed.joinPending': '{name} ditambahkan dari data calon dan menunggu persetujuan manajemen', 'feed.joinRejected': 'Pendaftaran {name} tidak disetujui; calon kembali ke papan',

  // ----- notifikasi -----
  'notif.newLead': 'Calon baru: {name}', 'notif.welcome': 'Selamat datang di CitraPremier! {name} mulai pada {date}.', 'notif.trialLunch': 'Makan siang percobaan pada {date}: {name}.',
  'notif.trialLunchAllergy': 'Makan siang percobaan pada {date}: {name}. Ada alergi makanan: periksa rencananya.',
  'notif.trialLunchUnknown': 'Makan siang percobaan pada {date}: {name}. Alergi makanan belum diketahui: tanyakan ke keluarga.', 'notif.trialHealth': 'Tamu percobaan pada {date}: {name}. Perlu pemeriksaan saat datang.',
  regAttached: 'Formulir pendaftaran terlampir', regMissing: 'Formulir pendaftaran belum ada', 'err.formRequired': 'Lampirkan formulir pendaftaran bertanda tangan untuk bergabung.',
  jn_paperNote: 'Ketik data pokok dari formulir kertas. Lampirkan foto atau PDF formulir bertanda tangan untuk bergabung.',
};
