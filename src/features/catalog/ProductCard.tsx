import { Link } from 'react-router-dom'
import { Heart } from 'lucide-react'
import { Price, Rating, Badge } from '@/components/ui/misc'
import { cn } from '@/lib/cn'
import { formatAED } from '@/lib/money'
import type { ListingItem } from './api'

export function ProductCard({ p, wished, onWish, className }: { p: ListingItem; wished?: boolean; onWish?: (on: boolean) => void; className?: string }) {
  const off = p.max_mrp && p.max_mrp > p.min_price ? Math.round(((p.max_mrp - p.min_price) / p.max_mrp) * 100) : 0
  return (
    <article className={cn('group relative flex flex-col overflow-hidden rounded-2xl border border-navy-100 bg-white transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]', className)}>
      <Link to={`/p/${p.slug}`} className="relative block aspect-square overflow-hidden bg-navy-50">
        {p.image_url && <img src={p.image_url} alt={p.name} loading="lazy" className="size-full object-cover transition duration-500 group-hover:scale-105" />}
        <div className="absolute left-2.5 top-2.5 flex flex-col items-start gap-1">
          {off >= 10 && <Badge tone="navy">{off}% off</Badge>}
          {!p.in_stock && <Badge tone="grey">Out of stock</Badge>}
        </div>
      </Link>
      {onWish && (
        <button
          onClick={() => onWish(!wished)}
          className="absolute right-2.5 top-2.5 grid size-9 place-items-center rounded-full bg-white/90 shadow-sm backdrop-blur transition hover:scale-105"
          aria-label={wished ? `Remove ${p.name} from wishlist` : `Add ${p.name} to wishlist`} aria-pressed={wished}
        >
          <Heart className={cn('size-4', wished ? 'fill-gold-500 text-gold-500' : 'text-navy-700')} />
        </button>
      )}
      <div className="flex flex-1 flex-col gap-1.5 p-3.5">
        {p.brand && <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gold-600">{p.brand}</p>}
        <Link to={`/p/${p.slug}`} className="line-clamp-2 text-sm font-medium leading-snug text-navy-900 hover:text-gold-700">{p.name}</Link>
        {p.rating_count > 0 && <Rating value={Number(p.rating_avg)} count={p.rating_count} />}
        <div className="mt-auto pt-1">
          <Price paise={p.min_price} mrpPaise={p.max_mrp} size="sm" />
          {p.variant_count > 1 && <p className="mt-0.5 text-[11px] text-navy-600/60">{p.variant_count} options</p>}
          {p.installment_eligible && p.min_price >= 500000 && <p className="mt-0.5 text-[11px] font-medium text-navy-700">or 6 × {formatAED(Math.ceil(p.min_price / 600) * 100)}/month</p>}
        </div>
      </div>
    </article>
  )
}
