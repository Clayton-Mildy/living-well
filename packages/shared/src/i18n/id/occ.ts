// occ strings (ID).
import type { Same } from '../ns';
import type { occ as EN } from '../en/occ';

export const occ: Same<typeof EN> = {
  title: 'Ulang tahun', prepare: 'Siapkan', requested: 'Diajukan', confirmed: 'Dikonfirmasi',
  'notif.birthdaySoon': '{name} berulang tahun ke-{years} pada {date}',
};
