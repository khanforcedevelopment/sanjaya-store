import { Link, Outlet } from 'react-router-dom'
import { business } from '@/config/business'

export function SiteLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="bg-navy-900 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link to="/" className="font-display text-xl tracking-[0.2em] text-gold-400">
            SANJAYA <span className="text-white">STORE</span>
          </Link>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="bg-navy-950 text-sm text-white/70">
        <div className="mx-auto max-w-6xl px-4 py-6">
          © {new Date().getFullYear()} {business.legalName}. Dispatch from {business.dispatchCity}, {business.dispatchCountry}.
        </div>
      </footer>
    </div>
  )
}
