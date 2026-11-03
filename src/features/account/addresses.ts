import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { requireSupabase, supabase } from '@/lib/supabase'
import { normaliseIndianMobile } from '@/lib/phone'
import type { Tables } from '@/lib/types'

export type Address = Tables<'addresses'>

export const addressSchema = z.object({
  label: z.string().trim().min(1, 'Give this address a name').max(40),
  recipient_name: z.string().trim().min(2, 'Enter the full name').max(120),
  phone: z.string().transform((v, ctx) => {
    const n = normaliseIndianMobile(v)
    if (!n) { ctx.addIssue({ code: 'custom', message: 'Enter a valid 10-digit mobile number' }); return z.NEVER }
    return n
  }),
  house: z.string().trim().min(1, 'Enter house or flat number').max(120),
  street: z.string().trim().min(2, 'Enter street or area').max(200),
  landmark: z.string().trim().max(200).optional().transform((v) => v || null),
  city: z.string().trim().min(2, 'Enter the city').max(80),
  state: z.string().trim().min(2, 'Choose the state').max(80),
  pincode: z.string().trim().regex(/^[1-9][0-9]{5}$/, 'Enter a valid 6-digit pincode'),
  is_default: z.boolean().default(false),
  latitude: z.number().min(-90).max(90).nullable().default(null),
  longitude: z.number().min(-180).max(180).nullable().default(null),
  location_source: z.enum(['manual', 'gps']).default('manual'),
})
export type AddressDraft = z.input<typeof addressSchema>
export type AddressValues = z.output<typeof addressSchema>

export const emptyAddress: AddressDraft = {
  label: 'Home', recipient_name: '', phone: '', house: '', street: '', landmark: '', city: '', state: '', pincode: '', is_default: false,
}

export function toDraft(a: Address): AddressDraft {
  return {
    label: a.label, recipient_name: a.recipient_name, phone: a.phone.replace(/^\+91/, ''), house: a.house, street: a.street,
    landmark: a.landmark ?? '', city: a.city, state: a.state, pincode: a.pincode, is_default: a.is_default,
    latitude: a.latitude, longitude: a.longitude, location_source: a.location_source as 'manual' | 'gps',
  }
}

export function useAddresses(userId: string | undefined) {
  return useQuery({
    queryKey: ['addresses', userId],
    enabled: !!supabase && !!userId,
    queryFn: async () => {
      const { data, error } = await requireSupabase().from('addresses').select('*')
        .order('is_default', { ascending: false }).order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useSaveAddress(userId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: AddressValues }) => {
      const db = requireSupabase()
      const { is_default, ...rest } = values
      if (id) {
        const { error } = await db.from('addresses').update(rest).eq('id', id)
        if (error) throw error
        if (is_default) {
          const { error: e2 } = await db.rpc('set_default_address', { p_address: id })
          if (e2) throw e2
        }
        return id
      }
      const { data, error } = await db.from('addresses').insert({ ...values, user_id: userId! }).select('id').single()
      if (error) throw error
      return data.id
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['addresses'] }),
  })
}

export function useDeleteAddress() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await requireSupabase().from('addresses').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['addresses'] }),
  })
}

export function useSetDefaultAddress() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await requireSupabase().rpc('set_default_address', { p_address: id })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['addresses'] }),
  })
}

export function formatAddressLines(a: Pick<Address, 'house' | 'street' | 'landmark' | 'city' | 'state' | 'pincode'>): string[] {
  return [`${a.house}, ${a.street}`, a.landmark ? `Near ${a.landmark}` : '', `${a.city}, ${a.state} ${a.pincode}`].filter(Boolean)
}
