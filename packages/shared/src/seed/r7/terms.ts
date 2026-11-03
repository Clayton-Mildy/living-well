// Round 18 (KC): the seeded terms and conditions, version 1 (English and Indonesian), 14 sections. "# " starts a heading and "- " a bullet (termsBlocks).
// The placeholders are filled from the settings by termsText(), so the terms never contradict the app: {flexQuota}, {issueDay}, {dueDay}, {downgradeDays},
// {stopDays} and {leaveDays}. Demo text: the club reviews it before going live.

export const TERMS_V1_EN = `# 1. Membership and plans
- Membership is month to month for the member named on the registration form. The family contact who signs the form is responsible for the bills.
- Flex covers {flexQuota} visit days a month; Gold covers every open day. Other plans are listed under Plans in the app.
# 2. Visits and opening hours
- The club is open on weekdays, and on the weekend days the club announces for a programme. Public holidays, closed days and weekend programmes are shown in the app's calendar.
- A visit day starts when the front desk checks the member in and ends at check-out.
- Flex visits beyond {flexQuota} in a month are billed as extra days. Visit days do not carry over to the next month.
# 3. Fees and billing
- A one-time registration fee is billed on the first invoice of a membership. It is billed again only if a membership that stopped starts again.
- Each month's invoice is issued on day {issueDay} of that month and is due on day {dueDay}.
- Pay by the virtual account on the invoice, or by cash or bank transfer with a photo of the proof of payment.
- If an invoice stays unpaid, the membership is put on hold from the 1st of the next month. If the family has not told us when they will pay, the membership stops a few days later.
# 4. Changing, stopping and leave
- An upgrade starts on the next 1st, with no notice.
- A downgrade must be asked for at least {downgradeDays} days before the month it starts.
- Stopping the membership must be asked for at least {stopDays} days before the month it starts.
- Leave (cuti) must be asked for at least {leaveDays} days before the month it starts. A month of leave is billed at the leave fee and keeps the member's place.
- Leave can be taken for up to 2 months in a row. If we have no word from the family after that, the membership ends.
- Requests made later than this apply from the month after.
# 5. Pick-up and field trips
- Pick-up is a monthly service with its own price, on the monthly invoice.
- Field trips are optional. Their fee is charged only to the members who went, on the next monthly invoice.
# 6. Birthdays and celebrations
- The club celebrates birthdays and anniversaries with the family.
- Extras such as a cake or a party lunch are agreed with the family first and charged on the next bill.
# 7. Health and safety
- A nurse takes health checks (blood pressure, temperature, weight) and keeps them for the member's care. The family contacts see them in the app.
- Medicines are given only as written in the member's care plan. Bring them in their original packs, with the doctor's instructions.
- In an emergency the club gives first aid, calls an ambulance when needed, and calls the primary family contact at once, then the other contacts.
- Tell us about changes in medicine, allergies or diagnosis so the care plan stays right.
# 8. Meals and allergies
- Lunch and tea are served every open day, following the member's diet (for example low salt, sugar free or soft food).
- Tell us about every food allergy. The kitchen checks each dish against the member's allergies.
# 9. Belongings
- Please label glasses, hearing aids, walking aids and clothes. The club is not responsible for money or valuables brought in.
# 10. Photos
- Staff take photos of the day. Each photo is shared only with the families of the members tagged in it, so a group photo is shared with the family of every member tagged in it.
- Face tagging and face check-in can be turned off at any time; ask the front desk.
# 11. Personal data
- The member's and the family's details are used only to run the membership and care for the member, and are kept safe.
- Families can ask to see or correct the details we hold.
# 12. Complaints and contact
- Talk to the front desk or the club manager, or phone the club. We reply within 2 working days.
# 13. Changes to these terms
- When the terms change, families are notified in the app and must read and agree to the new version before they continue.
# 14. Agreeing
- By tapping Agree and continue you confirm that you have read these terms for yourself and for the member you are family for.`;

export const TERMS_V1_ID = `# 1. Keanggotaan dan paket
- Keanggotaan berlaku bulan ke bulan untuk anggota yang tertulis di formulir pendaftaran. Kontak keluarga yang menandatangani formulir bertanggung jawab atas tagihan.
- Flex mencakup {flexQuota} hari kunjungan sebulan; Gold mencakup setiap hari buka. Paket lain ada di menu Paket di aplikasi.
# 2. Kunjungan dan jam buka
- Klub buka pada hari kerja, dan pada akhir pekan yang diumumkan klub untuk suatu program. Hari libur nasional, hari tutup dan program akhir pekan ada di kalender aplikasi.
- Satu hari kunjungan dimulai saat resepsionis mencatat kedatangan anggota dan berakhir saat pulang.
- Kunjungan Flex di atas {flexQuota} dalam sebulan ditagih sebagai hari tambahan. Hari kunjungan tidak dibawa ke bulan berikutnya.
# 3. Biaya dan tagihan
- Biaya pendaftaran satu kali ditagih pada tagihan pertama keanggotaan. Biaya ini ditagih lagi hanya bila keanggotaan yang sudah berhenti dimulai kembali.
- Tagihan setiap bulan terbit pada tanggal {issueDay} bulan itu dan jatuh tempo pada tanggal {dueDay}.
- Bayar lewat virtual account di tagihan, atau tunai atau transfer bank dengan foto bukti bayar.
- Bila tagihan belum dibayar, keanggotaan ditahan mulai tanggal 1 bulan berikutnya. Bila keluarga belum memberi tahu kapan akan membayar, keanggotaan berhenti beberapa hari kemudian.
# 4. Mengubah, berhenti dan cuti
- Naik paket berlaku mulai tanggal 1 berikutnya, tanpa perlu pemberitahuan lebih dulu.
- Turun paket harus diminta paling lambat {downgradeDays} hari sebelum bulan berlaku.
- Berhenti harus diminta paling lambat {stopDays} hari sebelum bulan berlaku.
- Cuti harus diminta paling lambat {leaveDays} hari sebelum bulan berlaku. Satu bulan cuti ditagih sebesar biaya cuti dan tempat anggota tetap disimpan.
- Cuti dapat diambil paling lama 2 bulan berturut-turut. Bila sesudah itu tidak ada kabar dari keluarga, keanggotaan berakhir.
- Permintaan yang lebih lambat berlaku mulai bulan sesudahnya.
# 5. Antar-jemput dan karyawisata
- Antar-jemput adalah layanan bulanan dengan harga sendiri, pada tagihan bulanan.
- Karyawisata bersifat pilihan. Biayanya hanya ditagihkan kepada anggota yang ikut, pada tagihan bulanan berikutnya.
# 6. Ulang tahun dan perayaan
- Klub merayakan ulang tahun dan hari jadi bersama keluarga.
- Tambahan seperti kue atau makan siang perayaan disepakati dengan keluarga lebih dulu dan ditagih pada tagihan berikutnya.
# 7. Kesehatan dan keselamatan
- Perawat melakukan pemeriksaan kesehatan (tekanan darah, suhu, berat badan) dan menyimpannya untuk perawatan anggota. Kontak keluarga melihatnya di aplikasi.
- Obat diberikan hanya sesuai rencana perawatan anggota. Bawa obat dalam kemasan aslinya, dengan petunjuk dokter.
- Dalam keadaan darurat klub memberi pertolongan pertama, memanggil ambulans bila perlu, dan segera menelepon kontak keluarga utama, lalu kontak lainnya.
- Beri tahu kami bila obat, alergi atau diagnosis berubah agar rencana perawatan tetap tepat.
# 8. Makanan dan alergi
- Makan siang dan teh disajikan setiap hari buka, sesuai diet anggota (misalnya rendah garam, tanpa gula atau makanan lunak).
- Beri tahu kami setiap alergi makanan. Dapur memeriksa setiap hidangan terhadap alergi anggota.
# 9. Barang bawaan
- Mohon beri nama pada kacamata, alat bantu dengar, alat bantu jalan dan pakaian. Klub tidak bertanggung jawab atas uang atau barang berharga yang dibawa.
# 10. Foto
- Staf memotret kegiatan harian. Setiap foto hanya dibagikan kepada keluarga anggota yang ditandai di foto itu, jadi foto bersama dibagikan kepada keluarga setiap anggota yang ditandai di dalamnya.
- Penandaan wajah dan absen wajah dapat dimatikan kapan saja; tanyakan ke resepsionis.
# 11. Data pribadi
- Data anggota dan keluarga hanya dipakai untuk menjalankan keanggotaan dan merawat anggota, dan disimpan dengan aman.
- Keluarga dapat meminta melihat atau memperbaiki data yang kami simpan.
# 12. Keluhan dan kontak
- Bicaralah dengan resepsionis atau manajer klub, atau telepon klub. Kami membalas dalam 2 hari kerja.
# 13. Perubahan syarat ini
- Bila syarat berubah, keluarga diberi tahu di aplikasi dan harus membaca dan menyetujui versi baru sebelum melanjutkan.
# 14. Persetujuan
- Dengan menekan Setuju dan lanjutkan, Anda menyatakan telah membaca syarat ini untuk diri Anda dan untuk anggota yang menjadi keluarga Anda.`;
