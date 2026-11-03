import { NavLink, Outlet } from 'react-router-dom'
import { BarChart3, Bike, Boxes, CalendarClock, IdCard, FileUp, Megaphone, PackageCheck, Settings, Truck, Users } from 'lucide-react'
import { useAuth } from '@/features/account/AuthProvider'
import { Wordmark } from '@/components/brand/Logo'
import type { AppRole } from '@/lib/types'
import { cn } from '@/lib/cn'
import { useDocumentMeta } from '@/lib/meta'

const NAV: { to: string; label: string; icon: typeof BarChart3; roles: AppRole[]; end?: boolean }[] = [
  { to: '/admin', label: 'Dashboard', icon: BarChart3, roles: ['operations', 'support', 'collections'], end: true },
  { to: '/admin/orders', label: 'Orders', icon: PackageCheck, roles: ['operations', 'support'] },
  { to: '/admin/rider', label: 'My deliveries', icon: Bike, roles: ['delivery'] },
  { to: '/admin/collections', label: 'Collections', icon: CalendarClock, roles: ['collections'] },
  { to: '/admin/products', label: 'Products', icon: Boxes, roles: ['operations'] },
  { to: '/admin/import', label: 'Import', icon: FileUp, roles: ['operations'] },
  { to: '/admin/marketing', label: 'Banners & coupons', icon: Megaphone, roles: ['operations'] },
  { to: '/admin/delivery', label: 'Delivery zones', icon: Truck, roles: ['operations'] },
  { to: '/admin/kyc', label: 'Identity checks', icon: IdCard, roles: ['super_admin'] },
  { to: '/admin/staff', label: 'Staff', icon: Users, roles: ['super_admin'] },
  { to: '/admin/settings', label: 'Settings', icon: Settings, roles: ['super_admin'] },
]

export function AdminLayout() {
  useDocumentMeta({ title: 'Staff panel', noindex: true })
  const { hasRole, profile, roles } = useAuth()
  const links = NAV.filter((n) => hasRole(...n.roles))
  return (
    <div className="min-h-dvh bg-ivory lg:grid lg:grid-cols-[230px_1fr]">
      <aside className="bg-navy-950 text-white lg:sticky lg:top-0 lg:h-dvh">
        <div className="flex items-center justify-between px-4 py-4 lg:block">
          <NavLink to="/" aria-label="Back to store"><Wordmark className="h-9" /></NavLink>
          <p className="text-xs text-white/60 lg:mt-3">{profile?.full_name} · {roles.map((r) => r.replace('_', ' ')).join(', ')}</p>
        </div>
        <nav className="scrollbar-none flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col" aria-label="Staff">
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => cn('flex items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm', isActive ? 'bg-gold-400 font-semibold text-navy-950' : 'text-white/80 hover:bg-white/10')}>
              <Icon className="size-4" /> {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="min-w-0 p-4 sm:p-6"><Outlet /></main>
    </div>
  )
}
