import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ChevronLeft, ChevronRight, Gift, Truck, CalendarClock, Zap } from 'lucide-react'
import { ButtonLink } from '@/components/ui/Button'
import { SectionHeading, Skeleton } from '@/components/ui/misc'
import { Monogram } from '@/components/brand/Logo'
import { useBanners, useCategories, usePublicSetting, type Banner } from '@/features/catalog/api'
import { ProductRail } from '@/features/catalog/ProductRail'
import { categoryArt } from '@/features/catalog/categoryArt'
import { isBackendConfigured } from '@/lib/env'
import { cn } from '@/lib/cn'
import { useDocumentMeta } from '@/lib/meta'

export function HomePage() {
  useDocumentMeta({ title: 'Sanjaya Store | Electronics, fashion & lifestyle across India', description: 'Shop phones, laptops, sarees, kurtis, watches, bags and more. Free delivery on your first order, dispatched from Mumbai.' })
  return (
    <>
      <Hero />
      {isBackendConfigured && (
        <>
          <CategoryTiles />
          <DeliveryStrip />
          <FlashSale />
          <ProductRail eyebrow="Electronics" title="The flagship collection" params={{ category: 'mobiles', featured: false, sort: 'discount' }} href="/c/mobiles" />
          <ProductRail eyebrow="Work & create" title="Laptops and tablets" params={{ category: 'laptops-tablets', sort: 'rating' }} href="/c/laptops-tablets" />
          <PromoPair />
          <ProductRail eyebrow="Ethnic fashion" title="Heirloom sarees & kurtis" params={{ category: 'ethnic-wear', sort: 'discount' }} href="/c/ethnic-wear" />
          <ReferralBlock />
          <ProductRail eyebrow="Timepieces" title="Watches" params={{ category: 'watches' }} href="/c/watches" />
          <ProductRail eyebrow="Carry it well" title="Handbags & accessories" params={{ category: 'bags' }} href="/c/bags" />
          <InstallmentsBlock />
          <ProductRail eyebrow="Step out" title="Footwear" params={{ category: 'footwear', sort: 'newest' }} href="/c/footwear" />
        </>
      )}
    </>
  )
}

const FALLBACK_HERO: Banner = {
  id: 'fallback', placement: 'hero', eyebrow: 'Sanjaya Store', title: 'Luxury, delivered across India',
  subtitle: 'Electronics, fashion, footwear, watches, bags and lifestyle, dispatched from Mumbai.',
  cta_label: null, cta_href: null, image_url: null, theme: 'navy', sort_order: 0, is_active: true,
  starts_at: null, ends_at: null, created_at: '',
}

function Hero() {
  const { data, isLoading } = useBanners('hero')
  const slides = data?.length ? data : [FALLBACK_HERO]
  const [i, setI] = useState(0)
  const n = slides.length
  useEffect(() => {
    if (n < 2) return
    const t = setInterval(() => setI((x) => (x + 1) % n), 6500)
    return () => clearInterval(t)
  }, [n])
  const s = slides[i % n]!
  const light = s.theme === 'ivory'

  if (isLoading && isBackendConfigured) return <Skeleton className="h-[480px] rounded-none" />

  return (
    <section className={cn('relative overflow-hidden', light ? 'bg-ivory text-navy-900' : 'bg-navy-950 text-white')} aria-roledescription="carousel" aria-label="Featured">
      {!light && <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_70%_30%,rgba(216,180,92,0.22),transparent_55%),radial-gradient(ellipse_at_10%_90%,rgba(42,74,135,0.55),transparent_60%)]" />}
      <div className="container-x relative grid min-h-[440px] items-center gap-8 py-12 md:min-h-[520px] md:grid-cols-[1.1fr_0.9fr] md:py-16">
        <div key={s.id} className="animate-[fadeUp_0.7s_ease-out]">
          {s.eyebrow && <p className="eyebrow">{s.eyebrow}</p>}
          <h1 className={cn('mt-3 font-display text-[2.6rem] font-semibold leading-[1.02] sm:text-6xl lg:text-7xl', !light && 'text-white')}>
            {s.title}
          </h1>
          {s.subtitle && <p className={cn('mt-5 max-w-xl text-base sm:text-lg', light ? 'text-navy-700' : 'text-white/75')}>{s.subtitle}</p>}
          <div className="mt-8 flex flex-wrap gap-3">
            {s.cta_label && s.cta_href && <ButtonLink to={s.cta_href} size="lg">{s.cta_label} <ArrowRight className="size-4" /></ButtonLink>}
            <ButtonLink to="/deals" size="lg" variant={light ? 'outline' : 'light'}>Today&rsquo;s deals</ButtonLink>
          </div>
        </div>
        <div className="relative mx-auto hidden aspect-square w-full max-w-md md:block">
          <div className="absolute inset-0 rounded-full border border-gold-400/30" />
          <div className="absolute inset-6 rounded-full border border-gold-400/20" />
          {s.image_url ? (
            <img key={s.image_url} src={s.image_url} alt="" className="absolute inset-10 size-[calc(100%-5rem)] rounded-full object-cover shadow-2xl animate-[fadeIn_0.9s_ease-out]" />
          ) : (
            <Monogram className="absolute inset-16" />
          )}
        </div>
      </div>
      {n > 1 && (
        <div className="container-x relative flex items-center gap-3 pb-6">
          <button onClick={() => setI((x) => (x - 1 + n) % n)} className="grid size-9 place-items-center rounded-full border border-current/20 opacity-70 hover:opacity-100" aria-label="Previous slide"><ChevronLeft className="size-4" /></button>
          <div className="flex gap-2">
            {slides.map((b, k) => (
              <button key={b.id} onClick={() => setI(k)} aria-label={`Slide ${k + 1}`} aria-current={k === i}
                className={cn('h-1.5 rounded-full transition-all', k === i ? 'w-8 bg-gold-400' : 'w-3 bg-current opacity-30')} />
            ))}
          </div>
          <button onClick={() => setI((x) => (x + 1) % n)} className="grid size-9 place-items-center rounded-full border border-current/20 opacity-70 hover:opacity-100" aria-label="Next slide"><ChevronRight className="size-4" /></button>
        </div>
      )}
    </section>
  )
}

function CategoryTiles() {
  const { data } = useCategories()
  const top = (data ?? []).filter((c) => !c.parent_id)
  if (!top.length) return null
  return (
    <section className="container-x py-10">
      <SectionHeading eyebrow="Shop by category" title="Everything, beautifully curated" />
      <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-11">
        {top.map((c) => (
          <li key={c.id}>
            <Link to={`/c/${c.slug}`} className="group flex flex-col items-center gap-2 text-center">
              <span className="block aspect-square w-full max-w-28 overflow-hidden rounded-full border border-gold-400/40 bg-navy-900 p-1 transition group-hover:border-gold-500 group-hover:shadow-[var(--shadow-lift)]">
                <img src={c.image_url ?? categoryArt(c.slug)} alt="" loading="lazy" className="size-full rounded-full object-cover transition duration-500 group-hover:scale-110" />
              </span>
              <span className="text-xs font-semibold text-navy-900 sm:text-[13px]">{c.name}</span>
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
              <p className="text-sm text-navy-900/80">{b?.subtitle ?? 'Then just ₹50 per order. Delivered by our own team from Mumbai.'}</p>
            </div>
          </div>
          <ButtonLink to={b?.cta_href ?? '/delivery'} variant="navy">{b?.cta_label ?? 'Check your pincode'}</ButtonLink>
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
            <div className="relative z-10 max-w-[60%]">
              {b.eyebrow && <p className="eyebrow">{b.eyebrow}</p>}
              <h3 className="mt-2 font-display text-3xl font-semibold leading-tight">{b.title}</h3>
              {b.subtitle && <p className={cn('mt-2 text-sm', light ? 'text-navy-700' : 'text-white/70')}>{b.subtitle}</p>}
              <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-gold-600 group-hover:gap-2">{b.cta_label ?? 'Shop now'} <ArrowRight className="size-4" /></span>
            </div>
            {b.image_url && <img src={b.image_url} alt="" loading="lazy" className="absolute -right-6 bottom-0 top-0 my-auto aspect-square h-[115%] rounded-full object-cover opacity-95 transition duration-700 group-hover:scale-105" />}
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
          <p className="mt-1 text-navy-700">On laptops, electronics, watches and bags. Pay the first installment today and the rest monthly. Subject to verification.</p>
        </div>
        <ButtonLink to="/installments" variant="outline">How it works</ButtonLink>
      </div>
    </section>
  )
}
