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
  form_sent: 'Formulir terkirim', form_opened: 'Formulir dibuka', form_draft: 'Formulir sedang diisi', form_ready: 'Formulir siap ditinjau', form_returned: 'Dikembalikan untuk diperbaiki', form_approved: 'Formulir disetujui',

  // ----- papan -----
  intro: 'Pindahkan kartu dengan tombolnya, atau seret. Percobaan dipesan paling lambat sehari sebelumnya. Saat bergabung, semua data disalin ke catatan anggota baru.',
  stageLabel: 'Tahap',
  pgColumn: 'Halaman {stage}', pgArchived: 'Halaman calon yang diarsipkan', newLead: 'Calon baru', archivedN: 'Diarsipkan · {n}', archivedTitle: 'Calon yang diarsipkan', restore: 'Pulihkan', restored: '{name} kembali ke papan.', archive: 'Arsipkan', archived: '{name} diarsipkan.',
  nobody: 'Tidak ada orang di tahap ini.', dropHere: 'Letakkan kartu di sini', trialHint: 'Dipesan paling lambat 1 hari sebelumnya', moveTo: 'Pindahkan ke', reschedule: 'Ubah jam {stage}', alreadyMember: '{name} sudah menjadi anggota.',
  moved: '{name} dipindahkan ke {stage}.', reopened: '{name} kembali menjadi calon yang terbuka.',
  bookVisit: 'Jadwalkan kunjungan', bookTrial: 'Jadwalkan percobaan', join: 'Bergabung', openProfile: 'Buka profil', reopen: 'Buka kembali', reviewForm: 'Tinjau formulir', viewForm: 'Lihat formulir', sendForm: 'Kirim tautan formulir',
  formLink: 'Tautan formulir', fillAsFamily: 'Isi sebagai keluarga (demo)', changeTime: 'Ubah jam', changeDay: 'Ubah hari', searchLabel: 'Cari berdasarkan nama', searchPh: 'Nama calon anggota atau narahubung', noMatch: 'Tidak ada calon yang cocok dengan “{q}”.', noMatchShort: 'Tidak cocok', lostAction: 'Batal', editLead: 'Ubah data calon',

  // ----- dialog calon -----
  newEyebrow: 'Calon baru', editEyebrow: 'Ubah data calon', fSenior: 'Untuk siapa?', fSeniorTitle: 'Sapaan', fSeniorName: 'Nama', fContact: 'Siapa yang bertanya?', fContactName: 'Narahubung',
  fRelation: 'Hubungan', fSource: 'Dari mana mereka tahu tentang kami?', fNotes: 'Catatan', addLead: 'Tambah calon', leadCreated: 'Calon ditambahkan: {name}.', leadSaved: 'Data calon tersimpan.',

  // ----- kunjungan dan percobaan -----
  visitTitle: 'Jadwalkan kunjungan', visitChange: 'Ubah kunjungan', trialTitle: 'Jadwalkan hari percobaan', trialChange: 'Ubah hari percobaan',
  visitText: 'Pilih hari dan jamnya. {contact} menerima rinciannya lewat WhatsApp (demo).',
  trialText: 'Percobaan adalah tiket sehari dengan makan siang dan cek kesehatan. Pesan paling lambat sehari sebelumnya agar dapur dan perawat bisa bersiap. {contact} menerima konfirmasi WhatsApp berisi hari dan apa yang perlu dibawa (demo).',
  pickDay: 'Hari', otherDate: 'Tanggal lain', pickTime: 'Jam', otherTime: 'Jam lain', pickDayTime: 'Pilih hari dan jam', bookVisitFor: 'Jadwalkan kunjungan · {date}, {time}', bookTrialFor: 'Jadwalkan percobaan · {date}', pickADay: 'Pilih hari', trialPass: 'Makan siang dan cek kesehatan sudah termasuk.',
  visitBooked: 'Kunjungan untuk {name} dijadwalkan: {date}, {time}. {contact} sudah menerima rinciannya lewat WhatsApp (demo).', trialBooked: 'Percobaan untuk {name} dijadwalkan: {date}. {contact} sudah menerima rinciannya lewat WhatsApp (demo).',
  prefilled: 'Data kesehatan diisi dari formulir keluarga.', foodAllergies: 'Alergi makanan', notKnown: 'Belum diketahui', foodHint: 'Jika belum tahu, dapur diminta mencari tahu sebelum makan siang.',
  mobility: 'Alat bantu jalan', diet: 'Pola makan',

  // ----- tinjau formulir -----
  rv_eyebrow: 'Langkah 1 dari 2 · Formulir daring · dikirim {date}', rv_eyebrowDone: 'Formulir daring · disetujui', rv_details: 'Data diri', rv_dob: 'Tanggal lahir', rv_address: 'Alamat', rv_by: 'Diisi oleh',
  rv_docs: 'Dokumen', rv_nannyKtp: 'KTP pengasuh · {name}', rv_noNanny: 'Tanpa pengasuh', rv_healthPhoto: 'Foto info kesehatan', rv_signature: 'Tanda tangan elektronik', rv_missing: 'belum ada', rv_health: 'Kesehatan',
  rv_conditions: 'Kondisi', rv_meds: 'Obat', rv_food: 'Alergi makanan', rv_drugs: 'Alergi obat', rv_mobility: 'Alat bantu jalan', rv_diet: 'Pola makan', rv_consent: 'Persetujuan',
  rv_consentData: 'Penggunaan informasi', rv_consentFace: 'Pengenalan wajah', rv_agreed: 'Setuju', rv_notGiven: 'Tidak diberikan', rv_declined: 'Menolak · resepsionis mencatat kedatangan dengan nama', rv_approveJoin: 'Setujui dan gabungkan',
  rv_return: 'Kembalikan untuk diperbaiki', rv_sendBack: 'Kirim kembali', rv_note: 'Apa yang perlu diubah keluarga?', rv_noteHint: '{name} menerima ini lewat WhatsApp (demo) dan dapat memperbaiki formulir dari tautan yang sama.',
  rv_approvedNote: 'Formulir ini sudah disetujui.', rv_step2: 'Langkah 2 dari 2 · Paket dan hari pertama', rv_backForm: 'Kembali ke formulir',
  rv_joinIntro: 'Menyetujui formulir berarti {name} bergabung sebagai anggota. Pilih paket dan hari pertama. Ini membuat catatan anggota dan akun masuk keluarga {contact}.',
  rv_createBtn: 'Setujui dan buat anggota · {plan}', rv_sendBtn: 'Setujui dan kirim ke manajemen · {plan}', rv_joinedNote: 'Formulir ini sudah disetujui dan menjadi catatan anggota {name}.',
  rv_joinedPending: 'Disetujui. Anggota baru menunggu persetujuan manajemen sebelum keluarga bisa masuk.',
  formReturned: 'Dikembalikan. {name} menerima catatan Anda lewat WhatsApp (demo).',

  // ----- bergabung -----
  jn_eyebrow: 'Bergabung sebagai anggota', jn_fromForm: 'Dari formulir daring', jn_fromEnquiry: 'Dari data calon', jn_member: 'Anggota', jn_contact: 'Penanggung tagihan', jn_allergies: 'Alergi',
  jn_docs: 'Dokumen', jn_nannyKtp: 'KTP pengasuh', jn_healthPhoto: 'foto kesehatan', jn_signedForm: 'formulir bertanda tangan', jn_noRetype: 'Tidak perlu mengetik ulang. Data ini menjadi catatan anggota.',
  jn_noForm: 'Belum ada formulir daring. Catatan dimulai dengan data ini dan dilengkapi saat keluarga mengirim formulir.', plan: 'Paket', jn_visits: '{n} kunjungan sebulan', jn_visitsOne: '{n} kunjungan sebulan', start: 'Mulai',
  createMember: 'Buat anggota · {plan}', sendForApproval: 'Kirim ke manajemen · {plan}', joinReviewNote: 'Permintaan Anda diteruskan ke manajemen. Anggota menjadi aktif, dan keluarga bisa masuk, setelah manajemen menyetujui.',
  joined: '{name} kini menjadi anggota, mulai {date}. Akun masuk keluarga dibuat untuk {contact}.', joinSent: '{name} menunggu persetujuan manajemen. Keluarga bisa masuk setelah disetujui.',

  // ----- batal, tautan -----
  lostEyebrow: 'Tandai batal', reason: 'Alasan', lostBtn: 'Tandai batal', markedLost: '{name} dipindahkan ke Batal.',
  linkEyebrow: 'Tautan formulir keanggotaan', linkSent: 'Tautan dikirim ke {contact} lewat WhatsApp ({phone}) (demo). Salin untuk dibagikan dengan cara lain.', linkLabel: 'Tautan ke formulir', copyLink: 'Salin tautan', copied: 'Tautan disalin.',
  sendWa: 'Kirim lewat WhatsApp (demo)', waSent: 'Terkirim ke {contact} lewat WhatsApp (demo).', linkNote: 'Siapa pun yang punya tautan dapat mengisi formulir. Isiannya tersimpan saat diisi, dalam bahasa Inggris atau Indonesia.',
  formSent: 'Tautan formulir keanggotaan siap untuk {contact}.',

  // ----- galat -----
  'err.tooSoon': 'Percobaan dipesan paling lambat sehari sebelumnya.', 'err.past': 'Hari itu sudah lewat.', 'err.pastTime': 'Jam itu sudah lewat hari ini.', 'err.outing': 'Hari itu jalan-jalan, jadi tidak ada orang di klub.',
  'err.hours': 'Pilih jam saat klub buka ({open}–{close}).', 'err.alreadyMember': 'Calon ini sudah menjadi anggota.', 'err.notOpen': 'Buka kembali calon ini terlebih dahulu.',
  'err.reopenFirst': 'Buka kembali calon ini sebelum memindahkannya.', 'err.notLost': 'Hanya calon yang batal yang bisa dibuka kembali.', 'err.noPhone': 'Narahubung ini tidak punya nomor ponsel.',
  'err.formReady': 'Keluarga sudah mengirim formulir ini. Tinjau saja.', 'err.formApproved': 'Formulir ini sudah disetujui.', 'err.notReady': 'Formulir ini belum siap ditinjau.',
  'err.inReviews': 'Manajemen meninjau dokumen dan persetujuan anggota yang sudah ada di Tinjauan.',
  'err.approveViaJoin': 'Setujui formulir ini dengan menggabungkan anggotanya: pilih paket dan hari pertama.', 'err.startPast': 'Tanggal mulai tidak boleh di masa lalu.',

  // ----- catatan kegiatan -----
  'feed.leadAdded': 'Calon baru · {name}', 'feed.moved_new': '{name} dikembalikan ke Baru', 'feed.moved_visit': '{name} dipindahkan ke Kunjungan', 'feed.moved_trial': '{name} dipindahkan ke Percobaan terjadwal',
  'feed.visitBooked': 'Kunjungan dijadwalkan · {name} · {date} {time}', 'feed.trialBooked': 'Percobaan dijadwalkan · {name} · {date}', 'feed.lost': '{name} ditandai batal', 'feed.reopened': '{name} dibuka kembali',
  'feed.archived': '{name} diarsipkan', 'feed.formSent': 'Tautan formulir keanggotaan terkirim · {name}', 'feed.formSubmitted': 'Formulir keanggotaan siap ditinjau · {name}', 'feed.formApproved': 'Formulir keanggotaan disetujui · {name}',
  'feed.formReturned': 'Formulir keanggotaan dikembalikan untuk diperbaiki · {name}', 'feed.joined': '{name} bergabung sebagai anggota ({plan}), mulai {date}',
  'feed.joinPending': '{name} ditambahkan dari data calon dan menunggu persetujuan manajemen', 'feed.joinRejected': 'Pendaftaran {name} tidak disetujui; calon kembali ke papan',

  // ----- notifikasi -----
  'notif.newLead': 'Calon baru: {name}', 'notif.welcome': 'Selamat datang di CitraPremier! {name} mulai pada {date}.', 'notif.trialLunch': 'Makan siang percobaan pada {date}: {name}.',
  'notif.trialLunchAllergy': 'Makan siang percobaan pada {date}: {name}. Ada alergi makanan: periksa rencananya.',
  'notif.trialLunchUnknown': 'Makan siang percobaan pada {date}: {name}. Alergi makanan belum diketahui: tanyakan ke keluarga.', 'notif.trialHealth': 'Tamu percobaan pada {date}: {name}. Perlu pemeriksaan saat datang.',
};
