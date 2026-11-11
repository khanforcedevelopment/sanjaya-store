import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  BarChart3, Bike, Boxes, CalendarClock, ChartPie, FileUp, Gift, Home, IdCard, LifeBuoy, Maximize2, Megaphone, Minimize2,
  PackageCheck, Plus, Search, Settings, Store, Truck, UserRound, Users, Warehouse,
} from 'lucide-react'
import { useAuth } from '@/features/account/AuthProvider'
import type { AppRole } from '@/lib/types'
import { cn } from '@/lib/cn'
import { useDocumentMeta } from '@/lib/meta'
import { resolveAsk } from './ask'
import '@/styles/admin-glass.css'

type Item = { to: string; label: string; icon: typeof BarChart3; roles: AppRole[]; end?: boolean }

const NAV: Item[] = [
  { to: '/admin', label: 'Overview', icon: Home, roles: ['operations', 'support', 'collections'], end: true },
  { to: '/admin/orders', label: 'Orders', icon: PackageCheck, roles: ['operations', 'support'] },
  { to: '/admin/products', label: 'Products', icon: Boxes, roles: ['operations'] },
  { to: '/admin/stock', label: 'Stock', icon: Warehouse, roles: ['operations'] },
  { to: '/admin/customers', label: 'Customers', icon: Users, roles: ['operations', 'support'] },
  { to: '/admin/fleet', label: 'Delivery fleet', icon: Truck, roles: ['operations'] },
  { to: '/admin/reports', label: 'Reports', icon: ChartPie, roles: ['operations'] },
  { to: '/admin/rider', label: 'My deliveries', icon: Bike, roles: ['delivery'] },
  { to: '/admin/support', label: 'Support', icon: LifeBuoy, roles: ['support'] },
  { to: '/admin/collections', label: 'Collections', icon: CalendarClock, roles: ['collections'] },
  { to: '/admin/import', label: 'Import', icon: FileUp, roles: ['operations'] },
  { to: '/admin/marketing', label: 'Banners & coupons', icon: Megaphone, roles: ['operations'] },
  { to: '/admin/delivery', label: 'Delivery zones', icon: Store, roles: ['operations'] },
  { to: '/admin/referrals', label: 'Referrals', icon: Gift, roles: ['super_admin'] },
  { to: '/admin/kyc', label: 'Identity checks', icon: IdCard, roles: ['super_admin'] },
  { to: '/admin/staff', label: 'Staff', icon: UserRound, roles: ['super_admin'] },
  { to: '/admin/settings', label: 'Settings', icon: Settings, roles: ['super_admin'] },
]

const DOCK = ['/admin', '/admin/orders', '/admin/products', '/admin/customers', '/admin/fleet', '/admin/reports']
const DOCK_LABEL: Record<string, string> = { '/admin': 'Overview', '/admin/fleet': 'Fleet' }

function FullscreenButton() {
  const [on, setOn] = useState(false)
  useEffect(() => {
    const f = () => setOn(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', f)
    return () => document.removeEventListener('fullscreenchange', f)
  }, [])
  if (typeof document === 'undefined' || !document.fullscreenEnabled) return null
  return (
    <button type="button" className="rail-btn" aria-label={on ? 'Exit full screen' : 'Full screen'}
      onClick={() => (on ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => undefined)}>
      {on ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
    </button>
  )
}

function AskBox() {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  return (
    <form role="search" className="flex h-11 w-full max-w-md items-center gap-2 rounded-full bg-white/55 px-2 pl-2.5 ring-1 ring-white/70"
      onSubmit={(e) => { e.preventDefault(); const to = resolveAsk(q); if (to) { navigate(to); setQ('') } }}>
      <span className="orb" aria-hidden />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder='Ask… "pending orders", "low stock", "delivery fleet"'
        aria-label="Ask: type what you are looking for" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#5f5d5a]" />
      <button type="submit" className="grid size-8 place-items-center rounded-full bg-[#141414] text-white" aria-label="Go"><Search className="size-4" /></button>
    </form>
  )
}

export function AdminLayout() {
  useDocumentMeta({ title: 'Staff panel', noindex: true })
  const { hasRole, profile } = useAuth()
  const { pathname } = useLocation()
  const links = NAV.filter((n) => hasRole(...n.roles))
  const dock = DOCK.map((to) => links.find((l) => l.to === to)).filter((x): x is Item => !!x)
  const name = profile?.full_name?.split(' ')[0] || 'Sanjaya'
  const initials = (profile?.full_name || 'S').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()

  return (
    <div className="glass-admin">
      <div className="mx-auto flex min-h-dvh max-w-[1500px] gap-4 px-3 pb-28 pt-3 sm:px-5 sm:pt-5">
        {/* Left icon rail */}
        <aside className="sticky top-5 hidden h-fit lg:block">
          <nav aria-label="Staff" className="glass flex flex-col items-center gap-1.5 !rounded-full p-1.5">
            <NavLink to="/" className="rail-btn" aria-label="Back to store"><Store className="size-4" /><span className="tip">Open the store</span></NavLink>
            <span className="my-1 h-px w-6 bg-white/70" aria-hidden />
            {links.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} aria-label={label} className={({ isActive }) => cn('rail-btn', isActive && 'active')}>
                <Icon className="size-[18px]" /><span className="tip">{label}</span>
              </NavLink>
            ))}
          </nav>
        </aside>

        <div className="min-w-0 flex-1">
          {/* Top bar */}
          <header className="glass mb-5 flex flex-wrap items-center gap-3 !rounded-[28px] p-2 pr-3 sm:!rounded-full">
            <div className="flex items-center gap-2.5">
              <span className="grid size-10 place-items-center rounded-full bg-gradient-to-br from-[#f4c534] to-[#f59f2f] text-sm font-bold text-[#141414]" aria-hidden>{initials}</span>
              <div className="leading-tight">
                <p className="text-[11px] muted">Welcome,</p>
                <p className="text-sm font-bold">{name}</p>
              </div>
            </div>
            <div className="order-3 flex w-full justify-center sm:order-none sm:w-auto sm:flex-1"><AskBox /></div>
            <div className="ml-auto flex items-center gap-1 sm:ml-0"><FullscreenButton /></div>
          </header>

          {/* Mobile: every page as scrolling chips (the rail is hidden on small screens) */}
          <nav aria-label="All staff pages" className="scrollbar-none -mx-3 mb-4 flex gap-1.5 overflow-x-auto px-3 lg:hidden">
            {links.map(({ to, label, end }) => (
              <NavLink key={to} to={to} end={end} className={({ isActive }) => cn('pill', isActive ? 'pill-on' : 'pill-ghost')}>{label}</NavLink>
            ))}
          </nav>

          <main key={pathname} className="page-in min-w-0"><Outlet /></main>
        </div>
      </div>

      {/* Bottom floating dock */}
      {dock.length > 1 && (
        <nav aria-label="Quick pages" className="fixed inset-x-0 bottom-3 z-40 flex justify-center px-3 pb-safe">
          <div className="glass scrollbar-none flex max-w-full items-center gap-1 overflow-x-auto !rounded-full p-1.5">
            {dock.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} className={({ isActive }) => cn('dock-btn', isActive && 'active')}>
                <Icon className="size-4" /> {DOCK_LABEL[to] ?? label}
              </NavLink>
            ))}
            {hasRole('operations') && (
              <NavLink to="/admin/products/new" aria-label="New product" className="ml-1 grid size-10 flex-none place-items-center rounded-full bg-[#141414] text-white">
                <Plus className="size-5" />
              </NavLink>
            )}
          </div>
        </nav>
      )}
    </div>
  )
}
