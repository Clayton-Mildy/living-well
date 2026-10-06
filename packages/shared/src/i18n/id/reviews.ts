// reviews strings (ID).
import type { Same } from '../ns';
import type { reviews as EN } from '../en/reviews';
export const reviews: Same<typeof EN> = {
  sub: 'Perubahan data pelanggan oleh staf lain menunggu persetujuan Anda di sini.', tabPending: 'Perlu disetujui', tabApplied: 'Sudah berlaku, tinjau', tabHistory: 'Riwayat',
  appliedSub: 'Perubahan kesehatan ini sudah berlaku. Tandai sudah dilihat setelah Anda memeriksanya, atau batalkan.', waiting: 'Menunggu', appliedChip: 'Sudah berlaku',
  approve: 'Setujui', approveAnyway: 'Tetap setujui', reject: 'Tolak', acknowledge: 'Tandai sudah dilihat', revert: 'Batalkan perubahan', revertAnyway: 'Tetap batalkan',
  approved: 'Disetujui. Pengirim diberi tahu.', approvedCreate: 'Disetujui. Anggota baru sudah aktif.', rejected: 'Ditolak. Pengirim diberi tahu.', acknowledged: 'Sudah ditandai dilihat.', reverted: 'Perubahan dibatalkan. Data sebelumnya kembali.',
  noteFrom: 'Catatan dari {n}', reviewerNote: 'Catatan peninjau', nonePending: 'Tidak ada yang perlu disetujui', nonePendingSub: 'Anggota baru dan perubahan dari staf lain muncul di sini.',
  noneApplied: 'Tidak ada yang perlu ditinjau', noneAppliedSub: 'Perubahan kesehatan oleh perawat dan pengajar muncul di sini setelah berlaku.', noneHistory: 'Belum ada permintaan yang ditangani',
  historySub: 'Permintaan yang sudah ditangani', details: 'Rincian', sentBy: 'dikirim oleh {n}', rejectSub: 'Pengirim akan melihat catatan Anda. Data tidak berubah.', rejectNote: 'Mengapa tidak disetujui?',
  revertSub: 'Data sebelumnya kembali dan pengirim diberi tahu.', revertNote: 'Catatan untuk pengirim (opsional)', was: 'Sebelumnya', proposed: 'Usulan', now: 'Sekarang', removed: 'Dihapus', declined: 'Ditolak',
  'status.pending': 'Menunggu', 'status.approved': 'Disetujui', 'status.rejected': 'Ditolak', 'status.withdrawn': 'Ditarik kembali', 'status.superseded': 'Digantikan permintaan yang lebih baru',
  'status.acknowledged': 'Sudah dilihat', 'status.reverted': 'Dibatalkan',
  'title.members.create': 'Anggota baru', 'title.enquiry.convert': 'Calon bergabung', 'title.members.updateDetails': 'Data diri', 'title.members.setDocuments': 'Dokumen', 'title.members.setConsent': 'Persetujuan', 'title.members.changePlan': 'Perubahan paket',
  'title.planChange.apply': 'Terapkan permintaan paket', 'title.planChange.decline': 'Tolak permintaan paket', 'title.document.upload': 'Dokumen diunggah keluarga', 'title.members.setAllergies': 'Alergi',
  'title.members.setMeds': 'Obat', 'title.members.setCareInstructions': 'Petunjuk perawatan', 'title.members.setHealth': 'Catatan kesehatan', 'title.members.setCognitive': 'Status kognitif',
  'title.family.addContact': 'Kontak keluarga baru', 'title.family.linkContact': 'Hubungkan kontak keluarga', 'title.family.updateContact': 'Data kontak keluarga', 'title.family.unlinkContact': 'Hapus kontak keluarga',
  'title.family.setPrimary': 'Kontak tagihan utama', 'title.family.setAppAccess': 'Akses aplikasi',
  // foto yang menunggu persetujuan
  tabPhotos: 'Foto', photosSub: 'Foto yang diambil tim tetap tersembunyi dari keluarga sampai Anda menyetujuinya.', photosWaitingOne: '1 foto menunggu', photosWaitingN: '{n} foto menunggu',
  selectAll: 'Pilih semua ({n})', clearSelection: 'Batalkan pilihan', selectedN: '{n} dipilih', approvePhotos: 'Setujui ({n})', rejectPhotos: 'Tolak ({n})', noSelection: 'Pilih foto yang ingin disetujui atau ditolak.',
  notifyFamilies: 'Beri tahu keluarga', notifyFamiliesSub: 'Keluarga orang yang ada di foto mendapat pemberitahuan.', photosApprovedOne: 'Foto disetujui.', photosApprovedN: '{n} foto disetujui.',
  photosApprovedToldOne: 'Foto disetujui. Keluarga diberi tahu.', photosApprovedToldN: '{n} foto disetujui. Keluarga diberi tahu.', photosRejectedOne: 'Foto ditolak.', photosRejectedN: '{n} foto ditolak.',
  rejectPhotosTitleOne: 'Tolak foto ini', rejectPhotosTitleN: 'Tolak {n} foto', rejectPhotosSub: 'Foto yang ditolak tidak pernah ditampilkan ke keluarga. Pengambil foto diberi tahu beserta alasan Anda.', rejectPhotosReason: 'Mengapa tidak disetujui?',
  nonePhotos: 'Tidak ada foto untuk disetujui', nonePhotosSub: 'Foto yang diambil tim muncul di sini sebelum keluarga bisa melihatnya.', 'photoKind.solo': 'Foto', 'photoKind.group': 'Foto kelompok', 'photoKind.lunch': 'Foto makan siang', 'photoKind.arrival': 'Foto kedatangan',
  photoBy: 'oleh {n}', selectPhoto: 'Pilih foto {n}', openPhoto: 'Buka foto {n}', photosPager: 'Halaman foto', pagerPending: 'Halaman permintaan yang perlu disetujui', pagerApplied: 'Halaman permintaan yang sudah berlaku', pagerHistory: 'Halaman riwayat',
};
