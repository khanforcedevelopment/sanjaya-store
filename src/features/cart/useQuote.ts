import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { requireSupabase, supabase } from '@/lib/supabase'
import type { CartLine, Quote } from '@/lib/types'

/** Live server-side price quote for the cart. The server is the only source of prices. */
export function useQuote(lines: CartLine[], pincode?: string | null, coupon?: string | null, userId?: string | null) {
  const validPin = pincode && /^[1-9][0-9]{5}$/.test(pincode) ? pincode : null
  return useQuery({
    queryKey: ['quote', lines, validPin, coupon || null, userId ?? null],
    enabled: !!supabase && lines.length > 0,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await requireSupabase().rpc('quote_cart', {
        p_items: lines as never, p_pincode: validPin ?? undefined, p_coupon_code: coupon || undefined,
      })
      if (error) throw error
      return data as unknown as Quote
    },
  })
}
