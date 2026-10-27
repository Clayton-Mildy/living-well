// purchasing strings (EN): round 14 phase 2, itemised receipts, supplier categories and the Spending screen.
export const purchasing = {
  // the eight spend categories (a fixed list)
  'cat.groceries': 'Groceries', 'cat.medical': 'Medical supplies', 'cat.hygiene': 'Hygiene & toiletries', 'cat.activity': 'Activity materials',
  'cat.cleaning': 'Cleaning', 'cat.kitchen': 'Kitchen equipment', 'cat.marketplace': 'Online marketplace', 'cat.other': 'Other',
  allCategories: 'All categories', noCategory: 'No category',
  'src.shop': 'Shop', 'src.tokopedia': 'Tokopedia', 'src.other': 'Other',
  // capture
  boughtAt: 'Bought at', orderNo: 'Order no.',
  reading: 'Reading the receipt…', autoFilled: 'Filled in automatically: check before sending.', readFailed: "Couldn't read the receipt. Fill it in by hand.",
  gapShort: 'Items add up to {sum}: {diff} short of the total', gapOver: 'Items add up to {sum}: {diff} over the total',
  // lines
  items: 'Items', nItems: '{n} items', addItem: 'Add item',
  item: 'Item', brand: 'Brand', qty: 'Qty', unit: 'Unit', unitPrice: 'Unit price', amount: 'Amount', category: 'Category',
  remove: 'Remove {name}', total: 'Total',
  'err.notImage': 'Only a photo can be read.',
  // Spending
  'sp.month': 'This month', 'sp.3m': '3 months', 'sp.6m': '6 months', 'sp.custom': 'Custom',
  'sp.byCategory': 'Category', 'sp.byItem': 'Item', 'sp.byBrand': 'Brand', 'sp.byVendor': 'Vendor',
  'sp.spent': 'Spent', 'sp.itemMeta': '{qty} {unit} · avg {price}', 'sp.purchases': 'Purchases', 'sp.empty': 'No approved receipts in this period',
};
