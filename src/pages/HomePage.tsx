import { isBackendConfigured } from '@/lib/env'

/**
 * Phase 1 placeholder. The real storefront (hero banners, collections, flash
 * sales) is built in Phase 3 and Phase 4.
 */
export function HomePage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-20 text-center">
      <p className="text-xs uppercase tracking-[0.3em] text-gold-600">Coming soon</p>
      <h1 className="mt-4 font-display text-4xl text-navy-900 sm:text-5xl">Sanjaya Store</h1>
      <p className="mt-4 text-lg text-navy-800/80">
        Electronics, fashion, footwear, watches, bags and lifestyle, delivered across India.
      </p>
      <p className="mt-10 text-xs text-navy-800/60" data-testid="backend-status">
        Backend: {isBackendConfigured ? 'connected' : 'not configured yet'}
      </p>
    </section>
  )
}
