// form strings (ID).
import type { Same } from '../ns';
import type { form as EN } from '../en/form';

export const form: Same<typeof EN> = {
  food_shellfish: 'Kerang-kerangan', food_seafood: 'Makanan laut', food_fish: 'Ikan', food_peanuts: 'Kacang tanah', food_eggs: 'Telur', food_dairy: 'Produk susu', food_gluten: 'Gluten',
  drug_penicillin: 'Penisilin', drug_sulfa: 'Obat sulfa', drug_aspirin: 'Aspirin', drug_ibuprofen: 'Ibuprofen',
  mob_none: 'Tidak ada', mob_walkingStick: 'Tongkat', mob_walker: 'Walker', mob_wheelchair: 'Kursi roda',
  diet_softFood: 'Makanan lunak', diet_lowSalt: 'Rendah garam', diet_vegetarian: 'Vegetarian', diet_sugarFree: 'Bebas gula',
};
