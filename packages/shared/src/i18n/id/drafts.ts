// drafts strings (ID).
import type { Same } from '../ns';
import type { drafts as EN } from '../en/drafts';
export const drafts: Same<typeof EN> = {
  title: 'Draf', aiSuggested: 'Saran AI', ai: 'AI', check: 'Periksa', blurry: 'Buram?', best: 'Terbaik', linking: 'Menghubungkan…',
  openCamera: 'Buka kamera', more: 'Cara lain', moreManual: 'Foto anggota', moreActivity: 'Foto sesi kegiatan',
  empty: 'Belum ada draf', emptyAll: 'Tidak ada yang menunggu. Buka kamera dan mulai memotret.',
  none: 'Foto lainnya', nShots_one: '1 foto', nShots_other: '{n} foto', sessionChip: 'Sesi · {name}', pickSession: 'Pilih sesi', whoIsThis: 'Siapa ini?',
  unknown_one: '1 wajah belum dikenali', unknown_other: '{n} wajah belum dikenali', lunchPhoto: 'Foto makan siang', teaPhoto: 'Foto teh sore',
  // bar
  select: 'Pilih', selectAll: 'Pilih semua', nSelected: '{n} dipilih', sendAll: 'Kirim semua ({n})', sendAllReview: 'Kirim untuk persetujuan ({n})', sendSel: 'Kirim ({n})', deleteSel: 'Hapus ({n})',
  sentN_one: '1 foto terkirim.', sentN_other: '{n} foto terkirim.', sentReviewN_one: '1 foto dikirim untuk persetujuan.', sentReviewN_other: '{n} foto dikirim untuk persetujuan.',
  notAll_one: '1 perlu dicek lagi dan tetap di Draf.', notAll_other: '{n} perlu dicek lagi dan tetap di Draf.',
  deletedN_one: 'Draf dihapus.', deletedN_other: '{n} draf dihapus.', saved: 'Draf disimpan.',
  // edit sheet
  editTitle: 'Ubah draf', filedAs: 'Disimpan sebagai', kindPeople: 'Orang', kindScene: 'Sesi', kindFood: 'Makanan', session: 'Sesi', noSession: 'Tanpa sesi', day: 'Hari', meal: 'Waktu makan',
  deleteDraft: 'Hapus draf', unnamed_one: '1 wajah yang tidak dikenali AI. Tambahkan lewat nama.', unnamed_other: '{n} wajah yang tidak dikenali AI. Tambahkan lewat nama.',
  aiLine: 'Yakin sekitar {pct}%', preview: 'Pratinjau draf',
  // quick camera
  quick: 'Kamera cepat', quickN: 'Kamera cepat, {n} di Draf', photoMode: 'Foto', videoMode: 'Video', modes: 'Mode kamera', shutter: 'Ambil foto (tahan untuk beruntun)', hint: 'Ketuk untuk satu foto, tahan untuk beruntun', hintVideo: 'Ketuk untuk mulai merekam, ketuk lagi untuk berhenti (maks. 15 dtk)',
  gallery: 'Pilih dari galeri', taken: 'Diambil: {n}', tray: 'Foto yang diambil', uploading: 'Mengunggah', retry: 'Gagal mengunggah. Ketuk untuk coba lagi.', saved1: 'Di Draf',
  doneBtn: 'Selesai', draftsLink: 'Draf', draftsN: 'Draf ({n})', inDrafts_one: '1 foto di Draf', inDrafts_other: '{n} foto di Draf', review: 'Tinjau', burst: 'Beruntun',
  noCamera: 'Tidak ada kamera di sini. Pilih foto dari galeri.',
  // errors
  'err.gone': 'Draf itu sudah dikirim atau dihapus.', 'err.needPeople': 'Tentukan dulu siapa yang ada di foto.', 'err.needSession': 'Pilih sesinya dulu.',
  'err.notToday': 'Foto makan siang dan teh sore hanya bisa dikirim pada hari pengambilannya.',
};
