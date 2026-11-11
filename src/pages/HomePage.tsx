import { business } from '@/config/business'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ChevronLeft, ChevronRight, Gift, Truck, CalendarClock, Zap } from 'lucide-react'
import { ButtonLink } from '@/components/ui/Button'
import { SectionHeading, Skeleton } from '@/components/ui/misc'
import { useBanners, useCategories, usePublicSetting, type Banner } from '@/features/catalog/api'
import { ProductRail } from '@/features/catalog/ProductRail'
import { OfferGrid, ShowcaseMedia, categoryFromHref } from '@/features/home/Showcase'
import { categoryArt } from '@/features/catalog/categoryArt'
import { isBackendConfigured } from '@/lib/env'
import { cn } from '@/lib/cn'
import { useDocumentMeta } from '@/lib/meta'

export function HomePage() {
  useDocumentMeta({ title: 'Sanjaya Store | Online shopping across the UAE', description: 'Shop kitchen, electronics and accessories online. Prices in AED, free delivery on your first order, anywhere in the UAE.' })
  return (
    <>
      <Hero />
      {isBackendConfigured && (
        <>
          <OfferGrid />
          <CategoryTiles />
          <DeliveryStrip />
          <FlashSale />
          <ProductRail eyebrow="Kitchen & dining" title="Best deals for your kitchen" params={{ category: 'kitchen-dining', sort: 'discount' }} href="/c/kitchen-dining" />
          <ProductRail eyebrow="Cameras" title="Capture every moment" params={{ category: 'cameras', sort: 'discount' }} href="/c/cameras" />
          <PromoPair />
          <ProductRail eyebrow="Audio" title="Earphones & headphones" params={{ category: 'earphones-headphones', sort: 'discount' }} href="/c/earphones-headphones" />
          <ProductRail eyebrow="Wearables" title="Smartwatches & fitness bands" params={{ category: 'wearables-smartwatches', sort: 'discount' }} href="/c/wearables-smartwatches" />
          <ReferralBlock />
          <ProductRail eyebrow="Cookware" title="Pots, pans and sets" params={{ category: 'cookware', sort: 'discount' }} href="/c/cookware" />
          <ProductRail eyebrow="Mobile accessories" title="Chargers, cases and cables" params={{ category: 'mobile-accessories', sort: 'newest' }} href="/c/mobile-accessories" />
          <ProductRail eyebrow="Dining" title="Dinnerware & drinkware" params={{ category: 'dinnerware-tabletop', sort: 'discount' }} href="/c/dinnerware-tabletop" />
          <InstallmentsBlock />
        </>
      )}
    </>
  )
}

const FALLBACK_HERO: Banner = {
  id: 'fallback', placement: 'hero', eyebrow: 'Sanjaya Store', title: 'Luxury, delivered across the UAE',
  subtitle: 'Kitchen, electronics and everyday accessories, delivered to all seven emirates.',
  cta_label: null, cta_href: null, image_url: '/brand/hero/festive.webp', theme: 'navy', sort_order: 0, is_active: true,
  starts_at: null, ends_at: null, created_at: '',
}

/** Looping background films for hero images that have one (same name, .mp4). */
const HERO_VIDEOS: Record<string, string> = { '/brand/hero/festive.webp': '/brand/hero/festive.mp4' }
/** The original demo banners used small illustrations; show the full hero photos for them instead. */
const HERO_ART: Record<string, string> = {
  '/demo/saree-crimson.svg': '/brand/hero/festive.webp',
  '/demo/laptop-silver.svg': '/brand/hero/electronics.webp',
  '/demo/handbag-cognac.svg': '/brand/hero/gift.webp',
}
const SLIDE_MS = 7000

function prefersReducedMotion() {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

function Hero() {
  const { data, isLoading } = useBanners('hero')
  const slides = data?.length ? data : [FALLBACK_HERO]
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)
  const n = slides.length
  useEffect(() => {
    if (n < 2 || paused) return
    const t = setInterval(() => setI((x) => (x + 1) % n), SLIDE_MS)
    return () => clearInterval(t)
  }, [n, paused, i])
  const cur = i % n
  const s = slides[cur]!
  const light = s.theme === 'ivory'

  if (isLoading && isBackendConfigured) return <Skeleton className="h-[560px] rounded-none md:h-[640px]" />

  return (
    <section
      className={cn('relative isolate overflow-hidden transition-colors duration-700', light ? 'bg-ivory text-navy-900' : 'bg-navy-950 text-white')}
      aria-roledescription="carousel" aria-label="Featured"
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
    >
      {slides.map((b, k) => {
        const cat = !b.image_url ? categoryFromHref(b.cta_href) : null
        return cat
          ? <ShowcaseMedia key={b.id} category={cat} active={k === cur} light={b.theme === 'ivory'} />
          : <HeroMedia key={b.id} banner={b} active={k === cur} />
      })}
      <div className={cn('pointer-events-none absolute inset-0 -z-0 transition-opacity duration-700', !s.image_url && categoryFromHref(s.cta_href) && 'opacity-0',
        light
          ? 'bg-[linear-gradient(90deg,rgba(251,249,244,0.97)_0%,rgba(251,249,244,0.85)_38%,rgba(251,249,244,0.1)_70%,transparent_100%)] max-md:bg-[linear-gradient(0deg,rgba(251,249,244,0.98)_35%,rgba(251,249,244,0.6)_65%,rgba(251,249,244,0.1)_100%)]'
          : 'bg-[linear-gradient(90deg,rgba(5,12,31,0.96)_0%,rgba(5,12,31,0.8)_35%,rgba(5,12,31,0.15)_70%,transparent_100%)] max-md:bg-[linear-gradient(0deg,rgba(5,12,31,0.98)_35%,rgba(5,12,31,0.55)_65%,rgba(5,12,31,0.15)_100%)]')} />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px gold-rule" />

      <div className="container-x pointer-events-none relative flex min-h-[600px] flex-col justify-end pb-12 pt-44 md:min-h-[640px] md:justify-center md:py-20">
        <div key={s.id} className="pointer-events-auto max-w-xl animate-[fadeUp_0.8s_ease-out]">
          {s.eyebrow && (
            <p className="eyebrow flex items-center gap-3">
              <span className="h-px w-10 bg-gradient-to-r from-transparent to-gold-500" />{s.eyebrow}
            </p>
          )}
          <h1 className={cn('mt-4 font-display text-[2.7rem] font-semibold leading-[1.02] drop-shadow-sm sm:text-6xl lg:text-[4.6rem]', !light && 'text-white')}>
            {s.title}
          </h1>
          {s.subtitle && <p className={cn('mt-5 max-w-lg text-base sm:text-lg', light ? 'text-navy-700' : 'text-white/80')}>{s.subtitle}</p>}
          <div className="mt-8 flex flex-wrap gap-3">
            {s.cta_label && s.cta_href && <ButtonLink to={s.cta_href} size="lg">{s.cta_label} <ArrowRight className="size-4" /></ButtonLink>}
            <ButtonLink to="/deals" size="lg" variant={light ? 'outline' : 'light'}>Today&rsquo;s deals</ButtonLink>
          </div>
        </div>

        {n > 1 && (
          <div className="pointer-events-auto mt-10 flex items-center gap-4 md:absolute md:bottom-8 md:left-auto md:mt-0">
            <button onClick={() => setI((x) => (x - 1 + n) % n)} className="grid size-10 place-items-center rounded-full border border-current/25 backdrop-blur-sm opacity-80 hover:border-gold-400 hover:opacity-100" aria-label="Previous slide"><ChevronLeft className="size-4" /></button>
            <div className="flex gap-2">
              {slides.map((b, k) => (
                <button key={b.id} onClick={() => setI(k)} aria-label={`Slide ${k + 1}`} aria-current={k === cur}
                  className="relative h-1 w-10 overflow-hidden rounded-full bg-current/25 sm:w-14">
                  {k === cur && <span key={`${i}-${paused}`} className={cn('absolute inset-y-0 left-0 rounded-full bg-gold-400', paused ? 'w-full' : 'animate-[heroProgress_linear_forwards]')} style={{ animationDuration: `${SLIDE_MS}ms` }} />}
                </button>
              ))}
            </div>
            <button onClick={() => setI((x) => (x + 1) % n)} className="grid size-10 place-items-center rounded-full border border-current/25 backdrop-blur-sm opacity-80 hover:border-gold-400 hover:opacity-100" aria-label="Next slide"><ChevronRight className="size-4" /></button>
          </div>
        )}
      </div>
    </section>
  )
}

function HeroMedia({ banner, active }: { banner: Banner; active: boolean }) {
  const src = banner.image_url ? (HERO_ART[banner.image_url] ?? banner.image_url) : null
  const video = src ? HERO_VIDEOS[src] : undefined
  const ref = useRef<HTMLVideoElement>(null)
  const [canVideo] = useState(() => !!video && !prefersReducedMotion())
  useEffect(() => {
    const v = ref.current
    if (!v) return
    try {
      if (active) { v.currentTime = 0; v.play()?.catch(() => {}) } else v.pause()
    } catch { /* autoplay blocked: the poster image stays */ }
  }, [active])
  if (!src) return null
  const small = src.startsWith('/brand/hero/') ? src.replace(/\.webp$/, '-sm.webp') : null
  return (
    <div aria-hidden className={cn('absolute inset-0 -z-10 transition-opacity duration-1000 ease-out', active ? 'opacity-100' : 'opacity-0')}>
      {canVideo ? (
        <video ref={ref} src={video} poster={src} muted loop playsInline preload={active ? 'auto' : 'metadata'}
          className="size-full object-cover object-[70%_center]" />
      ) : (
        <img src={src} srcSet={small ? `${small} 768w, ${src} 1344w` : undefined} sizes="100vw" alt=""
          fetchPriority={active ? 'high' : 'low'}
          className={cn('size-full object-cover object-[70%_center]', active && 'animate-[kenBurns_9s_ease-out_forwards]')} />
      )}
    </div>
  )
}

function CategoryTiles() {
  const { data } = useCategories()
  const all = data ?? []
  const subs = all.filter((c) => c.parent_id)
  const list = subs.length ? subs : all
  if (!list.length) return null
  return (
    <section className="container-x py-10">
      <SectionHeading eyebrow="Shop by category" title="Find exactly what you need" />
      <ul className="scrollbar-none -mx-4 grid auto-cols-[5.5rem] grid-flow-col grid-rows-2 gap-x-3 gap-y-5 overflow-x-auto px-4 pb-2 sm:mx-0 sm:auto-cols-auto sm:grid-flow-row sm:grid-cols-5 sm:grid-rows-none sm:overflow-visible sm:px-0 lg:grid-cols-7 xl:grid-cols-10">
        {list.map((c) => (
          <li key={c.id}>
            <Link to={`/c/${c.slug}`} className="group flex flex-col items-center gap-2 text-center">
              <span className="block aspect-square w-full max-w-24 overflow-hidden rounded-full bg-white p-2.5 shadow-[var(--shadow-card)] ring-1 ring-gold-400/40 transition group-hover:shadow-[var(--shadow-lift)] group-hover:ring-gold-500">
                <img src={c.image_url ?? categoryArt(c.slug)} alt="" loading="lazy" className="size-full object-contain transition duration-500 group-hover:scale-110" />
              </span>
              <span className="text-[11px] font-semibold leading-tight text-navy-900 sm:text-xs">{c.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

function DeliveryStrip() {
  const { data } = useBanners('strip')
  const b = data?.[0]
  return (
    <section className="container-x">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-gold-500 via-gold-300 to-gold-500 px-6 py-6 text-navy-950 sm:px-10">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-navy-950 text-gold-300"><Truck className="size-6" /></span>
            <div>
              <p className="font-display text-2xl font-semibold leading-tight">{b?.title ?? 'Free delivery on your first order'}</p>
              <p className="text-sm text-navy-900/80">{b?.subtitle ?? `Then just ${business.deliveryFeeLabel} per order, anywhere in the UAE.`}</p>
            </div>
          </div>
          <ButtonLink to={b?.cta_href ?? '/delivery'} variant="navy">{b?.cta_label ?? 'Check your emirate'}</ButtonLink>
        </div>
      </div>
    </section>
  )
}

interface FlashSaleSetting { enabled: boolean; title: string; tag: string; ends_at: string | null }
function FlashSale() {
  const { data: s } = usePublicSetting<FlashSaleSetting>('flash_sale')
  const ends = s?.ends_at ? new Date(s.ends_at).getTime() : null
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [])
  if (!s?.enabled || (ends && ends < now)) return null
  const left = ends ? Math.max(0, ends - now) : null
  const parts = left === null ? null : [Math.floor(left / 3.6e6), Math.floor((left % 3.6e6) / 6e4), Math.floor((left % 6e4) / 1000)]
  return (
    <div className="mt-10 bg-navy-900 text-white">
      <div className="container-x flex flex-wrap items-center justify-between gap-4 pt-8">
        <p className="flex items-center gap-2 font-display text-3xl font-semibold"><Zap className="size-7 fill-gold-400 text-gold-400" />{s.title}</p>
        {parts && (
          <p className="flex items-center gap-2 text-sm text-white/70" aria-label="Time left">
            Ends in
            {parts.map((v, k) => <span key={k} className="rounded-lg bg-white/10 px-2.5 py-1.5 font-mono text-lg font-bold tabular-nums text-gold-300">{String(v).padStart(2, '0')}</span>)}
          </p>
        )}
      </div>
      <div className="[&_h2]:text-white [&_section]:pt-6 [&_section]:pb-10">
        <ProductRail title="Limited-time prices" params={{ tag: s.tag, sort: 'discount' }} href={`/deals`} />
      </div>
    </div>
  )
}

function PromoPair() {
  const { data } = useBanners('promo')
  if (!data?.length) return null
  return (
    <section className="container-x grid gap-4 py-6 md:grid-cols-2">
      {data.slice(0, 2).map((b) => {
        const light = b.theme === 'ivory'
        return (
          <Link key={b.id} to={b.cta_href ?? '/'} className={cn('group relative flex min-h-60 overflow-hidden rounded-3xl p-8', light ? 'bg-[#F3ECDD] text-navy-900' : 'bg-navy-900 text-white')}>
            <div className="relative z-10 max-w-[58%]">
              {b.eyebrow && <p className="eyebrow">{b.eyebrow}</p>}
              <h3 className="mt-2 font-display text-3xl font-semibold leading-tight">{b.title}</h3>
              {b.subtitle && <p className={cn('mt-2 text-sm', light ? 'text-navy-700' : 'text-white/70')}>{b.subtitle}</p>}
              <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-gold-600 group-hover:gap-2">{b.cta_label ?? 'Shop now'} <ArrowRight className="size-4" /></span>
            </div>
            {b.image_url && <img src={b.image_url} alt="" loading="lazy" className={cn('absolute right-4 top-1/2 size-32 -translate-y-1/2 rounded-full border-4 bg-white object-cover shadow-lg transition duration-700 group-hover:scale-105 sm:right-6 sm:size-44 lg:size-52', light ? 'border-white' : 'border-gold-400/60')} />}
          </Link>
        )
      })}
    </section>
  )
}

function ReferralBlock() {
  return (
    <section className="container-x py-10">
      <div className="relative overflow-hidden rounded-3xl bg-navy-950 px-6 py-10 text-white sm:px-12">
        <div className="pointer-events-none absolute -right-20 -top-20 size-80 rounded-full bg-gold-500/20 blur-3xl" />
        <div className="relative grid items-center gap-8 md:grid-cols-[1fr_auto]">
          <div>
            <p className="eyebrow">Refer & earn</p>
            <h2 className="mt-2 font-display text-4xl font-semibold leading-tight">Invite 5 friends and get a <span className="gold-text">free gift</span></h2>
            <p className="mt-3 max-w-xl text-white/70">Share your personal link. When five friends receive their first order, a gift voucher is yours. Track every invite in your account.</p>
          </div>
          <div className="flex flex-col items-start gap-4">
            <ol className="flex gap-2" aria-label="Five friends">
              {[1, 2, 3, 4, 5].map((k) => <li key={k} className="grid size-11 place-items-center rounded-full border border-gold-400/50 font-display text-lg text-gold-300">{k}</li>)}
              <li className="grid size-11 place-items-center rounded-full bg-gold-400 text-navy-950"><Gift className="size-5" /></li>
            </ol>
            <ButtonLink to="/account/referrals">Get my invite link</ButtonLink>
          </div>
        </div>
      </div>
    </section>
  )
}

function InstallmentsBlock() {
  return (
    <section className="container-x py-6">
      <div className="grid items-center gap-6 rounded-3xl border border-gold-400/40 bg-white p-8 sm:p-10 md:grid-cols-[auto_1fr_auto]">
        <span className="grid size-16 place-items-center rounded-2xl bg-navy-900 text-gold-300"><CalendarClock className="size-8" /></span>
        <div>
          <h2 className="font-display text-3xl font-semibold text-navy-900">Pay in 6 easy installments</h2>
          <p className="mt-1 text-navy-700">On selected electronics. Pay the first installment today and the rest monthly. Subject to verification.</p>
        </div>
        <ButtonLink to="/installments" variant="outline">How it works</ButtonLink>
      </div>
    </section>
  )
}
