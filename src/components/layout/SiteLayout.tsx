import { Suspense, useEffect } from 'react'
import { Outlet, ScrollRestoration, useLocation } from 'react-router-dom'
import { Header } from './Header'
import { Footer } from './Footer'
import { MobileNav } from './MobileNav'
import { BackendNotice } from './BackendNotice'
import { CartDrawer } from '@/features/cart/CartDrawer'
import { PageSpinner } from './PageSpinner'

export function SiteLayout() {
  const { pathname } = useLocation()
  useEffect(() => { document.documentElement.dataset.route = pathname.split('/')[1] || 'home' }, [pathname])
  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-white focus:px-4 focus:py-2">Skip to content</a>
      <Header />
      <BackendNotice />
      <main id="main" className="flex-1 pb-20 md:pb-0">
        <Suspense fallback={<PageSpinner />}><Outlet /></Suspense>
      </main>
      <Footer />
      <MobileNav />
      <CartDrawer />
      <ScrollRestoration />
    </div>
  )
}
