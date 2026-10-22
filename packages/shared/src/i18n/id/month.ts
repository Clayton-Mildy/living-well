// month report strings (ID).
import type { Same } from '../ns';
import type { month as EN } from '../en/month';

export const month: Same<typeof EN> = {
  title: 'Laporan bulanan', period: 'Periode', vsPrev: 'vs {period}', empty: 'Belum ada catatan di periode ini',
  hero: 'Angka utama', heroCollected: 'Pendapatan diterima', heroActive: 'Anggota aktif', heroMood: 'Indeks suasana hati', heroConversion: 'Calon → bergabung', trendAria: '{label}, enam bulan', heroSoFar: 'sejauh ini bulan ini', heroSoFarAny: 'sejauh ini', trendNone: 'Belum ada data',
  money: 'Keuangan', members: 'Anggota', care: 'Perawatan dan suasana hati', pipeline: 'Calon anggota dan tim',
  billed: 'Ditagihkan', collected: 'Diterima', outstanding: 'Lewat jatuh tempo', notYetDue: 'Belum jatuh tempo', extraDays: 'Hari tambahan', venueIncome: 'Pendapatan sewa ruang', refunds: 'Pengembalian dana',
  active: 'Anggota aktif', joined: 'Bergabung', ended: 'Berhenti', renewalsKept: 'Perpanjangan lanjut', renewalsLost: 'Perpanjangan berhenti', onLeave: 'Cuti', checkOn: 'Lama tidak datang',
  visitsPerMember: 'Kunjungan per anggota', utilisation: 'Tingkat kehadiran',
  index: 'Suasana hati', lift: 'Naik dari datang ke pulang', alerts: 'Bacaan bahaya', watches: 'Bacaan waspada', rechecks: 'Cek ulang', lunchEaten: 'Makan siang habis',
  leads: 'Calon baru', leadsCaption: 'dari calon yang masuk 3 bulan sebelumnya', visits: 'Berkunjung', trials: 'Hari percobaan', converted: 'Bergabung', lost: 'Batal',
  duties: 'Tugas selesai', surveyFamily: 'Nilai keluarga', surveyVenue: 'Nilai penyewa ruang', monthsVs: '{cur} vs {prev}',
  sendOwner: 'Kirim ke pemilik', summaryTitle: 'Ringkasan untuk pemilik', copy: 'Salin', copied: 'Tersalin', copyFailed: 'Gagal menyalin. Pilih teksnya lalu salin manual.', sendWa: 'Kirim lewat WhatsApp', sent: 'Terkirim ke pemilik lewat WhatsApp',
  'sum.head': 'CitraPremier · {period}', 'sum.row': '{label}: {cur}', 'sum.rowDiff': '{label}: {cur} ({diff})',
};
