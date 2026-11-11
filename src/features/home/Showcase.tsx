import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { useProducts, type ListingItem } from '@/features/catalog/api'
import { formatAED } from '@/lib/money'
import { cn } from '@/lib/cn'

const offOf = (p: ListingItem) => (p.max_mrp && p.max_mrp > p.min_price ? Math.round(((p.max_mrp - p.min_price) / p.max_mrp) * 100) : 0)

/** Best-discount products of a category that have a photo. */
export function useCategoryPicks(category: string | null, count: number) {
  const { data, isLoading } = useProducts({ category, sort: 'discount', limit: Math.max(12, count * 3), inStock: true }, !!category)
  // Photos already copied to our own storage first: they load fastest and never depend on the supplier's server
  const items = (data?.items ?? []).filter((p) => p.image_url).sort((x, y) => Number(isOurs(y.image_url)) - Number(isOurs(x.image_url)))
  const seen = new Set<string>()
  const picks = items.filter((p) => { const k = p.image_url!; if (seen.has(k)) return false; seen.add(k); return true }).slice(0, count)
  const maxOff = items.reduce((m, p) => Math.max(m, offOf(p)), 0)
  return { picks, maxOff, isLoading }
}

const isOurs = (u: string | null) => !!u && u.includes('.supabase.co/storage/')

export const categoryFromHref = (href: string | null) => href?.match(/^\/c\/([\w-]+)/)?.[1] ?? null

function PickCard({ p, className, imgClass, tabbable, compact }: { p: ListingItem; className?: string; imgClass?: string; tabbable: boolean; compact?: boolean }) {
  const off = offOf(p)
  return (
    <Link to={`/p/${p.slug}`} tabIndex={tabbable ? 0 : -1} title={p.name}
      className={cn('group absolute flex flex-col overflow-hidden rounded-[1.75rem] bg-white p-3 shadow-[0_30px_60px_-25px_rgba(0,0,0,0.6)] ring-1 ring-gold-300/50 transition duration-500 hover:-translate-y-1 hover:ring-gold-400', className)}>
      {off > 0 && <span className={cn('absolute z-10 rounded-full bg-danger font-bold text-white', compact ? 'left-1.5 top-1.5 px-1.5 text-[9px]' : 'left-3 top-3 px-2 py-0.5 text-[11px]')}>-{off}%</span>}
      <span className="relative block flex-1"><img src={p.image_url!} alt="" loading="lazy" className={cn('absolute inset-0 size-full object-contain transition duration-500 group-hover:scale-105', imgClass)} /></span>
      <span className="mt-1 flex items-baseline justify-center gap-1.5 whitespace-nowrap text-navy-900">
        <span className={cn('font-bold', compact ? 'text-[11px]' : 'text-sm')}>{formatAED(p.min_price)}</span>
        {off > 0 && !compact && <span className="text-[11px] text-navy-600/60 line-through">{formatAED(p.max_mrp!)}</span>}
      </span>
    </Link>
  )
}

/** Hero artwork built from real catalogue photos: three floating product cards and a discount seal. */
export function ShowcaseMedia({ category, active, light }: { category: string; active: boolean; light: boolean }) {
  const { picks, maxOff } = useCategoryPicks(category, 3)
  const [a, b, c] = picks
  return (
    <div className={cn('absolute inset-0 -z-10 transition-opacity duration-1000 ease-out', active ? 'opacity-100' : 'pointer-events-none opacity-0')} inert={!active}>
      <div className={cn('absolute inset-0', light
        ? 'bg-[radial-gradient(ellipse_at_72%_45%,#fff_0%,#F6EEDC_45%,#EADBB8_100%)]'
        : 'bg-[radial-gradient(ellipse_at_72%_42%,#1B3A78_0%,#0A1838_45%,#050C1F_100%)]')} />
      <div className="pointer-events-none absolute right-[6%] top-1/2 hidden aspect-square w-[44%] max-w-[620px] -translate-y-1/2 rounded-full border border-gold-400/30 md:block" />
      <div className="pointer-events-none absolute right-[12%] top-1/2 hidden aspect-square w-[32%] max-w-[460px] -translate-y-1/2 rounded-full border border-gold-400/20 md:block" />
      <div className="pointer-events-none absolute right-[18%] top-1/2 hidden aspect-square w-[24%] -translate-y-1/2 rounded-full bg-gold-400/25 blur-3xl md:block" />

      {/* Desktop: three floating cards on the right */}
      <div className="absolute inset-y-0 right-0 hidden w-[56%] md:block">
        {b && <PickCard p={b} tabbable={active} className="left-[4%] top-[16%] size-[clamp(150px,15vw,220px)] -rotate-6 animate-[floatY_7s_ease-in-out_infinite]" />}
        {a && <PickCard p={a} tabbable={active} className="left-[28%] top-1/2 size-[clamp(240px,24vw,360px)] -translate-y-1/2 animate-[floatY_8s_ease-in-out_infinite_0.6s]" imgClass="p-2" />}
        {c && <PickCard p={c} tabbable={active} className="bottom-[12%] right-[6%] size-[clamp(150px,15vw,220px)] rotate-6 animate-[floatY_6.5s_ease-in-out_infinite_1.2s]" />}
        {maxOff > 0 && (
          <span className="absolute right-[8%] top-[12%] grid size-28 place-items-center rounded-full bg-gradient-to-br from-gold-200 via-gold-400 to-gold-600 text-center text-navy-950 shadow-[0_15px_40px_-10px_rgba(194,154,59,0.9)] ring-4 ring-white/30 lg:size-32">
            <span className="flex flex-col items-center gap-1 leading-none"><span className="block text-[11px] font-bold tracking-[0.2em]">UP TO</span><span className="block font-display text-4xl font-bold lg:text-[2.8rem]">{maxOff}%</span><span className="block text-[11px] font-bold tracking-[0.2em]">OFF</span></span>
          </span>
        )}
      </div>

      {/* Phone: a row of cards above the text */}
      <div className="absolute inset-x-4 top-6 flex justify-center gap-3 md:hidden">
        {picks.map((p, k) => (
          <div key={p.id} className={cn('relative h-28 w-[28%] max-w-28', k === 1 && 'translate-y-3')}>
            <PickCard p={p} tabbable={active} compact className="inset-0 rounded-2xl p-1.5" />
          </div>
        ))}
        {maxOff > 0 && <span className="absolute -bottom-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-gradient-to-br from-gold-200 to-gold-500 px-3 py-1 text-xs font-bold text-navy-950 shadow">UP TO {maxOff}% OFF</span>}
      </div>
    </div>
  )
}

const OFFERS: { category: string; label: string; tone: 'navy' | 'ivory' | 'gold' | 'ink' }[] = [
  { category: 'cookware', label: 'Cookware', tone: 'navy' },
  { category: 'earphones-headphones', label: 'Earphones & headphones', tone: 'ivory' },
  { category: 'wearables-smartwatches', label: 'Smartwatches', tone: 'gold' },
  { category: 'drinkware-barware', label: 'Drinkware', tone: 'ink' },
]
const TONES = {
  navy: 'bg-gradient-to-br from-navy-800 to-navy-950 text-white',
  ivory: 'bg-gradient-to-br from-white to-[#F1E7D2] text-navy-900',
  gold: 'bg-gradient-to-br from-gold-200 via-gold-300 to-gold-500 text-navy-950',
  ink: 'bg-gradient-to-br from-[#2A1F12] to-[#0E1526] text-white',
}

function OfferCard({ category, label, tone }: (typeof OFFERS)[number]) {
  const { picks, maxOff, isLoading } = useCategoryPicks(category, 1)
  const p = picks[0]
  if (!isLoading && !p) return null
  return (
    <Link to={`/c/${category}`} className={cn('group relative flex min-h-44 overflow-hidden rounded-3xl p-5 shadow-[var(--shadow-card)] ring-1 ring-gold-400/30 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)] sm:min-h-52 sm:p-6', TONES[tone])}>
      <div className="relative z-10 flex max-w-[54%] flex-col">
        <span className={cn('text-[10px] font-bold uppercase tracking-[0.22em]', tone === 'gold' ? 'text-navy-800' : 'text-gold-500')}>{label}</span>
        {maxOff > 0
          ? <span className="mt-2 font-display text-[2rem] font-bold leading-none sm:text-5xl">{maxOff}%<span className="ml-1 text-base font-semibold sm:text-xl">off</span></span>
          : <span className="mt-2 font-display text-2xl font-bold leading-tight">New arrivals</span>}
        <span className="mt-1 text-xs opacity-75">{maxOff > 0 ? 'On selected items' : 'Just landed'}</span>
        <span className="mt-auto inline-flex items-center gap-1 pt-3 text-xs font-semibold group-hover:gap-2">Shop now <ArrowRight className="size-3.5" /></span>
      </div>
      {p && (
        <span className="absolute bottom-0 right-3 top-0 my-auto aspect-square h-[66%] rounded-full bg-white p-3 shadow-xl ring-4 ring-white/40 transition duration-500 group-hover:scale-105 sm:right-3">
          <img src={p.image_url!} alt="" loading="lazy" className="size-full object-contain" />
        </span>
      )}
    </Link>
  )
}

/** Row of four offer banners under the hero, each built from the category's best deal. */
export function OfferGrid() {
  return (
    <section className="container-x pt-8" aria-label="Offers">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
        {OFFERS.map((o) => <OfferCard key={o.category} {...o} />)}
      </div>
    </section>
  )
}
