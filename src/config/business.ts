/**
 * Public business identity. Contact details were taken from the public
 * sanjayatrading.store website on 2026-11-03 and must be confirmed by the
 * owner before launch (see PROJECT_STATUS.md, open questions).
 */
export const business = {
  storeName: 'Sanjaya Store',
  legalName: 'Sanjaya Trading FZE',
  registeredAddress:
    'Office BLV-6F-SF60793, Ajman Boulevard-A Building, Business District, Ajman Free Zone, UAE',
  dispatchCity: 'Ajman',
  dispatchCountry: 'United Arab Emirates',
  market: 'AE',
  currency: 'AED',
  /** Standard delivery after the free first order (site setting delivery.default_fee_paise, in fils). */
  deliveryFeeLabel: 'AED 15',
  vatRatePercent: 5,
  supportEmail: 'admin@sanjayatrading.com',
  supportPhone: '+971 56 911 0077',
  whatsappNumber: '971569110077',
} as const
