// purchasing strings (ID).
import type { Same } from '../ns';
import type { purchasing as EN } from '../en/purchasing';

export const purchasing: Same<typeof EN> = {
  'cat.groceries': 'Bahan makanan', 'cat.medical': 'Perlengkapan medis', 'cat.hygiene': 'Kebersihan diri', 'cat.activity': 'Bahan aktivitas',
  'cat.cleaning': 'Kebersihan ruangan', 'cat.kitchen': 'Peralatan dapur', 'cat.marketplace': 'Marketplace online', 'cat.other': 'Lainnya',
  allCategories: 'Semua kategori', noCategory: 'Tanpa kategori',
  'src.shop': 'Toko', 'src.tokopedia': 'Tokopedia', 'src.other': 'Lainnya',
  boughtAt: 'Dibeli di', orderNo: 'No. pesanan',
  reading: 'Membaca nota…', autoFilled: 'Diisi otomatis: periksa sebelum mengirim.', readFailed: 'Nota tidak terbaca. Isi secara manual.',
  gapShort: 'Jumlah barang {sum}: kurang {diff} dari total', gapOver: 'Jumlah barang {sum}: lebih {diff} dari total',
  items: 'Barang', nItems: '{n} barang', addItem: 'Tambah barang',
  item: 'Barang', brand: 'Merek', qty: 'Jml', unit: 'Satuan', unitPrice: 'Harga satuan', amount: 'Jumlah', category: 'Kategori',
  remove: 'Hapus {name}', total: 'Total',
  'err.notImage': 'Hanya foto yang bisa dibaca.',
  'sp.month': 'Bulan ini', 'sp.lastMonth': 'Bulan lalu', 'sp.3m': '3 bulan', 'sp.6m': '6 bulan', 'sp.custom': 'Pilih tanggal',
  'sp.byCategory': 'Kategori', 'sp.byItem': 'Barang', 'sp.byBrand': 'Merek', 'sp.byVendor': 'Pemasok',
  'sp.period': 'Periode', 'sp.n_category': 'Kategori', 'sp.n_item': 'Jenis barang', 'sp.n_brand': 'Merek', 'sp.n_vendor': 'Pemasok', 'sp.summary': 'Ringkasan', 'sp.items': 'Barang', 'sp.spent': 'Terpakai', 'sp.itemMeta': '{qty} {unit} · rata-rata {price}', 'sp.purchases': 'Pembelian', 'sp.empty': 'Belum ada nota di periode ini',
  'pu.search': 'Cari barang atau merek', 'pu.allSources': 'Semua sumber', 'pu.waiting': 'Menunggu', 'pu.waitingSum': '{amount} menunggu keuangan',
  'pu.empty': 'Belum ada barang dibeli di periode ini', 'pu.approved': 'Disetujui keuangan', 'pu.waitingLong': 'Menunggu keuangan', 'pu.boughtBy': 'Dibeli oleh', 'pu.showAll': 'Tampilkan semua {n}', 'pu.date': 'Tanggal', 'pu.photoOf': 'Nota dari {supplier}', 'pu.noPhoto': 'Tidak ada foto nota ini', 'pu.whole': 'Seluruh nota (tanpa rincian barang)', 'pu.extra': 'Ongkir dan biaya lain', 'pu.wholeNote': 'Nota ini tidak mencantumkan barang.',
};
