// renewals strings (ID).
import type { Same } from '../ns';
import type { renewals as EN } from '../en/renewals';

export const renewals: Same<typeof EN> = {
  title: 'Perpanjangan',
  prevMonth: 'Bulan sebelumnya', nextMonth: 'Bulan berikutnya', logEyebrow: '{month} · catatan',
  progress: '{n} dari {total} sudah diputuskan', progressAll: 'Semua {total} sudah diputuskan',
  datesOpen: 'Cuti {month}: kabari paling lambat {date} · Tagihan {invoice}', datesClosed: 'Cuti bisa mulai {month} · Tagihan {invoice}',
  segLabel: 'Tampilkan', 'seg.toDo': 'Belum', 'seg.waiting': 'Menunggu', 'seg.decided': 'Selesai',
  searchPh: 'Cari anggota atau keluarga', searchLabel: 'Cari anggota', pager: 'Halaman perpanjangan',
  'none.toDo': 'Semua sudah dihubungi', 'none.waiting': 'Tidak ada yang menunggu manajemen', 'none.decided': 'Belum ada yang diputuskan', noMatch: 'Tidak ada yang cocok', noLog: 'Belum ada tindak lanjut untuk {month}', noMembers: 'Tidak ada yang perlu dihubungi untuk {month}',
  askedApp: 'Diajukan lewat aplikasi', noContact: 'Belum ada kontak', calls1: '1 panggilan', callsN: '{n} panggilan',
  'plan.flex': 'Flex', 'plan.gold': 'Gold',
  'outcome.continue': 'Lanjut', 'outcome.upgrade': 'Naik ke Gold', 'outcome.downgrade': 'Turun ke Flex', 'outcome.leave': 'Cuti', 'outcome.stop': 'Berhenti', 'outcome.noAnswer': 'Tidak diangkat', 'outcome.callBack': 'Telepon lagi',
  'meta.continue': 'Lanjut', 'meta.upgrade': 'Naik ke Gold', 'meta.downgrade': 'Turun ke Flex', 'meta.leave': 'Cuti {months}', 'meta.stop': 'Berhenti {date}', 'meta.noAnswer': 'Tidak diangkat', 'meta.callBack': 'Telepon lagi', 'meta.rejected': 'Tidak disetujui',
  sheetTitle: 'Hubungi {name}', 'group.contact': 'Kontak keluarga', 'group.membership': 'Keanggotaan', 'group.outcome': 'Keputusan untuk {month}', 'group.calls': 'Panggilan',
  whatsapp: 'WhatsApp', plan: 'Paket', usage: 'Bulan ini', usageFlex: '{used} dari {quota} hari', usageGold: '{n} hari', usageExtra: ' · {n} hari tambahan',
  leaveMonths: 'Bulan cuti', leaveLate: '{month}: pemberitahuan paling lambat {date}', lastDay: 'Hari terakhir', reason: 'Alasan', notePh: 'Opsional',
  save: 'Simpan', saveApproval: 'Kirim untuk persetujuan', saved: 'Tersimpan untuk {name}.', savedApplied: 'Tersimpan untuk {name}. Berlaku mulai {date}.', quickSaved: 'Tersimpan untuk {name}: {outcome}.',
  'st.waiting': 'Menunggu persetujuan manajemen. Dicatat oleh {who}.', 'st.rejected': 'Manajemen tidak menyetujui ini: {reason}', 'st.applied': 'Berlaku mulai {date}.', 'st.appliedStop': 'Sudah berlaku: hari terakhir {date}.',
  'st.askedPlan': 'Keluarga sudah meminta ganti paket lewat aplikasi.', 'st.askedLeave': 'Cuti untuk {month} sudah ada di daftar.', 'st.review': 'Buka di Persetujuan',
  'calls.none': 'Belum ada panggilan', callLine: '{who} · {when}',
  'err.pastMonth': 'Bulan itu sudah dimulai.', 'err.started': 'Bulan itu sudah dimulai, jadi perubahan tidak bisa lagi berlaku mulai tanggal 1.', 'err.applied': 'Perubahan ini sudah berlaku. Ubah di tab Paket anggota.',
  'err.notDue': 'Anggota ini tidak perlu dihubungi untuk bulan itu.', 'err.lastDayLate': 'Hari terakhir harus berada dalam bulan yang diputuskan.',
  'notif.plan': 'Paket {name} berubah ke {plan} mulai {date}.', 'notif.leave': 'Cuti {name} pada {month} sudah dicatat: {fee} di tagihan bulan itu sebagai pengganti paket.',
  'notif.leave2': 'Cuti {name} dari {from} sampai {to} sudah dicatat: {fee} per bulan di tagihan sebagai pengganti paket.',
  'notif.act.followUp': '{n} anggota perlu dihubungi untuk {month}', 'notif.act.approve': 'Perubahan perpanjangan menunggu persetujuan: {n}',
  'feed.continue': '{name}: lanjut di {month}', 'feed.upgrade': '{name}: naik ke Gold mulai {month}', 'feed.downgrade': '{name}: turun ke Flex mulai {month}',
  'feed.leave': '{name}: cuti di {month}', 'feed.leave2': '{name}: cuti dari {from} sampai {to}', 'feed.stop': '{name}: berhenti, hari terakhir {date}',
  'feed.noAnswer': '{name}: telepon perpanjangan, tidak diangkat', 'feed.callBack': '{name}: telepon perpanjangan, perlu dihubungi lagi',
  'feed.approved': '{name}: perubahan perpanjangan {month} disetujui', 'feed.rejected': '{name}: perubahan perpanjangan {month} tidak disetujui',
};
