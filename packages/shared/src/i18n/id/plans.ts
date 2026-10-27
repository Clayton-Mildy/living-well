// plans strings (ID): round 15 phase 2, the membership plan catalogue on Plans and pricing.
import type { Same } from '../ns';
import type { plans as EN } from '../en/plans';

export const plans: Same<typeof EN> = {
  list: 'Paket', add: 'Tambah paket', startFlex: 'Mulai dari Flex', startGold: 'Mulai dari Gold', quickAdd: 'Tambah cepat',
  'kind.days': 'Hari per bulan', 'kind.unlimited': 'Tanpa batas', quota: 'Hari per bulan', active: 'Aktif', noPrice: 'Belum ada harga',
  type: 'Jenis', name: 'Nama paket', nameId: 'Nama dalam bahasa Indonesia (opsional)', price: 'Harga per bulan', from: 'Harga berlaku mulai', edit: 'Ubah paket', editAria: 'Ubah {name}',
  retired: 'Dihentikan', activeAria: '{name} aktif', quotaV: '{n} hari per bulan', quotaVOne: '{n} hari per bulan',
  addedToast: '{name} ditambahkan.', savedToast: '{name} tersimpan.', retiredToast: '{name} dihentikan. Anggotanya tetap memakainya.', activeToast: '{name} aktif lagi.',
  keepNote: 'Paket yang dihentikan hilang dari pilihan. Anggotanya tetap memakainya dan tetap ditagih.',
  'err.name': 'Isi nama paket.', 'err.quota': 'Isi angka 1 sampai 23.', 'err.price': 'Isi harga.',
};
