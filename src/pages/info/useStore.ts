import { usePublicSetting } from '@/features/catalog/api'

export type StoreInfo = {
  name: string; legal_name: string; support_email: string; support_phone: string; whatsapp: string
  registered_address: string; dispatch_address: string; gstin: string | null; grievance_officer: string | null
}
const FALLBACK: StoreInfo = {
  name: 'Sanjaya Store', legal_name: 'Sanjaya Trading FZE', support_email: 'admin@sanjayatrading.com', support_phone: '+971 56 911 0077',
  whatsapp: '971569110077', registered_address: 'Ajman Free Zone, UAE', dispatch_address: 'Mumbai, Maharashtra, India', gstin: null, grievance_officer: null,
}
/** Store details from Settings → Store details, with safe defaults while loading. */
export function useStore(): StoreInfo {
  const { data } = usePublicSetting<Partial<StoreInfo>>('store')
  return { ...FALLBACK, ...(data ?? {}) } as StoreInfo
}
