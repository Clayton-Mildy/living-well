// geo strings (ID).
import type { Same } from '../ns';
import type { geo as EN } from '../en/geo';

export const geo: Same<typeof EN> = {
  address: 'Alamat', search: 'Cari', searching: 'Mencari…', noHits: 'Tempat tidak ditemukan. Coba nama jalan dan daerah, atau taruh pin.',
  pickHit: 'Tempat ditemukan', kelurahan: 'Kelurahan', kecamatan: 'Kecamatan', kmFromClub: '{km} km dari klub', noPin: 'Belum ada pin. Cari alamat atau ketuk peta.',
  pinHint: 'Geser pin ke depan rumah.', mapLabel: 'Peta', clubPin: 'CitraPremier', clearPin: 'Hapus pin', club: 'Klub',
  'err.unavailable': 'Pencarian tidak tersedia. Ketuk peta untuk menaruh pin.', 'err.busy': 'Pencarian sedang sibuk. Tunggu sebentar lalu coba lagi.',
  'err.invalid': 'Ketik minimal 3 huruf untuk mencari.',
};
