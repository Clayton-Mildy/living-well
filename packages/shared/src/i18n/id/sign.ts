// sign strings (ID).
import type { Same } from '../ns';
import type { sign as EN } from '../en/sign';

export const sign: Same<typeof EN> = {
  send: 'Kirim untuk ditandatangani', resend: 'Kirim ulang', physical: 'Meterai fisik', viewSigned: 'Lihat formulir bertanda tangan',
  sentToast: 'Tautan WhatsApp terkirim ke {name} (simulasi)',
  'status.draft': 'Draf', 'status.sent': 'Terkirim', 'status.signed': 'Ditandatangani keluarga', 'status.countersigned': 'Disetujui', 'status.stamped': 'Bermeterai',
  eMeterai: 'e-Meterai', serial: 'Nomor seri {s}', physicalDone: 'Meterai fisik', docs: 'Dokumen',
  toSign: '{n} perlu ditandatangani', readSign: 'Baca dan tanda tangani', 'step.read': 'Baca', 'step.sign': 'Tanda tangan', 'step.confirm': 'Konfirmasi',
  readForm: 'Baca formulir', haveRead: 'Saya sudah membaca formulir', drawHere: 'Tanda tangani di sini dengan jari', clear: 'Hapus',
  codeSent: 'Kode dikirim ke {phone}', codeDemo: 'Demo: 6 angka apa saja', code: 'Kode 6 angka', signBtn: 'Tanda tangani',
  done: 'Sudah ditandatangani. Klub akan menyetujuinya.', already: 'Formulir ini sudah ditandatangani',
  countersign: 'Setujui', approvedBy: 'Disetujui: {name} · {d}',
  'notif.toSign': 'Mohon tanda tangani formulir keanggotaan {name}', 'notif.stamped': 'Formulir keanggotaan {name} sudah ditandatangani dan bermeterai', 'notif.returned': 'Formulir {name} dikembalikan: {note}',
  timeline: 'Riwayat', scan: 'Unggah pindaian bertanda tangan',
  'err.noSigner': 'Tambahkan kontak penagihan dulu', 'err.notNow': 'Formulir ini tidak bisa diproses sekarang',
};
