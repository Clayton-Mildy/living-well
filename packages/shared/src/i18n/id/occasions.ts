// occasions strings (ID).
import type { Same } from '../ns';
import type { occasions as EN } from '../en/occasions';

export const occasions: Same<typeof EN> = {
  more: '+{n} lagi',
  turnsPlain: '{name} berulang tahun ke-{n}',
  title: 'Minggu ini', open: 'Buka {name}',
  turns: '{name} berulang tahun ke-{n} pada hari {day}', turnsToday: '{name} berulang tahun ke-{n} hari ini',
  years1: '{name}: 1 tahun bersama klub pada hari {day}', yearsN: '{name}: {n} tahun bersama klub pada hari {day}',
  years1Today: '{name}: 1 tahun bersama klub hari ini', yearsNToday: '{name}: {n} tahun bersama klub hari ini',
  birthdayToday: 'Ulang tahun hari ini', anniversaryToday: 'Hari jadi hari ini', kitchenToday: 'Ulang tahun hari ini: {list}',
  heroBirthday: 'ulang tahun hari {day}', heroBirthdayToday: 'ulang tahun hari ini',
  calBirthday: 'Ulang tahun', calTurns: 'Berusia {n}', famCard: 'Ulang tahun',
};
