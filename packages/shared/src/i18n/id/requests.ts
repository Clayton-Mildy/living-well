// requests strings (ID).
import type { Same } from '../ns';
import type { requests as EN } from '../en/requests';

export const requests: Same<typeof EN> = {
  title: 'Permintaan', eyebrow: 'Minta apa yang dibutuhkan bagian Anda', new: 'Permintaan baru', soon: 'Belum tersedia',
  'stock.title': 'Permintaan stok',
  'budget.title': 'Permintaan anggaran', 'budget.card': 'Permintaan dari suatu bagian', 'budget.section': 'Seksi',
  'budget.item': 'Untuk apa?', 'budget.itemLabel': 'Keperluan', 'budget.amount': 'Jumlah dalam Rp', 'budget.amountLabel': 'Jumlah', 'budget.send': 'Kirim permintaan', 'budget.sent': 'Permintaan dikirim ke keuangan.',
  'budget.noSections': 'Belum ada seksi anggaran. Minta keuangan menambahkannya.',
  'receipt.title': 'Foto kuitansi (nota)',
  'snap.tap': 'Ketuk untuk mengambil foto', 'snap.photoAlt': 'Foto kuitansi (contoh)', 'snap.supplier': 'Pemasok', 'snap.suppliers': 'Pemasok',
  'snap.amount': 'Jumlah (Rp)', 'snap.section': 'Seksi', 'snap.send': 'Kirim ke keuangan', 'snap.sent': 'Kuitansi dikirim ke keuangan, dihitung dalam anggaran {section}.',
  'mine.title': 'Permintaan saya', 'mine.waiting': '{n} menunggu', 'mine.stock': 'Stok', 'mine.budget': 'Anggaran', 'mine.receipt': 'Kuitansi', 'mine.cancel': 'Batalkan permintaan', 'mine.keep': 'Pertahankan',
  'mine.cancelTitle': 'Batalkan permintaan ini?', 'mine.cancelAsk': 'Batalkan “{what}”? Tetap ada di daftar Anda dengan status Dibatalkan.', 'mine.cancelled': 'Permintaan dibatalkan.', 'mine.saved': 'Permintaan diperbarui.',
  'mine.fixSend': 'Perbaiki dan kirim ulang', 'mine.editBudget': 'Ubah permintaan anggaran', 'mine.editReceipt': 'Ubah kuitansi', 'mine.empty': 'Belum ada permintaan',
  'mine.s_waiting': 'Menunggu', 'mine.s_approved': 'Disetujui', 'mine.s_rejected': 'Ditolak', 'mine.s_cancelled': 'Dibatalkan', 'mine.s_withFinance': 'Di keuangan',
};
