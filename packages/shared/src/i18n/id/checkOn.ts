// check on strings (ID).
import type { Same } from '../ns';
import type { checkOn as EN } from '../en/checkOn';

export const checkOn: Same<typeof EN> = {
  title: 'Lama tidak datang', notSeenFor: 'Tidak datang selama', auto: 'Otomatis', nobody: 'Tidak ada yang selama itu tidak datang', days: '{n} hari', day1: '1 hari', call: 'Telepon', all: 'Semua {n}', again: 'Cek lagi pada', saved: 'Panggilan dicatat',
  who: 'Telepon {relation} {name}', noContact: 'Belum ada kontak keluarga', noPhone: 'Belum ada nomor telepon',
  outcomeLabel: 'Apa kata keluarga?', notePh: 'Catatan (opsional)', save: 'Simpan panggilan', logCall: 'Catat panggilan', lastSeen: 'Terakhir hadir {date}', neverSeen: 'Belum pernah hadir', lastCall: 'Panggilan terakhir: {outcome}',
  recordLeave: 'Catat cuti', callBy: 'Telepon ke {name} · {by}', callEntry: 'Telepon kabar: {outcome}',
  'outcome.fine': 'Baik-baik saja', 'outcome.unwell': 'Kurang sehat', 'outcome.hospital': 'Di rumah sakit', 'outcome.travelling': 'Bepergian', 'outcome.wantsPause': 'Ingin berhenti sementara', 'outcome.noAnswer': 'Tidak diangkat', 'outcome.other': 'Lainnya',
  'notif.unwell': '{name}: keluarga bilang {outcome}',
  'feed.called': '{name}: telepon kabar ke keluarga',
};
