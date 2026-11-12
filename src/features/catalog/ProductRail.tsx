import { ScrollRow } from '@/components/ui/ScrollRow'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { SectionHeading, Skeleton } from '@/components/ui/misc'
import { useAuth } from '@/features/account/AuthProvider'
import { useNavigate } from 'react-router-dom'
import { ProductCard } from './ProductCard'
import { useProducts, useToggleWishlist, useWishlist, type ListingParams } from './api'

export function ProductRail({ eyebrow, title, params, href }: { eyebrow?: string; title: string; params: ListingParams; href: string }) {
  const { data, isLoading } = useProducts({ limit: 10, ...params })
  const wish = useWishlistActions()
  if (!isLoading && !data?.items.length) return null
  return (
    <section className="container-x py-10">
      <SectionHeading eyebrow={eyebrow} title={title} action={<Link to={href} className="hidden items-center gap-1 text-sm font-semibold text-gold-700 hover:underline sm:flex">View all <ArrowRight className="size-4" /></Link>} />
      <ScrollRow tone="dark" wrapperClassName="-mx-4 sm:mx-0" className="flex snap-x gap-4 px-4 pb-2 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-5">
        {isLoading
          ? Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="aspect-[3/4] w-44 shrink-0 sm:w-auto" />)
          : data!.items.map((p) => (
              <ProductCard key={p.id} p={p} className="w-44 shrink-0 snap-start sm:w-auto" wished={wish.has(p.id)} onWish={(on) => wish.toggle(p.id, on)} />
            ))}
      </ScrollRow>
      <Link to={href} className="mt-4 flex items-center justify-center gap-1 text-sm font-semibold text-gold-700 sm:hidden">View all <ArrowRight className="size-4" /></Link>
    </section>
  )
}

export function useWishlistActions() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { data } = useWishlist(user?.id)
  const toggle = useToggleWishlist(user?.id)
  return {
    has: (id: string) => data?.has(id) ?? false,
    toggle: (id: string, on: boolean) => {
      if (!user) { navigate('/login?next=' + encodeURIComponent(location.pathname)); return }
      toggle.mutate({ productId: id, on })
    },
  }
}
