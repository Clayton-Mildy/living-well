// mood strings (ID).
import type { Same } from '../ns';
import type { mood as EN } from '../en/mood';

export const mood: Same<typeof EN> = {
  'face.5': 'Senang sekali', 'face.4': 'Baik', 'face.3': 'Biasa', 'face.2': 'Kurang', 'face.1': 'Sedih',
  'moment.arrival': 'Datang', 'moment.health': 'Cek kesehatan', 'moment.activity': 'Kegiatan', 'moment.departure': 'Pulang',
  'err.notIn': 'Catat kedatangannya dulu.',
  ask: 'Bagaimana kabar {name} hari ini?', askOut: 'Bagaimana kabar {name} saat pulang?',
  notMarkedDoor: 'Belum dicatat di pintu: {n}',
  lift: 'Naik {n}', index: 'Indeks suasana hati', arc: 'Suasana hati sepanjang hari',
};
