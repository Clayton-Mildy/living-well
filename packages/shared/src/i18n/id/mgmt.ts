// mgmt strings (ID).
import type { Same } from '../ns';
import type { mgmt as EN } from '../en/mgmt';

export const mgmt: Same<typeof EN> = {
  // ----- ringkasan -----
  tileInClubNow: 'Di klub sekarang', tileGoneHome: 'Sudah pulang', tileVisits: 'Kunjungan hari ini', tileExtra: 'Kunjungan tambahan bulan ini', tileReview: 'Perlu ditinjau', toWatch: '{n} perlu dipantau', allNormal: 'Semua normal', tileOverdue: 'Tagihan terlambat', tileSurvey: 'Survei · keseluruhan', noAnswers: 'Belum ada jawaban', nAnswers: '{n} jawaban', nAnswersOne: '{n} jawaban',
  tilePhotos: 'Foto terkirim hari ini', tileLogs: 'Catatan harian tersimpan', tileLunch: 'Foto makan siang', posted: 'Sudah diposting', notYet: 'Belum', tilePayments: 'Pembayaran hari ini', tileUnread: 'Pesan belum dibaca',
  tileStock: 'Stok menunggu persetujuan', tileVenue: 'Pemesanan venue mendatang', sample: 'Contoh', priceSet: 'Sudah diatur', samplePrices: 'Harga contoh', clubPrices: 'Harga klub',
  emptyClub: '{club} belum punya anggota atau staf.',
  listLive: 'Terjadi hari ini', newestFirst: 'terbaru di atas', liveEmptyMeta: 'kegiatan muncul di sini saat terjadi', liveEmpty: 'Belum ada kegiatan hari ini.', whoSystem: 'Otomatis', whoDoor: 'Kamera pintu',
  listUp: 'Segera hadir', upEmpty: 'Belum ada rencana.', upVenue: 'Acara pribadi: {org}', upTrial: 'Hari percobaan: {name}', upVisit: 'Kunjungan: {name}',
  listReq: 'Permintaan dari keluarga', noApproval: 'tidak perlu persetujuan', reqEmpty: 'Belum ada permintaan dari keluarga.',
  reqUpgrade: 'Ganti ke {to} mulai {date}', plan_flex: 'Flex', plan_gold: 'Gold', enqEmpty: 'Tidak ada calon anggota yang terbuka.',

  // ----- siaran -----
  bcEyebrow: 'Templat WhatsApp', audience: 'Penerima', aud_families: 'Keluarga', aud_enquiries: 'Calon anggota', aud_staff: 'Staf', noRecipients: 'Belum ada yang bisa dikirimi pesan pada pilihan ini.',
  template: 'Templat', editTemplates: 'Ubah templat', message: 'Pesan', ph_update: 'Ruang taman baru kami dibuka hari Senin.', ph_closure: 'Jumat 30 Oktober, untuk pelatihan P3K staf',
  ph_event: 'jalan-jalan ke museum batik, Kamis 26 November', ph_custom: 'Tulis pesan Anda.', when: 'Kapan', whenNow: 'Kirim sekarang', whenTom: 'Besok, 08:00', whenCustom: 'Pilih tanggal dan jam',
  sendTo: 'Kirim ke {n} orang', scheduleFor: 'Jadwalkan untuk {n} orang', sendToOne: 'Kirim ke {n} orang', scheduleForOne: 'Jadwalkan untuk {n} orang', stopEditing: 'Berhenti mengubah', bcEditing: 'Anda sedang mengubah pesan terjadwal. Simpan agar perubahan berlaku.',
  previewFor: 'Pratinjau untuk {name} · templat “{tpl}”', previewNobody: 'Pratinjau muncul bila ada orang di antara penerima.', previewPick: 'Pratinjau sebagai', openApp: 'Buka aplikasi CitraPremier',
  simNote: 'Demo: pesan WhatsApp hanya simulasi.', sentAndScheduled: 'Terkirim dan terjadwal', bcEmpty: 'Belum ada siaran.', nPeople: '{n} orang', nPeopleOne: '{n} orang', scheduledFor: 'Terjadwal · {when}', sentOn: 'Terkirim {when}',
  wasFor: 'Dibatalkan · semula {when}', st_sent: 'Terkirim', st_scheduled: 'Terjadwal', st_cancelled: 'Dibatalkan', cancelSend: 'Batalkan kiriman',
  bcSentToast: 'Terkirim ke {n} orang lewat WhatsApp (demo).', bcSentToastOne: 'Terkirim ke {n} orang lewat WhatsApp (demo).', bcScheduledToast: 'Dijadwalkan untuk {when}.', bcCancelled: 'Pesan terjadwal dibatalkan.', bcUpdated: 'Pesan terjadwal diperbarui.',
  tplTitle_update: 'Kabar klub', tplTitle_closure: 'Klub tutup', tplTitle_event: 'Undangan acara', tplTitle_custom: 'Pesan',
  tplText_update: 'Halo {name}, kabar dari CitraPremier: {msg}', tplText_closure: 'Halo {name}, pengingat bahwa CitraPremier tutup pada {msg}. Kami buka lagi di hari kerja berikutnya pukul 08:30.',
  tplText_event: 'Halo {name}, Anda diundang: {msg}. Balas YA untuk menyimpan tempat.',
  tplName: 'Nama templat', tplBody: 'Isi pesan', tplHint: 'Gunakan {name} untuk nama depan penerima dan {msg} untuk teks yang Anda ketik setiap kali.', tplNew: 'Templat baru', tplNewText: 'Halo {name}, {msg}',
  tplSaved: 'Templat tersimpan.', tplRemoved: 'Templat dihapus.', tplConfirmRemove: 'Hapus templat',

  // ----- venue -----
  vnEyebrow: 'Acara luar', vnTitle: 'Pemesanan venue', vnNew: 'Pemesanan baru', vnBooking: 'Pemesanan', vnOrg: 'Organisasi', vnOrgPh: 'mis. rapat tahunan PT Sentosa', vnContact: 'Narahubung',
  vnMobile: 'Nomor ponsel', vnGuests: 'Tamu', vnDay: 'Hari', vnTime: 'Jam', vnFrom: 'Dari', vnTo: 'Sampai', vnRoom: 'Ruangan', vnPriceL: 'Harga', vnDepositL: 'Uang muka', vnOptional: 'Opsional',
  vnDayOpen: 'Klub buka pada hari ini. Acara luar harus sebelum {open} atau sesudah {close}.', vnDayWeekend: 'Akhir pekan: klub tutup, jadi jam berapa pun kosong.',
  vnDayHoliday: 'Hari libur nasional: klub tutup, jadi jam berapa pun kosong.', vnDayClosed: 'Klub tutup pada hari ini karena urusan sendiri, jadi tidak bisa menerima pemesanan.',
  vnDayOuting: 'Hari jalan-jalan: tim dan anggota sedang pergi, jadi tidak bisa menerima pemesanan.', vnPickDay: 'Pilih hari', vnFree: 'Kosong', vnTaken: 'Terpakai', vnMembersHere: 'Ada anggota',
  vnOutingDay: 'Hari jalan-jalan', vnClosedDay: 'Klub tutup', vnGone: 'Sudah lewat', vnNotFree: 'Tidak kosong', vnNoRooms: 'Belum ada ruangan yang bisa dipesan untuk acara. Ruangan acara diatur di Kalender dan jadwal.',
  vnHint: 'Pemesanan memblokir kalender klub pada jam itu. Pada hari klub buka, acara luar berlangsung setelah {close}.', vnConfirm: 'Konfirmasi pemesanan',
  vnBooked: 'Dipesan. {date}, {time} kini terblokir di kalender klub.', vnUpcoming: 'Mendatang', vnOnCalendar: 'di kalender klub', vnNone: 'Belum ada pemesanan mendatang.', vnPast: 'Lalu dan dibatalkan',
  vnPastMeta: 'kirim tautan ulasan ke tamu setelah acara', vnSub: '{date} · {from}–{to} · {n} tamu · {room}', vnPrice: 'Harga {n}', vnDeposit: 'Uang muka {n}', vnInvoice: 'Faktur {ref}',
  vnConfirmed: 'Terkonfirmasi · di kalender', vnDone: 'Acara selesai', vnAsked: 'Tautan ulasan terkirim', vnReviewed: 'Diulas {n}/5', vnCancel: 'Batalkan pemesanan', vnCancelTitle: 'Batalkan pemesanan ini?',
  vnCancelText: '{org} pada {date}. Ruangan dan jamnya kosong kembali.', vnKeep: 'Pertahankan', vnCancelled: 'Pemesanan dibatalkan. Jamnya kosong kembali.', vnCreateInvoice: 'Buat faktur',
  vnInvoiced: 'Faktur {ref} dibuat (demo) dan dikirim ke keuangan.', vnSendReview: 'Kirim tautan ulasan', vnAskedToast: 'Tautan ulasan dikirim ke {name} lewat WhatsApp (demo).', vnRecordReview: 'Catat ulasan',
  vnStars: 'Penilaian', vnStarsOf: '{n} dari 5', vnReviewText: 'Kata mereka', vnReviewSaved: 'Ulasan dicatat.', vnNoText: 'Tanpa komentar', vnUpdated: 'Pemesanan diperbarui.',

  // ----- survei -----
  svEyebrow: 'Keluarga · kepuasan', svLiveSent: 'Berjalan · dikirim {date}', svRespOf: '{n} dari {total} keluarga', svRespOfOne: '{n} dari {total} keluarga', svOverall: 'Keseluruhan', svAnswers: '{n} jawaban', svAnswersOne: '{n} jawaban', svRecommend: 'Akan merekomendasikan',
  svOfAnswered: 'dari keluarga yang menjawab', svRate: 'Tingkat respons', svRateSub: '{n} dari {total} keluarga', svRateSubOne: '{n} dari {total} keluarga', svTeamRatings: 'Penilaian tim · tampil di SDM', svRatings: '{n} penilaian', svRatingsOne: '{n} penilaian',
  svNoRatings: 'belum ada penilaian', svComments: 'Komentar', svDetails: 'Lihat rincian', svClose: 'Tutup survei', svClosed: '{title} ditutup.', svNew: 'Survei baru', svEditDraft: 'Ubah draf',
  svTitle: 'Judul', svTitlePh: 'mis. survei bulan November', svQuestions: 'Pertanyaan', svq_overall: 'Kepuasan keseluruhan, 1 sampai 5', svq_team: 'Nilai tim', svq_recommend: 'Apakah Anda akan merekomendasikan kami?',
  svq_comment: 'Adakah yang bisa kami perbaiki?', svTeam: 'Siapa yang dinilai keluarga?', svTeamHint: 'Pilih dari staf. Penilaian tampil di SDM.',
  svHint: 'Keluarga menerimanya lewat WhatsApp dan menjawab di aplikasi. Survei yang berjalan ditutup saat Anda mengirim yang baru.', svNoFamilies: 'Belum ada keluarga yang memakai aplikasi, jadi belum ada yang bisa dikirimi.',
  svSendTo: 'Kirim ke {n} keluarga', svSendToOne: 'Kirim ke {n} keluarga', svSaveDraft: 'Simpan draf', svSent: 'Survei dikirim ke {n} keluarga lewat WhatsApp (demo), dengan tautan ke aplikasi.', svSentOne: 'Survei dikirim ke {n} keluarga lewat WhatsApp (demo), dengan tautan ke aplikasi.', svDraftSaved: 'Draf tersimpan. Ubah sebelum dikirim.',
  svDrafts: 'Draf', svDeleted: 'Draf dihapus.', svEarlier: 'Survei sebelumnya', svPastSub: 'Dikirim {date} · {n} jawaban · {rec}% akan merekomendasikan', svDetailEyebrow: 'Dikirim {date}', svLive: 'Berjalan',
  svClosedBadge: 'Ditutup {date}', svFamilies: 'Keluarga', svAnswered: 'Sudah menjawab', svWaiting: 'Belum',

  // ----- survei: siapa yang menerima -----
  svAudience: 'Siapa yang menerima', svAud_all: 'Semua keluarga yang memakai aplikasi', svAud_members: 'Keluarga dari anggota pilihan', svAud_contacts: 'Orang pilihan',
  svAudHint_all: 'Semua kontak keluarga yang bisa memakai aplikasi.', svAudHint_members: 'Pilih anggotanya. Kontak keluarga mereka yang memakai aplikasi akan menerima survei.',
  svAudHint_contacts: 'Pilih sendiri kontak keluarganya. Hanya yang memakai aplikasi yang bisa dipilih.', svSearchMembers: 'Cari anggota', svSearchContacts: 'Cari kontak keluarga',
  svSelectResults: 'Pilih semua di daftar', svClearPicked: 'Hapus pilihan', svPickedMembers: '{n} anggota dipilih', svPickedMembersOne: '{n} anggota dipilih',
  svPickedContacts: '{n} orang dipilih', svPickedContactsOne: '{n} orang dipilih', svGoesTo: 'Dikirim ke {n} keluarga', svGoesToOne: 'Dikirim ke {n} keluarga',
  svNoneChosen: 'Pilih penerimanya sebelum mengirim.', svNoMatch: 'Tidak ada yang cocok dengan pencarian Anda.', svFamiliesN: '{n} keluarga', svFamiliesNOne: '{n} keluarga',
  svMembersN: '{n} anggota', svMembersNOne: '{n} anggota', svPeopleN: '{n} orang', svPeopleNOne: '{n} orang', svAudSum_all: 'Semua keluarga yang memakai aplikasi',
  svAudSum_members: 'Keluarga dari {members}', svAudSum_contacts: '{people} dipilih', svSentTo: 'Dikirim ke', svMemberFamily: 'Keluarga: {names}', svNoContactsApp: 'belum ada keluarga yang memakai aplikasi',

  // ----- survei: pertanyaan sendiri -----
  svCustom: 'Pertanyaan Anda sendiri', svCustomHint: 'Keluarga melihat teks persis seperti yang Anda tulis. Anda bisa mengubah, mengurutkan ulang, atau menghapus pertanyaan sampai survei dikirim.', svCustomNone: 'Belum ada pertanyaan sendiri.',
  svAddQ: 'Tambah pertanyaan', svNewQ: 'Pertanyaan baru', svEditQ: 'Ubah pertanyaan', svQText: 'Pertanyaan', svQTextPh: 'mis. Apakah Anda suka menu Kamis yang baru?',
  svQKind: 'Jenis jawaban', svQKind_rating: 'Bintang, 1 sampai 5', svQKind_yesno: 'Ya atau tidak', svQKind_choice: 'Pilih satu', svQKind_text: 'Teks bebas',
  svQKindHint_rating: 'Keluarga mengetuk 1 sampai 5 bintang.', svQKindHint_yesno: 'Keluarga menjawab Ya atau Tidak.', svQKindHint_choice: 'Keluarga memilih satu dari pilihan yang Anda tulis.', svQKindHint_text: 'Keluarga menulis jawabannya sendiri.',
  svQOptions: 'Pilihan', svQOptionsPh: 'Satu pilihan di setiap baris', svQOptionsHint: 'Satu pilihan per baris, 2 sampai 8 pilihan yang berbeda.', svQOptionsN: '{n} pilihan', svQOptionsNOne: '{n} pilihan',
  svQRequired: 'Keluarga wajib menjawab', svQRequiredSub: 'Survei tidak bisa dikirim tanpa jawaban ini.', svQAdd: 'Tambah pertanyaan', svQSave: 'Simpan pertanyaan',
  svQUp: 'Naikkan', svQDown: 'Turunkan', svQRemove: 'Hapus pertanyaan', svQEdit: 'Ubah pertanyaan', svQReqTag: 'Wajib', svQOptTag: 'Opsional',
  svCustomCount: '{n} pertanyaan sendiri', svCustomCountOne: '{n} pertanyaan sendiri', svQLimit: 'Maksimal {n} pertanyaan.',
  svCustomResults: 'Pertanyaan Anda', svResNone: 'Belum ada jawaban', pgTextAnswers: 'Halaman jawaban',
  svPastSubOne: 'Dikirim {date} · {n} jawaban · {rec}% akan merekomendasikan', svPastPlain: 'Dikirim {date} · {n} jawaban', svPastPlainOne: 'Dikirim {date} · {n} jawaban',

  // ----- paket dan harga -----
  plEyebrow: 'Pengaturan klub', plIntro: 'Harga berlabel Contoh hanyalah sementara sampai klub mengonfirmasinya. Mengubah harga memperbarui tagihan berikutnya; tagihan yang sudah dikirim tetap pada nominalnya.',
  samplePrice: 'Harga contoh', plFlexDesc: '{n} kunjungan sebulan. Kunjungan dihitung saat anggota check-in.', plFlexDescOne: '{n} kunjungan sebulan. Kunjungan dihitung saat anggota check-in.', plGoldDesc: 'Datang di hari buka mana pun, sesering yang diinginkan.', plExtra: 'Hari tambahan', plExtraDesc: 'Dikenakan untuk setiap kunjungan Flex lebih dari {n} dalam sebulan.', plExtraDescOne: 'Dikenakan untuk setiap kunjungan Flex lebih dari {n} dalam sebulan.',
  perMonth: 'Per bulan', perDay: 'Per hari', plQuota: 'Kunjungan', plQuotaV: '{n} kunjungan sebulan', plQuotaVOne: '{n} kunjungan sebulan', plUnused: 'Kunjungan tidak terpakai', plNoRoll: 'Tidak dibawa ke bulan berikutnya',
  plUnlimited: 'Tanpa batas', plBilled: 'Ditagih', plNextInvoice: 'Di tagihan bulan depan', plCounted: 'Dihitung dari', plCheckIns: 'Check-in di pintu', priceAria: 'Harga {name} dalam rupiah',
  plRules: 'Aturan klub', plRulesDesc: 'Anggota datang di hari buka mana pun. Aturan ini menentukan kapan kunjungan Flex menjadi hari tambahan.', plQuotaL: 'Kunjungan Flex per bulan', plFrom: 'Berlaku mulai',
  plFromHint: 'Tagihan yang sudah dikirim tetap pada nominal lamanya.', plPreview: 'Pratinjau tagihan berikutnya', plPreviewFor: 'Pratinjau untuk', plPreviewTitle: '{name} · tagihan tanggal {day} {month}',
  plUnsaved: 'Menampilkan yang Anda ketik. Belum disimpan.', plNothing: 'Belum ada yang ditagihkan untuk anggota ini.', plTotal: 'Total', plOthers: 'Tagihan terpisah di akun yang sama: {others}. {payer} dapat membayarnya sekaligus.',
  plSentKeep: 'Tagihan yang sudah dikirim tetap pada nominal lamanya.', plNoMembers: 'Belum ada anggota, jadi belum ada yang bisa dipratinjau.', plansSaved: 'Tersimpan. Tagihan berikutnya memakai harga dan aturan ini.',
  pgBroadcasts: 'Halaman siaran', pgTemplates: 'Halaman templat', pgUpcoming: 'Halaman pemesanan mendatang', pgPast: 'Halaman pemesanan lalu', pgDrafts: 'Halaman draf survei',
  pgSurveys: 'Halaman survei sebelumnya', pgComments: 'Halaman komentar', pgFamilies: 'Halaman keluarga', pgPick: 'Halaman hasil pencarian',
  notifyTeam: 'Beri tahu tim', notifyTeamSub: 'Tim keuangan menerima pemberitahuan tentang harga baru.',

  // ----- galat -----
  'err.venueClash': '{room} sudah dipesan pukul {from}–{to} oleh {org}.', 'err.venueClubHours': 'Klub buka pukul {open}–{close} pada hari itu. Acara harus sebelum {open} atau sesudah {close}.',
  'err.venueOuting': 'Hari itu jalan-jalan, jadi klub tidak bisa menerima pemesanan.', 'err.venueClosed': 'Klub tutup pada hari itu karena urusan sendiri, jadi tidak bisa menerima pemesanan.',
  'err.venuePast': 'Jam itu sudah lewat.', 'err.venueTimes': 'Jam selesai harus setelah jam mulai.', 'err.venueLate': 'Acara harus berlangsung antara pukul {from} dan {to}.',
  'err.venueRoom': 'Pilih ruangan yang bisa dipesan untuk acara.', 'err.venueCancelled': 'Pemesanan itu sudah dibatalkan.', 'err.venueDone': 'Acara itu sudah berlangsung.',
  'err.venueNotDone': 'Acaranya belum berlangsung.', 'err.venueReviewed': 'Acara ini sudah punya ulasan.', 'err.venueAsked': 'Tautan ulasan sudah dikirim.',
  'err.venuePrice': 'Isi harga terlebih dahulu.', 'err.venueInvoiced': 'Pemesanan ini sudah punya faktur.', 'err.noRecipients': 'Tidak ada penerima.', 'err.pastTime': 'Pilih waktu setelah sekarang.',
  'err.notScheduled': 'Pesan ini sudah terkirim atau dibatalkan.', 'err.tplMsg': 'Teks harus memuat {msg} agar pesan Anda masuk.', 'err.tplBuiltIn': 'Templat bawaan boleh diubah tetapi tidak bisa dihapus.',
  'err.teamRequired': 'Pilih setidaknya satu anggota tim untuk dinilai.', 'err.notDraft': 'Hanya survei draf yang bisa diubah.', 'err.notLive': 'Survei ini tidak sedang dibuka.',
  'err.alreadyAnswered': 'Anda sudah menjawab survei ini.', 'err.priceInvalid': 'Isi harga di atas nol.', 'err.pricePast': 'Tanggal mulai tidak boleh di masa lalu.',
  'err.quotaInvalid': 'Gunakan bilangan bulat 1 sampai 23.', 'err.contactNoApp': 'Keluarga ini belum bisa memakai aplikasi, jadi belum bisa menjawab survei.',
  'err.qText': 'Tulis pertanyaannya, maksimal {n} karakter.', 'err.qOptions': 'Tulis 2 sampai 8 pilihan yang berbeda, satu di setiap baris.', 'err.qOptionLong': 'Setiap pilihan maksimal {n} karakter.',
  'err.noQuestions': 'Tambahkan pertanyaan: aktifkan salah satu pertanyaan bawaan atau tulis sendiri.', 'err.answerRequired': 'Mohon jawab: {q}',

  // ----- catatan kegiatan -----
  'feed.broadcast': 'Siaran terkirim ke {n} orang', 'feed.broadcastScheduled': 'Siaran dijadwalkan untuk {n} orang ({date} {time})', 'feed.broadcastCancelled': 'Siaran terjadwal dibatalkan',
  'feed.venueBooked': 'Venue dipesan · {org} · {date}', 'feed.venueUpdated': 'Pemesanan venue diubah · {org} · {date}', 'feed.venueCancelled': 'Pemesanan venue dibatalkan · {org} · {date}',
  'feed.venueReviewAsked': 'Tautan ulasan terkirim · {org}', 'feed.venueReviewed': 'Ulasan venue dicatat · {org} · {stars}/5', 'feed.venueInvoice': 'Faktur venue {ref} · {org}',
  'feed.surveySent': 'Survei dikirim · {title} · {n} keluarga', 'feed.surveyClosed': 'Survei ditutup · {title}', 'feed.surveyAnswered': '{name} menjawab survei · {overall}/5', 'feed.surveyAnsweredPlain': '{name} menjawab survei',
  'feed.prices': 'Harga diperbarui (mulai {date})', 'feed.rules': 'Aturan klub diperbarui: Flex adalah {quota} kunjungan sebulan',

  // ----- notifikasi -----
  'notif.bc_update': 'Kabar klub: {text}', 'notif.bc_closure': 'Klub tutup pada {text}.', 'notif.bc_event': 'Anda diundang: {text}', 'notif.bc_custom': '{text}',
  'notif.broadcastSent': 'Siaran terkirim ke {n} orang.', 'notif.venueInvoice': 'Faktur venue {ref} untuk {org}: {amount}.', 'notif.pricesChanged': 'Harga berubah mulai {date}. Periksa penerbitan tagihan berikutnya.',
};
