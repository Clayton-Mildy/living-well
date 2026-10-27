// mood strings (ID).
import type { Same } from '../ns';
import type { mood as EN } from '../en/mood';

export const mood: Same<typeof EN> = {
  'face.5': 'Senang sekali', 'face.4': 'Baik', 'face.3': 'Biasa', 'face.2': 'Kurang', 'face.1': 'Sedih',
  'moment.arrival': 'Check-in', 'moment.health': 'Perawat', 'moment.morning': 'Pagi', 'moment.lunch': 'Makan siang', 'moment.activity': 'Kegiatan', 'moment.departure': 'Pulang',
  'hint.5': 'Mengobrol dan tertawa', 'hint.4': 'Terlibat dan senang', 'hint.3': 'Tenang, diam tapi baik', 'hint.2': 'Menarik diri atau lelah', 'hint.1': 'Gelisah, cemas atau kesakitan',
  'err.notIn': 'Catat kedatangannya dulu.',
  ask: 'Bagaimana kabar {name} hari ini?', askOut: 'Bagaimana kabar {name} saat pulang?',
  notMarkedDoor: 'Belum dicatat di pintu: {n}',
  lift: 'Naik {n}', index: 'Indeks suasana hati', arc: 'Suasana hati sepanjang hari',
};
