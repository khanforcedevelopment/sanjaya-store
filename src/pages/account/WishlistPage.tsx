import { Heart } from 'lucide-react'
import { PageTitle, EmptyState, Skeleton } from '@/components/ui/misc'
import { ButtonLink } from '@/components/ui/Button'
import { ProductCard } from '@/features/catalog/ProductCard'
import { useWishlistActions } from '@/features/catalog/ProductRail'
import { useProducts, useWishlist } from '@/features/catalog/api'
import { useAuth } from '@/features/account/AuthProvider'
import { useDocumentMeta } from '@/lib/meta'

export function WishlistPage() {
  useDocumentMeta({ title: 'Wishlist', noindex: true })
  const { user } = useAuth()
  const { data: ids, isLoading: idsLoading } = useWishlist(user?.id)
  const list = ids ? [...ids] : []
  const { data, isLoading } = useProducts({ ids: list, sort: 'newest', limit: 60 }, list.length > 0)
  const wish = useWishlistActions()
  const loading = idsLoading || (list.length > 0 && isLoading)
  // Keep cards for items just removed off the page straight away.
  const items = (data?.items ?? []).filter((p) => ids?.has(p.id))

  return (
    <>
      <PageTitle title="Wishlist" subtitle={items.length ? `${items.length} saved item${items.length === 1 ? '' : 's'}` : undefined} />
      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="aspect-[3/4]" />)}</div>
      ) : !items.length ? (
        <EmptyState icon={<Heart />} title="Your wishlist is empty" action={<ButtonLink to="/categories">Browse the store</ButtonLink>}>
          Tap the heart on any product to save it here.
        </EmptyState>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4">
          {items.map((p) => <ProductCard key={p.id} p={p} wished onWish={(on) => wish.toggle(p.id, on)} />)}
        </div>
      )}
    </>
  )
}
