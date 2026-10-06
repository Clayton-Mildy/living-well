// ds strings (ID).
import type { Same } from '../ns';
import type { ds as EN } from '../en/ds';
export const ds: Same<typeof EN> = {
  recordVideo: 'Rekam video', stopRecording: 'Berhenti merekam', useVideo: 'Pakai video', videoPreview: 'Pratinjau video',
  chooseVideo: 'Pilih video', uploadVideoInstead: 'Pilih video saja', processingVideo: 'Menyiapkan video…',
  cameraNoneVideo: 'Kamera tidak ditemukan. Pilih video saja.',
  cameraDeniedVideo: 'Akses kamera diblokir. Izinkan di pengaturan peramban Anda, atau pilih video.',
  recordingTime: 'Merekam: {s} dari {max} detik', maxLength: 'Maksimal {n} detik', recordFailed: 'Perekaman berhenti. Silakan coba lagi.',
  videoType: 'Gunakan video WebM atau MP4.', videoTooBig: 'Video terlalu besar (maks. 25 MB).', videoTooLong: 'Video lebih panjang dari {n} detik. Silakan pilih yang lebih pendek.',
};
