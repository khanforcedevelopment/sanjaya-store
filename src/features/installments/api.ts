import { useQuery } from '@tanstack/react-query'
import { requireSupabase, supabase } from '@/lib/supabase'
import { usePublicSetting } from '@/features/catalog/api'

export type InstallmentSettings = {
  enabled: boolean; live_enabled: boolean; count: number; grace_days: number
  require_kyc: boolean; require_phone_verified: boolean
  min_order_total_paise: number; max_order_total_paise: number; agreement_version: string
}
export type Eligibility = { eligible: boolean; reasons: string[] }

export const useInstallmentSettings = () => usePublicSetting<InstallmentSettings>('installments')

/** The signed-in customer's own eligibility (account checks only; order amount is checked at checkout). */
export function useMyEligibility(enabled = true) {
  return useQuery({
    queryKey: ['installments', 'eligibility'],
    enabled: !!supabase && enabled,
    queryFn: async () => {
      const { data, error } = await requireSupabase().rpc('my_installment_eligibility')
      if (error) throw error
      return data as unknown as Eligibility
    },
  })
}

/** Where a customer can fix each eligibility reason. */
export function reasonLink(reason: string): { to: string; label: string } | null {
  if (/KYC|identity/i.test(reason)) return { to: '/account/verify', label: 'Verify identity' }
  if (/mobile/i.test(reason)) return { to: '/account/profile', label: 'Verify mobile' }
  if (/overdue/i.test(reason)) return { to: '/account/installments', label: 'Pay now' }
  if (/sign in/i.test(reason)) return { to: '/login?next=/installments', label: 'Sign in' }
  return null
}

export function useMyPlans(enabled = true) {
  return useQuery({
    queryKey: ['installments', 'plans'],
    enabled: !!supabase && enabled,
    queryFn: async () => {
      const { data, error } = await requireSupabase().from('installment_plans')
        .select('*, order:orders(id, order_number, status), installments(*)')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data.map((p) => ({ ...p, installments: [...p.installments].sort((a, b) => a.seq - b.seq) }))
    },
  })
}
