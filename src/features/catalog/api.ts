import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { requireSupabase, supabase } from '@/lib/supabase'
import type { PincodeCheck, Tables } from '@/lib/types'

export interface ListingItem {
  id: string; slug: string; name: string; brand: string | null; tags: string[]
  min_price: number; max_mrp: number | null; in_stock: boolean; image_url: string | null
  rating_avg: number; rating_count: number; is_featured: boolean; category_slug: string; category_name: string
  variant_count: number; first_variant_id: string; first_variant_name: string; installment_eligible: boolean
}
export interface ListingResult {
  items: ListingItem[]
  facets: { total: number; brands: { brand: string; count: number }[]; price_min: number | null; price_max: number | null }
}
export interface ListingParams {
  category?: string | null; q?: string | null; brands?: string[]; min?: number | null; max?: number | null
  inStock?: boolean; tag?: string | null; featured?: boolean; sort?: string; limit?: number; offset?: number
}

export function useProducts(params: ListingParams, enabled = true) {
  return useQuery({
    queryKey: ['products', params],
    enabled: !!supabase && enabled,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await requireSupabase().rpc('search_products', {
        p_category: params.category ?? undefined,
        p_query: params.q ?? undefined,
        p_brands: params.brands?.length ? params.brands : undefined,
        p_min_paise: params.min ?? undefined,
        p_max_paise: params.max ?? undefined,
        p_in_stock: params.inStock ?? false,
        p_tag: params.tag ?? undefined,
        p_featured: params.featured ?? false,
        p_sort: params.sort ?? 'relevance',
        p_limit: params.limit ?? 24,
        p_offset: params.offset ?? 0,
      })
      if (error) throw error
      return data as unknown as ListingResult
    },
  })
}

export type Category = Tables<'categories'>
export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    enabled: !!supabase,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await requireSupabase().from('categories').select('*').eq('is_active', true).order('sort_order')
      if (error) throw error
      return data
    },
  })
}

export type Banner = Tables<'banners'>
export function useBanners(placement: 'hero' | 'strip' | 'promo') {
  return useQuery({
    queryKey: ['banners', placement],
    enabled: !!supabase,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await requireSupabase().from('banners').select('*').eq('placement', placement).order('sort_order')
      if (error) throw error
      return data
    },
  })
}

export function usePublicSetting<T = Record<string, unknown>>(key: string) {
  return useQuery({
    queryKey: ['setting', key],
    enabled: !!supabase,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await requireSupabase().from('site_settings').select('value').eq('key', key).maybeSingle()
      if (error) throw error
      return (data?.value ?? null) as T | null
    },
  })
}

export type ProductDetail = Tables<'products'> & {
  category: Pick<Tables<'categories'>, 'id' | 'slug' | 'name' | 'installment_eligible' | 'parent_id'> | null
  variants: Tables<'product_variants'>[]
  images: Tables<'product_images'>[]
}

export function useProduct(slug: string | undefined) {
  return useQuery({
    queryKey: ['product', slug],
    enabled: !!supabase && !!slug,
    queryFn: async () => {
      const { data, error } = await requireSupabase()
        .from('products')
        .select('*, category:categories(id, slug, name, installment_eligible, parent_id), variants:product_variants(*), images:product_images(*)')
        .eq('slug', slug!)
        .maybeSingle()
      if (error) throw error
      if (!data) return null
      const d = data as unknown as ProductDetail
      d.variants = d.variants.filter((v) => v.is_active).sort((a, b) => a.sort_order - b.sort_order || a.price_paise - b.price_paise)
      d.images = d.images.sort((a, b) => a.sort_order - b.sort_order)
      return d
    },
  })
}

export function usePincodeCheck(pincode: string | null) {
  return useQuery({
    queryKey: ['pincode', pincode],
    enabled: !!supabase && !!pincode && /^[1-9][0-9]{5}$/.test(pincode),
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await requireSupabase().rpc('check_pincode', { p_pincode: pincode! })
      if (error) throw error
      return data as unknown as PincodeCheck
    },
  })
}

export type Review = Tables<'reviews'> & { author: { full_name: string | null } | null }
export function useReviews(productId: string | undefined) {
  return useQuery({
    queryKey: ['reviews', productId],
    enabled: !!supabase && !!productId,
    queryFn: async () => {
      const { data, error } = await requireSupabase().rpc('product_reviews', { p_product: productId! })
      if (error) throw error
      return data as unknown as { id: string; rating: number; title: string | null; body: string | null; is_verified_purchase: boolean; author: string; created_at: string; is_mine: boolean }[]
    },
  })
}

export function useWishlist(userId: string | undefined) {
  return useQuery({
    queryKey: ['wishlist', userId],
    enabled: !!supabase && !!userId,
    queryFn: async () => {
      const { data, error } = await requireSupabase().from('wishlists').select('product_id')
      if (error) throw error
      return new Set(data.map((r) => r.product_id))
    },
  })
}

export function useToggleWishlist(userId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ productId, on }: { productId: string; on: boolean }) => {
      const db = requireSupabase()
      const { error } = on
        ? await db.from('wishlists').insert({ user_id: userId!, product_id: productId })
        : await db.from('wishlists').delete().eq('product_id', productId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wishlist'] }),
  })
}
