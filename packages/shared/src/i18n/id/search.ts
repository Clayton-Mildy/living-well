// search strings (ID).
import type { Same } from '../ns';
import type { search as EN } from '../en/search';

export const search: Same<typeof EN> = {
  open: 'Cari', placeholder: 'Cari menu, orang, tagihan…', close: 'Tutup pencarian',
  'g.screens': 'Menu', 'g.actions': 'Tindakan', 'g.people': 'Orang', 'g.records': 'Data',
  recent: 'Pencarian terakhir', clear: 'Hapus', hint: 'Ketik nama, nomor tagihan atau menu', none: 'Tidak ditemukan untuk "{q}"',
  'act.addMember': 'Tambah anggota', 'act.recordPayment': 'Catat pembayaran', 'act.requestLeave': 'Ajukan cuti', 'act.newCelebration': 'Perayaan baru', 'act.submitReceipt': 'Kirim nota',
  familyOf: 'Keluarga {name}',
};
