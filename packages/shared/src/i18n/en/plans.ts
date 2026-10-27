// plans strings (EN): round 15 phase 2, the membership plan catalogue on Plans and pricing.
export const plans = {
  list: 'Plans', add: 'Add plan', startFlex: 'Start from Flex', startGold: 'Start from Gold', quickAdd: 'Quick add',
  'kind.days': 'Days per month', 'kind.unlimited': 'Unlimited', quota: 'Days a month', active: 'Active', noPrice: 'No price',
  type: 'Type', name: 'Plan name', nameId: 'Name in Indonesian (optional)', price: 'Price per month', from: 'Price takes effect from', edit: 'Edit plan', editAria: 'Edit {name}',
  retired: 'Retired', activeAria: '{name} is active', quotaV: '{n} days a month', quotaVOne: '{n} day a month',
  addedToast: '{name} added.', savedToast: '{name} saved.', retiredToast: '{name} retired. Its members keep it.', activeToast: '{name} is active again.',
  keepNote: 'A retired plan leaves the pickers. Its members keep it and are still billed.',
  'err.name': 'Give the plan a name.', 'err.quota': 'Enter a number from 1 to 23.', 'err.price': 'Enter a price.',
} as const;
