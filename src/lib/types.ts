import type { Database } from '@/types/database'

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type OrderStatus = Database['public']['Enums']['order_status']
export type AppRole = Database['public']['Enums']['app_role']
export type PaymentMode = Database['public']['Enums']['payment_mode']

export interface CartLine { variant_id: string; quantity: number }

export interface QuoteLine {
  variant_id: string; product_id: string; product_name: string; slug: string; variant_name: string; sku: string
  image_url: string | null; unit_price_paise: number; mrp_paise: number | null; quantity: number
  line_total_paise: number; in_stock: boolean; installment_eligible: boolean
}

export interface DeliveryQuote {
  pincode: string | null; known: boolean; serviceable: boolean; zone_id: string | null; zone_name: string | null
  is_remote: boolean; min_days: number | null; max_days: number | null
  estimated_min_date: string | null; estimated_max_date: string | null
  city: string | null; state: string | null; first_order_free: boolean; first_order_assumed: boolean
  standard_fee_paise: number
}

export interface Quote {
  lines: QuoteLine[]; subtotal_paise: number; discount_paise: number; delivery_fee_paise: number; total_paise: number
  errors: string[]
  coupon: { code: string | null; coupon_id: string | null; error: string | null }
  delivery: DeliveryQuote
  installment: { products_eligible: boolean; count: number; schedule_paise: number[] | null }
}

export interface PincodeCheck {
  known: boolean; serviceable: boolean; zone_name?: string; is_remote?: boolean; min_days?: number; max_days?: number
  city?: string | null; state?: string | null; estimated_min_date?: string; estimated_max_date?: string
  first_order_free?: boolean; standard_fee_paise?: number
}

export interface PlacedOrder {
  order_id: string; order_number: string; total_paise: number; amount_due_now_paise: number
  payment_mode: PaymentMode; payment_expires_at: string
}

export interface AddressInput {
  recipient_name: string; phone: string; house: string; street: string; landmark?: string | null
  city: string; state: string; pincode: string
  latitude?: number | null; longitude?: number | null; location_source: 'manual' | 'gps'
}
