// unpaid strings (ID).
import type { Same } from '../ns';
import type { unpaid as EN } from '../en/unpaid';

export const unpaid: Same<typeof EN> = {
  none: 'Tidak ada tagihan yang belum dibayar', late1: 'terlambat 1 hari', lateN: 'terlambat {n} hari', amountLate: '{amount} · {late}',
  suspendOn: 'Ditangguhkan mulai {d}', stopOn: 'Berhenti {d}', onHold: 'Ditangguhkan sejak {d}',
  'outcome.promised': 'Berjanji bayar', 'outcome.paid': 'Mengaku sudah bayar', 'outcome.disputed': 'Keberatan', 'outcome.noAnswer': 'Tidak diangkat',
  lastCall: '{outcome} · {when}', promisedFor: 'Janji bayar {d}', noCall: 'Belum dihubungi',
  sheetTitle: 'Belum bayar · {name}', invoice: 'Tagihan {number}', 'group.outcome': 'Kata keluarga', 'group.calls': 'Panggilan', 'calls.none': 'Belum ada panggilan',
  promisedOn: 'Berjanji membayar pada', save: 'Simpan panggilan', saved: 'Panggilan untuk {name} tersimpan.', recordPayment: 'Catat pembayaran',
  openSheet: 'Buka {name}',
  'err.promiseDate': 'Pilih tanggal janji bayar, hari ini atau setelahnya.',
  'feed.promised': '{name}: berjanji membayar {number} pada {date}', 'feed.paid': '{name}: mengaku {number} sudah dibayar', 'feed.disputed': '{name}: keberatan atas {number}', 'feed.noAnswer': '{name}: telepon tidak diangkat soal {number}',
};
