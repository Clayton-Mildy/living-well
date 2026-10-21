// celebrations strings (ID).
import type { Same } from '../ns';
import type { celeb as EN } from '../en/celeb';

export const celeb: Same<typeof EN> = {
  title: 'Perayaan', tabVenue: 'Venue', tabCelebrations: 'Perayaan', tabCelebrationsN: 'Perayaan ({n})',
  new: 'Perayaan baru', requested: 'Diminta', upcoming: 'Akan datang', past: 'Sudah lewat', none: 'Belum ada perayaan.',
  sub: '{date} · {from}–{to} · {room}', guest1: '1 tamu', guests: '{n} tamu',
  member: 'Anggota', pickMember: 'Pilih anggota', kind: 'Acara', kind_birthday: 'Ulang tahun', kind_anniversary: 'Hari jadi', kind_other: 'Lainnya',
  titleL: 'Judul', guestsL: 'Tamu', noteL: 'Kue atau katering', notePh: 'Contoh: kue cokelat, tanpa kacang', reasonL: 'Alasan',
  requestBtn: 'Kirim permintaan', bookBtn: 'Pesan',
  waiting: 'Menunggu', confirmedBadge: 'Terkonfirmasi', done: 'Selesai', declined: 'Ditolak', declinedWhy: 'Ditolak: {reason}',
  confirm: 'Konfirmasi', decline: 'Tolak', declineTitle: 'Tolak perayaan ini?', cancelBtn: 'Batalkan', cancelTitle: 'Batalkan perayaan ini?',
  cancelText: '{title} pada {date}. Ruangan kembali kosong.',
  requestedToast: 'Permintaan terkirim. Manajemen akan mengonfirmasi.', bookedToast: 'Perayaan dipesan untuk {date}. Keluarga diberi tahu.',
  confirmedToast: 'Terkonfirmasi. Keluarga dan resepsionis diberi tahu.', declinedToast: 'Ditolak. Resepsionis diberi tahu.',
  updatedToast: 'Perayaan diperbarui.', updatedAgain: 'Diperbarui. Manajemen perlu mengonfirmasi lagi.', cancelledToast: 'Perayaan dibatalkan.',
  editReconfirm: 'Perayaan ini sudah terkonfirmasi. Setelah diubah, manajemen harus mengonfirmasi lagi.',
  famCard: 'Perayaan', famOpen: 'Lihat di kalender', famSub: '{from}–{to} · {room}',
  'err.decided': 'Perayaan ini sudah tidak bisa diubah.',
  'notif.requested': '{name}: perayaan diminta untuk {date} ({title})',
  'notif.decided': 'Terkonfirmasi: {title} pada {date}',
  'notif.declined': 'Ditolak: {title} pada {date}',
  'notif.cancelled': 'Dibatalkan: {title} pada {date}',
  'notif.family': '{title} dipesan di klub pada {date} pukul {from}',
  'feed.requested': '{name}: perayaan diminta untuk {date}',
  'feed.confirmed': '{name}: perayaan terkonfirmasi untuk {date}',
  'feed.declined': '{name}: perayaan ditolak untuk {date}',
  'feed.updated': '{name}: perayaan diubah untuk {date}',
  'feed.cancelled': '{name}: perayaan dibatalkan untuk {date}',
};
