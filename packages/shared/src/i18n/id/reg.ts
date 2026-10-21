// registration flow strings (ID).
import type { Same } from '../ns';
import type { reg as EN } from '../en/reg';

export const reg: Same<typeof EN> = {
  person: 'Data diri', family: 'Keluarga', health: 'Kesehatan', plan: 'Paket', paper: 'Formulir', review: 'Periksa',
  next: 'Lanjut', back: 'Kembali', discard: 'Buang', resume: 'Lanjutkan', resumeQ: 'Lanjutkan isian sebelumnya?',
  sample: 'Pakai formulir contoh', fromLead: 'Dari calon anggota', fromLeadPh: 'Nama atau telepon calon', noLeads: 'Tidak ada calon yang cocok.',
  duplicate: '{name} sudah memakai {what} ini', 'what.phone': 'nomor telepon', 'what.nik': 'NIK', open: 'Buka',
  edit: 'Ubah', stepOf: 'Langkah {n} dari {total} · {step}', steps: 'Langkah', confirm: 'Sebelum dikirim', none: 'Tidak ada',
  idMember: 'KTP anggota diterima', idGuarantor: 'KTP anggota keluarga diterima',
};
