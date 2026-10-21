// fcal strings (ID): family Calendar (round 8).
import type { Same } from '../ns';
import type { fcal as EN } from '../en/fcal';

export const fcal: Same<typeof EN> = {
  vList: 'Daftar', vMonth: 'Bulan', cameAria: 'datang ke klub',
  legend: 'Hari berfoto: {names} datang · kuning tua: klub tutup',
  weekend: 'Klub tutup pada akhir pekan',
  closed: 'Klub tutup', closedFor: 'Klub tutup · {title}',
  nothing: 'Belum ada acara pada hari ini.',
  guestHost: 'pengisi acara tamu {name}',
  joined: '{n} ikut serta', satOut: '{n} beristirahat',
  dayPhotos: 'Foto hari itu',
  photoAria: 'Foto {i} dari {n}, {a}',
  joinedDay: '{n} datang',
  cameDay: 'datang ke klub',
};
