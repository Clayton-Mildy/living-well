// fme strings (ID): family Me, Billing and Contacts (round 8).
import type { Same } from '../ns';
import type { fme as EN } from '../en/fme';

export const fme: Same<typeof EN> = {
  // ----- Me -----
  textSize: 'Ukuran teks', textNormal: 'Standar', textLarge: 'Lebih besar',
  yourParent: 'Orang tua Anda', yourFamily: 'Keluarga Anda', rolePays: '{rel} · membayar tagihan', atClub: 'Di klub', homeToday: 'Di rumah hari ini', wentHome: 'Pulang {t}',
  memEnded: 'Keanggotaan berakhir', memStarts: 'Mulai {d}', dueAmt: '{a} jatuh tempo', someonePays: '{n} yang membayar', healthAlerts: 'Peringatan kesehatan', healthAlertsFor: 'Peringatan kesehatan · {n}',
  details: 'Data Anda', detailsTitle: 'Data Anda', password: 'Kata sandi',
  // ----- Billing -----
  toPayDue: 'Harus dibayar · jatuh tempo {d}', overdueDue: 'Terlambat · jatuh tempo {d}', nothingToPay: 'Tidak ada tagihan', forOne: '{n} · {m}', forMany: '{n} tagihan', nextInvoice: 'Tagihan berikutnya {d}', firstInvoice: 'Tagihan pertama {d}',
  vaLabel: 'REKENING VIRTUAL {b}', plans: 'Paket', invoices: 'Tagihan', showMore: 'Tampilkan lagi', planName: '{n} · {p}', anyOpenDay: 'Setiap hari buka', nextExtra: 'Kunjungan berikutnya adalah hari tambahan · {p} di tagihan {m}',
  due: 'Belum bayar', partPaid: 'Sebagian', balance: 'Saldo',
  // ----- Contacts -----
  frontDesk: 'Resepsionis {club}', whatsapp: 'WhatsApp', callClub: 'Telepon', emergency: 'Darurat', emergencyLine: 'Nomor darurat klub', emergencySub: 'Hubungi klub lebih dulu',
  gDoctor: 'Dokter', gService: 'Rumah sakit dan apotek', gSupplier: 'Kontak lainnya', callName: 'Telepon {n}', theClub: 'Klub',
  // ----- plan and leave asks -----
  askPlan: 'Minta klub mengubah paket', askWho: 'Perubahan paket dan cuti diajukan lewat {n}.', ended: 'Keanggotaan berakhir',
};
