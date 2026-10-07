// chat strings (ID).
import type { Same } from '../ns';
import type { chat as EN } from '../en/chat';
export const chat: Same<typeof EN> = {
  eyebrowStaff: 'Keluarga · WhatsApp', eyebrowFamily: 'Bersama klub', newMessage: 'Pesan baru', filterTeam: 'Saring menurut tim', both: 'Keduanya', member: 'Anggota',
  'topic.lobby': 'Lobi', 'topic.nurse': 'Perawat', 'topic.care': 'Tim aktivitas', 'topic.kitchen': 'Dapur', 'topic.billing': 'Tagihan',
  'teamSub.lobby': '{name} dan tim resepsionis', 'teamSub.nurse': 'Perawat klub', 'teamSub.care': 'Para pengajar aktivitas', 'teamSub.kitchen': 'Tim dapur', 'teamSub.billing': 'Tim keuangan',
  about: 'Tentang {n} · {team}', aboutReplies: 'Tentang {m}', relOf: '{rel} dari {m}', you: 'Anda', youColon: 'Anda: ', startConv: 'Mulai percakapan', unreadAria: 'Belum dibaca',
  openProfile: 'Buka profil {n}', backAria: 'Kembali ke percakapan', placeholder: 'Tulis pesan', messageAria: 'Pesan', logAria: 'Pesan dalam percakapan ini', sendAria: 'Kirim', threadAria: 'Percakapan dengan {name}',
  pick: 'Pilih percakapan', pickSub: 'Ketuk percakapan di sebelah kiri untuk membaca dan membalas.', none: 'Belum ada percakapan', noneSub: 'Pesan dari keluarga muncul di sini. Gunakan Pesan baru untuk memulai.',
  noneFamily: 'Belum ada percakapan', noneFamilySub: 'Kirim pesan ke klub kapan saja. Biasanya kami membalas dalam satu jam.', emptyThread: 'Belum ada pesan. Sapa kami di bawah.',
  autoReply: 'Balasan otomatis', healthUpdate: 'Kabar kesehatan', notice: 'Pemberitahuan', feedbackHead: 'Masukan makan siang · {dish}',
  'ref.dailyLog': 'Tentang catatan harian', 'ref.reading': 'Tentang hasil ukur kesehatan', 'ref.photo': 'Tentang sebuah foto', 'ref.invoice': 'Tentang sebuah tagihan', 'ref.feedback': 'Tentang masukan makan siang',
  'q.staff1': 'Terima kasih, sudah dicatat.', 'q.staff2': 'Ya, ada di lobi.', 'q.staff3': 'Kami cek dulu dan kabari Anda.',
  'q.famLobby1': 'Kami akan menjemput {n} lebih awal hari ini.', 'q.famLobby2': 'Apakah ada barang {n} yang tertinggal di lobi?', 'q.famLobby3': 'Terima kasih untuk hari ini!',
  'q.famNurse1': 'Bagaimana tekanan darah {n} hari ini?', 'q.famNurse2': '{n} sudah minum obat pagi ini.', 'q.famNurse3': 'Terima kasih, {nurse}.',
  'autoAck.lobby': 'Terima kasih {name}, sudah kami catat. Kami akan menanganinya.', 'autoAck.nurse': 'Terima kasih, {name}. Saya akan memeriksa {member} dan membalas di sini.',
  'autoAck.care': 'Terima kasih {name}. Pesan ini sudah kami teruskan ke tim aktivitas.', 'autoAck.kitchen': 'Terima kasih, {name}. Tim dapur akan memeriksanya.',
  'autoAck.billing': 'Terima kasih {name}. Tim keuangan kami akan segera menghubungi Anda.',
  startTitle: 'Pesan baru', startSub: 'Tulis kepada kontak keluarga. Pesan muncul di tab Pesan aplikasi mereka.', stepMember: 'Tentang anggota yang mana?', searchMember: 'Cari anggota',
  stepContact: 'Keluarga yang mana?', stepTeam: 'Dari tim mana?', stepText: 'Pesan Anda', noContacts: 'Belum ada kontak keluarga {n} dengan akses aplikasi, jadi tidak ada yang bisa dikirimi pesan.',
  pagerThreads: 'Halaman percakapan', pagerMembers: 'Halaman anggota', earlier: 'Tampilkan pesan sebelumnya ({n})',
  noMembers: 'Tidak ada anggota yang cocok.', sendMsg: 'Kirim pesan', sentTo: 'Pesan terkirim ke {name}.', primaryTag: 'Kontak tagihan utama', change: 'Ubah', noTopic: 'Peran Anda tidak memiliki tim untuk menulis.',
  'err.empty': 'Tulis pesan terlebih dahulu.', 'err.tooLong': 'Pesan terlalu panjang (maksimal {max} karakter).', 'err.noAccess': '{name} belum memiliki akses aplikasi.',
  'notif.new': '{name} mengirim pesan tentang {member}.', 'notif.reply': '{name} membalas tentang {member}.',
  'feed.started': 'Memulai percakapan dengan {who} tentang {name}', 'feed.reply': 'Membalas {who} tentang {name}',
  'feed.family.lobby': '{who} mengirim pesan ke lobi tentang {name}', 'feed.family.nurse': '{who} mengirim pesan ke perawat tentang {name}', 'feed.family.care': '{who} mengirim pesan ke tim aktivitas tentang {name}',
  'feed.family.kitchen': '{who} mengirim pesan ke dapur tentang {name}', 'feed.family.billing': '{who} mengirim pesan ke bagian tagihan tentang {name}',
};
